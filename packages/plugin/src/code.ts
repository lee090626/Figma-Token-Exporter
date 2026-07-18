/// <reference types="@figma/plugin-typings" />

import { createExports } from "./exportVariables.js";
import { createComponentManifest, variableIdsFromBindings } from "./componentManifest.js";

figma.showUI(__html__, { width: 360, height: 440, themeColors: true });

async function sendVariables() {
  const [collections, variables] = await Promise.all([
    figma.variables.getLocalVariableCollectionsAsync(),
    figma.variables.getLocalVariablesAsync()
  ]);
  const result = createExports(
    collections.map(({ id, name, defaultModeId, modes }) => ({ id, name, defaultModeId, modes })),
    variables.map(({ id, name, description, variableCollectionId, resolvedType, valuesByMode }) =>
      ({ id, name, description, variableCollectionId, resolvedType, valuesByMode }))
  );
  figma.ui.postMessage({ type: "exports", ...result });
}

async function sendComponentManifest() {
  const [selection] = figma.currentPage.selection;
  if (!selection || figma.currentPage.selection.length !== 1 || (selection.type !== "COMPONENT" && selection.type !== "COMPONENT_SET")) {
    figma.ui.postMessage({ type: "component-manifest-unavailable" });
    return;
  }
  const component = selection;
  const nodes = [component, ...component.findAll()];
  const variableIds = new Set(nodes.flatMap((node) => variableIdsFromBindings(node.boundVariables)).concat(variableIdsFromBindings(component.componentPropertyDefinitions)));
  const variables = (await Promise.all([...variableIds].map(async (id) => (await figma.variables.getVariableByIdAsync(id))?.name))).filter((name): name is string => Boolean(name));
  const variants = component.type === "COMPONENT_SET" ? component.children.map((child) => child.name) : component.variantProperties ? [component.name] : [];
  const manifest = createComponentManifest({ name: component.name, nodeId: component.id, type: component.type, variants }, variables);
  figma.ui.postMessage({ type: "component-manifest", file: `${JSON.stringify(manifest, null, 2)}\n`, variableCount: manifest.variables.length });
}

sendVariables().catch((error: unknown) => {
  figma.ui.postMessage({ type: "error", message: error instanceof Error ? error.message : String(error) });
});
sendComponentManifest().catch(() => {
  figma.ui.postMessage({ type: "component-manifest-unavailable" });
});
