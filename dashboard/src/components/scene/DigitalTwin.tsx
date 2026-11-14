"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useRef } from "react";
import { PerspectiveCamera } from "three";
import type { EnvironmentId, Vector3Tuple } from "../../domain/types";
import { useGaiaActions, useGaiaState } from "../../state/hooks";
import { selectDashboard } from "../../state/selectors";
import { BuildingScene } from "./building/BuildingScene";
import { EvacuationPath } from "./EvacuationPath";
import { ForestScene } from "./forest/ForestScene";
import { HazardMarker } from "./HazardMarker";
import { NetworkLinks } from "./NetworkLinks";
import { calculateSceneViewOffset, DEFAULT_SHADOW_MAP, resolveSceneViewOffsetFrame } from "./rendering";
import { createSceneModel } from "./sceneModel";
import { SensorMarker } from "./SensorMarker";
import { capturePerspectiveCameraView, type CameraSyncChannel } from "./cameraSync";

function SceneLayout({ panelOpen }: { panelOpen: boolean }) {
  const { camera, size } = useThree();
  const currentOffset = useRef<number | null>(null);
  const projectionOffsetApplied = useRef(false);

  useFrame((_, delta) => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const target = calculateSceneViewOffset(panelOpen, size.width);
    const frame = resolveSceneViewOffsetFrame(currentOffset.current, target, delta, projectionOffsetApplied.current);
    currentOffset.current = frame.offset;
    if (!frame.apply) return;
    if (frame.offset === 0) camera.clearViewOffset();
    else camera.setViewOffset(size.width, size.height, frame.offset, 0, size.width, size.height);
    projectionOffsetApplied.current = true;
    camera.updateProjectionMatrix();
  });

  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    return () => {
      projectionOffsetApplied.current = false;
      camera.clearViewOffset();
      camera.updateProjectionMatrix();
    };
  }, [camera]);
  return null;
}

function SynchronizedOrbitControls({
  cameraSync,
  environmentId,
  target,
  minDistance,
  maxDistance,
}: {
  cameraSync: CameraSyncChannel;
  environmentId: EnvironmentId;
  target: Vector3Tuple;
  minDistance: number;
  maxDistance: number;
}) {
  const { camera } = useThree();
  const publishView = useCallback(() => {
    if (camera instanceof PerspectiveCamera) {
      cameraSync.publish(capturePerspectiveCameraView(environmentId, camera));
    }
  }, [camera, cameraSync, environmentId]);

  useEffect(() => publishView(), [publishView]);

  return (
    <OrbitControls
      makeDefault
      enableDamping
      dampingFactor={.08}
      minDistance={minDistance}
      maxDistance={maxDistance}
      maxPolarAngle={Math.PI / 2.04}
      target={target}
      onChange={publishView}
    />
  );
}

export function DigitalTwin({ cameraSync }: { cameraSync: CameraSyncChannel }) {
  const state = useGaiaState();
  const { dispatch } = useGaiaActions();
  const { environment, bestRoute } = selectDashboard(state);
  const model = createSceneModel(environment, state.showRoutes ? bestRoute : null, state.selectedFloorId);
  return (
    <section className="digital-twin" data-mobile-visible={state.mobilePanel === "map"} aria-label={`Interactive 3D digital twin of ${environment.definition.name}`}>
      <Suspense fallback={<div className="scene-loading">Loading digital twin…</div>}>
        <Canvas key={`${environment.definition.id}-${state.cameraResetToken}`} shadows={{ type: DEFAULT_SHADOW_MAP }} dpr={[1, 1.5]} camera={{ position: environment.definition.kind === "building" ? [46, 34, 46] : [58, 46, 60], fov: 35, near: .1, far: 260 }}>
          <SceneLayout panelOpen={state.telemetryPanelOpen} />
          <color attach="background" args={[state.theme === "dark" ? "#070b10" : "#f7faf9"]} />
          <ambientLight intensity={1.4} />
          <directionalLight castShadow position={[14, 24, 18]} intensity={2.4} shadow-mapSize={[1024, 1024]} />
          {environment.definition.kind === "building" ? <BuildingScene definition={environment.definition} floorId={state.selectedFloorId} selectedRoomId={state.selectedRoomId} onSelectRoom={(roomId) => dispatch({ type: "select-room", roomId })} /> : <ForestScene definition={environment.definition} />}
          {state.showNetwork ? <NetworkLinks topology={{ ...environment.topology, connections: model.networkLinks }} sensors={model.sensors} selectedId={state.selectedSensorId} /> : null}
          {model.hazards.map((hazard) => <HazardMarker key={hazard.id} hazard={hazard} />)}
          {model.sensors.map((sensor) => <SensorMarker key={sensor.id} sensor={sensor} selected={sensor.id === state.selectedSensorId} onSelect={() => dispatch({ type: "select-sensor", sensorId: sensor.id })} />)}
          {state.showRoutes ? <EvacuationPath points={model.routePoints} /> : null}
          <SynchronizedOrbitControls
            cameraSync={cameraSync}
            environmentId={environment.definition.id}
            minDistance={environment.definition.kind === "building" ? 24 : 32}
            maxDistance={environment.definition.kind === "building" ? 100 : 135}
            target={[0, environment.definition.kind === "building" ? 7.2 : 0, 0]}
          />
        </Canvas>
      </Suspense>
    </section>
  );
}
