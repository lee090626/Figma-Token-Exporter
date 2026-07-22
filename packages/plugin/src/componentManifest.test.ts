import { expect, it } from "vitest";
import { createComponentManifest, createFrameManifest, frameManifestFiles, variableIdsFromBindings } from "./componentManifest.js";

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

it("creates a compact token usage map for a frame", () => {
  expect(createFrameManifest("Home", [
    { name: "spacing/md", usedBy: ["Home / Button"] },
    { name: "color/primary", usedBy: ["Home / Card", "Home"] }
  ])).toEqual({
    frame: "Home",
    tokens: {
      "color/primary": [".", "Card"],
      "spacing/md": ["Button"]
    }
  });
});

it("preserves every token and full path through the compact conversion", () => {
  const original = [
    { name: "Background/Normal", usedBy: ["Dgit", "Dgit / Bottom tab view"] },
    { name: "Label/Strong", usedBy: ["Dgit / Date picker / Frame 963"] }
  ];
  const compact = createFrameManifest("Dgit", original);
  const restored = Object.entries(compact.tokens).flatMap(([name, paths]) => paths.map((path) => [name, path === "." ? compact.frame : `${compact.frame} / ${path}`])).sort();
  const expected = original.flatMap(({ name, usedBy }) => usedBy.map((path) => [name, path])).sort();
  expect(restored).toEqual(expected);
});

it("keeps every selected frame when ZIP filenames collide", () => {
  const files = frameManifestFiles([
    { frame: "Web", tokens: {} },
    { frame: "Web", tokens: { "color/primary": ["."] } },
    { frame: "A/B", tokens: {} },
    { frame: "A:B", tokens: {} }
  ]);

  expect(Object.keys(files)).toEqual([
    "frames/token-usage-Web.json",
    "frames/token-usage-Web-2.json",
    "frames/token-usage-A-B.json",
    "frames/token-usage-A-B-2.json"
  ]);
  expect(JSON.parse(files["frames/token-usage-Web-2.json"])).toMatchObject({ frame: "Web", tokens: { "color/primary": ["."] } });
});
