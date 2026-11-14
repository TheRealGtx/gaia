import type {
  EnvironmentDefinition,
  EnvironmentId,
  Floor,
  Room,
  RouteEdge,
  SensorNode,
  Vector3Tuple,
  Waypoint,
} from "../domain/types.ts";
import { forestElevation } from "../domain/terrain.ts";

const BASE_TIME = "2026-11-14T00:00:00.000Z";
const FLOOR_HEIGHT = 4.8;

function edge(
  id: string,
  from: string,
  to: string,
  points: Vector3Tuple[],
  options: { risk?: number; blockable?: boolean; bidirectional?: boolean } = {},
): RouteEdge {
  let distance = 0;
  for (let index = 1; index < points.length; index += 1) {
    const [ax, ay, az] = points[index - 1];
    const [bx, by, bz] = points[index];
    distance += Math.hypot(bx - ax, by - ay, bz - az);
  }
  return {
    id,
    from,
    to,
    points,
    distance: Math.round(distance * 10) / 10,
    risk: options.risk ?? 0,
    blockable: options.blockable,
    bidirectional: options.bidirectional ?? true,
  };
}

function createSensor(
  environmentId: EnvironmentId,
  id: string,
  name: string,
  position: Vector3Tuple,
  temperature: number,
  humidity: number,
  options: { roomId?: string; floorId?: string; range: number },
): SensorNode {
  return {
    id,
    environmentId,
    name,
    roomId: options.roomId,
    floorId: options.floorId,
    position,
    reading: { temperature, humidity, anomalyScore: 0.08, lastUpdate: BASE_TIME, source: "simulation" },
    status: "normal",
    connectivity: "connected",
    neighbourIds: [],
    communicationRange: options.range,
  };
}

function connectNearest(sensors: SensorNode[], maximumNeighbours: number): SensorNode[] {
  return sensors.map((sensor) => {
    const neighbourIds = sensors
      .filter((candidate) => candidate.id !== sensor.id)
      .map((candidate) => ({
        id: candidate.id,
        distance: Math.hypot(
          candidate.position[0] - sensor.position[0],
          candidate.position[1] - sensor.position[1],
          candidate.position[2] - sensor.position[2],
        ),
      }))
      .filter((candidate) => candidate.distance <= sensor.communicationRange)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, maximumNeighbours)
      .map((candidate) => candidate.id);
    return { ...sensor, neighbourIds };
  });
}

const buildingFloors: Floor[] = Array.from({ length: 4 }, (_, index) => ({
  id: `level-${index + 1}`,
  name: `Level ${index + 1}`,
  level: index + 1,
  elevation: index * FLOOR_HEIGHT,
}));

const floorRoomNames = [
  ["Reception", "Office A", "Collaboration Hub", "Storage Room", "Security Office", "Operations Room"],
  ["Meeting Room", "Focus Studio", "Project Lab", "Design Office", "Training Suite", "Analytics Room"],
  ["Executive Office", "Quiet Room", "Prototype Lab", "HR Office", "Conference Hall", "Engineering Studio"],
  ["Control Room", "Medical Room", "Systems Lab", "Archive", "Incident Center", "Workshop"],
] as const;

const roomLayout = [
  { x: -12, z: 7, size: [8, 9] as const },
  { x: -3, z: 7, size: [8, 9] as const },
  { x: 8, z: 7, size: [12, 9] as const },
  { x: -12, z: -7, size: [8, 9] as const },
  { x: -3, z: -7, size: [8, 9] as const },
  { x: 8, z: -7, size: [12, 9] as const },
];

function roomIds(floorIndex: number, roomIndex: number) {
  if (floorIndex === 0 && roomIndex === 0) return { roomId: "reception-room", waypointId: "reception", doorId: "reception-door" };
  if (floorIndex === 0 && roomIndex === 1) return { roomId: "office-room", waypointId: "office-a", doorId: "office-door" };
  if (floorIndex === 0 && roomIndex === 3) return { roomId: "storage-room", waypointId: "storage", doorId: "storage-door" };
  if (floorIndex === 1 && roomIndex === 0) return { roomId: "meeting-room", waypointId: "meeting", doorId: "meeting-door" };
  if (floorIndex === 1 && roomIndex === 2) return { roomId: "lab-room", waypointId: "lab", doorId: "lab-door" };
  const base = `f${floorIndex + 1}-room-${roomIndex + 1}`;
  return { roomId: base, waypointId: base, doorId: `${base}-door` };
}

function corridorId(floorIndex: number, column: number) {
  if (floorIndex === 0 && column === 0) return "west-hall";
  if (floorIndex === 0 && column === 1) return "atrium";
  if (floorIndex === 1 && column === 0) return "upper-hall";
  return `f${floorIndex + 1}-${["west", "central", "east"][column]}-hall`;
}

function buildBuildingDefinition(): EnvironmentDefinition {
  const id: EnvironmentId = "building-a";
  const rooms: Room[] = [];
  const waypoints: Waypoint[] = [];
  const edges: RouteEdge[] = [];

  buildingFloors.forEach((floor, floorIndex) => {
    const y = floor.elevation + .2;
    const corridors = [-12, -3, 8].map((x, column) => ({ id: corridorId(floorIndex, column), x }));
    corridors.forEach((corridor) => waypoints.push({ id: corridor.id, name: `${floor.name} corridor`, kind: "corridor", floorId: floor.id, position: [corridor.x, y, 0] }));
    edges.push(
      edge(`f${floorIndex + 1}-corridor-west`, corridors[0].id, corridors[1].id, [[-12, y + .15, 0], [-3, y + .15, 0]], { blockable: floorIndex === 2 }),
      edge(`f${floorIndex + 1}-corridor-east`, corridors[1].id, corridors[2].id, [[-3, y + .15, 0], [8, y + .15, 0]], { blockable: floorIndex === 1 }),
    );

    roomLayout.forEach((layout, roomIndex) => {
      const ids = roomIds(floorIndex, roomIndex);
      const name = floorRoomNames[floorIndex][roomIndex];
      const doorZ = layout.z > 0 ? 1.5 : -1.5;
      const column = layout.x < -7 ? 0 : layout.x < 2 ? 1 : 2;
      rooms.push({ id: ids.roomId, name, floorId: floor.id, center: [layout.x, floor.elevation, layout.z], size: layout.size, waypointId: ids.waypointId });
      waypoints.push(
        { id: ids.waypointId, name, kind: "room", floorId: floor.id, position: [layout.x, y, layout.z] },
        { id: ids.doorId, name: `${name} door`, kind: "door", floorId: floor.id, position: [layout.x, y, doorZ] },
      );
      edges.push(
        edge(`${ids.waypointId}-access`, ids.waypointId, ids.doorId, [[layout.x, y + .15, layout.z], [layout.x, y + .15, doorZ]]),
        edge(`${ids.doorId}-hall`, ids.doorId, corridors[column].id, [[layout.x, y + .15, doorZ], [layout.x, y + .15, 0]]),
      );
    });

    const westStairs = `stairs-${floorIndex + 1}`;
    const eastStairs = `f${floorIndex + 1}-east-stairs`;
    waypoints.push(
      { id: westStairs, name: `${floor.name} west stairs`, kind: "stairs", floorId: floor.id, position: [-16, y, 0] },
      { id: eastStairs, name: `${floor.name} east stairs`, kind: "stairs", floorId: floor.id, position: [16, y, 0] },
    );
    edges.push(
      edge(`f${floorIndex + 1}-west-stairs-access`, corridors[0].id, westStairs, [[-12, y + .15, 0], [-16, y + .15, 0]]),
      edge(`f${floorIndex + 1}-east-stairs-access`, corridors[2].id, eastStairs, [[8, y + .15, 0], [16, y + .15, 0]]),
    );
    if (floorIndex > 0) {
      const previousY = buildingFloors[floorIndex - 1].elevation + .35;
      edges.push(
        edge(`west-stairs-${floorIndex}`, `stairs-${floorIndex}`, westStairs, [[-16, previousY, 0], [-16, y + .15, 0]]),
        edge(`east-stairs-${floorIndex}`, `f${floorIndex}-east-stairs`, eastStairs, [[16, previousY, 0], [16, y + .15, 0]]),
      );
    }
  });

  waypoints.push(
    { id: "south-exit", name: "South Exit", kind: "exit", floorId: "level-1", position: [-3, .2, 14] },
    { id: "north-exit", name: "North Exit", kind: "exit", floorId: "level-1", position: [-12, .2, -14] },
  );
  edges.push(
    edge("atrium-south", "atrium", "south-exit", [[-3, .35, 0], [-3, .35, 14]], { blockable: true }),
    edge("west-north", "west-hall", "north-exit", [[-12, .35, 0], [-12, .35, -14]], { blockable: true }),
  );

  const preferred = new Map<string, { id: string; name: string }>([
    ["reception-room", { id: "A-01", name: "Reception" }],
    ["office-room", { id: "A-02", name: "Office A" }],
    ["meeting-room", { id: "A-03", name: "Meeting Room" }],
    ["storage-room", { id: "A-04", name: "Storage Room" }],
  ]);
  const rawSensors: SensorNode[] = [];
  const usedIds = new Set(Array.from(preferred.values(), (item) => item.id));
  let sequence = 5;
  const nextId = () => {
    let candidate = `A-${String(sequence++).padStart(2, "0")}`;
    while (usedIds.has(candidate)) candidate = `A-${String(sequence++).padStart(2, "0")}`;
    usedIds.add(candidate);
    return candidate;
  };

  rooms.forEach((room, roomIndex) => {
    const preferredSensor = preferred.get(room.id);
    const count = room.size[0] * room.size[1] >= 90 ? 2 : 1;
    for (let index = 0; index < count; index += 1) {
      const sensorId = index === 0 && preferredSensor ? preferredSensor.id : nextId();
      const offsetX = count === 2 ? (index === 0 ? -2.4 : 2.4) : 0;
      rawSensors.push(createSensor(
        id,
        sensorId,
        index === 0 && preferredSensor ? preferredSensor.name : count === 2 ? `${room.name} ${index + 1}` : room.name,
        [room.center[0] + offsetX, room.center[1] + 1.15, room.center[2]],
        sensorId === "A-01" ? 23 : sensorId === "A-02" ? 24 : sensorId === "A-03" ? 22 : sensorId === "A-04" ? 24 : 21 + (roomIndex % 5) * .6,
        49 - (roomIndex % 4) * 2,
        { roomId: room.id, floorId: room.floorId, range: 13.8 },
      ));
    }
  });
  buildingFloors.forEach((floor, floorIndex) => {
    [-12, -3, 8].forEach((x, column) => rawSensors.push(createSensor(
      id,
      nextId(),
      `${floor.name} ${["West", "Central", "East"][column]} Corridor`,
      [x, floor.elevation + 1.15, 0],
      22 + floorIndex * .5,
      47 - floorIndex,
      { floorId: floor.id, range: 13.8 },
    )));
  });

  return {
    id,
    name: "Building A",
    shortName: "A",
    kind: "building",
    modelKey: "office-cutaway",
    location: "Junction Campus · Operations Center",
    sensors: connectNearest(rawSensors, 6),
    floors: buildingFloors,
    rooms,
    exits: [
      { id: "building-a-south", name: "South Exit", waypointId: "south-exit", position: [-3, .2, 14] },
      { id: "building-a-north", name: "North Exit", waypointId: "north-exit", position: [-12, .2, -14] },
    ],
    waypoints,
    routeGraph: { vertices: waypoints, edges },
    defaultSensorId: "A-02",
    defaultOriginId: "office-a",
    fireSensorId: "A-04",
    blockableEdgeId: "atrium-south",
    offlineSensorId: "A-03",
  };
}

function elevatedPoint(x: number, z: number): Vector3Tuple {
  return [x, forestElevation(x, z) + .35, z];
}

function buildForestDefinition(): EnvironmentDefinition {
  const id: EnvironmentId = "forest-north";
  const waypointData = [
    ["north-west-ridge", "North-west Ridge", "trail", -29, -20],
    ["north-clearing", "North Clearing", "clearing", 0, -18],
    ["north-east-lookout", "North-east Lookout", "trail", 29, -19],
    ["west-exit", "West Trailhead", "exit", -36, 0],
    ["central-clearing", "Central Clearing", "clearing", -5, 0],
    ["lake-trail", "East Grove Trail", "trail", 18, 2],
    ["south-west-trail", "South-west Trail", "trail", -24, 19],
    ["south-clearing", "South Clearing", "clearing", 4, 21],
    ["east-exit", "East Trailhead", "exit", 36, 9],
    ["north-exit", "North Ridge Exit", "exit", 0, -28],
    ["south-exit", "South Clearing Exit", "exit", 4, 28],
  ] as const;
  const waypoints: Waypoint[] = waypointData.map(([waypointId, name, kind, x, z]) => ({ id: waypointId, name, kind, position: elevatedPoint(x, z) }));
  const p = (waypointId: string) => waypoints.find((waypoint) => waypoint.id === waypointId)!.position;
  const forestEdges: RouteEdge[] = [
    edge("ridge-north", "north-west-ridge", "north-clearing", [p("north-west-ridge"), elevatedPoint(-14, -20), p("north-clearing")]),
    edge("north-lookout", "north-clearing", "north-east-lookout", [p("north-clearing"), elevatedPoint(15, -21), p("north-east-lookout")]),
    edge("ridge-west", "north-west-ridge", "west-exit", [p("north-west-ridge"), elevatedPoint(-34, -10), p("west-exit")]),
    edge("north-central", "north-clearing", "central-clearing", [p("north-clearing"), elevatedPoint(-4, -9), p("central-clearing")]),
    edge("west-central", "west-exit", "central-clearing", [p("west-exit"), elevatedPoint(-20, -2), p("central-clearing")]),
    edge("central-lake", "central-clearing", "lake-trail", [p("central-clearing"), elevatedPoint(7, 1), p("lake-trail")], { blockable: true }),
    edge("lookout-lake", "north-east-lookout", "lake-trail", [p("north-east-lookout"), elevatedPoint(24, -9), p("lake-trail")]),
    edge("lake-east", "lake-trail", "east-exit", [p("lake-trail"), elevatedPoint(28, 5), p("east-exit")]),
    edge("central-south-west", "central-clearing", "south-west-trail", [p("central-clearing"), elevatedPoint(-15, 10), p("south-west-trail")]),
    edge("south-west-clearing", "south-west-trail", "south-clearing", [p("south-west-trail"), elevatedPoint(-10, 22), p("south-clearing")]),
    edge("south-lake", "south-clearing", "lake-trail", [p("south-clearing"), elevatedPoint(12, 13), p("lake-trail")]),
    edge("south-east", "south-clearing", "east-exit", [p("south-clearing"), elevatedPoint(21, 17), p("east-exit")]),
    edge("north-gate", "north-clearing", "north-exit", [p("north-clearing"), p("north-exit")]),
    edge("ridge-north-gate", "north-west-ridge", "north-exit", [p("north-west-ridge"), elevatedPoint(-16, -26), p("north-exit")]),
    edge("south-gate", "south-clearing", "south-exit", [p("south-clearing"), p("south-exit")]),
    edge("south-west-gate", "south-west-trail", "south-exit", [p("south-west-trail"), elevatedPoint(-12, 27), p("south-exit")]),
  ];

  const rawSensors: SensorNode[] = [];
  let sequence = 1;
  for (let row = 0; row < 6; row += 1) {
    for (let column = 0; column < 6; column += 1) {
      const x = -32.5 + column * 13;
      const z = -24 + row * 9.6;
      const sensorId = `N-${String(sequence++).padStart(2, "0")}`;
      rawSensors.push(createSensor(
        id,
        sensorId,
        `Sector ${String.fromCharCode(65 + row)}${column + 1}`,
        [x, forestElevation(x, z) + 1.25, z],
        17.5 + ((row * 3 + column) % 7) * .7,
        68 - ((row + column * 2) % 8) * 2.2,
        { range: 16.8 },
      ));
    }
  }

  return {
    id,
    name: "Forest North",
    shortName: "North",
    kind: "forest",
    modelKey: "woodland-valley",
    location: "Sector 4 · Northern Basin",
    sensors: connectNearest(rawSensors, 7),
    floors: [],
    rooms: [],
    exits: [
      { id: "forest-north-west", name: "West Trailhead", waypointId: "west-exit", position: p("west-exit") },
      { id: "forest-north-east", name: "East Trailhead", waypointId: "east-exit", position: p("east-exit") },
      { id: "forest-north-ridge", name: "North Ridge Exit", waypointId: "north-exit", position: p("north-exit") },
      { id: "forest-north-south", name: "South Clearing Exit", waypointId: "south-exit", position: p("south-exit") },
    ],
    waypoints,
    routeGraph: { vertices: waypoints, edges: forestEdges },
    defaultSensorId: "N-20",
    defaultOriginId: "central-clearing",
    fireSensorId: "N-03",
    blockableEdgeId: "central-lake",
    offlineSensorId: "N-22",
  };
}

export const ENVIRONMENTS: EnvironmentDefinition[] = [buildBuildingDefinition(), buildForestDefinition()];

export const ENVIRONMENT_BY_ID = Object.fromEntries(
  ENVIRONMENTS.map((environment) => [environment.id, environment]),
) as Record<EnvironmentId, EnvironmentDefinition>;
