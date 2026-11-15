/**
 * #891 (data-steward ruling 2026-10-21, O9 and K1–K6): the motorway page's parking list names what OpenStreetMap
 * holds near each site (the motorway wording, 300 m, "Erreichbarkeit nicht geprüft"), with the OpenStreetMap line
 * and the § 4.6 offer after the list; the map rings a drawn site whose OWN publisher states a present amenity,
 * labelled in human text, and draws nothing of OpenStreetMap. Driven against the BUILT shell and the REAL digest
 * (`real-motorway.ts`: every sixth Autobahn GmbH row states a WC, a restaurant and its fuel station, every tenth a
 * "kein WC"; every fourth asked row has a café 170 m and a WC 90 m off in OpenStreetMap).
 */
import type { ChildProcess } from "node:child_process";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { motorwayPath } from "../src/site/motorways.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8841;
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

const get = async (path: string): Promise<string> => {
  const r = await fetch(`${BASE}${path}`);
  expect(r.status, path).toBe(200);
  return r.text();
};
const svgOf = (html: string): string => {
  const at = html.indexOf('<svg class="motorway__svg"');
  return at < 0 ? "" : html.slice(at, html.indexOf("</svg>", at) + 6);
};
// #901: the parking block is a card since 2.3.11 (`<section class="pcard mwk" id="mwk-parking">`)
const parkingOf = (html: string): string => {
  const at = html.search(/<section class="pcard mwk[^"]*" id="mwk-parking"/u);
  return at < 0 ? "" : html.slice(at, html.indexOf("</section>", at));
};

describe("the motorway page: amenities near each site in the list, the publisher's on the map (#891)", () => {
  for (const [lang, stated, nearWords, legend] of [
    ["de", "Ausstattung laut Herausgeber: WC · Restaurant · Tankstelle", "In der Nähe laut OpenStreetMap (Luftlinie, Erreichbarkeit nicht geprüft): ", "Ausstattung laut Herausgeber"],
    ["en", "Facilities per the publisher: toilet · restaurant · fuel station", "Nearby per OpenStreetMap (straight line, access not checked): ", "Facilities per the publisher"],
  ] as const) {
    it(`${motorwayPath(lang, "A7")}: K1–K6 — a ring per stating site with its words, a legend entry, nothing of OpenStreetMap or Tankerkönig in the SVG`, async () => {
      const html = await get(motorwayPath(lang, "A7"));
      const svg = svgOf(html);
      const titles = [...svg.matchAll(/<path class="mw-amen" d="M[\d.-]+ [\d.-]+h0" stroke-width="[\d.]+"><title>([^<]+)<\/title><\/path>/gu)].map((m) => m[1] ?? "");
      expect(titles.length, lang).toBeGreaterThan(0);
      // #901 D6 plants more stating sites (a shower, a charger): each ring says what its own publisher states
      for (const t of titles) expect(t, lang).toContain(`${legend}:`);
      expect(titles.some((t) => t.includes(stated)), lang).toBe(true);
      // K3: a "kein WC" is never a mark; K5: no data-*; K2: nothing from OpenStreetMap
      expect(svg, lang).not.toMatch(/kein WC|no toilet|data-|Café Rastblick|openstreetmap|OpenStreetMap|In der Nähe|Nearby/u);
      expect(svg, lang).not.toMatch(/tankerk|MTS-K/iu);
      expect(html, lang).toContain(`<span class="mw-key mw-key--amen" aria-hidden="true"></span>${legend}</li>`);
      // K4: the list beside the map says the same words for the same sites
      const parking = parkingOf(html);
      expect(parking, lang).toContain(stated);
    });

    it(`${motorwayPath(lang, "A7")}: O9 — the list names OpenStreetMap's café 170 m under the publisher's line, never its WC where the publisher states one; the OpenStreetMap line and the offer follow`, async () => {
      const parking = parkingOf(await get(motorwayPath(lang, "A7")));
      const near = [...parking.matchAll(/<span class="pcard__sub pcard__near">([\s\S]*?)<\/span>/gu)].map((m) => (m[1] ?? "").replace(/<[^>]+>/gu, ""));
      expect(near.length, lang).toBeGreaterThan(0);
      for (const n of near) expect(n.startsWith(nearWords), `${lang}: ${n}`).toBe(true);
      expect(near.some((n) => n.includes(lang === "de" ? "Café 170 m" : "café 170 m")), lang).toBe(true);
      // a site whose publisher states a WC never repeats OpenStreetMap's WC (O8)
      // one row each: a row carries its anchor since 2.4.8 (`<li id="mw-pk0">`, #1085 AC 2), so the split is on the tag
      const stating = parking.split(/<li(?=[\s>])/u).filter((x) => x.includes(stated));
      expect(stating.length, lang).toBeGreaterThan(0);
      for (const li of stating) expect(li.split("</li>")[0], lang).not.toMatch(/pcard__near[^]*>(WC|toilet) 90 m/u);
      expect(parking, lang).toMatch(/<div class="pcard__nearsrc">[\s\S]*openstreetmap\.org\/copyright[\s\S]*ODbL 1\.0/u);
      // no publisher chip from OpenStreetMap: a café chip there exists only if a publisher states a café, and none does
      // here (#901 D7 offers OpenStreetMap's café in a group of its own)
      expect(/<fieldset class="chips amchips">[\s\S]*?<\/fieldset>/u.exec(parking)?.[0] ?? "", lang).not.toContain('value="cafe"');
    });
  }

  it("the ring is drawn in the browser, under the site's dot, and its label is the tooltip text", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}${motorwayPath("de", "A7")}`, { waitUntil: "networkidle" });
    const ring = page.locator("svg.motorway__svg path.mw-amen", { has: page.locator("title", { hasText: "WC · Restaurant · Tankstelle" }) }).first();
    expect(await ring.count()).toBe(1);
    const box = await ring.boundingBox();
    expect(box !== null && box.width > 0).toBe(true);
    expect((await ring.locator("title").textContent()) ?? "").toContain("Ausstattung laut Herausgeber: WC · Restaurant · Tankstelle");
    const order = await page.locator("svg.motorway__svg > g#mw-map-g > path").evaluateAll((els) => els.map((e) => e.getAttribute("class")));
    expect(order.indexOf("mw-amen")).toBeLessThan(order.indexOf("mw-parking"));
    await ctx.close();
  });
});
