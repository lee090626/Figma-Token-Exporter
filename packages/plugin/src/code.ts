/// <reference types="@figma/plugin-typings" />

import { exportVariables } from "./exportVariables.js";

figma.showUI(__html__, { width: 360, height: 180, themeColors: true });

async function sendVariables() {
  const [collections, variables] = await Promise.all([
    figma.variables.getLocalVariableCollectionsAsync(),
    figma.variables.getLocalVariablesAsync()
  ]);
  const tokens = exportVariables(
    collections.map(({ id, name, modes }) => ({ id, name, modes })),
    variables.map(({ id, name, description, variableCollectionId, resolvedType, valuesByMode }) =>
      ({ id, name, description, variableCollectionId, resolvedType, valuesByMode }))
  );
  figma.ui.postMessage({ type: "tokens", tokens });
}

sendVariables().catch((error: unknown) => {
  figma.ui.postMessage({ type: "error", message: error instanceof Error ? error.message : String(error) });
});
