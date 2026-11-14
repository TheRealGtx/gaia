"use client";

import { Monitor, Moon, Settings, Sun, X } from "lucide-react";
import { useEffect } from "react";
import type { ThemePreference } from "../../state/theme";
import { useGaiaActions, useGaiaState } from "../../state/hooks";
import { Button, SegmentedControl } from "../ui";

export function SettingsModal({ open, onClose }: { open: boolean; onClose(): void }) {
  const state = useGaiaState();
  const { dispatch } = useGaiaActions();

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!open) return null;
  const setTheme = (preference: ThemePreference) => dispatch({
    type: "set-theme-preference",
    preference,
    systemTheme: window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  });

  return (
    <div className="settings-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="settings-modal card" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header><span className="operation-icon"><Settings size={16} /></span><div><h2 id="settings-title">Settings</h2><p>Customize this dashboard.</p></div><Button icon={X} iconOnly variant="ghost" aria-label="Close settings" onClick={onClose} /></header>
        <div className="settings-section">
          <div><strong>Appearance</strong><small>System follows your device automatically.</small></div>
          <SegmentedControl<ThemePreference>
            label="Color theme"
            value={state.themePreference}
            options={[{ value: "system", label: "System", icon: Monitor }, { value: "light", label: "Light", icon: Sun }, { value: "dark", label: "Dark", icon: Moon }]}
            onChange={setTheme}
          />
        </div>
        <div className="settings-section">
          <div><strong>Data connection</strong><small>{state.mode === "simulation" ? "Simulation · Local mesh model" : `Live gateway · ${state.globalConnection}`}</small><small>Dashboard is read-only: the network works without it.</small></div>
        </div>
      </section>
    </div>
  );
}
