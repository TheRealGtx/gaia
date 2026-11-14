"use client";

import { Clock3, Radio } from "lucide-react";
import type { SensorNode } from "../../domain/types";
import { StatusBadge } from "../ui";

const STATUS_LABELS = { normal: "Normal", warning: "Elevated", critical: "Critical", offline: "Offline", stale: "Stale", unknown: "Unknown" } as const;

export function SensorCard({ sensor, selected, onSelect }: { sensor: SensorNode; selected: boolean; onSelect(): void }) {
  return (
    <button className={`sensor-card ${selected ? "sensor-card--selected" : ""}`} aria-pressed={selected} onClick={onSelect}>
      <span className="sensor-card__header"><span className="sensor-card__id"><span className={`sensor-pulse sensor-pulse--${sensor.status}`} /><strong>Node {sensor.id}</strong><span>·</span><span>{sensor.name}</span></span><StatusBadge status={sensor.status} dot={false}>{STATUS_LABELS[sensor.status]}</StatusBadge></span>
      <span className="sensor-card__readings"><span><small>Temperature</small><strong>{sensor.reading.temperature === null ? "—" : `${sensor.reading.temperature}°C`}</strong></span><span><small>Humidity</small><strong>{sensor.reading.humidity === null ? "—" : `${sensor.reading.humidity}%`}</strong></span><span><small>Anomaly</small><strong>{sensor.reading.anomalyScore === null ? "—" : `${Math.round(sensor.reading.anomalyScore * 100)}%`}</strong></span></span>
      {sensor.live?.simulated ? <span className="simulated-reading simulated-reading--card">Simulated input · not measured</span> : null}
      {selected && sensor.live ? <span className="sensor-card__live-detail"><span>dist <strong>{sensor.live.gradientDistance === null || sensor.live.gradientDistance >= 99 ? "unknown" : sensor.live.gradientDistance}</strong></span><span>escape <strong>{sensor.live.escapeTo ?? "—"}</strong></span><span>model <strong>{(sensor.live.n ?? 0) < 20 ? `learning (${sensor.live.n ?? 0}/20)` : `μ ${sensor.live.mu?.toFixed(1) ?? "—"}°C · σ ${sensor.live.sigma?.toFixed(1) ?? "—"}`}</strong></span></span> : null}
      <span className="sensor-card__meta"><span><Radio size={12} /> {sensor.connectivity}</span><span><Clock3 size={12} /> {new Date(sensor.reading.lastUpdate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span></span>
    </button>
  );
}
