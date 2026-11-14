"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { useLayoutEffect } from "react";
import type { EnvironmentDefinition } from "../../domain/types";
import { useGaiaState } from "../../state/hooks";
import { BuildingScene } from "./building/BuildingScene";
import { ForestScene } from "./forest/ForestScene";

function PreviewCamera({ building }: { building: boolean }) {
  const { camera, invalidate } = useThree();
  useLayoutEffect(() => {
    camera.lookAt(0, building ? 7.2 : 0, 0);
    camera.updateProjectionMatrix();
    invalidate();
  }, [building, camera, invalidate]);
  return null;
}

export function EnvironmentPreview3D({ definition }: { definition: EnvironmentDefinition }) {
  const state = useGaiaState();
  const building = definition.kind === "building";
  return (
    <div className={`environment-preview environment-preview--${definition.kind}`} aria-hidden="true">
      <Canvas
        frameloop="demand"
        dpr={1}
        camera={{ position: building ? [49, 36, 49] : [62, 50, 64], fov: building ? 36 : 40, near: .1, far: 260 }}
      >
        <PreviewCamera building={building} />
        <color attach="background" args={[state.theme === "dark" ? "#0b1714" : building ? "#edf5f0" : "#e5efe1"]} />
        <ambientLight intensity={.45} />
        <hemisphereLight args={["#dce7ed", "#626449", 1.15]} />
        <directionalLight position={[24, 52, 28]} color="#fff1d6" intensity={2.2} />
        {building
          ? <BuildingScene definition={definition} selectedRoomId={null} onSelectRoom={() => undefined} showLabels={false} />
          : <ForestScene definition={definition} showLabels={false} />}
      </Canvas>
      <span>{definition.kind}</span>
    </div>
  );
}
