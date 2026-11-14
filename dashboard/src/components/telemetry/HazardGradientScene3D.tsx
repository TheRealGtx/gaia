"use client";

import { Line, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import type { DataSource } from "../../domain/types";
import { gradientFieldColor, liveGradientColor } from "../../domain/hazardGradient";
import { fitHazardGradientScene, type HazardGradientSceneModel, type HazardGradientSceneNode } from "./hazardGradientSceneModel";

function GradientSensorPoint({
  node,
  color,
  radius,
  source,
  onSelect,
}: {
  node: HazardGradientSceneNode;
  color: string;
  radius: number;
  source: boolean;
  onSelect(): void;
}) {
  const emphasized = source || node.selected;
  return (
    <group
      position={node.position}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      <mesh scale={node.selected ? 1.22 : 1}>
        <sphereGeometry args={[radius, 20, 20]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {emphasized ? (
        <mesh>
          <sphereGeometry args={[radius * (node.selected ? 1.55 : 1.38), 16, 16]} />
          <meshBasicMaterial color={node.selected ? "#ffffff" : "#83d67a"} wireframe transparent opacity={.9} />
        </mesh>
      ) : null}
    </group>
  );
}

export function HazardGradientScene3D({
  scene,
  mode,
  maxLevel,
  sourceId,
  onSelectSensor,
}: {
  scene: HazardGradientSceneModel;
  mode: DataSource;
  maxLevel: number;
  sourceId: string | null;
  onSelectSensor(sensorId: string): void;
}) {
  const frame = fitHazardGradientScene(scene.nodes.map((node) => node.position));
  const selectedIds = new Set(scene.nodes.filter((node) => node.selected).map((node) => node.sensorId));
  return (
    <Canvas
      aria-hidden="true"
      frameloop="demand"
      dpr={[1, 1.5]}
      camera={{ position: frame.cameraPosition, fov: 40, near: .1, far: frame.maxDistance * 4 }}
    >
      {scene.links.map((link) => {
        const highlighted = selectedIds.has(link.sourceId) || selectedIds.has(link.targetId);
        return (
          <Line
            key={`${link.sourceId}-${link.targetId}`}
            points={[link.source, link.target]}
            color={highlighted ? "#cbd5e1" : "#69727d"}
            lineWidth={highlighted ? 1.8 : 1}
            transparent
            opacity={highlighted ? .92 : .5}
          />
        );
      })}
      {scene.nodes.map((node) => (
        <GradientSensorPoint
          key={node.sensorId}
          node={node}
          color={mode === "live"
            ? liveGradientColor(node.level, node.offline, Boolean(sourceId))
            : gradientFieldColor(node.level, maxLevel, node.offline, Boolean(sourceId))}
          radius={frame.pointRadius}
          source={node.sensorId === sourceId}
          onSelect={() => onSelectSensor(node.sensorId)}
        />
      ))}
      <OrbitControls
        makeDefault
        target={frame.center}
        enableDamping
        dampingFactor={.08}
        enablePan={false}
        enableRotate
        enableZoom
        minDistance={frame.minDistance}
        maxDistance={frame.maxDistance}
        minPolarAngle={.08}
        maxPolarAngle={Math.PI - .08}
      />
    </Canvas>
  );
}
