/// <reference types="@figma/plugin-typings" />

import { createExports } from "./exportVariables.js";
import { createComponentManifest, createFrameManifest, variableIdsFromBindings } from "./componentManifest.js";

const uiWidth = 420;
const minUiHeight = 260;
const maxUiHeight = 640;

figma.showUI(__html__, { width: uiWidth, height: minUiHeight, themeColors: true });

figma.ui.onmessage = (message) => {
  if (message.type === "resize") {
    figma.ui.resize(uiWidth, Math.max(minUiHeight, Math.min(maxUiHeight, Math.round(message.height))));
    return;
  }
  if (message.type !== "ui-ready") return;
  sendVariables().catch((error: unknown) => {
    figma.ui.postMessage({ type: "error", message: error instanceof Error ? error.message : String(error) });
  });
  sendComponentManifest().catch((error: unknown) => {
    figma.ui.postMessage({ type: "component-manifest-error", message: error instanceof Error ? error.message : String(error) });
  });
  sendFrameManifest().catch((error: unknown) => {
    figma.ui.postMessage({ type: "frame-manifest-error", message: error instanceof Error ? error.message : String(error) });
  });
};

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
  const component = selection as ComponentNode | ComponentSetNode;
  const variableIdsFor = (node: ComponentNode | ComponentSetNode) => new Set(
    [node, ...node.findAll()].flatMap((item) => variableIdsFromBindings(item.boundVariables))
      .concat(variableIdsFromBindings(node.type === "COMPONENT_SET" || !node.variantProperties ? node.componentPropertyDefinitions : undefined))
  );
  const variantComponents = component.type === "COMPONENT_SET" ? component.children.filter((child): child is ComponentNode => child.type === "COMPONENT") : [];
  const variantVariableIds = variantComponents.map(variableIdsFor);
  const variableIds = new Set([...variableIdsFor(component), ...variantVariableIds.flatMap((ids) => [...ids])]);
  const variableNames = new Map((await Promise.all([...variableIds].map(async (id) => [id, (await figma.variables.getVariableByIdAsync(id))?.name] as const))).filter((entry): entry is [string, string] => Boolean(entry[1])));
  const variants = variantComponents.map((child, index) => ({
    name: child.name,
    nodeId: child.id,
    properties: child.variantProperties ?? {},
    variables: [...variantVariableIds[index]].map((id) => variableNames.get(id)).filter((name): name is string => Boolean(name))
  }));
  const manifest = createComponentManifest({ name: component.name, nodeId: component.id, type: component.type, variants }, [...variableIds].map((id) => variableNames.get(id)).filter((name): name is string => Boolean(name)));
  figma.ui.postMessage({ type: "component-manifest", file: `${JSON.stringify(manifest, null, 2)}\n`, variableCount: manifest.variables.length, variantCount: manifest.component.variants.length });
}

async function sendFrameManifest() {
  const [selection] = figma.currentPage.selection;
  if (!selection || figma.currentPage.selection.length !== 1 || selection.type !== "FRAME") {
    figma.ui.postMessage({ type: "frame-manifest-unavailable" });
    return;
  }
  const frame = selection as FrameNode;
  const usages = new Map<string, string[]>();
  for (const node of [frame, ...frame.findAll()]) {
    for (const variableId of new Set(variableIdsFromBindings(node.boundVariables))) {
      const usedBy = usages.get(variableId) ?? [];
      usedBy.push(nodePath(node, frame));
      usages.set(variableId, usedBy);
    }
  }
  const tokens = (await Promise.all([...usages].map(async ([id, usedBy]) => {
    const name = (await figma.variables.getVariableByIdAsync(id))?.name;
    return name ? { name, usedBy } : undefined;
  }))).filter((token): token is { name: string; usedBy: string[] } => Boolean(token));
  const manifest = createFrameManifest(frame.name, tokens);
  const usageCount = Object.values(manifest.tokens).reduce((count, paths) => count + paths.length, 0);
  figma.ui.postMessage({ type: "frame-manifest", file: `${JSON.stringify(manifest, null, 2)}\n`, tokenCount: manifest.tokens.length, usageCount });
}

function nodePath(node: SceneNode, frame: FrameNode): string {
  if (node.id === frame.id) return frame.name;
  const names = [node.name];
  for (let parent = node.parent; parent && parent.id !== frame.id; parent = parent.parent) {
    if ("name" in parent && typeof parent.name === "string") names.unshift(parent.name);
  }
  return [frame.name, ...names].join(" / ");
}
