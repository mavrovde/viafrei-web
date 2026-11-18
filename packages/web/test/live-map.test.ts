/**
 * #1183: the live map's shell half (`src/lib/live-map.ts`) — no browser (the browser half is `e2e/live-map-1183.e2e.ts`).
 *
 *  - the overlay route passes the digest's answer on only in its shape, with its ETag; a 304, a frame still being read
 *    (503 + Retry-After) and a refusal are passed on as such; a position or any other parameter is refused (LM23);
 *  - the script's drawing rule is the digest's (`drawnAs`, the same table as `live-map-1183.test.ts` there);
 *  - a toggle is stored only inside its click handler (the click-only rule, AC 8);
 *  - AC 6: the script, minified, is under 40 KB gzip (it is about 3 KB).
 */
import { gzipSync } from "node:zlib";
import { foldWhole } from "@viafrei/design";
import { describe, expect, it } from "vitest";
import { INLINE_SCRIPTS } from "../src/lib/inline-scripts.js";
import { HOME_LIVE_MAP_FOLD, HOME_LIVE_MAP_SLOT, LAYER_KEYS, LIVE_MAP_FIGURE_ROUTE, LIVE_MAP_JS, LIVE_MAP_LOADER_JS, LIVE_MAP_SCRIPT_ROUTE, hasLiveMap, isGeoLayer, isHomeFigure, isOverlay, isSaLayer, liveMapFigureRoute, liveMapLoaderScript, liveMapScript, liveMapScriptFile, liveMapScriptVersion, homeMapFold, homeMapFoldTag, mapLayerRoute, motorwayOverlayRoute } from "../src/lib/live-map.js";
import type { FetchLike } from "../src/lib/tiles.js";

const CREDITS: Record<string, string> = Object.fromEntries(LAYER_KEYS.map((k) => [k, `<p class="credit">BKG ${k}</p>`]));
const PAYLOAD = JSON.stringify({ at: null, roads: [["A1", "closure", 1, "A1 · 1 Sperrung"], ["A7", "", 0, "A7"]], kreise: [["05315", 2, "Köln · Markante Wetterwarnung"]], credits: CREDITS, hours: [[0, "00:00"]] });

const answer =
  (status: number, body: string, headers: Record<string, string> = {}): FetchLike & { asked: string[]; sent: Record<string, string>[] } => {
    const asked: string[] = [];
    const sent: Record<string, string>[] = [];
    const fn: FetchLike = (url, init) => {
      asked.push(url);
      sent.push(init.headers);
      return Promise.resolve({ status, headers: { get: (n: string) => headers[n.toLowerCase()] ?? null }, text: () => Promise.resolve(body) });
    };
    return Object.assign(fn, { asked, sent });
  };
const route = (path: string, f: FetchLike, headers: Record<string, string> = {}): Promise<Response> =>
  motorwayOverlayRoute(new Request(`http://shell${path}`, { headers }), { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: f });

describe("isOverlay (#1183)", () => {
  it("accepts the digest's shape and nothing else", () => {
    expect(isOverlay(PAYLOAD)).toBe(true);
    expect(isOverlay("<p>x</p>")).toBe(false);
    expect(isOverlay(JSON.stringify({ roads: [], hours: [], at: null }))).toBe(false);
    expect(isOverlay(JSON.stringify({ roads: [["A1", "burning", 0, "x"]], credits: CREDITS, hours: [], at: null }))).toBe(false);
    expect(isOverlay(JSON.stringify({ roads: [], credits: { ...CREDITS, "1100": "<script>x</script>" }, hours: [], at: null }))).toBe(false);
    expect(isOverlay(JSON.stringify({ roads: [], credits: { ...CREDITS, "0000": '<a onclick="x">' }, hours: [], at: null }))).toBe(false);
    // the sixteen combinations, each present; a past frame's kreise is null; a Kreis key is an AGS and a level 1–4
    const fifteen = Object.fromEntries(Object.entries(CREDITS).filter(([k]) => k !== "0101"));
    expect(isOverlay(JSON.stringify({ roads: [], credits: fifteen, hours: [], at: null, kreise: [] }))).toBe(false);
    expect(isOverlay(JSON.stringify({ roads: [], credits: CREDITS, hours: [], at: "08:00", kreise: null }))).toBe(true);
    // #1313: a stale copy's read time is Berlin HH:MM, or null; anything else (markup included) refuses the payload
    expect(isOverlay(JSON.stringify({ roads: [], credits: CREDITS, hours: [], at: null, kreise: [], warnAt: "11:47" }))).toBe(true);
    expect(isOverlay(JSON.stringify({ roads: [], credits: CREDITS, hours: [], at: null, kreise: [], warnAt: null }))).toBe(true);
    expect(isOverlay(JSON.stringify({ roads: [], credits: CREDITS, hours: [], at: null, kreise: [], warnAt: "<b>x</b>" }))).toBe(false);
    expect(isOverlay(JSON.stringify({ roads: [], credits: CREDITS, hours: [], at: null, kreise: [], warnAt: 1147 }))).toBe(false);
    expect(isOverlay(JSON.stringify({ roads: [], credits: CREDITS, hours: [], at: null, kreise: [["Köln", 2, "x"]] }))).toBe(false);
    expect(isOverlay(JSON.stringify({ roads: [], credits: CREDITS, hours: [], at: null, kreise: [["05315", 0, "x"]] }))).toBe(false);
  });
});

describe("GET /fragment/motorway-overlay (#1183)", () => {
  it("now: the payload with the digest's ETag, revalidated on every ask, noindex", async () => {
    const f = answer(200, PAYLOAD, { etag: '"mw-abc-0123456789abcdef"' });
    const r = await route("/fragment/motorway-overlay?lang=de", f);
    expect(r.status).toBe(200);
    expect(await r.text()).toBe(PAYLOAD);
    expect(r.headers.get("etag")).toBe('"mw-abc-0123456789abcdef"');
    expect(r.headers.get("cache-control")).toBe("no-cache");
    expect(r.headers.get("x-robots-tag")).toBe("noindex");
    expect(f.asked).toEqual(["http://digest/internal/motorway/overlay?lang=de"]);
  });
  it("a past hour: kept ten minutes; a 304 passed on with the validator asked", async () => {
    const ok = await route("/fragment/motorway-overlay?lang=en&h=8", answer(200, PAYLOAD));
    expect(ok.headers.get("cache-control")).toBe("private, max-age=600");
    const f = answer(304, "", { etag: '"mw-abc-0123456789abcdef"' });
    const r = await route("/fragment/motorway-overlay?lang=de", f, { "if-none-match": '"mw-abc-0123456789abcdef"' });
    expect(r.status).toBe(304);
    expect(f.sent[0]!["if-none-match"]).toBe('"mw-abc-0123456789abcdef"');
  });
  it("a frame still being read: 503 with Retry-After; a body out of shape: 502; a digest that throws: 504", async () => {
    const r = await route("/fragment/motorway-overlay?lang=de&h=3", answer(503, "{}", { "retry-after": "1" }));
    expect([r.status, r.headers.get("retry-after")]).toEqual([503, "1"]);
    expect((await route("/fragment/motorway-overlay?lang=de", answer(200, "<p>no</p>"))).status).toBe(502);
    const boom = (() => Promise.reject(new Error("down"))) as unknown as FetchLike;
    expect((await route("/fragment/motorway-overlay?lang=de", boom)).status).toBe(504);
  });
  it("refuses another language, an hour that is not one, and any other parameter (no position, LM23)", async () => {
    for (const q of ["lang=xx", "lang=de&h=24", "lang=de&h=-1", "lang=de&at=pt:51.3,9.4", "lang=de&lat=51"]) {
      const f = answer(200, PAYLOAD);
      expect((await route(`/fragment/motorway-overlay?${q}`, f)).status, q).toBe(400);
      expect(f.asked).toEqual([]);
    }
  });
});

/** The digest's table (`packages/digest/src/presentation/live-map-1183.test.ts`, `DRAWN_TABLE`), row for row. */
const DRAWN_TABLE: readonly (readonly [string, boolean, string, string | null])[] = [
  ["closure", true, "11", "closure"],
  ["closure", true, "10", "closure"],
  ["closure", true, "01", "roadworks"],
  ["closure", false, "01", null],
  ["jam", false, "11", "jam"],
  ["roadworks", true, "11", "roadworks"],
  ["roadworks", true, "10", "line"],
  ["roadworks", true, "01", "roadworks"],
  ["free", false, "11", "line"],
  ["free", false, "01", null],
  ["", false, "11", "line"],
  ["", false, "00", null],
  ["closure", true, "00", null],
];

describe("the script's drawing rule is the digest's (#1183)", () => {
  const src = /function drawn\(state, works\) \{[\s\S]*?\n\}/.exec(LIVE_MAP_JS)?.[0];
  it("is found in the script", () => expect(src).toBeDefined());
  it.each(DRAWN_TABLE)("state %s, works %s, layers %s → %s", (state, works, k, want) => {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval -- the script's own text, run as the browser runs it
    const make = new Function("layers", `${src!}; return drawn;`) as (l: { roads: boolean; works: boolean }) => (s: string, w: boolean) => string | null;
    const drawn = make({ roads: k[0] === "1", works: k[1] === "1" });
    expect(drawn(state, works)).toBe(want);
  });
});

describe("the click-only rule (AC 8) and the script's size (AC 6)", () => {
  it("stores a toggle only inside its click listener, and reads no position", () => {
    const sets = [...LIVE_MAP_JS.matchAll(/localStorage\.setItem/g)];
    expect(sets).toHaveLength(1);
    const click = LIVE_MAP_JS.indexOf('addEventListener("click", function (ev)');
    expect(click).toBeGreaterThan(0);
    const at = sets[0]!.index;
    expect(at).toBeGreaterThan(click);
    expect(at - click).toBeLessThan(300);
    expect(LIVE_MAP_JS).not.toMatch(/geolocation|viafrei\.place/);
  });
  it("the minified script is under 40 KB gzip", () => {
    const text = liveMapScript("de");
    expect(text).toContain(INLINE_SCRIPTS.lmap);
    expect(gzipSync(text).length).toBeLessThan(40 * 1024);
  });
});

const RAIL = '<g class="lmap__rail"><path class="lmap__rail-line" d="M1 2l3 4"/><g class="lmap__stations"><a href="/de/bahnhof/koeln-hbf" aria-label="Köln Hbf"><circle id="lms-koeln-hbf" cx="1" cy="2" r="2.2"/></a></g></g>';
const SA = JSON.stringify({ license: "CC BY-SA 4.0", stations: [["koeln-hbf", "bad", "Köln Hbf"]], credits: '<p class="lmap__sa-licence">x</p>' });
const layer = (path: string, f: FetchLike, headers: Record<string, string> = {}): Promise<Response> =>
  mapLayerRoute(new Request(`http://shell${path}`, { headers }), { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: f });

describe("GET /fragment/map-layer (#1183): the rail and weather geometry and the CC BY-SA layer", () => {
  it("a geometry layer: one <g> of its class, paths, circles and same-site links only", () => {
    expect(isGeoLayer("rail", RAIL)).toBe(true);
    expect(isGeoLayer("kreise", '<g class="lmap__kreise" aria-hidden="true"><path id="lmk-05315" d="M0 0z"/></g>')).toBe(true);
    expect(isGeoLayer("kreise", RAIL)).toBe(false);
    expect(isGeoLayer("rail", RAIL.replace("</g></g>", "<script>x</script></g></g>"))).toBe(false);
    expect(isGeoLayer("rail", RAIL.replace('href="/de', 'href="https://evil.example/de'))).toBe(false);
    expect(isGeoLayer("rail", RAIL.replace("<circle", '<circle onclick="x"'))).toBe(false);
    expect(isGeoLayer("rail", RAIL.replace("</g></g>", "<image/></g></g>"))).toBe(false);
  });
  it("the CC BY-SA layer: its licence and [slug, state, label] rows, nothing else", () => {
    expect(isSaLayer(SA)).toBe(true);
    expect(isSaLayer(SA.replace("CC BY-SA 4.0", "CC BY 4.0"))).toBe(false);
    expect(isSaLayer(SA.replace('"bad"', '"green"'))).toBe(false);
    expect(isSaLayer(SA.replace("koeln-hbf", "Köln Hbf"))).toBe(false);
  });
  it("asks the digest's route of the layer, keeps the geometry a day and revalidates the CC BY-SA layer", async () => {
    const f = answer(200, RAIL, { etag: '"mw-rail-0123456789abcdef"' });
    const r = await layer("/fragment/map-layer?l=rail&lang=de", f);
    expect([r.status, r.headers.get("cache-control"), r.headers.get("etag"), r.headers.get("x-robots-tag")]).toEqual([200, "public, max-age=86400", '"mw-rail-0123456789abcdef"', "noindex"]);
    expect(f.asked).toEqual(["http://digest/internal/map/rail?lang=de"]);
    const s = answer(200, SA);
    const rs = await layer("/fragment/map-layer?l=sa&lang=en", s);
    expect([rs.status, rs.headers.get("cache-control")]).toEqual([200, "no-cache"]);
    expect(s.asked).toEqual(["http://digest/internal/map/rail-sa?lang=en"]);
    const p = await layer("/fragment/map-layer?l=sa&lang=de", answer(503, "{}", { "retry-after": "1" }));
    expect([p.status, p.headers.get("retry-after")]).toEqual([503, "1"]);
    expect((await layer("/fragment/map-layer?l=rail&lang=de", answer(200, "<svg/>"))).status).toBe(502);
  });
  it("refuses another layer, language or parameter (no position, LM23)", async () => {
    for (const q of ["l=osm&lang=de", "l=rail&lang=xx", "l=rail&lang=de&at=pt:51,9", "lang=de"]) {
      const f = answer(200, RAIL);
      expect((await layer(`/fragment/map-layer?${q}`, f)).status, q).toBe(400);
      expect(f.asked).toEqual([]);
    }
  });
});

describe("LM12: the script writes nothing of the CC BY-SA layer into the base svg", () => {
  const sa = /function paintSa\(\) \{[\s\S]*?\n\}/.exec(LIVE_MAP_JS)?.[0] ?? "";
  it("its own <svg>, its own credit block; the base svg is never its parent", () => {
    expect(sa).toContain('createElementNS(NS, "svg")');
    expect(sa).toContain("saSvg.appendChild(u)");
    expect(sa).not.toMatch(/\bsvg\.(appendChild|insertBefore|setAttribute)|roadsG|geo\.(rail|dots|kreise)\.(appendChild|setAttribute)/);
  });
});

describe("#1183 part 5: one script for every live map on a page", () => {
  it("makes each figure live once, each under its own ids (the figure's id the prefix of its paths, dots and Kreise)", () => {
    expect(LIVE_MAP_JS).toContain('document.querySelectorAll("figure.lmap")');
    expect(LIVE_MAP_JS).toMatch(/hasAttribute\("data-live"\)\) \{ figs\[f\]\.setAttribute\("data-live", ""\); init\(figs\[f\]\); \}/);
    expect(LIVE_MAP_JS).not.toContain('getElementById("lmap")');
    expect(LIVE_MAP_JS).toContain('P = fig.id + "-"');
    expect(LIVE_MAP_JS).toContain("return P + road.replace");
    expect(LIVE_MAP_JS).toContain('id = P + "lms-"');
    expect(LIVE_MAP_JS).toContain('warned[P + "lmk-"');
    expect(LIVE_MAP_JS).toContain("ids[i].id = P + ids[i].id");
  });
  it("zooms and pans a cropped frame from its own origin, and scales its lines by the national width", () => {
    expect(LIVE_MAP_JS).toContain("view = { x: X0, y: Y0, w: W, h: H }");
    expect(LIVE_MAP_JS).toContain('GW = Number(fig.getAttribute("data-gw")) || W');
    expect(LIVE_MAP_JS).toContain("Math.sqrt(GW / view.w)");
    expect(LIVE_MAP_JS).toContain("Math.min(X0 + W - view.w / 2, view.x)");
  });
  it("names a page with a live map whatever the figure's id, and nothing else", () => {
    for (const id of ["lmap", "lmap-land", "lmap-road", "lmap-home"]) expect(hasLiveMap(`<figure class="motorway__map motorway-overview lmap" id="${id}">`), id).toBe(true);
    expect(hasLiveMap('<figure class="stmap">')).toBe(false);
    expect(hasLiveMap(`<div class="lmap-slot" id="${HOME_LIVE_MAP_SLOT}" hidden></div>`)).toBe(false);
  });
});

describe("#1183 part 5: the home asks for its map, then adds the same script as a file", () => {
  const FIG = '<figure class="motorway__map motorway-overview lmap" id="lmap-home" aria-labelledby="lmap-home-t"><svg><path id="lmap-home-A1" d="M0 0"/></svg></figure>';
  const fig = (path: string, f: FetchLike, headers: Record<string, string> = {}): Promise<Response> =>
    liveMapFigureRoute(new Request(`http://shell${path}`, { headers }), { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: f });
  it("the loader: the slot, the figure route, the script route with its version; small", () => {
    expect(LIVE_MAP_LOADER_JS).toContain(`getElementById("${HOME_LIVE_MAP_SLOT}")`);
    expect(LIVE_MAP_LOADER_JS).toContain(`fetch("${LIVE_MAP_FIGURE_ROUTE}?lang=" + C.lang`);
    expect(LIVE_MAP_LOADER_JS).toContain(`s.src = "${LIVE_MAP_SCRIPT_ROUTE}?lang=" + C.lang + "&v=" + C.v`);
    expect(INLINE_SCRIPTS.lmapload.length).toBeLessThan(600);
    expect(liveMapLoaderScript("de")).toContain(`{"lang":"de","v":"${liveMapScriptVersion()}"}`);
  });
  it("the script file is the inline script's exact text, kept a day under its version; another version is refused", async () => {
    const v = liveMapScriptVersion();
    const r = liveMapScriptFile(new Request(`http://shell${LIVE_MAP_SCRIPT_ROUTE}?lang=de&v=${v}`));
    expect([r.status, r.headers.get("content-type"), r.headers.get("cache-control")]).toEqual([200, "text/javascript; charset=utf-8", "public, max-age=86400"]);
    expect(await r.text()).toBe(liveMapScript("de"));
    for (const q of ["lang=de&v=old", `lang=xx&v=${v}`, "lang=de", `lang=de&v=${v}&x=1`]) expect(liveMapScriptFile(new Request(`http://shell${LIVE_MAP_SCRIPT_ROUTE}?${q}`)).status, q).toBe(400);
  });
  it("the figure route's tag names its wrapper: a current tag revalidates, an older wrapper's is answered whole (#1223 review N1)", async () => {
    const tag = '"mw-index-0123456789abcdef"';
    const own = `"mw-index-0123456789abcdef-f${homeMapFoldTag("de")}"`;
    const hit = answer(304, "", { etag: tag });
    const r = await fig(`${LIVE_MAP_FIGURE_ROUTE}?lang=de`, hit, { "if-none-match": own });
    expect([r.status, r.headers.get("etag")]).toEqual([304, own]);
    expect(hit.sent[0]!["if-none-match"]).toBe(tag);
    for (const stale of [tag, '"mw-index-0123456789abcdef-f0000000000"']) {
      const f = answer(200, FIG, { etag: tag });
      const s = await fig(`${LIVE_MAP_FIGURE_ROUTE}?lang=de`, f, { "if-none-match": stale });
      expect([s.status, f.sent[0]!["if-none-match"]], stale).toEqual([200, undefined]);
    }
  });
  it("the figure route passes the digest's home figure on in its shape, revalidated; anything else is refused", async () => {
    const f = answer(200, FIG, { etag: '"mw-index-0123456789abcdef"' });
    const r = await fig(`${LIVE_MAP_FIGURE_ROUTE}?lang=de`, f);
    expect([r.status, r.headers.get("cache-control"), r.headers.get("etag")]).toEqual([200, "no-cache", `"mw-index-0123456789abcdef-f${homeMapFoldTag("de")}"`]);
    expect(f.asked).toEqual(["http://digest/internal/map/live?lang=de"]);
    // review S2 of aa0dd63ee: the figure whole in its own fold, behind "Karte anzeigen" (open everywhere but the desktop home)
    expect(await r.text()).toBe(homeMapFold("de", FIG));
    const folded = homeMapFold("de", FIG);
    // the design system's own fold (#922 B2: structure, not a literal pin), under its class, labelled per language
    expect(folded).toBe(foldWhole("de", FIG, "Karte anzeigen", HOME_LIVE_MAP_FOLD));
    expect(homeMapFold("en", FIG)).toBe(foldWhole("en", FIG, "show Map", HOME_LIVE_MAP_FOLD));
    expect(folded.endsWith(`${FIG}</details>`)).toBe(true);
    expect(homeMapFoldTag("de")).toMatch(/^[0-9a-f]{10}$/);
    expect(homeMapFoldTag("en")).not.toBe(homeMapFoldTag("de"));
    expect(isHomeFigure(FIG)).toBe(true);
    expect(isHomeFigure(FIG.replace("</svg>", "<script>x</script></svg>"))).toBe(false);
    expect(isHomeFigure(FIG.replace('id="lmap-home"', 'id="lmap"'))).toBe(false);
    expect((await fig(`${LIVE_MAP_FIGURE_ROUTE}?lang=de`, answer(200, "<p>x</p>"))).status).toBe(502);
    expect((await fig(`${LIVE_MAP_FIGURE_ROUTE}?lang=xx`, answer(200, FIG))).status).toBe(400);
    expect((await fig(`${LIVE_MAP_FIGURE_ROUTE}?lang=de&at=1`, answer(200, FIG))).status).toBe(400);
  });
});
