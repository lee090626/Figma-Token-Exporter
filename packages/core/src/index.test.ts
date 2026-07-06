import { describe, expect, it } from "vitest";
import { diffTokens, isDesignTokenArray, normalizeFigmaVariables, renderTheme, renderTokensJson } from "./index.js";

const input = { meta: {
  variableCollections: { c: { name: "Colors", modes: [{ modeId: "light", name: "Light" }, { modeId: "dark", name: "Dark" }] } },
  variables: {
    a: { name: "color/brand/primary", variableCollectionId: "c", resolvedType: "COLOR", valuesByMode: { light: { r: 1, g: 0.5, b: 0, a: 0.5 }, dark: { type: "VARIABLE_ALIAS", id: "other" } } },
    b: { name: "gone", deletedButReferenced: true, resolvedType: "STRING", valuesByMode: { light: "x" } }
  }
} };

describe("core", () => {
  it("normalizes paths, colors, aliases, modes, and deleted variables", () => {
    expect(normalizeFigmaVariables(input)).toEqual([
      { name: "color/brand/primary", path: ["color", "brand", "primary"], type: "unknown", value: null, collection: "Colors", mode: "Dark", description: "Alias to other" },
      { name: "color/brand/primary", path: ["color", "brand", "primary"], type: "color", value: "#ff800080", collection: "Colors", mode: "Light" }
    ]);
  });

  it("finds stable added, changed, and removed diffs", () => {
    const old = [{ name: "b", path: ["b"], type: "number" as const, value: 1 }, { name: "a", path: ["a"], type: "number" as const, value: 1 }];
    const current = [{ name: "c", path: ["c"], type: "boolean" as const, value: true }, { ...old[1], value: 2 }];
    expect(diffTokens(old, current).map(({ type, token }) => `${type}:${token.name}`)).toEqual(["changed:a", "removed:b", "added:c"]);
  });

  it("renders JSON and excludes null values from a multi-mode theme", () => {
    const tokens = normalizeFigmaVariables(input);
    expect(renderTokensJson(tokens)).toContain('"value": null');
    expect(renderTheme(tokens)).toContain('"primary": "#ff800080"');
    expect(renderTheme(tokens)).not.toContain("other");
  });

  it("normalizes primitive values and renders mode keys", () => {
    const variables = { variables: {
      n: { name: "size/base", resolvedType: "FLOAT", valuesByMode: { value: 12 } },
      s: { name: "font/name", resolvedType: "STRING", valuesByMode: { value: "Inter" } },
      b: { name: "enabled", resolvedType: "BOOLEAN", valuesByMode: { value: true } }
    } };
    expect(normalizeFigmaVariables(variables).map((token) => token.type).sort()).toEqual(["boolean", "number", "string"]);
    const theme = renderTheme([
      { name: "a", path: ["a"], type: "number", value: 1, mode: "Light Mode" },
      { name: "a", path: ["a"], type: "number", value: 2, mode: "Dark" }
    ]);
    expect(theme).toContain('"lightMode"');
    expect(theme).toContain('"dark"');
  });

  it("rejects invalid exports and duplicate theme paths", () => {
    const token = { name: "a", path: ["a"], type: "number" as const, value: 1 };
    expect(() => renderTheme([token], "not-valid")).toThrow("Invalid TypeScript export name");
    expect(() => renderTheme([token, token])).toThrow("Duplicate theme path");
  });

  it("validates plugin-exported normalized tokens", () => {
    expect(isDesignTokenArray([{ name: "a", path: ["a"], type: "number", value: 1 }])).toBe(true);
    expect(isDesignTokenArray([{ name: "a", path: "a", type: "number", value: 1 }])).toBe(false);
  });
});
