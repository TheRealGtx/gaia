"use client";

import { Clock3, Database, Radio } from "lucide-react";
import { useGaiaState } from "../../state/hooks";
import { selectActiveEnvironment } from "../../state/selectors";
import { Card, StatusBadge } from "../ui";

export function SensorLogs() {
  const state = useGaiaState();
  const environment = selectActiveEnvironment(state);
  const logs = state.logs.filter((entry) => entry.environmentId === environment.definition.id);
  return (
    <main className="secondary-page logs-page">
      <div className="page-heading"><div><span className="eyebrow">Telemetry stream</span><h1>Sensor logs</h1><p>{environment.definition.name} · normalized {state.mode} events</p></div><StatusBadge status={state.mode === "simulation" ? "warning" : "normal"}>{state.mode}</StatusBadge></div>
      <Card className="table-card"><table><thead><tr><th>Node</th><th>Location</th><th>Status</th><th>Temperature</th><th>Humidity</th><th>Anomaly</th><th>Updated</th></tr></thead><tbody>{environment.sensors.map((sensor) => <tr key={sensor.id}><th scope="row">{sensor.id}</th><td>{sensor.name}</td><td><StatusBadge status={sensor.status}>{sensor.status}</StatusBadge></td><td>{sensor.reading.temperature === null ? "—" : `${sensor.reading.temperature}°C`}</td><td>{sensor.reading.humidity === null ? "—" : `${sensor.reading.humidity}%`}</td><td>{sensor.reading.anomalyScore === null ? "—" : `${Math.round(sensor.reading.anomalyScore * 100)}%`}</td><td>{new Date(sensor.reading.lastUpdate).toLocaleTimeString()}</td></tr>)}</tbody></table></Card>
      <div className="log-layout"><Card className="event-feed"><header><Database size={16} /><h2>Scenario activity</h2><span>{logs.length} events</span></header>{logs.length ? <ul>{logs.map((entry) => <li key={entry.id}><span className="event-feed__icon"><Radio size={14} /></span><span><strong>{entry.message}</strong><small>{entry.source} · {entry.type}</small></span><time><Clock3 size={12} /> {new Date(entry.timestamp).toLocaleTimeString()}</time></li>)}</ul> : <p>No scenario events recorded for this environment.</p>}</Card><Card className="event-feed"><header><Radio size={16} /><h2>Active alerts</h2><span>{environment.alerts.length}</span></header>{environment.alerts.length ? <ul>{environment.alerts.map((alert) => <li key={alert.id}><span className="event-feed__icon"><Radio size={14} /></span><span><strong>{alert.message}</strong><small>{alert.confirmed ? "network confirmed" : "local only"}</small></span></li>)}</ul> : <p>No active alerts.</p>}</Card></div>
    </main>
  );
}
