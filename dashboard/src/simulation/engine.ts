import { deriveConsensus, deriveTopology } from "../domain/topology.ts";
import type {
  Alert,
  EnvironmentDefinition,
  EnvironmentState,
  Hazard,
  SensorNode,
} from "../domain/types.ts";
import type { SimulationAction } from "./scenarios.ts";

const SIMULATION_TIME = "2026-11-14T00:00:00.000Z";
const SIMULATED_FIRE_TEMPERATURE = 78;

function copySensor(sensor: SensorNode): SensorNode {
  return {
    ...sensor,
    reading: { ...sensor.reading },
    neighbourIds: [...sensor.neighbourIds],
  };
}

export function createInitialEnvironmentState(definition: EnvironmentDefinition): EnvironmentState {
  const sensors = definition.sensors.map(copySensor);
  return {
    definition,
    sensors,
    topology: deriveTopology(definition, sensors),
    alerts: [],
    hazards: [],
    blockedEdgeIds: [],
    consensus: null,
    connection: "connected",
    lastSync: SIMULATION_TIME,
    source: "simulation",
  };
}

function updateSensor(
  sensors: SensorNode[],
  sensorId: string,
  update: (sensor: SensorNode) => SensorNode,
): SensorNode[] {
  return sensors.map((sensor) => sensor.id === sensorId ? update(copySensor(sensor)) : copySensor(sensor));
}

function obstructionHazard(state: EnvironmentState, edgeId: string): Hazard {
  const routeEdge = state.definition.routeGraph.edges.find((edge) => edge.id === edgeId);
  const point = routeEdge?.points[Math.floor((routeEdge?.points.length ?? 1) / 2)] ?? [0, 0, 0];
  return {
    id: `${state.definition.id}-${edgeId}-obstruction`,
    environmentId: state.definition.id,
    kind: "obstruction",
    position: point,
    radius: 1.8,
    vertexIds: routeEdge ? [routeEdge.from, routeEdge.to] : [],
    confirmed: true,
    visualOnly: true,
    source: "simulation",
  };
}

function finalize(state: EnvironmentState, sensors: SensorNode[], sensorId?: string): EnvironmentState {
  const next = { ...state, sensors, lastSync: SIMULATION_TIME };
  return {
    ...next,
    topology: deriveTopology(next.definition, sensors),
    consensus: sensorId ? deriveConsensus(sensors, sensorId, true) : next.consensus,
  };
}

export function applySimulationAction(
  state: EnvironmentState,
  action: SimulationAction,
): EnvironmentState {
  if (action.type === "reset") return createInitialEnvironmentState(state.definition);

  if (action.type === "increase-temperature") {
    const sourceSensor = state.sensors.find((sensor) => sensor.id === action.sensorId);
    if (!sourceSensor || sourceSensor.status === "offline") return state;
    const sensors = updateSensor(state.sensors, action.sensorId, (sensor) => ({
      ...sensor,
      status: sensor.status === "critical" ? "critical" : "warning",
      reading: {
        ...sensor.reading,
        temperature: (sensor.reading.temperature ?? 0) + action.delta,
        anomalyScore: Math.max(sensor.reading.anomalyScore ?? 0, 0.45),
      },
    }));
    const next = finalize(state, sensors, action.sensorId);
    const source = next.sensors.find((sensor) => sensor.id === action.sensorId);
    const fireAlreadyActive = next.hazards.some((hazard) => (
      hazard.kind === "simulated-fire" && hazard.sourceSensorId === action.sensorId
    ));
    if ((source?.reading.temperature ?? 0) >= SIMULATED_FIRE_TEMPERATURE && !fireAlreadyActive) {
      return applySimulationAction(next, { type: "confirm-fire", sensorId: action.sensorId });
    }
    return next;
  }

  if (action.type === "confirm-fire") {
    const source = state.sensors.find((sensor) => sensor.id === action.sensorId);
    if (!source || source.status === "offline") return state;
    if (state.hazards.some((hazard) => hazard.kind === "simulated-fire" && hazard.sourceSensorId === action.sensorId)) return state;
    const agreeingNeighbours = Math.max(2, Math.ceil(source.neighbourIds.length / 2));
    const sensorIds = new Set([action.sensorId, ...source.neighbourIds.slice(0, agreeingNeighbours)]);
    const sensors = state.sensors.map((item) => {
      const sensor = copySensor(item);
      if (!sensorIds.has(sensor.id) || sensor.status === "offline" || (sensor.status === "critical" && sensor.id !== action.sensorId)) return sensor;
      return {
        ...sensor,
        status: sensor.id === action.sensorId ? "critical" as const : "warning" as const,
        reading: {
          ...sensor.reading,
          temperature: sensor.id === action.sensorId
            ? Math.max(sensor.reading.temperature ?? 20, SIMULATED_FIRE_TEMPERATURE)
            : (sensor.reading.temperature ?? 20) + 9,
          humidity: sensor.id === action.sensorId ? 21 : Math.max(24, (sensor.reading.humidity ?? 50) - 12),
          anomalyScore: sensor.id === action.sensorId ? 0.99 : 0.72,
        },
      };
    });
    const alert: Alert = {
      id: `${state.definition.id}-${action.sensorId}-confirmed`,
      environmentId: state.definition.id,
      sensorIds: [...sensorIds],
      kind: "network-confirmed",
      severity: "critical",
      message: `Simulated neighbour consensus confirms a fire scenario at ${source.name}.`,
      confirmed: true,
      createdAt: SIMULATION_TIME,
      source: "simulation",
    };
    const hazard: Hazard = {
      id: `${state.definition.id}-${action.sensorId}-fire`,
      environmentId: state.definition.id,
      kind: "simulated-fire",
      position: source.position,
      radius: state.definition.kind === "forest" ? 4.2 : 3,
      vertexIds: source.roomId
        ? [state.definition.rooms.find((room) => room.id === source.roomId)?.waypointId ?? state.definition.defaultOriginId]
        : [state.definition.waypoints.reduce((best, waypoint) => {
          const current = Math.hypot(waypoint.position[0] - source.position[0], waypoint.position[2] - source.position[2]);
          const previous = Math.hypot(best.position[0] - source.position[0], best.position[2] - source.position[2]);
          return current < previous ? waypoint : best;
        }).id],
      confirmed: true,
      visualOnly: true,
      source: "simulation",
      sourceSensorId: action.sensorId,
    };
    return finalize({ ...state, alerts: [...state.alerts, alert], hazards: [...state.hazards, hazard] }, sensors, action.sensorId);
  }

  if (action.type === "block-edge") {
    const isBlocked = state.blockedEdgeIds.includes(action.edgeId);
    const blockedEdgeIds = isBlocked
      ? state.blockedEdgeIds.filter((id) => id !== action.edgeId)
      : [...state.blockedEdgeIds, action.edgeId];
    const hazards = isBlocked
      ? state.hazards.filter((hazard) => hazard.id !== `${state.definition.id}-${action.edgeId}-obstruction`)
      : [...state.hazards, obstructionHazard(state, action.edgeId)];
    return { ...state, blockedEdgeIds, hazards };
  }

  if (action.type === "enable-node") {
    const previous = state.disabledSimulationSensors?.[action.sensorId];
    if (!previous) return state;
    const disabledSimulationSensors = { ...state.disabledSimulationSensors };
    delete disabledSimulationSensors[action.sensorId];
    const sensors = updateSensor(state.sensors, action.sensorId, () => copySensor(previous));
    const connection = state.connection === "reconnecting" && sensors.every((sensor) => sensor.status !== "offline")
      ? "connected" : state.connection;
    return finalize({ ...state, disabledSimulationSensors, connection }, sensors, state.consensus?.sensorId);
  }

  if (action.type === "disable-node" || action.type === "network-failure") {
    const ids = action.type === "disable-node" ? [action.sensorId] : action.sensorIds;
    const disabledSimulationSensors = { ...state.disabledSimulationSensors };
    for (const sensor of state.sensors) {
      if (ids.includes(sensor.id) && sensor.status !== "offline") {
        disabledSimulationSensors[sensor.id] = copySensor(sensor);
      }
    }
    const sensors = state.sensors.map((item) => ids.includes(item.id)
      ? {
        ...copySensor(item),
        status: "offline" as const,
        connectivity: "offline" as const,
        reading: { ...item.reading, temperature: null, humidity: null, anomalyScore: null },
      }
      : copySensor(item));
    return finalize({ ...state, disabledSimulationSensors, connection: action.type === "network-failure" ? "reconnecting" : state.connection }, sensors, state.consensus?.sensorId);
  }

  return state;
}
