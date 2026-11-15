/**
 * #1186 AC 3: a recent place stored before the types (a `pt:` key, no `k`) is upgraded ONCE on render — to the
 * station its label names when that station lies in its cell, else marked a point and left as it was. The shipped
 * (minified) text runs here against a fake page; the digest's own suggestion markup is what it reads.
 */
import { runInNewContext } from "node:vm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { renderSuggestions } from "../../digest/src/presentation/place-suggest-html.js";
import { resetStationSlugs, setStationSlugs } from "../../digest/src/analysis/station-slugs.js";
import { cellKey } from "../src/location/ladder.js";
import { INLINE_SCRIPTS } from "../src/lib/inline-scripts.js";
import { RECENT_KINDS_JS, RECENT_STATION_M, recentKindsScript } from "../src/lib/recent-kinds.js";

const KEY = "viafrei.place.recent";
const HBF = { slug: "eschweiler-hbf", ifopt: "de:05334:1186", name: "Eschweiler Hbf", lat: 50.8168, lon: 6.2466 };
const FAR = { slug: "eschweiler-west", ifopt: "de:05334:1187", name: "Eschweiler West", lat: 50.8168 + 1500 / 111_320, lon: 6.2466 };
/** The cell a located visitor at the station was kept under (#1170). */
const AT = cellKey(HBF.lat, HBF.lon);
const TOWN_AT = cellKey(50.82, 6.26);

type Fake = { store: Map<string, string>; posts: { url: string; body: string }[]; writes: number; events: string[] };

/** The digest's answer for a query: the stations it is asked about, as the position bar's list renders them. */
const answer = (q: string, rows: readonly (typeof HBF)[]): string =>
  renderSuggestions("de", q, rows.map((r) => ({ kind: "station" as const, name: r.name, town: "Eschweiler", lat: r.lat, lon: r.lon })));

async function run(recent: unknown, reply: (q: string, store: Map<string, string>) => { status: number; html: string } = (q) => ({ status: 200, html: answer(q, [HBF, FAR]) })): Promise<Fake> {
  const f: Fake = { store: new Map(recent === undefined ? [] : [[KEY, JSON.stringify(recent)]]), posts: [], writes: 0, events: [] };
  const ctx = {
    document: { documentElement: { lang: "de" }, dispatchEvent: (e: { type: string }) => f.events.push(e.type) },
    CustomEvent: class {
      constructor(readonly type: string) {}
    },
    localStorage: {
      getItem: (k: string) => f.store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        f.writes++;
        f.store.set(k, v);
      },
    },
    fetch: (url: string, init: { body: string }) => {
      f.posts.push({ url, body: init.body });
      const r = reply((JSON.parse(init.body) as { q: string }).q, f.store);
      return Promise.resolve({ status: r.status, text: () => Promise.resolve(r.html) });
    },
  };
  // the text the page carries, run as it is: it must call itself (it once shipped as a function nobody called)
  runInNewContext(recentKindsScript(), ctx);
  for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
  return f;
}
const kept = (f: Fake): unknown => JSON.parse(f.store.get(KEY) ?? "null");

beforeAll(() => setStationSlugs([HBF, FAR]));
afterAll(() => resetStationSlugs());

describe("#1186 an entry stored before the types is upgraded once, on render", () => {
  it("ships minified from its source, as one function", () => {
    expect(INLINE_SCRIPTS.recent.length).toBeLessThan(RECENT_KINDS_JS.length);
    expect(RECENT_STATION_M).toBeLessThanOrEqual(600);
    // the page carries a CALL, not a function expression nobody invokes
    expect(recentKindsScript()).toBe(`(${INLINE_SCRIPTS.recent})();`);
  });

  it("a point whose label is a station in its cell becomes that station, in place: its key and month kept, one write, the island told", async () => {
    const town = { at: "ags:05334012", label: "Eschweiler", m: "2026-10" };
    const f = await run([town, { at: AT, label: "Eschweiler Hbf", m: "2026-11" }]);
    expect(f.posts).toEqual([{ url: "/fragment/suggest", body: JSON.stringify({ q: "Eschweiler Hbf", lang: "de" }) }]);
    expect(kept(f)).toEqual([town, { at: AT, label: "Eschweiler Hbf", m: "2026-11", k: "station", p: "eschweiler-hbf" }]);
    expect(f.writes).toBe(1);
    expect(f.events).toEqual(["vf:recent"]);
  });

  it("the label's spellings the device kept: 'Eschweiler, Hbf', the line with its town, and a cell named 'nahe' the station", async () => {
    for (const label of ["Eschweiler, Hbf", "Eschweiler Hbf, Eschweiler", "nahe Eschweiler Hbf, Eschweiler", "near Eschweiler Hbf"]) {
      const f = await run([{ at: AT, label }]);
      expect(kept(f), label).toEqual([{ at: AT, label: "Eschweiler Hbf", k: "station", p: "eschweiler-hbf" }]);
    }
  });

  it("a point with a town label is not upgraded — marked a point, its key and label as they were, so it is never asked again", async () => {
    // in the station's own cell, the station on the answer's list: the label names the town, so it is no station
    const f = await run([{ at: AT, label: "Eschweiler", m: "2026-10" }]);
    expect(kept(f)).toEqual([{ at: AT, label: "Eschweiler", m: "2026-10", k: "point" }]);
    const again = await run(kept(f));
    expect(again.posts).toEqual([]);
    expect(again.writes).toBe(0);
  });

  it("a station of that name OUTSIDE the entry's cell is not it", async () => {
    const f = await run([{ at: AT, label: "Eschweiler West" }]);
    expect(kept(f)).toEqual([{ at: AT, label: "Eschweiler West", k: "point" }]);
  });

  it("at most once: an upgraded entry, a typed one and a key that is no position are never asked", async () => {
    const typed = [
      { at: AT, label: "Eschweiler Hbf", k: "station", p: "eschweiler-hbf" },
      { at: TOWN_AT, label: "nahe Dachsweg, Eschweiler", k: "point" },
      { at: "ags:05334012", label: "Eschweiler" },
    ];
    const f = await run(typed);
    expect(f.posts).toEqual([]);
    expect(f.writes).toBe(0);
    expect(f.events).toEqual([]);
    expect((await run(undefined)).posts).toEqual([]);
  });

  it("a failed read changes nothing (asked again next time); an answer that is not the list neither", async () => {
    for (const r of [{ status: 503, html: "" }, { status: 200, html: "<p>oops</p>" }]) {
      const f = await run([{ at: AT, label: "Eschweiler Hbf" }], () => r);
      expect(f.writes).toBe(0);
      expect(kept(f)).toEqual([{ at: AT, label: "Eschweiler Hbf" }]);
    }
  });

  it("the entry is replaced only if it is still there as it was read: one the island changed meanwhile is left alone", async () => {
    const f = await run([{ at: AT, label: "Eschweiler Hbf" }], (q, store) => {
      store.set(KEY, JSON.stringify([{ at: AT, label: "Eschweiler Hbf", k: "point" }]));
      return { status: 200, html: answer(q, [HBF]) };
    });
    expect(f.writes).toBe(0);
  });

  it("sends the label alone — never a position, a type or a key", async () => {
    const f = await run([{ at: AT, label: "Eschweiler Hbf" }]);
    expect(Object.keys(JSON.parse(f.posts[0]?.body ?? "{}") as object).sort()).toEqual(["lang", "q"]);
    expect(f.posts[0]?.body).not.toMatch(/pt:|station|50\.8|6\.2/);
  });
});
