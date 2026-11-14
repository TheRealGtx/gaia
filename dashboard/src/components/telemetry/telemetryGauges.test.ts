import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("telemetry gauge geometry", () => {
  it("maps values onto a bounded semicircle percentage", async () => {
    const module = await import("./telemetryGauges.ts").catch(() => null);
    assert.equal(typeof module?.gaugePercent, "function");

    assert.equal(module!.gaugePercent(17.5, -5, 40), 50);
    assert.equal(module!.gaugePercent(-20, -5, 40), 0);
    assert.equal(module!.gaugePercent(50, -5, 40), 100);
    assert.equal(module!.gaugePercent(null, -5, 40), null);
    assert.equal(module!.gaugePercent(10, 10, 10), null);
  });

  it("places the beginning, midpoint and end across a 225-degree gauge arc", async () => {
    const module = await import("./telemetryGauges.ts").catch(() => null);
    assert.equal(typeof module?.gaugeArcPoint, "function");

    assert.deepEqual(module!.gaugeArcPoint(0), { x: 7.502, y: 67.603 });
    assert.deepEqual(module!.gaugeArcPoint(50), { x: 50, y: 4 });
    assert.deepEqual(module!.gaugeArcPoint(100), { x: 92.498, y: 67.603 });
  });
});
