import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Mesh, MeshBasicMaterial, PlaneGeometry, Raycaster, Vector3 } from "three";
import { forestElevation } from "../../../domain/terrain.ts";
import { createTerrainFoundation } from "./terrainFoundation.ts";

function surface() {
  const geometry = new PlaneGeometry(78, 60, 156, 120);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position;
  for (let index = 0; index < position.count; index += 1) {
    position.setY(index, forestElevation(position.getX(index), position.getZ(index)));
  }
  return geometry;
}

describe("solid forest foundation", () => {
  it("joins every terrain perimeter vertex without gaps", () => {
    const terrain = surface();
    const base = createTerrainFoundation(terrain);
    const positions = base.attributes.position;
    const vertices = new Set(Array.from({ length: positions.count }, (_, i) =>
      [positions.getX(i), positions.getY(i), positions.getZ(i)].join(",")));
    const top = terrain.attributes.position;
    for (let index = 0; index < top.count; index += 1) {
      if (Math.abs(top.getX(index)) === 39 || Math.abs(top.getZ(index)) === 30) {
        assert.ok(vertices.has([top.getX(index), top.getY(index), top.getZ(index)].join(",")));
      }
    }
    base.dispose();
    terrain.dispose();
  });

  it("has outward-facing walls on all four sides and a closed underside", () => {
    const terrain = surface();
    const base = createTerrainFoundation(terrain);
    const material = new MeshBasicMaterial();
    const mesh = new Mesh(base, material);
    const views = [
      { from: [60, -4, 0], direction: [-1, 0, 0] },
      { from: [-60, -4, 0], direction: [1, 0, 0] },
      { from: [0, -4, 50], direction: [0, 0, -1] },
      { from: [0, -4, -50], direction: [0, 0, 1] },
      { from: [4, -20, 3], direction: [0, 1, 0] },
    ];
    for (const { from, direction } of views) {
      const ray = new Raycaster(new Vector3(...from), new Vector3(...direction));
      assert.ok(ray.intersectObject(mesh).length > 0, `Solid from ${from}`);
    }
    base.dispose();
    material.dispose();
    terrain.dispose();
  });
});
