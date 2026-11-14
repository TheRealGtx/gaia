"use client";

import dynamic from "next/dynamic";
import { PanelLeftOpen } from "lucide-react";
import { useGaiaActions, useGaiaState } from "../../state/hooks";
import { MapToolbar } from "../operations/MapToolbar";
import { OperationalCards } from "../operations/OperationalCards";
import { SimulationBar } from "../operations/SimulationBar";
import { MobilePanelTabs } from "../shell/MobilePanelTabs";
import { TelemetryPanel } from "../telemetry/TelemetryPanel";
import { HazardGradientPanel } from "../telemetry/HazardGradientPanel";
import { Button } from "../ui";
import { selectActiveEnvironment } from "../../state/selectors";
import { AlertBanner } from "../operations/AlertBanner";

const DigitalTwin = dynamic(() => import("../scene/DigitalTwin").then((module) => module.DigitalTwin), {
  ssr: false,
  loading: () => <div className="digital-twin scene-loading">Loading digital twin…</div>,
});

export function OverviewDashboard() {
  const state = useGaiaState();
  const { dispatch } = useGaiaActions();
  const environment = selectActiveEnvironment(state);
  return (
    <main className="dashboard" data-telemetry-open={state.telemetryPanelOpen}>
      <h1 className="sr-only">Gaia environmental intelligence dashboard</h1>
      <MobilePanelTabs />
      <div className="left-overlay-stack" data-mobile-visible={state.mobilePanel === "sensors"} aria-hidden={!state.telemetryPanelOpen && state.mobilePanel !== "sensors"}>
        <TelemetryPanel />
        <HazardGradientPanel />
      </div>
      <Button
        className="telemetry-open-button"
        icon={PanelLeftOpen}
        onClick={() => dispatch({ type: "toggle-telemetry-panel" })}
        aria-label="Open sensor telemetry panel"
        aria-expanded={state.telemetryPanelOpen}
      >
        Sensor panel
      </Button>
      <section className="workspace">
        <MapToolbar />
        <AlertBanner environment={environment} />
        <DigitalTwin />
        <div className="bottom-overlay-stack">
          <SimulationBar />
          <OperationalCards />
        </div>
      </section>
    </main>
  );
}
