import {
  normalizeFigmaVariables,
  renderCssVariables,
  renderDtcgJson,
  renderScssVariables,
  renderTailwindTheme,
  renderTheme,
  renderTokensJson,
  type DesignToken,
  type TokenType
} from "@lee090626/core";

export interface PluginCollection {
  id: string;
  name: string;
  defaultModeId?: string;
  modes: Array<{ modeId: string; name: string }>;
}

export interface PluginVariable {
  id: string;
  name: string;
  description: string;
  variableCollectionId: string;
  resolvedType: "BOOLEAN" | "FLOAT" | "STRING" | "COLOR";
  valuesByMode: Record<string, unknown>;
}

const skippedMessage = (name: string, reason: "unclassified-float" | "unsupported-type", collection?: string) => {
  const suffix = collection ? ` (collection: ${collection})` : "";
  return reason === "unclassified-float" ? `unclassified FLOAT variable skipped: ${name}${suffix}` : `unsupported type skipped: ${name}${suffix}`;
};
const aliasSkippedMessage = (name: string, reason: "alias-target-missing" | "alias-cycle" | "alias-type-mismatch" | "alias-mode-mismatch", collection?: string) => {
  const suffix = collection ? ` (collection: ${collection})` : "";
  return `alias ${reason.replace(/^alias-/, "").replace(/-/g, " ")} skipped: ${name}${suffix}`;
};
const tokenTypes: TokenType[] = ["color", "spacing", "radius", "borderWidth", "size", "fontSize", "opacity"];

export function exportVariables(collections: PluginCollection[], variables: PluginVariable[], onWarning = console.warn): DesignToken[] {
  return normalizeFigmaVariables({
    variableCollections: Object.fromEntries(collections.map((collection) => [collection.id, collection])),
    variables: Object.fromEntries(variables.map((variable) => [variable.id, variable]))
  }, {
    onUnsupported: (name, reason, collection) => onWarning(skippedMessage(name, reason, collection)),
    onAliasWarning: (name, reason, collection) => onWarning(aliasSkippedMessage(name, reason, collection))
  });
}

export function createExports(collections: PluginCollection[], variables: PluginVariable[]) {
  const warnings: string[] = [];
  const tokens = exportVariables(collections, variables, (message) => {
    warnings.push(message);
    console.warn(message);
  });
  const typeCounts = Object.fromEntries(tokenTypes.map((type) => [type, tokens.filter((token) => token.type === type).length])) as Record<TokenType, number>;
  return {
    count: tokens.length,
    typeCounts,
    warnings,
    skippedVariables: warnings.map((warning) => warning.replace(/^.* skipped: /, "").replace(/ \(collection: .*?\)$/, "")),
    files: {
      "tokens.json": renderTokensJson(tokens),
      "theme.ts": renderTheme(tokens),
      "variables.css": renderCssVariables(tokens),
      "tokens.scss": renderScssVariables(tokens),
      "tailwind.css": renderTailwindTheme(tokens),
      "tokens.dtcg.json": renderDtcgJson(tokens)
    }
  };
}
