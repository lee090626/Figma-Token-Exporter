import { expect, it } from "vitest";
import { createComponentManifest, variableIdsFromBindings } from "./componentManifest.js";

it("collects variable aliases from nested Figma bindings", () => {
  expect(variableIdsFromBindings({ fills: [{ type: "VARIABLE_ALIAS", id: "color" }], componentProperties: { size: { type: "VARIABLE_ALIAS", id: "spacing" } } }))
    .toEqual(["color", "spacing"]);
});

it("creates a stable component manifest", () => {
  expect(createComponentManifest({ name: "Button", nodeId: "1:2", type: "COMPONENT", variants: [] }, ["radius/md", "color/primary", "radius/md"]))
    .toEqual({ component: { name: "Button", nodeId: "1:2", type: "COMPONENT", variants: [] }, variables: ["color/primary", "radius/md"] });
});
