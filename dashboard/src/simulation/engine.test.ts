import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENVIRONMENT_BY_ID } from "../config/environments.ts";
import { applySimulationAction, createInitialEnvironmentState } from "./engine.ts";

describe("simulation engine", () => {
  it("raises a reading without fabricating a confirmed fire", () => {
    const initial = createInitialEnvironmentState(ENVIRONMENT_BY_ID["building-a"]);
    const result = applySimulationAction(initial, { type: "increase-temperature", sensorId: "A-02", delta: 12 });
    const sensor = result.sensors.find((item) => item.id === "A-02")!;

    assert.equal(sensor.reading.temperature, 36);
    assert.equal(sensor.status, "warning");
    assert.equal(result.hazards.length, 0);
    assert.equal(result.alerts.some((alert) => alert.kind === "network-confirmed"), false);
  });

  it("creates a local anomaly without a visual fire", () => {
    const initial = createInitialEnvironmentState(ENVIRONMENT_BY_ID["building-a"]);
    const result = applySimulationAction(initial, { type: "simulate-anomaly", sensorId: "A-04" });

    assert.equal(result.alerts[0]?.kind, "local-anomaly");
    assert.equal(result.alerts[0]?.confirmed, false);
    assert.equal(result.hazards.some((hazard) => hazard.kind === "simulated-fire"), false);
  });

  it("adds a confirmed simulated fire distinctly from measurements", () => {
    const initial = createInitialEnvironmentState(ENVIRONMENT_BY_ID["building-a"]);
    const result = applySimulationAction(initial, { type: "confirm-fire", sensorId: "A-04" });

    assert.equal(result.sensors.find((sensor) => sensor.id === "A-04")?.status, "critical");
    assert.equal(result.hazards[0]?.kind, "simulated-fire");
    assert.equal(result.hazards[0]?.visualOnly, true);
    assert.equal(result.alerts.some((alert) => alert.kind === "network-confirmed"), true);
  });

  it("combines fire, blockage and offline node then restores the initial state", () => {
    const initial = createInitialEnvironmentState(ENVIRONMENT_BY_ID["building-a"]);
    const fire = applySimulationAction(initial, { type: "confirm-fire", sensorId: "A-04" });
    const blocked = applySimulationAction(fire, { type: "block-edge", edgeId: "atrium-south" });
    const combined = applySimulationAction(blocked, { type: "disable-node", sensorId: "A-03" });

    assert.deepEqual(combined.blockedEdgeIds, ["atrium-south"]);
    assert.equal(combined.sensors.find((sensor) => sensor.id === "A-03")?.status, "offline");
    assert.equal(combined.hazards.length, 2);

    const reset = applySimulationAction(combined, { type: "reset" });
    assert.equal(reset.hazards.length, 0);
    assert.equal(reset.alerts.length, 0);
    assert.equal(reset.blockedEdgeIds.length, 0);
    assert.equal(reset.sensors.every((sensor) => sensor.status === "normal"), true);
  });
});
