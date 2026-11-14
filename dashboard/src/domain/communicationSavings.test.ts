import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateCommunicationSavings } from "./communicationSavings.ts";
import type { SensorNode } from "./types.ts";

function sensor(id: string, bytesSent?: number, bytesIfRawData?: number): SensorNode {
  return {
    id, environmentId: "building-a", name: id, position: [0, 0, 0],
    reading: { temperature: 20, humidity: 50, anomalyScore: 0, lastUpdate: "2026-11-14T10:00:00Z", source: "live" },
    status: "normal", connectivity: "connected", neighbourIds: [], communicationRange: 10,
    live: { gradientDistance: 2, via: null, escapeTo: null, mu: null, sigma: null, n: null, modelUpdatedAt: null,
      networkAlert: false, simulated: false, bytesSent: bytesSent ?? null,
      bytesIfRawData: bytesIfRawData ?? null, sourceTimestamp: 1 },
  };
}

describe("communication savings", () => {
  it("aggregates cumulative counters without inventing missing nodes", () => {
    const result = calculateCommunicationSavings([sensor("A-01", 204, 451), sensor("A-02", 100, 200), sensor("A-03")]);
    assert.deepEqual(result, { bytesSent: 304, bytesIfRawData: 651, bytesAvoided: 347, reductionPercent: 53.3, reportingNodes: 2, totalNodes: 3 });
  });

  it("returns awaiting state when counters are absent or invalid", () => {
    assert.equal(calculateCommunicationSavings([sensor("A-01")]), null);
    assert.equal(calculateCommunicationSavings([sensor("A-01", 200, 100)]), null);
    assert.equal(calculateCommunicationSavings([sensor("A-01", 200, 100), sensor("A-02", 10, 1000)]), null);
  });

  it("treats reset cumulative counters as a valid fresh total, never a negative delta", () => {
    assert.deepEqual(calculateCommunicationSavings([sensor("A-01", 0, 41)]), {
      bytesSent: 0,
      bytesIfRawData: 41,
      bytesAvoided: 41,
      reductionPercent: 100,
      reportingNodes: 1,
      totalNodes: 1,
    });
  });
});
