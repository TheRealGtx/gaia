import { ENVIRONMENTS } from "../config/environments.ts";
import type {
  ConnectionState,
  DataSource,
  EnvironmentId,
  EnvironmentState,
  NetworkLogEntry,
  NetworkEvent,
} from "../domain/types.ts";
import { createInitialEnvironmentState } from "../simulation/engine.ts";
import { LIVE_SENSOR_IDS } from "../live/liveManifest.ts";
import type { ColorTheme, ThemePreference } from "./theme.ts";

export type AppPage = "Overview" | "Live field" | "Environments" | "Sensor Logs";
export type MobilePanel = "map" | "sensors" | "analysis";
export type TelemetryView = "telemetry" | "sensors";

export interface AppState {
  theme: ColorTheme;
  themePreference: ThemePreference;
  mode: DataSource;
  environments: Record<EnvironmentId, EnvironmentState>;
  activeEnvironmentId: EnvironmentId;
  selectedSensorId: string;
  selectedRoomId: string | null;
  selectedOriginId: string;
  page: AppPage;
  mobilePanel: MobilePanel;
  telemetryPanelOpen: boolean;
  telemetryView: TelemetryView;
  showRoutes: boolean;
  showNetwork: boolean;
  cameraResetToken: number;
  globalConnection: ConnectionState;
  logs: NetworkLogEntry[];
}

export type AppAction =
  | { type: "set-theme"; theme: ColorTheme }
  | { type: "set-theme-preference"; preference: ThemePreference; systemTheme: ColorTheme }
  | { type: "environment-event"; event: NetworkEvent }
  | { type: "select-environment"; environmentId: EnvironmentId }
  | { type: "select-sensor"; sensorId: string }
  | { type: "select-room"; roomId: string }
  | { type: "set-page"; page: AppPage }
  | { type: "set-mobile-panel"; panel: MobilePanel }
  | { type: "toggle-telemetry-panel" }
  | { type: "set-telemetry-view"; view: TelemetryView }
  | { type: "set-mode"; mode: DataSource }
  | { type: "toggle-routes" }
  | { type: "toggle-network" }
  | { type: "reset-camera" }
  | { type: "add-log"; entry: NetworkLogEntry }
  | { type: "clear-environment-logs"; environmentId: EnvironmentId };

export function createInitialAppState(): AppState {
  const environments = Object.fromEntries(
    ENVIRONMENTS.map((definition) => [definition.id, createInitialEnvironmentState(definition)]),
  ) as Record<EnvironmentId, EnvironmentState>;
  const activeEnvironmentId: EnvironmentId = "forest-north";
  return {
    theme: "light",
    themePreference: "system",
    mode: "simulation",
    environments,
    activeEnvironmentId,
    selectedSensorId: environments[activeEnvironmentId].definition.defaultSensorId,
    selectedRoomId: null,
    selectedOriginId: environments[activeEnvironmentId].definition.defaultSensorId,
    page: "Overview",
    mobilePanel: "map",
    telemetryPanelOpen: true,
    telemetryView: "telemetry",
    showRoutes: true,
    showNetwork: false,
    cameraResetToken: 0,
    globalConnection: "connected",
    logs: [],
  };
}

function sensorSelection(environment: EnvironmentState, sensorId: string) {
  const sensor = environment.sensors.find((item) => item.id === sensorId);
  const room = environment.definition.rooms.find((item) => item.id === sensor?.roomId);
  return {
    selectedSensorId: sensor?.id ?? "",
    selectedRoomId: room?.id ?? null,
    selectedOriginId: environment.definition.kind === "forest" ? sensor?.id ?? "" : room?.waypointId ?? environment.definition.defaultOriginId,
  };
}

function applyNetworkEvent(state: AppState, event: NetworkEvent): AppState {
  if (event.type === "connection") {
    const environments = event.environmentId
      ? {
        ...state.environments,
        [event.environmentId]: { ...state.environments[event.environmentId], connection: event.state },
      }
      : Object.fromEntries(Object.entries(state.environments).map(([id, environment]) => [id, { ...environment, connection: event.state }])) as Record<EnvironmentId, EnvironmentState>;
    return { ...state, environments, globalConnection: event.state };
  }
  if (event.type === "heartbeat") return state;
  const environmentId = event.type === "snapshot" ? event.environment.definition.id : event.environmentId;
  const current = state.environments[environmentId];
  let next = current;
  if (event.type === "snapshot") next = event.environment;
  if (event.type === "sensor-reading") next = {
    ...current,
    sensors: current.sensors.map((sensor) => sensor.id === event.sensor.id ? event.sensor : sensor),
    lastSync: event.sensor.reading.lastUpdate,
  };
  if (event.type === "topology") next = { ...current, topology: event.topology, lastSync: event.topology.lastUpdate };
  if (event.type === "alert") next = { ...current, alerts: [...current.alerts.filter((alert) => alert.id !== event.alert.id), event.alert] };
  if (event.type === "hazard") next = { ...current, hazards: [...current.hazards.filter((hazard) => hazard.id !== event.hazard.id), event.hazard] };
  if (event.type === "ai-summary") next = { ...current, aiSummary: event.summary };
  return { ...state, environments: { ...state.environments, [environmentId]: next } };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  if (action.type === "set-theme") return { ...state, theme: action.theme };
  if (action.type === "set-theme-preference") return {
    ...state,
    themePreference: action.preference,
    theme: action.preference === "system" ? action.systemTheme : action.preference,
  };
  if (action.type === "environment-event") return applyNetworkEvent(state, action.event);
  if (action.type === "select-environment") {
    const environment = state.environments[action.environmentId];
    return {
      ...state,
      activeEnvironmentId: action.environmentId,
      ...sensorSelection(environment, environment.definition.defaultSensorId),
      page: "Overview",
      mobilePanel: "map",
      telemetryView: "telemetry",
      cameraResetToken: state.cameraResetToken + 1,
    };
  }
  if (action.type === "select-sensor") {
    const environment = state.environments[state.activeEnvironmentId];
    if (!environment.sensors.some((sensor) => sensor.id === action.sensorId)) return state;
    return { ...state, ...sensorSelection(environment, action.sensorId) };
  }
  if (action.type === "select-room") {
    const room = state.environments[state.activeEnvironmentId].definition.rooms.find((item) => item.id === action.roomId);
    return room ? { ...state, selectedRoomId: room.id, selectedOriginId: room.waypointId } : state;
  }
  if (action.type === "set-page") return { ...state, page: action.page };
  if (action.type === "set-mobile-panel") return { ...state, mobilePanel: action.panel };
  if (action.type === "toggle-telemetry-panel") return { ...state, telemetryPanelOpen: !state.telemetryPanelOpen };
  if (action.type === "set-telemetry-view") return { ...state, telemetryView: action.view };
  if (action.type === "set-mode") {
    if (action.mode === "simulation") {
      const environments = Object.fromEntries(ENVIRONMENTS.map((definition) => [definition.id, createInitialEnvironmentState(definition)])) as Record<EnvironmentId, EnvironmentState>;
      const environment = environments[state.activeEnvironmentId];
      return { ...state, mode: "simulation", environments, globalConnection: "connected", ...sensorSelection(environment, environment.definition.defaultSensorId) };
    }
    const environments = Object.fromEntries(Object.entries(state.environments).map(([rawId, environment]) => {
      const id = rawId as EnvironmentId;
      const allowed = new Set(LIVE_SENSOR_IDS[id]);
      return [id, {
        ...environment,
        sensors: environment.sensors.filter((sensor) => allowed.has(sensor.id)).map((sensor) => ({
          ...sensor,
          status: "stale" as const,
          connectivity: "unknown" as const,
          reading: { temperature: null, humidity: null, anomalyScore: null, lastUpdate: new Date(0).toISOString(), source: "live" as const },
          live: undefined,
        })),
        alerts: [], hazards: [], blockedEdgeIds: [], consensus: null, disabledSimulationSensors: undefined,
        topology: { ...environment.topology, connections: [], source: "live" as const },
        source: "live" as const, connection: "connecting" as const,
      }];
    })) as unknown as Record<EnvironmentId, EnvironmentState>;
    const environment = environments[state.activeEnvironmentId];
    return { ...state, mode: "live", environments, globalConnection: "connecting", ...sensorSelection(environment, environment.sensors[0]?.id ?? "") };
  }
  if (action.type === "toggle-routes") return { ...state, showRoutes: !state.showRoutes };
  if (action.type === "toggle-network") return { ...state, showNetwork: !state.showNetwork };
  if (action.type === "reset-camera") return { ...state, cameraResetToken: state.cameraResetToken + 1 };
  if (action.type === "add-log") return { ...state, logs: [action.entry, ...state.logs].slice(0, 120) };
  if (action.type === "clear-environment-logs") return { ...state, logs: state.logs.filter((entry) => entry.environmentId !== action.environmentId) };
  return state;
}
