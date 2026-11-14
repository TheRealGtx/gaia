import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENVIRONMENT_BY_ID } from "../../config/environments.ts";
import { selectBestRoute, selectRoutes } from "../../routing/routeSelectors.ts";
import { applySimulationAction, createInitialEnvironmentState } from "../../simulation/engine.ts";
import { generateIntelligenceSummary } from "./intelligence.ts";

describe("Gaia Intelligence", () => {
  it("labels deterministic simulation output without claiming Gemma inference", () => {
    const initial = createInitialEnvironmentState(ENVIRONMENT_BY_ID["building-a"]);
    const state = applySimulationAction(initial, { type: "confirm-fire", sensorId: "A-04" });
    const route = selectBestRoute(selectRoutes(state, "office-a"));
    const summary = generateIntelligenceSummary(state, route);

    assert.match(summary, /simulated/i);
    assert.match(summary, /neighbour/i);
    assert.doesNotMatch(summary, /Gemma generated/i);
  });

  it("explicitly reports when no route is available", () => {
    const initial = createInitialEnvironmentState(ENVIRONMENT_BY_ID["building-a"]);
    const blocked = { ...initial, blockedEdgeIds: ["atrium-south", "west-north"] };
    const summary = generateIntelligenceSummary(blocked, null);
    assert.match(summary, /No available route/i);
  });
});
