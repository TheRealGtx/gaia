import type { SensorNode } from "./types.ts";

export interface CommunicationSavings {
  bytesSent: number;
  bytesIfRawData: number;
  bytesAvoided: number;
  reductionPercent: number;
  reportingNodes: number;
  totalNodes: number;
}

export function calculateCommunicationSavings(sensors: SensorNode[]): CommunicationSavings | null {
  const reporting = sensors.filter((sensor) => sensor.live?.bytesSent !== null && sensor.live?.bytesSent !== undefined
    && sensor.live?.bytesIfRawData !== null && sensor.live?.bytesIfRawData !== undefined);
  if (!reporting.length) return null;
  if (reporting.some((sensor) => (sensor.live?.bytesSent ?? 0) < 0 || (sensor.live?.bytesIfRawData ?? 0) < (sensor.live?.bytesSent ?? 0))) return null;
  const bytesSent = reporting.reduce((sum, sensor) => sum + (sensor.live?.bytesSent ?? 0), 0);
  const bytesIfRawData = reporting.reduce((sum, sensor) => sum + (sensor.live?.bytesIfRawData ?? 0), 0);
  if (bytesIfRawData < bytesSent) return null;
  const bytesAvoided = bytesIfRawData - bytesSent;
  const reductionPercent = bytesIfRawData === 0 ? 0 : Math.round((bytesAvoided / bytesIfRawData) * 1000) / 10;
  return { bytesSent, bytesIfRawData, bytesAvoided, reductionPercent, reportingNodes: reporting.length, totalNodes: sensors.length };
}
