import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENVIRONMENT_BY_ID } from "../config/environments.ts";
import { createInitialEnvironmentState } from "../simulation/engine.ts";
import { selectRoutes } from "./routeSelectors.ts";

// Gap analysis P0.2: in Live mode the only guidance on screen is the nodes'
// escape_to. A browser-computed route must never appear next to it.
describe("guidance source", () => {
  for (const id of ["building-a", "forest-north"] as const) {
    it(`${id}: a simulation state still gets its what-if routes`, () => {
      const state = createInitialEnvironmentState(ENVIRONMENT_BY_ID[id]);
      const origin = id === "building-a" ? "office-a" : state.sensors[0].id;
      assert.ok(selectRoutes(state, origin).length > 0);
    });

    it(`${id}: a live snapshot produces no browser route`, () => {
      const initial = createInitialEnvironmentState(ENVIRONMENT_BY_ID[id]);
      const live = { ...initial, source: "live" as const };
      for (const origin of ["office-a", ...initial.sensors.map((sensor) => sensor.id)]) {
        assert.deepEqual(selectRoutes(live, origin), [], origin);
      }
    });
  }
});
