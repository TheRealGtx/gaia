"use client";

import dynamic from "next/dynamic";
import { ChevronDown, Network } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useGaiaState } from "../../state/hooks";
import { MapToolbar } from "../operations/MapToolbar";
import { OperationalCards } from "../operations/OperationalCards";
import { MobilePanelTabs } from "../shell/MobilePanelTabs";
import { TelemetryPanel } from "../telemetry/TelemetryPanel";
import { HazardGradientPanel } from "../telemetry/HazardGradientPanel";
import { createCameraSyncChannel } from "../scene/cameraSync";
import { FullScreenLoader } from "../shell/FullScreenLoader";

const DigitalTwin = dynamic(() => import("../scene/DigitalTwin").then((module) => module.DigitalTwin), {
  ssr: false,
  loading: () => null,
});

export function OverviewDashboard() {
  const state = useGaiaState();
  const [gradientOpen, setGradientOpen] = useState(false);
  const [readyScene, setReadyScene] = useState<string | null>(null);
  const sceneKey = `${state.activeEnvironmentId}-${state.cameraResetToken}`;
  const loading = readyScene !== sceneKey;
  const handleSceneReady = useCallback(() => setReadyScene(sceneKey), [sceneKey]);
  const cameraSync = useMemo(() => createCameraSyncChannel(), []);
  return (
    <>
      {loading ? <FullScreenLoader label="Loading environment…" /> : null}
      <main className="dashboard" aria-busy={loading} data-telemetry-open={state.telemetryPanelOpen} data-mobile-panel={state.mobilePanel}>
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
          <DigitalTwin cameraSync={cameraSync} onReady={handleSceneReady} />
          <div className="bottom-overlay-stack">
            <OperationalCards />
          </div>
        </section>
      </main>
    </>
  );
}
