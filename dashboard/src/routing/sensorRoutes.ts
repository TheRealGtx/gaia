import type { EnvironmentState, RouteEdge, SensorNode, Vector3Tuple } from "../domain/types.ts";
import { forestElevation } from "../domain/terrain.ts";
import { findEvacuationRoutes } from "./pathfinding.ts";

function pathLength(points: Vector3Tuple[]): number {
  return points.slice(1).reduce((length, point, index) => length + Math.hypot(...point.map((value, axis) => value - points[index][axis])), 0);
}

/** Attach a forest sensor to the nearest reachable trail without changing the shared graph. */
export function routesFromForestSensor(state: EnvironmentState, sensor: SensorNode) {
  const graph = state.definition.routeGraph;
  const [x, , z] = sensor.position;
  const origin: Vector3Tuple = [x, forestElevation(x, z) + .35, z];
  const fires = state.hazards.filter((hazard) => hazard.kind === "simulated-fire");
  const containsOrigin = (fire: typeof fires[number]) => Math.hypot(x - fire.position[0], z - fire.position[2]) <= fire.radius;
  const hazardousVertexIds = state.hazards.filter((hazard) => hazard.kind !== "simulated-fire" || !containsOrigin(hazard)).flatMap((hazard) => hazard.vertexIds);
  for (const exit of state.definition.exits) {
    if (fires.some((fire) => Math.hypot(exit.position[0] - fire.position[0], exit.position[2] - fire.position[2]) <= fire.radius)) hazardousVertexIds.push(exit.waypointId);
  }
  if (fires.some(containsOrigin)) hazardousVertexIds.push(sensor.id);

  const traversable = (points: Vector3Tuple[]) => fires.every((fire) => {
    const radiusSquared = fire.radius ** 2;
    for (let index = 1; index < points.length; index += 1) {
      const a = points[index - 1], b = points[index];
      const ax = a[0] - fire.position[0], az = a[2] - fire.position[2];
      const dx = b[0] - a[0], dz = b[2] - a[2];
      const lengthSquared = dx * dx + dz * dz;
      const dot = ax * dx + az * dz;
      if (ax * ax + az * az <= radiusSquared && containsOrigin(fire)) {
        // Inside the starting fire, only permit movement away from its centre.
        if (dot < -1e-8) return false;
      } else {
        const t = lengthSquared ? Math.max(0, Math.min(1, -dot / lengthSquared)) : 0;
        if ((ax + t * dx) ** 2 + (az + t * dz) ** 2 <= radiusSquared) return false;
      }
    }
    return true;
  });

  const openEdges = graph.edges.filter((edge) => !state.blockedEdgeIds.includes(edge.id));
  const safeEdges: RouteEdge[] = [];
  for (const edge of openEdges) {
    if (traversable(edge.points)) safeEdges.push({ ...edge, bidirectional: false });
    const reversed = [...edge.points].reverse();
    if (edge.bidirectional && traversable(reversed)) safeEdges.push({ ...edge, id: `${edge.id}:reverse`, from: edge.to, to: edge.from, points: reversed, bidirectional: false });
  }

  const attachments = openEdges.flatMap((edge) => edge.points.slice(1).map((b, index) => {
    const a = edge.points[index];
    const dx = b[0] - a[0], dz = b[2] - a[2];
    const lengthSquared = dx * dx + dz * dz;
    const t = lengthSquared ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / lengthSquared)) : 0;
    const px = a[0] + t * dx, pz = a[2] + t * dz;
    const point: Vector3Tuple = [px, forestElevation(px, pz) + .35, pz];
    return { edge, index, point, distance: Math.hypot(px - x, pz - z) };
  })).sort((a, b) => a.distance - b.distance || a.edge.id.localeCompare(b.edge.id));

  for (const { edge, index, point } of attachments) {
    const branches = [{ to: edge.to, points: [point, ...edge.points.slice(index + 1)] }];
    if (edge.bidirectional) branches.push({ to: edge.from, points: [point, ...edge.points.slice(0, index + 1).reverse()] });
    const connectors: RouteEdge[] = branches.flatMap((branch) => {
      const points = [origin, ...branch.points];
      if (!traversable(points)) return [];
      return [{
        id: `${sensor.id}:entry:${branch.to}`, from: sensor.id, to: branch.to, points,
        distance: pathLength(points), risk: edge.risk * Math.min(1, pathLength(branch.points) / (pathLength(edge.points) || 1)), bidirectional: false,
      }];
    });
    if (!connectors.length) continue;
    const routes = findEvacuationRoutes({
      vertices: [...graph.vertices, { id: sensor.id, name: sensor.name, kind: "trail", position: origin }],
      edges: [...safeEdges, ...connectors],
    }, sensor.id, {
      environmentId: state.definition.id, exits: state.definition.exits,
      blockedEdgeIds: [], hazardousVertexIds, source: state.source,
    });
    if (routes.length) return routes;
  }
  return [];
}
