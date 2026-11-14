import type { EnvironmentState, SensorNode, SensorStatus } from "./types.ts";

/**
 * The live field as a graph, with nothing of the building in it.
 *
 * The 3D twin is a model of a place; this is the network itself: the nodes that
 * are on the air, the links between them, and the distance each one reports
 * from the hazard. Nothing here is configured scenery, so what moves on screen
 * moved on the boards.
 */
export interface LiveGraphNode {
  id: string;
  name: string;
  status: SensorStatus;
  /** Hops from the hazard. null when the node knows of none (99) or said nothing yet. */
  distance: number | null;
  distanceLabel: string;
  temperature: number | null;
  anomaly: number | null;
  simulated: boolean;
  offline: boolean;
  isSource: boolean;
  escapeTo: string | null;
  x: number;
  y: number;
}

export interface LiveGraphLink {
  id: string;
  sourceId: string;
  targetId: string;
  active: boolean;
  /** The neighbour the selected node would send people to. */
  escape: boolean;
}

export interface LiveGraphModel {
  nodes: LiveGraphNode[];
  links: LiveGraphLink[];
  shape: "line" | "ring";
  sourceIds: string[];
  offlineCount: number;
  unknownCount: number;
  /** True while no node has a path to a hazard: the resting state of a healthy field. */
  quiet: boolean;
}

export const UNKNOWN_DISTANCE = 99;

function distanceOf(sensor: SensorNode): number | null {
  const raw = sensor.live?.gradientDistance;
  if (raw === null || raw === undefined || raw >= UNKNOWN_DISTANCE) return null;
  return raw;
}

/** Neighbours of each node, from the links the gateway reports. */
function adjacency(ids: string[], links: { sourceId: string; targetId: string }[]) {
  const map = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const link of links) {
    if (!map.has(link.sourceId) || !map.has(link.targetId)) continue;
    map.get(link.sourceId)!.push(link.targetId);
    map.get(link.targetId)!.push(link.sourceId);
  }
  return map;
}

/**
 * Walk the field so neighbours end up next to each other on screen.
 *
 * A line of boards starts from an end; a loop starts anywhere and comes back.
 * Anything else (or a field that has not reported its links yet) keeps the
 * order it came in, which is still readable.
 */
export function layoutOrder(ids: string[], links: { sourceId: string; targetId: string }[]) {
  if (ids.length < 2) return { order: ids, shape: "line" as const };
  const neighbours = adjacency(ids, links);
  const degrees = ids.map((id) => neighbours.get(id)!.length);
  if (degrees.some((degree) => degree > 2) || degrees.some((degree) => degree === 0)) {
    return { order: ids, shape: "line" as const };
  }
  const ends = ids.filter((id) => neighbours.get(id)!.length === 1);
  const ring = ends.length === 0;
  if (!ring && ends.length !== 2) return { order: ids, shape: "line" as const };

  const start = ring ? ids[0] : ends.slice().sort()[0];
  const order: string[] = [start];
  const seen = new Set([start]);
  let current = start;
  while (order.length < ids.length) {
    const next = neighbours.get(current)!.find((id) => !seen.has(id));
    if (!next) break;
    order.push(next);
    seen.add(next);
    current = next;
  }
  if (order.length !== ids.length) return { order: ids, shape: "line" as const };
  return { order, shape: ring ? ("ring" as const) : ("line" as const) };
}

/** Positions in a 100 x 60 box, so the view scales to any screen. */
function place(order: string[], shape: "line" | "ring") {
  const positions = new Map<string, { x: number; y: number }>();
  if (shape === "ring") {
    const radius = 21;
    order.forEach((id, index) => {
      const angle = (index / order.length) * Math.PI * 2 - Math.PI / 2;
      positions.set(id, { x: 50 + Math.cos(angle) * radius * 1.5, y: 30 + Math.sin(angle) * radius });
    });
    return positions;
  }
  const span = Math.max(order.length - 1, 1);
  order.forEach((id, index) => {
    positions.set(id, { x: order.length === 1 ? 50 : 12 + (index / span) * 76, y: 30 });
  });
  return positions;
}

export function buildLiveGraph(environment: EnvironmentState, selectedId?: string | null): LiveGraphModel {
  const sensors = environment.sensors;
  const ids = sensors.map((sensor) => sensor.id);
  const connections = environment.topology.connections.filter(
    (link) => ids.includes(link.sourceId) && ids.includes(link.targetId),
  );
  const { order, shape } = layoutOrder(ids, connections);
  const positions = place(order, shape);
  const selected = sensors.find((sensor) => sensor.id === selectedId) ?? null;

  // "I know of no hazard" is the resting state of a healthy field, so at rest it
  // is not worth a question mark; once something IS burning, a node still
  // without a path has lost it, and that is worth showing.
  const quiet = sensors.every((sensor) => {
    const distance = distanceOf(sensor);
    return sensor.status === "offline" || distance === null;
  });

  const nodes = order.map((id) => {
    const sensor = sensors.find((item) => item.id === id)!;
    const distance = distanceOf(sensor);
    const offline = sensor.status === "offline";
    const position = positions.get(id) ?? { x: 50, y: 30 };
    return {
      id,
      name: sensor.name,
      status: sensor.status,
      distance,
      distanceLabel: offline ? "—" : distance === null ? (quiet ? "·" : "?") : String(distance),
      temperature: sensor.reading.temperature,
      anomaly: sensor.reading.anomalyScore,
      simulated: sensor.live?.simulated === true,
      offline,
      isSource: !offline && (distance === 0 || sensor.live?.networkAlert === true),
      escapeTo: sensor.live?.escapeTo ?? null,
      x: position.x,
      y: position.y,
    };
  });

  const links = connections.map((link) => ({
    id: link.id,
    sourceId: link.sourceId,
    targetId: link.targetId,
    active: link.active,
    escape: Boolean(
      selected && selected.live?.escapeTo &&
      [link.sourceId, link.targetId].includes(selected.id) &&
      [link.sourceId, link.targetId].includes(selected.live.escapeTo),
    ),
  }));

  return {
    nodes,
    links,
    shape,
    sourceIds: nodes.filter((node) => node.isSource).map((node) => node.id),
    offlineCount: nodes.filter((node) => node.offline).length,
    unknownCount: nodes.filter((node) => !node.offline && node.distance === null).length,
    quiet,
  };
}
