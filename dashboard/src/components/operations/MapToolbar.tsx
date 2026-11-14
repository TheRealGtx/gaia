"use client";

import { Layers3, Network, PanelLeftOpen, RotateCcw, Route, X } from "lucide-react";
import { useRef } from "react";
import { useGaiaActions, useGaiaState } from "../../state/hooks";
import { Button, StatusDot } from "../ui";

export function MapToolbar() {
  const optionsDialog = useRef<HTMLDialogElement>(null);
  const state = useGaiaState();
  const { dispatch } = useGaiaActions();
  return (
    <div className="map-toolbar">
      <div className="map-toolbar__actions">
        <Button id="sensor-panel-toggle" className="sensor-panel-toggle" icon={PanelLeftOpen} variant={state.telemetryPanelOpen ? "active" : "ghost"} aria-controls="sensor-details" aria-expanded={state.telemetryPanelOpen} onClick={() => dispatch({ type: "toggle-telemetry-panel" })}>Sensors</Button>
        <Button className="map-options-toggle" icon={Layers3} aria-haspopup="dialog" aria-controls="map-options-dialog" onClick={() => optionsDialog.current?.showModal()}>Map options</Button>
        <dialog
          ref={optionsDialog}
          id="map-options-dialog"
          className="map-options-dialog"
          aria-labelledby="map-options-title"
          onClick={(event) => {
            if (event.target !== event.currentTarget) return;
            const bounds = event.currentTarget.getBoundingClientRect();
            if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) event.currentTarget.close();
          }}
        >
          <header><div><h2 id="map-options-title">Map options</h2><p>Choose what appears on the map.</p></div><Button icon={X} iconOnly variant="ghost" aria-label="Close map options" onClick={() => optionsDialog.current?.close()} /></header>
          <div className="map-options-dialog__body">
            <div className="map-options__toggles">
              <Button icon={Route} variant={state.showRoutes ? "active" : "outline"} aria-pressed={state.showRoutes} onClick={() => dispatch({ type: "toggle-routes" })}>Evacuation paths</Button>
              <Button icon={Network} variant={state.showNetwork ? "active" : "outline"} aria-pressed={state.showNetwork} onClick={() => dispatch({ type: "toggle-network" })}>Mesh links</Button>
              <Button icon={RotateCcw} onClick={() => dispatch({ type: "reset-camera" })}>Reset view</Button>
            </div>
            <ul className="map-legend" aria-label="Sensor status legend">{(["normal", "warning", "critical", "offline"] as const).map((status) => <li key={status}><StatusDot status={status} />{status}</li>)}</ul>
          </div>
        </dialog>
      </div>
    </div>
  );
}
