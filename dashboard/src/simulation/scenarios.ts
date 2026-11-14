export type SimulationAction =
  | { type: "increase-temperature"; sensorId: string; delta: number }
  | { type: "simulate-anomaly"; sensorId: string }
  | { type: "confirm-fire"; sensorId: string }
  | { type: "block-edge"; edgeId: string }
  | { type: "disable-node"; sensorId: string }
  | { type: "network-failure"; sensorIds: string[] }
  | { type: "reset" };
