import type { EnvironmentState, EvacuationRoute } from "../../domain/types.ts";

export function generateIntelligenceSummary(
  state: EnvironmentState,
  route: EvacuationRoute | null,
): string {
  if (state.source === "live" && state.aiSummary) return state.aiSummary;
  const fires = state.hazards.filter((hazard) => hazard.kind === "simulated-fire" || hazard.kind === "confirmed-fire");
  const fire = fires[0];
  const obstruction = state.hazards.find((hazard) => hazard.kind === "obstruction");
  const offline = state.sensors.filter((sensor) => sensor.status === "offline");
  const parts: string[] = [];

  if (fire) {
    const node = state.sensors.find((sensor) => (
      Math.hypot(sensor.position[0] - fire.position[0], sensor.position[2] - fire.position[2]) < 0.5
    ));
    const consensus = state.consensus;
    parts.push(fires.length > 1 ? `${fires.length} simulated fires are active across the environment.` : `A simulated fire scenario is active${node ? ` near ${node.name}` : ""}.`);
    if (consensus) parts.push(`For the most recently evaluated node, ${consensus.agreeing} of ${consensus.eligible} available neighbour nodes report correlated anomalies in this simulation.`);
  } else if (state.alerts.some((alert) => alert.kind === "local-anomaly")) {
    parts.push("A local anomaly is present, but the network has not confirmed a fire.");
  } else {
    parts.push(`All reporting nodes in ${state.definition.name} are within the configured nominal scenario.`);
  }
  if (obstruction) parts.push("A simulated obstruction has removed one graph edge from route calculation.");
  if (offline.length) parts.push(`${offline.length} node${offline.length === 1 ? " is" : "s are"} offline; remaining mesh links continue operating.`);
  if (route) {
    const exit = state.definition.exits.find((item) => item.id === route.exitId);
    parts.push(`The currently simulated decision-support route leads to ${exit?.name ?? "an available exit"} and avoids known constraints.`);
  } else {
    parts.push("No available route. Await local emergency guidance; this prototype does not certify evacuation safety.");
  }
  return parts.join(" ");
}
