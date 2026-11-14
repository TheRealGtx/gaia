import { BufferGeometry, Color, Float32BufferAttribute, type PlaneGeometry } from "three";

/** Closes a height-mapped plane with earth walls and a downward-facing floor. */
export function createTerrainFoundation(surface: PlaneGeometry, depth = 4.5): BufferGeometry {
  const { widthSegments, heightSegments } = surface.parameters;
  const stride = widthSegments + 1;
  const surfacePositions = surface.attributes.position;
  const perimeter: number[] = [];
  for (let x = 0; x < widthSegments; x += 1) perimeter.push(x);
  for (let z = 0; z < heightSegments; z += 1) perimeter.push(z * stride + widthSegments);
  for (let x = widthSegments; x > 0; x -= 1) perimeter.push(heightSegments * stride + x);
  for (let z = heightSegments; z > 0; z -= 1) perimeter.push(z * stride);

  let lowest = Infinity;
  for (let index = 0; index < surfacePositions.count; index += 1) {
    lowest = Math.min(lowest, surfacePositions.getY(index));
  }
  const bottom = lowest - depth;
  const layers = [
    { fraction: 0, inset: 0, color: new Color("#59583b") },
    { fraction: .13, inset: 0, color: new Color("#65503a") },
    { fraction: .55, inset: .15, color: new Color("#806349") },
    { fraction: 1, inset: .45, color: new Color("#50483d") },
  ];
  const positions: number[] = [];
  const colors: number[] = [];
  type Vertex = { position: number[]; color: Color };
  const rings = layers.map((layer) => perimeter.map((index): Vertex => {
    const x = surfacePositions.getX(index);
    const y = surfacePositions.getY(index);
    const z = surfacePositions.getZ(index);
    return {
      position: [
        x * (1 - layer.inset * 2 / surface.parameters.width),
        y + (bottom - y) * layer.fraction,
        z * (1 - layer.inset * 2 / surface.parameters.height),
      ],
      color: layer.color,
    };
  }));
  const triangle = (a: Vertex, b: Vertex, c: Vertex) => {
    for (const vertex of [a, b, c]) {
      positions.push(...vertex.position);
      colors.push(vertex.color.r, vertex.color.g, vertex.color.b);
    }
  };
  for (let layer = 0; layer < rings.length - 1; layer += 1) {
    for (let index = 0; index < perimeter.length; index += 1) {
      const next = (index + 1) % perimeter.length;
      triangle(rings[layer][index], rings[layer][next], rings[layer + 1][index]);
      triangle(rings[layer][next], rings[layer + 1][next], rings[layer + 1][index]);
    }
  }
  const floor = rings[rings.length - 1];
  const center = { position: [0, bottom, 0], color: layers[layers.length - 1].color };
  for (let index = 0; index < floor.length; index += 1) {
    triangle(center, floor[index], floor[(index + 1) % floor.length]);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
