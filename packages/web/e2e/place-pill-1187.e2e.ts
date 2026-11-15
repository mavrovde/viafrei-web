/**
 * #1187 (owner 2026-11-04: "When I already have my current position in the header panel and switch between pages
 * like train stations, federal states or fuel stations, the header loses my position. It should be stable."). Against
 * the REAL built shell and a stand-in digest (`stub-digest.ts`, which answers one page of every type), in a real
 * browser with an emulated position:
 *
 *  - AC 1: "use my location" on the home, then one page of each type — place, station, fuel station, charging site,
 *    motorway, federal road, Land, News, connect — and the home again after a reload: the pill names the same place,
 *    said the same way ("gerundet, ca. 500 m"), on every one; a motorway page names it after its road;
 *  - AC 2: the same with a place picked in the header's list ("gewählt") and with a kept place's chip;
 *  - AC 5: nothing is written by any of those page loads.
 *
 * AC 3 (the IP guess on every page with nothing remembered) is NOT covered here: a page without cards of its own makes
 * no IP lookup (`lib/header-place.ts`), and adding one is a decision of its own (see the issue).
 *
 * Run in the pinned Linux image (laptop results are not evidence): `npx vitest run --config packages/web/vitest.e2e.config.ts place-pill-1187`.
 */
import type { ChildProcess } from "node:child_process";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startShell } from "./server.js";
import { startStubDigest } from "./stub-digest.js";
import { t } from "../src/i18n/index.js";
import { pathFor } from "../src/site/pages.js";
import { motorwayPath } from "../src/site/motorways.js";
import { placePath } from "../src/site/places.js";
import { stationPath } from "../src/site/stations.js";

const PORT = 8995;
const BASE = `http://127.0.0.1:${String(PORT)}`;
const STREET = { lat: 52.000123, lon: 9.000456 };
/** A person's browser: the lookup asks only for a person (#1171 C3). */
const PERSON_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const HOME = pathFor("start", "de");
const M = 24321; // a month stamp inside the keep window
/** One page of every type; the motorway page's pill names the road first. */
const PAGES: readonly { path: string; road?: string }[] = [
  { path: placePath("de", "koeln") },
  { path: stationPath("de", "koeln-hbf") },
  { path: "/de/fuel/aral-aachen-abcdefghij" },
  { path: "/de/charging/ionity-aachen-abcdefghij" },
  { path: motorwayPath("de", "A7"), road: "A7" },
  { path: "/de/road/b264" },
  { path: "/de/state/nordrhein-westfalen" },
  { path: pathFor("news", "de") },
  { path: pathFor("connect", "de") },
];
let browser: Browser;
let shell: ChildProcess;
let digest: Awaited<ReturnType<typeof startStubDigest>>;

beforeAll(async () => {
  digest = await startStubDigest({}, 5000, { fullCards: true, around: true });
  shell = await startShell(PORT, { DIGEST_URL: digest.url, WEB_TILE_TIMEOUT_MS: "2000", VF_MOTORWAY_AROUND: "1" });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
});

/** A context whose every wait gives up after 2 s (owner 2026-10-26), at `p` with the permission granted if given. */
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
const pill = async (page: Page): Promise<[string, string]> => [((await page.locator("#place-pill-label").textContent()) ?? "").trim(), ((await page.locator("#place-pill-how").textContent()) ?? "").trim()];
const kept = (page: Page): Promise<string | null> => page.evaluate(() => localStorage.getItem("viafrei.place"));

/** Every page type, then the home after a reload: the pill is `label`, said as `how`, and nothing is written by a load. */
async function sameEverywhere(page: Page, label: string, how: string): Promise<void> {
  const before = await kept(page);
  for (const p of PAGES) {
    await open(page, p.path);
    await expect.poll(() => pill(page), { timeout: 2000 }).toEqual([p.road === undefined ? label : `${p.road} · ${label}`, how]);
    expect(await kept(page), p.path).toBe(before);
  }
  await open(page, HOME);
  await page.reload({ waitUntil: "networkidle" });
  await expect.poll(() => pill(page), { timeout: 2000 }).toEqual([label, how]);
  expect(await kept(page)).toBe(before);
}

describe("#1187 the place pill stays the visitor's place on every page type", () => {
  it("AC 1: 'use my location' on the home — the same place, said the same way, on every page and after a reload", async () => {
    const ctx = await context(STREET);
    const page = await ctx.newPage();
    await open(page, HOME);
    await page.click("#place-geo");
    await expect.poll(() => kept(page)).not.toBeNull();
    const [label, how] = await pill(page);
    expect(label).toContain("Teststadt");
    expect(how).toBe(t("de", "place.how.exact"));
    await sameEverywhere(page, label, how);
    await ctx.close();
  });

  it("AC 2: a place picked in the header's list — the same on every page", async () => {
    const ctx = await context(null);
    const page = await ctx.newPage();
    await open(page, pathFor("news", "de"));
    await page.locator("header #place-hq").pressSequentially("Köln", { delay: 20 });
    const opt = page.locator("#place-hresults a.place-opt", { hasText: "Köln" }).first();
    await opt.waitFor();
    await opt.click();
    await expect.poll(() => pill(page)).toEqual(["Köln", t("de", "place.how.chosen")]);
    await sameEverywhere(page, "Köln", t("de", "place.how.chosen"));
    await ctx.close();
  });

  it("AC 2: a kept place's chip — the same on every page", async () => {
    const ctx = await context(null, [{ at: "pt:52.0,9.0", label: "Teststadt", m: M, k: "point" }]);
    const page = await ctx.newPage();
    await open(page, pathFor("news", "de"));
    await Promise.all([page.waitForURL(`${BASE}${HOME}`), page.click('#place-recent a[data-kind="point"]')]);
    await page.waitForLoadState("networkidle");
    await expect.poll(() => kept(page)).not.toBeNull();
    const [label, how] = await pill(page);
    expect(label).toContain("Teststadt");
    await sameEverywhere(page, label, how);
    await ctx.close();
  });
});
