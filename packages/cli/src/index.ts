#!/usr/bin/env node
import "dotenv/config";
import { Command, InvalidArgumentError } from "commander";
import { checkTokenFiles, defaultInputFile, defaultOutputDirectory, exportTokenFiles } from "./exportTokens.js";
import { sync } from "./sync.js";

const format = (value: string) => {
  const formats = ["tokens-json", "theme-ts", "variables-css", "tokens-scss", "tailwind-css", "tokens-dtcg-json"];
  if (!formats.includes(value)) throw new InvalidArgumentError(`format은 ${formats.join(", ")} 중 하나여야 합니다.`);
  return value;
};

const program = new Command()
  .name("figma-token")
  .description("Plugin tokens.json을 프로젝트 토큰 파일로 적용합니다.")
  .version("0.1.3")
  .argument("[input]", "Figma Plugin에서 다운로드한 tokens.json (default: ./tokens.json)")
  .option("--out <directory>", "출력 폴더 (default: ./figma-token-output)")
  .option("--dry-run", "파일을 쓰지 않고 생성 결과를 확인")
  .option("--check", "현재 토큰 파일이 최신인지 확인")
  .action(async (input, options) => {
    if (options.check && options.dryRun) throw new Error("--check와 --dry-run은 함께 사용할 수 없습니다. 하나만 사용하세요.");
    const defaultInput = !input;
    const inputPath = input ?? defaultInputFile();
    try {
      if (options.check) {
        process.exitCode = await checkTokenFiles({ input: inputPath, output: options.out ?? defaultOutputDirectory() });
        return;
      }
      await exportTokenFiles({ input: inputPath, output: options.out ?? defaultOutputDirectory(), dryRun: options.dryRun });
    } catch (error) {
      if (defaultInput && error instanceof Error && error.message.startsWith("Input file not found:")) {
        throw new Error("Expected token file: ./tokens.json\nProvide another file with: figma-token <input>");
      }
      throw error;
    }
  });

program.command("sync", { hidden: true })
  .option("--input <path>", "로컬 Figma Variables JSON")
  .option("--output <path>", "출력 파일", "./tokens.json")
  .option("--snapshot <path>", "snapshot 파일", ".figma-token/snapshot.json")
  .option("--format <format>", "출력 포맷", format, "tokens-json")
  .option("--export-name <name>", "theme.ts export 이름", "theme")
  .option("--figma-token <token>", "Figma token")
  .option("--file-key <key>", "Figma file key")
  .option("--dry-run", "파일을 쓰지 않고 diff만 출력", false)
  .action(async (options) => sync({
    ...options,
    figmaToken: options.figmaToken ?? process.env.FIGMA_TOKEN,
    fileKey: options.fileKey ?? process.env.FIGMA_FILE_KEY
  }));

program.parseAsync().catch((error: unknown) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
