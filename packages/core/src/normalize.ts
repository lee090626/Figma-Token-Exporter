import { compareTokens } from "./diff.js";
import { clamp, isRecord, words, type RecordValue } from "./tokenUtils.js";
import type { ColorValue, DesignToken, TokenType } from "./index.js";

type UnsupportedReason = "unclassified-float" | "unsupported-type";
type AliasWarningReason = "alias-target-missing" | "alias-cycle" | "alias-type-mismatch" | "alias-mode-mismatch";

export interface NormalizeOptions {
  modeId?: string;
  onUnsupported?: (name: string, reason: UnsupportedReason, collection?: string) => void;
  onAliasWarning?: (name: string, reason: AliasWarningReason, collection?: string) => void;
}

export const formatUnsupportedVariableWarning = (name: string, reason: UnsupportedReason, collection?: string): string => {
  const suffix = collection ? ` (collection: ${collection})` : "";
  return reason === "unclassified-float" ? `unclassified FLOAT variable skipped: ${name}${suffix}` : `unsupported type skipped: ${name}${suffix}`;
};

export const formatAliasWarning = (name: string, reason: AliasWarningReason, collection?: string): string => {
  const suffix = collection ? ` (collection: ${collection})` : "";
  return `alias ${reason.replace(/^alias-/, "").replace(/-/g, " ")} skipped: ${name}${suffix}`;
};

export const supportedTokenTypes: readonly TokenType[] = ["color", "spacing", "radius", "borderWidth", "size", "fontSize", "opacity"];

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const isColorValue = (value: unknown): value is ColorValue =>
  isRecord(value) &&
  ["r", "g", "b", "a"].every((key) => isFiniteNumber(value[key]));

const isTokenValue = (type: unknown, value: unknown): boolean =>
  type === "color" ? isColorValue(value) : isFiniteNumber(value);

export function isDesignTokenArray(value: unknown): value is DesignToken[] {
  return Array.isArray(value) && value.every((token) =>
    isRecord(token) &&
    typeof token.name === "string" &&
    Array.isArray(token.path) && token.path.length > 0 && token.path.every((part) => typeof part === "string") &&
    supportedTokenTypes.includes(token.type as TokenType) &&
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
