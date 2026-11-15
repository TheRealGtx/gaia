// What this build of the dashboard offers.
//
// The public deployment (Vercel) has no boards and no gateway to talk to, so
// it is built with NEXT_PUBLIC_GAIA_LIVE=off: Simulation only, no Live mode,
// no Live field page. Locally the variable is unset and everything is there.
// NEXT_PUBLIC_ variables are inlined at build time: change it, rebuild.

export function isLiveEnabled(value: string | undefined): boolean {
  return (value ?? "").trim().toLowerCase() !== "off";
}

export const LIVE_ENABLED = isLiveEnabled(process.env.NEXT_PUBLIC_GAIA_LIVE);
