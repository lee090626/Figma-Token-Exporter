/// <reference types="@figma/plugin-typings" />

import { createComponentManifest, createFrameManifest, frameManifestFiles, variableIdsFromBindings } from "./componentManifest.js";
import { createExports } from "./exportVariables.js";

const WAITLIST_URL = "https://github.com/lee090626/Figma-Token-Exporter/issues/new?template=team-waitlist.yml";
const UI_SIZE_KEY = "uiSize";
const PROGRESS_KEY = "connectProgress";

figma.showUI(__html__, { width: 880, height: 640, themeColors: true });
figma.clientStorage.getAsync(UI_SIZE_KEY).then((size) => {
  if (typeof size?.width !== "number" || typeof size?.height !== "number") return;
  figma.ui.resize(clamp(size.width, 480, 1600), clamp(size.height, 320, 1200));
}).catch(() => undefined);

// UI → plugin messages. ui.html mirrors this list; requestId is echoed so the UI can drop stale replies.
type UiMessage =
  | { type: "ui-ready"; requestId?: number }
  | { type: "refresh"; requestId?: number }
  | { type: "read-selection"; requestId?: number }
  | { type: "user-resize"; width: number; height: number; done: boolean }
  | { type: "save-progress"; progress?: { step2?: boolean; step3?: boolean } }
  | { type: "open-waitlist" };

// Plugin → UI: "selection-changed" asks the UI to request a fresh selection analysis (it debounces).
figma.on("selectionchange", () => figma.ui.postMessage({ type: "selection-changed" }));

figma.ui.onmessage = (message: UiMessage) => {
  if (message.type === "user-resize") {
    const size = { width: clamp(message.width, 480, 1600), height: clamp(message.height, 320, 1200) };
    figma.ui.resize(size.width, size.height);
    if (message.done) figma.clientStorage.setAsync(UI_SIZE_KEY, size).catch(() => undefined);
    return;
  }
  if (message.type === "open-waitlist") {
    figma.openExternal(WAITLIST_URL);
    return;
  }
  if (message.type === "save-progress") {
    figma.clientStorage.setAsync(PROGRESS_KEY, { step2: Boolean(message.progress?.step2), step3: Boolean(message.progress?.step3) }).catch(() => undefined);
    return;
  }
  if (message.type === "refresh") {
    sendVariables(message.requestId).catch((error: unknown) => sendExportError(error, message.requestId));
    sendSelectionManifests(message.requestId);
    return;
  }
  if (message.type === "read-selection") {
    sendSelectionManifests(message.requestId);
    return;
  }
  if (message.type !== "ui-ready") return;

  figma.clientStorage.getAsync(PROGRESS_KEY)
    .then((progress) => figma.ui.postMessage({ type: "progress", progress }))
    .catch(() => undefined);
  sendVariables(message.requestId).catch((error: unknown) => sendExportError(error, message.requestId));
  sendSelectionManifests(message.requestId);
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function sendExportError(error: unknown, requestId?: number) {
  figma.ui.postMessage({ type: "error", requestId, message: errorMessage(error) });
}

function sendManifestError(kind: string, error: unknown, requestId?: number) {
  figma.ui.postMessage({ type: "manifest-error", requestId, kind, message: errorMessage(error) });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function sendVariables(requestId?: number) {
  const [collections, variables] = await Promise.all([
    figma.variables.getLocalVariableCollectionsAsync(),
    figma.variables.getLocalVariablesAsync()
  ]);
  const exports = createExports(
    collections.map(({ id, name, defaultModeId, modes }) => ({ id, name, defaultModeId, modes })),
    variables.map(({ id, name, description, variableCollectionId, resolvedType, valuesByMode }) =>
      ({ id, name, description, variableCollectionId, resolvedType, valuesByMode }))
  );
  figma.ui.postMessage({ type: "exports", requestId, ...exports });
}

async function sendSelectionManifests(requestId?: number) {
  const selectedComponents = figma.currentPage.selection.filter((node): node is ComponentNode => node.type === "COMPONENT");
  const selectedComponentSets = figma.currentPage.selection.filter((node): node is ComponentSetNode => node.type === "COMPONENT_SET");
  const selectedFrames = figma.currentPage.selection.filter((node): node is FrameNode => node.type === "FRAME");
  const tasks: Promise<void>[] = [];

  if (selectedComponents.length) tasks.push(sendComponentManifests("components", selectedComponents, requestId).catch((error: unknown) => sendManifestError("component", error, requestId)));
  if (selectedComponentSets.length) tasks.push(sendComponentManifests("componentSets", selectedComponentSets, requestId).catch((error: unknown) => sendManifestError("component set", error, requestId)));
  if (selectedFrames.length) tasks.push(sendFrameManifests(selectedFrames, requestId).catch((error: unknown) => sendManifestError("frame", error, requestId)));

  await Promise.all(tasks);
}

async function variableNamesById(ids: Iterable<string>) {
  const variables = await loadVariables(ids);
  const collectionNames = await loadCollectionNames(variables);

  return new Map(variables.map((variable) => [
    variable.id,
    formatVariableName(variable, collectionNames.get(variable.variableCollectionId))
  ]));
}

async function loadVariables(ids: Iterable<string>) {
  const variables = await Promise.all([...ids].map((id) => figma.variables.getVariableByIdAsync(id)));
  return variables.filter((variable): variable is Variable => Boolean(variable));
}

async function loadCollectionNames(variables: Variable[]) {
  const collectionIds = [...new Set(variables.map((variable) => variable.variableCollectionId))];
  const collections = await Promise.all(collectionIds.map((id) => figma.variables.getVariableCollectionByIdAsync(id)));
  const collectionNames = new Map<string, string>();
  collections.forEach((collection, index) => {
    if (collection) collectionNames.set(collectionIds[index], collection.name);
  });
  return collectionNames;
}

function formatVariableName(variable: Variable, collectionName?: string) {
  return collectionName ? `${collectionName} / ${variable.name}` : variable.name;
}

async function sendComponentManifests(kind: "components" | "componentSets", components: Array<ComponentNode | ComponentSetNode>, requestId?: number) {
  const manifests = await Promise.all(components.map(createComponentManifestFor));
  const key = kind === "components" ? "components" : "componentSets";
  const variableCount = new Set(manifests.flatMap((manifest) => manifest.variables)).size;

  figma.ui.postMessage({
    type: "manifest",
    requestId,
    kind,
    filename: kind === "components" ? "components.json" : "component-sets.json",
    file: `${JSON.stringify({ [key]: manifests }, null, 2)}\n`,
    count: manifests.length,
    variableCount
  });
}

async function createComponentManifestFor(component: ComponentNode | ComponentSetNode) {
  const componentVariableIds = collectComponentVariableIds(component);
  const variants = component.type === "COMPONENT_SET" ? component.children.filter((child): child is ComponentNode => child.type === "COMPONENT") : [];
  const variantVariableIds = variants.map(collectComponentVariableIds);
  const variableIds = new Set([...componentVariableIds, ...variantVariableIds.flatMap((ids) => [...ids])]);
  const variableNames = await variableNamesById(variableIds);

  return createComponentManifest({
    name: component.name,
    nodeId: component.id,
    type: component.type,
    variants: variants.map((variant, index) => ({
      name: variant.name,
      nodeId: variant.id,
      properties: variant.variantProperties ?? {},
      variables: namesForIds(variantVariableIds[index], variableNames)
    }))
  }, namesForIds(variableIds, variableNames));
}

function collectComponentVariableIds(component: ComponentNode | ComponentSetNode) {
  const bindings = [component, ...component.findAll()].flatMap((node) => variableIdsFromBindings(node.boundVariables));
  const propertyBindings = component.type === "COMPONENT_SET" || !component.variantProperties
    ? variableIdsFromBindings(component.componentPropertyDefinitions)
    : [];
  return new Set([...bindings, ...propertyBindings]);
}

function namesForIds(ids: Iterable<string>, variableNames: Map<string, string>) {
  return [...ids].map((id) => variableNames.get(id)).filter((name): name is string => Boolean(name));
}

async function sendFrameManifests(frames: FrameNode[], requestId?: number) {
  const manifests = await Promise.all(frames.map(createFrameManifestFor));
  const files = frameManifestFiles(manifests);

  figma.ui.postMessage({
    type: "manifest",
    requestId,
    kind: "frames",
    filename: "figma-frames.zip",
    files,
    count: manifests.length,
    tokenCount: manifests.reduce((count, manifest) => count + Object.keys(manifest.tokens).length, 0),
    usageCount: manifests.reduce((count, manifest) => count + countTokenUses(manifest.tokens), 0)
  });
}

async function createFrameManifestFor(frame: FrameNode) {
  const variableUsages = collectFrameVariableUsages(frame);
  const variableNames = await variableNamesById(variableUsages.keys());
  const tokens = [...variableUsages].flatMap(([id, usedBy]) => {
    const name = variableNames.get(id);
    return name ? [{ name, usedBy }] : [];
  });
  return createFrameManifest(frame.name, tokens);
}

function collectFrameVariableUsages(frame: FrameNode) {
  const usages = new Map<string, string[]>();
  for (const node of [frame, ...frame.findAll()]) {
    for (const variableId of new Set(variableIdsFromBindings(node.boundVariables))) {
      const usedBy = usages.get(variableId) ?? [];
      usedBy.push(nodePath(node, frame));
      usages.set(variableId, usedBy);
    }
  }
  return usages;
}

function countTokenUses(tokens: Record<string, string[]>) {
  return Object.values(tokens).reduce((count, paths) => count + paths.length, 0);
}

function nodePath(node: SceneNode, frame: FrameNode): string {
  if (node.id === frame.id) return frame.name;

  const names = [node.name];
  for (let parent = node.parent; parent && parent.id !== frame.id; parent = parent.parent) {
    if ("name" in parent && typeof parent.name === "string") names.unshift(parent.name);
  }
  return [frame.name, ...names].join(" / ");
}
