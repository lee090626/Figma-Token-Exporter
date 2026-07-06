import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchFigmaVariables } from "./fetchFigmaVariables.js";

describe("fetchFigmaVariables", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    [403, "file_variables:read"],
    [429, "rate limit"]
  ])("maps status %i without exposing the token", async (status, message) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status }));
    await expect(fetchFigmaVariables("file", "secret-token")).rejects.toThrow(message);
    await expect(fetchFigmaVariables("file", "secret-token")).rejects.not.toThrow("secret-token");
  });
});
