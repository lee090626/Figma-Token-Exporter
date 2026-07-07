import { expect, it } from "vitest";
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
  expect(result.files["tokens.json"]).toContain('"value": 8');
  expect(result.files["theme.ts"]).toContain('"base": "8px"');
  expect(Object.keys(result.files)).toEqual(["tokens.json", "theme.ts", "variables.css", "tokens.scss", "tailwind.css", "tokens.dtcg.json"]);
});
