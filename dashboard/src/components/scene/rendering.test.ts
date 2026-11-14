import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PCFShadowMap } from "three";
import { advanceAnimationTime, calculateSceneViewOffset, DEFAULT_SHADOW_MAP, sensorMarkerColor } from "./rendering.ts";

describe("Three.js rendering configuration", () => {
  it("uses the supported PCF shadow map", () => {
    assert.equal(DEFAULT_SHADOW_MAP, PCFShadowMap);
  });

  it("advances animations from frame deltas without relying on the deprecated Clock API", () => {
    assert.equal(advanceAnimationTime(2.5, 0.016), 2.516);
  });

  it("shifts the scene toward the free area only while the desktop overlay is open", () => {
    assert.equal(calculateSceneViewOffset(true, 1440), -227);
    assert.equal(calculateSceneViewOffset(true, 1000), -172);
    assert.equal(calculateSceneViewOffset(false, 1440), 0);
    assert.equal(calculateSceneViewOffset(true, 600), 0);
  });

  it("renders normal sensors in high-visibility blue without changing alert colors", () => {
    assert.equal(sensorMarkerColor("normal"), "#2563eb");
    assert.equal(sensorMarkerColor("warning"), "#f59e0b");
    assert.equal(sensorMarkerColor("critical"), "#ef4444");
  });
});
