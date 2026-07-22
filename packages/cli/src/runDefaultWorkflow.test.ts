import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runDefaultWorkflow } from "./runDefaultWorkflow.js";

const temporaryDirectories: string[] = [];
const sampleTokens = [{ name: "spacing/base", path: ["spacing", "base"], type: "spacing", value: 8 }];

async function createInput(): Promise<{ directory: string; input: string }> {
  const directory = await mkdtemp(join(tmpdir(), "figma-token-workflow-"));
  temporaryDirectories.push(directory);
  const input = join(directory, "tokens.json");
  await writeFile(input, JSON.stringify(sampleTokens));
  return { directory, input };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("default workflow", () => {
  it("rejects conflicting check and dry-run options before reading files", async () => {
    await expect(runDefaultWorkflow(undefined, { check: true, dryRun: true }))
      .rejects.toThrow("--check와 --dry-run은 함께 사용할 수 없습니다. 하나만 사용하세요.");
  });

  it("creates files and returns a check failure without modifying outdated files", async () => {
    const { directory, input } = await createInput();
    const output = join(directory, "output");
    await expect(runDefaultWorkflow(input, { out: output })).resolves.toBeUndefined();

    const themePath = join(output, "theme.ts");
    await writeFile(themePath, "outdated");
    await expect(runDefaultWorkflow(input, { out: output, check: true })).resolves.toBe(1);
    await expect(readFile(themePath, "utf8")).resolves.toBe("outdated");
  });
});
