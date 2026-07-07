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
} from "@figma-token/core";
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

const render = (tokens: DesignToken[], options: SyncOptions) => ({
  "tokens-json": renderTokensJson,
  "theme-ts": (value: DesignToken[]) => renderTheme(value, options.exportName),
  "variables-css": renderCssVariables,
  "tokens-scss": renderScssVariables,
  "tailwind-css": renderTailwindTheme,
  "tokens-dtcg-json": renderDtcgJson
}[options.format](tokens));

export async function sync(options: SyncOptions, log = console.log): Promise<void> {
  if (!options.input && (!options.figmaToken || !options.fileKey)) throw new Error("--input 또는 FIGMA_TOKEN과 FIGMA_FILE_KEY가 필요합니다.");
  const raw = options.input ? await readJson(options.input) : await fetchFigmaVariables(options.fileKey!, options.figmaToken!);
  const current = isDesignTokenArray(raw) ? raw : normalizeFigmaVariables(raw, { onUnsupported: (name) => log(`unsupported type skipped: ${name}`) });
  const diffs = diffTokens(await readSnapshot(options.snapshot), current);
  for (const type of ["added", "changed", "removed"] as const) log(`${type[0].toUpperCase()}${type.slice(1)}: ${diffs.filter((diff) => diff.type === type).length}`);
  diffs.forEach((diff) => log(`${diff.type} ${diff.token.path.join("/")}`));
  if (options.dryRun) return;
  await save(options.output, render(current, options));
  await save(options.snapshot, renderTokensJson(current));
}
