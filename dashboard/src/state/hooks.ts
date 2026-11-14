"use client";

import { useContext } from "react";
import { GaiaActionsContext, GaiaStateContext } from "./AppProvider";

export function useGaiaState() {
  const state = useContext(GaiaStateContext);
  if (!state) throw new Error("useGaiaState must be used inside AppProvider");
  return state;
}

export function useGaiaActions() {
  const actions = useContext(GaiaActionsContext);
  if (!actions) throw new Error("useGaiaActions must be used inside AppProvider");
  return actions;
}
