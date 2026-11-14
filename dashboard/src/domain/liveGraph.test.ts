import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENVIRONMENT_BY_ID } from "../config/environments.ts";
import { createInitialEnvironmentState } from "../simulation/engine.ts";
import { buildLiveGraph, layoutOrder } from "./liveGraph.ts";
import type { EnvironmentState, SensorStatus } from "./types.ts";

function field(distances: (number | null)[], options: { offline?: string[] } = {}): EnvironmentState {
  const initial = createInitialEnvironmentState(ENVIRONMENT_BY_ID["building-a"]);
  const ids = ["A-01", "A-02", "A-03"];
  const sensors = ids.map((id, index) => {
    const base = initial.sensors.find((sensor) => sensor.id === id)!;
    const distance = distances[index];
    const offline = options.offline?.includes(id) ?? false;
    const status: SensorStatus = offline
      ? "offline"
      : distance === 0 ? "critical" : distance === 1 ? "warning" : "normal";
    return {
      ...base,
      status,
      reading: { ...base.reading, temperature: 20 + index, anomalyScore: distance === 0 ? 1 : 0.05 },
      live: {
        gradientDistance: distance, via: null, escapeTo: id === "A-01" ? "A-02" : null,
        mu: 22, sigma: 1, n: 30, modelUpdatedAt: null,
        networkAlert: false, simulated: false, bytesSent: 10, bytesIfRawData: 100,
        sourceTimestamp: 1,
      },
    };
  });
  const connections = [
    { id: "A-01--A-02", sourceId: "A-01", targetId: "A-02", active: true, strength: 1, allowed: true },
    { id: "A-02--A-03", sourceId: "A-02", targetId: "A-03", active: !(options.offline ?? []).includes("A-03"), strength: 1, allowed: true },
  ];
  return { ...initial, source: "live", sensors, topology: { ...initial.topology, connections } };
}

describe("live field graph", () => {
  it("lays a line of boards out in order, so neighbours sit next to each other", () => {
    const model = buildLiveGraph(field([0, 1, 2]));
    assert.equal(model.shape, "line");
    assert.deepEqual(model.nodes.map((node) => node.id), ["A-01", "A-02", "A-03"]);
    assert.ok(model.nodes[0].x < model.nodes[1].x && model.nodes[1].x < model.nodes[2].x);
  });

  it("reads 99 as unknown rather than as a distance, and a quiet field as quiet", () => {
    const model = buildLiveGraph(field([99, 99, 99]));
    assert.deepEqual(model.nodes.map((node) => node.distanceLabel), ["·", "·", "·"]);
    assert.equal(model.unknownCount, 3);
    assert.equal(model.quiet, true);
    assert.deepEqual(model.sourceIds, []);
  });

  it("marks a node that lost its path while something is burning", () => {
    const model = buildLiveGraph(field([0, 1, 99]));
    assert.deepEqual(model.nodes.map((node) => node.distanceLabel), ["0", "1", "?"]);
    assert.equal(model.unknownCount, 1);
  });

  it("names the source when a board is heated", () => {
    const model = buildLiveGraph(field([0, 1, 2]));
    assert.deepEqual(model.sourceIds, ["A-01"]);
    assert.equal(model.quiet, false);
    assert.deepEqual(model.nodes.map((node) => node.distanceLabel), ["0", "1", "2"]);
  });

  it("marks an unplugged board offline and drops its link", () => {
    const model = buildLiveGraph(field([0, 1, null], { offline: ["A-03"] }));
    const far = model.nodes.find((node) => node.id === "A-03")!;
    assert.equal(far.offline, true);
    assert.equal(far.distanceLabel, "—");
    assert.equal(model.offlineCount, 1);
    assert.equal(model.links.find((link) => link.id === "A-02--A-03")!.active, false);
  });

  it("highlights the escape link of the selected node", () => {
    const model = buildLiveGraph(field([0, 1, 2]), "A-01");
    assert.equal(model.links.find((link) => link.id === "A-01--A-02")!.escape, true);
    assert.equal(model.links.find((link) => link.id === "A-02--A-03")!.escape, false);
  });

  it("walks a loop of boards round instead of pretending it is a line", () => {
    const ids = ["A-01", "A-02", "A-03", "A-04"];
    const ring = [
      { sourceId: "A-01", targetId: "A-02" }, { sourceId: "A-02", targetId: "A-03" },
      { sourceId: "A-03", targetId: "A-04" }, { sourceId: "A-04", targetId: "A-01" },
    ];
    const { order, shape } = layoutOrder(ids, ring);
    assert.equal(shape, "ring");
    assert.deepEqual(order, ids);
  });

  it("keeps the given order when the field has not reported its links yet", () => {
    const { order, shape } = layoutOrder(["A-01", "A-02"], []);
    assert.deepEqual(order, ["A-01", "A-02"]);
    assert.equal(shape, "line");
  });
});
