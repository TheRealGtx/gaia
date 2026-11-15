import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isLiveEnabled } from "./features.ts";

describe("live feature flag", () => {
  it("is on unless the build says off", () => {
    assert.equal(isLiveEnabled(undefined), true);
    assert.equal(isLiveEnabled(""), true);
    assert.equal(isLiveEnabled("on"), true);
    assert.equal(isLiveEnabled("off"), false);
    assert.equal(isLiveEnabled(" OFF "), false);
  });
});
