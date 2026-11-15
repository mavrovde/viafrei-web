/**
 * #1171: "use my location" at one of our objects with a page opens that page. Against the REAL built shell and a
 * stand-in digest whose `/internal/spot` knows three planted objects (a station, a fuel station, a charging site), in
 * a real browser with an emulated position: on each object the click lands on its page in the visitor's language; in
 * an open field it shows the cell's cards as before. Whatever happens, the precise position leaves the browser in ONE
 * POST body only — in no request URL, never in the digest's request line — and the device keeps the rounded cell, never
 * the position.
 */
import type { ChildProcess } from "node:child_process";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startShell } from "./server.js";
import { startStubDigest, type StubSpot } from "./stub-digest.js";

const PORT = 8911;
const BASE = `http://127.0.0.1:${String(PORT)}`;
const STATION: StubSpot = { lat: 50.943033, lon: 6.958731, path: "station/koeln-hbf", label: "Köln Hbf" };
const FUEL: StubSpot = { lat: 51.012347, lon: 7.004561, path: "fuel/aral-test-strasse-abcdefghij", label: "Aral, Teststraße" };
const CHARGING: StubSpot = { lat: 51.123457, lon: 7.104563, path: "charging/teststrom-markt-abcdefghij", label: "Teststrom, Markt" };
const FIELD = { lat: 52.000123, lon: 9.000456 };
/** A person's browser: the lookup asks only for a person (C3), and headless Chromium names itself in its user agent. */
const PERSON_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
let browser: Browser;
let shell: ChildProcess;
let digest: Awaited<ReturnType<typeof startStubDigest>>;

beforeAll(async () => {
  digest = await startStubDigest({}, 5000, { fullCards: true, spots: [STATION, FUEL, CHARGING] });
  shell = await startShell(PORT, { DIGEST_URL: digest.url, WEB_TILE_TIMEOUT_MS: "2000" });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
});

/** The digits of a position that must not appear anywhere but the one POST body. */
const digits = (p: { lat: number; lon: number }): string[] => [String(p.lat), String(p.lon), p.lat.toFixed(4), p.lon.toFixed(4)];

type Seen = { urls: string[]; spotPosts: string[] };
async function at(p: { lat: number; lon: number }, lang: string, userAgent: string = PERSON_UA): Promise<{ page: Page; seen: Seen; close: () => Promise<void> }> {
  const ctx = await browser.newContext({ userAgent, viewport: { width: 1000, height: 900 }, geolocation: { latitude: p.lat, longitude: p.lon, accuracy: 15 }, permissions: ["geolocation"] });
  const page = await ctx.newPage();
  const seen: Seen = { urls: [], spotPosts: [] };
  page.on("request", (r) => {
    seen.urls.push(r.url());
    if (new URL(r.url()).pathname === "/fragment/spot") {
      expect(r.method()).toBe("POST");
      seen.spotPosts.push(r.postData() ?? "");
    }
  });
  await page.goto(`${BASE}/${lang}`, { waitUntil: "networkidle" });
  return { page, seen, close: () => ctx.close() };
}

async function stored(page: Page): Promise<string> {
  return page.evaluate(() => {
    const out: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) ?? "";
      out.push(`${k}=${localStorage.getItem(k) ?? ""}`);
    }
    return out.join("\n");
  });
}

/** Headless Chromium's own user agent, as it sends it. */
async function headlessUa(): Promise<string> {
  const ctx = await browser.newContext();
  const ua = await (await ctx.newPage()).evaluate(() => navigator.userAgent);
  await ctx.close();
  expect(ua).toMatch(/HeadlessChrome/u);
  return ua;
}

function onlyInTheBody(seen: Seen, p: { lat: number; lon: number }, digestFrom: number): void {
  expect(seen.spotPosts.length).toBe(1);
  expect((JSON.parse(seen.spotPosts[0] ?? "{}") as { lat: number }).lat).toBe(p.lat);
  for (const d of digits(p)) {
    for (const u of seen.urls) expect(u, `a request URL carries ${d}`).not.toContain(d);
    for (const h of digest.hits.slice(digestFrom)) expect(h, `the digest's request line carries ${d}`).not.toContain(d);
  }
}

describe("#1171 'use my location' at an object opens its page", () => {
  for (const [name, obj, lang] of [
    ["a station", STATION, "de"],
    ["a fuel station", FUEL, "en"],
    ["a charging site", CHARGING, "de"],
  ] as const) {
    it(`on ${name}: the click lands on its page in the visitor's language; the device keeps the cell, never the position`, async () => {
      const from = digest.hits.length;
      const { page, seen, close } = await at(obj, lang);
      await Promise.all([page.waitForURL(`${BASE}/${lang}/${obj.path}`, { timeout: 2000 }), page.click("#place-geo")]);
      onlyInTheBody(seen, obj, from);
      const s = await stored(page);
      for (const d of digits(obj)) expect(s, `the device stored ${d}`).not.toContain(d);
      expect(s).toContain("pt:");
      await close();
    });
  }

  it("in an open field: the cell's cards, the URL stays the home, and still one POST alone carries the position", async () => {
    const from = digest.hits.length;
    const { page, seen, close } = await at(FIELD, "de");
    const [res] = await Promise.all([page.waitForResponse((r) => new URL(r.url()).pathname === "/fragment/spot", { timeout: 2000 }), page.click("#place-geo")]);
    expect(res.status()).toBe(204);
    await page.waitForLoadState("networkidle");
    await page.waitForFunction(() => (document.getElementById("place-pill-label")?.textContent ?? "").includes("Teststadt"), undefined, { timeout: 2000 });
    expect(new URL(page.url()).pathname).toBe("/de");
    expect(await page.locator("#place-slot .pcard").count()).toBeGreaterThan(0);
    onlyInTheBody(seen, FIELD, from);
    await close();
  });

  it("C3: a browser naming itself a robot (headless Chromium's own user agent) on a station gets the cards — the digest is never asked", async () => {
    const from = digest.spotBodies.length;
    const { page, close } = await at(STATION, "de", await headlessUa());
    // the lookup is asked and answered (204 from the gate) — and only then is the outcome judged, not before it lands
    const [res] = await Promise.all([page.waitForResponse((r) => new URL(r.url()).pathname === "/fragment/spot", { timeout: 2000 }), page.click("#place-geo")]);
    expect(res.status()).toBe(204);
    await page.waitForLoadState("networkidle");
    await page.waitForFunction(() => (document.getElementById("place-pill-label")?.textContent ?? "").includes("Teststadt"), undefined, { timeout: 2000 });
    expect(new URL(page.url()).pathname).toBe("/de");
    expect(digest.spotBodies.length).toBe(from);
    await close();
  });

  it("without the click (the permission already granted) nothing is asked: the cards, no POST", async () => {
    const { page, seen, close } = await at(STATION, "de");
    await page.waitForFunction(() => (document.getElementById("place-pill-label")?.textContent ?? "").length > 0, undefined, { timeout: 2000 });
    expect(seen.spotPosts).toEqual([]);
    expect(new URL(page.url()).pathname).toBe("/de");
    await close();
  });
});
