import type { DataSource, EnvironmentId, EnvironmentState, NetworkEvent } from "./types";

export type Unsubscribe = () => void;

export interface DataAdapter {
  readonly source: DataSource;
  connect(): Promise<void>;
  disconnect(): void;
  getSnapshot(environmentId: EnvironmentId): EnvironmentState | null;
  subscribe(listener: (event: NetworkEvent) => void): Unsubscribe;
}
