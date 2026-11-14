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

  it("places the beginning, midpoint and end across a 252-degree gauge arc", async () => {
    const module = await import("./telemetryGauges.ts").catch(() => null);
    assert.equal(typeof module?.gaugeArcPoint, "function");

    assert.deepEqual(module!.gaugeArcPoint(0), { x: 12.785, y: 77.038 });
    assert.deepEqual(module!.gaugeArcPoint(50), { x: 50, y: 4 });
    assert.deepEqual(module!.gaugeArcPoint(100), { x: 87.215, y: 77.038 });
  });
});


describe("temperature gauge scale", () => {
  it("spreads close readings across the arc without clipping cold or hot readings", async () => {
    const { temperatureGaugeBounds, gaugePercent } = await import("./telemetryGauges.ts");
    for (const [minimum, maximum] of [[18, 22], [-18, -14], [78, 82]]) {
      const bounds = temperatureGaugeBounds(minimum, maximum);
      assert.ok(bounds.minimum < minimum);
      assert.ok(bounds.maximum > maximum);
      const span = gaugePercent(maximum, bounds.minimum, bounds.maximum)! - gaugePercent(minimum, bounds.minimum, bounds.maximum)!;
      assert.ok(span >= 50, `Range should occupy at least half the arc: ${span}`);
    }
  });

  it("keeps a usable scale for equal, missing and invalid readings", async () => {
    const { temperatureGaugeBounds } = await import("./telemetryGauges.ts");
    assert.deepEqual(temperatureGaugeBounds(20, 20), { minimum: 19, maximum: 21 });
    for (const values of [[null, null], [null, 20], [NaN, 20], [30, 20], [20, Infinity]] as const) {
      const bounds = temperatureGaugeBounds(values[0], values[1]);
      assert.ok(Number.isFinite(bounds.minimum));
      assert.ok(Number.isFinite(bounds.maximum));
      assert.ok(bounds.maximum > bounds.minimum);
    }
  });
});
