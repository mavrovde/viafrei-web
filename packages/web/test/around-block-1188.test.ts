/**
 * #1188, the shell's half: every object page — a station's, a fuel station's, a charging site's, a motorway exit's —
 * shows the object,
 * then "In der Nähe", through ONE around block (`components/AroundBlock.astro`, the station page's of #1084) over ONE
 * fetch (`lib/object-area.ts` `fetchArea`, the digest's `/internal/<kind>/<slug>/area`):
 *  - the fuel and charging pages ask their block in parallel with the page, under the same deadline; a slow or busy
 *    block (#1184's refusal) is its loading state, a page with no block is the page alone, and a slug that cannot be a
 *    page asks nothing;
 *  - one shared component: every object layout renders the block through `AroundBlock`, after its object section, and
 *    none writes a topic bar or a cards slot of its own — a planted layout with its own copy is refused by name;
 *  - the fuel card's rows stay person-gated (#1167): the block carries the deferred frame only, and on a fuel page the
 *    script asks the rows with `not=<slug>`, so the page's own station is not in the card under it.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { renderPlace } from "../../digest/src/presentation/place-tiles.js";
import type { PlaceCards } from "../../digest/src/analysis/place-cards.js";
import type { NeighboursCard } from "../../digest/src/cards/neighbours/judge.js";
import { AREA_KINDS, AREA_SHAPE, areaLoading, fetchArea } from "../src/lib/object-area.js";
import { resolveEnergyPage } from "../src/lib/energy-page.js";
import { resolveMotorwayPage } from "../src/lib/motorway-page.js";
import type { StationFetchLike } from "../src/lib/station.js";
import type { FetchLike } from "../src/lib/tiles.js";
import { resetSlugKeys } from "../src/lib/place.js";
import { PLACE_SLOT, topicsScript } from "../src/lib/topic-filter.js";
import { PLACE_FUEL_PATH, placeFuelQuery, placeFuelRoute, placeFuelScript } from "../src/lib/place-fuel.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const NOW = new Date("2026-11-08T08:00:00.000Z");
const SLUG = "aral-kitzingen-autohof";
const EXIT = "exit-8-koeln-loevenich";
const neighbours = { id: "neighbours", verdict: "info", reachM: 30_000, rows: [{ ags: "09675001", name: "Ortx", metres: 1000, lat: 49.7, lon: 10.1, state: null }], stateRead: true, attributions: [] } as unknown as NeighboursCard;
const CARDS: PlaceCards = { place: { at: "pt:49.74,10.145", name: "Kitzingen", ags: "09675139", lat: 49.74, lon: 10.145, point: true }, at: NOW, cards: [neighbours] };
const AREA = renderPlace({ cards: CARDS, report: null, lang: "de", label: { kind: "at", name: "Aral, Autohof 1", town: "Kitzingen", source: null }, here: `/de/fuel/${SLUG}` });
const PAGE = `<section class="energypage energypage--fuel" id="energypage" data-kind="fuel" data-slug="${SLUG}" data-name="Aral"><p>Aral</p></section>`;

type Answer = { status: number; body?: string; delayMs?: number; headers?: Record<string, string> };
function stub(answers: Record<string, Answer>): FetchLike & { calls: string[] } {
  const calls: string[] = [];
  const f = ((url: string, init: { signal: AbortSignal }) => {
    calls.push(url);
    const a = answers[new URL(url).pathname] ?? { status: 404 };
    const res = { status: a.status, headers: { get: (n: string) => (n.toLowerCase() === "content-type" ? "text/html; charset=utf-8" : (a.headers?.[n.toLowerCase()] ?? null)) }, text: () => Promise.resolve(a.body ?? "") };
    if (a.delayMs === undefined) return Promise.resolve(res);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(res), a.delayMs);
      init.signal.addEventListener("abort", () => {
        clearTimeout(timer);
        const e = new Error("aborted");
        e.name = "AbortError";
        reject(e);
      });
    });
  }) as unknown as FetchLike & { calls: string[] };
  f.calls = calls;
  return f;
}
const o = (fetchImpl: FetchLike, timeoutMs = 1_000) => ({ baseUrl: "http://digest:8791", timeoutMs, fetchImpl });

describe("#1188: one fetch for every object's block", () => {
  it("asks /internal/<kind>/<slug>/area with the fuel card as its frame; a station's charging filter only on a station", async () => {
    expect(AREA_KINDS).toEqual(["station", "fuel", "charging", "exit"]);
    for (const kind of ["station", "fuel", "charging"] as const) {
      const f = stub({ [`/internal/${kind}/${SLUG}/area`]: { status: 200, body: AREA } });
      const r = await fetchArea({ kind, slug: SLUG }, "en", o(f), new URLSearchParams("ev_kw=ac"));
      expect(r).toEqual({ kind: "ok", html: AREA });
      expect(AREA_SHAPE.test(AREA)).toBe(true);
      const u = new URL(f.calls[0]!);
      expect(u.pathname).toBe(`/internal/${kind}/${SLUG}/area`);
      expect(u.searchParams.get("lang")).toBe("en");
      expect(u.searchParams.get("fuelRows")).toBe("0");
      expect(u.searchParams.has("ev_kw"), kind).toBe(kind === "station");
    }
    // an exit's block: its motorway and its segment, the same query
    const f = stub({ [`/internal/exit/A4/${EXIT}/area`]: { status: 200, body: AREA } });
    expect(await fetchArea({ kind: "exit", road: "A4", segment: EXIT }, "de", o(f), new URLSearchParams("ev_kw=ac"))).toEqual({ kind: "ok", html: AREA });
    const u = new URL(f.calls[0]!);
    expect([u.pathname, u.searchParams.get("lang"), u.searchParams.get("fuelRows"), u.searchParams.has("ev_kw")]).toEqual([`/internal/exit/A4/${EXIT}/area`, "de", "0", false]);
  });

  it("a busy (#1184) or slow block is its loading state; a page with no cards is no block", async () => {
    const at = `/internal/fuel/${SLUG}/area`;
    expect(await fetchArea({ kind: "fuel", slug: SLUG }, "de", o(stub({ [at]: { status: 503 } })) as never)).toEqual({ kind: "loading", html: areaLoading("de") });
    const t0 = Date.now();
    expect(await fetchArea({ kind: "fuel", slug: SLUG }, "de", o(stub({ [at]: { status: 200, body: AREA, delayMs: 1_500 } }), 200) as never)).toEqual({ kind: "loading", html: areaLoading("de") });
    expect(Date.now() - t0).toBeLessThan(1_000);
    expect(await fetchArea({ kind: "charging", slug: SLUG }, "de", o(stub({})) as never)).toEqual({ kind: "none" });
  });
});

describe("#1188: a fuel and a charging page carry the block, asked beside the page", () => {
  it("the page and its block in parallel: a slow block never holds the page past the deadline", async () => {
    const f = stub({ [`/internal/fuel/${SLUG}`]: { status: 200, body: PAGE }, [`/internal/fuel/${SLUG}/area`]: { status: 200, body: AREA, delayMs: 1_500 } });
    const t0 = Date.now();
    const a = await resolveEnergyPage("fuel", "de", SLUG, o(f, 300));
    expect(Date.now() - t0).toBeLessThan(1_000);
    expect(a.kind).toBe("page");
    expect(a.kind === "page" ? a.area : null).toEqual({ kind: "loading", html: areaLoading("de") });
    expect(f.calls.map((u) => new URL(u).pathname).sort()).toEqual([`/internal/fuel/${SLUG}`, `/internal/fuel/${SLUG}/area`]);
  });

  it("a ready block is the page's; a slug that cannot be a page asks nothing", async () => {
    const f = stub({ [`/internal/charging/${SLUG}`]: { status: 200, body: PAGE.replaceAll("fuel", "charging") }, [`/internal/charging/${SLUG}/area`]: { status: 200, body: AREA } });
    const a = await resolveEnergyPage("charging", "en", SLUG, o(f));
    expect(a.kind === "page" ? a.area : null).toEqual({ kind: "ok", html: AREA });
    const none = stub({});
    expect(await resolveEnergyPage("fuel", "de", "Not_A_Slug", o(none))).toEqual({ kind: "missing" });
    expect(none.calls).toEqual([]);
  });
});

describe("#1188: a motorway exit page carries the junction's block, asked beside the page", () => {
  const MW = `<section class="motorway" id="motorway" data-exit="Köln-Lövenich"><p>A4</p></section>`;
  const world = (lang: "de" | "en", areaDelay?: number) =>
    stub({
      "/internal/motorway/A4": { status: 200, body: MW, headers: { "motorway-path": `/${lang}/autobahn/a4/${EXIT}` } },
      [`/internal/exit/A4/${EXIT}/area`]: { status: 200, body: AREA, ...(areaDelay === undefined ? {} : { delayMs: areaDelay }) },
    });
  const paths = (f: { calls: string[] }): string[] => f.calls.map((u) => new URL(u).pathname).sort();

  it("an exit page (de, en): the page and the junction's cards in parallel; the block is the page's", async () => {
    for (const lang of ["de", "en"] as const) {
      const f = world(lang);
      const a = await resolveMotorwayPage(lang, "a4", EXIT, o(f));
      expect(a.kind).toBe("page");
      expect(a.kind === "page" ? a.area : null).toEqual({ kind: "ok", html: AREA });
      expect(paths(f)).toEqual(["/internal/exit/A4/" + EXIT + "/area", "/internal/motorway/A4"]);
    }
  });

  it("a slow block never holds the exit page past the deadline: it is the loading state", async () => {
    const t0 = Date.now();
    const a = await resolveMotorwayPage("de", "a4", EXIT, o(world("de", 1_500), 300));
    expect(Date.now() - t0).toBeLessThan(1_000);
    expect(a.kind === "page" ? a.area : null).toEqual({ kind: "loading", html: areaLoading("de") });
  });

  it("the block's own topic choice keeps it; the road's page, a stretch and a filter form ask none", async () => {
    const t = world("de");
    const a = await resolveMotorwayPage("de", "a4", EXIT, o(t), new URLSearchParams("topics=roads&f=1"));
    expect(a.kind === "page" ? a.area : null).toEqual({ kind: "ok", html: AREA });
    for (const [rest, q] of [[undefined, ""], ["kerpen-to-frechen", ""], [EXIT, "from=3"]] as const) {
      const f = world("de");
      await resolveMotorwayPage("de", "a4", rest, o(f), new URLSearchParams(q));
      expect(paths(f).filter((x) => x.endsWith("/area")), `${String(rest)} ${q}`).toEqual([]);
    }
  });
});

/** The layouts of the object pages, and the one block they all render. */
const LAYOUTS = join(SRC, "layouts");
const objectLayouts = (): string[] => readdirSync(LAYOUTS).filter((f) => f.endsWith(".astro") && readFileSync(join(LAYOUTS, f), "utf8").includes("lib/object-area.js"));
/**
 * What makes a layout a COPY of the around block rather than a user of it: the block's own pieces written in place —
 * the topic bar, the cards slot, the block's script — or no `<AroundBlock` at all, or the block before the object.
 */
export function aroundCopies(src: string): string[] {
  const why: string[] = [];
  if (!/import AroundBlock from "\.\.\/components\/AroundBlock\.astro";/.test(src)) why.push("does not import the shared AroundBlock");
  if (!/<AroundBlock\s/.test(src)) why.push("does not render <AroundBlock>");
  for (const [piece, re] of [
    ["the topic bar", /topicBarHtml\(/],
    ["the cards slot", /id="place-slot"/],
    ["the topic script", /topicsScript\(/],
    ["the cards' fragment", /applyTopics\(/],
  ] as const)
    if (re.test(src)) why.push(`writes ${piece} itself`);
  // the object first, the block after it (#1188 AC 1)
  const at = src.indexOf("<AroundBlock");
  const object = Math.max(src.indexOf("<PageHead"), src.indexOf("set:html={lifted.html}"));
  if (at >= 0 && object >= 0 && at < object) why.push("renders the block before the object");
  return why;
}

describe("#1188 AC 3: one shared component", () => {
  it("every object layout renders the block through AroundBlock, after its object, with no copy of its own", () => {
    const layouts = objectLayouts();
    expect(layouts.sort()).toEqual(["EnergyPage.astro", "MotorwayPage.astro", "StationPage.astro"]);
    for (const f of layouts) expect(aroundCopies(readFileSync(join(LAYOUTS, f), "utf8")), f).toEqual([]);
    // the block itself is the one place its pieces are written
    const block = readFileSync(join(SRC, "components", "AroundBlock.astro"), "utf8");
    expect(block).toMatch(/topicBarHtml\(/);
    expect(block).toMatch(/id=\{slot\}/);
    expect(block).toMatch(/slot = PLACE_SLOT/);
    expect(block).toMatch(/topicsScript\(lang, slot\)/);
    expect(block).toMatch(/data-vf-around/);
  });

  it("an exit page holds the visitor's block too: the junction's takes its own slot and the page's one SID click", () => {
    const mw = readFileSync(join(LAYOUTS, "MotorwayPage.astro"), "utf8");
    expect(mw).toMatch(/<AroundBlock [^>]*slot="exit-around-slot" sid=\{false\} \/>/);
    // the visitor's around block (#890) is rendered on every motorway page, the exit's included
    expect(mw).toMatch(/const around = await aroundFirstRender\(/);
    expect(PLACE_SLOT).toBe("place-slot");
    // the topic script filters the slot it is handed, the page's one by default
    expect(topicsScript("de")).toContain('"slot":"place-slot"');
    expect(topicsScript("en", "exit-around-slot")).toContain('"slot":"exit-around-slot"');
  });

  it("a planted object page with its own copy of the block is refused, and so is one rendering it before the object", () => {
    const own = readFileSync(join(LAYOUTS, "EnergyPage.astro"), "utf8")
      .replace('import AroundBlock from "../components/AroundBlock.astro";', 'import { topicBarHtml } from "../lib/topic-filter.js";')
      .replace(/<AroundBlock [^>]*\/>/, '<div class="placebar"><Fragment set:html={topicBarHtml(lang, [], null, path)} /><div class="place-slot" id="place-slot" set:html={area.html} /></div>');
    expect(aroundCopies(own)).toEqual(["does not import the shared AroundBlock", "does not render <AroundBlock>", "writes the topic bar itself", "writes the cards slot itself"]);
    const src = readFileSync(join(LAYOUTS, "EnergyPage.astro"), "utf8");
    const block = /\s*<AroundBlock [^>]*\/>/.exec(src)![0];
    const early = src.replace(block, "").replace("<PageHead", `${block}\n  <PageHead`);
    expect(aroundCopies(early)).toEqual(["renders the block before the object"]);
  });
});

describe("#1188 AC 2/4: the fuel rows under a fuel page leave its station out, and stay a person's", () => {
  const KEY = "ags:09675139";
  const digest = () => {
    const asked: string[] = [];
    const f = (u: string) => {
      asked.push(u);
      if (u.includes("/internal/place/key?slug=kitzingen")) return Promise.resolve({ status: 200, headers: { get: (n: string) => (n === "content-type" ? "text/html; charset=utf-8" : null) }, text: () => Promise.resolve(`<p class="place-key">${KEY}</p>`) });
      return Promise.resolve({ status: 200, headers: { get: () => null }, text: () => Promise.resolve('<div class="place-fuel"><ul class="pcard__list"><li>x</li></ul></div>') });
    };
    return { f, asked };
  };
  const PERSON = { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0", "sec-fetch-site": "same-origin", "sec-fetch-mode": "cors", "sec-fetch-dest": "empty" };
  beforeEach(() => resetSlugKeys());

  it("`not` is forwarded by its slug shape only, to a person's read; a crawler's answer reads nothing and carries none", async () => {
    expect(placeFuelQuery(new URL(`https://x${PLACE_FUEL_PATH}?place=kitzingen&lang=de&not=${SLUG}`))?.not).toBe(`&not=${SLUG}`);
    expect(placeFuelQuery(new URL(`https://x${PLACE_FUEL_PATH}?place=kitzingen&lang=de&not=%3Cscript%3E`))?.not).toBe("");
    expect(placeFuelQuery(new URL(`https://x${PLACE_FUEL_PATH}?place=kitzingen&lang=de`))?.not).toBe("");
    const d = digest();
    const req = new Request(`https://viafrei.de${PLACE_FUEL_PATH}?place=kitzingen&lang=de&held=1&not=${SLUG}`, { headers: PERSON });
    const res = await placeFuelRoute(req, { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: d.f });
    expect(res.status).toBe(200);
    const data = d.asked.filter((u) => u.includes("/internal/place/fuel"));
    expect(data).toHaveLength(1);
    expect(new URL(data[0]!).searchParams.get("not")).toBe(SLUG);
    // a crawler: the sentence alone (refused=1), the rows never asked
    const c = digest();
    const bot = new Request(`https://viafrei.de${PLACE_FUEL_PATH}?place=kitzingen&lang=de&not=${SLUG}`, { headers: { "user-agent": "Googlebot/2.1 (+http://www.google.com/bot.html)" } });
    await placeFuelRoute(bot, { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: c.f });
    expect(c.asked.filter((u) => u.includes("/internal/place/fuel")).every((u) => u.endsWith("&refused=1"))).toBe(true);
  });

  it("the page's script asks with `not` only on a fuel station's own page", () => {
    const js = placeFuelScript();
    expect(js).toContain('if(own)p.set("not",own)');
    // the script's own expression for the page's station, run against the three kinds of page
    const expr = /const own=(\(\(location\.pathname\|\|""\)\.match\([^;]+);/.exec(js)![1]!;
    // eslint-disable-next-line @typescript-eslint/no-implied-eval -- running the shipped expression is the point
    const run = new Function("location", `return ${expr}`) as (l: { readonly pathname: string }) => string;
    const own = (pathname: string): string => run({ pathname });
    expect(own(`/de/fuel/${SLUG}`)).toBe(SLUG);
    expect(own(`/en/fuel/${SLUG}`)).toBe(SLUG);
    expect(own(`/de/charging/${SLUG}`)).toBe("");
    expect(own("/de/station/koeln-hbf")).toBe("");
    expect(own("/de/fuel")).toBe("");
  });
});

// a station page keeps its own fetch type, the station's (redirect: manual) — the shared fetch takes both
export type _StationFetchStillFits = Parameters<typeof fetchArea>[2]["fetchImpl"] extends StationFetchLike | undefined ? true : never;
