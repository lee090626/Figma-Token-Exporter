import { expect, it, vi } from "vitest";
import { createExports, exportVariables } from "./exportVariables.js";

it("converts Plugin API variables with the shared core", () => {
  expect(exportVariables(
    [{ id: "c", name: "Brand", modes: [{ modeId: "light", name: "Light" }] }],
    [{ id: "v", name: "color/primary", description: "", variableCollectionId: "c", resolvedType: "COLOR", valuesByMode: { light: { r: 1, g: 0, b: 0, a: 1 } } }]
  )).toEqual([{ name: "color/primary", path: ["color", "primary"], type: "color", value: { r: 255, g: 0, b: 0, a: 1 }, collection: "Brand", mode: "Light" }]);
});

it("creates files that can be downloaded directly", () => {
  const result = createExports(
    [{ id: "c", name: "Brand", modes: [{ modeId: "light", name: "Light" }] }],
    [{ id: "v", name: "spacing/base", description: "", variableCollectionId: "c", resolvedType: "FLOAT", valuesByMode: { light: 8 } }]
  );
  expect(result.count).toBe(1);
  expect(result.typeCounts).toEqual({ color: 0, spacing: 1, radius: 0, borderWidth: 0, size: 0, fontSize: 0, opacity: 0 });
  expect(result.files["tokens.json"]).toContain('"value": 8');
  expect(result.files["theme.ts"]).toContain('"base": "8px"');
  expect(Object.keys(result.files)).toEqual(["tokens.json", "theme.ts", "variables.css", "tokens.scss", "tailwind.css", "tokens.dtcg.json"]);
});

it("exports border widths and sizes from Plugin variables", () => {
  const result = createExports(
    [
      { id: "border", name: "Border Width", modes: [{ modeId: "light", name: "Light" }] },
      { id: "size", name: "Size", modes: [{ modeId: "light", name: "Light" }] }
    ],
    [
      { id: "border", name: "Hairline", description: "", variableCollectionId: "border", resolvedType: "FLOAT", valuesByMode: { light: 0.5 } },
      { id: "size", name: "Avatar", description: "", variableCollectionId: "size", resolvedType: "FLOAT", valuesByMode: { light: 32 } }
    ]
  );

  expect(result.typeCounts).toMatchObject({ borderWidth: 1, size: 1 });
  expect(result.files["theme.ts"]).toContain('"borderWidth": {\n    "hairline": "0.5px"');
  expect(result.files["theme.ts"]).toContain('"size": {\n    "avatar": "32px"');
  expect(result.files["tokens.dtcg.json"]).toContain('"$type": "dimension"');
  expect(result.files["variables.css"]).toContain("--border-width-hairline: 0.5px;");
  expect(result.files["variables.css"]).toContain("--size-avatar: 32px;");
});

it("keeps existing Plugin exports and fallback classifications unchanged", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const result = createExports(
    [
      { id: "spacing", name: "Spacing", modes: [{ modeId: "light", name: "Light" }] },
      { id: "shape", name: "Shape", modes: [{ modeId: "light", name: "Light" }] },
      { id: "text", name: "Text Styles", modes: [{ modeId: "light", name: "Light" }] },
      { id: "opacity", name: "Opacity", modes: [{ modeId: "light", name: "Light" }] },
      { id: "borderColors", name: "Border Colors", modes: [{ modeId: "light", name: "Light" }] }
    ],
    [
      { id: "color", name: "color/primary", description: "", variableCollectionId: "spacing", resolvedType: "COLOR", valuesByMode: { light: { r: 1, g: 0, b: 0, a: 1 } } },
      { id: "spacing", name: "Grid", description: "", variableCollectionId: "spacing", resolvedType: "FLOAT", valuesByMode: { light: 8 } },
      { id: "radius", name: "Small", description: "", variableCollectionId: "shape", resolvedType: "FLOAT", valuesByMode: { light: 4 } },
      { id: "fontSize", name: "Body", description: "", variableCollectionId: "text", resolvedType: "FLOAT", valuesByMode: { light: 16 } },
      { id: "opacity", name: "Disabled", description: "", variableCollectionId: "opacity", resolvedType: "FLOAT", valuesByMode: { light: 0.5 } },
      { id: "borderColor", name: "Divider", description: "", variableCollectionId: "borderColors", resolvedType: "FLOAT", valuesByMode: { light: 1 } }
    ]
  );

  expect(result.typeCounts).toEqual({ color: 1, spacing: 1, radius: 1, borderWidth: 0, size: 0, fontSize: 1, opacity: 1 });
  expect(result.warnings).toEqual(["unclassified FLOAT variable skipped: Divider (collection: Border Colors)"]);
  expect(result.files["theme.ts"]).toContain('"fontSize": {\n    "body": "16px"');
  expect(result.files["theme.ts"]).not.toContain('"borderWidth"');
  expect(result.files["theme.ts"]).not.toContain('"size"');
  expect(result.files["variables.css"]).toContain("--color-primary: #ff0000;");
  expect(result.files["variables.css"]).toContain("--font-size-body: 16px;");
  expect(result.files["tokens.dtcg.json"]).toContain('"$type": "number"');
  warn.mockRestore();
});

it("classifies unprefixed FLOAT variables from collection names", () => {
  const result = createExports(
    [{ id: "c", name: "Shape", modes: [{ modeId: "light", name: "Light" }] }],
    [{ id: "v", name: "ExtraLarge - 28", description: "", variableCollectionId: "c", resolvedType: "FLOAT", valuesByMode: { light: 28 } }]
  );
  expect(result.count).toBe(1);
  expect(result.typeCounts.radius).toBe(1);
  expect(result.warnings).toEqual([]);
  expect(result.files["theme.ts"]).toContain('"radius": {\n    "extraLarge28": "28px"');
  expect(result.files["tokens.dtcg.json"]).toContain('"radius": {\n    "ExtraLarge - 28":');
  expect(result.files["variables.css"]).toContain("--radius-extra-large-28: 28px;");
});

it("warns when FLOAT variables cannot be classified by name", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const result = createExports(
    [{ id: "c", name: "Unknown", modes: [{ modeId: "light", name: "Light" }] }],
    [{ id: "v", name: "ExtraLarge - 28", description: "", variableCollectionId: "c", resolvedType: "FLOAT", valuesByMode: { light: 28 } }]
  );
  expect(result.count).toBe(0);
  expect(result.warnings).toEqual(["unclassified FLOAT variable skipped: ExtraLarge - 28 (collection: Unknown)"]);
  expect(result.skippedVariables).toEqual(["ExtraLarge - 28"]);
  expect(warn).toHaveBeenCalledWith("unclassified FLOAT variable skipped: ExtraLarge - 28 (collection: Unknown)");
  warn.mockRestore();
});
