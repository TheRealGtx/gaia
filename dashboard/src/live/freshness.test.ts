import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getFreshness } from "./freshness.ts";

describe("telemetry freshness", () => {
  it("marks a node offline exactly four seconds after its last receipt", () => {
    assert.equal(getFreshness(
      "2026-11-14T10:00:00.000Z",
      new Date("2026-11-14T10:00:04.000Z"),
      { staleAfterMs: 4_000, offlineAfterMs: 4_000 },
    ), "offline");
  });
  it("marks old readings stale rather than safe", () => {
    const result = getFreshness(
      "2026-11-14T00:00:00.000Z",
      new Date("2026-11-14T00:01:00.000Z"),
      { staleAfterMs: 15_000, offlineAfterMs: 45_000 },
    );
    assert.equal(result, "offline");
  });

  it("keeps recent readings fresh", () => {
    const result = getFreshness(
      "2026-11-14T00:00:00.000Z",
      new Date("2026-11-14T00:00:05.000Z"),
      { staleAfterMs: 15_000, offlineAfterMs: 45_000 },
    );
    assert.equal(result, "fresh");
  });
});
