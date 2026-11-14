import type { EnvironmentState, EvacuationRoute } from "../../domain/types.ts";
import { deriveFireVisual } from "./fireVisual.ts";

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
      return {
        ...hazard,
        visual: deriveFireVisual(sensor?.reading.temperature ?? null, sensor?.reading.humidity ?? null, hazard.radius),
      };
    }),
    exits: state.definition.exits,
    rooms: state.definition.rooms.filter((room) => visible(room.floorId)),
    routePoints: route?.points ?? [],
  };
}
