/// <reference types="@figma/plugin-typings" />

import { createExports } from "./exportVariables.js";

export async function sendVariables() {
  const [collections, variables] = await Promise.all([
    figma.variables.getLocalVariableCollectionsAsync(),
    figma.variables.getLocalVariablesAsync()
  ]);
  const exports = createExports(
    collections.map(({ id, name, defaultModeId, modes }) => ({ id, name, defaultModeId, modes })),
    variables.map(({ id, name, description, variableCollectionId, resolvedType, valuesByMode }) =>
      ({ id, name, description, variableCollectionId, resolvedType, valuesByMode }))
  );
  figma.ui.postMessage({ type: "exports", ...exports });
}
