export interface FireVisual {
  intensity: number;
  radius: number;
  flameHeight: number;
  flameCount: number;
  smokeOpacity: number;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function deriveFireVisual(
  temperature: number | null,
  humidity: number | null,
  baseRadius: number,
): FireVisual {
  const heat = clamp(((temperature ?? 20) - 30) / 70, 0, 1);
  const dryness = clamp((60 - (humidity ?? 50)) / 60, 0, 1);
  const intensity = clamp(heat * .7 + dryness * .3, .08, 1);
  return {
    intensity,
    radius: baseRadius * (.55 + intensity * .9),
    flameHeight: .9 + intensity * 4.8,
    flameCount: 3 + Math.round(intensity * 6),
    smokeOpacity: .06 + intensity * .38,
  };
}
