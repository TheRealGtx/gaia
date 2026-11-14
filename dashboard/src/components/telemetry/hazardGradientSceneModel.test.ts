import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SensorNode, Vector3Tuple } from "../../domain/types.ts";
import type { HazardGradientModel } from "../../domain/hazardGradient.ts";
import { createHazardGradientSceneModel, fitHazardGradientScene } from "./hazardGradientSceneModel.ts";

function sensor(id: string, position: Vector3Tuple): SensorNode {
  return {
    id,
    environmentId: "building-a",
    name: id,
    position,
    reading: { temperature: 22, humidity: 45, anomalyScore: .1, lastUpdate: "2026-11-14T00:00:00.000Z", source: "simulation" },
    status: "normal",
    connectivity: "connected",
    neighbourIds: [],
    communicationRange: 10,
  };
}

describe("hazard gradient 3D scene model", () => {
  it("keeps real 3D sensor positions and drops links with a missing endpoint", () => {
    const sensors = [sensor("A", [-4, 1, 7]), sensor("B", [8, 6, -2])];
    const gradient: HazardGradientModel = {
      sourceId: "A",
      nodes: [
        { sensorId: "A", level: 0, offline: false },
        { sensorId: "B", level: 1, offline: true },
      ],
      links: [
        { sourceId: "A", targetId: "B" },
        { sourceId: "A", targetId: "missing" },
      ],
      maxLevel: 1,
    };

    const scene = createHazardGradientSceneModel(sensors, gradient, "B");

    assert.deepEqual(scene.nodes, [
      { sensorId: "A", position: [-4, 1, 7], level: 0, offline: false, selected: false },
      { sensorId: "B", position: [8, 6, -2], level: 1, offline: true, selected: true },
    ]);
    assert.deepEqual(scene.links, [{ sourceId: "A", targetId: "B", source: [-4, 1, 7], target: [8, 6, -2] }]);
  });

  it("centers the camera frame across horizontal and vertical sensor bounds", () => {
    const frame = fitHazardGradientScene([
      [-10, 0, -5],
      [10, 15, 5],
    ]);

    assert.deepEqual(frame.center, [0, 7.5, 0]);
    assert.ok(frame.radius >= 13.4 && frame.radius <= 13.5);
  });

  it("keeps camera and zoom limits valid for planar and degenerate layouts", () => {
    const layouts: Vector3Tuple[][] = [
      [[-30, 1, -20], [30, 1, 20]],
      [[4, 2, -7]],
      [[1, 1, 1], [1, 1, 1]],
      [],
    ];

    for (const positions of layouts) {
      const frame = fitHazardGradientScene(positions);
      assert.equal(frame.cameraPosition.every(Number.isFinite), true);
      assert.ok(Number.isFinite(frame.radius) && frame.radius > 0);
      assert.ok(frame.minDistance > 0);
      assert.ok(frame.maxDistance > frame.minDistance);
      assert.ok(frame.pointRadius > 0);
    }
  });
});
