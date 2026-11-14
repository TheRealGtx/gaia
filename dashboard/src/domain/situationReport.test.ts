import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENVIRONMENT_BY_ID } from "../config/environments.ts";
import { createInitialEnvironmentState } from "../simulation/engine.ts";
import { buildSituationReport } from "./situationReport.ts";

describe("deterministic situation report", () => {
  it("uses escape_to for guidance and excludes distance 99 from safest area", () => {
    const initial = createInitialEnvironmentState(ENVIRONMENT_BY_ID["building-a"]);
    const sensors = initial.sensors.slice(0, 3).map((sensor, index) => ({
      ...sensor,
      status: index === 0 ? "critical" as const : index === 2 ? "unknown" as const : "normal" as const,
      live: {
        gradientDistance: [0, 2, 99][index], via: index ? "A-01" : null,
        escapeTo: index === 0 ? "A-02" : null, mu: 22, sigma: 1, n: 20,
        networkAlert: index === 0, simulated: false, bytesSent: 10,
        bytesIfRawData: 100, sourceTimestamp: 1,
      },
    }));
    const report = buildSituationReport({ ...initial, source: "live", sensors });
    assert.deepEqual(report.sourceSensorIds, ["A-01"]);
    assert.equal(report.safestSensorId, "A-02");
    assert.equal(report.escapeToSensorId, "A-02");
    assert.match(report.summary, /A-01/);
  });

  it("states all clear when there is no hazard source", () => {
    const report = buildSituationReport(createInitialEnvironmentState(ENVIRONMENT_BY_ID["building-a"]));
    assert.match(report.summary, /No active hazard/);
  });

  it("uses distance zero as the source when consensus alert is true on several nodes", () => {
    const initial = createInitialEnvironmentState(ENVIRONMENT_BY_ID["building-a"]);
    const sensors = initial.sensors.slice(0, 3).map((sensor, index) => ({
      ...sensor,
      live: {
        gradientDistance: index, via: null, escapeTo: null, mu: 22, sigma: 1, n: 20,
        networkAlert: true, simulated: false, bytesSent: 10, bytesIfRawData: 100, sourceTimestamp: 1,
      },
    }));
    const report = buildSituationReport({ ...initial, source: "live", sensors });
    assert.deepEqual(report.sourceSensorIds, ["A-01"]);
  });
});
