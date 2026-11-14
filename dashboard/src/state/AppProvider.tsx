"use client";

import { createContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { ENVIRONMENTS } from "../config/environments";
import type { DataAdapter } from "../domain/adapter";
import type { EnvironmentId } from "../domain/types";
import { LiveNetworkAdapter } from "../live/LiveNetworkAdapter";
import { SimulationAdapter } from "../simulation/SimulationAdapter";
import type { SimulationAction } from "../simulation/scenarios";
import { appReducer, createInitialAppState, type AppAction, type AppState } from "./appReducer";
import { resolveTheme, resolveThemePreference } from "./theme";

export interface GaiaActions {
  dispatch: React.Dispatch<AppAction>;
  runSimulation(action: SimulationAction): void;
}

export const GaiaStateContext = createContext<AppState | null>(null);
export const GaiaActionsContext = createContext<GaiaActions | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, undefined, createInitialAppState);
  const adapterRef = useRef<DataAdapter | null>(null);
  const [themeInitialized, setThemeInitialized] = useState(false);

  useEffect(() => {
    const preference = resolveThemePreference(window.localStorage.getItem("gaia-theme"));
    const initialTheme = resolveTheme(preference, window.matchMedia("(prefers-color-scheme: dark)").matches);
    dispatch({ type: "set-theme-preference", preference, systemTheme: initialTheme });
    setThemeInitialized(true);
  }, []);

  useEffect(() => {
    // Keep the pre-hydration theme until the saved preference has reached React state.
    if (!themeInitialized) return;
    document.documentElement.dataset.theme = state.theme;
    document.documentElement.style.colorScheme = state.theme;
    window.localStorage.setItem("gaia-theme", state.themePreference);
  }, [themeInitialized, state.theme, state.themePreference]);

  useEffect(() => {
    if (state.themePreference !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const synchronize = (event: MediaQueryListEvent) => dispatch({ type: "set-theme", theme: event.matches ? "dark" : "light" });
    query.addEventListener("change", synchronize);
    return () => query.removeEventListener("change", synchronize);
  }, [state.themePreference]);

  useEffect(() => {
    const adapter: DataAdapter = state.mode === "simulation"
      ? new SimulationAdapter()
      : new LiveNetworkAdapter(process.env.NEXT_PUBLIC_GAIA_GATEWAY_URL ?? "ws://localhost:8000/ws");
    adapterRef.current = adapter;
    const unsubscribe = adapter.subscribe((event) => dispatch({ type: "environment-event", event }));

    if (state.mode === "live") {
      for (const environmentId of ENVIRONMENTS.map((environment) => environment.id) as EnvironmentId[]) {
        const snapshot = adapter.getSnapshot(environmentId);
        if (snapshot) dispatch({ type: "environment-event", event: { type: "snapshot", environment: snapshot } });
      }
    }
    void adapter.connect();
    return () => {
      unsubscribe();
      adapter.disconnect();
      if (adapterRef.current === adapter) adapterRef.current = null;
    };
  }, [state.mode]);

  const actions = useMemo<GaiaActions>(() => ({
    dispatch,
    runSimulation(action) {
      if (state.mode !== "simulation") return;
      const adapter = adapterRef.current;
      if (adapter instanceof SimulationAdapter) {
        if (action.type === "reset") dispatch({ type: "clear-environment-logs", environmentId: state.activeEnvironmentId });
        adapter.dispatch(state.activeEnvironmentId, action);
        const labels: Record<SimulationAction["type"], string> = {
          "increase-temperature": "Temperature increased on selected node",
          "simulate-anomaly": "Local anomaly injected",
          "confirm-fire": "Simulated fire confirmed by neighbour consensus",
          "block-edge": "Route segment obstruction toggled",
          "disable-node": "Sensor node disabled",
          "network-failure": "Mesh network fault injected",
          reset: "Simulation reset",
        };
        dispatch({
          type: "add-log",
          entry: {
            id: `${state.activeEnvironmentId}-${Date.now()}-${action.type}`,
            environmentId: state.activeEnvironmentId,
            type: "simulation",
            message: labels[action.type],
            timestamp: new Date().toISOString(),
            source: "simulation",
          },
        });
      }
    },
  }), [state.activeEnvironmentId, state.mode]);

  return (
    <GaiaStateContext.Provider value={state}>
      <GaiaActionsContext.Provider value={actions}>{children}</GaiaActionsContext.Provider>
    </GaiaStateContext.Provider>
  );
}
