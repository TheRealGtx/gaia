import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENVIRONMENT_BY_ID } from "../config/environments.ts";
import { applySimulationAction, createInitialEnvironmentState } from "./engine.ts";
import { deriveHazardGradient, selectSimulatedHazardSources } from "../domain/hazardGradient.ts";
import { selectRoutes } from "../routing/routeSelectors.ts";
import { createSceneModel } from "../components/scene/sceneModel.ts";
import { generateIntelligenceSummary } from "../components/operations/intelligence.ts";

describe("multiple simulated fires", () => {
  it("keeps neighbouring sources critical, avoids duplicates and resets every fire", () => {
    const initial = createInitialEnvironmentState(ENVIRONMENT_BY_ID["forest-north"]);
    const firstId = initial.sensors[0].id;
    const secondId = initial.sensors[0].neighbourIds[0];
    const first = applySimulationAction(initial, { type: "confirm-fire", sensorId: firstId });
    const second = applySimulationAction(first, { type: "confirm-fire", sensorId: secondId });
    assert.equal(second.hazards.length, 2);
    assert.equal(second.alerts.filter((alert) => alert.confirmed).length, 2);
    for (const id of [firstId, secondId]) assert.equal(second.sensors.find((sensor) => sensor.id === id)?.status, "critical");
    assert.equal(applySimulationAction(second, { type: "confirm-fire", sensorId: secondId }), second);
    const hotter = applySimulationAction(second, { type: "increase-temperature", sensorId: firstId, delta: 5 });
    assert.equal(hotter.sensors.find((sensor) => sensor.id === firstId)?.status, "critical");
    assert.equal(hotter.hazards.length, 2);
    assert.equal(createSceneModel(second, null, "all").hazards.length, 2);
    assert.match(generateIntelligenceSummary(second, null), /2 simulated fires/);
    assert.deepEqual(selectSimulatedHazardSources(second), [firstId, secondId]);
    const reset = applySimulationAction(second, { type: "reset" });
    assert.equal(reset.hazards.length, 0);
    assert.equal(reset.alerts.length, 0);
    assert.ok(reset.sensors.every((sensor) => sensor.status === "normal"));
  });

  it("measures hop distance from the nearest active fire", () => {
    const ids = ["a", "b", "c", "d", "e"];
    const model = deriveHazardGradient({
      sensorIds: ids, sourceId: null, sourceIds: ["a", "e", "a", "missing"], offlineSensorIds: [],
      connections: ids.slice(1).map((id, index) => ({ sourceId: ids[index], targetId: id, active: true })),
    });
    assert.deepEqual(model.nodes.map((node) => node.level), [0, 1, 2, 1, 0]);
  });

  it("connects all four forest exits and routes around both fire locations", () => {
    const initial = createInitialEnvironmentState(ENVIRONMENT_BY_ID["forest-north"]);
    const origin = initial.definition.defaultOriginId;
    const routes = selectRoutes(initial, origin);
    assert.equal(routes.length, 4);
    assert.deepEqual(new Set(routes.map((route) => route.exitId)), new Set(initial.definition.exits.map((exit) => exit.id)));
    const first = applySimulationAction(initial, { type: "confirm-fire", sensorId: "N-01" });
    const second = applySimulationAction(first, { type: "confirm-fire", sensorId: "N-06" });
    const forbidden = new Set(second.hazards.flatMap((hazard) => hazard.vertexIds));
    const available = selectRoutes(second, origin);
    assert.ok(available.length > 0);
    for (const route of available) assert.ok(route.vertexIds.every((id) => id === origin || !forbidden.has(id)));
  });
});
