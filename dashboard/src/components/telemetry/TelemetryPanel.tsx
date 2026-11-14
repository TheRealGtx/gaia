"use client";

import { Network, PanelLeftClose } from "lucide-react";
import { useEffect, useState } from "react";
import { useGaiaActions, useGaiaState } from "../../state/hooks";
import { selectDashboard } from "../../state/selectors";
import { Button, SegmentedControl } from "../ui";
import { startModelAgeTicker } from "./modelPresentation";
import { SensorCard } from "./SensorCard";
import { AlertMetricCard, SemicircleGaugeCard, TemperatureGaugeCard } from "./TelemetryGauge";

export function TelemetryPanel() {
  const state = useGaiaState();
  const { dispatch } = useGaiaActions();
  const { environment, metrics } = selectDashboard(state);
  const [modelAgeNow, setModelAgeNow] = useState(() => new Date());
  const sensorDetailsVisible = state.telemetryView === "sensors"
    && (state.telemetryPanelOpen || state.mobilePanel === "sensors");
  const sensorPercent = environment.sensors.length
    ? Math.round(metrics.activeSensors / environment.sensors.length * 100)
    : null;
  const linkPercent = metrics.totalLinks
    ? Math.round(metrics.activeLinks / metrics.totalLinks * 100)
    : null;
  useEffect(() => {
    if (!sensorDetailsVisible) return;
    return startModelAgeTicker(setModelAgeNow);
  }, [sensorDetailsVisible]);
  return (
    <aside className="telemetry-panel" aria-label="Sensor telemetry">
      <header className="telemetry-panel__header">
        <SegmentedControl label="Sensor panel content" value={state.telemetryView} options={[{ value: "telemetry", label: "Telemetry" }, { value: "sensors", label: "Sensor nodes" }]} onChange={(view) => dispatch({ type: "set-telemetry-view", view })} />
        <Button className="telemetry-close-button" icon={PanelLeftClose} iconOnly variant="ghost" onClick={() => { dispatch({ type: "toggle-telemetry-panel" }); document.getElementById("sensor-panel-toggle")?.focus(); }} aria-label="Close sensor telemetry panel" />
      </header>
      <div className="telemetry-panel__content">
        {state.telemetryView === "telemetry" ? (
          <section className="telemetry-summary" aria-label="Environment telemetry">
            <div className="metric-grid">
              <SemicircleGaugeCard label="Active sensors" value={`${metrics.activeSensors}/${environment.sensors.length}`} detail={sensorPercent === null ? "Unavailable" : `${sensorPercent}% online`} percent={sensorPercent} />
              <AlertMetricCard count={metrics.activeAlerts} />
              <TemperatureGaugeCard average={metrics.averageTemperature} minimum={metrics.minimumTemperature} maximum={metrics.maximumTemperature} context={environment.definition.kind === "building" ? "Indoor" : "Outdoor"} />
              <SemicircleGaugeCard label="Network health" value={metrics.totalLinks ? `${metrics.activeLinks}/${metrics.totalLinks}` : "—"} detail={linkPercent === null ? "Awaiting topology" : `${linkPercent}% active`} percent={linkPercent} />
            </div>
          </section>
        ) : (
          <section className="sensor-list-view" aria-label="Deployed sensor nodes">
            <div className="sensor-list__head"><h3>Deployed sensor nodes</h3><span>Select to inspect</span></div>
            <div className="sensor-list">
              {environment.sensors.map((sensor) => <SensorCard key={sensor.id} sensor={sensor} selected={sensor.id === state.selectedSensorId} now={modelAgeNow} onSelect={() => dispatch({ type: "select-sensor", sensorId: sensor.id })} />)}
            </div>
          </section>
        )}
      </div>
      <footer className="telemetry-footer"><span><Network size={14} /> P2P decentralized mesh</span><span>{environment.connection}</span></footer>
    </aside>
  );
}
