import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENVIRONMENT_BY_ID } from "../../config/environments.ts";
import { selectBestRoute, selectRoutes } from "../../routing/routeSelectors.ts";
import { applySimulationAction, createInitialEnvironmentState } from "../../simulation/engine.ts";
import { createSceneModel } from "./sceneModel.ts";
import { forestElevation } from "../../domain/terrain.ts";

describe("digital twin view model", () => {
  it("keeps every forest route above the terrain between waypoints without changing routing data", () => {
    const state = createInitialEnvironmentState(ENVIRONMENT_BY_ID["forest-north"]);
    for (const origin of state.definition.waypoints) {
      for (const route of selectRoutes(state, origin.id)) {
        const original = structuredClone(route);
        const points = createSceneModel(state, route).routePoints;
        for (let index = 1; index < points.length; index += 1) {
          const a = points[index - 1];
          const b = points[index];
          for (let step = 0; step <= 20; step += 1) {
            const t = step / 20;
            const x = a[0] + (b[0] - a[0]) * t;
            const y = a[1] + (b[1] - a[1]) * t;
            const z = a[2] + (b[2] - a[2]) * t;
            assert.ok(y - forestElevation(x, z) >= .3, `${route.id}: route intersects terrain at ${x}, ${z}`);
          }
        }
        for (const waypoint of original.points) assert.ok(points.some((point) => point[0] === waypoint[0] && point[2] === waypoint[2]));
        assert.deepEqual(route, original);
      }
    }
    assert.deepEqual(createSceneModel(state, null).routePoints, []);
  });

  it("derives synchronized markers, mesh links and graph-following route points", () => {
    const state = createInitialEnvironmentState(ENVIRONMENT_BY_ID["building-a"]);
    const route = selectBestRoute(selectRoutes(state, "office-a"));
    const model = createSceneModel(state, route);

    assert.deepEqual(model.sensors, state.sensors);
    assert.deepEqual(model.rooms, state.definition.rooms);
    assert.ok(model.networkLinks.length > 0);
    assert.deepEqual(model.routePoints, route?.points);
  });

  it("shows confirmed visual fire separately from sensor readings", () => {
    const initial = createInitialEnvironmentState(ENVIRONMENT_BY_ID["forest-north"]);
    const state = applySimulationAction(initial, { type: "confirm-fire", sensorId: "N-03" });
    const model = createSceneModel(state, null);

    assert.equal(model.hazards[0]?.kind, "simulated-fire");
    assert.equal(model.hazards[0]?.visualOnly, true);
    assert.equal(model.sensors.find((sensor) => sensor.id === "N-03")?.status, "critical");
    const point = model.hazards[0].position;
    assert.equal(point[1], forestElevation(point[0], point[2]) + .06);
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

    const coolVisual = createSceneModel(coolHumid, null).hazards[0]?.visual;
    const hotVisual = createSceneModel(hotDry, null).hazards[0]?.visual;
    assert.ok(coolVisual);
    assert.ok(hotVisual);
    assert.ok(hotVisual.intensity > coolVisual.intensity);
    assert.ok(hotVisual.radius > coolVisual.radius);
    assert.ok(hotVisual.flameHeight > coolVisual.flameHeight);
    assert.ok(hotVisual.smokeOpacity > coolVisual.smokeOpacity);
  });

  it("keeps indoor fire meshes positioned on their source floor in the whole building", () => {
    const initial = createInitialEnvironmentState(ENVIRONMENT_BY_ID["building-a"]);
    const fire = applySimulationAction(initial, { type: "confirm-fire", sensorId: initial.definition.fireSensorId });

    assert.equal(createSceneModel(fire, null).hazards.length, 1);
    assert.equal(createSceneModel(fire, null).hazards[0].position[1], initial.definition.floors[0].elevation + .2);
  });
});
