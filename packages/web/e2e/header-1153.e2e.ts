/**
 * #1153 (owner 2026-11-03): the header is the site's ONE search and location dispatcher — "live for <place>", one
 * dynamic search field (no button), "use my location", the recent places, "Your browser remembers this place · Forget
 * place" while a place is stored, "All of Germany", and the beta notice — on every page, and the chosen place affects
 * all of them. Against the REAL built shell and a stand-in digest (`stub-digest.ts`, its `/internal/search` answering
 * "A7" and "Köln Hbf").
 *
 *  - the markup, over the whole route map (`scripts/site-pages.txt`) in every live language and the dynamic
 *    families: exactly one site search form, in `<header>`, with no submit button; each place, scope and search
 *    control and notice exactly once, inside `<header>`, and none in `<main>`;
 *  - a place chosen in the header of a News, motorway or station page shows its cards on the home, and every page's
 *    header says "live for" it;
 *  - "A7" opens the A7 page, "Köln Hbf" the station page, "Köln" sets the site-wide place; the suggestions follow
 *    each keystroke, with no button;
 *  - without JavaScript Enter submits to /<lang>/search, and the chips and "live for" are links;
 *  - nothing is written to the device before a click; "Forget place" clears it everywhere; "All of Germany" switches
 *    every page to the national scope until a place is chosen.
 *
 * Run in the pinned Linux image (laptop results are not evidence): `npx vitest run --config packages/web/vitest.e2e.config.ts header-1153`.
 */
import { type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { all, classesOf, parse } from "@viafrei/design/testing";
import { startShell } from "./server.js";
import { startStubDigest } from "./stub-digest.js";
import { LIVE_LANGS, pathFor } from "../src/site/pages.js";
import { motorwayPath } from "../src/site/motorways.js";
import { placePath } from "../src/site/places.js";
import { stationPath } from "../src/site/stations.js";

const PORT = 8984;
const BASE = `http://127.0.0.1:${String(PORT)}`;
const HERE = dirname(fileURLToPath(import.meta.url));
let browser: Browser;
let shell: ChildProcess;
let digest: Awaited<ReturnType<typeof startStubDigest>>;

/** The route map's pages (not its redirects, not its identity files), and the dynamic families, in every language. */
function paths(): string[] {
  const map = readFileSync(join(HERE, "..", "..", "..", "scripts", "site-pages.txt"), "utf8")
    .split("\n")
    .filter((l) => l !== "" && !l.startsWith("#"))
    .map((l) => l.trim().split(/\s+/))
    .filter((c) => c[3] === "page")
    .map((c) => c[0]!);
  const dynamic = LIVE_LANGS.flatMap((l) => [placePath(l, "koeln"), `/${l}/station`, stationPath(l, "koeln-hbf"), `/${l}/autobahn`, motorwayPath(l, "A7"), `/${l}/search?q=A7`]);
  return [...new Set([...map, ...dynamic])];
}

/** The header's controls and notices that may exist once only, and only in `<header>` (#1153 AC "outside the header"). */
const HEADER_ONLY = ["#place-bar", "#place-pill", "#place-scope-de", "#place-head", "#place-hq", "#place-hresults", "#place-geo", "#place-mine", "#place-recent", "#place-kept", "#place-kept-forget", "#place-geo-msg", "#beta-notice"] as const;
/**
 * The page-own list filters the digest renders in a page body — each searches the list it sits in, never the site, and
 * none is a place or a scope (their removal is the owner's call, named in #1153's hand-over): the motorway index's
 * filter, a motorway's own sections ("find on the A7"), the station catalogue's and the home's station block's.
 */
const LIST_FILTERS = ["motorway-search", "mws__form", "stpage-search", "station-top__search"] as const;

type Seen = { readonly path: string; readonly status: number; readonly html: string };
const inventory: Seen[] = [];

beforeAll(async () => {
  digest = await startStubDigest({}, 5000, { fullCards: true, around: true });
  shell = await startShell(PORT, { DIGEST_URL: digest.url, WEB_TILE_TIMEOUT_MS: "2000", VF_MOTORWAY_AROUND: "1" });
  browser = await chromium.launch();
  for (const path of paths()) {
    const r = await fetch(`${BASE}${path}`, { redirect: "manual", headers: { "accept-language": "de" } });
    inventory.push({ path, status: r.status, html: await r.text() });
  }
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
});

const pages = (): Seen[] => inventory.filter((s) => (s.status === 200 || s.status === 404) && /^<!doctype html/i.test(s.html));
const SEARCH = 'form[role="search"]';

describe("#1153 the markup: one search, in the header, on every page of the map in every language", () => {
  it("read the whole route map and the dynamic families (else this suite proves nothing)", () => {
    expect(inventory.length).toBeGreaterThan(200);
    for (const lang of LIVE_LANGS) expect(pages().filter((s) => s.path.startsWith(`/${lang}`)).length, lang).toBeGreaterThan(5);
  });
  it("every page renders exactly one site search form, inside <header>, and no page-body form searches the site", () => {
    for (const s of pages()) {
      expect(all(s.html, `header ${SEARCH}`).length, s.path).toBe(1);
      const lang = s.path.split("/")[1] || "de";
      expect(all(s.html, `header ${SEARCH}#place-head[action="/${lang}/search"][method="get"]`).length, s.path).toBe(1);
      // every other search form is one of the named list filters, never a second site search or a place search
      const others = all(s.html, SEARCH).filter((f) => f.attrs.id !== "place-head");
      for (const f of others) expect(LIST_FILTERS.some((c) => classesOf(f).includes(c)), `${s.path} ${classesOf(f).join(".")}`).toBe(true);
      for (const f of others) expect(f.attrs.action ?? "", s.path).not.toMatch(/\/search$/);
    }
  });
  it("the header search has no submit button on any page", () => {
    for (const s of pages()) {
      expect(all(s.html, "form#place-head button").length, s.path).toBe(0);
      expect(all(s.html, 'form#place-head input[type="submit"]').length, s.path).toBe(0);
    }
  });
  it("each place, scope and search control and notice appears exactly once, inside <header>, and <main> carries none", () => {
    for (const s of pages()) {
      // parsed once per page: 43 selectors over a re-parse each ran this test to 56 s of its 60 s (#1182)
      const doc = parse(s.html).root;
      for (const sel of HEADER_ONLY) {
        expect(all(doc, sel).length, `${s.path} ${sel}`).toBe(1);
        expect(all(doc, `header ${sel}`).length, `${s.path} ${sel} in <header>`).toBe(1);
        expect(all(doc, `main ${sel}`).length, `${s.path} ${sel} in <main>`).toBe(0);
      }
      // no hidden twin, no fallback form: the retired place bar, echo and site search box are nowhere
      for (const sel of ["#site-place", ".site-head__search", "#site-q", "#search-q"]) expect(all(doc, sel).length, `${s.path} ${sel}`).toBe(0);
    }
  });
  it("one combobox with one label", () => {
    for (const s of pages()) {
      for (const c of all(s.html, '[role="combobox"]')) expect(["place-hq", "station-top-q", "station-q"], s.path).toContain(c.attrs.id);
      expect(all(s.html, 'header [role="combobox"]#place-hq').length, s.path).toBe(1);
      expect(all(s.html, 'label[for="place-hq"]').length, s.path).toBe(1);
    }
  });
  it("without JavaScript the chips and 'live for' are links", () => {
    for (const s of pages()) {
      expect(all(s.html, "a#place-pill[href]").length, s.path).toBe(1);
      expect(all(s.html, "a#place-scope-de[href]").length, s.path).toBe(1);
      expect(all(s.html, "#place-recent a.place-opt[href]").length, s.path).toBeGreaterThan(0);
    }
  });
  // #1198 (owner 2026-11-06, "add the place script"): the fuel board carries the header's place script since then —
  // every one under the nonce, none of them analytics — and its header still works without it, as a form and links
  it("the fuel board carries the header's script under the nonce and no analytics, and its header still works as a form and links", () => {
    const fuel = pages().filter((s) => /\/(kraftstoff|fuel)/.test(s.path) || s.path.endsWith(pathFor("fuel", "de")));
    expect(fuel.length).toBeGreaterThan(0);
    for (const s of fuel) {
      const scripts = s.html.match(/<script\b(?![^>]*type="application\/ld\+json")[^>]*>/g) ?? [];
      expect(scripts.length, s.path).toBeGreaterThan(0);
      expect(scripts.filter((t) => !/\snonce="[^"]+"/.test(t)).length, s.path).toBe(0);
      expect(s.html, s.path).not.toMatch(/googletagmanager\.com|clarity\.ms|gtag\(|<astro-island\b/);
      expect(all(s.html, 'header form#place-head[method="get"]').length, s.path).toBe(1);
    }
  });
});

/** A context whose every wait gives up after 2 s (owner 2026-10-26: no test timeout above 2 s). */
async function context(opts: Parameters<Browser["newContext"]>[0] = {}): Promise<BrowserContext> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...opts });
  ctx.setDefaultTimeout(2000);
  ctx.setDefaultNavigationTimeout(2000);
  return ctx;
}
/** Every write to localStorage the page makes, from its first script on. */
async function recordWrites(ctx: BrowserContext): Promise<void> {
  await ctx.addInitScript(() => {
    const w = window as unknown as { __vfWrites: string[] };
    w.__vfWrites = [];
    const own = Object.getOwnPropertyDescriptors(Storage.prototype);
    const set = own.setItem?.value as (this: Storage, k: string, v: string) => void;
    const del = own.removeItem?.value as (this: Storage, k: string) => void;
    Storage.prototype.setItem = function (k: string, v: string) {
      w.__vfWrites.push(`set ${k}`);
      return set.call(this, k, v);
    };
    Storage.prototype.removeItem = function (k: string) {
      w.__vfWrites.push(`del ${k}`);
      return del.call(this, k);
    };
  });
}
const writes = (page: Page): Promise<string[]> => page.evaluate(() => (window as unknown as { __vfWrites: string[] }).__vfWrites);
const stored = (page: Page): Promise<string[]> => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("viafrei.place")));
const pill = async (page: Page): Promise<string> => ((await page.locator("#place-pill-label").textContent()) ?? "").trim();
async function open(page: Page, path: string): Promise<void> {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
}
async function type(page: Page, q: string): Promise<void> {
  await page.locator("header #place-hq").pressSequentially(q, { delay: 20 });
}
async function choose(page: Page, q: string, option: string): Promise<void> {
  await type(page, q);
  const opt = page.locator("#place-hresults a.place-opt", { hasText: option }).first();
  await opt.waitFor();
  await opt.click();
}

const NEWS = pathFor("news", "de");
const OTHER_PAGES = [NEWS, motorwayPath("de", "A7"), stationPath("de", "koeln-hbf"), pathFor("connect", "de"), placePath("de", "muenchen")];

describe("#1153 with JavaScript: the header chooses the place for every page", () => {
  for (const from of [NEWS, motorwayPath("de", "A7"), stationPath("de", "koeln-hbf")]) {
    it(`a place chosen in the header of ${from} shows its cards on the home, and every header says "live for" it`, async () => {
      const ctx = await context();
      const page = await ctx.newPage();
      await open(page, from);
      await choose(page, "Köln", "Köln");
      expect(page.url()).toBe(`${BASE}${from}`);
      await expect.poll(() => pill(page)).toContain("Köln");
      await open(page, pathFor("start", "de"));
      await page.locator("#place-slot .pcard").first().waitFor();
      expect(await pill(page)).toBe("Köln");
      for (const p of [NEWS, stationPath("de", "koeln-hbf"), pathFor("connect", "de")]) {
        await open(page, p);
        await expect.poll(() => pill(page), { timeout: 2000 }).toBe("Köln");
        expect(await page.locator("#place-kept").isVisible(), p).toBe(true);
      }
      await ctx.close();
    });
  }
  it("'A7' opens the A7 page; 'Köln Hbf' opens the station page; 'Köln' sets the site-wide place", async () => {
    const ctx = await context();
    const page = await ctx.newPage();
    await open(page, NEWS);
    await type(page, "A7");
    const a7 = page.locator("#place-hresults a.place-opt").first();
    await a7.waitFor();
    expect(await a7.getAttribute("href")).toBe(motorwayPath("de", "A7"));
    await page.locator("header #place-hq").press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.waitForURL(`${BASE}${motorwayPath("de", "A7")}`);
    expect(await stored(page)).toEqual([]);

    await open(page, NEWS);
    await type(page, "Köln Hbf");
    const hbf = page.locator("#place-hresults a.place-opt").first();
    await hbf.waitFor();
    expect(await hbf.getAttribute("href")).toBe(stationPath("de", "koeln-hbf"));
    await hbf.click();
    await page.waitForURL(`${BASE}${stationPath("de", "koeln-hbf")}`);
    expect(await stored(page)).toEqual([]);

    await type(page, "Köln");
    const koeln = page.locator("#place-hresults a.place-opt").first();
    await koeln.waitFor();
    expect(await koeln.getAttribute("href")).toBe(placePath("de", "koeln"));
    await koeln.click();
    await expect.poll(() => pill(page)).toBe("Köln");
    expect(page.url()).toBe(`${BASE}${stationPath("de", "koeln-hbf")}`);
    expect(await stored(page)).toContain("viafrei.place");
    await ctx.close();
  });
  it("the suggestions appear while typing, with no button press, and list the kinds in groups", async () => {
    const ctx = await context();
    const page = await ctx.newPage();
    await open(page, pathFor("connect", "de"));
    expect(await page.locator("header form#place-head button").count()).toBe(0);
    await type(page, "Kö");
    await type(page, "ln");
    await page.locator("#place-hresults a.place-opt").first().waitFor();
    expect(await page.getAttribute("#place-hq", "aria-expanded")).toBe("true");
    expect(await page.locator("#place-hresults .ss-group").count()).toBeGreaterThan(1);
    // the place group leads for a place's name (the station follows it)
    expect(await page.locator("#place-hresults .ss-group").first().getAttribute("class")).toContain("ss-group--place");
    // Escape closes the list, focus stays in the field
    await page.locator("header #place-hq").press("Escape");
    expect(await page.locator("#place-hresults a.place-opt").count()).toBe(0);
    await ctx.close();
  });
});

describe("#1153 nothing is written before an explicit click; Forget and All of Germany act on every page", () => {
  it("loading every kind of page with storage empty writes nothing", async () => {
    const ctx = await context();
    await recordWrites(ctx);
    const page = await ctx.newPage();
    for (const p of [pathFor("start", "de"), ...OTHER_PAGES]) {
      await open(page, p);
      expect(await writes(page), p).toEqual([]);
      expect(await stored(page), p).toEqual([]);
      expect(await page.locator("#place-kept").isVisible(), p).toBe(false);
    }
    await ctx.close();
  });
  it("'Forget place' in the header of any page clears the stored place everywhere, and the notice disappears", async () => {
    const ctx = await context();
    const page = await ctx.newPage();
    await open(page, NEWS);
    await choose(page, "Köln", "Köln");
    await page.locator("#place-kept").waitFor({ state: "visible" });
    await open(page, motorwayPath("de", "A7"));
    await page.locator("#place-kept").waitFor({ state: "visible" });
    await page.click("#place-kept-forget");
    expect(await stored(page)).toEqual([]);
    expect(await page.locator("#place-kept").isVisible()).toBe(false);
    for (const p of [pathFor("start", "de"), NEWS, pathFor("connect", "de")]) {
      await open(page, p);
      expect(await page.locator("#place-kept").isVisible(), p).toBe(false);
      expect(await pill(page), p).not.toBe("Köln");
    }
    await ctx.close();
  });
  it("'All of Germany' in the header switches every page, the home and a motorway page too, to national scope until a place is chosen", async () => {
    const ctx = await context();
    const page = await ctx.newPage();
    await open(page, NEWS);
    await choose(page, "Köln", "Köln");
    await page.click("#place-scope-de");
    expect(await page.getAttribute("#place-scope-de", "aria-checked")).toBe("true");
    for (const p of [pathFor("start", "de"), motorwayPath("de", "A7"), pathFor("connect", "de")]) {
      await open(page, p);
      await expect.poll(() => page.getAttribute("#place-scope-de", "aria-checked"), { timeout: 2000 }).toBe("true");
      expect(await page.getAttribute("#place-pill", "aria-checked"), p).toBe("false");
    }
    // the home's place block shows no place's cards on the national scope
    await open(page, pathFor("start", "de"));
    expect(await page.locator("#place-slot .pcard").count()).toBe(0);
    // a place chosen again ends it
    await choose(page, "Köln", "Köln");
    await expect.poll(() => page.getAttribute("#place-pill", "aria-checked")).toBe("true");
    await open(page, NEWS);
    await expect.poll(() => pill(page)).toBe("Köln");
    expect(await page.getAttribute("#place-scope-de", "aria-checked")).toBe("false");
    await ctx.close();
  });
  it("a place page keeps its own place and offers 'make this my place', written on its click only", async () => {
    const ctx = await context();
    await recordWrites(ctx);
    const page = await ctx.newPage();
    await open(page, placePath("de", "muenchen"));
    expect(await writes(page)).toEqual([]);
    // owner decision 2026-11-06 (#1180 compact header): at 1280 px the offer stands in the bar behind the header's
    // opener; opening it writes nothing
    await page.click("#place-open");
    expect(await writes(page)).toEqual([]);
    const mine = page.locator("#place-mine");
    await mine.waitFor({ state: "visible" });
    await mine.click();
    expect(await stored(page)).toContain("viafrei.place");
    expect(await mine.isVisible()).toBe(false);
    await open(page, NEWS);
    await expect.poll(() => pill(page)).toBe("München");
    await ctx.close();
  });
});

describe("#1153 without JavaScript", () => {
  it("Enter in the header search submits to /<lang>/search, from any page", async () => {
    const ctx = await context({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    for (const lang of ["de", "en"] as const) {
      await page.goto(`${BASE}${pathFor("news", lang)}`);
      await page.fill("header #place-hq", "A7");
      await page.locator("header #place-hq").press("Enter");
      await page.waitForURL(/\/search\?q=A7$/);
      expect(new URL(page.url()).pathname).toBe(`/${lang}/search`);
      expect(await page.inputValue("header #place-hq")).toBe("A7");
    }
    await ctx.close();
  });
  it("a chip and 'live for' are links that open their page", async () => {
    const ctx = await context({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(`${BASE}${NEWS}`);
    // owner decision 2026-11-06 (#1180 compact header): at 1280 px the chips stand behind the header's opener, which
    // without JavaScript is a link to the search page, where the bar stands whole
    await Promise.all([page.waitForURL(/\/de\/search$/), page.click("#place-open")]);
    const chip = page.locator("#place-recent a.place-opt").first();
    const href = (await chip.getAttribute("href")) ?? "";
    await chip.click();
    await page.waitForURL(`${BASE}${href}`);
    await page.goto(`${BASE}${NEWS}`);
    const to = (await page.getAttribute("#place-pill", "href")) ?? "";
    await page.click("#place-pill");
    await page.waitForURL((u) => u.pathname === to.split("?")[0]);
    await ctx.close();
  });
});
