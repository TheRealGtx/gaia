import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RouteEdge } from "../../../domain/types.ts";
import { distanceToTrail } from "./forestGround.ts";

function trail(points: RouteEdge["points"]): RouteEdge[] {
  return [{ id: "trail", from: "a", to: "b", points, distance: 20, risk: 0, bidirectional: true }];
}

describe("forest trail surface", () => {
  it("keeps the full trail clear between distant waypoints", () => {
    assert.equal(distanceToTrail(10, 1, trail([[0, 0, 0], [20, 4, 0]])), 1);
    assert.equal(distanceToTrail(10, 0, trail([[0, 0, 0], [20, 4, 0]])), 0);
  });
  it("ends at the waypoint and follows bends", () => {
    assert.equal(distanceToTrail(23, 0, trail([[0, 0, 0], [20, 4, 0]])), 3);
    assert.equal(distanceToTrail(9, 5, trail([[0, 0, 0], [10, 0, 0], [10, 0, 10]])), 1);
  });
  it("handles repeated waypoints and empty networks", () => {
    assert.equal(distanceToTrail(3, 4, trail([[0, 0, 0], [0, 0, 0]])), 5);
    assert.equal(distanceToTrail(3, 4, []), Infinity);
  });
});
