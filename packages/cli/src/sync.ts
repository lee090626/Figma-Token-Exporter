import { mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  diffTokens,
  formatAliasWarning,
  formatUnsupportedVariableWarning,
  isDesignTokenArray,
  normalizeFigmaVariables,
  renderToken,
  renderTokensJson,
  type DesignToken,
  type RenderFormat
} from "@lee090626/core";
import { fetchFigmaVariables } from "./figma/fetchFigmaVariables.js";
import { writeFilesAtomically } from "./writeFiles.js";

export interface SyncOptions {
  input?: string;
  output: string;
  snapshot: string;
  format: RenderFormat;
  exportName: string;
  dryRun: boolean;
  figmaToken?: string;
  fileKey?: string;
}

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

async function save(files: Array<{ path: string; contents: string }>): Promise<void> {
  await Promise.all(files.map((file) => mkdir(dirname(file.path), { recursive: true })));
  await writeFilesAtomically(files, (path) => new Error(`Cannot write output file: ${path}`));
}

function render(tokens: DesignToken[], options: SyncOptions): string {
  return renderToken(tokens, options.format, options.exportName);
}

async function readCurrentTokens(options: SyncOptions, warn: (message: string) => void): Promise<DesignToken[]> {
  const source = options.input
    ? await readJson(options.input)
    : await fetchFigmaVariables(options.fileKey!, options.figmaToken!);

  if (isDesignTokenArray(source)) return source;

  return normalizeFigmaVariables(source, {
    onUnsupported: (name, reason, collection) => warn(formatUnsupportedVariableWarning(name, reason, collection)),
    onAliasWarning: (name, reason, collection) => warn(formatAliasWarning(name, reason, collection))
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
  await save([
    { path: options.output, contents: render(current, options) },
    { path: options.snapshot, contents: renderTokensJson(current) }
  ]);
}
