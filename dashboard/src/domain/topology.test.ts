import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENVIRONMENT_BY_ID } from "../config/environments.ts";
import { applySimulationAction, createInitialEnvironmentState } from "../simulation/engine.ts";
import { deriveConsensus, deriveTopology } from "./topology.ts";

describe("mesh topology", () => {
  it("removes links for an offline node and keeps unaffected nodes operational", () => {
    const initial = createInitialEnvironmentState(ENVIRONMENT_BY_ID["building-a"]);
    const changed = applySimulationAction(initial, { type: "disable-node", sensorId: "A-03" });
    const topology = deriveTopology(changed.definition, changed.sensors);

    assert.equal(topology.connections.some((link) => link.active && [link.sourceId, link.targetId].includes("A-03")), false);
    assert.equal(topology.connections.some((link) => link.active && link.sourceId === "A-01"), true);
  });

  it("never creates a fallback link beyond both nodes communication range", () => {
    const definition = ENVIRONMENT_BY_ID["forest-north"];
    const initial = createInitialEnvironmentState(definition);
    const topology = deriveTopology(definition, initial.sensors);

    for (const link of topology.connections.filter((item) => item.active)) {
      const source = initial.sensors.find((sensor) => sensor.id === link.sourceId)!;
      const target = initial.sensors.find((sensor) => sensor.id === link.targetId)!;
      const distance = Math.hypot(
        source.position[0] - target.position[0],
        source.position[1] - target.position[1],
        source.position[2] - target.position[2],
      );
      assert.ok(distance <= Math.min(source.communicationRange, target.communicationRange));
    }
  });

  it("labels frontend-derived consensus as simulated", () => {
    const initial = createInitialEnvironmentState(ENVIRONMENT_BY_ID["building-a"]);
    const fire = applySimulationAction(initial, { type: "confirm-fire", sensorId: "A-04" });
    const consensus = deriveConsensus(fire.sensors, "A-04", true);

    assert.equal(consensus.simulated, true);
    assert.equal(consensus.reached, true);
    assert.ok(consensus.agreeing >= 2);
  });
});
