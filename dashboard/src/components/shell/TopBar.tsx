"use client";

import { Building2, ChevronDown, Settings, Trees } from "lucide-react";
import { useState } from "react";
import { ENVIRONMENTS } from "../../config/environments";
import type { EnvironmentId } from "../../domain/types";
import { useGaiaActions, useGaiaState } from "../../state/hooks";
import { overallStatus } from "../../state/selectors";
import { Button, SegmentedControl, StatusBadge } from "../ui";
import { SettingsModal } from "./SettingsModal";

export function TopBar() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const state = useGaiaState();
  const { dispatch } = useGaiaActions();
  const environment = state.environments[state.activeEnvironmentId];
  const status = overallStatus(environment);
  const statusText = status === "normal" ? "System nominal" : status === "critical" ? "Critical alert" : status === "offline" ? "Network offline" : "Attention needed";

  return (
    <header className="topbar">
      <button className="brand" aria-label="Gaia overview" onClick={() => dispatch({ type: "set-page", page: "Overview" })}>
        <img src="/logo.svg" alt="" /><span>gaia</span>
      </button>
      <div className="topbar__context">
        <span className="environment-select__icon" aria-hidden="true">{environment.definition.kind === "building" ? <Building2 size={15} /> : <Trees size={15} />}</span>
        <select className="environment-select" value={state.activeEnvironmentId} onChange={(event) => dispatch({ type: "select-environment", environmentId: event.target.value as EnvironmentId })} aria-label="Active environment">
          {ENVIRONMENTS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <ChevronDown className="environment-select__chevron" size={14} aria-hidden="true" />
      </div>
      <nav className="topbar__nav" aria-label="Main navigation">
        {(["Overview", "Live field", "Environments", "Sensor Logs"] as const).map((page) => (
          <Button key={page} variant="ghost" aria-current={state.page === page ? "page" : undefined} onClick={() => dispatch({ type: "set-page", page })}>{page}</Button>
        ))}
      </nav>
      <span className="topbar__status" role="status"><StatusBadge status={status}>{statusText}</StatusBadge></span>
      <div className="topbar__utilities">
        <SegmentedControl label="Data source" value={state.mode} options={[{ value: "simulation", label: "Simulation" }, { value: "live", label: "Live" }]} onChange={(mode) => dispatch({ type: "set-mode", mode })} />
      </div>
      <Button
        className="settings-toggle"
        variant="ghost"
        icon={Settings}
        iconOnly
        aria-label="Open settings"
        aria-expanded={settingsOpen}
        onClick={() => setSettingsOpen(true)}
      />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </header>
  );
}
