import { ENVIRONMENTS } from "../config/environments.ts";
import type { DataAdapter, Unsubscribe } from "../domain/adapter.ts";
import type { EnvironmentId, EnvironmentState, NetworkEvent } from "../domain/types.ts";
import { applySimulationAction, createInitialEnvironmentState } from "./engine.ts";
import type { SimulationAction } from "./scenarios.ts";

export class SimulationAdapter implements DataAdapter {
  readonly source = "simulation" as const;
  private listeners = new Set<(event: NetworkEvent) => void>();
  private states = new Map<EnvironmentId, EnvironmentState>(
    ENVIRONMENTS.map((definition) => [definition.id, createInitialEnvironmentState(definition)]),
  );

  async connect(): Promise<void> {
    for (const environment of this.states.values()) {
      this.emit({ type: "snapshot", environment });
    }
  }

  disconnect(): void {}

  getSnapshot(environmentId: EnvironmentId): EnvironmentState | null {
    return this.states.get(environmentId) ?? null;
  }

  subscribe(listener: (event: NetworkEvent) => void): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispatch(environmentId: EnvironmentId, action: SimulationAction): EnvironmentState {
    const current = this.states.get(environmentId);
    if (!current) throw new Error(`Unknown environment: ${environmentId}`);
    const next = applySimulationAction(current, action);
    this.states.set(environmentId, next);
    this.emit({ type: "snapshot", environment: next });
    return next;
  }

  private emit(event: NetworkEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
