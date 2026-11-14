export function forestElevation(x: number, z: number): number {
  return Math.sin(x * .13) * 1.15
    + Math.cos(z * .17) * .72
    + Math.sin((x + z) * .075) * .85
    + Math.cos((x - z) * .05) * .45;
}
