/**
 * #1087 parts 2 and 3 against the REAL built shell and the REAL digest (`real-digest.ts`: Köln Hbf with two
 * cancellations, a late departure and a lift out, Aachen Hbf with three late departures):
 *  - the home in every live language carries the station block in the rail group, each row one link to its station
 *    page, the search and the link to every station;
 *  - #1199: its heading names what a station is counted by (the language's own words), and each chip says what it
 *    counts — Aachen Hbf's service alert is a chip of its own;
 *  - from the home a visitor reaches Aachen Hbf in two steps: search "Aachen", follow the hit;
 *  - a dead digest: the home still answers 200, and the block is its error state with the search still there.
 * Measured in the Linux image only (owner 2026-10-26); no wait above 2 s.
 */
import type { ChildProcess } from "node:child_process";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { all, first, text } from "@viafrei/design/testing";
import { STATION_COPY } from "../../../.pinned/app/packages/digest/dist/src/presentation/i18n-station.js";
import { LIVE_LANGS, pathFor } from "../src/site/pages.js";
import { stationPath } from "../src/site/stations.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8935;
const DEAD_PORT = 8936;
const BASE = `http://127.0.0.1:${String(PORT)}`;
const WAIT = { timeout: 2000 } as const;
let browser: Browser;
let shell: ChildProcess;
let dead: ChildProcess | undefined;
let digest: Awaited<ReturnType<typeof startRealDigest>>;

beforeAll(async () => {
  digest = await startRealDigest();
  shell = await startShell(PORT, { DIGEST_URL: digest.url, WEB_TILE_TIMEOUT_MS: "2000" });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  dead?.kill();
  await digest?.close();
});

const home = async (base: string, lang: string): Promise<{ status: number; body: string }> => {
  const res = await fetch(`${base}${pathFor("start", lang as (typeof LIVE_LANGS)[number])}`, { headers: { "accept-language": lang } });
  return { status: res.status, body: await res.text() };
};

describe("#1087 part 2: the home's station block", () => {
  it("every live language: the block in the rail group, its rows linking their station pages, the search and every station", async () => {
    for (const lang of LIVE_LANGS) {
      const r = await home(BASE, lang);
      expect(r.status, lang).toBe(200);
      const block = first(r.body, "#now-rail section#station-top");
      expect(block, lang).not.toBeNull();
      expect(block!.attrs.class, lang).toBe("station-top");
      const rows = all(r.body, "#station-top a.sttop").map((a) => a.attrs.href);
      expect(rows.length, lang).toBeGreaterThanOrEqual(1);
      expect(rows, lang).toEqual([stationPath(lang, "koeln-hbf"), stationPath(lang, "aachen-hbf")]);
      // #1199: the heading is the one for departures and alerts, never the lifts' and never "most affected"
      expect(text(first(r.body, "#station-top h2.station-top__h")!), lang).toBe(STATION_COPY[lang].top.head);
      const kinds = all(r.body, "#station-top a.sttop").map((a) => all(a, ".sttop__chip").map((c) => c.attrs["data-kind"]));
      expect(kinds, lang).toEqual([["cancelled", "late", "lifts"], ["late", "alerts"]]);
      expect(first(r.body, "#station-top form.station-top__search")!.attrs.action, lang).toBe(pathFor("stations", lang));
      expect(first(r.body, "#station-top p.station-top__cta a")!.attrs.href, lang).toBe(pathFor("stations", lang));
    }
  });
});

describe("#1087 part 3: a station from the home in two steps", () => {
  it('"Aachen" in the home\'s search, then the hit: Aachen Hbf\'s page', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    ctx.setDefaultTimeout(2000);
    const page = await ctx.newPage();
    await page.goto(`${BASE}${pathFor("start", "de")}`, { waitUntil: "domcontentloaded" });
    await page.fill("#station-top-q", "Aachen");
    // step 1: the search
    await Promise.all([page.waitForURL(/\/de\/station\?q=Aachen/, WAIT), page.press("#station-top-q", "Enter")]);
    const hit = page.locator("ul.stpage-list a", { hasText: "Aachen Hbf" });
    expect(await hit.count()).toBe(1);
    // step 2: the hit
    await Promise.all([page.waitForURL(new RegExp(`${stationPath("de", "aachen-hbf")}$`), WAIT), hit.click()]);
    expect(new URL(page.url()).pathname).toBe(stationPath("de", "aachen-hbf"));
    await ctx.close();
  });
});

describe("#1087 part 2: a dead digest", () => {
  it("the home answers 200 and the block is its error state, the search still there — never a missing block", async () => {
    dead = await startShell(DEAD_PORT, { DIGEST_URL: "http://127.0.0.1:1", WEB_TILE_TIMEOUT_MS: "500" });
    for (const lang of ["de", "en", "uk"] as const) {
      const r = await home(`http://127.0.0.1:${String(DEAD_PORT)}`, lang);
      expect(r.status, lang).toBe(200);
      const block = first(r.body, "section#station-top");
      expect(block?.attrs.class, lang).toBe("station-top is-error");
      expect(first(r.body, "#station-top form.station-top__search")!.attrs.action, lang).toBe(pathFor("stations", lang));
      expect(all(r.body, "#station-top a.sttop"), lang).toHaveLength(0);
    }
  });
});
