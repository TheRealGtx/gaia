import { selectEnvironmentMetrics } from "../domain/selectors";
import type { EnvironmentState, SensorStatus } from "../domain/types";
import { selectBestRoute, selectRoutes } from "../routing/routeSelectors";
import type { AppState } from "./appReducer";

export function selectActiveEnvironment(state: AppState): EnvironmentState {
  return state.environments[state.activeEnvironmentId];
}

export function selectDashboard(state: AppState) {
  const environment = selectActiveEnvironment(state);
  const routes = selectRoutes(environment, state.selectedOriginId);
  const bestRoute = selectBestRoute(routes);
  return {
    environment,
    selectedSensor: environment.sensors.find((sensor) => sensor.id === state.selectedSensorId) ?? null,
    selectedRoom: environment.definition.rooms.find((room) => room.id === state.selectedRoomId) ?? null,
    metrics: selectEnvironmentMetrics(environment),
    routes,
    bestRoute,
    status: overallStatus(environment),
  };
}

export function overallStatus(environment: EnvironmentState): SensorStatus {
  if (environment.connection === "disconnected") return "offline";
  if (environment.sensors.some((sensor) => sensor.status === "critical")) return "critical";
  if (environment.sensors.some((sensor) => sensor.status === "warning" || sensor.status === "stale" || sensor.status === "unknown")) return "warning";
  if (environment.sensors.every((sensor) => sensor.status === "offline")) return "offline";
  return "normal";
}
