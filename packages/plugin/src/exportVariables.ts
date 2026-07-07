import {
  normalizeFigmaVariables,
  renderCssVariables,
  renderDtcgJson,
  renderScssVariables,
  renderTailwindTheme,
  renderTheme,
  renderTokensJson,
  type DesignToken
} from "@figma-token/core";

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

const skippedMessage = (name: string, reason: "unclassified-float" | "unsupported-type") =>
  reason === "unclassified-float" ? `unclassified FLOAT variable skipped: ${name}` : `unsupported type skipped: ${name}`;

export function exportVariables(collections: PluginCollection[], variables: PluginVariable[], onWarning = console.warn): DesignToken[] {
  return normalizeFigmaVariables({
    variableCollections: Object.fromEntries(collections.map((collection) => [collection.id, collection])),
    variables: Object.fromEntries(variables.map((variable) => [variable.id, variable]))
  }, { onUnsupported: (name, reason) => onWarning(skippedMessage(name, reason)) });
}

export function createExports(collections: PluginCollection[], variables: PluginVariable[]) {
  const warnings: string[] = [];
  const tokens = exportVariables(collections, variables, (message) => {
    warnings.push(message);
    console.warn(message);
  });
  return {
    count: tokens.length,
    warnings,
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
