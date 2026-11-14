import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveTheme, resolveThemePreference } from "./theme.ts";

describe("theme preference", () => {
  it("restores valid saved preferences and defaults to the system", () => {
    assert.equal(resolveThemePreference("dark"), "dark");
    assert.equal(resolveThemePreference("system"), "system");
    assert.equal(resolveThemePreference(null), "system");
    assert.equal(resolveThemePreference("unexpected"), "system");
  });

  it("resolves the system preference while preserving explicit choices", () => {
    assert.equal(resolveTheme("system", true), "dark");
    assert.equal(resolveTheme("system", false), "light");
    assert.equal(resolveTheme("light", true), "light");
    assert.equal(resolveTheme("dark", false), "dark");
  });
});
