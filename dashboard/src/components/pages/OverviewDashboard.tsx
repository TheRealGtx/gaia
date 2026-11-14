"use client";

import dynamic from "next/dynamic";
import { ChevronDown, Network } from "lucide-react";
import { useMemo, useState } from "react";
import { useGaiaState } from "../../state/hooks";
import { MapToolbar } from "../operations/MapToolbar";
import { OperationalCards } from "../operations/OperationalCards";
import { MobilePanelTabs } from "../shell/MobilePanelTabs";
import { TelemetryPanel } from "../telemetry/TelemetryPanel";
import { HazardGradientPanel } from "../telemetry/HazardGradientPanel";
import { createCameraSyncChannel } from "../scene/cameraSync";

const DigitalTwin = dynamic(() => import("../scene/DigitalTwin").then((module) => module.DigitalTwin), {
  ssr: false,
  loading: () => <div className="digital-twin scene-loading">Loading digital twin…</div>,
});

export function OverviewDashboard() {
  const state = useGaiaState();
  const [gradientOpen, setGradientOpen] = useState(false);
  const cameraSync = useMemo(() => createCameraSyncChannel(), []);
  return (
    <main className="dashboard" data-telemetry-open={state.telemetryPanelOpen} data-mobile-panel={state.mobilePanel}>
      <h1 className="sr-only">Gaia environmental intelligence dashboard</h1>
      <MobilePanelTabs />
      <div className="left-overlay-stack" id="sensor-details">
        <TelemetryPanel />
        <details className="gradient-disclosure disclosure" onToggle={(event) => setGradientOpen(event.currentTarget.open)}>
          <summary><Network size={16} aria-hidden="true" /><span>Hazard gradient</span><ChevronDown className="disclosure__chevron" size={16} aria-hidden="true" /></summary>
          {gradientOpen ? <HazardGradientPanel cameraSync={cameraSync} /> : null}
        </details>
      </div>
      <section className="workspace">
        <MapToolbar />
        <DigitalTwin cameraSync={cameraSync} />
        <div className="bottom-overlay-stack">
          <OperationalCards />
        </div>
      </section>
    </main>
  );
}
