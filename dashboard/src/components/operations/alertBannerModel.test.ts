import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENVIRONMENT_BY_ID } from "../../config/environments.ts";
import type { NetworkEvent } from "../../domain/types.ts";
import { normalizeGatewayMessages } from "../../live/protocol.ts";
import { createInitialEnvironmentState } from "../../simulation/engine.ts";
import { deriveAlertBanner } from "./alertBannerModel.ts";

const base = () => createInitialEnvironmentState(ENVIRONMENT_BY_ID["building-a"]);

describe("live alert banner", () => {
  it("reports all clear, warning, alert, disconnected and all-offline states", () => {
    assert.equal(deriveAlertBanner(base()).label, "ALL CLEAR");
    assert.equal(deriveAlertBanner({ ...base(), sensors: base().sensors.map((sensor, i) => i ? sensor : { ...sensor, status: "warning" }) }).label, "WARNING");
    assert.equal(deriveAlertBanner({ ...base(), sensors: base().sensors.map((sensor, i) => i ? sensor : { ...sensor, status: "critical" }) }).label, "ALERT");
    assert.equal(deriveAlertBanner({ ...base(), connection: "disconnected" }).label, "GATEWAY DISCONNECTED");
    assert.equal(deriveAlertBanner({ ...base(), sensors: base().sensors.map((sensor) => ({ ...sensor, status: "offline" })) }).label, "NETWORK OFFLINE");
  });

  it("reports all clear for three reporting nodes at distance 99 when no hazard exists", () => {
    const initial = base();
    const rawSensors = Object.fromEntries(initial.sensors.slice(0, 3).map((sensor) => [sensor.id, {
      id: sensor.id,
      environmentId: "building-a",
      name: sensor.name,
      position: sensor.position,
      temperature: 20,
      humidity: 45,
      anomalyScore: 0.05,
      gradientDistance: 99,
      networkAlert: false,
      status: "normal",
      connectivity: "connected",
      neighbourIds: sensor.neighbourIds,
      lastUpdate: "2026-11-14T10:00:00.000Z",
    }]));
    const events = normalizeGatewayMessages({
      type: "snapshot",
      environments: { "building-a": { sensors: rawSensors } },
    });
    const sensors = events
      .filter((event): event is Extract<NetworkEvent, { type: "sensor-reading" }> => event.type === "sensor-reading")
      .map((event) => event.sensor);

    assert.equal(sensors.length, 3);
    assert.equal(deriveAlertBanner({ ...initial, connection: "connected", sensors }).label, "ALL CLEAR");
  });
});
