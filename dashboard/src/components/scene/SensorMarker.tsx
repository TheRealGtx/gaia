"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Vector2, type Group } from "three";
import type { SensorNode } from "../../domain/types";
import { advanceAnimationTime, sensorMarkerColor } from "./rendering";
import { formatGradientDistancePresentation } from "../telemetry/modelPresentation";

// One revolved mesh forms the stacked rain shields around the instrument.
const SENSOR_HOUSING_PROFILE = [
  new Vector2(0, 0), new Vector2(.25, 0),
  ...Array.from({ length: 4 }, (_, index) => [
    new Vector2(.26, index * .16 + .03),
    new Vector2(.43, index * .16 + .07),
    new Vector2(.43, index * .16 + .1),
    new Vector2(.28, index * .16 + .14),
  ]).flat(),
  new Vector2(.28, .7), new Vector2(0, .7),
];

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
      <mesh position={[0, -.1, 0]} castShadow receiveShadow><cylinderGeometry args={[.075, .11, 2.2, 10]} /><meshStandardMaterial color="#7f8c89" roughness={.5} metalness={.65} /></mesh>
      <mesh position={[0, .52, 0]} castShadow receiveShadow><latheGeometry args={[SENSOR_HOUSING_PROFILE, 16]} /><meshStandardMaterial color="#e1e5dc" roughness={.72} metalness={.08} /></mesh>
      <mesh position={[0, 1.26, 0]} castShadow><cylinderGeometry args={[.32, .43, .16, 16]} /><meshStandardMaterial color="#394846" roughness={.55} metalness={.3} /></mesh>
      <mesh position={[0, 1.36, 0]}><cylinderGeometry args={[.27, .27, .07, 16]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected || sensor.status === "critical" ? 1.5 : .65} toneMapped={false} /></mesh>
      <mesh position={[-.27, 1.65, 0]} castShadow><cylinderGeometry args={[.025, .045, .8, 8]} /><meshStandardMaterial color="#2d373a" roughness={.8} /></mesh>
      {sensor.environmentId === "forest-north" ? (
        <group position={[.58, .65, 0]} rotation={[0, 0, -.45]}>
          <mesh castShadow><boxGeometry args={[.62, .07, .8]} /><meshStandardMaterial color="#86958f" metalness={.65} roughness={.45} /></mesh>
          <mesh position={[0, .041, 0]}><boxGeometry args={[.52, .015, .7]} /><meshStandardMaterial color="#203b52" metalness={.35} roughness={.32} /></mesh>
        </group>
      ) : null}
      <group ref={pulse} position={[0, 1.36, 0]}>
        {selected || sensor.status === "critical" ? <mesh rotation-x={-Math.PI / 2}><ringGeometry args={[.62, .7, 36]} /><meshBasicMaterial color={color} transparent opacity={selected ? .9 : .65} depthWrite={false} /></mesh> : null}
      </group>
      {selected ? (
        <Html position={[0, 2.15, 0]} zIndexRange={[3, 0]}>
          <button type="button" className="scene-label" onClick={onSelect}>
            <small>Selected sensor</small>
            <strong>{sensor.id}</strong>
            <span>{sensor.name}</span>
            {sensor.live ? <span>Hazard distance · {formatGradientDistancePresentation(sensor.live.gradientDistance, sensor.status)}</span> : null}
          </button>
        </Html>
      ) : null}
    </group>
  );
}
