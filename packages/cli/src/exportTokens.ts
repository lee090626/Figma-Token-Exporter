import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  isDesignTokenArray,
  renderCssVariables,
  renderDtcgJson,
  renderScssVariables,
  renderTailwindTheme,
  renderTheme,
  renderTokensJson,
  type DesignToken
} from "@lee090626/core";

export const tokenFileNames = ["tokens.json", "theme.ts", "variables.css", "tokens.scss", "tailwind.css", "tokens.dtcg.json"] as const;
type TokenFileName = (typeof tokenFileNames)[number];
type TokenFiles = Record<TokenFileName, string>;

export interface ExportTokensOptions {
  input: string;
  output?: string;
  dryRun?: boolean;
}

export function defaultOutputDirectory(cwd = process.cwd()): string {
  return resolve(cwd, "figma-token-output");
}

export function defaultInputFile(cwd = process.cwd()): string {
  return resolve(cwd, "tokens.json");
}

interface PreparedTokenFiles {
  inputPath: string;
  outputPath: string;
  files: TokenFiles;
}

const resolveOutputDirectory = (output?: string): string => resolve(output ?? defaultOutputDirectory());

async function readPluginTokens(input: string): Promise<{ inputPath: string; tokens: DesignToken[] }> {
  const inputPath = resolve(input);
  let inputStat;
  try {
    inputStat = await stat(inputPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new Error(`Input file not found: ${inputPath}`);
    throw new Error(`Cannot read input file: ${inputPath}`);
  }
  if (inputStat.isDirectory()) throw new Error(`Input path is a directory: ${inputPath}`);

  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(inputPath, "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`Invalid JSON: ${inputPath}`);
    throw new Error(`Cannot read input file: ${inputPath}`);
  }
  if (!isDesignTokenArray(raw)) throw new Error(`Unsupported input: expected Plugin tokens.json: ${inputPath}`);
  return { inputPath, tokens: raw };
}

function renderTokenFiles(tokens: DesignToken[]): TokenFiles {
  return {
    "tokens.json": renderTokensJson(tokens),
    "theme.ts": renderTheme(tokens),
    "variables.css": renderCssVariables(tokens),
    "tokens.scss": renderScssVariables(tokens),
    "tailwind.css": renderTailwindTheme(tokens),
    "tokens.dtcg.json": renderDtcgJson(tokens)
  };
}

async function prepareTokenFiles(options: ExportTokensOptions): Promise<PreparedTokenFiles> {
  const { inputPath, tokens } = await readPluginTokens(options.input);
  return {
    inputPath,
    outputPath: resolveOutputDirectory(options.output),
    files: renderTokenFiles(tokens)
  };
}

async function writeTokenFiles(outputPath: string, files: TokenFiles): Promise<void> {
  try {
    await mkdir(outputPath, { recursive: true });
  } catch {
    throw new Error(`Cannot create output directory: ${outputPath}`);
  }
  for (const filename of tokenFileNames) {
    const path = join(outputPath, filename);
    try {
      await writeFile(path, files[filename]);
    } catch {
      throw new Error(`Cannot write token file: ${path}`);
    }
  }
}

export async function exportTokenFiles(options: ExportTokensOptions, log = console.log) {
  const result = await prepareTokenFiles(options);
  if (options.dryRun) {
    log(`Input: ${result.inputPath}`);
    log(`Output: ${result.outputPath}`);
    log("Would generate:");
    tokenFileNames.forEach((filename) => log(`- ${filename}`));
    return result;
  }
  await writeTokenFiles(result.outputPath, result.files);
  log(`Generated token files in: ${result.outputPath}`);
  return result;
}

export async function checkTokenFiles(options: Omit<ExportTokensOptions, "dryRun">, log = console.log): Promise<0 | 1> {
  const result = await prepareTokenFiles(options);
  const outdated: string[] = [];
  for (const filename of tokenFileNames) {
    const path = join(result.outputPath, filename);
    let contents: string;
    try {
      contents = await readFile(path, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        outdated.push(`- ${filename}: missing`);
        continue;
      }
      throw new Error(`Cannot read token file: ${path}`);
    }
    if (contents !== result.files[filename]) outdated.push(`- ${filename}: changed`);
  }
  if (outdated.length === 0) {
    log("Token files are up to date.");
    return 0;
  }
  log("Token files are not up to date:");
  outdated.forEach((message) => log(message));
  return 1;
}
