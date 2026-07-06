#!/usr/bin/env node
import "dotenv/config";
import { Command, InvalidArgumentError } from "commander";
import { sync } from "./sync.js";

const format = (value: string) => {
  if (value !== "tokens-json" && value !== "theme-ts") throw new InvalidArgumentError("format은 tokens-json 또는 theme-ts여야 합니다.");
  return value;
};

const program = new Command().name("figma-token-pr").description("Figma Variables를 로컬 디자인 토큰으로 동기화합니다.");
program.command("sync")
  .option("--input <path>", "로컬 Figma Variables JSON")
  .option("--output <path>", "출력 파일", "./tokens.json")
  .option("--snapshot <path>", "snapshot 파일", ".figma-token-pr/snapshot.json")
  .option("--format <format>", "tokens-json 또는 theme-ts", format, "tokens-json")
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
