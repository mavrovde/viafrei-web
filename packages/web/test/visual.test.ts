import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { BOARD_SHOTS, BOARD_SHOT_COUNT, CHARGING_FILTER_SHOT, chargingFilterShotName, MAX_DIFF_RATIO, MENUS, MENU_WIDTHS, QUIET_ROAD, QUIET_WIDTHS, RELATED_ROAD, RELATED_SHOTS, RELATED_WIDTHS, boardShotName, compare, menuShotName, quietShotName, relatedShotName, shotName } from "../scripts/visual.js";

/** A w×h PNG filled with one colour, with `dots` single pixels flipped to black. */
function png(w: number, h: number, dots = 0): Buffer {
  const p = new PNG({ width: w, height: h });
  for (let i = 0; i < w * h; i++) p.data.set([240, 240, 240, 255], i * 4);
  for (let d = 0; d < dots; d++) p.data.set([0, 0, 0, 255], d * 4);
  return PNG.sync.write(p);
}

describe("the visual gate's comparison (#381 item 6) — planted differences", () => {
  it("identical images differ by 0", () => {
    expect(compare(png(100, 100), png(100, 100))).toEqual({ ratio: 0 });
  });
  it("a difference above 0.2 % is above the bound", () => {
    const c = compare(png(100, 100, 50), png(100, 100));
    expect("ratio" in c && c.ratio > MAX_DIFF_RATIO).toBe(true);
  });
  it("a difference below it is below", () => {
    const c = compare(png(100, 100, 10), png(100, 100));
    expect("ratio" in c && c.ratio <= MAX_DIFF_RATIO).toBe(true);
  });
  it("a size change is not a ratio but a reason (an element wider than the viewport shows up here)", () => {
    expect(compare(png(100, 120), png(100, 100))).toEqual({ why: "size 100×120 vs baseline 100×100" });
  });
  it("names a shot by path, width and scheme", () => {
    expect(shotName("/de/connect", 375, "dark")).toBe("de-connect-375-dark.png");
    expect(shotName("/impressum", 1280, "light")).toBe("impressum-1280-light.png");
  });
  it("names the open language menus apart from every page (#989): header and footer, phone and desktop", () => {
    expect(MENUS).toEqual([".site-head", ".site-foot"]);
    expect(MENU_WIDTHS).toEqual([390, 1280]);
    expect(menuShotName(".site-head", "de", 390, "light")).toBe("menu-head-de-390-light.png");
    expect(menuShotName(".site-foot", "en", 1280, "dark")).toBe("menu-foot-en-1280-dark.png");
  });
  it("names the motorway page's quiet line apart (#1051): the A61, phone and desktop", () => {
    expect([QUIET_ROAD, ...QUIET_WIDTHS]).toEqual(["A61", 390, 1120]);
    expect(quietShotName(390, "light")).toBe("quiet-a61-de-390-light.png");
    expect(quietShotName(1120, "dark")).toBe("quiet-a61-de-1120-dark.png");
  });
  it("names the #1032 shots apart: the A7's crossings card and its linked map, phone and desktop", () => {
    expect([RELATED_ROAD, ...RELATED_SHOTS, ...RELATED_WIDTHS]).toEqual(["A7", "crossings", "map", 390, 1120]);
    expect(relatedShotName("crossings", 390, "light")).toBe("related-crossings-a7-de-390-light.png");
    expect(relatedShotName("map", 1120, "dark")).toBe("related-map-a7-de-1120-dark.png");
  });
  it("names the departure boards' shots apart (#1083, #1115): the station page's board at 320, 360, 390 and 1280, the place card at 360", () => {
    expect(BOARD_SHOTS.map((b) => [b.what, b.path, b.card, [...b.widths]])).toEqual([
      ["station-board", "/de/station/koeln-hbf", "#pcard-station-board", [320, 360, 390, 1280]],
      ["place-stations", "/de/place/koeln", "#pcard-stations", [360]],
    ]);
    expect(BOARD_SHOT_COUNT).toBe(5);
    expect(boardShotName("station-board", 320, "dark")).toBe("board-station-board-de-320-dark.png");
    expect(boardShotName("place-stations", 360, "light")).toBe("board-place-stations-de-360-light.png");
  });
  it("names the #1081 D7 shot apart: the place page's filtered charging card at 375 px", () => {
    expect(CHARGING_FILTER_SHOT).toEqual({ path: "/de/place/koeln?ev_kw=fast", card: "#pcard-charging", width: 375 });
    expect(chargingFilterShotName("light")).toBe("charging-filter-place-de-375-light.png");
    expect(chargingFilterShotName("dark")).toBe("charging-filter-place-de-375-dark.png");
  });
});
