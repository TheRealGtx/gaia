import type { HazardGradientModel } from "../../domain/hazardGradient.ts";
import type { SensorNode, Vector3Tuple } from "../../domain/types.ts";

export interface HazardGradientSceneNode {
  sensorId: string;
  position: Vector3Tuple;
  level: number | null;
  offline: boolean;
  selected: boolean;
}

export interface HazardGradientSceneLink {
  sourceId: string;
  targetId: string;
  source: Vector3Tuple;
  target: Vector3Tuple;
}

export interface HazardGradientSceneModel {
  nodes: HazardGradientSceneNode[];
  links: HazardGradientSceneLink[];
}

export interface HazardGradientSceneFrame {
  center: Vector3Tuple;
  cameraPosition: Vector3Tuple;
  radius: number;
  minDistance: number;
  maxDistance: number;
  pointRadius: number;
}

export function createHazardGradientSceneModel(
  sensors: SensorNode[],
  gradient: HazardGradientModel,
  selectedSensorId: string,
): HazardGradientSceneModel {
  const sensorById = new Map(sensors.map((sensor) => [sensor.id, sensor]));
  const nodes = gradient.nodes.flatMap((node) => {
    const sensor = sensorById.get(node.sensorId);
    return sensor ? [{
      sensorId: node.sensorId,
      position: sensor.position,
      level: node.level,
      offline: node.offline,
      selected: node.sensorId === selectedSensorId,
    }] : [];
  });
  const positionById = new Map(nodes.map((node) => [node.sensorId, node.position]));
  const links = gradient.links.flatMap(({ sourceId, targetId }) => {
    const source = positionById.get(sourceId);
    const target = positionById.get(targetId);
    return source && target ? [{ sourceId, targetId, source, target }] : [];
  });

  return { nodes, links };
}

export function fitHazardGradientScene(positions: readonly Vector3Tuple[]): HazardGradientSceneFrame {
  if (!positions.length) {
    return {
      center: [0, 0, 0],
      cameraPosition: [5, 3.75, 5],
      radius: 3,
      minDistance: 2,
      maxDistance: 18,
      pointRadius: .28,
    };
  }

  const minimum = [...positions[0]];
  const maximum = [...positions[0]];
  for (const position of positions.slice(1)) {
    for (let axis = 0; axis < 3; axis += 1) {
      minimum[axis] = Math.min(minimum[axis], position[axis]);
      maximum[axis] = Math.max(maximum[axis], position[axis]);
    }
  }

  const center: Vector3Tuple = [
    (minimum[0] + maximum[0]) / 2,
    (minimum[1] + maximum[1]) / 2,
    (minimum[2] + maximum[2]) / 2,
  ];
  const radius = Math.max(3, Math.hypot(
    maximum[0] - minimum[0],
    maximum[1] - minimum[1],
    maximum[2] - minimum[2],
  ) / 2);
  const cameraDistance = radius * 2.8;
  const directionLength = Math.hypot(1, .75, 1);
  const cameraPosition: Vector3Tuple = [
    center[0] + cameraDistance / directionLength,
    center[1] + cameraDistance * .75 / directionLength,
    center[2] + cameraDistance / directionLength,
  ];

  return {
    center,
    cameraPosition,
    radius,
    minDistance: Math.max(2, radius * .45),
    maxDistance: Math.max(18, radius * 5),
    pointRadius: Math.min(.55, Math.max(.28, radius * .025)),
  };
}
