import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeGatewayMessage, normalizeGatewayMessages, statusFromNetwork } from "./protocol.ts";

describe("gateway protocol", () => {
  it("preserves the frozen UDP metrics enriched by the gateway", () => {
    const event = normalizeGatewayMessage({
      type: "sensor-reading", environmentId: "building-a",
      sensor: {
        id: "A-01", environmentId: "building-a", name: "Reception", position: [-12, 1.15, 7],
        temperature: 47, humidity: 22.5, anomalyScore: 1, gradientDistance: 0,
        via: null, escapeTo: "A-02", mu: 20, sigma: 0, n: 7, networkAlert: false,
        simulated: true, bytesSent: 204, bytesIfRawData: 451, sourceTimestamp: 1794648860.83,
        status: "critical", connectivity: "connected", neighbourIds: ["A-02"],
        lastUpdate: "2026-11-14T10:00:00.000Z",
      },
    });
    assert.equal(event?.type, "sensor-reading");
    if (event?.type === "sensor-reading") {
      assert.deepEqual(event.sensor.live, {
        gradientDistance: 0, via: null, escapeTo: "A-02", mu: 20, sigma: 0, n: 7,
        networkAlert: false, simulated: true, bytesSent: 204, bytesIfRawData: 451,
        sourceTimestamp: 1794648860.83,
      });
    }
  });

  it("maps network distance without treating 99 as safe", () => {
    assert.equal(statusFromNetwork(0, false, "fresh"), "critical");
    assert.equal(statusFromNetwork(1, false, "fresh"), "warning");
    assert.equal(statusFromNetwork(2, false, "fresh"), "normal");
    assert.equal(statusFromNetwork(99, false, "fresh"), "unknown");
    assert.equal(statusFromNetwork(2, true, "fresh"), "critical");
    assert.equal(statusFromNetwork(2, false, "offline"), "offline");
  });
  it("normalizes a live sensor reading", () => {
    const event = normalizeGatewayMessage({
      type: "sensor-reading",
      environmentId: "building-a",
      sensor: {
        id: "A-01",
        environmentId: "building-a",
        name: "Reception",
        position: [-12, 1.1, 7],
        temperature: 28.4,
        humidity: 39,
        anomalyScore: 0.62,
        status: "warning",
        connectivity: "connected",
        neighbourIds: ["A-02"],
        lastUpdate: "2026-11-14T00:00:04.000Z",
      },
    });

    assert.equal(event?.type, "sensor-reading");
    if (event?.type === "sensor-reading") {
      assert.equal(event.sensor.reading.source, "live");
      assert.equal(event.sensor.reading.temperature, 28.4);
    }
  });

  it("ignores malformed and unknown-environment messages", () => {
    assert.equal(normalizeGatewayMessage({ type: "sensor-reading", environmentId: "moon-base" }), null);
    assert.equal(normalizeGatewayMessage("invalid"), null);
  });

  it("accepts live consensus only as a topology snapshot from the gateway", () => {
    const event = normalizeGatewayMessage({
      type: "topology",
      environmentId: "forest-north",
      lastUpdate: "2026-11-14T00:00:04.000Z",
      connections: [{ sourceId: "N-01", targetId: "N-02", active: true, strength: 0.8 }],
    });
    assert.equal(event?.type, "topology");
    if (event?.type === "topology") assert.equal(event.topology.source, "live");
  });

  it("expands the gateway initial snapshot into normalized live events", () => {
    const events = normalizeGatewayMessages({
      type: "snapshot",
      environments: {
        "building-a": {
          sensors: {
            "A-01": {
              id: "A-01",
              environmentId: "building-a",
              name: "Reception",
              position: [-12, 1.1, 7],
              temperature: 24,
              humidity: 42,
              anomalyScore: 0.1,
              status: "normal",
              connectivity: "connected",
              neighbourIds: ["A-02"],
              lastUpdate: "2026-11-14T00:00:04.000Z",
            },
          },
        },
      },
    });

    assert.equal(events.length, 1);
    assert.equal(events[0]?.type, "sensor-reading");
  });
});
