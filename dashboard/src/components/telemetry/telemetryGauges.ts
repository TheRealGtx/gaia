export const GAUGE_ARC_PATH = "M 12.785 77.038 A 46 46 0 1 1 87.215 77.038";

const GAUGE_ARC_START_DEGREES = 144;
const GAUGE_ARC_SWEEP_DEGREES = 252;
const GAUGE_ARC_RADIUS = 46;

export function gaugePercent(value: number | null, minimum: number, maximum: number): number | null {
  if (value === null || !Number.isFinite(value) || maximum <= minimum) return null;
  return Math.min(100, Math.max(0, (value - minimum) / (maximum - minimum) * 100));
}

export function gaugeArcPoint(percent: number) {
  const bounded = Math.min(100, Math.max(0, percent));
  const angle = (GAUGE_ARC_START_DEGREES + bounded / 100 * GAUGE_ARC_SWEEP_DEGREES) * Math.PI / 180;
  return {
    x: Math.round((50 + Math.cos(angle) * GAUGE_ARC_RADIUS) * 1000) / 1000,
    y: Math.round((50 + Math.sin(angle) * GAUGE_ARC_RADIUS) * 1000) / 1000,
  };
}

export function temperatureGaugeBounds(minimum: number | null, maximum: number | null) {
  if (minimum === null || maximum === null || !Number.isFinite(minimum) || !Number.isFinite(maximum) || maximum < minimum) {
    return { minimum: -5, maximum: 40 };
  }
  const padding = Math.max(1, (maximum - minimum) * .25);
  return { minimum: minimum - padding, maximum: maximum + padding };
}
