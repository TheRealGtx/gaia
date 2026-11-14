"use client";

import { Text } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { EnvironmentDefinition } from "../../../domain/types";
import { forestElevation } from "../../../domain/terrain";
import { distanceToTrail } from "./forestGround";
import { createTerrainFoundation } from "./terrainFoundation";

interface TreeData {
  position: [number, number, number];
  scale: number;
  tone: string;
  rotation: number;
}

function createCrown(radius: number, height: number) {
  const geometry = new THREE.ConeGeometry(radius, height, 10, 6);
  const positions = geometry.attributes.position;
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const angle = Math.atan2(z, x);
    const fringe = 1 + Math.sin(angle * 5 + y * 4) * .13 + Math.cos(y * 8) * .08;
    positions.setXYZ(index, x * fringe, y, z * fringe);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function InstancedTrees({ trees }: { trees: TreeData[] }) {
  const trunks = useRef<THREE.InstancedMesh>(null);
  const lowerCrowns = useRef<THREE.InstancedMesh>(null);
  const upperCrowns = useRef<THREE.InstancedMesh>(null);
  const lowerGeometry = useMemo(() => createCrown(1.5, 3.5), []);
  const upperGeometry = useMemo(() => createCrown(1.1, 3), []);
  useLayoutEffect(() => {
    const object = new THREE.Object3D();
    trees.forEach((tree, index) => {
      const [x, y, z] = tree.position;
      object.rotation.set(.025 * Math.sin(index), tree.rotation, .035 * Math.cos(index));
      object.position.set(x, y + 1.05 * tree.scale, z);
      object.scale.set(tree.scale, tree.scale * (1 + .1 * Math.sin(index)), tree.scale);
      object.updateMatrix();
      trunks.current?.setMatrixAt(index, object.matrix);
      object.position.set(x, y + 2.85 * tree.scale, z);
      object.updateMatrix();
      lowerCrowns.current?.setMatrixAt(index, object.matrix);
      object.position.set(x, y + 4.15 * tree.scale, z);
      object.scale.setScalar(tree.scale * .78);
      object.updateMatrix();
      upperCrowns.current?.setMatrixAt(index, object.matrix);
      const color = new THREE.Color(tree.tone);
      lowerCrowns.current?.setColorAt(index, color);
      upperCrowns.current?.setColorAt(index, color.clone().offsetHSL(0, .02, .045));
    });
    for (const mesh of [trunks.current, lowerCrowns.current, upperCrowns.current]) {
      if (!mesh) continue;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [trees]);
  return <group>
    <instancedMesh ref={trunks} args={[undefined, undefined, trees.length]} castShadow receiveShadow><cylinderGeometry args={[.14, .29, 2.1, 8]} /><meshStandardMaterial color="#594333" roughness={1} /></instancedMesh>
    <instancedMesh ref={lowerCrowns} geometry={lowerGeometry} args={[undefined, undefined, trees.length]} castShadow receiveShadow><meshStandardMaterial roughness={.95} flatShading /></instancedMesh>
    <instancedMesh ref={upperCrowns} geometry={upperGeometry} args={[undefined, undefined, trees.length]} castShadow receiveShadow><meshStandardMaterial roughness={.95} flatShading /></instancedMesh>
  </group>;
}

export function ForestScene({ definition, showLabels = true }: { definition: EnvironmentDefinition; showLabels?: boolean }) {
  const geometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(78, 60, 156, 120);
    plane.rotateX(-Math.PI / 2);
    const position = plane.attributes.position;
    const colors = new Float32Array(position.count * 3);
    const moss = new THREE.Color("#64744b");
    const grass = new THREE.Color("#8a9162");
    const earth = new THREE.Color("#ad9672");
    const color = new THREE.Color();
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const z = position.getZ(index);
      position.setY(index, forestElevation(x, z));
      const variation = .5 + Math.sin(x * .065 + z * .045) * .18;
      color.copy(moss).lerp(grass, variation);
      const trailDistance = distanceToTrail(x, z, definition.routeGraph.edges);
      const trail = 1 - THREE.MathUtils.smoothstep(trailDistance, .8, 1.1);
      const clearing = Math.max(
        1 - THREE.MathUtils.smoothstep(Math.hypot(x + 5, z), 3.5, 5.5),
        1 - THREE.MathUtils.smoothstep(Math.hypot(x - 4, z - 21), 2.8, 4.6),
      );
      color.lerp(earth, Math.max(trail, clearing * .7));
      color.toArray(colors, index * 3);
    }
    plane.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    plane.computeVertexNormals();
    return plane;
  }, [definition]);
  const foundation = useMemo(() => createTerrainFoundation(geometry), [geometry]);
  const trees = useMemo(() => {
    const result: TreeData[] = [];
    for (let row = 0; row < 14; row += 1) {
      for (let column = 0; column < 18; column += 1) {
        const index = row * 18 + column;
        const x = -36 + column * 4.25 + Math.sin(index * 2.31) * 1.25;
        const z = -27 + row * 4.1 + Math.cos(index * 1.77) * 1.05;
        const clearing = Math.hypot(x + 5, z) < 5.2 || Math.hypot(x - 4, z - 21) < 4.4;
        const nearSensor = definition.sensors.some(({ position }) => Math.hypot(x - position[0], z - position[2]) < 2.3);
        if (clearing || nearSensor || distanceToTrail(x, z, definition.routeGraph.edges) < 2.5) continue;
        result.push({
          position: [x, forestElevation(x, z), z],
          scale: .62 + (index % 11) * .057,
          tone: ["#304f3b", "#456345", "#526c46", "#365344", "#637649"][index % 5],
          rotation: index * 2.399,
        });
      }
    }
    return result;
  }, [definition]);

  return <group>
    <mesh castShadow receiveShadow geometry={foundation}><meshStandardMaterial vertexColors roughness={1} /></mesh>
    <mesh castShadow receiveShadow geometry={geometry}><meshStandardMaterial vertexColors roughness={1} /></mesh>
    <InstancedTrees trees={trees} />
    {Array.from({ length: 24 }, (_, index) => {
      const x = -34 + ((index * 17) % 68);
      const z = -25 + ((index * 23) % 50);
      if (distanceToTrail(x, z, definition.routeGraph.edges) < 1.6) return null;
      return <mesh key={index} position={[x, forestElevation(x, z) + .2, z]} rotation={[index * .3, index * 1.7, .2]} scale={[1.4, .65, 1]} castShadow receiveShadow><dodecahedronGeometry args={[.38 + (index % 4) * .12]} /><meshStandardMaterial color={index % 2 ? "#77796c" : "#929084"} roughness={1} flatShading /></mesh>;
    })}
    {definition.exits.map((exit) => <group key={exit.id} position={exit.position}><mesh position={[0, 1.35, 0]} castShadow><cylinderGeometry args={[.09, .09, 2.7, 8]} /><meshStandardMaterial color="#047857" /></mesh><mesh position={[0, 2.5, 0]}><boxGeometry args={[2.7, .78, .18]} /><meshStandardMaterial color="#10b981" /></mesh>{showLabels ? <Text position={[0, 2.5, .11]} fontSize={.32} color="#ffffff">{exit.name}</Text> : null}</group>)}
  </group>;
}
