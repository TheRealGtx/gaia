import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LiveNetworkAdapter } from "./LiveNetworkAdapter.ts";

interface TestSocket {
  readyState: number;
  onopen: (() => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onerror: (() => void) | null;
  onclose: (() => void) | null;
  close(): void;
}

function sensor(overrides: Record<string, unknown> = {}) {
  return {
    id: "A-01", environmentId: "building-a", name: "Reception", position: [-12, 1.15, 7],
    temperature: 23, humidity: 45, anomalyScore: 0.1, gradientDistance: 2,
    via: "A-02", escapeTo: "A-03", networkAlert: false, simulated: false,
    bytesSent: 34, bytesIfRawData: 123, sourceTimestamp: 100,
    status: "normal", connectivity: "connected", neighbourIds: ["A-02"],
    lastUpdate: "2026-11-14T10:00:00.000Z",
    ...overrides,
  };
}

describe("live adapter sticky model parameters", () => {
  it("keeps the last complete model when later heartbeats omit it", async () => {
    let socket: TestSocket | null = null;
    const adapter = new LiveNetworkAdapter("ws://test", () => {
      socket = {
        readyState: 1, onopen: null, onmessage: null, onerror: null, onclose: null,
        close() {},
      };
      return socket;
    });
    await adapter.connect();
    try {
      socket!.onmessage?.({ data: JSON.stringify({
        type: "sensor-reading", environmentId: "building-a",
        sensor: sensor({ mu: 22, sigma: 1, n: 24, modelUpdatedAt: "2026-11-14T10:00:00.000Z" }),
      }) });
      socket!.onmessage?.({ data: JSON.stringify({
        type: "sensor-reading", environmentId: "building-a",
        sensor: sensor({ temperature: 24, lastUpdate: "2026-11-14T10:01:00.000Z" }),
      }) });

      const current = adapter.getSnapshot("building-a")?.sensors.find((item) => item.id === "A-01");
      const live = current?.live as unknown as Record<string, unknown>;
      assert.equal(current?.reading.temperature, 24);
      assert.equal(live.mu, 22);
      assert.equal(live.sigma, 1);
      assert.equal(live.n, 24);
      assert.equal(live.modelUpdatedAt, "2026-11-14T10:00:00.000Z");
    } finally {
      adapter.disconnect();
    }
  });
});
