import { expect, it } from "vitest";
import { exportVariables } from "./exportVariables.js";

it("converts Plugin API variables with the shared core", () => {
  expect(exportVariables(
    [{ id: "c", name: "Brand", modes: [{ modeId: "light", name: "Light" }] }],
    [{ id: "v", name: "color/primary", description: "", variableCollectionId: "c", resolvedType: "COLOR", valuesByMode: { light: { r: 1, g: 0, b: 0, a: 1 } } }]
  )).toEqual([{ name: "color/primary", path: ["color", "primary"], type: "color", value: "#ff0000", collection: "Brand", mode: "Light" }]);
});
