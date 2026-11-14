import type { SensorStatus } from "../../domain/types.ts";

export interface ModelPresentation {
  value: string;
  age: string;
}

export interface TemperaturePresentation {
  value: string;
  simulatedLabel: "Simulated" | null;
}

export interface ModelAgeScheduler {
  now(): Date;
  setInterval(callback: () => void, delay: number): unknown;
  clearInterval(id: unknown): void;
}

const defaultScheduler: ModelAgeScheduler = {
  now: () => new Date(),
  setInterval: (callback, delay) => globalThis.setInterval(callback, delay),
  clearInterval: (id) => globalThis.clearInterval(id as ReturnType<typeof setInterval>),
};

export function formatTemperaturePresentation(
  temperature: number | null,
  simulated: boolean | null | undefined,
): TemperaturePresentation {
  return {
    value: temperature === null ? "—" : `${temperature}°C`,
    simulatedLabel: simulated === true ? "Simulated" : null,
  };
}

export function formatGradientDistancePresentation(
  distance: number | null,
  status: SensorStatus,
): string {
  if (distance === null || distance >= 99) return status === "normal" ? "no hazard" : "unknown";
  return String(distance);
}

export function startModelAgeTicker(
  onTick: (now: Date) => void,
  scheduler: ModelAgeScheduler = defaultScheduler,
): () => void {
  const tick = () => onTick(scheduler.now());
  tick();
  const interval = scheduler.setInterval(tick, 1_000);
  return () => scheduler.clearInterval(interval);
}

export function formatModelPresentation(
  mu: number | null,
  sigma: number | null,
  n: number | null,
  updatedAt: string | null,
  now: Date,
  offline: boolean,
): ModelPresentation {
  if (mu === null || sigma === null || n === null) {
    return { value: "learning", age: "parameters not received" };
  }
  const updatedAtMs = updatedAt ? Date.parse(updatedAt) : Number.NaN;
  const age = Number.isFinite(updatedAtMs)
    ? `updated ${Math.max(0, Math.floor((now.getTime() - updatedAtMs) / 1_000))} s ago`
    : "update time unavailable";
  return {
    value: n < 20 ? `learning (${n}/20)` : `μ ${mu.toFixed(1)}°C · σ ${sigma.toFixed(1)}`,
    age: offline ? `stale · ${age}` : age,
  };
}
