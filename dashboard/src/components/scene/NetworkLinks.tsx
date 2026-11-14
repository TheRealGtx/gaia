"use client";

import { Line } from "@react-three/drei";
import type { NetworkTopology, SensorNode } from "../../domain/types";

export function NetworkLinks({ topology, sensors, selectedId }: { topology: NetworkTopology; sensors: SensorNode[]; selectedId: string }) {
  const byId = new Map(sensors.map((sensor) => [sensor.id, sensor]));
  return <>{topology.connections.filter((connection) => connection.active).map((connection) => {
    const source = byId.get(connection.sourceId);
    const target = byId.get(connection.targetId);
    if (!source || !target) return null;
    const highlighted = connection.sourceId === selectedId || connection.targetId === selectedId;
    const selected = byId.get(selectedId);
    const escapeLink = Boolean(selected?.live?.escapeTo && [connection.sourceId, connection.targetId].includes(selected.id) && [connection.sourceId, connection.targetId].includes(selected.live.escapeTo));
    return <Line key={connection.id} points={[source.position, target.position]} color={escapeLink ? "#22c55e" : highlighted ? "#10b981" : "#94a3b8"} lineWidth={escapeLink ? 3 : highlighted ? 2.2 : 1} transparent opacity={escapeLink || highlighted ? .95 : .36} dashed={!escapeLink && !highlighted} dashSize={.35} gapSize={.22} />;
  })}</>;
}
