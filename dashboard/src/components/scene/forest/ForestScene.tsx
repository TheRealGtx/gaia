"use client";

import { Line, Text } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { EnvironmentDefinition } from "../../../domain/types";
import { forestElevation } from "../../../domain/terrain";

interface TreeData {
  position: [number, number, number];
  scale: number;
  tone: string;
}

function InstancedTrees({ trees }: { trees: TreeData[] }) {
  const trunks = useRef<THREE.InstancedMesh>(null);
  const lowerCrowns = useRef<THREE.InstancedMesh>(null);
  const upperCrowns = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const object = new THREE.Object3D();
    trees.forEach((tree, index) => {
      const [x, y, z] = tree.position;
      object.position.set(x, y + 1.05 * tree.scale, z);
      object.scale.setScalar(tree.scale);
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
    }
  }, [trees]);
  return <group>
    <instancedMesh ref={trunks} args={[undefined, undefined, trees.length]} castShadow receiveShadow><cylinderGeometry args={[.18, .28, 2.1, 7]} /><meshStandardMaterial color="#71543b" /></instancedMesh>
    <instancedMesh ref={lowerCrowns} args={[undefined, undefined, trees.length]} castShadow><coneGeometry args={[1.2, 3.5, 8]} /><meshStandardMaterial /></instancedMesh>
    <instancedMesh ref={upperCrowns} args={[undefined, undefined, trees.length]} castShadow><coneGeometry args={[.92, 2.8, 8]} /><meshStandardMaterial /></instancedMesh>
  </group>;
}

function nearTrail(x: number, z: number, definition: EnvironmentDefinition) {
  return definition.routeGraph.edges.some((routeEdge) => routeEdge.points.some((point) => Math.hypot(point[0] - x, point[2] - z) < 2.7));
}

export function ForestScene({ definition, showLabels = true }: { definition: EnvironmentDefinition; showLabels?: boolean }) {
  const geometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(78, 60, 72, 56);
    plane.rotateX(-Math.PI / 2);
    const position = plane.attributes.position;
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const z = position.getZ(index);
      position.setY(index, forestElevation(x, z));
    }
    plane.computeVertexNormals();
    return plane;
  }, []);
  const trees = useMemo(() => {
    const result: TreeData[] = [];
    for (let row = 0; row < 14; row += 1) {
      for (let column = 0; column < 18; column += 1) {
        const index = row * 18 + column;
        const x = -36 + column * 4.25 + Math.sin(index * 2.31) * 1.25;
        const z = -27 + row * 4.1 + Math.cos(index * 1.77) * 1.05;
        const water = x > 11 && x < 24 && z > -8 && z < 13;
        const clearing = Math.hypot(x + 5, z) < 5.2 || Math.hypot(x - 4, z - 21) < 4.4;
        if (water || clearing || nearTrail(x, z, definition)) continue;
        result.push({
          position: [x, forestElevation(x, z), z],
          scale: .68 + (index % 9) * .045,
          tone: ["#315f49", "#3d704f", "#4d7a53", "#2f5945", "#557f4d"][index % 5],
        });
      }
    }
    return result;
  }, [definition]);

  return <group>
    <mesh receiveShadow geometry={geometry}><meshStandardMaterial color="#89a474" flatShading /></mesh>
    <mesh position={[17.5, forestElevation(17.5, 3) + .18, 3]} rotation={[-Math.PI / 2, 0, -.08]}><planeGeometry args={[11, 22]} /><meshStandardMaterial color="#4ea6b8" transparent opacity={.82} /></mesh>
    <mesh position={[-5, forestElevation(-5, 0) + .1, 0]} rotation-x={-Math.PI / 2}><circleGeometry args={[5.1, 40]} /><meshStandardMaterial color="#a9b98d" /></mesh>
    <mesh position={[4, forestElevation(4, 21) + .1, 21]} rotation-x={-Math.PI / 2}><circleGeometry args={[4.3, 40]} /><meshStandardMaterial color="#a9b98d" /></mesh>
    <InstancedTrees trees={trees} />
    {definition.routeGraph.edges.map((routeEdge) => <Line key={routeEdge.id} points={routeEdge.points.map((point) => [point[0], point[1] + .08, point[2]] as [number, number, number])} color={routeEdge.blockable ? "#d7bc85" : "#cbb383"} lineWidth={8} />)}
    {Array.from({ length: 24 }, (_, index) => {
      const x = -34 + ((index * 17) % 68);
      const z = -25 + ((index * 23) % 50);
      return <mesh key={index} position={[x, forestElevation(x, z) + .3, z]} castShadow><dodecahedronGeometry args={[.38 + (index % 4) * .12]} /><meshStandardMaterial color="#718078" /></mesh>;
    })}
    {definition.exits.map((exit) => <group key={exit.id} position={exit.position}><mesh position={[0, 1.35, 0]} castShadow><cylinderGeometry args={[.09, .09, 2.7, 8]} /><meshStandardMaterial color="#047857" /></mesh><mesh position={[0, 2.5, 0]}><boxGeometry args={[2.7, .78, .18]} /><meshStandardMaterial color="#10b981" /></mesh>{showLabels ? <Text position={[0, 2.5, .11]} fontSize={.32} color="#ffffff">{exit.name}</Text> : null}</group>)}
  </group>;
}
