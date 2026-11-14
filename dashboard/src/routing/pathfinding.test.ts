import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENVIRONMENT_BY_ID } from "../config/environments.ts";
import { findEvacuationRoutes } from "./pathfinding.ts";

describe("hazard-aware evacuation routing", () => {
  it("routes a room to the shortest available exit using configured edges", () => {
    const environment = ENVIRONMENT_BY_ID["building-a"];
    const routes = findEvacuationRoutes(environment.routeGraph, "office-a", {
      environmentId: environment.id,
      exits: environment.exits,
      blockedEdgeIds: [],
      hazardousVertexIds: [],
      source: "simulation",
    });

    assert.equal(routes[0]?.exitId, "building-a-south");
    assert.deepEqual(routes[0]?.vertexIds, ["office-a", "office-door", "atrium", "south-exit"]);
  });

  it("uses stairs for a second-floor room and never skips graph vertices", () => {
    const environment = ENVIRONMENT_BY_ID["building-a"];
    const routes = findEvacuationRoutes(environment.routeGraph, "meeting", {
      environmentId: environment.id,
      exits: environment.exits,
      blockedEdgeIds: [],
      hazardousVertexIds: [],
      source: "simulation",
    });

    assert.ok(routes[0]?.vertexIds.includes("stairs-2"));
    assert.ok(routes[0]?.vertexIds.includes("stairs-1"));
  });

  it("recalculates around a blocked corridor and reports no route when all exits are isolated", () => {
    const environment = ENVIRONMENT_BY_ID["building-a"];
    const rerouted = findEvacuationRoutes(environment.routeGraph, "office-a", {
      environmentId: environment.id,
      exits: environment.exits,
      blockedEdgeIds: ["atrium-south"],
      hazardousVertexIds: [],
      source: "simulation",
    });
    assert.equal(rerouted[0]?.exitId, "building-a-north");

    const none = findEvacuationRoutes(environment.routeGraph, "office-a", {
      environmentId: environment.id,
      exits: environment.exits,
      blockedEdgeIds: ["atrium-south", "west-north"],
      hazardousVertexIds: [],
      source: "simulation",
    });
    assert.equal(none.length, 0);
  });

  it("allows escape from a hazardous origin but excludes other hazardous vertices", () => {
    const environment = ENVIRONMENT_BY_ID["building-a"];
    const routes = findEvacuationRoutes(environment.routeGraph, "storage", {
      environmentId: environment.id,
      exits: environment.exits,
      blockedEdgeIds: [],
      hazardousVertexIds: ["storage", "south-exit"],
      source: "simulation",
    });

    assert.equal(routes[0]?.exitId, "building-a-north");
    assert.equal(routes[0]?.status, "affected");
  });
});
