import type { EnvironmentState, EvacuationRoute } from "../domain/types.ts";
import { findEvacuationRoutes } from "./pathfinding.ts";
import { routesFromForestSensor } from "./sensorRoutes.ts";

export function selectRoutes(state: EnvironmentState, originId: string): EvacuationRoute[] {
  const sensor = state.definition.kind === "forest" ? state.sensors.find((item) => item.id === originId) : null;
  if (sensor) return routesFromForestSensor(state, sensor);
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
