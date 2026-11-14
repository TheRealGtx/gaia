"use client";

import { Network, RotateCcw, Route } from "lucide-react";
import { useGaiaActions, useGaiaState } from "../../state/hooks";
import { selectActiveEnvironment } from "../../state/selectors";
import { Button, SegmentedControl, StatusDot } from "../ui";
import { getFloorOptions } from "./mapToolbarModel";

export function MapToolbar() {
  const state = useGaiaState();
  const { dispatch } = useGaiaActions();
  const environment = selectActiveEnvironment(state);
  const floorOptions = getFloorOptions(environment.definition);
  return (
    <div className="map-toolbar" data-mobile-visible={state.mobilePanel === "map"}>
      <div className="map-toolbar__actions">{floorOptions.length ? <SegmentedControl label="Visible floor" value={state.selectedFloorId} options={floorOptions} onChange={(floorId) => dispatch({ type: "select-floor", floorId })} /> : null}<Button icon={Route} variant={state.showRoutes ? "active" : "outline"} aria-pressed={state.showRoutes} onClick={() => dispatch({ type: "toggle-routes" })}>Evacuation paths</Button><Button icon={Network} variant={state.showNetwork ? "active" : "outline"} aria-pressed={state.showNetwork} onClick={() => dispatch({ type: "toggle-network" })}>Mesh links</Button><Button icon={RotateCcw} onClick={() => dispatch({ type: "reset-camera" })}>Reset view</Button></div>
      <ul className="map-legend" aria-label="Sensor status legend">{(["normal", "warning", "critical", "offline"] as const).map((status) => <li key={status}><StatusDot status={status} />{status}</li>)}</ul>
    </div>
  );
}
