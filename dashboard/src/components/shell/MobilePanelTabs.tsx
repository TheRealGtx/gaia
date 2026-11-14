"use client";

import { BrainCircuit, Map, RadioTower } from "lucide-react";
import { useGaiaActions, useGaiaState } from "../../state/hooks";
import { SegmentedControl } from "../ui";

export function MobilePanelTabs() {
  const state = useGaiaState();
  const { dispatch } = useGaiaActions();
  return <div className="mobile-tabs"><SegmentedControl label="Dashboard panel" value={state.mobilePanel} options={[{ value: "map", label: "Map", icon: Map }, { value: "sensors", label: "Sensors", icon: RadioTower }, { value: "analysis", label: "Analysis", icon: BrainCircuit }]} onChange={(panel) => dispatch({ type: "set-mobile-panel", panel })} /></div>;
}
