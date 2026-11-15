/**
 * #1043 (station pages (c)) against the REAL built shell and the REAL digest, in a real browser: a U-Bahn station
 * (Berlin U Hermannplatz), a Köln Stadtbahn station (Neumarkt) and an interchange (Köln Hbf) each have a page that
 * says what serves it — the pictograms in the page's language — the U-Bahn's board paints the U7 in the timetable's
 * line colour and says which row is the plan, the Stadtbahn station lists KVB's lifts and escalators by their number
 * with KVB's credit, and the two new pages are in the stations index and the language's station sitemap.
 */
import type { ChildProcess } from "node:child_process";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { stationPath } from "../src/site/stations.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 9001;
const BASE = `http://127.0.0.1:${String(PORT)}`;
let browser: Browser;
let shell: ChildProcess;
let digest: Awaited<ReturnType<typeof startRealDigest>>;

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

const open = async (lang: "de" | "en", slug: string): Promise<Page> => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  ctx.setDefaultTimeout(2000);
  const page = await ctx.newPage();
  const r = await page.goto(`${BASE}${stationPath(lang, slug)}`, { waitUntil: "networkidle" });
  expect(r?.status(), slug).toBe(200);
  return page;
};
const served = (page: Page): Promise<{ mode: string | null; text: string }[]> =>
  page.locator("p.stlive__served span.pcard__badge").evaluateAll((els) => els.map((e) => ({ mode: e.getAttribute("data-mode"), text: (e.textContent ?? "").trim() })));

const WORDS = {
  de: { lead: "Hier fahren", subway: "U-Bahn", bus: "Bus", tram: "Straßenbahn", train: "Zug" },
  en: { lead: "Served by", subway: "U-Bahn", bus: "Bus", tram: "Tram", train: "Train" },
} as const;

describe("#1043 each kind of station says what serves it, in the page's language", () => {
  for (const lang of ["de", "en"] as const) {
    it(`${lang}: the U-Bahn station — U-Bahn and bus, no train; the interchange — train, tram, bus; the Stadtbahn — tram`, async () => {
      const w = WORDS[lang];
      const herm = await open(lang, "berlin-u-hermannplatz");
      expect(await herm.locator("h1").textContent()).toContain("Hermannplatz");
      expect((await herm.locator("p.stlive__served strong").textContent())?.trim()).toBe(w.lead);
      expect(await served(herm)).toEqual([
        { mode: "subway", text: w.subway },
        { mode: "bus", text: w.bus },
      ]);
      await herm.context().close();
      const hbf = await open(lang, "koeln-hbf");
      expect((await served(hbf)).map((b) => b.mode)).toEqual(["long", "tram", "bus"]);
      expect((await served(hbf))[0]?.text).toBe(w.train);
      await hbf.context().close();
      const neu = await open(lang, "koeln-neumarkt");
      expect(await served(neu)).toEqual([{ mode: "tram", text: w.tram }]);
      await neu.context().close();
    });
  }
});

describe("#1043 the U-Bahn's board: the line's own colour, and the plan said as the plan", () => {
  it("both U7 rows carry BVG's colour as the badge's fill; with no live feed for them each row is the timetable's", async () => {
    const page = await open("de", "berlin-u-hermannplatz");
    const board = page.locator("#pcard-station-board");
    expect(await board.locator('rect[fill="#0065ae"]').count()).toBe(2);
    expect(await board.locator("span.pcard__badge--own").count()).toBe(2);
    expect(await board.locator("span.pcard__state--timetable").count()).toBe(2);
    expect(await board.textContent()).toContain("Rathaus Spandau");
    await page.context().close();
  });
});

describe("#1043 the Köln Stadtbahn station lists KVB's lifts and escalators", () => {
  for (const lang of ["de", "en"] as const) {
    it(`${lang}: both units by their number, KVB credited, KVB's description never shown`, async () => {
      const page = await open(lang, "koeln-neumarkt");
      const lifts = (await page.locator("#pcard-station-lifts").textContent()) ?? "";
      expect(lifts).toContain("011-01");
      expect(lifts).toContain("011-51");
      expect(lifts).toContain("Kölner Verkehrs-Betriebe");
      expect(lifts).not.toContain("Schildergasse");
      expect(lifts).not.toContain("Zwischenebene");
      await page.context().close();
    });
  }
});

describe("#1043 the new pages are found: the stations index and the station sitemap", () => {
  it("the index links both, and the German station sitemap lists both", async () => {
    // the index's Land lists (Berlin 11, Nordrhein-Westfalen 05) and its search
    for (const [query, slug] of [["land=11", "berlin-u-hermannplatz"], ["land=05", "koeln-neumarkt"], ["q=Hermannplatz", "berlin-u-hermannplatz"]] as const) {
      const index = await (await fetch(`${BASE}/de/station?${query}`)).text();
      expect(index.includes(`href="${stationPath("de", slug)}"`), query).toBe(true);
    }
    const map = await (await fetch(`${BASE}/sitemap-stations-de.xml`)).text();
    for (const slug of ["berlin-u-hermannplatz", "koeln-neumarkt"]) expect(map.includes(`https://viafrei.de${stationPath("de", slug)}`), slug).toBe(true);
  });
});
