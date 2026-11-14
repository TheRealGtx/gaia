import type { EnvironmentState } from "./types.ts";

export interface GradientConnectionInput {
  sourceId: string;
  targetId: string;
  active: boolean;
}

export interface HazardGradientNode {
  sensorId: string;
  level: number | null;
  offline: boolean;
}

export interface HazardGradientModel {
  sourceId: string | null;
  nodes: HazardGradientNode[];
  links: Array<{ sourceId: string; targetId: string }>;
  maxLevel: number;
}

export function selectSimulatedHazardSource(environment: EnvironmentState): string | null {
  const hazard = environment.hazards.find((item) => item.kind === "simulated-fire" || item.kind === "confirmed-fire");
  if (hazard) {
    return environment.sensors.reduce((nearest, sensor) => {
      const distance = Math.hypot(
        sensor.position[0] - hazard.position[0],
        sensor.position[1] - hazard.position[1],
        sensor.position[2] - hazard.position[2],
      );
      return distance < nearest.distance ? { id: sensor.id, distance } : nearest;
    }, { id: "", distance: Number.POSITIVE_INFINITY }).id || null;
  }

  return environment.alerts.find((alert) => alert.confirmed)?.sensorIds[0]
    ?? environment.sensors.find((sensor) => sensor.status === "critical")?.id
    ?? null;
}

const FIELD_STOPS = [
  { at: 0, color: [255, 32, 32] as const },
  { at: .42, color: [184, 91, 91] as const },
  { at: .58, color: [142, 147, 147] as const },
  { at: 1, color: [34, 211, 221] as const },
];

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function hexChannel(value: number) {
  return Math.round(value).toString(16).padStart(2, "0");
}

function interpolateFieldColor(ratio: number) {
  const normalized = clamp(ratio);
  const rightIndex = FIELD_STOPS.findIndex((stop) => stop.at >= normalized);
  const right = FIELD_STOPS[rightIndex < 0 ? FIELD_STOPS.length - 1 : rightIndex];
  const left = FIELD_STOPS[Math.max(0, (rightIndex < 0 ? FIELD_STOPS.length - 1 : rightIndex) - 1)];
  const amount = left === right ? 0 : (normalized - left.at) / (right.at - left.at);
  const channels = left.color.map((channel, index) => channel + (right.color[index] - channel) * amount);
  return `#${channels.map(hexChannel).join("")}`;
}

export function gradientFieldColor(level: number | null, maxLevel: number, offline: boolean, hasActiveSource = true) {
  if (offline) return "#64748b";
  if (!hasActiveSource) return "#22d3dd";
  if (level === null) return "#64748b";
  if (level === 0) return "#ff2020";
  if (level >= maxLevel) return "#22d3dd";
  return interpolateFieldColor(level / Math.max(1, maxLevel));
}

export function deriveHazardGradient({
  sensorIds,
  sourceId,
  offlineSensorIds,
  connections,
}: {
  sensorIds: string[];
  sourceId: string | null;
  offlineSensorIds: string[];
  connections: GradientConnectionInput[];
}): HazardGradientModel {
  const known = new Set(sensorIds);
  const offline = new Set(offlineSensorIds);
  const adjacency = new Map(sensorIds.map((id) => [id, [] as string[]]));
  const activeLinks = connections.filter((connection) => (
    connection.active
    && known.has(connection.sourceId)
    && known.has(connection.targetId)
    && !offline.has(connection.sourceId)
    && !offline.has(connection.targetId)
  ));

  for (const connection of activeLinks) {
    adjacency.get(connection.sourceId)?.push(connection.targetId);
    adjacency.get(connection.targetId)?.push(connection.sourceId);
  }

  const levels = new Map<string, number>();
  if (sourceId && known.has(sourceId) && !offline.has(sourceId)) {
    levels.set(sourceId, 0);
    const queue = [sourceId];
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      const nextLevel = (levels.get(current) ?? 0) + 1;
      for (const neighbour of adjacency.get(current) ?? []) {
        if (levels.has(neighbour)) continue;
        levels.set(neighbour, nextLevel);
        queue.push(neighbour);
      }
    }
  }

  const maxLevel = Math.max(0, ...levels.values());
  const nodes: HazardGradientNode[] = sensorIds.map((sensorId) => ({
    sensorId,
    level: levels.get(sensorId) ?? null,
    offline: offline.has(sensorId),
  }));

  return {
    sourceId: sourceId && levels.has(sourceId) ? sourceId : null,
    nodes,
    links: activeLinks.map(({ sourceId: from, targetId }) => ({ sourceId: from, targetId })),
    maxLevel,
  };
}

export function deriveLiveHazardGradient(
  sensors: Array<{ sensorId: string; distance: number | null; offline: boolean }>,
  connections: GradientConnectionInput[],
): HazardGradientModel {
  const known = new Set(sensors.map((sensor) => sensor.sensorId));
  const activeLinks = connections.filter((connection) => connection.active && known.has(connection.sourceId) && known.has(connection.targetId));
  const nodes = sensors.map((sensor) => ({
    sensorId: sensor.sensorId,
    level: sensor.offline || sensor.distance === null || sensor.distance >= 99 ? null : sensor.distance,
    offline: sensor.offline,
  }));
  const finiteLevels = nodes.flatMap((node) => node.level === null ? [] : [node.level]);
  return {
    sourceId: nodes.find((node) => node.level === 0)?.sensorId ?? null,
    nodes,
    links: activeLinks.map(({ sourceId, targetId }) => ({ sourceId, targetId })),
    maxLevel: Math.max(0, ...finiteLevels),
  };
}

export function liveGradientColor(distance: number | null, offline: boolean, hasActiveSource = true) {
  if (offline) return "#64748b";
  if (!hasActiveSource) return "#22d3dd";
  if (distance === null || distance >= 99) return "#64748b";
  if (distance === 0) return "#ef4444";
  if (distance === 1) return "#f59e0b";
  return "#10b981";
}

