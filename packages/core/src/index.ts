export type TokenType = "color" | "number" | "string" | "boolean" | "unknown";

export interface DesignToken {
  name: string;
  path: string[];
  type: TokenType;
  value: string | number | boolean | null;
  collection?: string;
  mode?: string;
  description?: string;
}

export interface TokenDiff {
  type: "added" | "removed" | "changed";
  token: DesignToken;
}

export function isDesignTokenArray(value: unknown): value is DesignToken[] {
  const types: TokenType[] = ["color", "number", "string", "boolean", "unknown"];
  return Array.isArray(value) && value.every((token) =>
    isRecord(token) &&
    typeof token.name === "string" &&
    Array.isArray(token.path) && token.path.every((part) => typeof part === "string") &&
    types.includes(token.type as TokenType) &&
    (token.value === null || ["string", "number", "boolean"].includes(typeof token.value))
  );
}

type RecordValue = Record<string, unknown>;
const isRecord = (value: unknown): value is RecordValue =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const channel = (value: unknown) =>
  Math.round(Math.min(1, Math.max(0, typeof value === "number" ? value : 0)) * 255)
    .toString(16)
    .padStart(2, "0");

function normalizeValue(value: unknown, resolvedType: unknown): Pick<DesignToken, "type" | "value"> {
  if (resolvedType === "COLOR" && isRecord(value) && ["r", "g", "b"].every((key) => typeof value[key] === "number")) {
    const alpha = typeof value.a === "number" ? value.a : 1;
    return { type: "color", value: `#${channel(value.r)}${channel(value.g)}${channel(value.b)}${alpha < 1 ? channel(alpha) : ""}` };
  }
  if (resolvedType === "FLOAT" && typeof value === "number") return { type: "number", value };
  if (resolvedType === "STRING" && typeof value === "string") return { type: "string", value };
  if (resolvedType === "BOOLEAN" && typeof value === "boolean") return { type: "boolean", value };
  return { type: "unknown", value: null };
}

export function normalizeFigmaVariables(input: unknown): DesignToken[] {
  if (!isRecord(input)) return [];
  const root = isRecord(input.meta) ? input.meta : input;
  const variables = isRecord(root.variables) ? root.variables : {};
  const collections = isRecord(root.variableCollections) ? root.variableCollections : {};
  const result: DesignToken[] = [];

  for (const variable of Object.values(variables)) {
    if (!isRecord(variable) || typeof variable.name !== "string" || variable.deletedButReferenced === true) continue;
    const collection = typeof variable.variableCollectionId === "string" && isRecord(collections[variable.variableCollectionId])
      ? collections[variable.variableCollectionId] as RecordValue
      : undefined;
    const modes = Array.isArray(collection?.modes) ? collection.modes : [];
    const modeNames = new Map(modes.filter(isRecord).map((mode) => [mode.modeId, mode.name]));
    const values = isRecord(variable.valuesByMode) ? variable.valuesByMode : {};

    for (const [modeId, rawValue] of Object.entries(values)) {
      const aliasId = isRecord(rawValue) && rawValue.type === "VARIABLE_ALIAS" && typeof rawValue.id === "string" ? rawValue.id : undefined;
      const description = [typeof variable.description === "string" && variable.description || undefined, aliasId && `Alias to ${aliasId}`]
        .filter(Boolean).join("; ") || undefined;
      result.push({
        name: variable.name,
        path: variable.name.split("/").filter(Boolean),
        ...normalizeValue(rawValue, variable.resolvedType),
        ...(typeof collection?.name === "string" ? { collection: collection.name } : {}),
        ...(typeof modeNames.get(modeId) === "string" ? { mode: modeNames.get(modeId) as string } : {}),
        ...(description ? { description } : {})
      });
    }
  }
  return result.sort(compareTokens);
}

const identity = (token: DesignToken) => `${token.path.join("/")}\0${token.collection ?? ""}\0${token.mode ?? ""}`;
const compareTokens = (a: DesignToken, b: DesignToken) =>
  (a.collection ?? "").localeCompare(b.collection ?? "") ||
  (a.mode ?? "").localeCompare(b.mode ?? "") ||
  a.path.join("/").localeCompare(b.path.join("/"));

export function diffTokens(previous: DesignToken[], current: DesignToken[]): TokenDiff[] {
  const before = new Map(previous.map((token) => [identity(token), token]));
  const after = new Map(current.map((token) => [identity(token), token]));
  const diffs: TokenDiff[] = [];
  for (const [key, token] of after) {
    const old = before.get(key);
    if (!old) diffs.push({ type: "added", token });
    else if (JSON.stringify(old) !== JSON.stringify(token)) diffs.push({ type: "changed", token });
  }
  for (const [key, token] of before) if (!after.has(key)) diffs.push({ type: "removed", token });
  const order = { added: 0, changed: 1, removed: 2 };
  return diffs.sort((a, b) => compareTokens(a.token, b.token) || order[a.type] - order[b.type]);
}

export const renderTokensJson = (tokens: DesignToken[]) => `${JSON.stringify(tokens, null, 2)}\n`;

const keyFor = (value: string, fallback = "default") => {
  const words = value.match(/[A-Za-z0-9]+/g) ?? [];
  let key = words.map((word, index) => index ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word.toLowerCase()).join("") || fallback;
  if (!/^[A-Za-z_$]/.test(key)) key = `_${key}`;
  return key;
};

export function renderTheme(tokens: DesignToken[], exportName = "theme"): string {
  if (!/^[A-Za-z_$][\w$]*$/.test(exportName)) throw new Error(`Invalid TypeScript export name: ${exportName}`);
  const usable = tokens.filter((token) => token.value !== null);
  const modes = [...new Set(usable.map((token) => token.mode || "default"))].sort();
  const includeMode = modes.length > 1;
  const modeKeys = new Map<string, string>();
  const usedModes = new Set<string>();
  for (const mode of modes) {
    const base = keyFor(mode);
    let key = base;
    for (let suffix = 2; usedModes.has(key); suffix++) key = `${base}Mode${suffix}`;
    usedModes.add(key);
    modeKeys.set(mode, key);
  }
  const root: RecordValue = {};
  for (const token of usable) {
    const path = [...(includeMode ? [modeKeys.get(token.mode || "default")!] : []), ...token.path.map((part) => keyFor(part, "token"))];
    let cursor = root;
    path.forEach((part, index) => {
      if (index === path.length - 1) {
        if (part in cursor) throw new Error(`Duplicate theme path: ${path.join(".")}`);
        cursor[part] = token.value;
      } else {
        if (part in cursor && !isRecord(cursor[part])) throw new Error(`Duplicate theme path: ${path.join(".")}`);
        cursor = cursor[part] as RecordValue ?? (cursor[part] = {} as RecordValue);
      }
    });
  }
  return `export const ${exportName} = ${JSON.stringify(root, null, 2)} as const;\n`;
}
