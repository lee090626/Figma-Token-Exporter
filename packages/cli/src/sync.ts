import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { diffTokens, isDesignTokenArray, normalizeFigmaVariables, renderTheme, renderTokensJson, type DesignToken } from "@figma-token-pr/core";
import { fetchFigmaVariables } from "./figma/fetchFigmaVariables.js";

export interface SyncOptions {
  input?: string;
  output: string;
  snapshot: string;
  format: "tokens-json" | "theme-ts";
  exportName: string;
  dryRun: boolean;
  figmaToken?: string;
  fileKey?: string;
}

const readJson = async (path: string) => JSON.parse(await readFile(path, "utf8")) as unknown;
const readSnapshot = async (path: string): Promise<DesignToken[]> => {
  try {
    const value = await readJson(path);
    if (!Array.isArray(value)) throw new Error("snapshot은 배열이어야 합니다.");
    return value as DesignToken[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
};
const save = async (path: string, contents: string) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents);
};

export async function sync(options: SyncOptions, log = console.log): Promise<void> {
  if (!options.input && (!options.figmaToken || !options.fileKey)) throw new Error("--input 또는 FIGMA_TOKEN과 FIGMA_FILE_KEY가 필요합니다.");
  const raw = options.input ? await readJson(options.input) : await fetchFigmaVariables(options.fileKey!, options.figmaToken!);
  const current = isDesignTokenArray(raw) ? raw : normalizeFigmaVariables(raw);
  const diffs = diffTokens(await readSnapshot(options.snapshot), current);
  for (const type of ["added", "changed", "removed"] as const) log(`${type[0].toUpperCase()}${type.slice(1)}: ${diffs.filter((diff) => diff.type === type).length}`);
  diffs.forEach((diff) => log(`${diff.type} ${diff.token.path.join("/")}`));
  if (options.dryRun) return;
  await save(options.output, options.format === "tokens-json" ? renderTokensJson(current) : renderTheme(current, options.exportName));
  await save(options.snapshot, renderTokensJson(current));
}
