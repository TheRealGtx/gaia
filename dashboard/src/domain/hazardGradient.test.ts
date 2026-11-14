import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deriveHazardGradient,
  deriveLiveHazardGradient,
  gradientFieldColor,
  layoutGradientSensors,
  selectSimulatedHazardSource,
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

  it("places the fire source at the upper-left of the layered map", () => {
    const model = deriveHazardGradient({
      sensorIds: ["fire", "near-a", "near-b", "far"],
      sourceId: "fire",
      offlineSensorIds: [],
      connections: [
        { sourceId: "fire", targetId: "near-a", active: true },
        { sourceId: "fire", targetId: "near-b", active: true },
        { sourceId: "near-a", targetId: "far", active: true },
      ],
    });

    const source = model.nodes.find((node) => node.sensorId === "fire");
    const reachable = model.nodes.filter((node) => node.level !== null && node.sensorId !== "fire");
    assert.deepEqual([source?.x, source?.y], [8, 16]);
    assert.equal(reachable.every((node) => node.x > (source?.x ?? 100)), true);
  });

  it("projects outdoor sensors into a padded spatial field", () => {
    const layout = layoutGradientSensors([
      { id: "north-west", position: [-30, 1, -20] },
      { id: "north-east", position: [30, 1, -20] },
      { id: "south-west", position: [-30, 1, 20] },
      { id: "south-east", position: [30, 1, 20] },
    ]);

    assert.ok(layout["north-west"].x < layout["north-east"].x);
    assert.ok(layout["north-west"].y < layout["south-west"].y);
    assert.equal(Object.values(layout).every(({ x, y }) => x >= 7 && x <= 93 && y >= 7 && y <= 93), true);
  });

  it("separates building floors into ground-first horizontal bands", () => {
    const layout = layoutGradientSensors([
      { id: "ground", position: [0, 1, 0], floorId: "level-1" },
      { id: "upper", position: [0, 6, 0], floorId: "level-2" },
    ]);

    assert.ok(layout.ground.y < layout.upper.y);
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
    assert.equal(selectSimulatedHazardSource(initial), null);

    const alarm = applySimulationAction(initial, { type: "confirm-fire", sensorId: initial.definition.fireSensorId });
    assert.equal(selectSimulatedHazardSource(alarm), initial.definition.fireSensorId);
  });

  it("uses network-reported distance in live mode and leaves 99 unknown", () => {
    const model = deriveLiveHazardGradient([
      { sensorId: "source", distance: 0, offline: false },
      { sensorId: "safe", distance: 2, offline: false },
      { sensorId: "unknown", distance: 99, offline: false },
    ], [{ sourceId: "source", targetId: "safe", active: true }]);
    assert.deepEqual(Object.fromEntries(model.nodes.map((node) => [node.sensorId, node.level])), { source: 0, safe: 2, unknown: null });
    assert.equal(model.maxLevel, 2);
  });
});
