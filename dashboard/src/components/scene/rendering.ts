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
  if (!panelOpen || viewportWidth <= 1180) return 0;
  const panelWidth = Math.min(430, Math.max(310, viewportWidth * 0.32));
  return -(panelWidth + 24) / 2;
}

export function interpolateSceneViewOffset(current: number, target: number, delta: number): number {
  if (Math.abs(target - current) < .5) return target;
  const progress = 1 - Math.exp(-Math.max(0, delta) * 11);
  return current + (target - current) * progress;
}

export function resolveSceneViewOffsetFrame(
  current: number | null,
  target: number,
  delta: number,
  projectionOffsetApplied: boolean,
): { offset: number; apply: boolean } {
  const offset = current === null ? target : interpolateSceneViewOffset(current, target, delta);
  return {
    offset,
    apply: !projectionOffsetApplied || current !== offset,
  };
}
