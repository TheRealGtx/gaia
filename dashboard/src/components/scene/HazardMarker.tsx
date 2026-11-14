"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group } from "three";
import type { Hazard } from "../../domain/types";
import { deriveFireVisual, type FireVisual } from "./fireVisual";
import { advanceAnimationTime } from "./rendering";

type VisualHazard = Hazard & { visual?: FireVisual };

export function HazardMarker({ hazard }: { hazard: VisualHazard }) {
  const flames = useRef<Group>(null);
  const animationTime = useRef(0);
  const visual = hazard.visual ?? deriveFireVisual(null, null, hazard.radius);
  const flameData = useMemo(() => Array.from({ length: visual.flameCount }, (_, index) => {
    const angle = index * 2.39996;
    const spread = index === 0 ? 0 : visual.radius * (.12 + (index % 3) * .09);
    return {
      x: Math.cos(angle) * spread,
      z: Math.sin(angle) * spread,
      height: visual.flameHeight * (.58 + (index % 4) * .12),
      width: .28 + visual.intensity * .34 + (index % 2) * .08,
      color: ["#ef4444", "#f97316", "#facc15"][index % 3],
    };
  }), [visual.flameCount, visual.flameHeight, visual.intensity, visual.radius]);

  useFrame((_, delta) => {
    animationTime.current = advanceAnimationTime(animationTime.current, delta);
    if (!flames.current) return;
    flames.current.rotation.y = animationTime.current * .32;
    flames.current.children.forEach((child, index) => {
      child.scale.y = 1 + Math.sin(animationTime.current * 5.2 + index * .8) * (.1 + visual.intensity * .12);
    });
  });

  if (hazard.kind === "obstruction") return <group position={hazard.position}><mesh castShadow><boxGeometry args={[2.4, 1.1, .45]} /><meshStandardMaterial color="#f59e0b" /></mesh><mesh position={[0, .8, 0]}><octahedronGeometry args={[.35]} /><meshStandardMaterial color="#fff7ed" emissive="#f59e0b" /></mesh></group>;

  return (
    <group position={hazard.position}>
      <mesh rotation-x={-Math.PI / 2} position={[0, .03, 0]}>
        <circleGeometry args={[visual.radius, 64]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={.08 + visual.intensity * .14} depthWrite={false} />
      </mesh>
      <mesh position={[0, visual.radius * .18, 0]} scale={[1, .32, 1]}>
        <sphereGeometry args={[visual.radius, 32, 14]} />
        <meshBasicMaterial color="#fb3b22" transparent opacity={.025 + visual.intensity * .055} depthWrite={false} wireframe />
      </mesh>
      <group ref={flames}>
        {flameData.map((flame, index) => <mesh key={index} position={[flame.x, flame.height / 2, flame.z]} castShadow>
          <coneGeometry args={[flame.width, flame.height, 10]} />
          <meshStandardMaterial color={flame.color} emissive={flame.color} emissiveIntensity={1.2 + visual.intensity * 1.8} transparent opacity={.88} />
        </mesh>)}
      </group>
      {[0, 1, 2].map((index) => <mesh key={`smoke-${index}`} position={[(index - 1) * .35, visual.flameHeight + index * 1.05, (index % 2) * .28]} scale={1 + index * .28}>
        <sphereGeometry args={[.62 + visual.intensity * .42, 14, 10]} />
        <meshStandardMaterial color="#39424b" transparent opacity={visual.smokeOpacity * (1 - index * .18)} depthWrite={false} />
      </mesh>)}
      <pointLight color="#ff6b22" intensity={2 + visual.intensity * 7} distance={8 + visual.radius * 2} decay={2} position={[0, visual.flameHeight * .45, 0]} />
    </group>
  );
}
