import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PCFShadowMap } from "three";
import * as rendering from "./rendering.ts";

const { advanceAnimationTime, calculateSceneViewOffset, DEFAULT_SHADOW_MAP, sensorMarkerColor } = rendering;

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

  it("moves the scene view offset monotonically and snaps when it reaches the target", () => {
    assert.equal(typeof rendering.interpolateSceneViewOffset, "function");
    const first = rendering.interpolateSceneViewOffset!(0, -200, .016);
    assert.ok(first < 0 && first > -200);
    const second = rendering.interpolateSceneViewOffset!(first, -200, .016);
    assert.ok(second < first && second > -200);
    assert.equal(rendering.interpolateSceneViewOffset!(-199.8, -200, .016), -200);
  });

  it("reapplies the initial scene offset when the camera projection was cleared during mounting", () => {
    assert.equal(typeof rendering.resolveSceneViewOffsetFrame, "function");
    assert.deepEqual(rendering.resolveSceneViewOffsetFrame!(-227, -227, .016, false), {
      offset: -227,
      apply: true,
    });
    assert.deepEqual(rendering.resolveSceneViewOffsetFrame!(-227, -227, .016, true), {
      offset: -227,
      apply: false,
    });
  });

  it("renders normal sensors in high-visibility blue without changing alert colors", () => {
    assert.equal(sensorMarkerColor("normal"), "#2563eb");
    assert.equal(sensorMarkerColor("warning"), "#f59e0b");
    assert.equal(sensorMarkerColor("critical"), "#ef4444");
  });
});
