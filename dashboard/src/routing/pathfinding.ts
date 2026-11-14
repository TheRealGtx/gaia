import type {
  DataSource,
  EnvironmentId,
  EvacuationRoute,
  Exit,
  RouteEdge,
  RouteGraph,
  Vector3Tuple,
} from "../domain/types.ts";
import { PriorityQueue } from "./priorityQueue.ts";

export interface RouteConstraints {
  environmentId: EnvironmentId;
  exits: Exit[];
  blockedEdgeIds: string[];
  hazardousVertexIds: string[];
  source: DataSource;
}

interface Candidate {
  vertexId: string;
  risk: number;
  distance: number;
}

interface PreviousStep {
  vertexId: string;
  edge: RouteEdge;
  reversed: boolean;
}

function lexicographicallyBetter(
  risk: number,
  distance: number,
  previous?: readonly [number, number],
): boolean {
  return !previous || risk < previous[0] || (risk === previous[0] && distance < previous[1]);
}

function routeToExit(
  graph: RouteGraph,
  originId: string,
  exit: Exit,
  constraints: RouteConstraints,
): EvacuationRoute | null {
  const vertices = new Set(graph.vertices.map((vertex) => vertex.id));
  if (!vertices.has(originId) || !vertices.has(exit.waypointId)) return null;
  const blocked = new Set(constraints.blockedEdgeIds);
  const hazards = new Set(constraints.hazardousVertexIds);
  const costs = new Map<string, readonly [number, number]>([[originId, [0, 0]]]);
  const previous = new Map<string, PreviousStep>();
  const queue = new PriorityQueue<Candidate>();
  queue.push({ vertexId: originId, risk: 0, distance: 0 }, [0, 0]);

  while (queue.size) {
    const current = queue.pop()!;
    const best = costs.get(current.vertexId);
    if (!best || current.risk !== best[0] || current.distance !== best[1]) continue;
    if (current.vertexId === exit.waypointId) break;

    for (const edge of graph.edges) {
      if (blocked.has(edge.id)) continue;
      let nextId: string | null = null;
      let reversed = false;
      if (edge.from === current.vertexId) nextId = edge.to;
      else if (edge.bidirectional && edge.to === current.vertexId) {
        nextId = edge.from;
        reversed = true;
      }
      if (!nextId) continue;
      if (hazards.has(nextId) && nextId !== originId) continue;

      const nextRisk = current.risk + edge.risk;
      const nextDistance = current.distance + edge.distance;
      if (!lexicographicallyBetter(nextRisk, nextDistance, costs.get(nextId))) continue;
      costs.set(nextId, [nextRisk, nextDistance]);
      previous.set(nextId, { vertexId: current.vertexId, edge, reversed });
      queue.push({ vertexId: nextId, risk: nextRisk, distance: nextDistance }, [nextRisk, nextDistance]);
    }
  }

  const finalCost = costs.get(exit.waypointId);
  if (!finalCost) return null;
  const steps: PreviousStep[] = [];
  const vertexIds = [exit.waypointId];
  let cursor = exit.waypointId;
  while (cursor !== originId) {
    const step = previous.get(cursor);
    if (!step) return null;
    steps.unshift(step);
    cursor = step.vertexId;
    vertexIds.unshift(cursor);
  }

  const points: Vector3Tuple[] = [];
  for (const step of steps) {
    const segment = step.reversed ? [...step.edge.points].reverse() : step.edge.points;
    for (const point of segment) {
      const previousPoint = points.at(-1);
      if (!previousPoint || previousPoint.some((value, index) => value !== point[index])) points.push(point);
    }
  }

  return {
    id: `${constraints.environmentId}:${originId}:${exit.id}`,
    environmentId: constraints.environmentId,
    originId,
    exitId: exit.id,
    vertexIds,
    points,
    distance: Math.round(finalCost[1] * 10) / 10,
    risk: finalCost[0],
    status: hazards.has(originId) ? "affected" : "available",
    source: constraints.source,
    simulatedDecisionSupport: constraints.source === "simulation",
  };
}

export function findEvacuationRoutes(
  graph: RouteGraph,
  originId: string,
  constraints: RouteConstraints,
): EvacuationRoute[] {
  return constraints.exits
    .map((exit) => routeToExit(graph, originId, exit, constraints))
    .filter((route): route is EvacuationRoute => route !== null)
    .sort((a, b) => a.risk - b.risk || a.distance - b.distance || a.exitId.localeCompare(b.exitId));
}
