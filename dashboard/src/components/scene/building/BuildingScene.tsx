"use client";

import { Text } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import { BoxGeometry, type Texture } from "three";
import type { EnvironmentDefinition, Floor, Room } from "../../../domain/types";
import { createBrickTexture } from "./brickSurface";

function Box({ position, size, color = "#c9bb9e", opacity = 1, rotation = [0, 0, 0] }: { position: [number, number, number]; size: [number, number, number]; color?: string; opacity?: number; rotation?: [number, number, number] }) {
  return <mesh position={position} rotation={rotation} castShadow receiveShadow><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={.8} transparent={opacity < 1} opacity={opacity} /></mesh>;
}

function BrickWall({ position, size, texture, opacity }: { position: [number, number, number]; size: [number, number, number]; texture: Texture; opacity: number }) {
  const [width, height, depth] = size;
  const geometry = useMemo(() => {
    const box = new BoxGeometry(width, height, depth);
    const uv = box.attributes.uv;
    const faces = [[depth, height], [depth, height], [width, depth], [width, depth], [width, height], [width, height]];
    for (let face = 0; face < faces.length; face += 1) {
      for (let corner = 0; corner < 4; corner += 1) {
        const index = face * 4 + corner;
        uv.setXY(index, uv.getX(index) * faces[face][0] / .8, uv.getY(index) * faces[face][1] / .8);
      }
    }
    return box;
  }, [width, height, depth]);
  return <mesh position={position} geometry={geometry} castShadow receiveShadow><meshStandardMaterial map={texture} bumpMap={texture} bumpScale={.025} roughness={.96} transparent={opacity < 1} opacity={opacity} /></mesh>;
}

function Desk({ x, y, z, rotation = 0 }: { x: number; y: number; z: number; rotation?: number }) {
  return <group position={[x, y, z]} rotation-y={rotation}><Box position={[0, .74, 0]} size={[2.1, .14, .9]} color="#ad8058" /><Box position={[-.82, .36, 0]} size={[.12, .72, .12]} color="#596779" /><Box position={[.82, .36, 0]} size={[.12, .72, .12]} color="#596779" /><Box position={[0, 1.12, -.15]} size={[.72, .46, .08]} color="#263442" /><Box position={[0, .42, .72]} size={[.72, .12, .7]} color="#667789" /></group>;
}

function RoomFurniture({ room, floor }: { room: Room; floor: Floor }) {
  const [x, , z] = room.center;
  const y = floor.elevation;
  const large = room.size[0] * room.size[1] >= 90;
  const laboratory = /lab|workshop|prototype|systems/i.test(room.name);
  const storage = /storage|archive/i.test(room.name);
  if (storage) return <group>{[-1.8, 0, 1.8].map((offset) => <Box key={offset} position={[x + offset, y + 1.05, z - 2.7]} size={[1.35, 2.1, .48]} color="#8b9aaa" />)}<Box position={[x, y + .55, z + 1.6]} size={[3.8, 1.1, 1.3]} color="#c69a68" /></group>;
  if (large || laboratory) return <group><Box position={[x, y + .76, z]} size={[5.1, .16, 1.45]} color={laboratory ? "#93a5ad" : "#b88c63"} />{[-2, 0, 2].map((offset) => <Box key={`north-${offset}`} position={[x + offset, y + .43, z - 1.25]} size={[.72, .12, .72]} color="#607286" />)}{[-2, 0, 2].map((offset) => <Box key={`south-${offset}`} position={[x + offset, y + .43, z + 1.25]} size={[.72, .12, .72]} color="#607286" />)}{laboratory ? <><Box position={[x - 3.9, y + 1.1, z]} size={[.65, 2.2, 3.2]} color="#d9e3e7" /><Box position={[x + 3.9, y + 1.1, z]} size={[.65, 2.2, 3.2]} color="#d9e3e7" /></> : null}</group>;
  return <group><Desk x={x} y={y} z={z - .4} rotation={z < 0 ? Math.PI : 0} />{room.name.includes("Reception") ? <Box position={[x - 2.5, y + .45, z + 2.3]} size={[2.6, .85, .8]} color="#91a7a0" /> : null}</group>;
}

function Door({ x, y, z, facingSouth }: { x: number; y: number; z: number; facingSouth: boolean }) {
  const frameColor = "#454b48";
  return <group position={[x, y, z]} rotation-y={facingSouth ? Math.PI : 0}><Box position={[-.72, 1.08, 0]} size={[.11, 2.16, .18]} color={frameColor} /><Box position={[.72, 1.08, 0]} size={[.11, 2.16, .18]} color={frameColor} /><Box position={[0, 2.1, 0]} size={[1.55, .12, .18]} color={frameColor} /><Box position={[0, 1.05, 0]} size={[1.3, 1.95, .08]} color="#b7ced1" opacity={.42} /></group>;
}

function Stairs({ x, floor }: { x: number; floor: Floor }) {
  return <group>{Array.from({ length: 10 }, (_, index) => <Box key={index} position={[x + (x < 0 ? index * .28 : -index * .28), floor.elevation + .18 + index * .22, -.15]} size={[.72, .18, 2.1]} color="#aebbc2" />)}<Box position={[x + (x < 0 ? 1.25 : -1.25), floor.elevation + 1.45, -1.25]} size={[3.6, .09, .09]} color="#52706c" rotation={[0, 0, x < 0 ? -.58 : .58]} /></group>;
}

function FloorShell({ floor, rooms, selectedRoomId, onSelectRoom, showLabels, faded, brickTexture }: { floor: Floor; rooms: Room[]; selectedRoomId: string | null; onSelectRoom(id: string): void; showLabels: boolean; faded: boolean; brickTexture: Texture }) {
  const wallY = floor.elevation + 1.9;
  const opacity = faded ? .88 : 1;
  return <group>
    <Box position={[0, floor.elevation, 0]} size={[36, .28, 28]} color={floor.level % 2 ? "#b8a68b" : "#c4b296"} opacity={opacity} />
    <BrickWall position={[0, wallY, -14]} size={[36, 3.8, .28]} texture={brickTexture} opacity={opacity} />
    <BrickWall position={[-18, wallY, 0]} size={[.28, 3.8, 28]} texture={brickTexture} opacity={opacity} />
    <BrickWall position={[18, wallY, -4]} size={[.28, 3.8, 20]} texture={brickTexture} opacity={opacity} />
    <BrickWall position={[-7.5, wallY, 7.2]} size={[.22, 3.8, 9.8]} texture={brickTexture} opacity={opacity} />
    <BrickWall position={[1.5, wallY, 7.2]} size={[.22, 3.8, 9.8]} texture={brickTexture} opacity={opacity} />
    <BrickWall position={[-7.5, wallY, -7.2]} size={[.22, 3.8, 9.8]} texture={brickTexture} opacity={opacity} />
    <BrickWall position={[1.5, wallY, -7.2]} size={[.22, 3.8, 9.8]} texture={brickTexture} opacity={opacity} />
    {[-15, -9.2, -6.2, -.4, 2.1, 5.7, 10.3, 14.8].map((x, index) => <BrickWall key={`north-wall-${x}`} position={[x, wallY, 2]} size={[index % 2 ? 3.7 : 2.2, 3.8, .22]} texture={brickTexture} opacity={opacity} />)}
    {[-15, -9.2, -6.2, -.4, 2.1, 5.7, 10.3, 14.8].map((x, index) => <BrickWall key={`south-wall-${x}`} position={[x, wallY, -2]} size={[index % 2 ? 3.7 : 2.2, 3.8, .22]} texture={brickTexture} opacity={opacity} />)}
    <Box position={[0, floor.elevation + 3.8, -14]} size={[36.4, .18, .5]} color="#736a5c" />
    <Box position={[-18, floor.elevation + 3.8, 0]} size={[.5, .18, 28]} color="#736a5c" />
    <Box position={[18, floor.elevation + 3.8, -4]} size={[.5, .18, 20]} color="#736a5c" />
    {rooms.map((room) => <group key={room.id}>
      <mesh position={[room.center[0], floor.elevation + .18, room.center[2]]} onClick={(event) => { event.stopPropagation(); onSelectRoom(room.id); }}>
        <boxGeometry args={[room.size[0] - .3, .12, room.size[1] - .3]} />
        <meshStandardMaterial color={room.id === selectedRoomId ? "#8de5bd" : "#ffffff"} transparent opacity={room.id === selectedRoomId ? .48 : .025} />
      </mesh>
      <Door x={room.center[0]} y={floor.elevation} z={room.center[2] > 0 ? 2 : -2} facingSouth={room.center[2] < 0} />
      <RoomFurniture room={room} floor={floor} />
      {showLabels && room.id === selectedRoomId ? <Text position={[room.center[0], floor.elevation + .42, room.center[2]]} rotation={[-Math.PI / 2, 0, 0]} fontSize={.5} color="#047857" anchorX="center">{room.name}</Text> : null}
    </group>)}
    {[-12, -3, 8].map((x) => <group key={`light-${x}`}>{[-1, 1].map((z) => <mesh key={z} position={[x, floor.elevation + 3.45, z]}><boxGeometry args={[1.8, .05, .24]} /><meshStandardMaterial color="#e9fff7" emissive="#d8fff0" emissiveIntensity={1.4} /></mesh>)}</group>)}
    {[-16, 16].map((x) => <Stairs key={x} x={x} floor={floor} />)}
    {[-12, -3, 8].map((x) => <group key={`window-${x}`} position={[x, floor.elevation + 2.05, -14.16]}>
      <Box position={[0, 0, 0]} size={[4.85, 1.95, .09]} color="#3c4847" />
      <mesh position={[0, 0, -.06]}><boxGeometry args={[4.6, 1.7, .04]} /><meshStandardMaterial color="#6e969b" roughness={.22} metalness={.25} /></mesh>
      <Box position={[0, 0, -.1]} size={[.09, 1.7, .05]} color="#3c4847" />
      <Box position={[0, -.99, 0]} size={[5.05, .14, .4]} color="#ac9d86" />
    </group>)}
  </group>;
}

export function BuildingScene({ definition, floorId, selectedRoomId, onSelectRoom, showLabels = true }: { definition: EnvironmentDefinition; floorId: string; selectedRoomId: string | null; onSelectRoom(id: string): void; showLabels?: boolean }) {
  const brickTexture = useMemo(createBrickTexture, []);
  useEffect(() => () => brickTexture.dispose(), [brickTexture]);
  const visibleFloors = definition.floors.filter((floor) => floorId === "all" || floor.id === floorId);
  return (
    <group>
      <Box position={[0, -.48, 0]} size={[40, .7, 32]} color="#918977" />
      {visibleFloors.map((floor) => <FloorShell key={floor.id} floor={floor} rooms={definition.rooms.filter((room) => room.floorId === floor.id)} selectedRoomId={selectedRoomId} onSelectRoom={onSelectRoom} showLabels={showLabels} faded={floorId === "all"} brickTexture={brickTexture} />)}
      {definition.exits.map((exit) => <group key={exit.id} position={exit.position}><Box position={[0, 1.2, 0]} size={[2.7, 2.4, .24]} color="#10b981" />{showLabels ? <Text position={[0, 2.8, 0]} fontSize={.46} color="#047857">{exit.name}</Text> : null}</group>)}
    </group>
  );
}
