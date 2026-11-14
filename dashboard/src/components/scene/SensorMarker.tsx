"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import type { SensorNode } from "../../domain/types";
import { advanceAnimationTime, sensorMarkerColor } from "./rendering";

export function SensorMarker({ sensor, selected, onSelect }: { sensor: SensorNode; selected: boolean; onSelect(): void }) {
  const pulse = useRef<Group>(null);
  const animationTime = useRef(0);
  useFrame((_, delta) => {
    animationTime.current = advanceAnimationTime(animationTime.current, delta);
    if (!pulse.current) return;
    if (sensor.status !== "critical") {
      pulse.current.scale.setScalar(1);
      return;
    }
    const scale = 1 + Math.sin(animationTime.current * 4) * 0.18;
    pulse.current.scale.setScalar(scale);
  });
  const color = sensorMarkerColor(sensor.status);
  return (
    <group position={sensor.position} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      <group ref={pulse} position={[0, 1, 0]}>
        <mesh castShadow><sphereGeometry args={[selected ? .48 : .38, 24, 24]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected || sensor.status === "critical" ? 1.2 : .35} /></mesh>
        <mesh rotation-x={-Math.PI / 2}><ringGeometry args={[.62, .72, 36]} /><meshBasicMaterial color={color} transparent opacity={selected ? .95 : .4} /></mesh>
      </group>
      <mesh position={[0, -.05, 0]} castShadow><cylinderGeometry args={[.09, .14, 2, 12]} /><meshStandardMaterial color="#64748b" /></mesh>
      {selected ? <Html position={[0, 1.85, 0]} center distanceFactor={13}><button className="scene-label" onClick={onSelect}><strong>{sensor.id}</strong><span>{sensor.name}</span>{sensor.live ? <span>dist {sensor.live.gradientDistance === null || sensor.live.gradientDistance >= 99 ? "unknown" : sensor.live.gradientDistance}</span> : null}</button></Html> : null}
    </group>
  );
}
