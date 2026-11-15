/**
 * #1188 AC 1, against the REAL built shell and the REAL digest: every object page — a station's (Köln Hbf), a charging
 * site's and a fuel station's (the Autohof Kitzingen of `energy-autohof.ts`), a motorway exit's (the planted A4's AS
 * Köln-Lövenich: what happens there in both directions) — shows the object first, then "In der Nähe": the ONE around block (`[data-vf-around]`, `components/AroundBlock.astro`) holding the cards' region
 * (`section#place-cards[aria-labelledby=place-title]`) headed by its `h2`, in German and in English. A crawler's copy of
 * the fuel page carries no price and no station name in its block (#1167). Measured in the Linux image only.
 *
 * The source halves are `packages/digest/src/server/object-area-1188.test.ts` (the cards, the object left out, the
 * #1184 refusal) and `packages/web/test/around-block-1188.test.ts` (the fetch, the one component).
 */
import type { ChildProcess } from "node:child_process";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { stationPath } from "../src/site/stations.js";
import { energyPath } from "../src/site/energy.js";
import { AUTOHOF_CHARGING_SLUG, AUTOHOF_FUEL_SLUG } from "./energy-autohof.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8941;
const BASE = `http://127.0.0.1:${String(PORT)}`;
const BOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
let browser: Browser;
let shell: ChildProcess;
let digest: Awaited<ReturnType<typeof startRealDigest>>;

beforeAll(async () => {
  digest = await startRealDigest({ energy: "autohof" });
  shell = await startShell(PORT, { DIGEST_URL: digest.url, WEB_TILE_TIMEOUT_MS: "2000" });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
});

/** The planted A4's AS Köln-Lövenich, as the motorway page links it (the slug is the register's, never typed here). */
const exitPath = async (l: "de" | "en"): Promise<string> => {
  const html = await (await fetch(`${BASE}/${l}/autobahn/a4`)).text();
  const seg = /href="(?:\/[a-z]{2}\/autobahn\/)?a4\/(exit-8-[a-z0-9-]+)"/u.exec(html)?.[1];
  if (seg === undefined) throw new Error(`no AS Köln-Lövenich link on /${l}/autobahn/a4`);
  return `/${l}/autobahn/a4/${seg}`;
};
const PAGES = [
  { kind: "station", object: "#station", town: "Köln", path: (l: "de" | "en") => Promise.resolve(stationPath(l, "koeln-hbf")) },
  { kind: "charging", object: "#energypage", town: "Kitzingen", path: (l: "de" | "en") => Promise.resolve(energyPath("charging", l, AUTOHOF_CHARGING_SLUG)) },
  { kind: "fuel", object: "#energypage", town: "Kitzingen", path: (l: "de" | "en") => Promise.resolve(energyPath("fuel", l, AUTOHOF_FUEL_SLUG)) },
  // the junction itself is the page's first block: its two directions (`#exit-ways`, #1182 part 1)
  { kind: "exit", object: "#exit-ways", town: "Köln", path: exitPath },
] as const;

describe("#1188 AC 1: the object first, then the one around block", () => {
  for (const p of PAGES)
    for (const lang of ["de", "en"] as const)
      it(`${p.kind} (${lang}): the object section, then [data-vf-around] with the cards' region and its heading`, async () => {
        const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
        ctx.setDefaultTimeout(2_000);
        const page = await ctx.newPage();
        const res = await page.goto(`${BASE}${await p.path(lang)}`, { waitUntil: "domcontentloaded" });
        expect(res?.status()).toBe(200);
        const order = await page.evaluate((sel) => {
          const obj = document.querySelector(sel);
          const around = document.querySelectorAll("[data-vf-around]");
          const block = around[0] ?? null;
          const region = block?.querySelector('section#place-cards[aria-labelledby="place-title"]') ?? null;
          const h2 = region?.querySelector("h2#place-title") ?? null;
          return {
            ways: document.querySelectorAll("#exit-ways .exitways__way").length,
            dupIds: (() => { const n = new Map<string, number>(); document.querySelectorAll("[id]").forEach((e) => n.set(e.id, (n.get(e.id) ?? 0) + 1)); return [...n].filter(([, c]) => c > 1).map(([i]) => i); })(),
            object: obj !== null,
            blocks: around.length,
            after: obj !== null && block !== null && (obj.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
            region: region !== null,
            heading: h2?.textContent?.trim() ?? "",
          };
        }, p.object);
        expect(order.object).toBe(true);
        expect(order.blocks).toBe(1);
        expect(order.after).toBe(true);
        expect(order.region).toBe(true);
        expect(order.heading.length).toBeGreaterThan(0);
        // the block names the object's own town (the planted world names Kitzingen honestly, not Köln)
        expect(order.heading).toContain(p.town);
        if (p.kind === "exit") {
          expect(order.ways, "both directions at the junction").toBe(2);
          // where the visitor's own around block (#890) stands beside the junction's, each keeps its own ids
          expect(order.dupIds).toEqual([]);
        }
        await ctx.close();
      });

  it("a crawler's fuel, charging and exit pages: the block's fuel card is its frame — no price, no station named in it", async () => {
    for (const path of [energyPath("fuel", "de", AUTOHOF_FUEL_SLUG), energyPath("charging", "de", AUTOHOF_CHARGING_SLUG), await exitPath("de")]) {
      const html = await (await fetch(`${BASE}${path}`, { headers: { "user-agent": BOT } })).text();
      const block = html.slice(html.indexOf("data-vf-around"));
      expect(block.length, path).toBeGreaterThan(100);
      // no price anywhere in the block (the page's own prices are its person-gated slot, #1065)
      expect(block, path).not.toMatch(/\d[,.]\d{2,3}\s*(?:<sup>\d<\/sup>)?\s*€/u);
      const fuel = /<article[^>]*id="pcard-fuel"[\s\S]*?<\/article>/.exec(block)?.[0] ?? "";
      expect(fuel, path).toContain("pcard__fuelslot");
      expect(fuel, path).not.toMatch(/Tankerk|<li/u);
    }
  });
});
