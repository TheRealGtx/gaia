import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deriveHazardGradient,
  deriveLiveHazardGradient,
  gradientFieldColor,
  liveGradientStateLabel,
  selectSimulatedHazardSources,
} from "./hazardGradient.ts";
import { ENVIRONMENT_BY_ID } from "../config/environments.ts";
import { applySimulationAction, createInitialEnvironmentState } from "../simulation/engine.ts";

describe("hazard gradient", () => {
  it("assigns hop levels from the fire source using only active reachable links", () => {
    const model = deriveHazardGradient({
      sensorIds: ["fire", "near", "far", "isolated", "offline"],
      sourceId: "fire",
      offlineSensorIds: ["offline"],
      connections: [
        { sourceId: "fire", targetId: "near", active: true },
        { sourceId: "near", targetId: "far", active: true },
        { sourceId: "far", targetId: "isolated", active: false },
        { sourceId: "fire", targetId: "offline", active: true },
      ],
    });

    assert.deepEqual(
      Object.fromEntries(model.nodes.map((node) => [node.sensorId, node.level])),
      { fire: 0, near: 1, far: 2, isolated: null, offline: null },
    );
    assert.equal(model.maxLevel, 2);
  });

  it("uses the ScaFi-inspired red-to-cyan field palette", () => {
    assert.equal(gradientFieldColor(0, 4, false), "#ff2020");
    assert.equal(gradientFieldColor(4, 4, false), "#22d3dd");
    assert.equal(gradientFieldColor(null, 4, true), "#64748b");
    assert.notEqual(gradientFieldColor(2, 4, false), gradientFieldColor(0, 4, false));
  });

  it("shows every available node as safe blue when no hazard source exists", () => {
    assert.equal(gradientFieldColor(null, 0, false, false), "#22d3dd");
    assert.equal(gradientFieldColor(null, 0, true, false), "#64748b");
  });

  it("does not invent a heat source in a nominal simulation", () => {
    const initial = createInitialEnvironmentState(ENVIRONMENT_BY_ID["forest-north"]);
    assert.deepEqual(selectSimulatedHazardSources(initial), []);

    const alarm = applySimulationAction(initial, { type: "confirm-fire", sensorId: initial.definition.fireSensorId });
    assert.deepEqual(selectSimulatedHazardSources(alarm), [initial.definition.fireSensorId]);
  });

  it("uses network-reported distance in live mode and leaves 99 unknown", () => {
    const model = deriveLiveHazardGradient([
      { sensorId: "source", distance: 0, offline: false, alert: false },
      { sensorId: "safe", distance: 2, offline: false, alert: false },
      { sensorId: "unknown", distance: 99, offline: false, alert: false },
    ], [{ sourceId: "source", targetId: "safe", active: true }]);
    assert.deepEqual(Object.fromEntries(model.nodes.map((node) => [node.sensorId, node.level])), { source: 0, safe: 2, unknown: null });
    assert.equal(model.maxLevel, 2);
  });

  it("treats a network alert as a hazard source even when distance is 99", () => {
    const model = deriveLiveHazardGradient([
      { sensorId: "alert", distance: 99, offline: false, alert: true },
      { sensorId: "split", distance: 99, offline: false, alert: false },
    ], []);

    assert.equal(model.sourceId, "alert");
    assert.deepEqual(Object.fromEntries(model.nodes.map((node) => [node.sensorId, node.level])), {
      alert: 0,
      split: null,
    });
  });

  it("describes distance 99 as nominal until a hazard source exists", () => {
    assert.equal(liveGradientStateLabel(null, false, false), "nominal, no active hazard");
    assert.equal(liveGradientStateLabel(null, false, true), "hazard path unknown");
    assert.equal(liveGradientStateLabel(null, true, false), "offline");
  });
});
