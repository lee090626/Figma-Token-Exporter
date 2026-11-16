import { clamp, isRecord, words, type RecordValue } from "./tokenUtils.js";
import type { ColorValue, DesignToken } from "./index.js";

const dimensionTypes: DesignToken["type"][] = ["spacing", "radius", "borderWidth", "size", "fontSize"];

export const tokenFileNames = ["tokens.json", "theme.ts", "variables.css", "tokens.scss", "tailwind.css", "tokens.dtcg.json"] as const;
export type TokenFileName = (typeof tokenFileNames)[number];
export type TokenFiles = Record<TokenFileName, string>;

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

export const renderFormats = ["tokens-json", "theme-ts", "variables-css", "tokens-scss", "tailwind-css", "tokens-dtcg-json"] as const;
export type RenderFormat = (typeof renderFormats)[number];

export function renderToken(tokens: DesignToken[], format: RenderFormat, exportName = "theme"): string {
  switch (format) {
    case "tokens-json": return renderTokensJson(tokens);
    case "theme-ts": return renderTheme(tokens, exportName);
    case "variables-css": return renderCssVariables(tokens);
    case "tokens-scss": return renderScssVariables(tokens);
    case "tailwind-css": return renderTailwindTheme(tokens);
    case "tokens-dtcg-json": return renderDtcgJson(tokens);
  }
}

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
  const paths = new Set<string>();
  for (const token of tokens) {
    for (let index = 1; index < token.path.length; index++) {
      if (paths.has(token.path.slice(0, index).join("\0"))) {
        throw new Error(`Duplicate DTCG path: ${token.path.join(".")}`);
      }
    }
    assignNestedValue(root, token.path, dtcgValue(token), "Duplicate DTCG path");
    paths.add(token.path.join("\0"));
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

export function renderTokenFiles(tokens: DesignToken[]): TokenFiles {
  return {
    "tokens.json": renderTokensJson(tokens),
    "theme.ts": renderTheme(tokens),
    "variables.css": renderCssVariables(tokens),
    "tokens.scss": renderScssVariables(tokens),
    "tailwind.css": renderTailwindTheme(tokens),
    "tokens.dtcg.json": renderDtcgJson(tokens)
  };
}
