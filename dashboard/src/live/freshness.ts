export type FreshnessState = "fresh" | "stale" | "offline";

export interface FreshnessPolicy {
  staleAfterMs: number;
  offlineAfterMs: number;
}

export function getFreshness(
  lastUpdate: string,
  now: Date,
  policy: FreshnessPolicy,
): FreshnessState {
  const timestamp = Date.parse(lastUpdate);
  if (!Number.isFinite(timestamp)) return "offline";
  const age = Math.max(0, now.getTime() - timestamp);
  if (age >= policy.offlineAfterMs) return "offline";
  if (age >= policy.staleAfterMs) return "stale";
  return "fresh";
}
