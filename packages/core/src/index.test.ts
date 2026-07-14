import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
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
  { name: "borderWidth/thin", path: ["borderWidth", "thin"], type: "borderWidth", value: 1 },
  { name: "size/icon", path: ["size", "icon"], type: "size", value: 20 },
  { name: "fontSize/body", path: ["fontSize", "body"], type: "fontSize", value: 16 },
  { name: "opacity/disabled", path: ["opacity", "disabled"], type: "opacity", value: 0.5 }
];

const numericTokens: DesignToken[] = [
  { name: "spacing/small", path: ["spacing", "small"], type: "spacing", value: 8 },
  { name: "radius/medium", path: ["radius", "medium"], type: "radius", value: 8 },
  { name: "borderWidth/thin", path: ["borderWidth", "thin"], type: "borderWidth", value: 1 },
  { name: "size/icon", path: ["size", "icon"], type: "size", value: 20 },
  { name: "fontSize/body", path: ["fontSize", "body"], type: "fontSize", value: 16 },
  { name: "opacity/disabled", path: ["opacity", "disabled"], type: "opacity", value: 0.5 }
];

const shapeFallbackFixture = {
  variableCollections: { shape: { name: "Shape", defaultModeId: "light", modes: [{ modeId: "light", name: "Light" }] } },
  variables: {
    extraLarge: { name: "ExtraLarge - 28", variableCollectionId: "shape", resolvedType: "FLOAT", valuesByMode: { light: 28 } }
  }
};

const outputTokens = [...numericTokens, ...normalizeFigmaVariables(shapeFallbackFixture)];

const numericOutputFiles = {
  "tokens.json": renderTokensJson(outputTokens),
  "theme.ts": renderTheme(outputTokens),
  "variables.css": renderCssVariables(outputTokens),
  "tokens.scss": renderScssVariables(outputTokens),
  "tailwind.css": renderTailwindTheme(outputTokens),
  "tokens.dtcg.json": renderDtcgJson(outputTokens)
};

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
    expect(normalizeFigmaVariables(figmaInput, { onUnsupported: (name, reason, collection) => skipped.push(`${reason}:${name}:${collection ?? ""}`) })).toMatchInlineSnapshot(`
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
    expect(skipped).toEqual(["unclassified-float:ExtraLarge - 28:Brand", "unclassified-float:shadow/card:Brand"]);
  });

  it("falls back to collection names for unprefixed FLOAT variables", () => {
    const skipped: string[] = [];
    const result = normalizeFigmaVariables({
      variableCollections: {
        shape: { name: "Shape", modes: [{ modeId: "light", name: "Light" }] },
        spacing: { name: "Spacing", modes: [{ modeId: "light", name: "Light" }] },
        radius: { name: "Radius", modes: [{ modeId: "light", name: "Light" }] },
        unknown: { name: "Unknown", modes: [{ modeId: "light", name: "Light" }] }
      },
      variables: {
        xl: { name: "ExtraLarge - 28", variableCollectionId: "shape", resolvedType: "FLOAT", valuesByMode: { light: 28 } },
        sm: { name: "Small - 10", variableCollectionId: "spacing", resolvedType: "FLOAT", valuesByMode: { light: 10 } },
        md: { name: "Medium - 12", variableCollectionId: "radius", resolvedType: "FLOAT", valuesByMode: { light: 12 } },
        random: { name: "RandomName - 5", variableCollectionId: "unknown", resolvedType: "FLOAT", valuesByMode: { light: 5 } }
      }
    }, { onUnsupported: (name, reason, collection) => skipped.push(`${reason}:${name}:${collection}`) });

    expect(result.map((token) => `${token.path.join("/")}:${token.type}:${token.value}`)).toEqual([
      "radius/Medium - 12:radius:12",
      "radius/ExtraLarge - 28:radius:28",
      "spacing/Small - 10:spacing:10"
    ]);
    expect(renderTheme(result)).toMatchInlineSnapshot(`
      "export const theme = {
        "radius": {
          "medium12": "12px",
          "extraLarge28": "28px"
        },
        "spacing": {
          "small10": "10px"
        }
      } as const;
      "
    `);
    expect(renderDtcgJson(result)).toMatchInlineSnapshot(`
      "{
        "radius": {
          "Medium - 12": {
            "$type": "dimension",
            "$value": {
              "value": 12,
              "unit": "px"
            }
          },
          "ExtraLarge - 28": {
            "$type": "dimension",
            "$value": {
              "value": 28,
              "unit": "px"
            }
          }
        },
        "spacing": {
          "Small - 10": {
            "$type": "dimension",
            "$value": {
              "value": 10,
              "unit": "px"
            }
          }
        }
      }
      "
    `);
    expect(skipped).toEqual(["unclassified-float:RandomName - 5:Unknown"]);
  });

  it("classifies collection fallback by words instead of matching substrings", () => {
    const skipped: string[] = [];
    const result = normalizeFigmaVariables({
      variableCollections: {
        shape: { name: "sHaPe / Corners", modes: [{ modeId: "light", name: "Light" }] },
        font: { name: "Font Size", modes: [{ modeId: "light", name: "Light" }] },
        context: { name: "Context", modes: [{ modeId: "light", name: "Light" }] },
        shapeshifter: { name: "Shapeshifter", modes: [{ modeId: "light", name: "Light" }] }
      },
      variables: {
        corner: { name: "2XL", variableCollectionId: "shape", resolvedType: "FLOAT", valuesByMode: { light: 28 } },
        body: { name: "Body 16px", variableCollectionId: "font", resolvedType: "FLOAT", valuesByMode: { light: 16 } },
        context: { name: "100%", variableCollectionId: "context", resolvedType: "FLOAT", valuesByMode: { light: 100 } },
        shapeshifter: { name: "-4", variableCollectionId: "shapeshifter", resolvedType: "FLOAT", valuesByMode: { light: -4 } }
      }
    }, { onUnsupported: (name) => skipped.push(name) });

    expect(result.map((token) => `${token.type}:${token.name}`)).toEqual(["fontSize:Body 16px", "radius:2XL"]);
    expect(skipped).toEqual(["100%", "-4"]);
  });

  it("classifies border widths and sizes from names and collections", () => {
    const result = normalizeFigmaVariables({
      variableCollections: {
        border: { name: "Border Width", modes: [{ modeId: "light", name: "Light" }] },
        size: { name: "Size", modes: [{ modeId: "light", name: "Light" }] }
      },
      variables: {
        namedBorder: { name: "border-width/thin", variableCollectionId: "border", resolvedType: "FLOAT", valuesByMode: { light: 1 } },
        namedSize: { name: "size/icon", variableCollectionId: "size", resolvedType: "FLOAT", valuesByMode: { light: 20 } },
        fallbackBorder: { name: "Hairline", variableCollectionId: "border", resolvedType: "FLOAT", valuesByMode: { light: 0.5 } },
        fallbackSize: { name: "Avatar", variableCollectionId: "size", resolvedType: "FLOAT", valuesByMode: { light: 32 } }
      }
    });

    expect(result.map((token) => `${token.type}:${token.path.join("/")}:${token.value}`)).toEqual([
      "borderWidth:border-width/thin:1",
      "borderWidth:borderWidth/Hairline:0.5",
      "size:size/Avatar:32",
      "size:size/icon:20"
    ]);
  });

  it("keeps finite numeric edge values and skips non-finite values", () => {
    const result = normalizeFigmaVariables({
      variableCollections: { c: { name: "Shape", modes: [{ modeId: "light", name: "Light" }] } },
      variables: {
        zero: { name: "radius/0", variableCollectionId: "c", resolvedType: "FLOAT", valuesByMode: { light: 0 } },
        negative: { name: "spacing/-4", variableCollectionId: "c", resolvedType: "FLOAT", valuesByMode: { light: -4 } },
        fraction: { name: "radius/0.5", variableCollectionId: "c", resolvedType: "FLOAT", valuesByMode: { light: 0.5 } },
        large: { name: "spacing/2XL", variableCollectionId: "c", resolvedType: "FLOAT", valuesByMode: { light: Number.MAX_SAFE_INTEGER } },
        nan: { name: "radius/invalid", variableCollectionId: "c", resolvedType: "FLOAT", valuesByMode: { light: Number.NaN } },
        infinity: { name: "color/invalid", variableCollectionId: "c", resolvedType: "COLOR", valuesByMode: { light: { r: Infinity, g: 0, b: 0, a: 1 } } }
      }
    });

    expect(result.map((token) => `${token.name}:${token.value}`)).toEqual([
      "radius/0:0",
      "radius/0.5:0.5",
      "spacing/-4:-4",
      `spacing/2XL:${Number.MAX_SAFE_INTEGER}`
    ]);
    expect(isDesignTokenArray([{ ...tokens[0], value: { r: Infinity, g: 0, b: 0, a: 1 } }])).toBe(false);
    expect(isDesignTokenArray([{ ...tokens[3], value: Number.NaN }])).toBe(false);
  });

  it("keeps signed and percent token names distinct in all export formats", () => {
    const numericNames: DesignToken[] = [
      { name: "radius/-4", path: ["radius", "-4"], type: "radius", value: -4 },
      { name: "radius/4", path: ["radius", "4"], type: "radius", value: 4 },
      { name: "radius/0.5", path: ["radius", "0.5"], type: "radius", value: 0.5 },
      { name: "radius/05", path: ["radius", "05"], type: "radius", value: 5 },
      { name: "opacity/100%", path: ["opacity", "100%"], type: "opacity", value: 1 },
      { name: "opacity/100", path: ["opacity", "100"], type: "opacity", value: 100 }
    ];
    const files = {
      "tokens.json": renderTokensJson(numericNames),
      "theme.ts": renderTheme(numericNames),
      "variables.css": renderCssVariables(numericNames),
      "tokens.scss": renderScssVariables(numericNames),
      "tailwind.css": renderTailwindTheme(numericNames),
      "tokens.dtcg.json": renderDtcgJson(numericNames)
    };

    expect(JSON.parse(files["tokens.json"])).toEqual(numericNames);
    expect(files["theme.ts"]).toContain('"negative4": "-4px"');
    expect(files["theme.ts"]).toContain('"_4": "4px"');
    expect(files["theme.ts"]).toContain('"_0Dot5": "0.5px"');
    expect(files["theme.ts"]).toContain('"_05": "5px"');
    expect(files["theme.ts"]).toContain('"_100Percent": 1');
    expect(files["theme.ts"]).toContain('"_100": 100');
    for (const output of [files["variables.css"], files["tokens.scss"], files["tailwind.css"]]) {
      expect(output).toContain("radius-negative-4: -4px;");
      expect(output).toContain("radius-4: 4px;");
      expect(output).toContain("radius-0-dot-5: 0.5px;");
      expect(output).toContain("radius-05: 5px;");
      expect(output).toContain("opacity-100-percent: 1;");
      expect(output).toContain("opacity-100: 100;");
    }
    const dtcg = JSON.parse(files["tokens.dtcg.json"]);
    expect(dtcg.radius["-4"].$value).toEqual({ value: -4, unit: "px" });
    expect(dtcg.opacity["100%"].$value).toBe(1);
  });

  it("skips variables with no export path and rejects pathless normalized tokens", () => {
    expect(normalizeFigmaVariables({
      variables: {
        unnamed: { name: "///", resolvedType: "COLOR", valuesByMode: { light: { r: 1, g: 1, b: 1, a: 1 } } }
      }
    })).toEqual([]);
    expect(isDesignTokenArray([{ ...tokens[0], path: [] }])).toBe(false);
  });

  it("resolves direct, chained, and cross-collection aliases while preserving mode policy", () => {
    const warnings: string[] = [];
    const result = normalizeFigmaVariables({
      variableCollections: {
        light: { name: "Light Colors", defaultModeId: "light", modes: [{ modeId: "light", name: "Light" }, { modeId: "dark", name: "Dark" }] },
        semantic: { name: "Semantic", defaultModeId: "light", modes: [{ modeId: "light", name: "Light" }, { modeId: "dark", name: "Dark" }] }
      },
      variables: {
        base: { name: "color/base", variableCollectionId: "light", resolvedType: "COLOR", valuesByMode: { light: { r: 1, g: 1, b: 1, a: 1 }, dark: { r: 0, g: 0, b: 0, a: 1 } } },
        direct: { name: "color/direct", variableCollectionId: "semantic", resolvedType: "COLOR", valuesByMode: { light: { type: "VARIABLE_ALIAS", id: "base" }, dark: { type: "VARIABLE_ALIAS", id: "base" } } },
        chained: { name: "color/chained", variableCollectionId: "semantic", resolvedType: "COLOR", valuesByMode: { light: { type: "VARIABLE_ALIAS", id: "direct" } } },
        fallback: { name: "color/fallback", variableCollectionId: "semantic", resolvedType: "COLOR", valuesByMode: { light: { r: 0.5, g: 0.5, b: 0.5, a: 1 } } }
      }
    }, { modeId: "missing", onAliasWarning: (name, reason) => warnings.push(`${reason}:${name}`) });

    expect(result.map((token) => `${token.name}:${JSON.stringify(token.value)}`)).toEqual([
      "color/base:{\"r\":255,\"g\":255,\"b\":255,\"a\":1}",
      "color/chained:{\"r\":255,\"g\":255,\"b\":255,\"a\":1}",
      "color/direct:{\"r\":255,\"g\":255,\"b\":255,\"a\":1}",
      "color/fallback:{\"r\":128,\"g\":128,\"b\":128,\"a\":1}"
    ]);
    expect(warnings).toEqual([]);
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
    const files = numericOutputFiles;
    expect(Object.keys(files)).toEqual(["tokens.json", "theme.ts", "variables.css", "tokens.scss", "tailwind.css", "tokens.dtcg.json"]);

    for (const output of [files["variables.css"], files["tokens.scss"], files["tailwind.css"]]) {
      expect(output).toContain("spacing-small: 8px;");
      expect(output).toContain("radius-medium: 8px;");
      expect(output).toContain("border-width-thin: 1px;");
      expect(output).toContain("size-icon: 20px;");
      expect(output).toContain("font-size-body: 16px;");
      expect(output).toContain("opacity-disabled: 0.5;");
      expect(output).not.toContain("opacity-disabled: 0.5px;");
    }
    expect(files["theme.ts"]).toContain('"small": "8px"');
    expect(files["theme.ts"]).toContain('"medium": "8px"');
    expect(files["theme.ts"]).toContain('"thin": "1px"');
    expect(files["theme.ts"]).toContain('"icon": "20px"');
    expect(files["theme.ts"]).toContain('"body": "16px"');
    expect(files["theme.ts"]).toContain('"disabled": 0.5');
    expect(files["theme.ts"]).not.toContain('"disabled": "0.5"');

    const dtcg = JSON.parse(files["tokens.dtcg.json"]);
    expect(dtcg.spacing.small).toEqual({ $type: "dimension", $value: { value: 8, unit: "px" } });
    expect(dtcg.radius.medium).toEqual({ $type: "dimension", $value: { value: 8, unit: "px" } });
    expect(dtcg.radius["ExtraLarge - 28"]).toEqual({ $type: "dimension", $value: { value: 28, unit: "px" } });
    expect(dtcg.borderWidth.thin).toEqual({ $type: "dimension", $value: { value: 1, unit: "px" } });
    expect(dtcg.size.icon).toEqual({ $type: "dimension", $value: { value: 20, unit: "px" } });
    expect(dtcg.fontSize.body).toEqual({ $type: "dimension", $value: { value: 16, unit: "px" } });
    expect(dtcg.opacity.disabled).toEqual({ $type: "number", $value: 0.5 });

    expect(JSON.parse(files["tokens.json"])).toContainEqual(expect.objectContaining({
      name: "ExtraLarge - 28", path: ["radius", "ExtraLarge - 28"], type: "radius", value: 28
    }));
    expect(files["theme.ts"]).toContain('"extraLarge28": "28px"');
    for (const output of [files["variables.css"], files["tokens.scss"], files["tailwind.css"]]) {
      expect(output).toContain("radius-extra-large-28: 28px;");
    }
  });

  it("writes fixture exports for quick manual inspection", async () => {
    const outputDir = resolve(process.cwd(), "../../export-outputs/figma-float");
    await mkdir(outputDir, { recursive: true });
    await Promise.all(Object.entries(numericOutputFiles).map(([filename, contents]) =>
      writeFile(resolve(outputDir, filename), contents)
    ));

    await expect(readFile(resolve(outputDir, "variables.css"), "utf8")).resolves.toContain("--radius-extra-large-28: 28px;");
    await expect(readFile(resolve(outputDir, "tokens.dtcg.json"), "utf8")).resolves.toContain('"ExtraLarge - 28"');
  });

  it("finds stable added, changed, and removed diffs", () => {
    const old = [tokens[3], tokens[4]];
    const current = [{ ...tokens[3], value: 10 }, tokens[5]];
    expect(diffTokens(old, current).map(({ type, token }) => `${type}:${token.name}`)).toEqual(["added:radius/medium", "removed:spacing/layout/card/gap", "changed:spacing/small"]);
  });

  it("warns when alias targets are missing, cyclic, or the wrong type", () => {
    const warnings: string[] = [];
    const result = normalizeFigmaVariables({
      variableCollections: { c: { name: "Brand", defaultModeId: "light", modes: [{ modeId: "light", name: "Light" }] } },
      variables: {
        missing: { name: "color/missing", variableCollectionId: "c", resolvedType: "COLOR", valuesByMode: { light: { type: "VARIABLE_ALIAS", id: "none" } } },
        cycleA: { name: "color/cycle-a", variableCollectionId: "c", resolvedType: "COLOR", valuesByMode: { light: { type: "VARIABLE_ALIAS", id: "cycleB" } } },
        cycleB: { name: "color/cycle-b", variableCollectionId: "c", resolvedType: "COLOR", valuesByMode: { light: { type: "VARIABLE_ALIAS", id: "cycleA" } } },
        wrongTypeAlias: { name: "color/wrong-type", variableCollectionId: "c", resolvedType: "COLOR", valuesByMode: { light: { type: "VARIABLE_ALIAS", id: "spacing" } } },
        spacing: { name: "spacing/base", variableCollectionId: "c", resolvedType: "FLOAT", valuesByMode: { light: 8 } }
      }
    }, { onAliasWarning: (name, reason, collection) => warnings.push(`${reason}:${name}:${collection ?? ""}`) });

    expect(result.map((token) => token.name)).toEqual(["spacing/base"]);
    expect(warnings).toEqual([
      "alias-target-missing:color/missing:Brand",
      "alias-cycle:color/cycle-a:Brand",
      "alias-cycle:color/cycle-b:Brand",
      "alias-type-mismatch:color/wrong-type:Brand"
    ]);
  });

  it("skips alias targets without the selected mode instead of falling back to another mode", () => {
    const warnings: string[] = [];
    const result = normalizeFigmaVariables({
      variableCollections: { c: { name: "Brand", defaultModeId: "dark", modes: [{ modeId: "light", name: "Light" }, { modeId: "dark", name: "Dark" }] } },
      variables: {
        alias: { name: "color/alias", variableCollectionId: "c", resolvedType: "COLOR", valuesByMode: { dark: { type: "VARIABLE_ALIAS", id: "base" } } },
        base: { name: "color/base", variableCollectionId: "c", resolvedType: "COLOR", valuesByMode: { light: { r: 1, g: 0, b: 0, a: 1 } } }
      }
    }, { onAliasWarning: (name, reason, collection) => warnings.push(`${reason}:${name}:${collection ?? ""}`) });

    // The alias selected dark mode, so using base.light would mix modes silently.
    expect(result.map((token) => token.name)).toEqual(["color/base"]);
    expect(result).not.toContainEqual(expect.objectContaining({ name: "color/alias", value: { r: 255, g: 0, b: 0, a: 1 } }));
    expect(warnings).toEqual(["alias-mode-mismatch:color/base (mode: dark):Brand"]);
  });

  it("rejects invalid exports, duplicate paths, and invalid normalized tokens", () => {
    expect(isDesignTokenArray(tokens)).toBe(true);
    expect(isDesignTokenArray([{ name: "a", path: ["a"], type: "number", value: 1 }])).toBe(false);
    expect(() => renderTheme(tokens, "not-valid")).toThrow("Invalid TypeScript export name");
    expect(() => renderTheme([tokens[0], tokens[0]])).toThrow("Duplicate theme path");
    expect(() => renderDtcgJson([tokens[0], tokens[0]])).toThrow("Duplicate DTCG path");
  });
});
