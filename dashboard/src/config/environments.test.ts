import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENVIRONMENTS } from "./environments.ts";

describe("environment configuration", () => {
  it("provides the two detailed demo environments", () => {
    assert.deepEqual(ENVIRONMENTS.map((environment) => environment.id), [
      "building-a",
      "forest-north",
    ]);
  });

  it("covers four building floors with at least one sensor per room and extra coverage for large rooms", () => {
    const building = ENVIRONMENTS.find((environment) => environment.id === "building-a")!;
    assert.equal(building.floors.length, 4);
    assert.ok(building.rooms.length >= 24);
    assert.ok(building.sensors.length >= 40);

    for (const room of building.rooms) {
      const roomSensors = building.sensors.filter((sensor) => sensor.roomId === room.id);
      assert.ok(roomSensors.length >= 1, `${room.name} has no sensor`);
      if (room.size[0] * room.size[1] >= 90) {
        assert.ok(roomSensors.length >= 2, `${room.name} needs multi-node coverage`);
      }
    }
  });

  it("spreads a dense forest mesh across a substantially larger terrain", () => {
    const forest = ENVIRONMENTS.find((environment) => environment.id === "forest-north")!;
    const xs = forest.sensors.map((sensor) => sensor.position[0]);
    const zs = forest.sensors.map((sensor) => sensor.position[2]);
    assert.ok(forest.sensors.length >= 36);
    assert.ok(Math.max(...xs) - Math.min(...xs) >= 58);
    assert.ok(Math.max(...zs) - Math.min(...zs) >= 42);
  });

  it("keeps node IDs unique and every configured neighbour valid", () => {
    for (const environment of ENVIRONMENTS) {
      const ids = environment.sensors.map((sensor) => sensor.id);
      assert.equal(new Set(ids).size, ids.length);

      for (const sensor of environment.sensors) {
        assert.equal(sensor.environmentId, environment.id);
        for (const neighbourId of sensor.neighbourIds) {
          assert.ok(ids.includes(neighbourId));
          assert.notEqual(neighbourId, sensor.id);
        }
      }
    }
  });

  it("only references existing graph vertices and provides an exit", () => {
    for (const environment of ENVIRONMENTS) {
      const vertexIds = new Set(environment.routeGraph.vertices.map((vertex) => vertex.id));
      assert.ok(environment.exits.length > 0);

      for (const edge of environment.routeGraph.edges) {
        assert.equal(vertexIds.has(edge.from), true);
        assert.equal(vertexIds.has(edge.to), true);
        assert.ok(edge.points.length >= 2);
      }

      for (const exit of environment.exits) {
        assert.equal(vertexIds.has(exit.waypointId), true);
      }
    }
  });
});
