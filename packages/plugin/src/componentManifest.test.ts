import { expect, it } from "vitest";
import { createComponentManifest, createFrameManifest, variableIdsFromBindings } from "./componentManifest.js";

it("collects variable aliases from nested Figma bindings", () => {
  expect(variableIdsFromBindings({ fills: [{ type: "VARIABLE_ALIAS", id: "color" }], componentProperties: { size: { type: "VARIABLE_ALIAS", id: "spacing" } } }))
    .toEqual(["color", "spacing"]);
});

it("creates a component-set manifest with each variant's properties and bindings", () => {
  expect(createComponentManifest({
    name: "Button", nodeId: "1:2", type: "COMPONENT_SET", variants: [
      { name: "Size=Small, State=Default", nodeId: "1:3", properties: { Size: "Small", State: "Default" }, variables: ["color/primary", "radius/md"] },
      { name: "Size=Large, State=Hover", nodeId: "1:4", properties: { Size: "Large", State: "Hover" }, variables: ["color/primary"] }
    ]
  }, ["radius/md", "color/primary", "radius/md"]))
    .toEqual({
      component: {
        name: "Button", nodeId: "1:2", type: "COMPONENT_SET",
        variantProperties: { Size: ["Large", "Small"], State: ["Default", "Hover"] },
        variants: [
          { name: "Size=Small, State=Default", nodeId: "1:3", properties: { Size: "Small", State: "Default" }, variables: ["color/primary", "radius/md"] },
          { name: "Size=Large, State=Hover", nodeId: "1:4", properties: { Size: "Large", State: "Hover" }, variables: ["color/primary"] }
        ]
      },
      variables: ["color/primary", "radius/md"]
    });
});

it("creates a stable token usage map for a frame", () => {
  expect(createFrameManifest({ name: "Home", nodeId: "1:5", type: "FRAME" }, [
    { name: "spacing/md", usedBy: [{ nodeId: "1:7", name: "Button", type: "RECTANGLE", path: "Home / Button" }] },
    { name: "color/primary", usedBy: [
      { nodeId: "1:6", name: "Card", type: "FRAME", path: "Home / Card" },
      { nodeId: "1:6", name: "Card", type: "FRAME", path: "Home / Card" }
    ] }
  ])).toEqual({
    frame: { name: "Home", nodeId: "1:5", type: "FRAME" },
    tokens: [
      { name: "color/primary", usedBy: [{ nodeId: "1:6", name: "Card", type: "FRAME", path: "Home / Card" }] },
      { name: "spacing/md", usedBy: [{ nodeId: "1:7", name: "Button", type: "RECTANGLE", path: "Home / Button" }] }
    ]
  });
});
