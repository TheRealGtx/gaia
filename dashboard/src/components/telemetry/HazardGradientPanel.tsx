"use client";

import { Activity, Flame } from "lucide-react";
import {
  deriveHazardGradient,
  deriveLiveHazardGradient,
  gradientFieldColor,
  liveGradientColor,
  layoutGradientSensors,
  selectSimulatedHazardSource,
} from "../../domain/hazardGradient";
import { useGaiaActions, useGaiaState } from "../../state/hooks";
import { selectActiveEnvironment } from "../../state/selectors";
import { StatusBadge } from "../ui";

export function HazardGradientPanel() {
  const state = useGaiaState();
  const { dispatch } = useGaiaActions();
  const environment = selectActiveEnvironment(state);
  const simulatedSourceId = selectSimulatedHazardSource(environment);
  const model = state.mode === "live"
    ? deriveLiveHazardGradient(environment.sensors.map((sensor) => ({
      sensorId: sensor.id,
      distance: sensor.live?.gradientDistance ?? null,
      offline: sensor.status === "offline",
    })), environment.topology.connections)
    : deriveHazardGradient({
      sensorIds: environment.sensors.map((sensor) => sensor.id),
      sourceId: simulatedSourceId,
      offlineSensorIds: environment.sensors.filter((sensor) => sensor.status === "offline").map((sensor) => sensor.id),
      connections: environment.topology.connections,
    });
  const sourceId = model.sourceId;
  const layout = layoutGradientSensors(environment.sensors.map((sensor) => ({
    id: sensor.id,
    position: sensor.position,
    floorId: sensor.floorId,
  })));
  const plottedNodes = model.nodes.map((node) => ({ ...node, ...layout[node.sensorId] }));
  const nodeById = new Map(plottedNodes.map((node) => [node.sensorId, node]));
  const nodeCount = plottedNodes.length;
  const nodeRadius = nodeCount > 70 ? 2.25 : nodeCount > 42 ? 2.75 : nodeCount > 20 ? 3.35 : 4.25;
  const levelFontSize = Math.max(1.65, Math.min(2.7, nodeRadius * .72));

  return (
    <section className="gradient-panel" aria-label="Mesh hazard gradient">
      <header className="gradient-panel__header">
        <span className="operation-icon operation-icon--gradient"><Activity size={15} /></span>
        <span><strong>Hazard gradient</strong><small>Neighbour hop distance</small></span>
        <StatusBadge status={sourceId ? "critical" : "normal"} dot={false}>{sourceId ? "Active" : "Standby"}</StatusBadge>
      </header>
      <div className="gradient-map">
        <svg viewBox="0 0 100 100" role="img" aria-label={`Mesh gradient from ${sourceId}`}>
          {model.links.map((link) => {
            const source = nodeById.get(link.sourceId);
            const target = nodeById.get(link.targetId);
            const highlighted = link.sourceId === state.selectedSensorId || link.targetId === state.selectedSensorId;
            return source && target ? <line className={highlighted ? "gradient-link--highlighted" : undefined} key={`${link.sourceId}-${link.targetId}`} x1={source.x} y1={source.y} x2={target.x} y2={target.y} /> : null;
          })}
          {plottedNodes.map((node) => (
            <g
              key={node.sensorId}
              className={`gradient-node ${node.sensorId === state.selectedSensorId ? "gradient-node--selected" : ""}`}
              role="button"
              tabIndex={0}
              aria-label={`${node.sensorId}, ${node.level === null ? node.offline ? "offline" : "unreachable" : `gradient level ${node.level}`}`}
              onClick={() => dispatch({ type: "select-sensor", sensorId: node.sensorId })}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") dispatch({ type: "select-sensor", sensorId: node.sensorId }); }}
            >
              <circle cx={node.x} cy={node.y} r={nodeRadius} fill={state.mode === "live" ? liveGradientColor(node.level, node.offline, Boolean(sourceId)) : gradientFieldColor(node.level, model.maxLevel, node.offline, Boolean(sourceId))} />
              {node.level === 0 ? <circle className="gradient-node__source" cx={node.x + nodeRadius * .78} cy={node.y - nodeRadius * .78} r={Math.max(.85, nodeRadius * .32)} /> : null}
              <text x={node.x} y={node.y + levelFontSize * .34} style={{ fontSize: `${levelFontSize}px` }}>{node.level === null ? "—" : node.level}</text>
              <title>{node.sensorId}</title>
            </g>
          ))}
        </svg>
      </div>
      <footer className="gradient-panel__footer">
        <span><Flame size={12} /> {sourceId ? "0 source" : "No active source"}</span>
        <span className="gradient-scale" aria-hidden="true" />
        <span>{state.mode === "live" ? "1 warning · 2+ safe · 99 unknown" : `L${Math.max(2, model.maxLevel)} outer field`}</span>
      </footer>
    </section>
  );
}
