"use client";

import { BrainCircuit, Leaf, Network, Route } from "lucide-react";
import { calculateCommunicationSavings } from "../../domain/communicationSavings";
import { buildSituationReport } from "../../domain/situationReport";
import { useGaiaState } from "../../state/hooks";
import { selectDashboard } from "../../state/selectors";
import { Card, StatusBadge } from "../ui";
import { generateIntelligenceSummary } from "./intelligence";

export function OperationalCards() {
  const state = useGaiaState();
  const { environment, bestRoute, routes, selectedSensor } = selectDashboard(state);
  const exit = environment.definition.exits.find((item) => item.id === bestRoute?.exitId);
  const report = buildSituationReport(environment);
  const savings = calculateCommunicationSavings(environment.sensors);
  const liveEscapeTo = selectedSensor?.live?.escapeTo ?? report.escapeToSensorId;
  const routeAvailable = state.mode === "live" ? Boolean(liveEscapeTo) : Boolean(bestRoute);
  return (
    <div className="operational-cards" data-mobile-visible={state.mobilePanel === "analysis"}>
      <Card className="operation-card route-card">
        <header><span className="operation-icon operation-icon--route"><Route size={15} /></span><h3>{state.mode === "live" ? "Node escape guidance" : "Evacuation route"}</h3><StatusBadge status={routeAvailable ? "normal" : "critical"} dot={false}>{routeAvailable ? "Active path" : "Unavailable"}</StatusBadge></header>
        <div className="operation-card__body"><span>{state.mode === "live" ? "Network escape_to" : "Primary egress"}</span><strong>{state.mode === "live" ? (liveEscapeTo ? `${selectedSensor?.id ?? "Hazard source"} → ${liveEscapeTo}` : "No neighbour guidance") : bestRoute ? `${state.selectedRoomId ? environment.definition.rooms.find((room) => room.id === state.selectedRoomId)?.name : "Selected area"} → ${exit?.name}` : "No available route"}</strong></div>
        <dl><div><dt>{state.mode === "live" ? "Safest reporting" : "Distance"}</dt><dd>{state.mode === "live" ? report.safestSensorId ?? "—" : bestRoute ? `${bestRoute.distance.toFixed(1)} m` : "—"}</dd></div><div><dt>{state.mode === "live" ? "Source" : "Alternatives"}</dt><dd>{state.mode === "live" ? report.sourceSensorIds.join(", ") || "none" : Math.max(0, routes.length - 1)}</dd></div><div><dt>Status</dt><dd>{state.mode === "live" ? selectedSensor?.status ?? "unknown" : bestRoute?.status ?? "unreachable"}</dd></div></dl>
        <footer>{state.mode === "live" ? "Node-computed direction · Dashboard is observer only" : "Simulated decision support · Not certified evacuation guidance"}</footer>
      </Card>
      <Card className="operation-card intelligence-card">
        <header><span className="operation-icon"><BrainCircuit size={15} /></span><h3>Situation report</h3><span className="ai-source">Deterministic</span></header>
        <p>{state.mode === "live" ? report.summary : generateIntelligenceSummary(environment, bestRoute)}</p>
        {state.mode === "live" && environment.aiSummary ? <p className="gateway-supplement"><strong>Gateway supplement:</strong> {environment.aiSummary}</p> : null}
        <footer><span><Network size={13} /> {environment.consensus ? `${environment.consensus.agreeing}/${environment.consensus.eligible} neighbours agree` : "No active consensus"}</span><span>{state.mode}</span></footer>
      </Card>
      <Card className="operation-card communication-card">
        <header><span className="operation-icon operation-icon--green"><Leaf size={15} /></span><h3>Green AI</h3><span className="ai-source">Cumulative</span></header>
        {savings ? <><div className="communication-saving"><strong>{savings.reductionPercent}%</strong><span>less learning traffic than central training</span></div><dl><div><dt>Shared model</dt><dd>{savings.bytesSent} B</dd></div><div><dt>Raw training data</dt><dd>{savings.bytesIfRawData} B</dd></div><div><dt>Avoided</dt><dd>{savings.bytesAvoided} B</dd></div></dl><footer>{savings.reportingNodes}/{savings.totalNodes} nodes · model sharing vs raw readings</footer></> : <><div className="communication-saving communication-saving--empty"><strong>Awaiting counters</strong><span>Absent values are not treated as zero</span></div><footer>Live model counters only</footer></>}
      </Card>
    </div>
  );
}
