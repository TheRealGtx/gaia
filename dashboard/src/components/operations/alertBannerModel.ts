import type { EnvironmentState, SensorStatus } from "../../domain/types.ts";

export interface AlertBannerModel {
  label: "ALL CLEAR" | "WARNING" | "ALERT" | "GATEWAY DISCONNECTED" | "NETWORK OFFLINE";
  status: SensorStatus;
  detail: string;
}

export function deriveAlertBanner(environment: EnvironmentState): AlertBannerModel {
  if (environment.connection === "disconnected") return { label: "GATEWAY DISCONNECTED", status: "offline", detail: "Last valid readings remain visible" };
  if (environment.sensors.length > 0 && environment.sensors.every((sensor) => sensor.status === "offline")) return { label: "NETWORK OFFLINE", status: "offline", detail: "No node heard within four seconds" };
  if (environment.sensors.some((sensor) => sensor.status === "critical")) return { label: "ALERT", status: "critical", detail: "Network-reported hazard or consensus alert" };
  if (environment.sensors.some((sensor) => sensor.status === "warning" || sensor.status === "unknown" || sensor.status === "stale")) return { label: "WARNING", status: "warning", detail: "Elevated reading or unknown hazard path" };
  return { label: "ALL CLEAR", status: "normal", detail: "No active hazard reported" };
}
