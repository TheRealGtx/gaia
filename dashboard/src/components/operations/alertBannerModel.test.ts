import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENVIRONMENT_BY_ID } from "../../config/environments.ts";
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
});
