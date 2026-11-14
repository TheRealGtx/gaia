"use client";

import { Ban, Flame, Network, RefreshCw, ThermometerSun, TriangleAlert, WifiOff } from "lucide-react";
import { useGaiaActions, useGaiaState } from "../../state/hooks";
import { selectActiveEnvironment } from "../../state/selectors";
import { Button } from "../ui";

export function SimulationBar() {
  const state = useGaiaState();
  const { dispatch, runSimulation } = useGaiaActions();
  const environment = selectActiveEnvironment(state);
  if (state.mode !== "simulation") return <div className="simulation-bar simulation-bar--live"><Network size={15} /><span>Dashboard is read-only: the network works without it.</span><strong>{state.globalConnection}</strong></div>;
  const hasFire = environment.hazards.some((hazard) => hazard.kind === "simulated-fire");
  const blocked = environment.blockedEdgeIds.includes(environment.definition.blockableEdgeId);
  return (
    <div className="simulation-bar" role="group" aria-label="Simulation controls">
      <span className="simulation-bar__label">Simulate</span>
      <Button variant={hasFire ? "danger" : "dark"} icon={Flame} aria-pressed={hasFire} onClick={() => runSimulation({ type: "confirm-fire", sensorId: state.selectedSensorId })}>Fire at {state.selectedSensorId}</Button>
      <Button variant={blocked ? "active" : "dark"} icon={Ban} aria-pressed={blocked} onClick={() => runSimulation({ type: "block-edge", edgeId: environment.definition.blockableEdgeId })}>{environment.definition.kind === "building" ? "Block corridor" : "Block trail"}</Button>
      <Button variant="dark" icon={WifiOff} onClick={() => runSimulation({ type: "disable-node", sensorId: state.selectedSensorId })}>Disable {state.selectedSensorId}</Button>
      <Button variant="dark" icon={ThermometerSun} onClick={() => runSimulation({ type: "increase-temperature", sensorId: state.selectedSensorId, delta: 5 })}>+5°C</Button>
      <Button variant="dark" icon={TriangleAlert} onClick={() => runSimulation({ type: "simulate-anomaly", sensorId: state.selectedSensorId })}>Anomaly</Button>
      <Button variant="dark" icon={Network} onClick={() => runSimulation({ type: "network-failure", sensorIds: [environment.definition.offlineSensorId] })}>Network fault</Button>
      <Button variant="dark" icon={RefreshCw} onClick={() => { runSimulation({ type: "reset" }); dispatch({ type: "reset-camera" }); }}>Reset</Button>
    </div>
  );
}
