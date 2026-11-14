import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENVIRONMENT_BY_ID } from "../../config/environments.ts";
import { selectBestRoute, selectRoutes } from "../../routing/routeSelectors.ts";
import { applySimulationAction, createInitialEnvironmentState } from "../../simulation/engine.ts";
import { createSceneModel } from "./sceneModel.ts";

describe("digital twin view model", () => {
  it("derives synchronized markers, mesh links and graph-following route points", () => {
    const state = createInitialEnvironmentState(ENVIRONMENT_BY_ID["building-a"]);
    const route = selectBestRoute(selectRoutes(state, "office-a"));
    const model = createSceneModel(state, route, "level-1");

    assert.equal(model.sensors.every((sensor) => sensor.floorId === "level-1"), true);
    assert.ok(model.networkLinks.length > 0);
    assert.deepEqual(model.routePoints, route?.points);
  });

  it("shows confirmed visual fire separately from sensor readings", () => {
    const initial = createInitialEnvironmentState(ENVIRONMENT_BY_ID["forest-north"]);
    const state = applySimulationAction(initial, { type: "confirm-fire", sensorId: "N-03" });
    const model = createSceneModel(state, null, "all");

    assert.equal(model.hazards[0]?.kind, "simulated-fire");
    assert.equal(model.hazards[0]?.visualOnly, true);
    assert.equal(model.sensors.find((sensor) => sensor.id === "N-03")?.status, "critical");
  });

  it("scales the fire mesh from the source sensor temperature and humidity", () => {
    const initial = createInitialEnvironmentState(ENVIRONMENT_BY_ID["building-a"]);
    const fire = applySimulationAction(initial, { type: "confirm-fire", sensorId: initial.definition.fireSensorId });
    const sourceId = initial.definition.fireSensorId;
    const coolHumid = {
      ...fire,
      sensors: fire.sensors.map((sensor) => sensor.id === sourceId
        ? { ...sensor, reading: { ...sensor.reading, temperature: 44, humidity: 58 } }
        : sensor),
    };
    const hotDry = {
      ...fire,
      sensors: fire.sensors.map((sensor) => sensor.id === sourceId
        ? { ...sensor, reading: { ...sensor.reading, temperature: 94, humidity: 9 } }
        : sensor),
    };

    const coolVisual = createSceneModel(coolHumid, null, "all").hazards[0]?.visual;
    const hotVisual = createSceneModel(hotDry, null, "all").hazards[0]?.visual;
    assert.ok(coolVisual);
    assert.ok(hotVisual);
    assert.ok(hotVisual.intensity > coolVisual.intensity);
    assert.ok(hotVisual.radius > coolVisual.radius);
    assert.ok(hotVisual.flameHeight > coolVisual.flameHeight);
    assert.ok(hotVisual.smokeOpacity > coolVisual.smokeOpacity);
  });

  it("only shows an indoor fire mesh on the floor containing its source sensor", () => {
    const initial = createInitialEnvironmentState(ENVIRONMENT_BY_ID["building-a"]);
    const fire = applySimulationAction(initial, { type: "confirm-fire", sensorId: initial.definition.fireSensorId });

    assert.equal(createSceneModel(fire, null, "level-1").hazards.length, 1);
    assert.equal(createSceneModel(fire, null, "level-4").hazards.length, 0);
    assert.equal(createSceneModel(fire, null, "all").hazards.length, 1);
  });
});
