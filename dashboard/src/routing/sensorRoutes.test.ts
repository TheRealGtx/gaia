import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENVIRONMENT_BY_ID } from "../config/environments.ts";
import { applySimulationAction, createInitialEnvironmentState } from "../simulation/engine.ts";
import { selectRoutes } from "./routeSelectors.ts";
import { appReducer, createInitialAppState } from "../state/appReducer.ts";
import { forestElevation } from "../domain/terrain.ts";
import type { Vector3Tuple } from "../domain/types.ts";

describe("evacuation from a selected forest sensor", () => {
  it("starts at every selected sensor, reaches an exit and leaves the shared graph unchanged", () => {
    const state = createInitialEnvironmentState(ENVIRONMENT_BY_ID["forest-north"]);
    const original = structuredClone(state.definition.routeGraph);
    for (const sensor of state.sensors) {
      const routes = selectRoutes(state, sensor.id);
      assert.ok(routes.length > 0, sensor.id);
      for (const route of routes) {
        assert.equal(route.originId, sensor.id);
        assert.equal(route.points[0][0], sensor.position[0]);
        assert.equal(route.points[0][2], sensor.position[2]);
        const exit = state.definition.exits.find((item) => item.id === route.exitId)!;
        assert.deepEqual(route.points.at(-1), exit.position);
        assert.ok(route.distance > 0);
      }
    }
    assert.deepEqual(state.definition.routeGraph, original);
  });

  it("allows escape from a burning source and avoids another fire", () => {
    const initial = createInitialEnvironmentState(ENVIRONMENT_BY_ID["forest-north"]);
    const first = applySimulationAction(initial, { type: "confirm-fire", sensorId: "N-20" });
    const state = applySimulationAction(first, { type: "confirm-fire", sensorId: "N-06" });
    const routes = selectRoutes(state, "N-20");
    assert.ok(routes.length > 0);
    const other = state.hazards.find((hazard) => hazard.sourceSensorId === "N-06")!;
    const source = state.hazards.find((hazard) => hazard.sourceSensorId === "N-20")!;
    for (const route of routes) {
      assert.equal(route.status, "affected");
      assert.ok(route.vertexIds.every((id) => !other.vertexIds.includes(id)));
      let escaped = false;
      for (let i = 1; i < route.points.length; i += 1) {
        const a = route.points[i - 1], b = route.points[i];
        for (let step = 0; step <= 40; step += 1) {
          const t = step / 40;
          assert.ok(Math.hypot(a[0] + (b[0] - a[0]) * t - other.position[0], a[2] + (b[2] - a[2]) * t - other.position[2]) > other.radius);
          const outsideSource = Math.hypot(a[0] + (b[0] - a[0]) * t - source.position[0], a[2] + (b[2] - a[2]) * t - source.position[2]) > source.radius;
          if (escaped) assert.ok(outsideSource, "route must not re-enter the starting fire");
          escaped ||= outsideSource;
        }
      }
      assert.ok(escaped);
    }
  });

  it("prefers lower risk, then the closest exit, including the approach from the sensor", () => {
    const initial = createInitialEnvironmentState(ENVIRONMENT_BY_ID["forest-north"]);
    const point = (x: number, z = 0): Vector3Tuple => [x, forestElevation(x, z) + .35, z];
    const vertices = [-10, 0, 10].map((x, index) => ({ id: `v${index}`, name: `Waypoint ${index}`, kind: "trail" as const, position: point(x) }));
    const edges = [0, 1].map((index) => ({ id: `e${index}`, from: `v${index}`, to: `v${index + 1}`, points: [vertices[index].position, vertices[index + 1].position], distance: 10, risk: index === 0 ? 10 : 0, bidirectional: true }));
    const state = {
      ...initial,
      sensors: [{ ...initial.sensors[0], position: point(-2, 2) }],
      definition: { ...initial.definition, routeGraph: { vertices, edges }, exits: [0, 2].map((index) => ({ id: `exit${index}`, name: `Exit ${index}`, waypointId: `v${index}`, position: vertices[index].position })) },
    };
    assert.equal(selectRoutes(state, state.sensors[0].id)[0].exitId, "exit2");
    const equalRisk = { ...state, definition: { ...state.definition, routeGraph: { vertices, edges: edges.map((edge) => ({ ...edge, risk: 0 })) } } };
    const best = selectRoutes(equalRisk, state.sensors[0].id)[0];
    assert.equal(best.exitId, "exit0");
    assert.ok(best.distance >= 10, "distance includes the two-metre approach and eight-metre trail");
  });

  it("returns no route when every trail is blocked or the sensor is missing", () => {
    const initial = createInitialEnvironmentState(ENVIRONMENT_BY_ID["forest-north"]);
    const blocked = { ...initial, blockedEdgeIds: initial.definition.routeGraph.edges.map((edge) => edge.id) };
    assert.deepEqual(selectRoutes(blocked, "N-20"), []);
    assert.deepEqual(selectRoutes(initial, "missing-sensor"), []);
    const burning = applySimulationAction(initial, { type: "confirm-fire", sensorId: "N-20" });
    const surrounded = { ...burning, hazards: burning.hazards.map((hazard) => ({ ...hazard, radius: 100 })) };
    assert.deepEqual(selectRoutes(surrounded, "N-20"), []);
  });

  it("keeps the route origin synchronized on selection, environment switches and mode changes", () => {
    const initial = createInitialAppState();
    assert.equal(initial.selectedOriginId, initial.selectedSensorId);
    const selected = appReducer(initial, { type: "select-sensor", sensorId: "N-06" });
    assert.equal(selected.selectedOriginId, "N-06");
    const building = appReducer(selected, { type: "select-environment", environmentId: "building-a" });
    const forest = appReducer(building, { type: "select-environment", environmentId: "forest-north" });
    assert.equal(forest.selectedOriginId, forest.selectedSensorId);
    const live = appReducer(selected, { type: "set-mode", mode: "live" });
    assert.equal(live.selectedOriginId, "");
    const reset = appReducer(live, { type: "set-mode", mode: "simulation" });
    assert.equal(reset.selectedOriginId, reset.selectedSensorId);
  });
});
