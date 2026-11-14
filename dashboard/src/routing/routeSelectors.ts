import type { EnvironmentState, EvacuationRoute } from "../domain/types.ts";
import { findEvacuationRoutes } from "./pathfinding.ts";

export function selectRoutes(state: EnvironmentState, originId: string): EvacuationRoute[] {
  const hazardousVertexIds = state.hazards.flatMap((hazard) => hazard.vertexIds);
  return findEvacuationRoutes(state.definition.routeGraph, originId, {
    environmentId: state.definition.id,
    exits: state.definition.exits,
    blockedEdgeIds: state.blockedEdgeIds,
    hazardousVertexIds,
    source: state.source,
  });
}

export function selectBestRoute(routes: EvacuationRoute[]): EvacuationRoute | null {
  return routes[0] ?? null;
}
