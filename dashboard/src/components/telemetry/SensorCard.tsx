"use client";

import { Clock3, Radio } from "lucide-react";
import type { SensorNode } from "../../domain/types";
import { StatusBadge } from "../ui";
import { formatGradientDistancePresentation, formatModelPresentation, formatTemperaturePresentation } from "./modelPresentation";

const STATUS_LABELS = { normal: "Normal", warning: "Elevated", critical: "Critical", offline: "Offline", stale: "Stale", unknown: "Unknown" } as const;

export function SensorCard({ sensor, selected, now, onSelect }: { sensor: SensorNode; selected: boolean; now: Date; onSelect(): void }) {
  const model = sensor.live
    ? formatModelPresentation(
      sensor.live.mu,
      sensor.live.sigma,
      sensor.live.n,
      sensor.live.modelUpdatedAt,
      now,
      sensor.status === "offline",
    )
    : null;
  const temperature = formatTemperaturePresentation(sensor.reading.temperature, sensor.live?.simulated);
  const gradientDistance = sensor.live
    ? formatGradientDistancePresentation(sensor.live.gradientDistance, sensor.status)
    : null;
  return (
    <button type="button" className={`sensor-card ${selected ? "sensor-card--selected" : ""}`} aria-pressed={selected} onClick={onSelect}>
      <span className="sensor-card__header">
        <span className="sensor-card__identity">
          <span className="sensor-card__id"><span className={`sensor-pulse sensor-pulse--${sensor.status}`} aria-hidden="true" /><strong>Node {sensor.id}</strong></span>
          <span className="sensor-card__location">{sensor.name}</span>
        </span>
        <StatusBadge status={sensor.status} dot={false}>{STATUS_LABELS[sensor.status]}</StatusBadge>
      </span>
      <span className="sensor-card__readings"><span><small>Temperature</small><span className="sensor-card__reading-value"><strong>{temperature.value}</strong>{temperature.simulatedLabel ? <span className="simulated-reading simulated-reading--chip" title="Simulated input, not measured">{temperature.simulatedLabel}</span> : null}</span></span><span><small>Humidity</small><strong>{sensor.reading.humidity === null ? "—" : `${sensor.reading.humidity}%`}</strong></span><span><small>Anomaly</small><strong>{sensor.reading.anomalyScore === null ? "—" : `${Math.round(sensor.reading.anomalyScore * 100)}%`}</strong></span></span>
      {selected && sensor.live && model ? <span className="sensor-card__live-detail"><span>Hazard distance <strong>{gradientDistance}</strong></span><span>Next hop <strong>{sensor.live.escapeTo ?? "—"}</strong></span><span className="sensor-card__model">Local model <strong>{model.value}</strong><small>{model.age}</small></span></span> : null}
      <span className="sensor-card__meta"><span><Radio size={13} aria-hidden="true" /> {sensor.connectivity}</span><span><Clock3 size={13} aria-hidden="true" /> Updated {new Date(sensor.reading.lastUpdate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span></span>
    </button>
  );
}
