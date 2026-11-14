import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENVIRONMENT_BY_ID } from "../config/environments.ts";
import { createInitialEnvironmentState } from "../simulation/engine.ts";
import { selectEnvironmentMetrics } from "./selectors.ts";

describe("environment telemetry metrics", () => {
  it("derives the observed temperature range and active-link ratio from reporting data", () => {
    const initial = createInitialEnvironmentState(ENVIRONMENT_BY_ID["building-a"]);
    const state = {
      ...initial,
      sensors: initial.sensors.map((sensor, index) => ({
        ...sensor,
        status: index < 3 ? "normal" as const : "offline" as const,
        reading: { ...sensor.reading, temperature: index < 3 ? [10, 20, 30][index] : 99 },
      })),
      topology: {
        ...initial.topology,
        connections: initial.topology.connections.slice(0, 3).map((connection, index) => ({
          ...connection,
          active: index < 2,
        })),
      },
    };

    assert.deepEqual(selectEnvironmentMetrics(state), {
      activeSensors: 3,
      offlineSensors: initial.sensors.length - 3,
      activeAlerts: 0,
      averageTemperature: 20,
      minimumTemperature: 10,
      maximumTemperature: 30,
      activeLinks: 2,
      totalLinks: 3,
    });
  });

  it("keeps unavailable ranges and empty topology distinct from measured zero", () => {
    const initial = createInitialEnvironmentState(ENVIRONMENT_BY_ID["forest-north"]);
    const state = {
      ...initial,
      sensors: initial.sensors.map((sensor) => ({
        ...sensor,
        reading: { ...sensor.reading, temperature: null },
      })),
      topology: { ...initial.topology, connections: [] },
    };

    const metrics = selectEnvironmentMetrics(state);
    assert.equal(metrics.averageTemperature, null);
    assert.equal(metrics.minimumTemperature, null);
    assert.equal(metrics.maximumTemperature, null);
    assert.equal(metrics.activeLinks, 0);
    assert.equal(metrics.totalLinks, 0);
  });
});
