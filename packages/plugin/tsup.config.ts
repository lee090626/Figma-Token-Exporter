import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/code.ts"],
  format: ["iife"],
  clean: true,
  noExternal: ["@figma-token-pr/core"],
  platform: "browser"
});
