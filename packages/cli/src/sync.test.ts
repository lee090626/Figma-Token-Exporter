import { access, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { sync } from "./sync.js";

describe("sync", () => {
  it("uses input and dry-run writes no files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "figma-token-"));
    const input = join(dir, "input.json");
    const output = join(dir, "tokens.json");
    await writeFile(input, JSON.stringify({ variables: {} }));
    await sync({ input, output, snapshot: join(dir, "snapshot.json"), format: "tokens-json", exportName: "theme", dryRun: true, figmaToken: "unused", fileKey: "unused" }, () => {});
    await expect(access(output)).rejects.toThrow();
  });

  it("writes output and snapshot", async () => {
    const dir = await mkdtemp(join(tmpdir(), "figma-token-"));
    const input = join(dir, "input.json");
    const output = join(dir, "tokens.json");
    const snapshot = join(dir, ".state/snapshot.json");
    await writeFile(input, JSON.stringify({ variables: {} }));
    await sync({ input, output, snapshot, format: "tokens-json", exportName: "theme", dryRun: false }, () => {});
    expect(await readFile(output, "utf8")).toBe("[]\n");
    expect(await readFile(snapshot, "utf8")).toBe("[]\n");
  });

  it("accepts normalized tokens exported by the plugin", async () => {
    const dir = await mkdtemp(join(tmpdir(), "figma-token-"));
    const input = join(dir, "figma-tokens.json");
    const output = join(dir, "tokens.json");
    await writeFile(input, JSON.stringify([{ name: "spacing/base", path: ["spacing", "base"], type: "spacing", value: 8 }]));
    await sync({ input, output, snapshot: join(dir, "snapshot.json"), format: "tokens-json", exportName: "theme", dryRun: false }, () => {});
    expect(await readFile(output, "utf8")).toContain('"spacing"');
  });
});
