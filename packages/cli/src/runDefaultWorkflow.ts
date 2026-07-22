import {
  checkTokenFiles,
  defaultInputFile,
  defaultOutputDirectory,
  exportTokenFiles
} from "./exportTokens.js";

export interface DefaultWorkflowOptions {
  out?: string;
  dryRun?: boolean;
  check?: boolean;
}

function outputDirectory(options: DefaultWorkflowOptions): string {
  return options.out ?? defaultOutputDirectory();
}

function defaultInputError(error: unknown, usesDefaultInput: boolean): never {
  if (usesDefaultInput && error instanceof Error && error.message.startsWith("Input file not found:")) {
    throw new Error("Expected token file: ./tokens.json\nProvide another file with: figma-token <input>");
  }
  throw error;
}

export async function runDefaultWorkflow(input: string | undefined, options: DefaultWorkflowOptions): Promise<0 | 1 | void> {
  if (options.check && options.dryRun) {
    throw new Error("--check와 --dry-run은 함께 사용할 수 없습니다. 하나만 사용하세요.");
  }

  const usesDefaultInput = !input;
  const inputPath = input ?? defaultInputFile();

  try {
    if (options.check) {
      return checkTokenFiles({ input: inputPath, output: outputDirectory(options) });
    }
    await exportTokenFiles({ input: inputPath, output: outputDirectory(options), dryRun: options.dryRun });
  } catch (error) {
    return defaultInputError(error, usesDefaultInput);
  }
}
