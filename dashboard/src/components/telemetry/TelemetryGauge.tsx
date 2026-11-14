"use client";

import { CircleCheck, Siren } from "lucide-react";
import { useId } from "react";
import type { SensorStatus } from "../../domain/types";
import { GAUGE_ARC_PATH, gaugeArcPoint, gaugePercent, TEMPERATURE_GAUGE_MAX, TEMPERATURE_GAUGE_MIN } from "./telemetryGauges";

function toneForRatio(percent: number | null): SensorStatus {
  if (percent === null) return "offline";
  if (percent >= 85) return "normal";
  if (percent >= 60) return "warning";
  return "critical";
}

export function SemicircleGaugeCard({
  label,
  value,
  detail,
  percent,
}: {
  label: string;
  value: string;
  detail: string;
  percent: number | null;
}) {
  const tone = toneForRatio(percent);
  const bounded = percent ?? 0;
  return (
    <article className={`telemetry-metric-card telemetry-gauge telemetry-gauge--${tone}`} aria-label={`${label}: ${value}, ${detail}`}>
      <header><span>{label}</span></header>
      <div className="telemetry-gauge__visual">
        <svg viewBox="0 0 100 82" aria-hidden="true">
          <path className="telemetry-gauge__track" d={GAUGE_ARC_PATH} pathLength="100" />
          <path className="telemetry-gauge__fill" d={GAUGE_ARC_PATH} pathLength="100" strokeDasharray={`${bounded} ${100 - bounded}`} />
        </svg>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

export function TemperatureGaugeCard({
  average,
  minimum,
  maximum,
  context,
}: {
  average: number | null;
  minimum: number | null;
  maximum: number | null;
  context: string;
}) {
  const gradientId = useId().replaceAll(":", "");
  const averagePercent = gaugePercent(average, TEMPERATURE_GAUGE_MIN, TEMPERATURE_GAUGE_MAX);
  const minimumPercent = gaugePercent(minimum, TEMPERATURE_GAUGE_MIN, TEMPERATURE_GAUGE_MAX);
  const maximumPercent = gaugePercent(maximum, TEMPERATURE_GAUGE_MIN, TEMPERATURE_GAUGE_MAX);
  const minimumPoint = minimumPercent === null ? null : gaugeArcPoint(minimumPercent);
  const averagePoint = averagePercent === null ? null : gaugeArcPoint(averagePercent);
  const maximumPoint = maximumPercent === null ? null : gaugeArcPoint(maximumPercent);
  const rangeStart = minimumPercent ?? 0;
  const rangeLength = minimumPercent === null || maximumPercent === null ? 0 : Math.max(0, maximumPercent - minimumPercent);
  const accessibleRange = average === null || minimum === null || maximum === null
    ? "No temperature readings"
    : `average ${average.toFixed(1)} degrees, minimum ${minimum.toFixed(1)}, maximum ${maximum.toFixed(1)}`;

  return (
    <article className="telemetry-metric-card temperature-gauge" aria-label={`Temperature: ${accessibleRange}, ${context}`}>
      <header><span>Temperature</span></header>
      <div className="telemetry-gauge__visual">
        <svg viewBox="0 0 100 82" aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0" x2="1">
              <stop offset="0" stopColor="#38bdf8" />
              <stop offset=".55" stopColor="#fbbf24" />
              <stop offset="1" stopColor="#fb7185" />
            </linearGradient>
          </defs>
          <path className="telemetry-gauge__track" d={GAUGE_ARC_PATH} pathLength="100" />
          <path className="temperature-gauge__range" d={GAUGE_ARC_PATH} pathLength="100" stroke={`url(#${gradientId})`} strokeDasharray={`0 ${rangeStart} ${rangeLength} ${Math.max(0, 100 - rangeStart - rangeLength)}`} />
          {minimumPoint ? <circle className="temperature-gauge__edge" cx={minimumPoint.x} cy={minimumPoint.y} r="2.3" /> : null}
          {maximumPoint ? <circle className="temperature-gauge__edge" cx={maximumPoint.x} cy={maximumPoint.y} r="2.3" /> : null}
          {averagePoint ? <circle className="temperature-gauge__average" cx={averagePoint.x} cy={averagePoint.y} r="3.4" /> : null}
        </svg>
        <div className="temperature-gauge__readout">
          <span><small>Low</small><b>{minimum === null ? "—" : `${minimum.toFixed(1)}°`}</b></span>
          <strong>{average === null ? "—" : `${average.toFixed(1)}°`}</strong>
          <span><small>High</small><b>{maximum === null ? "—" : `${maximum.toFixed(1)}°`}</b></span>
        </div>
      </div>
    </article>
  );
}

export function AlertMetricCard({ count }: { count: number }) {
  const active = count > 0;
  const Icon = active ? Siren : CircleCheck;
  return (
    <article className={`telemetry-metric-card alert-metric ${active ? "alert-metric--active" : "alert-metric--clear"}`} aria-label={`Confirmed alerts: ${count}, ${active ? "active" : "clear"}`}>
      <header><span>Confirmed alerts</span></header>
      <div className="alert-metric__body"><Icon size={28} aria-hidden="true" /><strong>{count}</strong></div>
      <div className="alert-metric__rail" aria-hidden="true"><span /></div>
    </article>
  );
}
