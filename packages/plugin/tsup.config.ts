import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/code.ts"],
  format: ["iife"],
  clean: true,
  noExternal: ["@lee090626/core"],
  platform: "browser"
});
