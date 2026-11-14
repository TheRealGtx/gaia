import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENVIRONMENT_BY_ID } from "../../config/environments.ts";
import { getFloorOptions } from "./mapToolbarModel.ts";

describe("map toolbar floor selector", () => {
  it("shows floor controls only for environments with multiple floors", () => {
    assert.deepEqual(getFloorOptions(ENVIRONMENT_BY_ID["forest-north"]), []);
    assert.deepEqual(getFloorOptions(ENVIRONMENT_BY_ID["building-a"]), [
      { value: "all", label: "All Floors" },
      { value: "level-1", label: "Level 1" },
      { value: "level-2", label: "Level 2" },
      { value: "level-3", label: "Level 3" },
      { value: "level-4", label: "Level 4" },
    ]);
  });
});
