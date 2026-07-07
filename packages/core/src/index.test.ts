import { describe, expect, it } from "vitest";
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
  generateVariableName,
  type DesignToken
} from "./index.js";

const tokens: DesignToken[] = [
  { name: "color/brand/primary", path: ["color", "brand", "primary"], type: "color", value: { r: 51, g: 102, b: 255, a: 1 } },
  { name: "brand/secondary", path: ["brand", "secondary"], type: "color", value: { r: 255, g: 0, b: 0, a: 0.5 } },
  { name: "color/brand/overlay/subtle", path: ["color", "brand", "overlay", "subtle"], type: "color", value: { r: 0, g: 0, b: 0, a: 0.5 } },
  { name: "spacing/small", path: ["spacing", "small"], type: "spacing", value: 8 },
  { name: "spacing/layout/card/gap", path: ["spacing", "layout", "card", "gap"], type: "spacing", value: 24 },
  { name: "radius/medium", path: ["radius", "medium"], type: "radius", value: 8 },
  { name: "fontSize/body", path: ["fontSize", "body"], type: "fontSize", value: 16 },
  { name: "opacity/disabled", path: ["opacity", "disabled"], type: "opacity", value: 0.5 }
];

const numericTokens: DesignToken[] = [
  { name: "spacing/small", path: ["spacing", "small"], type: "spacing", value: 8 },
  { name: "radius/medium", path: ["radius", "medium"], type: "radius", value: 8 },
  { name: "fontSize/body", path: ["fontSize", "body"], type: "fontSize", value: 16 },
  { name: "opacity/disabled", path: ["opacity", "disabled"], type: "opacity", value: 0.5 }
];

const figmaInput = { meta: {
  variableCollections: { c: { name: "Brand", defaultModeId: "light", modes: [{ modeId: "light", name: "Light" }, { modeId: "dark", name: "Dark" }] } },
  variables: {
    base: { name: "color/brand/primary", variableCollectionId: "c", resolvedType: "COLOR", valuesByMode: { light: { r: 0.2, g: 0.4, b: 1, a: 1 }, dark: { r: 0, g: 0, b: 0, a: 1 } } },
    unprefixedColor: { name: "brand/secondary", variableCollectionId: "c", resolvedType: "COLOR", valuesByMode: { light: { r: 1, g: 0, b: 0, a: 0.5 } } },
    alias: { name: "color/brand/alias", variableCollectionId: "c", resolvedType: "COLOR", valuesByMode: { light: { type: "VARIABLE_ALIAS", id: "base" } } },
    spacing: { name: "spacing/layout/card/gap", variableCollectionId: "c", resolvedType: "FLOAT", valuesByMode: { light: 24 } },
    radius: { name: "radius/medium", variableCollectionId: "c", resolvedType: "FLOAT", valuesByMode: { light: 12 } },
    fontSize: { name: "fontSize/body", variableCollectionId: "c", resolvedType: "FLOAT", valuesByMode: { light: 16 } },
    opacity: { name: "opacity/disabled", variableCollectionId: "c", resolvedType: "FLOAT", valuesByMode: { light: 0.5 } },
    unclassifiedFloat: { name: "ExtraLarge - 28", variableCollectionId: "c", resolvedType: "FLOAT", valuesByMode: { light: 28 } },
    shadow: { name: "shadow/card", variableCollectionId: "c", resolvedType: "FLOAT", valuesByMode: { light: 1 } },
    deleted: { name: "spacing/deleted", deletedButReferenced: true, resolvedType: "FLOAT", valuesByMode: { light: 1 } }
  }
} };

describe("core", () => {
  it("normalizes supported Figma variables, resolves aliases, uses one mode, and skips unsupported types", () => {
    const skipped: string[] = [];
    expect(normalizeFigmaVariables(figmaInput, { onUnsupported: (name, reason) => skipped.push(`${reason}:${name}`) })).toMatchInlineSnapshot(`
      [
        {
          "collection": "Brand",
          "mode": "Light",
          "name": "brand/secondary",
          "path": [
            "brand",
            "secondary",
          ],
          "type": "color",
          "value": {
            "a": 0.5,
            "b": 0,
            "g": 0,
            "r": 255,
          },
        },
        {
          "collection": "Brand",
          "mode": "Light",
          "name": "color/brand/alias",
          "path": [
            "color",
            "brand",
            "alias",
          ],
          "type": "color",
          "value": {
            "a": 1,
            "b": 255,
            "g": 102,
            "r": 51,
          },
        },
        {
          "collection": "Brand",
          "mode": "Light",
          "name": "color/brand/primary",
          "path": [
            "color",
            "brand",
            "primary",
          ],
          "type": "color",
          "value": {
            "a": 1,
            "b": 255,
            "g": 102,
            "r": 51,
          },
        },
        {
          "collection": "Brand",
          "mode": "Light",
          "name": "fontSize/body",
          "path": [
            "fontSize",
            "body",
          ],
          "type": "fontSize",
          "value": 16,
        },
        {
          "collection": "Brand",
          "mode": "Light",
          "name": "opacity/disabled",
          "path": [
            "opacity",
            "disabled",
          ],
          "type": "opacity",
          "value": 0.5,
        },
        {
          "collection": "Brand",
          "mode": "Light",
          "name": "radius/medium",
          "path": [
            "radius",
            "medium",
          ],
          "type": "radius",
          "value": 12,
        },
        {
          "collection": "Brand",
          "mode": "Light",
          "name": "spacing/layout/card/gap",
          "path": [
            "spacing",
            "layout",
            "card",
            "gap",
          ],
          "type": "spacing",
          "value": 24,
        },
      ]
    `);
    expect(skipped).toEqual(["unclassified-float:ExtraLarge - 28", "unclassified-float:shadow/card"]);
  });

  it("renders all Phase 1 formats from normalized tokens", () => {
    expect(tokens.map(generateVariableName)).toContain("color-brand-primary");
    expect(tokens.map(generateVariableName)).toContain("color-brand-secondary");
    expect(tokens.map(generateVariableName)).toContain("font-size-body");
    expect(renderTokensJson(tokens)).toContain('"name": "brand/secondary"');
    expect(renderTheme(tokens)).toContain('"secondary": "#ff000080"');
    expect(renderCssVariables(tokens)).toContain("--color-brand-secondary: #ff000080;");
    expect(renderScssVariables(tokens)).toContain("$color-brand-secondary: #ff000080;");
    expect(renderTailwindTheme(tokens)).toContain("--color-brand-secondary: #ff000080;");
    expect(renderDtcgJson(tokens)).toContain('"$value": "#ff000080"');
  });

  it("renders numeric token types with correct units, names, and DTCG values", () => {
    const files = {
      "tokens.json": renderTokensJson(numericTokens),
      "theme.ts": renderTheme(numericTokens),
      "variables.css": renderCssVariables(numericTokens),
      "tokens.scss": renderScssVariables(numericTokens),
      "tailwind.css": renderTailwindTheme(numericTokens),
      "tokens.dtcg.json": renderDtcgJson(numericTokens)
    };
    expect(Object.keys(files)).toEqual(["tokens.json", "theme.ts", "variables.css", "tokens.scss", "tailwind.css", "tokens.dtcg.json"]);

    for (const output of [files["variables.css"], files["tokens.scss"], files["tailwind.css"]]) {
      expect(output).toContain("spacing-small: 8px;");
      expect(output).toContain("radius-medium: 8px;");
      expect(output).toContain("font-size-body: 16px;");
      expect(output).toContain("opacity-disabled: 0.5;");
      expect(output).not.toContain("opacity-disabled: 0.5px;");
    }
    expect(files["theme.ts"]).toContain('"small": "8px"');
    expect(files["theme.ts"]).toContain('"medium": "8px"');
    expect(files["theme.ts"]).toContain('"body": "16px"');
    expect(files["theme.ts"]).toContain('"disabled": 0.5');
    expect(files["theme.ts"]).not.toContain('"disabled": "0.5"');

    const dtcg = JSON.parse(renderDtcgJson(numericTokens));
    expect(dtcg.spacing.small).toEqual({ $type: "dimension", $value: { value: 8, unit: "px" } });
    expect(dtcg.radius.medium).toEqual({ $type: "dimension", $value: { value: 8, unit: "px" } });
    expect(dtcg.fontSize.body).toEqual({ $type: "dimension", $value: { value: 16, unit: "px" } });
    expect(dtcg.opacity.disabled).toEqual({ $type: "number", $value: 0.5 });
  });

  it("finds stable added, changed, and removed diffs", () => {
    const old = [tokens[3], tokens[4]];
    const current = [{ ...tokens[3], value: 10 }, tokens[5]];
    expect(diffTokens(old, current).map(({ type, token }) => `${type}:${token.name}`)).toEqual(["added:radius/medium", "removed:spacing/layout/card/gap", "changed:spacing/small"]);
  });

  it("rejects invalid exports, duplicate paths, and invalid normalized tokens", () => {
    expect(isDesignTokenArray(tokens)).toBe(true);
    expect(isDesignTokenArray([{ name: "a", path: ["a"], type: "number", value: 1 }])).toBe(false);
    expect(() => renderTheme(tokens, "not-valid")).toThrow("Invalid TypeScript export name");
    expect(() => renderTheme([tokens[0], tokens[0]])).toThrow("Duplicate theme path");
    expect(() => renderDtcgJson([tokens[0], tokens[0]])).toThrow("Duplicate DTCG path");
  });
});
