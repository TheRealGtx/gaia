import { PCFShadowMap } from "three";
import type { SensorStatus } from "../../domain/types";

const SENSOR_MARKER_COLORS: Record<SensorStatus, string> = {
  normal: "#2563eb",
  warning: "#f59e0b",
  critical: "#ef4444",
  offline: "#94a3b8",
  stale: "#94a3b8",
  unknown: "#64748b",
};

/** Supported shadow map configuration for current Three.js releases. */
export const DEFAULT_SHADOW_MAP = PCFShadowMap;

/** Keeps animation time local to each component and avoids the deprecated THREE.Clock API. */
export function advanceAnimationTime(previous: number, delta: number): number {
  return previous + delta;
}

export function sensorMarkerColor(status: SensorStatus): string {
  return SENSOR_MARKER_COLORS[status];
}

export function calculateSceneViewOffset(panelOpen: boolean, viewportWidth: number): number {
  if (!panelOpen || viewportWidth <= 760) return 0;
  const panelWidth = Math.min(430, Math.max(310, viewportWidth * 0.32));
  return -(panelWidth + 24) / 2;
}
