export type EnvironmentId = "building-a" | "forest-north";
export type EnvironmentKind = "building" | "forest";
export type DataSource = "simulation" | "live";
export type SensorStatus = "normal" | "warning" | "critical" | "offline" | "stale" | "unknown";
export type ConnectivityState = "connected" | "degraded" | "offline" | "unknown";
export type ConnectionState = "connecting" | "connected" | "reconnecting" | "disconnected";
export type Vector3Tuple = readonly [number, number, number];

export interface SensorReading {
  temperature: number | null;
  humidity: number | null;
  anomalyScore: number | null;
  lastUpdate: string;
  source: DataSource;
}

export interface LiveNodeMetrics {
  gradientDistance: number | null;
  via: string | null;
  escapeTo: string | null;
  mu: number | null;
  sigma: number | null;
  n: number | null;
  modelUpdatedAt: string | null;
  networkAlert: boolean | null;
  simulated: boolean | null;
  bytesSent: number | null;
  bytesIfRawData: number | null;
  sourceTimestamp: number | null;
}

export interface SensorNode {
  id: string;
  environmentId: EnvironmentId;
  name: string;
  roomId?: string;
  floorId?: string;
  position: Vector3Tuple;
  reading: SensorReading;
  status: SensorStatus;
  connectivity: ConnectivityState;
  neighbourIds: string[];
  communicationRange: number;
  live?: LiveNodeMetrics;
}

export interface NeighbourConnection {
  id: string;
  sourceId: string;
  targetId: string;
  active: boolean;
  strength: number;
  allowed: boolean;
}

export interface NetworkTopology {
  environmentId: EnvironmentId;
  connections: NeighbourConnection[];
  lastUpdate: string;
  source: DataSource;
}

export type AlertKind = "network-confirmed" | "gateway";

export interface Alert {
  id: string;
  environmentId: EnvironmentId;
  sensorIds: string[];
  kind: AlertKind;
  severity: Exclude<SensorStatus, "offline" | "stale" | "unknown">;
  message: string;
  confirmed: boolean;
  createdAt: string;
  source: DataSource;
}

export type HazardKind = "heat" | "smoke" | "confirmed-fire" | "simulated-fire" | "obstruction";

export interface Hazard {
  id: string;
  environmentId: EnvironmentId;
  kind: HazardKind;
  position: Vector3Tuple;
  radius: number;
  vertexIds: string[];
  confirmed: boolean;
  visualOnly: boolean;
  source: DataSource;
  sourceSensorId?: string;
}

export interface Floor {
  id: string;
  name: string;
  level: number;
  elevation: number;
}

export interface Room {
  id: string;
  name: string;
  floorId?: string;
  center: Vector3Tuple;
  size: readonly [number, number];
  waypointId: string;
}

export interface Exit {
  id: string;
  name: string;
  waypointId: string;
  position: Vector3Tuple;
}

export interface Waypoint {
  id: string;
  name: string;
  kind: "room" | "door" | "corridor" | "stairs" | "exit" | "trail" | "clearing";
  floorId?: string;
  position: Vector3Tuple;
}

export interface RouteEdge {
  id: string;
  from: string;
  to: string;
  distance: number;
  risk: number;
  bidirectional: boolean;
  blockable?: boolean;
  points: Vector3Tuple[];
}

export interface RouteGraph {
  vertices: Waypoint[];
  edges: RouteEdge[];
}

export interface EvacuationRoute {
  id: string;
  environmentId: EnvironmentId;
  originId: string;
  exitId: string;
  vertexIds: string[];
  points: Vector3Tuple[];
  distance: number;
  risk: number;
  status: "available" | "affected" | "unavailable";
  source: DataSource;
  simulatedDecisionSupport: boolean;
}

export interface EnvironmentDefinition {
  id: EnvironmentId;
  name: string;
  shortName: string;
  kind: EnvironmentKind;
  modelKey: "office-cutaway" | "woodland-valley";
  location: string;
  sensors: SensorNode[];
  floors: Floor[];
  rooms: Room[];
  exits: Exit[];
  waypoints: Waypoint[];
  routeGraph: RouteGraph;
  defaultSensorId: string;
  defaultOriginId: string;
  fireSensorId: string;
  blockableEdgeId: string;
  offlineSensorId: string;
}

export interface ConsensusState {
  sensorId: string;
  agreeing: number;
  eligible: number;
  reached: boolean;
  simulated: boolean;
}

export interface EnvironmentState {
  definition: EnvironmentDefinition;
  sensors: SensorNode[];
  topology: NetworkTopology;
  alerts: Alert[];
  hazards: Hazard[];
  blockedEdgeIds: string[];
  consensus: ConsensusState | null;
  connection: ConnectionState;
  lastSync: string;
  source: DataSource;
  aiSummary?: string;
  disabledSimulationSensors?: Record<string, SensorNode>;
}

export type NetworkEvent =
  | { type: "snapshot"; environment: EnvironmentState }
  | { type: "sensor-reading"; environmentId: EnvironmentId; sensor: SensorNode }
  | { type: "topology"; environmentId: EnvironmentId; topology: NetworkTopology }
  | { type: "alert"; environmentId: EnvironmentId; alert: Alert }
  | { type: "hazard"; environmentId: EnvironmentId; hazard: Hazard }
  | { type: "ai-summary"; environmentId: EnvironmentId; summary: string; source: DataSource }
  | { type: "connection"; environmentId?: EnvironmentId; state: ConnectionState; at: string }
  | { type: "heartbeat"; at: string };

export interface NetworkLogEntry {
  id: string;
  environmentId: EnvironmentId;
  type: NetworkEvent["type"] | "simulation";
  message: string;
  timestamp: string;
  source: DataSource;
}
