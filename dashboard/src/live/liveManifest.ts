import type { EnvironmentId } from "../domain/types.ts";

// The physical boards, by the sensor id the gateway manifest maps them to.
// This list and gateway/node_manifest.json have to agree: the gateway drops a
// packet whose id is not in the JSON, and the dashboard ignores a sensor that
// is not in this array, so a new board has to be added in BOTH places.
export const LIVE_SENSOR_IDS: Record<EnvironmentId, readonly string[]> = {
  "building-a": ["A-01", "A-02", "A-03", "A-04"],
  "forest-north": [],
};
