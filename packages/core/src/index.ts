export type TokenType = "color" | "spacing" | "radius" | "borderWidth" | "size" | "fontSize" | "opacity";

export interface ColorValue {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface DesignToken {
  name: string;
  path: string[];
  type: TokenType;
  value: number | ColorValue;
  collection?: string;
  mode?: string;
  description?: string;
}

export interface TokenDiff {
  type: "added" | "removed" | "changed";
  token: DesignToken;
}

type UnsupportedReason = "unclassified-float" | "unsupported-type";
type AliasWarningReason = "alias-target-missing" | "alias-cycle" | "alias-type-mismatch" | "alias-mode-mismatch";

export interface NormalizeOptions {
  modeId?: string;
  onUnsupported?: (name: string, reason: UnsupportedReason, collection?: string) => void;
  onAliasWarning?: (name: string, reason: AliasWarningReason, collection?: string) => void;
}

type RecordValue = Record<string, unknown>;
const supportedTypes: TokenType[] = ["color", "spacing", "radius", "borderWidth", "size", "fontSize", "opacity"];
const dimensionTypes: TokenType[] = ["spacing", "radius", "borderWidth", "size", "fontSize"];

const isRecord = (value: unknown): value is RecordValue =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const isColorValue = (value: unknown): value is ColorValue =>
  isRecord(value) &&
  ["r", "g", "b", "a"].every((key) => isFiniteNumber(value[key]));

const isTokenValue = (type: unknown, value: unknown): boolean =>
  type === "color" ? isColorValue(value) : isFiniteNumber(value);

const words = (value: string): string[] => value
  .replace(/%/g, " percent ")
  .replace(/(^|[^A-Za-z0-9])-([0-9])/g, "$1 negative $2")
  .replace(/([0-9])\.([0-9])/g, "$1 dot $2")
  .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
  .match(/[A-Za-z0-9]+/g) ?? [];

export function isDesignTokenArray(value: unknown): value is DesignToken[] {
  return Array.isArray(value) && value.every((token) =>
    isRecord(token) &&
    typeof token.name === "string" &&
    Array.isArray(token.path) && token.path.length > 0 && token.path.every((part) => typeof part === "string") &&
    supportedTypes.includes(token.type as TokenType) &&
    isTokenValue(token.type, token.value)
  );
}

const tokenTypeFromName = (name: string, resolvedType: unknown): TokenType | undefined => {
  const first = name.split("/").filter(Boolean)[0]?.toLowerCase().replace(/[-_\s]/g, "");
  if (resolvedType === "COLOR") return "color";
  if (resolvedType !== "FLOAT") return undefined;
  if (first === "spacing") return "spacing";
  if (first === "radius") return "radius";
  if (first === "borderwidth") return "borderWidth";
  if (first === "size") return "size";
  if (first === "fontsize") return "fontSize";
  if (first === "opacity") return "opacity";
  return undefined;
};

const tokenTypeFromCollection = (collection: RecordValue | undefined, resolvedType: unknown): TokenType | undefined => {
  if (resolvedType !== "FLOAT" || typeof collection?.name !== "string") return undefined;
  const name = words(collection.name.toLowerCase());
  if (name.includes("spacing") || name.includes("gap")) return "spacing";
  if (name.includes("radius") || name.includes("corner") || name.includes("shape")) return "radius";
  if (name.includes("borderwidth") || (name.includes("border") && name.includes("width")) || name.includes("stroke")) return "borderWidth";
  if (name.includes("fontsize") || (name.includes("font") && name.includes("size")) || name.includes("text")) return "fontSize";
  if (name.includes("size")) return "size";
  if (name.includes("opacity") || name.includes("alpha")) return "opacity";
  return undefined;
};

const to255 = (value: number) => Math.round(value <= 1 ? value * 255 : value);
const clamp = (min: number, value: number, max: number) => Math.min(max, Math.max(min, value));

function pickModeId(collection: RecordValue | undefined, values: RecordValue, wanted?: string) {
  if (wanted && wanted in values) return wanted;
  const defaultModeId = typeof collection?.defaultModeId === "string" ? collection.defaultModeId : undefined;
  if (defaultModeId && defaultModeId in values) return defaultModeId;
  const modes = Array.isArray(collection?.modes) ? collection.modes.filter(isRecord) : [];
  const firstModeId = modes.map((mode) => mode.modeId).find((modeId): modeId is string => typeof modeId === "string" && modeId in values);
  return firstModeId ?? Object.keys(values)[0];
}

function collectionModes(collection: RecordValue | undefined): RecordValue[] {
  return Array.isArray(collection?.modes) ? collection.modes.filter(isRecord) : [];
}

function collectionName(collection: RecordValue | undefined): string | undefined {
  return typeof collection?.name === "string" ? collection.name : undefined;
}

function collectionFor(variable: RecordValue, collections: RecordValue): RecordValue | undefined {
  const collectionId = variable.variableCollectionId;
  return typeof collectionId === "string" && isRecord(collections[collectionId])
    ? collections[collectionId] as RecordValue
    : undefined;
}

function resolveValue(variables: RecordValue, variable: RecordValue, modeId: string, onWarning?: (name: string, reason: Exclude<AliasWarningReason, "alias-type-mismatch">) => void, seen = new Set<unknown>()): unknown {
  const values = isRecord(variable.valuesByMode) ? variable.valuesByMode : {};
  const name = typeof variable.name === "string" ? variable.name : modeId;
  if (!(modeId in values)) {
    onWarning?.(`${name} (mode: ${modeId})`, "alias-mode-mismatch");
    return undefined;
  }
  const value = values[modeId];
  if (!isRecord(value) || value.type !== "VARIABLE_ALIAS" || typeof value.id !== "string") return value;
  if (seen.has(value.id)) {
    onWarning?.(name, "alias-cycle");
    return undefined;
  }
  seen.add(value.id);
  const target = variables[value.id];
  if (!isRecord(target)) {
    onWarning?.(name, "alias-target-missing");
    return undefined;
  }
  return resolveValue(variables, target, modeId, onWarning, seen);
}

function normalizeValue(value: unknown, type: TokenType): number | ColorValue | undefined {
  if (type === "color" && isRecord(value) && ["r", "g", "b"].every((key) => isFiniteNumber(value[key])) && (value.a === undefined || isFiniteNumber(value.a))) {
    return {
      r: clamp(0, to255(value.r as number), 255),
      g: clamp(0, to255(value.g as number), 255),
      b: clamp(0, to255(value.b as number), 255),
      a: clamp(0, typeof value.a === "number" ? value.a : 1, 1)
    };
  }
  if (type !== "color" && isFiniteNumber(value)) return value;
  return undefined;
}

function normalizeVariable(variable: RecordValue, variables: RecordValue, collections: RecordValue, options: NormalizeOptions): DesignToken | undefined {
  if (typeof variable.name !== "string" || variable.deletedButReferenced === true) return undefined;

  const collection = collectionFor(variable, collections);
  const typeFromName = tokenTypeFromName(variable.name, variable.resolvedType);
  const type = typeFromName ?? tokenTypeFromCollection(collection, variable.resolvedType);
  const collectionLabel = collectionName(collection);
  if (!type) {
    options.onUnsupported?.(variable.name, variable.resolvedType === "FLOAT" ? "unclassified-float" : "unsupported-type", collectionLabel);
    return undefined;
  }

  const path = variable.name.split("/").filter(Boolean);
  if (!path.length) return undefined;

  const values = isRecord(variable.valuesByMode) ? variable.valuesByMode : {};
  const modeId = pickModeId(collection, values, options.modeId);
  if (!modeId) return undefined;

  const warnAlias = (name: string, reason: AliasWarningReason) => options.onAliasWarning?.(name, reason, collectionLabel);
  const selectedValue = values[modeId];
  const rawValue = resolveValue(variables, variable, modeId, warnAlias);
  const value = normalizeValue(rawValue, type);
  if (value === undefined) {
    if (isRecord(selectedValue) && selectedValue.type === "VARIABLE_ALIAS" && rawValue !== undefined) {
      warnAlias(variable.name, "alias-type-mismatch");
    }
    return undefined;
  }

  const mode = collectionModes(collection).find((candidate) => candidate.modeId === modeId);
  return {
    name: variable.name,
    path: typeFromName ? path : [type, ...path],
    type,
    value,
    ...(collectionLabel !== undefined ? { collection: collectionLabel } : {}),
    ...(typeof mode?.name === "string" ? { mode: mode.name } : {}),
    ...(typeof variable.description === "string" && variable.description ? { description: variable.description } : {})
  };
}

export function normalizeFigmaVariables(input: unknown, options: NormalizeOptions = {}): DesignToken[] {
  if (!isRecord(input)) return [];
  const root = isRecord(input.meta) ? input.meta : input;
  const variables = isRecord(root.variables) ? root.variables : {};
  const collections = isRecord(root.variableCollections) ? root.variableCollections : {};
  const result: DesignToken[] = [];

  for (const variable of Object.values(variables)) {
    if (!isRecord(variable)) continue;
    const token = normalizeVariable(variable, variables, collections, options);
    if (token) result.push(token);
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

const camelKey = (value: string, fallback = "default") => {
  let key = words(value).map((word, index) => index ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word.toLowerCase()).join("") || fallback;
  if (!/^[A-Za-z_$]/.test(key)) key = `_${key}`;
  return key;
};
const kebabKey = (value: string) => words(value).map((word) => word.toLowerCase()).join("-");
export const generateVariableName = (token: DesignToken) => {
  const prefix = token.type === "fontSize" ? "font-size" : token.type === "borderWidth" ? "border-width" : token.type;
  const first = token.path[0]?.toLowerCase().replace(/[-_\s]/g, "");
  const hasPrefix = first === prefix.replace(/-/g, "");
  const rest = token.path.slice(hasPrefix ? 1 : 0).map(kebabKey).filter(Boolean).join("-");
  return `${prefix}${rest ? `-${rest}` : ""}`;
};
const hex = (value: number) => clamp(0, Math.round(value), 255).toString(16).padStart(2, "0");
const colorHex = (value: ColorValue) => `#${hex(value.r)}${hex(value.g)}${hex(value.b)}${value.a < 1 ? hex(value.a * 255) : ""}`;
const formatValue = (token: DesignToken) => {
  if (token.type === "color") return colorHex(token.value as ColorValue);
  if (dimensionTypes.includes(token.type)) return `${token.value}px`;
  return String(token.value);
};
const formatThemeValue = (token: DesignToken) => token.type === "opacity" ? token.value : formatValue(token);

function renderCssLike(tokens: DesignToken[], nameFor: (token: DesignToken) => string, wrap?: [string, string]) {
  const lines = tokens.map((token) => `${wrap ? "  " : ""}${nameFor(token)}: ${formatValue(token)};`);
  return wrap ? `${wrap[0]}\n${lines.join("\n")}\n${wrap[1]}\n` : `${lines.join("\n")}\n`;
}

const cssName = (token: DesignToken) => `--${generateVariableName(token)}`;
const scssName = (token: DesignToken) => `$${generateVariableName(token)}`;

export const renderCssVariables = (tokens: DesignToken[]) => renderCssLike(tokens, cssName, [":root {", "}"]);
export const renderScssVariables = (tokens: DesignToken[]) => renderCssLike(tokens, scssName);
export const renderTailwindTheme = (tokens: DesignToken[]) => renderCssLike(tokens, cssName, ["@theme {", "}"]);

type DtcgToken = { $type: "color"; $value: string } | { $type: "dimension"; $value: { value: number; unit: "px" } } | { $type: "number"; $value: number };

function createRecord(): RecordValue {
  return Object.create(null) as RecordValue;
}

function dtcgValue(token: DesignToken): DtcgToken {
  if (token.type === "color") return { $type: "color", $value: colorHex(token.value as ColorValue) };
  if (dimensionTypes.includes(token.type)) return { $type: "dimension", $value: { value: token.value as number, unit: "px" } };
  return { $type: "number", $value: token.value as number };
}

function assignNestedValue(root: RecordValue, path: string[], value: unknown, errorPrefix: string): void {
  let cursor = root;
  path.forEach((part, index) => {
    if (index === path.length - 1) {
      if (Object.hasOwn(cursor, part)) throw new Error(`${errorPrefix}: ${path.join(".")}`);
      cursor[part] = value;
      return;
    }
    if (Object.hasOwn(cursor, part) && !isRecord(cursor[part])) throw new Error(`${errorPrefix}: ${path.join(".")}`);
    cursor = cursor[part] as RecordValue ?? (cursor[part] = createRecord());
  });
}

export function renderDtcgJson(tokens: DesignToken[]): string {
  const root = createRecord();
  for (const token of tokens) {
    assignNestedValue(root, token.path, dtcgValue(token), "Duplicate DTCG path");
  }
  return `${JSON.stringify(root, null, 2)}\n`;
}

export function renderTheme(tokens: DesignToken[], exportName = "theme"): string {
  if (!/^[A-Za-z_$][\w$]*$/.test(exportName)) throw new Error(`Invalid TypeScript export name: ${exportName}`);
  const root = createRecord();
  for (const token of tokens) {
    const path = token.path.map((part) => camelKey(part, "token"));
    assignNestedValue(root, path, formatThemeValue(token), "Duplicate theme path");
  }
  return `export const ${exportName} = ${JSON.stringify(root, null, 2)} as const;\n`;
}
