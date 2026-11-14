import type { EnvironmentState, EvacuationRoute, Vector3Tuple } from "../../domain/types.ts";
import { forestElevation } from "../../domain/terrain.ts";
import { deriveFireVisual } from "./fireVisual.ts";
import { projectForestRoute } from "./routeGeometry.ts";

export function createSceneModel(
  state: EnvironmentState,
  route: EvacuationRoute | null,
  floorId: string,
) {
  const visible = (sensorFloor?: string) => floorId === "all" || !sensorFloor || sensorFloor === floorId;
  const visibleSensorIds = new Set(state.sensors.filter((sensor) => visible(sensor.floorId)).map((sensor) => sensor.id));
  return {
    sensors: state.sensors.filter((sensor) => visible(sensor.floorId)),
    networkLinks: state.topology.connections.filter((connection) => (
      connection.active && visibleSensorIds.has(connection.sourceId) && visibleSensorIds.has(connection.targetId)
    )),
    hazards: state.hazards.filter((hazard) => {
      if (floorId === "all" || state.definition.kind === "forest") return true;
      const source = state.sensors.find((candidate) => candidate.id === hazard.sourceSensorId);
      if (source) return source.floorId === floorId;
      const selectedFloor = state.definition.floors.find((floor) => floor.id === floorId);
      return selectedFloor ? Math.abs(hazard.position[1] - selectedFloor.elevation) < 2.5 : true;
    }).map((hazard) => {
      if (hazard.kind === "obstruction") return { ...hazard, visual: undefined };
      const sensor = state.sensors.find((candidate) => candidate.id === hazard.sourceSensorId);
      const floor = state.definition.floors.find((item) => item.id === sensor?.floorId);
      const position: Vector3Tuple = [
        hazard.position[0],
        state.definition.kind === "forest"
          ? forestElevation(hazard.position[0], hazard.position[2]) + .06
          : floor ? floor.elevation + .2 : hazard.position[1],
        hazard.position[2],
      ];
      return {
        ...hazard,
        position,
        visual: deriveFireVisual(sensor?.reading.temperature ?? null, sensor?.reading.humidity ?? null, hazard.radius),
      };
    }),
    exits: state.definition.exits,
    rooms: state.definition.rooms.filter((room) => visible(room.floorId)),
    routePoints: state.definition.kind === "forest" ? projectForestRoute(route?.points ?? []) : route?.points ?? [],
  };
}
