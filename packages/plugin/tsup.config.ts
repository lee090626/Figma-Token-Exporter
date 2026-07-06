import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/code.ts"],
  format: ["iife"],
  clean: true,
  noExternal: ["@figma-token/core"],
  platform: "browser"
});
