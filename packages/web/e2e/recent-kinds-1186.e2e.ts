/**
 * #1186 (owner 2026-11-04): every recent place keeps its type hidden and opens the page of that type. Against the
 * REAL built shell and a stand-in digest (`stub-digest.ts`) whose `/internal/spot` knows Eschweiler Hbf, in a real
 * browser with an emulated position:
 *
 *  - AC 1: "use my location" at Eschweiler Hbf opens the station; its ★ there keeps it, and the chip opens
 *    `/de/station/eschweiler-hbf` from another page type. In a residential street the chip is the place's cards,
 *    under a place label — never a stop's name;
 *  - AC 7: one chip each of a station, a fuel station, a charging site, a motorway and a place opens its page, from
 *    the home and from another page type (the News page);
 *  - AC 3: an entry kept before the types, a bare position labelled "Eschweiler Hbf", is upgraded once on render: its
 *    chip opens the station.
 *
 * Run in the pinned Linux image (laptop results are not evidence): `npx vitest run --config packages/web/vitest.e2e.config.ts recent-kinds-1186`.
 */
import type { ChildProcess } from "node:child_process";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startShell } from "./server.js";
import { startStubDigest, type StubSpot } from "./stub-digest.js";
import { pathFor } from "../src/site/pages.js";

const PORT = 8994;
const BASE = `http://127.0.0.1:${String(PORT)}`;
const HBF: StubSpot = { lat: 50.81679, lon: 6.24661, path: "station/eschweiler-hbf", label: "Eschweiler Hbf" };
const STREET = { lat: 52.000123, lon: 9.000456 };
/** A person's browser: the lookup asks only for a person (#1171 C3). */
const PERSON_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const M = 24321; // a month stamp inside the keep window
const NEWS = pathFor("news", "de");
let browser: Browser;
let shell: ChildProcess;
let digest: Awaited<ReturnType<typeof startStubDigest>>;

beforeAll(async () => {
  digest = await startStubDigest({}, 5000, { fullCards: true, spots: [HBF] });
  shell = await startShell(PORT, { DIGEST_URL: digest.url, WEB_TILE_TIMEOUT_MS: "2000" });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
});

/** A context whose every wait gives up after 2 s (owner 2026-10-26), at `p` if given, with `recent` stored first. */
async function context(p: { lat: number; lon: number } | null, recent: unknown[] | null = null): Promise<BrowserContext> {
  const ctx = await browser.newContext({
    userAgent: PERSON_UA,
    viewport: { width: 1000, height: 900 },
    ...(p === null ? {} : { geolocation: { latitude: p.lat, longitude: p.lon, accuracy: 15 }, permissions: ["geolocation"] }),
  });
  ctx.setDefaultTimeout(2000);
  ctx.setDefaultNavigationTimeout(2000);
  if (recent !== null)
    await ctx.addInitScript((r: string) => {
      try {
        if (localStorage.getItem("viafrei.place.recent") === null) localStorage.setItem("viafrei.place.recent", r);
      } catch {
        /* no storage: the page renders without it */
      }
    }, JSON.stringify(recent));
  return ctx;
}
const open = async (page: Page, path: string): Promise<void> => void (await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" }));
const recentOf = (page: Page): Promise<Record<string, unknown>[]> => page.evaluate(() => JSON.parse(localStorage.getItem("viafrei.place.recent") ?? "[]") as Record<string, unknown>[]);

describe("#1186 AC 1: a located place keeps what it is", () => {
  it("at Eschweiler Hbf: the station opens, its ★ keeps it, and the chip opens /de/station/eschweiler-hbf from another page", async () => {
    const ctx = await context(HBF);
    const page = await ctx.newPage();
    await open(page, "/de");
    await Promise.all([page.waitForURL(`${BASE}/de/${HBF.path}`), page.click("#place-geo")]);
    await page.waitForLoadState("networkidle");
    const mine = page.locator("#place-mine");
    await mine.waitFor({ state: "visible" });
    await mine.click();
    const r = await recentOf(page);
    expect(r[0]).toMatchObject({ k: "station", p: "eschweiler-hbf", label: "Eschweiler Hbf" });
    // the type is kept hidden: never on the page, and the precise position nowhere on the device
    expect(JSON.stringify(r)).not.toContain(String(HBF.lat));
    await open(page, NEWS);
    const chip = page.locator('#place-recent a[data-kind="station"]');
    expect(await chip.getAttribute("href")).toBe(`/de/${HBF.path}`);
    expect((await chip.textContent())?.trim()).toBe("Eschweiler Hbf");
    await Promise.all([page.waitForURL(`${BASE}/de/${HBF.path}`), chip.click()]);
    await ctx.close();
  });

  it("in a residential street: the chip is the place's cards, under the place's label — never a stop's name", async () => {
    const ctx = await context(STREET);
    const page = await ctx.newPage();
    await open(page, "/de");
    await page.click("#place-geo");
    await page.waitForFunction(() => (document.getElementById("place-pill-label")?.textContent ?? "").includes("Teststadt"));
    const mine = page.locator("#place-mine");
    await mine.waitFor({ state: "visible" });
    await mine.click();
    const r = await recentOf(page);
    expect(r[0]).toMatchObject({ k: "point" });
    expect(String(r[0]?.["label"])).toContain("Teststadt");
    expect(String(r[0]?.["label"])).not.toMatch(/Hbf|Bahnhof/u);
    await open(page, NEWS);
    const chip = page.locator('#place-recent a[data-kind="point"]');
    expect(await chip.getAttribute("href")).toBe("/de");
    await Promise.all([page.waitForURL(`${BASE}/de`), chip.click()]);
    await page.waitForFunction(() => (document.getElementById("place-pill-label")?.textContent ?? "").includes("Teststadt"));
    await ctx.close();
  });
});

describe("#1186 AC 7: each type's chip opens its page, from the home and from another page type", () => {
  const ENTRIES = [
    { at: "pt:50.81679,6.24661", label: "Eschweiler Hbf", m: M, k: "station", p: "eschweiler-hbf" },
    { at: "pt:51.01,7", label: "Aral, Teststraße", m: M, k: "fuel", p: "aral-test-strasse-abcdefghij" },
    { at: "pt:51.12,7.1", label: "Teststrom, Markt", m: M, k: "charging", p: "teststrom-markt-abcdefghij" },
    { at: "pt:50.8,6.2", label: "A4", m: M, k: "autobahn", p: "a4" },
    { at: "slug:koeln", label: "Köln", m: M, k: "place", p: "koeln" },
  ];
  for (const from of ["/de", NEWS]) {
    for (const e of ENTRIES) {
      it(`a ${e.k} chip on ${from} opens /de/${e.k}/${e.p}`, async () => {
        const ctx = await context(null, ENTRIES);
        const page = await ctx.newPage();
        await open(page, from);
        const chip = page.locator(`#place-recent a[data-kind="${e.k}"]`);
        expect(await chip.getAttribute("href")).toBe(`/de/${e.k}/${e.p}`);
        await Promise.all([page.waitForURL(`${BASE}/de/${e.k}/${e.p}`), chip.click()]);
        // kept as it was: its type and page, hidden
        expect((await recentOf(page))[0]).toMatchObject({ k: e.k, p: e.p });
        await ctx.close();
      });
    }
  }
});

describe("#1186 AC 3: an entry kept before the types", () => {
  it("a bare position labelled 'Eschweiler Hbf' is upgraded once on render, and its chip opens the station", async () => {
    const ctx = await context(null, [{ at: "pt:50.815,6.2475", label: "Eschweiler Hbf", m: M }]);
    const page = await ctx.newPage();
    await open(page, NEWS);
    const chip = page.locator('#place-recent a[data-kind="station"]');
    await chip.waitFor();
    expect(await chip.getAttribute("href")).toBe(`/de/${HBF.path}`);
    expect((await recentOf(page))[0]).toMatchObject({ at: "pt:50.815,6.2475", k: "station", p: "eschweiler-hbf" });
    // once: the next page asks nothing
    const asked: string[] = [];
    page.on("request", (q) => void (new URL(q.url()).pathname === "/fragment/suggest" && asked.push(q.url())));
    await open(page, NEWS);
    expect(asked).toEqual([]);
    await ctx.close();
  });
});
