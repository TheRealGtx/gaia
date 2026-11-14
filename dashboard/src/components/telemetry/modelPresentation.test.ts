import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatModelPresentation } from "./modelPresentation.ts";
import * as presentationModule from "./modelPresentation.ts";

describe("model parameter presentation", () => {
  const now = new Date("2026-11-14T10:00:12.000Z");

  it("shows learning without a fake zero temperature before parameters arrive", () => {
    assert.deepEqual(formatModelPresentation(null, null, null, null, now, false), {
      value: "learning",
      age: "parameters not received",
    });
  });

  it("shows warmup progress and the age of the last parameter update", () => {
    assert.deepEqual(formatModelPresentation(0, 1, 7, "2026-11-14T10:00:00.000Z", now, false), {
      value: "learning (7/20)",
      age: "updated 12 s ago",
    });
  });

  it("shows learned values with their age and only labels them stale offline", () => {
    assert.deepEqual(formatModelPresentation(20, 1, 24, "2026-11-14T10:00:00.000Z", now, true), {
      value: "μ 20.0°C · σ 1.0",
      age: "stale · updated 12 s ago",
    });
  });

  it("keeps advancing the visible age when no new readings arrive", () => {
    const startModelAgeTicker = (presentationModule as unknown as {
      startModelAgeTicker?: (
        onTick: (now: Date) => void,
        scheduler: { now(): Date; setInterval(callback: () => void, delay: number): unknown; clearInterval(id: unknown): void },
      ) => () => void;
    }).startModelAgeTicker;
    assert.equal(typeof startModelAgeTicker, "function");
    if (!startModelAgeTicker) return;

    let current = new Date("2026-11-14T10:00:12.000Z");
    let scheduled: () => void = () => assert.fail("ticker callback was not scheduled");
    let cleared = false;
    const ages: string[] = [];
    const stop = startModelAgeTicker(
      (tick) => ages.push(formatModelPresentation(20, 1, 24, "2026-11-14T10:00:00.000Z", tick, true).age),
      {
        now: () => current,
        setInterval(callback, delay) {
          assert.equal(delay, 1_000);
          scheduled = callback;
          return 7;
        },
        clearInterval(id) {
          assert.equal(id, 7);
          cleared = true;
        },
      },
    );
    current = new Date("2026-11-14T10:01:12.000Z");
    scheduled();
    stop();

    assert.deepEqual(ages, ["stale · updated 12 s ago", "stale · updated 72 s ago"]);
    assert.equal(cleared, true);
  });

  it("formats a simulated temperature with an adjacent disclosure chip", () => {
    const formatTemperaturePresentation = (presentationModule as unknown as {
      formatTemperaturePresentation?: (temperature: number | null, simulated: boolean | null | undefined) => {
        value: string;
        simulatedLabel: string | null;
      };
    }).formatTemperaturePresentation;
    assert.equal(typeof formatTemperaturePresentation, "function");
    if (!formatTemperaturePresentation) return;

    assert.deepEqual(formatTemperaturePresentation(47, true), {
      value: "47°C",
      simulatedLabel: "Simulated",
    });
    assert.deepEqual(formatTemperaturePresentation(null, false), {
      value: "—",
      simulatedLabel: null,
    });
  });

  it("describes distance 99 as no hazard only for a nominal node", () => {
    const formatGradientDistancePresentation = (presentationModule as unknown as {
      formatGradientDistancePresentation?: (distance: number | null, status: string) => string;
    }).formatGradientDistancePresentation;
    assert.equal(typeof formatGradientDistancePresentation, "function");
    if (!formatGradientDistancePresentation) return;

    assert.equal(formatGradientDistancePresentation(99, "normal"), "no hazard");
    assert.equal(formatGradientDistancePresentation(99, "unknown"), "unknown");
    assert.equal(formatGradientDistancePresentation(2, "normal"), "2");
  });
});
