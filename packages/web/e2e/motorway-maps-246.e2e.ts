/**
 * 2.4.6 (owner, prod 2.4.5): the motorway page's maps in a real browser, against the BUILT shell and the real digest
 * (the fixture A7), with an EMULATED position — the owner's A4 near Aachen showed the main map as a bare blue line
 * under a legend of eight kinds, and an A4 page whose address named Dresden swapped to the visitor's IP town.
 *
 *  - a position with a standing grant: after the island's swap, both maps (the main map in the radius's frame, and
 *    the radius map) draw their marks with a width the browser renders, each legend keys exactly the kinds its map
 *    draws, and no in-page link of the page lands nowhere;
 *  - a place in the address (`?at=ags:…`) stays the block's place after the island settles, over an IP guess that
 *    lies elsewhere on the road, its marks unchanged.
 */
import { execFileSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { motorwayPath } from "../src/site/motorways.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8955;
const HERE = dirname(fileURLToPath(import.meta.url));
const GEO_DIR = mkdtempSync(join(tmpdir(), "vf-maps246-geo-"));
const GEO_FILE = join(GEO_DIR, "geoip.vfgeo");
/** A documentation range placed on the fixture A7's point 100 (the around suite's own IP rung). */
const A7_IP = "198.18.0.10";
const A7_ROW = "198.18.0.0,198.18.0.255,EU,DE,Niedersachsen,Probe,52.5512,9.4513\n";
const BASE = `http://127.0.0.1:${PORT}`;
const PERSON_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const ID = { IMPRESSUM_NAME: "Maps Probe", IMPRESSUM_STREET: "Probeweg 5", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "maps@example.invalid" };
/** On the fixture A7's line (its point 100). */
const ON = { latitude: 52.5512, longitude: 9.4513, accuracy: 20 };

let browser: Browser;
let shell: ChildProcess | undefined;
let digest: Awaited<ReturnType<typeof startRealDigest>>;

beforeAll(async () => {
  digest = await startRealDigest();
  const csv = A7_ROW + readFileSync(join(HERE, "..", "test", "fixtures", "geoip-fixture.csv"), "utf8");
  execFileSync(process.execPath, [join(HERE, "..", "..", "..", "scripts", "geoip-build.mjs"), "--release", "2026-10", "--out", GEO_FILE, "--min-de-ranges", "1"], { input: csv, encoding: "utf8" });
  shell = await startShell(PORT, { ...ID, DIGEST_URL: digest.url, VF_MOTORWAY_AROUND: "1", GEOIP_FILE: GEO_FILE });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
  rmSync(GEO_DIR, { recursive: true, force: true });
});

/** One map in the DOM, as the browser has it: each mark class with its points and its RENDERED width, the line's, the legend's keys. */
type MapState = { readonly marks: { cls: string; n: number; w: number; px: number }[]; readonly line: number; readonly keys: string[] };
const mapState = (page: Page, svgSel: string, legendSel: string): Promise<MapState> =>
  page.evaluate(
    ([svgSel, legendSel]) => {
      const svg = document.querySelector<SVGSVGElement>(svgSel);
      const out: { cls: string; n: number; w: number; px: number }[] = [];
      if (svg === null) return { marks: out, line: NaN, keys: [] };
      const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
      const re = /(?:^|\s)(mw-(?:closure|roadworks|jam|parking|charging|camera|weather)|mwa-(?:service|warning|dwd))(?:\s|$)/;
      for (const p of Array.from(svg.querySelectorAll("path"))) {
        const m = re.exec(p.getAttribute("class") ?? "");
        if (m === null) continue;
        const w = Number(getComputedStyle(p).strokeWidth.replace("px", ""));
        out.push({ cls: m[1]!, n: ((p.getAttribute("d") ?? "").match(/M/g) ?? []).length, w, px: w * scale });
      }
      const lineEl = svg.querySelector("path.mw-line");
      const line = lineEl === null ? NaN : Number(getComputedStyle(lineEl).strokeWidth.replace("px", ""));
      const keys = Array.from(document.querySelectorAll(`${legendSel} .mw-key`)).map((k) => Array.from(k.classList).find((c) => c.startsWith("mw-key--")) ?? "").filter((k) => !["mw-key--line", "mw-key--ahead", "mw-key--behind", "mw-key--amen"].includes(k));
      return { marks: out, line, keys };
    },
    [svgSel, legendSel] as const,
  );
const KEY: Readonly<Record<string, string>> = { "mw-closure": "mw-key--closure", "mw-roadworks": "mw-key--roadworks", "mw-jam": "mw-key--jam", "mw-parking": "mw-key--parking", "mw-charging": "mw-key--charging", "mw-camera": "mw-key--camera", "mw-weather": "mw-key--weather", "mwa-service": "mw-key--service", "mwa-warning": "mw-key--msg", "mwa-dwd": "mw-key--msg" };
const judge = (s: MapState, where: string): void => {
  expect(s.line, where).toBeGreaterThan(0);
  expect(s.marks.length, `${where}: marks drawn`).toBeGreaterThan(0);
  for (const m of s.marks) {
    expect(m.n, `${where} ${m.cls}`).toBeGreaterThan(0);
    expect(m.w, `${where} ${m.cls}`).toBeGreaterThanOrEqual(s.line);
    // at least two CSS pixels across on the page: a mark a person can see
    expect(m.px, `${where} ${m.cls} px`).toBeGreaterThanOrEqual(2);
  }
  expect(new Set(s.keys), where).toEqual(new Set(s.marks.map((m) => KEY[m.cls])));
};
/** Every `a[href^="#"]` in the live DOM whose target is not in it. */
const deadLinks = (page: Page): Promise<string[]> =>
  page.evaluate(() => Array.from(document.querySelectorAll('a[href^="#"]')).map((a) => a.getAttribute("href")!.slice(1)).filter((id) => id !== "" && document.getElementById(id) === null));

describe("the maps with a position (owner 2.4.6, the A4 near Aachen)", () => {
  for (const lang of ["en", "de"] as const) {
    it(`${lang}: after the swap, both maps draw visible marks keyed by their own legends, and no in-page link lands nowhere`, async () => {
      const ctx = await browser.newContext({ viewport: { width: 1000, height: 1000 }, userAgent: PERSON_UA, geolocation: ON, permissions: ["geolocation"] });
      const page = await ctx.newPage();
      await page.goto(`${BASE}${motorwayPath(lang, "A7")}`);
      await page.waitForFunction(() => document.querySelector("#motorway-around .mwa-pin") !== null && document.querySelector("#motorway-main .mwa-you") !== null);
      await page.waitForTimeout(300);
      // the main map is drawn in the radius's frame now: a box of tens of km, not the whole road's hundreds
      const vbW = await page.$eval("#motorway-main svg.motorway__svg", (s) => (s as SVGSVGElement).viewBox.baseVal.width);
      expect(vbW).toBeLessThan(100);
      judge(await mapState(page, "#motorway-main svg.motorway__svg", "#motorway-main ul.motorway__legend"), `${lang} main map`);
      judge(await mapState(page, "#motorway-around svg.mwa__svg", "#motorway-around ul.mwa__keys"), `${lang} radius map`);
      expect(await deadLinks(page)).toEqual([]);
      // and at the smallest radius too
      await page.click(".mwr__chip[value='5']");
      await page.waitForFunction(() => document.querySelector("#motorway-around .mwa__count")?.textContent?.match(/(^|[^0-9])5 km/) != null);
      await page.waitForTimeout(300);
      const main5 = await mapState(page, "#motorway-main svg.motorway__svg", "#motorway-main ul.motorway__legend");
      if (main5.marks.length > 0) judge(main5, `${lang} main map 5 km`);
      const around5 = await mapState(page, "#motorway-around svg.mwa__svg", "#motorway-around ul.mwa__keys");
      if (around5.marks.length > 0) judge(around5, `${lang} radius map 5 km`);
      expect(around5.line).toBeGreaterThan(0);
      expect(await deadLinks(page)).toEqual([]);
      await ctx.close();
    });
  }
});

describe("a place the address names is kept (owner 2.4.6, the A4 with ?at=ags:14612000)", () => {
  it("?at=ags:… on a visitor whose IP lies elsewhere on the road: the block is the address's place, chosen, and stays after the island settles", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 1000 }, userAgent: PERSON_UA, extraHTTPHeaders: { "X-Forwarded-For": A7_IP } });
    const page = await ctx.newPage();
    const posts: string[] = [];
    page.on("request", (r) => {
      if (r.url().endsWith("/fragment/motorway-around")) posts.push(r.postData() ?? "");
    });
    const res = await page.goto(`${BASE}${motorwayPath("en", "A7")}?at=ags:06611000`);
    const html = (await res?.text()) ?? "";
    expect(html).toContain('id="motorway-around"');
    // the server's block is not the IP rung's (that one says "approximate, from your network")
    expect(html).not.toContain("approximate, from your network");
    const before = await page.$$eval("#motorway-around path.mwa-mark", (ps) => ps.reduce((n, p) => n + ((p.getAttribute("d") ?? "").match(/M/g) ?? []).length, 0));
    const label = await page.textContent("#place-pill-label");
    await page.waitForTimeout(1_500);
    expect(posts, "the island asked for nothing on its own").toEqual([]);
    expect(await page.textContent("#place-pill-label")).toBe(label);
    const after = await page.$$eval("#motorway-around path.mwa-mark", (ps) => ps.reduce((n, p) => n + ((p.getAttribute("d") ?? "").match(/M/g) ?? []).length, 0));
    expect(after).toBe(before);
    expect(await deadLinks(page)).toEqual([]);
    await ctx.close();
  });
});
