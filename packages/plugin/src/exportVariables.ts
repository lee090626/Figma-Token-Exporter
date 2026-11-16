import {
  formatAliasWarning,
  formatUnsupportedVariableWarning,
  normalizeFigmaVariables,
  renderTokenFiles,
  supportedTokenTypes,
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

export function exportVariables(collections: PluginCollection[], variables: PluginVariable[], onWarning = console.warn): DesignToken[] {
  return normalizeFigmaVariables({
    variableCollections: Object.fromEntries(collections.map((collection) => [collection.id, collection])),
    variables: Object.fromEntries(variables.map((variable) => [variable.id, variable]))
  }, {
    onUnsupported: (name, reason, collection) => onWarning(formatUnsupportedVariableWarning(name, reason, collection)),
    onAliasWarning: (name, reason, collection) => onWarning(formatAliasWarning(name, reason, collection))
  });
}

export function createExports(collections: PluginCollection[], variables: PluginVariable[]) {
  const warnings: string[] = [];
  const tokens = exportVariables(collections, variables, (message) => {
    warnings.push(message);
    console.warn(message);
  });

  return {
    count: tokens.length,
    typeCounts: countTokensByType(tokens),
    warnings,
    skippedVariables: skippedVariableNames(warnings),
    files: renderTokenFiles(tokens)
  };
}

function countTokensByType(tokens: DesignToken[]) {
  return Object.fromEntries(supportedTokenTypes.map((type) => [
    type,
    tokens.filter((token) => token.type === type).length
  ])) as Record<TokenType, number>;
}

function skippedVariableNames(warnings: string[]) {
  return warnings.map((warning) => warning
    .replace(/^.* skipped: /, "")
    .replace(/ \(collection: .*?\)$/, ""));
}
