import { access, mkdir, mkdtemp, readFile, readdir, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkTokenFiles, defaultInputFile, defaultOutputDirectory, exportTokenFiles, tokenFileNames } from "./exportTokens.js";

const sampleTokens = [{ name: "spacing/base", path: ["spacing", "base"], type: "spacing", value: 8 }];
const temporaryDirectories: string[] = [];

async function createInput(prefix = "figma-token-") {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  temporaryDirectories.push(dir);
  const input = join(dir, "figma-tokens.json");
  await writeFile(input, JSON.stringify(sampleTokens));
  return { dir, input };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("Plugin token export", () => {
  it("uses figma-token-output as the default output directory", () => {
    expect(defaultOutputDirectory("/tmp/project")).toBe(resolve("/tmp/project/figma-token-output"));
  });

  it("uses tokens.json as the default input file", () => {
    expect(defaultInputFile("/tmp/project")).toBe(resolve("/tmp/project/tokens.json"));
  });

  it("creates all six files and creates missing output directories", async () => {
    const { dir, input } = await createInput();
    const output = join(dir, "generated", "tokens");

    await exportTokenFiles({ input, output });

    expect((await readdir(output)).sort()).toEqual([...tokenFileNames].sort());
  });

  it("uses the requested output directory and overwrites existing files", async () => {
    const { dir, input } = await createInput();
    const output = join(dir, "src", "tokens");
    await exportTokenFiles({ input, output });
    await writeFile(join(output, "theme.ts"), "outdated");

    await exportTokenFiles({ input, output });

    expect(await readFile(join(output, "theme.ts"), "utf8")).toContain("export const theme");
  });

  it("does not create files or directories during dry-run", async () => {
    const { dir, input } = await createInput();
    const output = join(dir, "missing", "tokens");
    const logs: string[] = [];

    await exportTokenFiles({ input, output, dryRun: true }, (message) => logs.push(message));

    await expect(access(output)).rejects.toThrow();
    expect(logs).toEqual([
      `Input: ${resolve(input)}`,
      `Output: ${resolve(output)}`,
      "Would generate:",
      ...tokenFileNames.map((filename) => `- ${filename}`)
    ]);
  });

  it("rejects invalid JSON and unsupported input during dry-run without writing output", async () => {
    const { dir, input } = await createInput();
    const output = join(dir, "output");
    await writeFile(input, "{");

    await expect(exportTokenFiles({ input, output, dryRun: true })).rejects.toThrow(`Invalid JSON: ${resolve(input)}`);
    await expect(access(output)).rejects.toThrow();

    await writeFile(input, JSON.stringify({ variables: {} }));
    await expect(exportTokenFiles({ input, output, dryRun: true })).rejects.toThrow("Unsupported input: expected Plugin tokens.json");
    await expect(access(output)).rejects.toThrow();

    await writeFile(input, JSON.stringify([{ name: "color/invalid", path: ["color", "invalid"], type: "color", value: 8 }]));
    await expect(exportTokenFiles({ input, output, dryRun: true })).rejects.toThrow("Unsupported input: expected Plugin tokens.json");
    await expect(access(output)).rejects.toThrow();
  });

  it("reports up-to-date files with exit code 0", async () => {
    const { dir, input } = await createInput();
    const output = join(dir, "tokens");
    const logs: string[] = [];
    await exportTokenFiles({ input, output });

    await expect(checkTokenFiles({ input, output }, (message) => logs.push(message))).resolves.toBe(0);
    expect(logs).toEqual(["Token files are up to date."]);
    expect(await readFile(join(output, "theme.ts"), "utf8")).toContain("export const theme");
  });

  it("reports changed files with exit code 1", async () => {
    const { dir, input } = await createInput();
    const output = join(dir, "tokens");
    const logs: string[] = [];
    await exportTokenFiles({ input, output });
    await writeFile(join(output, "variables.css"), "outdated");

    await expect(checkTokenFiles({ input, output }, (message) => logs.push(message))).resolves.toBe(1);
    expect(logs).toEqual(["Token files are not up to date:", "- variables.css: changed"]);
  });

  it("reports missing files with exit code 1", async () => {
    const { dir, input } = await createInput();
    const output = join(dir, "tokens");
    const logs: string[] = [];
    await exportTokenFiles({ input, output });
    await unlink(join(output, "theme.ts"));

    await expect(checkTokenFiles({ input, output }, (message) => logs.push(message))).resolves.toBe(1);
    expect(logs).toEqual(["Token files are not up to date:", "- theme.ts: missing"]);
  });

  it("rejects missing inputs, directories, and unusable output paths", async () => {
    const { dir } = await createInput();
    const missing = join(dir, "missing.json");
    await expect(exportTokenFiles({ input: missing })).rejects.toThrow(`Input file not found: ${resolve(missing)}`);
    await expect(exportTokenFiles({ input: dir })).rejects.toThrow(`Input path is a directory: ${resolve(dir)}`);

    const input = join(dir, "figma-tokens.json");
    const output = join(dir, "not-a-directory");
    await writeFile(output, "file");
    await expect(exportTokenFiles({ input, output })).rejects.toThrow(`Cannot create output directory: ${resolve(output)}`);
  });

  it("reports individual token file write failures", async () => {
    const { dir, input } = await createInput();
    const output = join(dir, "tokens");
    await mkdir(join(output, "theme.ts"), { recursive: true });

    await expect(exportTokenFiles({ input, output })).rejects.toThrow(`Cannot write token file: ${join(output, "theme.ts")}`);
  });

  it("supports input and output paths with spaces", async () => {
    const dir = await mkdtemp(join(tmpdir(), "figma token "));
    temporaryDirectories.push(dir);
    const input = join(dir, "plugin tokens.json");
    const output = join(dir, "project tokens");
    await writeFile(input, JSON.stringify(sampleTokens));

    await exportTokenFiles({ input, output });

    expect(await readFile(join(output, "tokens.json"), "utf8")).toContain('"spacing/base"');
  });
});
