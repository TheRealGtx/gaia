import type {
  ConsensusState,
  EnvironmentDefinition,
  NetworkTopology,
  SensorNode,
} from "./types.ts";

function distanceBetween(a: SensorNode, b: SensorNode): number {
  return Math.hypot(
    a.position[0] - b.position[0],
    a.position[1] - b.position[1],
    a.position[2] - b.position[2],
  );
}

export function deriveTopology(
  definition: EnvironmentDefinition,
  sensors: SensorNode[],
): NetworkTopology {
  const connections: NetworkTopology["connections"] = [];
  const seen = new Set<string>();

  for (let sourceIndex = 0; sourceIndex < sensors.length; sourceIndex += 1) {
    for (let targetIndex = sourceIndex + 1; targetIndex < sensors.length; targetIndex += 1) {
      const source = sensors[sourceIndex];
      const target = sensors[targetIndex];
      const id = [source.id, target.id].sort().join("--");
      if (seen.has(id)) continue;
      seen.add(id);

      const distance = distanceBetween(source, target);
      const inRange = distance <= Math.min(source.communicationRange, target.communicationRange);
      const configured = source.neighbourIds.includes(target.id) || target.neighbourIds.includes(source.id);
      const active = source.status !== "offline" && target.status !== "offline" && inRange;

      if (configured || inRange) {
        connections.push({
          id,
          sourceId: source.id,
          targetId: target.id,
          active,
          allowed: configured || inRange,
          strength: active ? Math.max(0.15, 1 - distance / Math.min(source.communicationRange, target.communicationRange)) : 0,
        });
      }
    }
  }

  return {
    environmentId: definition.id,
    connections,
    lastUpdate: sensors.reduce((latest, sensor) => (
      sensor.reading.lastUpdate > latest ? sensor.reading.lastUpdate : latest
    ), sensors[0]?.reading.lastUpdate ?? new Date(0).toISOString()),
    source: sensors[0]?.reading.source ?? "simulation",
  };
}

export function deriveConsensus(
  sensors: SensorNode[],
  sensorId: string,
  simulated: boolean,
): ConsensusState {
  const source = sensors.find((sensor) => sensor.id === sensorId);
  if (!source) return { sensorId, agreeing: 0, eligible: 0, reached: false, simulated };

  const neighbours = source.neighbourIds
    .map((id) => sensors.find((sensor) => sensor.id === id))
    .filter((sensor): sensor is SensorNode => Boolean(sensor) && sensor?.status !== "offline");
  const agreeing = neighbours.filter((sensor) => (sensor.reading.anomalyScore ?? 0) >= 0.5).length;
  const eligible = neighbours.length;
  const quorum = eligible <= 1 ? eligible : Math.ceil(eligible / 2);

  return {
    sensorId,
    agreeing,
    eligible,
    reached: eligible > 0 && agreeing >= quorum,
    simulated,
  };
}
