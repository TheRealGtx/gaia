"use client";

import { Network, PanelLeftClose } from "lucide-react";
import { useGaiaActions, useGaiaState } from "../../state/hooks";
import { selectDashboard } from "../../state/selectors";
import { Button, MetricCard, SegmentedControl } from "../ui";
import { SensorCard } from "./SensorCard";

export function TelemetryPanel() {
  const state = useGaiaState();
  const { dispatch } = useGaiaActions();
  const { environment, metrics } = selectDashboard(state);
  return (
    <aside className="telemetry-panel" data-mobile-visible={state.mobilePanel === "sensors"} aria-hidden={!state.telemetryPanelOpen && state.mobilePanel !== "sensors"}>
      <header className="telemetry-panel__header">
        <SegmentedControl label="Sensor panel content" value={state.telemetryView} options={[{ value: "telemetry", label: "Telemetry" }, { value: "sensors", label: "Sensor nodes" }]} onChange={(view) => dispatch({ type: "set-telemetry-view", view })} />
        <Button className="telemetry-close-button" icon={PanelLeftClose} iconOnly variant="ghost" onClick={() => dispatch({ type: "toggle-telemetry-panel" })} aria-label="Close sensor telemetry panel" />
      </header>
      <div className="telemetry-panel__content">
        {state.telemetryView === "telemetry" ? (
          <section className="telemetry-summary" aria-label="Environment telemetry">
            <div className="metric-grid">
              <MetricCard label="Active sensors" value={`${metrics.activeSensors}/${environment.sensors.length}`} detail={`${Math.round(metrics.activeSensors / environment.sensors.length * 100)}%`} />
              <MetricCard label="Confirmed alerts" value={metrics.activeAlerts} detail={metrics.activeAlerts ? "Active" : "Clear"} />
              <MetricCard label="Avg temperature" value={metrics.averageTemperature === null ? "—" : `${metrics.averageTemperature.toFixed(1)}°`} detail={environment.definition.kind === "building" ? "Indoor" : "Outdoor"} />
              <MetricCard label="Network health" value={`${environment.topology.connections.filter((item) => item.active).length}`} detail="active links" />
            </div>
          </section>
        ) : (
          <section className="sensor-list-view" aria-label="Deployed sensor nodes">
            <div className="sensor-list__head"><h3>Deployed sensor nodes</h3><span>Select to inspect</span></div>
            <div className="sensor-list">
              {environment.sensors.map((sensor) => <SensorCard key={sensor.id} sensor={sensor} selected={sensor.id === state.selectedSensorId} onSelect={() => dispatch({ type: "select-sensor", sensorId: sensor.id })} />)}
            </div>
          </section>
        )}
      </div>
      <footer className="telemetry-footer"><span><Network size={14} /> P2P decentralized mesh</span><span>{environment.connection}</span></footer>
    </aside>
  );
}
