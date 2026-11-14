import type { EnvironmentState, EvacuationRoute, Vector3Tuple } from "../../domain/types.ts";
import { forestElevation } from "../../domain/terrain.ts";
import { deriveFireVisual } from "./fireVisual.ts";
import { projectForestRoute } from "./routeGeometry.ts";

export function createSceneModel(
  state: EnvironmentState,
  route: EvacuationRoute | null,
) {
  const sensorIds = new Set(state.sensors.map((sensor) => sensor.id));
  return {
    sensors: state.sensors,
    networkLinks: state.topology.connections.filter((connection) => (
      connection.active && sensorIds.has(connection.sourceId) && sensorIds.has(connection.targetId)
    )),
    hazards: state.hazards.map((hazard) => {
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
    rooms: state.definition.rooms,
    routePoints: state.definition.kind === "forest" ? projectForestRoute(route?.points ?? []) : route?.points ?? [],
  };
}
