import { normalizeFigmaVariables, renderTheme, renderTokensJson, type DesignToken } from "@figma-token/core";

export interface PluginCollection {
  id: string;
  name: string;
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

export function exportVariables(collections: PluginCollection[], variables: PluginVariable[]): DesignToken[] {
  return normalizeFigmaVariables({
    variableCollections: Object.fromEntries(collections.map((collection) => [collection.id, collection])),
    variables: Object.fromEntries(variables.map((variable) => [variable.id, variable]))
  });
}

export function createExports(collections: PluginCollection[], variables: PluginVariable[]) {
  const tokens = exportVariables(collections, variables);
  return {
    count: tokens.length,
    files: {
      "tokens.json": renderTokensJson(tokens),
      "theme.ts": renderTheme(tokens)
    }
  };
}
