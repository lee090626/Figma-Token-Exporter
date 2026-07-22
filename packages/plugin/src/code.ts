/// <reference types="@figma/plugin-typings" />

import { createComponentManifest, createFrameManifest, frameManifestFiles, variableIdsFromBindings } from "./componentManifest.js";
import { createExports } from "./exportVariables.js";

const UI_WIDTH = 420;
const MIN_UI_HEIGHT = 260;
const MAX_UI_HEIGHT = 640;

figma.showUI(__html__, { width: UI_WIDTH, height: MIN_UI_HEIGHT, themeColors: true });

figma.ui.onmessage = (message) => {
  if (message.type === "resize") {
    figma.ui.resize(UI_WIDTH, clampUiHeight(message.height));
    return;
  }
  if (message.type !== "ui-ready") return;

  sendVariables().catch(sendExportError);
  sendSelectionManifests();
};

function clampUiHeight(height: number) {
  return Math.max(MIN_UI_HEIGHT, Math.min(MAX_UI_HEIGHT, Math.round(height)));
}

function sendExportError(error: unknown) {
  figma.ui.postMessage({ type: "error", message: errorMessage(error) });
}

function sendManifestError(kind: string, error: unknown) {
  figma.ui.postMessage({ type: "manifest-error", kind, message: errorMessage(error) });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function sendVariables() {
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

async function sendSelectionManifests() {
  const selectedComponents = figma.currentPage.selection.filter((node): node is ComponentNode => node.type === "COMPONENT");
  const selectedComponentSets = figma.currentPage.selection.filter((node): node is ComponentSetNode => node.type === "COMPONENT_SET");
  const selectedFrames = figma.currentPage.selection.filter((node): node is FrameNode => node.type === "FRAME");
  const tasks: Promise<void>[] = [];

  if (selectedComponents.length) tasks.push(sendComponentManifests("components", selectedComponents).catch((error: unknown) => sendManifestError("component", error)));
  if (selectedComponentSets.length) tasks.push(sendComponentManifests("componentSets", selectedComponentSets).catch((error: unknown) => sendManifestError("component set", error)));
  if (selectedFrames.length) tasks.push(sendFrameManifests(selectedFrames).catch((error: unknown) => sendManifestError("frame", error)));

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

async function sendFrameManifests(frames: FrameNode[]) {
  const manifests = await Promise.all(frames.map(createFrameManifestFor));
  const files = frameManifestFiles(manifests);

  figma.ui.postMessage({
    type: "manifest",
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
