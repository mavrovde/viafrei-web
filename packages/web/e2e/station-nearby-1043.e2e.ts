/**
 * #1043 (c) against the REAL built shell and the REAL digest, in a real browser: Köln Hbf's "Haltestellen in der Nähe"
 * card — a static map (inline SVG, no tile, no third-party script) with the stops lettered A, B; the list with each
 * stop's next departures, plan vs live; the alert naming the bus stop on that stop and nowhere else; each stop's own
 * view at its own address with a link back to the card; and the road traffic around the station in two rings, each
 * message with its street and its Stand. And a page with nothing around it says so instead of an empty card.
 */
import type { ChildProcess } from "node:child_process";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { stationPath } from "../src/site/stations.js";
import { BRESLAUER_ALERT, startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 9002;
const BASE = `http://127.0.0.1:${String(PORT)}`;
let browser: Browser;
let shell: ChildProcess;
let digest: Awaited<ReturnType<typeof startRealDigest>>;
const external: string[] = [];

beforeAll(async () => {
  digest = await startRealDigest();
  shell = await startShell(PORT, { DIGEST_URL: digest.url, WEB_TILE_TIMEOUT_MS: "2000" });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
});

const open = async (lang: "de" | "en", path: string, status = 200): Promise<Page> => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  ctx.setDefaultTimeout(2000);
  const page = await ctx.newPage();
  page.on("request", (r) => {
    if (!r.url().startsWith(BASE)) external.push(r.url());
  });
  const r = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  expect(r?.status(), path).toBe(status);
  return page;
};
const card = (page: Page) => page.locator("#pcard-station-nearby");

describe("#1043 (c) the stops around Köln Hbf", () => {
  it("de: the map letters the stops on an inline SVG; the list names them nearest first, with the walk, no own level", async () => {
    const page = await open("de", stationPath("de", "koeln-hbf"));
    const c = card(page);
    expect(await c.locator("h2").textContent()).toBe("Haltestellen in der Nähe");
    expect(await c.locator("svg.stmap a.stmap__stop").evaluateAll((els) => els.map((e) => e.getAttribute("data-letter")))).toEqual(["A", "B"]);
    expect(await c.locator("svg.stmap image, img, iframe, script").count()).toBe(0);
    const stops = await c.locator("li.stlive__stop h3").allTextContents();
    expect(stops.map((x) => x.replace(/\s+/g, " ").trim())).toEqual(["A Dom/Hbf", "B Breslauer Platz/Hbf"]);
    expect(await c.locator("li.stlive__stop").first().locator(".stlive__stopmeta").textContent()).toContain("zu Fuß");
    await page.context().close();
  });

  it("de: a departure says the plan and the live figure; the alert is on its own stop only", async () => {
    const page = await open("de", stationPath("de", "koeln-hbf"));
    const c = card(page);
    const bus = c.locator("li#stop-de-05315-12001");
    // the 132's Trip Update: three minutes late — the new time inserted, the planned one struck through
    expect(await bus.locator("table.pcard__board tr").filter({ hasText: "132" }).locator("ins time").count()).toBe(1);
    expect(await bus.locator("table.pcard__board tr").filter({ hasText: "132" }).locator("del time").count()).toBe(1);
    expect(await bus.locator(".stlive__stopalerts").textContent()).toContain(BRESLAUER_ALERT);
    expect(await c.locator("li#stop-de-05315-11111 .stlive__stopalerts").count()).toBe(0);
    // never on the station's own alerts card: the alert names the bus stop, not the station
    expect(await page.locator("#pcard-station-alerts").textContent()).not.toContain(BRESLAUER_ALERT);
    await page.context().close();
  });

  it("de: the roads around the station — the inner and the outer ring, each with its street and its Stand", async () => {
    const page = await open("de", stationPath("de", "koeln-hbf"));
    const roads = card(page).locator("section.stlive__roads");
    expect(await roads.locator("h4.stlive__ring").allTextContents()).toEqual(["Bis 300 m", "300 m bis 600 m"]);
    const items = (await roads.locator("ul.stlive__roadlist > li").allTextContents()).map((x) => x.replace(/\s+/g, " "));
    expect(items).toHaveLength(2);
    expect(items[0]).toContain("Trankgasse");
    expect(items[1]).toContain("Komödienstraße");
    for (const i of items) expect(i).toMatch(/Stand \d{2}:\d{2}/);
    await page.context().close();
  });

  it("en: a stop's view is at its own address, lists its departures and links back to the card", async () => {
    const page = await open("en", stationPath("en", "koeln-hbf"));
    const link = card(page).locator("li#stop-de-05315-12001 h3 a");
    expect(await link.getAttribute("href")).toBe("/en/station/koeln-hbf/stop/de-05315-12001");
    await page.context().close();
    const stop = await open("en", "/en/station/koeln-hbf/stop/de-05315-12001");
    expect(await stop.locator("h1").textContent()).toBe("Breslauer Platz/Hbf");
    expect(await stop.locator('meta[name="robots"]').getAttribute("content")).toContain("noindex");
    expect(await stop.locator("#station-stop table.pcard__board tbody tr").count()).toBeGreaterThanOrEqual(2);
    const back = stop.locator("p.stlive__back a");
    expect(await back.textContent()).toContain("Back to Köln Hbf");
    expect(await back.getAttribute("href")).toBe("/en/station/koeln-hbf#pcard-station-nearby");
    await back.click();
    await stop.waitForURL(`${BASE}/en/station/koeln-hbf#pcard-station-nearby`);
    expect(await stop.locator("#pcard-station-nearby").isVisible()).toBe(true);
    await stop.context().close();
  });

  it("a key naming no stop around the station is a 404", async () => {
    const page = await open("de", "/de/station/koeln-hbf/stop/de-05315-99999", 404);
    await page.context().close();
  });

  it("a station with no stop in the walk says so with its radius", async () => {
    const page = await open("de", stationPath("de", "koeln-neumarkt"));
    expect(await card(page).locator(".stpage__note").first().textContent()).toBe("Keine weitere Haltestelle im Umkreis von 400 m.");
    await page.context().close();
  });

  it("no request left this origin: the map is ours, not a tile service's", () => {
    expect(external).toEqual([]);
  });
});
