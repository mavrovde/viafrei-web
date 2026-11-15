/**
 * #1182, the data steward's ruling of 2026-11-08 (point 2), against the REAL built shell and the REAL digest
 * (`real-digest.ts`: Köln Hbf and Neumarkt near a Köln cell) with a GeoIP file built from the test fixture (its
 * 192.0.2.0/24 is Köln):
 *  (a) a crawler, DNT and GPC get the catalogue with no near list and no DB-IP line;
 *  (b) a person's page carries the list, `private, no-store`, `Vary: X-Forwarded-For`, and no coordinate;
 *  (f) DB-IP's credit stands under the list the IP rung chose;
 *  (c) "Meinen Standort verwenden" with a precise fix: no request to `/fragment/spot`, the near list re-asked with the
 *      ~500 m cell alone, in a POST body.
 * Measured in the Linux image only; no wait above 2 s.
 */
import type { ChildProcess } from "node:child_process";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { all, first } from "@viafrei/design/testing";
import { pathFor } from "../src/site/pages.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8991;
const BASE = `http://127.0.0.1:${String(PORT)}`;
const HERE = dirname(fileURLToPath(import.meta.url));
const GEO_DIR = mkdtempSync(join(tmpdir(), "vf-stnear-geo-"));
const GEO_FILE = join(GEO_DIR, "geoip.vfgeo");
const KOELN_IP = "192.0.2.10";
const PERSON_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const ID = { IMPRESSUM_NAME: "Near Probe", IMPRESSUM_STREET: "Probeweg 5", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "near@example.invalid" };
const WAIT = { timeout: 2000 } as const;
/** A precise fix near Köln Hbf, and the cell the device rounds it to. */
const FIX = { latitude: 50.94312, longitude: 6.95871, accuracy: 12 };
const FIX_CELL = "pt:50.945,6.96";
const STATIONS = pathFor("stations", "de");

let browser: Browser;
let shell: ChildProcess;
let digest: Awaited<ReturnType<typeof startRealDigest>>;

beforeAll(async () => {
  digest = await startRealDigest();
  const csv = readFileSync(join(HERE, "..", "test", "fixtures", "geoip-fixture.csv"), "utf8");
  execFileSync(process.execPath, [join(HERE, "..", "..", "..", "scripts", "geoip-build.mjs"), "--release", "2026-10", "--out", GEO_FILE, "--min-de-ranges", "1"], { input: csv, encoding: "utf8" });
  shell = await startShell(PORT, { ...ID, DIGEST_URL: digest.url, GEOIP_FILE: GEO_FILE });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
  rmSync(GEO_DIR, { recursive: true, force: true });
});

const get = async (h: Record<string, string>): Promise<{ res: Response; html: string; ms: number }> => {
  const t0 = Date.now();
  const res = await fetch(`${BASE}${STATIONS}`, { headers: { "x-forwarded-for": KOELN_IP, "user-agent": PERSON_UA, ...h } });
  const html = await res.text();
  return { res, html, ms: Date.now() - t0 };
};

describe("#1182 stations near the visitor on the station index", () => {
  it("(a) a crawler, DNT and GPC: the catalogue with no near list and no DB-IP line", async () => {
    for (const h of [{ "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" }, { dnt: "1" }, { "sec-gpc": "1" }]) {
      const r = await get(h);
      expect(r.res.status, JSON.stringify(h)).toBe(200);
      expect(first(r.html, "#station-index"), JSON.stringify(h)).not.toBeNull();
      expect(all(r.html, "#station-near"), JSON.stringify(h)).toHaveLength(0);
      expect(r.html, JSON.stringify(h)).not.toContain("IP Geolocation by DB-IP");
      expect(r.ms).toBeLessThan(2000);
    }
  });

  it("(b, f) a person: the list right after the search, private and varying by address, no coordinate, DB-IP credited", async () => {
    const r = await get({});
    expect(r.res.status).toBe(200);
    expect(r.ms).toBeLessThan(2000);
    expect(r.res.headers.get("cache-control")).toBe("private, no-store");
    expect(r.res.headers.get("vary") ?? "").toContain("X-Forwarded-For");
    const hrefs = all(r.html, "#station-near a").map((a) => a.attrs.href);
    expect(hrefs).toEqual(["/de/station/koeln-hbf", "/de/station/koeln-neumarkt"]);
    expect(r.html.indexOf('class="stpage-search"')).toBeLessThan(r.html.indexOf('id="station-near"'));
    expect(r.html).toContain("IP Geolocation by DB-IP");
    for (const x of ["50.9375", "6.9603", "50.94", KOELN_IP]) expect(r.html, x).not.toContain(x);
    // the scripts name the key's shape ("pt:"); no key with a coordinate is in the document
    expect(r.html).not.toMatch(/pt:-?\d/);
  });

  it("the page's budgets with the list: at most 25 phone screens, the document's size said", async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 812 }, userAgent: PERSON_UA, extraHTTPHeaders: { "X-Forwarded-For": KOELN_IP } });
    const page = await ctx.newPage();
    const t0 = Date.now();
    const res = await page.goto(`${BASE}${STATIONS}`, { waitUntil: "load" });
    const ms = Date.now() - t0;
    const bytes = new TextEncoder().encode((await res?.text()) ?? "").length;
    await page.waitForSelector("#station-near", WAIT);
    const screens = await page.evaluate(() => document.documentElement.scrollHeight / 812);
    console.log(`station-near-1182 budget: ${screens.toFixed(1)} screens, ${String(bytes)} B, load ${String(ms)} ms`);
    expect(screens).toBeLessThanOrEqual(25);
    expect(bytes).toBeLessThan(700_000);
    expect(ms).toBeLessThan(2000);
    await ctx.close();
  });

  it("(c) a precise click on Meinen Standort verwenden asks no exact position: the cell alone, in the body of the near ask", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, userAgent: PERSON_UA, geolocation: FIX, permissions: ["geolocation"], extraHTTPHeaders: { "X-Forwarded-For": KOELN_IP } });
    ctx.setDefaultTimeout(2000);
    const page = await ctx.newPage();
    const asked: { url: string; body: string }[] = [];
    page.on("request", (q) => void asked.push({ url: q.url(), body: q.postData() ?? "" }));
    await page.goto(`${BASE}${STATIONS}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#station-near", WAIT);
    await page.click("#place-pill");
    await Promise.all([page.waitForResponse((r) => r.url().endsWith("/fragment/station-near"), WAIT), page.click("#place-geo")]);
    expect(asked.filter((q) => q.url.endsWith("/fragment/spot"))).toEqual([]);
    const near = asked.filter((q) => q.url.endsWith("/fragment/station-near"));
    expect(near.length).toBeGreaterThanOrEqual(1);
    for (const q of near) {
      expect(JSON.parse(q.body)).toEqual({ at: FIX_CELL, lang: "de" });
      expect(q.url).toBe(`${BASE}/fragment/station-near`);
    }
    expect(asked.map((q) => `${q.url} ${q.body}`).join("\n")).not.toContain(String(FIX.latitude));
    await page.waitForSelector("#station-near a[href='/de/station/koeln-hbf']", WAIT);
    await ctx.close();
  });
});
