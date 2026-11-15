/**
 * The motorway fixture answers only what it was asked with a corridor (2.5.4 cut): the streets read (#1099) bounds its
 * statement with `set_config('statement_timeout', $1, true)`, a STRING `$1`, and the fixture used to read it as a
 * corridor and throw — every e2e map was then drawn without streets and logged `map_streets_failed`.
 */
import { describe, expect, it } from "vitest";
import { corridor, motorwayLayerRows } from "./real-motorway.js";
import { NOW } from "./real-digest.js";

describe("the motorway fixture's corridor", () => {
  it("is empty for a statement asked with no corridor, and the layer rows do not throw on it", () => {
    expect(corridor(["1500"])).toEqual([]);
    expect(corridor(undefined)).toEqual([]);
    expect(() => motorwayLayerRows(NOW, "select set_config('statement_timeout', $1, true)", ["1500"])).not.toThrow();
  });
  it("is the points of a real corridor", () => {
    expect(corridor([[9.1, 9.2], [50.1, 50.2]])).toEqual([{ lon: 9.1, lat: 50.1 }, { lon: 9.2, lat: 50.2 }]);
  });
});
