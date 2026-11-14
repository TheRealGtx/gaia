"use client";

import { Activity, Flame } from "lucide-react";
import dynamic from "next/dynamic";
import {
  deriveHazardGradient,
  deriveLiveHazardGradient,
  liveGradientStateLabel,
  selectSimulatedHazardSource,
} from "../../domain/hazardGradient";
import { useGaiaActions, useGaiaState } from "../../state/hooks";
import { selectActiveEnvironment } from "../../state/selectors";
import { StatusBadge } from "../ui";
import { createHazardGradientSceneModel } from "./hazardGradientSceneModel";
import type { CameraSyncChannel } from "../scene/cameraSync";

const HazardGradientScene3D = dynamic(() => import("./HazardGradientScene3D").then((module) => module.HazardGradientScene3D), {
  ssr: false,
  loading: () => <div className="gradient-map__loading">Loading 3D sensor mesh…</div>,
});

export function HazardGradientPanel({ cameraSync }: { cameraSync: CameraSyncChannel }) {
  const state = useGaiaState();
  const { dispatch } = useGaiaActions();
  const environment = selectActiveEnvironment(state);
  const simulatedSourceId = selectSimulatedHazardSource(environment);
  const model = state.mode === "live"
    ? deriveLiveHazardGradient(environment.sensors.map((sensor) => ({
      sensorId: sensor.id,
      distance: sensor.live?.gradientDistance ?? null,
      offline: sensor.status === "offline",
      alert: sensor.live?.networkAlert === true,
    })), environment.topology.connections)
    : deriveHazardGradient({
      sensorIds: environment.sensors.map((sensor) => sensor.id),
      sourceId: simulatedSourceId,
      offlineSensorIds: environment.sensors.filter((sensor) => sensor.status === "offline").map((sensor) => sensor.id),
      connections: environment.topology.connections,
    });
  const sourceId = model.sourceId;
  const scene = createHazardGradientSceneModel(environment.sensors, model, state.selectedSensorId);

  return (
    <section className="gradient-panel" aria-label="Mesh hazard gradient">
      <header className="gradient-panel__header">
        <span className="operation-icon operation-icon--gradient"><Activity size={15} /></span>
        <span><strong>Hazard gradient</strong><small>Neighbour hop distance</small></span>
        <StatusBadge status={sourceId ? "critical" : "normal"} dot={false}>{sourceId ? "Active" : "Standby"}</StatusBadge>
      </header>
      <p id="hazard-gradient-description" className="sr-only">
        Synchronized 3D sensor mesh. The view follows the main environment map. Only sensor points and their active connections are shown.
      </p>
      <div className="gradient-map" aria-describedby="hazard-gradient-description">
        <HazardGradientScene3D
          key={environment.definition.id}
          scene={scene}
          cameraSync={cameraSync}
          environmentId={environment.definition.id}
          mode={state.mode}
          maxLevel={model.maxLevel}
          sourceId={sourceId}
          onSelectSensor={(sensorId) => dispatch({ type: "select-sensor", sensorId })}
        />
        <div className="gradient-map__controls" role="group" aria-label="Select a sensor in the 3D hazard gradient">
          {scene.nodes.map((node) => {
            const stateLabel = state.mode === "live"
              ? liveGradientStateLabel(node.level, node.offline, Boolean(sourceId))
              : node.offline ? "offline" : node.level === null ? "unreachable" : `gradient level ${node.level}`;
            return (
              <button
                key={node.sensorId}
                type="button"
                className="gradient-map__sensor-control"
                aria-label={`${node.sensorId}, ${stateLabel}`}
                aria-pressed={node.selected}
                onClick={() => dispatch({ type: "select-sensor", sensorId: node.sensorId })}
              >
                {node.sensorId} · {stateLabel}
              </button>
            );
          })}
        </div>
      </div>
      <footer className="gradient-panel__footer">
        <span><Flame size={12} /> {sourceId ? "0 source" : "No active source"}</span>
        <span className="gradient-scale" aria-hidden="true" />
        <span>{state.mode === "live" ? (sourceId ? "1 warning · 2+ safe · 99 unknown" : "No hazard · 99 nominal") : `L${Math.max(2, model.maxLevel)} outer field`}</span>
      </footer>
    </section>
  );
}
