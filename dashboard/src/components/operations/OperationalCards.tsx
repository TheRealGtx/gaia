"use client";

import { BrainCircuit, FlaskConical, Network, Route, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { buildSituationReport } from "../../domain/situationReport";
import { useGaiaState } from "../../state/hooks";
import { selectDashboard } from "../../state/selectors";
import { Button, Card, StatusBadge } from "../ui";
import { generateIntelligenceSummary } from "./intelligence";
import { SimulationBar } from "./SimulationBar";

const sections = [
  { id: "simulation", label: "Simulation", icon: FlaskConical },
  { id: "route", label: "Route", icon: Route },
  { id: "situation", label: "Situation", icon: BrainCircuit },
] as const;
type OperationSection = typeof sections[number]["id"];

export function OperationalCards() {
  const state = useGaiaState();
  const [activePanel, setActivePanel] = useState<OperationSection | null>(null);
  const availableSections = sections.filter(({ id }) => id !== "simulation" || state.mode === "simulation");
  useEffect(() => {
    if (state.mode !== "simulation") setActivePanel((current) => current === "simulation" ? null : current);
  }, [state.mode]);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (activePanel) panelRef.current?.focus({ preventScroll: true });
  }, [activePanel]);
  const closePanel = () => {
    setActivePanel(null);
    triggerRef.current?.focus({ preventScroll: true });
  };
  const { environment, bestRoute, routes, selectedSensor } = selectDashboard(state);
  const exit = environment.definition.exits.find((item) => item.id === bestRoute?.exitId);
  const report = buildSituationReport(environment);
  const liveEscapeTo = selectedSensor?.live?.escapeTo ?? report.escapeToSensorId;
  const routeAvailable = state.mode === "live" ? Boolean(liveEscapeTo) : Boolean(bestRoute);
  const routeOrigin = environment.definition.kind === "forest"
    ? selectedSensor ? `${selectedSensor.id} · ${selectedSensor.name}` : undefined
    : environment.definition.rooms.find((room) => room.id === state.selectedRoomId)?.name;
  return (
    <section className="operation-dock" aria-label="Operational sections" onKeyDown={(event) => {
      if (event.key === "Escape" && activePanel) { event.stopPropagation(); closePanel(); }
    }}>
      <div id="operation-panel" ref={panelRef} className="operation-popover" hidden={!activePanel} role="region" aria-label={`${sections.find((section) => section.id === activePanel)?.label ?? "Operational"} details`} tabIndex={-1}>
        {activePanel ? <Button className="operation-popover__close" icon={X} iconOnly variant="ghost" aria-label="Close section" onClick={closePanel} /> : null}
        {activePanel === "simulation" ? <SimulationBar /> : null}
        {activePanel === "route" ? (
          <Card className="operation-card">
            <header><span className="operation-icon operation-icon--route"><Route size={15} /></span><h2>{state.mode === "live" ? "Node escape guidance" : "Evacuation route"}</h2><StatusBadge status={!routeAvailable ? "critical" : state.mode === "simulation" && bestRoute?.status === "affected" ? "warning" : "normal"} dot={false}>{!routeAvailable ? "Unavailable" : state.mode === "simulation" && bestRoute?.status === "affected" ? "Origin affected" : "Active path"}</StatusBadge></header>
            <div className="operation-card__body"><span>{state.mode === "live" ? "Network escape_to" : "Primary egress"}</span><strong>{state.mode === "live" ? (liveEscapeTo ? `${selectedSensor?.id ?? "Hazard source"} → ${liveEscapeTo}` : "No neighbour guidance") : bestRoute ? `${routeOrigin ?? "Selected area"} → ${exit?.name}` : "No available route"}</strong></div>
            <dl><div><dt>{state.mode === "live" ? "Safest reporting" : "Distance"}</dt><dd>{state.mode === "live" ? report.safestSensorId ?? "—" : bestRoute ? `${bestRoute.distance.toFixed(1)} m` : "—"}</dd></div><div><dt>{state.mode === "live" ? "Source" : "Alternatives"}</dt><dd>{state.mode === "live" ? report.sourceSensorIds.join(", ") || "none" : Math.max(0, routes.length - 1)}</dd></div><div><dt>Status</dt><dd>{state.mode === "live" ? selectedSensor?.status ?? "unknown" : bestRoute?.status ?? "unreachable"}</dd></div></dl>
            <footer>{state.mode === "live" ? "Node-computed direction · Dashboard is observer only" : "Simulated decision support · Not certified evacuation guidance"}</footer>
          </Card>
        ) : null}
        {activePanel === "situation" ? (
          <Card className="operation-card intelligence-card">
            <header><span className="operation-icon"><BrainCircuit size={15} /></span><h2>Situation report</h2><span className="ai-source">Deterministic</span></header>
            <p>{state.mode === "live" ? report.summary : generateIntelligenceSummary(environment, bestRoute)}</p>
            {state.mode === "live" && environment.aiSummary ? <p className="gateway-supplement"><strong>Gateway supplement:</strong> {environment.aiSummary}</p> : null}
            <footer><span><Network size={13} /> {environment.consensus ? `${environment.consensus.agreeing}/${environment.consensus.eligible} neighbours agree` : "No active consensus"}</span><span>{state.mode}</span></footer>
          </Card>
        ) : null}
      </div>
      <div className="operation-bubbles" role="group" aria-label="Choose a section">
        {availableSections.map(({ id, label, icon }) => (
          <Button key={id} className="operation-bubble" icon={icon} variant={activePanel === id ? "active" : "outline"} aria-expanded={activePanel === id} aria-controls="operation-panel" onClick={(event) => {
            triggerRef.current = event.currentTarget;
            if (activePanel === id) closePanel();
            else setActivePanel(id);
          }}>{label}</Button>
        ))}
      </div>
    </section>
  );
}
