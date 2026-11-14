import type { RouteEdge } from "../../../domain/types.ts";

/** Horizontal distance to the full trail, including between waypoints. */
export function distanceToTrail(x: number, z: number, edges: readonly RouteEdge[]): number {
  let closest = Infinity;
  for (const { points } of edges) {
    for (let index = 1; index < points.length; index += 1) {
      const a = points[index - 1];
      const b = points[index];
      const dx = b[0] - a[0];
      const dz = b[2] - a[2];
      const lengthSquared = dx * dx + dz * dz;
      const t = lengthSquared ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / lengthSquared)) : 0;
      closest = Math.min(closest, Math.hypot(x - a[0] - t * dx, z - a[2] - t * dz));
    }
  }
  return closest;
}
