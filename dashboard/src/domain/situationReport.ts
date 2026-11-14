import type { EnvironmentState } from "./types.ts";

export interface SituationReport {
  summary: string;
  sourceSensorIds: string[];
  safestSensorId: string | null;
  escapeToSensorId: string | null;
  offlineSensorIds: string[];
}

export function buildSituationReport(environment: EnvironmentState): SituationReport {
  const distanceSources = environment.sensors.filter((sensor) => sensor.live?.gradientDistance === 0);
  const sourceSensors = distanceSources.length
    ? distanceSources
    : environment.sensors.filter((sensor) => sensor.live?.networkAlert === true);
  const safest = environment.sensors
    .filter((sensor) => sensor.status !== "offline" && sensor.live?.gradientDistance !== null && sensor.live?.gradientDistance !== undefined && sensor.live.gradientDistance < 99)
    .sort((left, right) => (right.live?.gradientDistance ?? -1) - (left.live?.gradientDistance ?? -1))[0] ?? null;
  const escapeToSensorId = sourceSensors.map((sensor) => sensor.live?.escapeTo).find((id): id is string => Boolean(id)) ?? null;
  const offlineSensorIds = environment.sensors.filter((sensor) => sensor.status === "offline").map((sensor) => sensor.id);
  const simulatedDisclosure = environment.sensors.some((sensor) => sensor.live?.simulated === true)
    ? " Readings simulated."
    : "";
  const summary = sourceSensors.length
    ? `Hazard source reported by ${sourceSensors.map((sensor) => sensor.id).join(", ")}. ${escapeToSensorId ? `Prototype node guidance points toward ${escapeToSensorId}.` : "No escape neighbour is currently available."}${offlineSensorIds.length ? ` Offline: ${offlineSensorIds.join(", ")}.` : ""}${simulatedDisclosure}`
    : `No active hazard reported. ${offlineSensorIds.length ? `${offlineSensorIds.length} node${offlineSensorIds.length === 1 ? " is" : "s are"} offline.` : "All reporting nodes are online."}${simulatedDisclosure}`;
  return {
    summary,
    sourceSensorIds: sourceSensors.map((sensor) => sensor.id),
    safestSensorId: safest?.id ?? null,
    escapeToSensorId,
    offlineSensorIds,
  };
}
