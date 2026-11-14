import type { EnvironmentId } from "../domain/types.ts";

export const LIVE_SENSOR_IDS: Record<EnvironmentId, readonly string[]> = {
  "building-a": ["A-01", "A-02"],
  "forest-north": [],
};
