import type { EnvironmentState, SensorNode } from "./types.ts";

export function selectSensor(state: EnvironmentState, sensorId: string): SensorNode | null {
  return state.sensors.find((sensor) => sensor.id === sensorId) ?? null;
}

export function selectEnvironmentMetrics(state: EnvironmentState) {
  const active = state.sensors.filter((sensor) => sensor.status !== "offline");
  const numericTemperatures = active
    .map((sensor) => sensor.reading.temperature)
    .filter((value): value is number => value !== null);
  return {
    activeSensors: active.length,
    offlineSensors: state.sensors.length - active.length,
    activeAlerts: state.alerts.filter((alert) => alert.confirmed).length,
    averageTemperature: numericTemperatures.length
      ? numericTemperatures.reduce((total, value) => total + value, 0) / numericTemperatures.length
      : null,
  };
}
