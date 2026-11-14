import { ENVIRONMENTS } from "../config/environments.ts";
import type { DataAdapter, Unsubscribe } from "../domain/adapter.ts";
import type { EnvironmentId, EnvironmentState, NetworkEvent } from "../domain/types.ts";
import { createInitialEnvironmentState } from "../simulation/engine.ts";
import { normalizeGatewayMessages } from "./protocol.ts";
import { getFreshness } from "./freshness.ts";
import { LIVE_SENSOR_IDS } from "./liveManifest.ts";

interface WebSocketLike {
  readyState: number;
  onopen: (() => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onerror: (() => void) | null;
  onclose: (() => void) | null;
  close(): void;
}

type WebSocketFactory = (url: string) => WebSocketLike;

export function emptyLiveState(environmentId: EnvironmentId): EnvironmentState {
  const initial = createInitialEnvironmentState(ENVIRONMENTS.find((item) => item.id === environmentId)!);
  const allowed = new Set(LIVE_SENSOR_IDS[environmentId]);
  const sensors = initial.sensors.filter((sensor) => allowed.has(sensor.id)).map((sensor) => ({
    ...sensor,
    status: "stale" as const,
    connectivity: "unknown" as const,
    reading: { ...sensor.reading, temperature: null, humidity: null, anomalyScore: null, source: "live" as const },
  }));
  return {
    ...initial,
    sensors,
    source: "live",
    connection: "disconnected",
    topology: { ...initial.topology, connections: [], source: "live" },
  };
}

export class LiveNetworkAdapter implements DataAdapter {
  readonly source = "live" as const;
  private socket: WebSocketLike | null = null;
  private listeners = new Set<(event: NetworkEvent) => void>();
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private freshnessTimer: ReturnType<typeof setInterval> | null = null;
  private closedManually = false;
  private states = new Map<EnvironmentId, EnvironmentState>(
    ENVIRONMENTS.map((environment) => [environment.id, emptyLiveState(environment.id)]),
  );

  constructor(
    private readonly url: string,
    private readonly createSocket: WebSocketFactory = (socketUrl) => new WebSocket(socketUrl) as unknown as WebSocketLike,
  ) {}

  async connect(): Promise<void> {
    this.closedManually = false;
    this.openSocket();
    this.freshnessTimer = setInterval(() => this.refreshFreshness(), 1_000);
  }

  disconnect(): void {
    this.closedManually = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.freshnessTimer) clearInterval(this.freshnessTimer);
    this.reconnectTimer = null;
    this.freshnessTimer = null;
    this.socket?.close();
    this.socket = null;
    this.emit({ type: "connection", state: "disconnected", at: new Date().toISOString() });
  }

  getSnapshot(environmentId: EnvironmentId): EnvironmentState | null {
    return this.states.get(environmentId) ?? null;
  }

  subscribe(listener: (event: NetworkEvent) => void): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private openSocket(): void {
    this.emit({ type: "connection", state: this.reconnectAttempt ? "reconnecting" : "connecting", at: new Date().toISOString() });
    this.socket = this.createSocket(this.url);
    this.socket.onopen = () => {
      this.reconnectAttempt = 0;
      this.emit({ type: "connection", state: "connected", at: new Date().toISOString() });
    };
    this.socket.onmessage = ({ data }) => {
      try {
        const events = normalizeGatewayMessages(JSON.parse(data));
        for (const event of events) this.applyEvent(event);
      } catch {
        // A malformed gateway packet must not replace the last valid snapshot.
      }
    };
    this.socket.onerror = () => this.socket?.close();
    this.socket.onclose = () => {
      this.socket = null;
      this.emit({ type: "connection", state: "disconnected", at: new Date().toISOString() });
      if (!this.closedManually) {
        const delay = Math.min(10_000, 500 * 2 ** this.reconnectAttempt);
        this.reconnectAttempt += 1;
        this.reconnectTimer = setTimeout(() => this.openSocket(), delay);
      }
    };
  }

  private applyEvent(event: NetworkEvent): void {
    if (event.type === "snapshot") this.states.set(event.environment.definition.id, event.environment);
    if ("environmentId" in event && event.environmentId) {
      const current = this.states.get(event.environmentId);
      if (current) {
        if (event.type === "sensor-reading") {
          this.states.set(event.environmentId, {
            ...current,
            sensors: current.sensors.map((sensor) => sensor.id === event.sensor.id ? event.sensor : sensor),
            lastSync: event.sensor.reading.lastUpdate,
          });
        }
        if (event.type === "topology") this.states.set(event.environmentId, { ...current, topology: event.topology, lastSync: event.topology.lastUpdate });
        if (event.type === "alert") this.states.set(event.environmentId, { ...current, alerts: [...current.alerts.filter((alert) => alert.id !== event.alert.id), event.alert] });
        if (event.type === "hazard") this.states.set(event.environmentId, { ...current, hazards: [...current.hazards.filter((hazard) => hazard.id !== event.hazard.id), event.hazard] });
        if (event.type === "ai-summary") this.states.set(event.environmentId, { ...current, aiSummary: event.summary });
      }
    }
    this.emit(event);
  }

  private refreshFreshness(): void {
    const now = new Date();
    for (const [environmentId, current] of this.states.entries()) {
      let changed = false;
      const sensors = current.sensors.map((sensor) => {
        const freshness = getFreshness(sensor.reading.lastUpdate, now, { staleAfterMs: 4_000, offlineAfterMs: 4_000 });
        if (freshness === "fresh" || sensor.status === freshness) return sensor;
        changed = true;
        return {
          ...sensor,
          status: freshness,
          connectivity: freshness === "offline" ? "offline" as const : "degraded" as const,
        };
      });
      if (changed) {
        const environment = { ...current, sensors };
        this.states.set(environmentId, environment);
        this.emit({ type: "snapshot", environment });
      }
    }
  }

  private emit(event: NetworkEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
