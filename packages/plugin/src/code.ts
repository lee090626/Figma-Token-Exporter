/// <reference types="@figma/plugin-typings" />

import { sendSelectionManifests } from "./selectionManifests.js";
import { sendVariables } from "./sendVariables.js";

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
  sendSelectionManifests(sendManifestError);
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
