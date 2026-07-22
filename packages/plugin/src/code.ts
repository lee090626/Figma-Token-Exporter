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
  sendSelectionManifests();
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

async function sendSelectionManifests() {
  const components = figma.currentPage.selection.filter((node): node is ComponentNode => node.type === "COMPONENT");
  const componentSets = figma.currentPage.selection.filter((node): node is ComponentSetNode => node.type === "COMPONENT_SET");
  const frames = figma.currentPage.selection.filter((node): node is FrameNode => node.type === "FRAME");
  await Promise.all([
    components.length && sendComponentManifests("components", components).catch((error: unknown) => sendManifestError("component", error)),
    componentSets.length && sendComponentManifests("componentSets", componentSets).catch((error: unknown) => sendManifestError("component set", error)),
    frames.length && sendFrameManifests(frames).catch((error: unknown) => sendManifestError("frame", error))
  ]);
}

function sendManifestError(kind: string, error: unknown) {
  figma.ui.postMessage({ type: "manifest-error", kind, message: error instanceof Error ? error.message : String(error) });
}

async function variableNamesById(ids: Iterable<string>) {
  const variables = (await Promise.all([...ids].map((id) => figma.variables.getVariableByIdAsync(id))))
    .filter((variable): variable is Variable => Boolean(variable));
  const collections = new Map((await Promise.all([...new Set(variables.map((variable) => variable.variableCollectionId))].map(async (id) => [id, await figma.variables.getVariableCollectionByIdAsync(id)] as const)))
    .filter((entry): entry is [string, VariableCollection] => Boolean(entry[1])));
  return new Map(variables.map((variable) => [
    variable.id,
    collections.has(variable.variableCollectionId) ? `${collections.get(variable.variableCollectionId)?.name} / ${variable.name}` : variable.name
  ]));
}

async function sendComponentManifests(kind: "components" | "componentSets", components: Array<ComponentNode | ComponentSetNode>) {
  const manifests = await Promise.all(components.map(createComponentManifestFor));
  const key = kind === "components" ? "components" : "componentSets";
  const variableCount = new Set(manifests.flatMap((manifest) => manifest.variables)).size;
  figma.ui.postMessage({
    type: "manifest",
    kind,
    filename: kind === "components" ? "components.json" : "component-sets.json",
    file: `${JSON.stringify({ [key]: manifests }, null, 2)}\n`,
    count: manifests.length,
    variableCount
  });
}

async function createComponentManifestFor(component: ComponentNode | ComponentSetNode) {
  const variableIdsFor = (node: ComponentNode | ComponentSetNode) => new Set(
    [node, ...node.findAll()].flatMap((item) => variableIdsFromBindings(item.boundVariables))
      .concat(variableIdsFromBindings(node.type === "COMPONENT_SET" || !node.variantProperties ? node.componentPropertyDefinitions : undefined))
  );
  const variantComponents = component.type === "COMPONENT_SET" ? component.children.filter((child): child is ComponentNode => child.type === "COMPONENT") : [];
  const variantVariableIds = variantComponents.map(variableIdsFor);
  const variableIds = new Set([...variableIdsFor(component), ...variantVariableIds.flatMap((ids) => [...ids])]);
  const variableNames = await variableNamesById(variableIds);
  const variants = variantComponents.map((child, index) => ({
    name: child.name,
    nodeId: child.id,
    properties: child.variantProperties ?? {},
    variables: [...variantVariableIds[index]].map((id) => variableNames.get(id)).filter((name): name is string => Boolean(name))
  }));
  const manifest = createComponentManifest({ name: component.name, nodeId: component.id, type: component.type, variants }, [...variableIds].map((id) => variableNames.get(id)).filter((name): name is string => Boolean(name)));
  return manifest;
}

async function sendFrameManifests(frames: FrameNode[]) {
  const manifests = await Promise.all(frames.map(createFrameManifestFor));
  figma.ui.postMessage({
    type: "manifest",
    kind: "frames",
    filename: "figma-frames.zip",
    files: Object.fromEntries(manifests.map(({ frame, ...manifest }) => [`frames/${manifestFilename("token-usage", frame)}.json`, `${JSON.stringify({ frame, ...manifest }, null, 2)}\n`])),
    count: manifests.length,
    tokenCount: manifests.reduce((count, manifest) => count + Object.keys(manifest.tokens).length, 0),
    usageCount: manifests.reduce((count, manifest) => count + Object.values(manifest.tokens).reduce((total, paths) => total + paths.length, 0), 0)
  });
}

async function createFrameManifestFor(frame: FrameNode) {
  const usages = new Map<string, string[]>();
  for (const node of [frame, ...frame.findAll()]) {
    for (const variableId of new Set(variableIdsFromBindings(node.boundVariables))) {
      const usedBy = usages.get(variableId) ?? [];
      usedBy.push(nodePath(node, frame));
      usages.set(variableId, usedBy);
    }
  }
  const variableNames = await variableNamesById(usages.keys());
  const tokens = [...usages].map(([id, usedBy]) => {
    const name = variableNames.get(id);
    return name ? { name, usedBy } : undefined;
  }).filter((token): token is { name: string; usedBy: string[] } => Boolean(token));
  const manifest = createFrameManifest(frame.name, tokens);
  return manifest;
}

function manifestFilename(prefix: string, name: string) {
  return `${prefix}-${name.replace(/[\\/:*?"<>|]/g, "-")}`;
}

function nodePath(node: SceneNode, frame: FrameNode): string {
  if (node.id === frame.id) return frame.name;
  const names = [node.name];
  for (let parent = node.parent; parent && parent.id !== frame.id; parent = parent.parent) {
    if ("name" in parent && typeof parent.name === "string") names.unshift(parent.name);
  }
  return [frame.name, ...names].join(" / ");
}
