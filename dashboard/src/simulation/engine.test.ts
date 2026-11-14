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

  it("automatically confirms a fire when repeated temperature increases reach 78 degrees", () => {
    let result = createInitialEnvironmentState(ENVIRONMENT_BY_ID["building-a"]);
    for (let index = 0; index < 11; index += 1) {
      result = applySimulationAction(result, { type: "increase-temperature", sensorId: "A-02", delta: 5 });
    }

    const sensor = result.sensors.find((item) => item.id === "A-02")!;
    assert.ok((sensor.reading.temperature ?? 0) >= 78);
    assert.equal(sensor.status, "critical");
    assert.equal(result.hazards.filter((hazard) => hazard.kind === "simulated-fire").length, 1);
    assert.equal(result.alerts.filter((alert) => alert.kind === "network-confirmed").length, 1);
  });

  it("keeps increasing the source temperature without reconfirming an active fire", () => {
    const initial = createInitialEnvironmentState(ENVIRONMENT_BY_ID["building-a"]);
    const fire = applySimulationAction(initial, { type: "increase-temperature", sensorId: "A-02", delta: 55 });
    const source = fire.sensors.find((item) => item.id === "A-02")!;
    const neighbourId = source.neighbourIds[0];
    const neighbourTemperature = fire.sensors.find((item) => item.id === neighbourId)?.reading.temperature;

    const hotter = applySimulationAction(fire, { type: "increase-temperature", sensorId: "A-02", delta: 5 });

    assert.equal(hotter.sensors.find((item) => item.id === "A-02")?.reading.temperature, 84);
    assert.equal(hotter.sensors.find((item) => item.id === neighbourId)?.reading.temperature, neighbourTemperature);
    assert.equal(hotter.hazards.filter((hazard) => hazard.kind === "simulated-fire").length, 1);
    assert.equal(hotter.alerts.filter((alert) => alert.kind === "network-confirmed").length, 1);
  });

  it("restores a disabled sensor and its mesh links without resetting other scenarios", () => {
    const initial = createInitialEnvironmentState(ENVIRONMENT_BY_ID["building-a"]);
    const fire = applySimulationAction(initial, { type: "confirm-fire", sensorId: "A-04" });
    const blocked = applySimulationAction(fire, { type: "block-edge", edgeId: "atrium-south" });
    const disabled = applySimulationAction(blocked, { type: "disable-node", sensorId: "A-04" });
    const repeated = applySimulationAction(disabled, { type: "disable-node", sensorId: "A-04" });
    const restored = applySimulationAction(repeated, { type: "enable-node", sensorId: "A-04" });

    assert.equal(disabled.sensors.find((sensor) => sensor.id === "A-04")?.reading.temperature, null);
    assert.deepEqual(restored.sensors, blocked.sensors);
    assert.deepEqual(restored.topology, blocked.topology);
    assert.deepEqual(restored.hazards, blocked.hazards);
    assert.deepEqual(restored.alerts, blocked.alerts);
    assert.deepEqual(restored.blockedEdgeIds, blocked.blockedEdgeIds);
    assert.equal(applySimulationAction(restored, { type: "enable-node", sensorId: "A-04" }), restored);
  });

  it("recovers a network fault only after all affected sensors are enabled", () => {
    const initial = createInitialEnvironmentState(ENVIRONMENT_BY_ID["building-a"]);
    const failed = applySimulationAction(initial, { type: "network-failure", sensorIds: ["A-02", "A-03"] });
    const partial = applySimulationAction(failed, { type: "enable-node", sensorId: "A-02" });
    assert.equal(partial.connection, "reconnecting");
    assert.equal(partial.sensors.find((sensor) => sensor.id === "A-03")?.status, "offline");
    const recovered = applySimulationAction(partial, { type: "enable-node", sensorId: "A-03" });
    assert.equal(recovered.connection, "connected");
    assert.deepEqual(recovered.sensors, initial.sensors);
  });

  it("does not apply temperature or fire injections to a disabled sensor", () => {
    const initial = createInitialEnvironmentState(ENVIRONMENT_BY_ID["building-a"]);
    const disabled = applySimulationAction(initial, { type: "disable-node", sensorId: "A-04" });
    assert.equal(applySimulationAction(disabled, { type: "increase-temperature", sensorId: "A-04", delta: 5 }), disabled);
    assert.equal(applySimulationAction(disabled, { type: "confirm-fire", sensorId: "A-04" }), disabled);
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
