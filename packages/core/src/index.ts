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

export { formatAliasWarning, formatUnsupportedVariableWarning, isDesignTokenArray, normalizeFigmaVariables, supportedTokenTypes } from "./normalize.js";
export type { NormalizeOptions } from "./normalize.js";
export { diffTokens } from "./diff.js";
export * from "./render.js";
