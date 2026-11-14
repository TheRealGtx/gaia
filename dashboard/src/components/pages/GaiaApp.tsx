"use client";

import { useGaiaState } from "../../state/hooks";
import { TopBar } from "../shell/TopBar";
import { EnvironmentsOverview } from "./EnvironmentsOverview";
import { OverviewDashboard } from "./OverviewDashboard";
import { SensorLogs } from "./SensorLogs";

export function GaiaApp() {
  const state = useGaiaState();
  return <div className="app-shell"><TopBar />{state.page === "Overview" ? <OverviewDashboard /> : state.page === "Environments" ? <EnvironmentsOverview /> : <SensorLogs />}</div>;
}
