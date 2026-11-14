"use client";

import { Line } from "@react-three/drei";
import type { Vector3Tuple } from "../../domain/types";

export function EvacuationPath({ points }: { points: Vector3Tuple[] }) {
  if (points.length < 2) return null;
  return <group><Line points={points} color="#10b981" lineWidth={5} transparent opacity={.92} /><Line points={points.map(([x, y, z]) => [x, y + .035, z] as Vector3Tuple)} color="#d1fae5" lineWidth={1.5} dashed dashSize={.55} gapSize={.32} /></group>;
}
