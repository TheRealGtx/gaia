import type { Vector3Tuple } from "../../domain/types.ts";
import { forestElevation } from "../../domain/terrain.ts";

/** Match the terrain's half-metre sampling while preserving every trail bend. */
export function projectForestRoute(points: readonly Vector3Tuple[]): Vector3Tuple[] {
  const projected: Vector3Tuple[] = [];
  const lift = (x: number, z: number): Vector3Tuple => [x, forestElevation(x, z) + .35, z];
  if (points.length === 0) return projected;
  projected.push(lift(points[0][0], points[0][2]));
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1];
    const b = points[index];
    const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / .5));
    for (let step = 1; step < steps; step += 1) {
      const t = step / steps;
      projected.push(lift(a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t));
    }
    projected.push(lift(b[0], b[2]));
  }
  return projected;
}
