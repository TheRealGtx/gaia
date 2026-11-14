import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, RGBAFormat, SRGBColorSpace } from "three";

/** Small, seamless running-bond texture shared by every wall. */
export function createBrickTexture() {
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    const row = Math.floor(y / 32);
    for (let x = 0; x < size; x += 1) {
      const offsetX = x + (row % 2) * 32;
      const column = Math.floor(offsetX / 64) % 2;
      const mortar = y % 32 < 2 || offsetX % 64 < 2;
      const variation = Math.sin(row * 7 + column * 11) * 10;
      const grain = Math.sin(x * 17 + y * 31) * 2;
      const color = mortar ? [111, 98, 83] : [165 + variation + grain, 94 + variation + grain, 69 + variation + grain];
      const index = (y * size + x) * 4;
      pixels.set([...color.map(Math.round), 255], index);
    }
  }
  const texture = new DataTexture(pixels, size, size, RGBAFormat);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}
