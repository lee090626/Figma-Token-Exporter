import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  diffTokens,
  isDesignTokenArray,
  normalizeFigmaVariables,
  renderCssVariables,
  renderDtcgJson,
  renderScssVariables,
  renderTailwindTheme,
  renderTheme,
  renderTokensJson,
  type DesignToken
} from "@lee090626/core";
import { fetchFigmaVariables } from "./figma/fetchFigmaVariables.js";

export interface SyncOptions {
  input?: string;
  output: string;
  snapshot: string;
  format: "tokens-json" | "theme-ts" | "variables-css" | "tokens-scss" | "tailwind-css" | "tokens-dtcg-json";
  exportName: string;
  dryRun: boolean;
  figmaToken?: string;
  fileKey?: string;
}

type SyncFormat = SyncOptions["format"];
type TokenRenderer = (tokens: DesignToken[], exportName: string) => string;

const renderers: Record<SyncFormat, TokenRenderer> = {
  "tokens-json": (tokens) => renderTokensJson(tokens),
  "theme-ts": (tokens, exportName) => renderTheme(tokens, exportName),
  "variables-css": (tokens) => renderCssVariables(tokens),
  "tokens-scss": (tokens) => renderScssVariables(tokens),
  "tailwind-css": (tokens) => renderTailwindTheme(tokens),
  "tokens-dtcg-json": (tokens) => renderDtcgJson(tokens)
};

const changeTypes = ["added", "changed", "removed"] as const;

async function readJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`Invalid JSON: ${path}`);
    throw error;
  }
}

async function readSnapshot(path: string): Promise<DesignToken[]> {
  try {
    const value = await readJson(path);
    if (!isDesignTokenArray(value)) throw new Error("snapshot은 DesignToken 배열이어야 합니다.");
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function save(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents);
}

function render(tokens: DesignToken[], options: SyncOptions): string {
  return renderers[options.format](tokens, options.exportName);
}

function skippedMessage(name: string, reason: "unclassified-float" | "unsupported-type", collection?: string): string {
  const suffix = collection ? ` (collection: ${collection})` : "";
  return reason === "unclassified-float" ? `unclassified FLOAT variable skipped: ${name}${suffix}` : `unsupported type skipped: ${name}${suffix}`;
}

function aliasSkippedMessage(name: string, reason: "alias-target-missing" | "alias-cycle" | "alias-type-mismatch" | "alias-mode-mismatch", collection?: string): string {
  const suffix = collection ? ` (collection: ${collection})` : "";
  return `alias ${reason.replace(/^alias-/, "").replace(/-/g, " ")} skipped: ${name}${suffix}`;
}

async function readCurrentTokens(options: SyncOptions, warn: (message: string) => void): Promise<DesignToken[]> {
  const source = options.input
    ? await readJson(options.input)
    : await fetchFigmaVariables(options.fileKey!, options.figmaToken!);

  if (isDesignTokenArray(source)) return source;

  return normalizeFigmaVariables(source, {
    onUnsupported: (name, reason, collection) => warn(skippedMessage(name, reason, collection)),
    onAliasWarning: (name, reason, collection) => warn(aliasSkippedMessage(name, reason, collection))
  });
}

function logDiffSummary(tokens: DesignToken[], snapshot: DesignToken[], log: (message: string) => void): void {
  const diffs = diffTokens(snapshot, tokens);
  for (const type of changeTypes) {
    log(`${type[0].toUpperCase()}${type.slice(1)}: ${diffs.filter((diff) => diff.type === type).length}`);
  }
  diffs.forEach((diff) => log(`${diff.type} ${diff.token.path.join("/")}`));
}

export async function sync(options: SyncOptions, log = console.log, warn = console.warn): Promise<void> {
  if (!options.input && (!options.figmaToken || !options.fileKey)) throw new Error("--input 또는 FIGMA_TOKEN과 FIGMA_FILE_KEY가 필요합니다.");
  const current = await readCurrentTokens(options, warn);
  const snapshot = await readSnapshot(options.snapshot);
  logDiffSummary(current, snapshot, log);
  if (options.dryRun) return;
  await save(options.output, render(current, options));
  await save(options.snapshot, renderTokensJson(current));
}
