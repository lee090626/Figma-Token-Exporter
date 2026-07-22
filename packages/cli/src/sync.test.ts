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

  it("reports the input path when JSON parsing fails", async () => {
    const dir = await mkdtemp(join(tmpdir(), "figma-token-"));
    const input = join(dir, "input.json");
    await writeFile(input, "{");
    await expect(sync({ input, output: join(dir, "tokens.json"), snapshot: join(dir, "snapshot.json"), format: "tokens-json", exportName: "theme", dryRun: true }, () => {}))
      .rejects.toThrow(`Invalid JSON: ${input}`);
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

  it("does not update output when snapshot preparation fails", async () => {
    const dir = await mkdtemp(join(tmpdir(), "figma-token-"));
    const input = join(dir, "input.json");
    const output = join(dir, "tokens.json");
    const blockedParent = join(dir, "not-a-directory");
    await writeFile(input, JSON.stringify({ variables: {} }));
    await writeFile(output, "previous output");
    await writeFile(blockedParent, "file");

    await expect(sync({ input, output, snapshot: join(blockedParent, "snapshot.json"), format: "tokens-json", exportName: "theme", dryRun: false }, () => {})).rejects.toThrow();
    await expect(readFile(output, "utf8")).resolves.toBe("previous output");
  });

  it("rejects invalid snapshot tokens", async () => {
    const dir = await mkdtemp(join(tmpdir(), "figma-token-"));
    const input = join(dir, "input.json");
    const snapshot = join(dir, "snapshot.json");
    await writeFile(input, JSON.stringify({ variables: {} }));
    await writeFile(snapshot, JSON.stringify([{ name: "spacing/base", path: ["spacing", "base"], type: "number", value: 8 }]));
    await expect(sync({ input, output: join(dir, "tokens.json"), snapshot, format: "tokens-json", exportName: "theme", dryRun: true }, () => {}))
      .rejects.toThrow("snapshot은 DesignToken 배열이어야 합니다.");
  });

  it("accepts normalized tokens exported by the plugin", async () => {
    const dir = await mkdtemp(join(tmpdir(), "figma-token-"));
    const input = join(dir, "figma-tokens.json");
    const output = join(dir, "tokens.json");
    await writeFile(input, JSON.stringify([{ name: "spacing/base", path: ["spacing", "base"], type: "spacing", value: 8 }]));
    await sync({ input, output, snapshot: join(dir, "snapshot.json"), format: "tokens-json", exportName: "theme", dryRun: false }, () => {});
    expect(await readFile(output, "utf8")).toContain('"spacing"');
  });

  it("logs unclassified FLOAT variables", async () => {
    const dir = await mkdtemp(join(tmpdir(), "figma-token-"));
    const input = join(dir, "figma.json");
    const logs: string[] = [];
    const warnings: string[] = [];
    await writeFile(input, JSON.stringify({
      variables: {
        size: { name: "ExtraLarge - 28", resolvedType: "FLOAT", valuesByMode: { light: 28 } }
      }
    }));
    await sync(
      { input, output: join(dir, "tokens.json"), snapshot: join(dir, "snapshot.json"), format: "tokens-json", exportName: "theme", dryRun: true },
      (message) => logs.push(message),
      (message) => warnings.push(message)
    );
    expect(warnings).toContain("unclassified FLOAT variable skipped: ExtraLarge - 28");
  });
});
