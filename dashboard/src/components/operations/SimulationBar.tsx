"use client";

import { Ban, Flame, FlaskConical, Network, RefreshCw, ThermometerSun, Wifi, WifiOff } from "lucide-react";
import { useGaiaActions, useGaiaState } from "../../state/hooks";
import { selectActiveEnvironment } from "../../state/selectors";
import { Button, Card } from "../ui";

export function SimulationBar() {
  const state = useGaiaState();
  const { dispatch, runSimulation } = useGaiaActions();
  const environment = selectActiveEnvironment(state);
  if (state.mode !== "simulation") return null;
  const selectedSensor = environment.sensors.find((sensor) => sensor.id === state.selectedSensorId);
  const isOffline = selectedSensor?.status === "offline";
  const fires = environment.hazards.filter((hazard) => hazard.kind === "simulated-fire");
  const hasFire = fires.some((hazard) => hazard.sourceSensorId === state.selectedSensorId);
  const blocked = environment.blockedEdgeIds.includes(environment.definition.blockableEdgeId);
  return (
    <Card className="operation-card">
      <header><span className="operation-icon"><FlaskConical size={15} aria-hidden="true" /></span><h2>Simulation controls</h2></header>
      <div className="simulation-panel__content">
        <p>Apply a scenario to <strong>{state.selectedSensorId}</strong>. Select another node from the map or Sensors.</p>
        <p>{fires.length} active {fires.length === 1 ? "fire" : "fires"}. Select another sensor to add a fire; Reset clears all scenarios.</p>
        <div className="simulation-bar" role="group" aria-label="Simulation controls">
          <Button variant={hasFire ? "danger" : "outline"} icon={Flame} disabled={hasFire || isOffline || !selectedSensor} onClick={() => runSimulation({ type: "confirm-fire", sensorId: state.selectedSensorId })}>{hasFire ? "Fire active at" : "Add fire at"} {state.selectedSensorId}</Button>
          <Button variant={blocked ? "active" : "outline"} icon={Ban} aria-pressed={blocked} onClick={() => runSimulation({ type: "block-edge", edgeId: environment.definition.blockableEdgeId })}>{environment.definition.kind === "building" ? "Block corridor" : "Block trail"}</Button>
          <Button icon={isOffline ? Wifi : WifiOff} disabled={!selectedSensor} onClick={() => runSimulation({ type: isOffline ? "enable-node" : "disable-node", sensorId: state.selectedSensorId })}>{isOffline ? "Enable" : "Disable"} {state.selectedSensorId}</Button>
          <Button disabled={isOffline || !selectedSensor} icon={ThermometerSun} onClick={() => runSimulation({ type: "increase-temperature", sensorId: state.selectedSensorId, delta: 5 })}>+5°C</Button>
          <Button icon={Network} onClick={() => runSimulation({ type: "network-failure", sensorIds: [environment.definition.offlineSensorId] })}>Network fault</Button>
          <Button icon={RefreshCw} onClick={() => { runSimulation({ type: "reset" }); dispatch({ type: "reset-camera" }); }}>Reset</Button>
        </div>
      </div>
    </Card>
  );
}
