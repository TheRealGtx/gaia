import { ENVIRONMENT_BY_ID } from "../config/environments.ts";
import type {
  Alert,
  ConnectivityState,
  EnvironmentId,
  Hazard,
  NetworkEvent,
  SensorNode,
  SensorStatus,
  Vector3Tuple,
} from "../domain/types.ts";
import type { FreshnessState } from "./freshness.ts";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function environmentId(value: unknown): value is EnvironmentId {
  return typeof value === "string" && value in ENVIRONMENT_BY_ID;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function integerOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function booleanOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function status(value: unknown): SensorStatus {
  return ["normal", "warning", "critical", "offline", "stale", "unknown"].includes(String(value))
    ? value as SensorStatus
    : "stale";
}

export function statusFromNetwork(
  distance: number | null,
  alert: boolean | null,
  freshness: FreshnessState,
): SensorStatus {
  if (freshness === "offline") return "offline";
  if (freshness === "stale") return "stale";
  if (alert === true || distance === 0) return "critical";
  if (distance === 1) return "warning";
  if (distance !== null && distance >= 2 && distance < 99) return "normal";
  return "unknown";
}

function connectivity(value: unknown): ConnectivityState {
  return ["connected", "degraded", "offline", "unknown"].includes(String(value))
    ? value as ConnectivityState
    : "unknown";
}

function vector(value: unknown): Vector3Tuple | null {
  return Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === "number")
    ? value as unknown as Vector3Tuple
    : null;
}

function normalizeSensor(value: unknown, id: EnvironmentId): SensorNode | null {
  if (!record(value) || typeof value.id !== "string" || typeof value.name !== "string") return null;
  const position = vector(value.position);
  if (value.environmentId !== id || !position) return null;
  const definition = ENVIRONMENT_BY_ID[id];
  const configured = definition.sensors.find((sensor) => sensor.id === value.id);
  if (!configured) return null;
  const gradientDistance = integerOrNull(value.gradientDistance);
  const networkAlert = booleanOrNull(value.networkAlert);
  const gatewayStatus = status(value.status);
  const freshness: FreshnessState = gatewayStatus === "offline" ? "offline" : gatewayStatus === "stale" ? "stale" : "fresh";

  return {
    ...configured,
    name: value.name,
    position,
    status: gradientDistance === null && networkAlert === null
      ? gatewayStatus
      : statusFromNetwork(gradientDistance, networkAlert, freshness),
    connectivity: connectivity(value.connectivity),
    neighbourIds: Array.isArray(value.neighbourIds)
      ? value.neighbourIds.filter((item): item is string => typeof item === "string")
      : configured.neighbourIds,
    reading: {
      temperature: numberOrNull(value.temperature),
      humidity: numberOrNull(value.humidity),
      anomalyScore: numberOrNull(value.anomalyScore),
      lastUpdate: typeof value.lastUpdate === "string" ? value.lastUpdate : new Date(0).toISOString(),
      source: "live",
    },
    live: {
      gradientDistance,
      via: stringOrNull(value.via),
      escapeTo: stringOrNull(value.escapeTo),
      mu: numberOrNull(value.mu),
      sigma: numberOrNull(value.sigma),
      n: integerOrNull(value.n),
      networkAlert,
      simulated: booleanOrNull(value.simulated),
      bytesSent: integerOrNull(value.bytesSent),
      bytesIfRawData: integerOrNull(value.bytesIfRawData),
      sourceTimestamp: numberOrNull(value.sourceTimestamp),
    },
  };
}

export function normalizeGatewayMessage(value: unknown): NetworkEvent | null {
  if (!record(value) || typeof value.type !== "string") return null;
  if (value.type === "heartbeat" && typeof value.at === "string") return { type: "heartbeat", at: value.at };
  if (value.type === "connection" && typeof value.at === "string") {
    const state = String(value.state);
    if (!["connecting", "connected", "reconnecting", "disconnected"].includes(state)) return null;
    return {
      type: "connection",
      environmentId: environmentId(value.environmentId) ? value.environmentId : undefined,
      state: state as "connecting" | "connected" | "reconnecting" | "disconnected",
      at: value.at,
    };
  }
  if (!environmentId(value.environmentId)) return null;
  const id = value.environmentId;

  if (value.type === "sensor-reading") {
    const sensor = normalizeSensor(value.sensor, id);
    return sensor ? { type: "sensor-reading", environmentId: id, sensor } : null;
  }

  if (value.type === "topology" && Array.isArray(value.connections)) {
    const connections = value.connections.flatMap((item) => {
      if (!record(item) || typeof item.sourceId !== "string" || typeof item.targetId !== "string") return [];
      return [{
        id: [item.sourceId, item.targetId].sort().join("--"),
        sourceId: item.sourceId,
        targetId: item.targetId,
        active: item.active === true,
        strength: typeof item.strength === "number" ? item.strength : 0,
        allowed: true,
      }];
    });
    return {
      type: "topology",
      environmentId: id,
      topology: {
        environmentId: id,
        connections,
        lastUpdate: typeof value.lastUpdate === "string" ? value.lastUpdate : new Date(0).toISOString(),
        source: "live",
      },
    };
  }

  if (value.type === "alert" && record(value.alert)) {
    const alert = value.alert as unknown as Alert;
    return { type: "alert", environmentId: id, alert: { ...alert, environmentId: id, source: "live" } };
  }
  if (value.type === "hazard" && record(value.hazard)) {
    const hazard = value.hazard as unknown as Hazard;
    return { type: "hazard", environmentId: id, hazard: { ...hazard, environmentId: id, source: "live" } };
  }
  if (value.type === "ai-summary" && typeof value.summary === "string") {
    return { type: "ai-summary", environmentId: id, summary: value.summary, source: "live" };
  }

  return null;
}

export function normalizeGatewayMessages(value: unknown): NetworkEvent[] {
  if (!record(value) || value.type !== "snapshot" || !record(value.environments)) {
    const event = normalizeGatewayMessage(value);
    return event ? [event] : [];
  }

  const events: NetworkEvent[] = [];
  for (const [rawEnvironmentId, rawEnvironment] of Object.entries(value.environments)) {
    if (!environmentId(rawEnvironmentId) || !record(rawEnvironment) || !record(rawEnvironment.sensors)) continue;
    for (const rawSensor of Object.values(rawEnvironment.sensors)) {
      const event = normalizeGatewayMessage({ type: "sensor-reading", environmentId: rawEnvironmentId, sensor: rawSensor });
      if (event) events.push(event);
    }
    if (Array.isArray(rawEnvironment.connections)) {
      const topology = normalizeGatewayMessage({
        type: "topology",
        environmentId: rawEnvironmentId,
        connections: rawEnvironment.connections,
        lastUpdate: typeof value.at === "string" ? value.at : new Date().toISOString(),
      });
      if (topology) events.push(topology);
    }
  }
  return events;
}
