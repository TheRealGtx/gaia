import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applySimulationAction } from "../simulation/engine.ts";
import { appReducer, createInitialAppState } from "./appReducer.ts";
import { LIVE_SENSOR_IDS } from "../live/liveManifest.ts";

describe("application state", () => {
  it("opens Forest North with its own sensor and route origin selected", () => {
    const initial = createInitialAppState();
    const forest = initial.environments["forest-north"];
    assert.equal(initial.activeEnvironmentId, "forest-north");
    assert.equal(initial.selectedSensorId, "N-20");
    assert.ok(forest.sensors.some((sensor) => sensor.id === initial.selectedSensorId));
    assert.equal(initial.selectedOriginId, initial.selectedSensorId);
    assert.equal(initial.selectedRoomId, null);
    assert.equal(initial.page, "Overview");
    assert.equal(initial.mobilePanel, "map");
  });

  it("switches environments without sharing their scenario state", () => {
    const initial = appReducer(createInitialAppState(), { type: "select-environment", environmentId: "building-a" });
    const building = initial.environments["building-a"];
    const changedBuilding = applySimulationAction(building, { type: "confirm-fire", sensorId: "A-04" });
    const withFire = appReducer(initial, { type: "environment-event", event: { type: "snapshot", environment: changedBuilding } });
    const switched = appReducer(withFire, { type: "select-environment", environmentId: "forest-north" });

    assert.equal(switched.activeEnvironmentId, "forest-north");
    assert.equal(switched.environments["building-a"].hazards.length, 1);
    assert.equal(switched.environments["forest-north"].hazards.length, 0);
  });

  it("keeps room and sensor selection synchronized with the active environment", () => {
    const initial = appReducer(createInitialAppState(), { type: "select-environment", environmentId: "building-a" });
    const selected = appReducer(initial, { type: "select-sensor", sensorId: "A-04" });
    assert.equal(selected.selectedSensorId, "A-04");
    assert.equal(selected.selectedRoomId, "storage-room");

    const changed = appReducer(selected, { type: "select-environment", environmentId: "forest-north" });
    assert.equal(changed.selectedSensorId, "N-20");
    assert.equal(changed.selectedRoomId, null);
  });

  it("marks live mode and preserves a disconnected state as non-nominal", () => {
    const initial = appReducer(createInitialAppState(), { type: "select-environment", environmentId: "building-a" });
    const live = appReducer(initial, { type: "set-mode", mode: "live" });
    const disconnected = appReducer(live, {
      type: "environment-event",
      event: { type: "connection", state: "disconnected", at: "2026-11-14T00:00:00.000Z" },
    });

    assert.equal(disconnected.mode, "live");
    assert.equal(disconnected.globalConnection, "disconnected");
    // exactly the physical boards of the live manifest, however many there are
    assert.deepEqual(disconnected.environments["building-a"].sensors.map((sensor) => sensor.id).sort(), [...LIVE_SENSOR_IDS["building-a"]].sort());
  });

  it("clears simulated evidence when entering live mode and live evidence when returning", () => {
    const initial = appReducer(createInitialAppState(), { type: "select-environment", environmentId: "building-a" });
    const building = applySimulationAction(initial.environments["building-a"], { type: "confirm-fire", sensorId: "A-04" });
    const withFire = appReducer(initial, { type: "environment-event", event: { type: "snapshot", environment: building } });
    const live = appReducer(withFire, { type: "set-mode", mode: "live" });
    assert.equal(live.environments["building-a"].hazards.length, 0);
    assert.equal(live.environments["building-a"].alerts.length, 0);
    assert.equal(live.environments["building-a"].source, "live");

    const simulation = appReducer(live, { type: "set-mode", mode: "simulation" });
    assert.equal(simulation.environments["building-a"].source, "simulation");
    assert.equal(simulation.environments["building-a"].sensors.every((sensor) => sensor.reading.source === "simulation"), true);
  });

  it("shows sensor details initially and lets the user close and reopen them", () => {
    const initial = createInitialAppState();
    assert.equal(initial.telemetryPanelOpen, true);

    const closed = appReducer(initial, { type: "toggle-telemetry-panel" });
    assert.equal(closed.telemetryPanelOpen, false);
    assert.equal(closed.selectedSensorId, initial.selectedSensorId);
    const reopened = appReducer(closed, { type: "toggle-telemetry-panel" });
    assert.equal(reopened.telemetryPanelOpen, true);
  });

  it("keeps routes visible while mesh links can be enabled independently", () => {
    const initial = createInitialAppState();
    assert.equal(initial.showNetwork, false);
    assert.equal(initial.showRoutes, true);
    const withMesh = appReducer(initial, { type: "toggle-network" });
    assert.equal(withMesh.showNetwork, true);
    assert.equal(withMesh.showRoutes, true);
    assert.equal(withMesh.environments, initial.environments);
    assert.equal(appReducer(withMesh, { type: "toggle-network" }).showNetwork, false);
  });

  it("applies explicit and system color-theme preferences", () => {
    const initial = createInitialAppState();
    assert.equal(initial.theme, "light");
    assert.equal(initial.themePreference, "system");

    const dark = appReducer(initial, { type: "set-theme-preference", preference: "dark", systemTheme: "light" });
    assert.equal(dark.theme, "dark");
    assert.equal(dark.themePreference, "dark");

    const system = appReducer(dark, { type: "set-theme-preference", preference: "system", systemTheme: "dark" });
    assert.equal(system.theme, "dark");
    assert.equal(system.themePreference, "system");
  });

  it("switches the telemetry panel between metrics and sensor nodes", () => {
    const initial = createInitialAppState();
    assert.equal(initial.telemetryView, "telemetry");

    const sensors = appReducer(initial, { type: "set-telemetry-view", view: "sensors" });
    assert.equal(sensors.telemetryView, "sensors");
  });
});
