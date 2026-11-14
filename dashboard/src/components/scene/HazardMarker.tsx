"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { LatheGeometry, Object3D, Vector2, type BufferGeometry, type Group, type InstancedMesh, type Mesh, type MeshStandardMaterial } from "three";
import type { Hazard } from "../../domain/types";
import { deriveFireVisual, type FireVisual } from "./fireVisual";
import { advanceAnimationTime } from "./rendering";

type VisualHazard = Hazard & { visual?: FireVisual };

function FireEffect({ hazard }: { hazard: VisualHazard }) {
  const outer = useRef<InstancedMesh>(null);
  const cores = useRef<InstancedMesh>(null);
  const embers = useRef<InstancedMesh>(null);
  const smoke = useRef<Group>(null);
  const animationTime = useRef(0);
  const reducedMotion = useRef(false);
  const visual = hazard.visual ?? deriveFireVisual(null, null, hazard.radius);
  const object = useMemo(() => new Object3D(), []);
  const flameGeometry = useMemo(() => new LatheGeometry([
    new Vector2(0, 0), new Vector2(.55, .08), new Vector2(1, .28),
    new Vector2(.7, .6), new Vector2(.28, .85), new Vector2(0, 1),
  ], 12), []);
  const flameData = useMemo(() => Array.from({ length: visual.flameCount }, (_, index) => {
    const angle = index * 2.39996;
    const spread = index === 0 ? 0 : visual.radius * (.12 + (index % 3) * .09);
    return {
      x: Math.cos(angle) * spread,
      z: Math.sin(angle) * spread,
      height: visual.flameHeight * (.58 + (index % 4) * .12),
      width: .28 + visual.intensity * .34 + (index % 2) * .08,
    };
  }), [visual.flameCount, visual.flameHeight, visual.intensity, visual.radius]);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { reducedMotion.current = preference.matches; };
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useFrame((_, delta) => {
    if (!outer.current || !cores.current || !embers.current || !smoke.current) return;
    if (!reducedMotion.current) animationTime.current = advanceAnimationTime(animationTime.current, delta);
    const time = animationTime.current;
    const phase = hazard.position[0] * .31 + hazard.position[2] * .17;
    flameData.forEach((flame, index) => {
      const beat = time * 5 + phase + index * 1.7;
      const height = flame.height * (1 + Math.sin(beat) * .14 + Math.sin(beat * 1.7) * .06);
      object.position.set(flame.x, .04, flame.z);
      object.rotation.set(Math.sin(beat * .65) * .1, 0, Math.cos(beat * .8) * .12);
      object.scale.set(flame.width, height, flame.width);
      object.updateMatrix();
      outer.current!.setMatrixAt(index, object.matrix);
      object.scale.set(flame.width * .52, height * .68, flame.width * .52);
      object.updateMatrix();
      cores.current!.setMatrixAt(index, object.matrix);
    });
    for (const mesh of [outer.current, cores.current]) mesh.instanceMatrix.needsUpdate = true;
    smoke.current.children.forEach((child, index) => {
      const puff = child as Mesh<BufferGeometry, MeshStandardMaterial>;
      const life = (time * .18 + index / 4) % 1;
      puff.position.set(Math.sin(phase + index * 2) * .35 + life * 1.1, visual.flameHeight * .65 + life * 4.5, Math.cos(index) * .25 + life * .45);
      puff.scale.setScalar(.55 + life * 1.2);
      puff.material.opacity = visual.smokeOpacity * .65 * Math.sin(life * Math.PI);
    });
    for (let index = 0; index < 6; index += 1) {
      const life = (time * (.3 + index * .025) + index / 6) % 1;
      object.position.set(Math.sin(index * 2.4 + life) * (.2 + life * .8), life * (visual.flameHeight + 2), Math.cos(index * 2.4) * (.2 + life * .5));
      object.rotation.set(0, 0, 0);
      object.scale.setScalar(.045 * Math.sin(life * Math.PI));
      object.updateMatrix();
      embers.current.setMatrixAt(index, object.matrix);
    }
    embers.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group position={hazard.position}>
      <mesh rotation-x={-Math.PI / 2} position={[0, .03, 0]}>
        <circleGeometry args={[visual.radius, 40]} />
        <meshBasicMaterial color="#ef6025" transparent opacity={.1 + visual.intensity * .1} depthWrite={false} />
      </mesh>
      <instancedMesh ref={outer} args={[undefined, undefined, visual.flameCount]} geometry={flameGeometry} frustumCulled={false}>
        <meshBasicMaterial color="#f96518" transparent opacity={.76} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={cores} args={[undefined, undefined, visual.flameCount]} geometry={flameGeometry} frustumCulled={false}>
        <meshBasicMaterial color="#ffe29a" toneMapped={false} />
      </instancedMesh>
      <group ref={smoke}>
        {[0, 1, 2, 3].map((index) => <mesh key={index}>
          <sphereGeometry args={[.62 + visual.intensity * .42, 12, 8]} />
          <meshStandardMaterial color="#6a6965" transparent opacity={0} depthWrite={false} roughness={1} />
        </mesh>)}
      </group>
      <instancedMesh ref={embers} args={[undefined, undefined, 6]} frustumCulled={false}>
        <sphereGeometry args={[1, 6, 4]} />
        <meshBasicMaterial color="#ffbd57" toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

export function HazardMarker({ hazard }: { hazard: VisualHazard }) {
  if (hazard.kind === "obstruction") return <group position={hazard.position}><mesh castShadow><boxGeometry args={[2.4, 1.1, .45]} /><meshStandardMaterial color="#f59e0b" /></mesh><mesh position={[0, .8, 0]}><octahedronGeometry args={[.35]} /><meshStandardMaterial color="#fff7ed" emissive="#f59e0b" /></mesh></group>;
  return <FireEffect hazard={hazard} />;
}
