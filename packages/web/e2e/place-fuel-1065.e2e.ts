/**
 * #1065 against the REAL built shell and the REAL digest renderer over the
 * fixture (no database, no network): a place page's HTML — and the home's
 * place block at the IP rung — carries the fuel card's frame with no price,
 * no station price row and no MTS-K figure, in de and en, with JavaScript on
 * or off; in a person's browser the prices appear in the same card with NO
 * click once the card is in view, and the MCP site door is asked once; a
 * crawler's browser gets the sentence. The MCP listener is a loopback stub
 * recording every refresh; nothing reaches a provider.
 */
import { execFileSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PLACE_FUEL_PATH } from "../src/lib/place-fuel.js";
import { all } from "@viafrei/design/testing";
import { LIVE_LANGS } from "../src/site/pages.js";
import { placePath } from "../src/site/places.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8853;
const BASE = `http://127.0.0.1:${String(PORT)}`;
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const NAV = { "user-agent": CHROME, "sec-fetch-mode": "navigate", "sec-fetch-dest": "document", "sec-fetch-site": "none", "sec-fetch-user": "?1", accept: "text/html" };
/** The fixture's Köln prices (de "1,619", en "1.619"), a station of the fuel card, the MTS-K note. */
const PRICE = /1[,.](?:619|679|739)/;
const FUEL_DATA = /€\/l|EUR\/l|MTS-K|Markttransparenzstelle|bft Tankstelle|Aral Köln/;

let browser: Browser;
let shell: ChildProcess;
let digest: Awaited<ReturnType<typeof startRealDigest>>;
let mcp: { url: string; refreshes: string[]; close(): Promise<void> };
let geoDir: string;

async function startMcp(): Promise<typeof mcp> {
  const refreshes: string[] = [];
  const server = createServer((req, res) => {
    if (req.method === "POST" && req.url === "/internal/fuel/refresh") {
      let body = "";
      req.on("data", (c: Buffer) => (body += c.toString("utf8")));
      req.on("end", () => {
        refreshes.push(body);
        res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ state: "refreshed", settledAt: Date.now(), reused: false }));
      });
      return;
    }
    res.writeHead(404, { "content-type": "application/json" }).end("{}");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  return { url: `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`, refreshes, close: () => new Promise<void>((r) => server.close(() => r())) };
}

/** The fuel card's article out of a page. */
const fuelCard = (html: string): string => /<article class="pcard[^"]*" id="pcard-fuel"[\s\S]*?<\/article>/.exec(html)?.[0] ?? "";

beforeAll(async () => {
  digest = await startRealDigest();
  mcp = await startMcp();
  geoDir = mkdtempSync(join(tmpdir(), "vf-1065-geo-"));
  const here = fileURLToPath(new URL(".", import.meta.url));
  execFileSync("node", [join(here, "..", "..", "..", "scripts", "geoip-build.mjs"), "--release", "2026-10", "--out", join(geoDir, "geoip.vfgeo"), "--min-de-ranges", "1"], { input: readFileSync(join(here, "..", "test", "fixtures", "geoip-fixture.csv")), stdio: ["pipe", "ignore", "inherit"] });
  shell = await startShell(PORT, { DIGEST_URL: digest.url, MCP_INTERNAL_URL: mcp.url, FUEL_REFRESH_URL: mcp.url, GEOIP_FILE: join(geoDir, "geoip.vfgeo"), WEB_TILE_TIMEOUT_MS: "2000" });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
  await mcp?.close();
  if (geoDir) rmSync(geoDir, { recursive: true, force: true });
});
beforeEach(() => {
  mcp.refreshes.length = 0;
});

describe("#1065: the place page's HTML holds no fuel price", () => {
  for (const lang of ["de", "en"] as const) {
    for (const [who, h] of [["a person's navigation", NAV], ["GPTBot", { "user-agent": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)" }]] as const) {
      it(`/${lang}/place/koeln, ${who}: the fuel card's frame and heading, no price, no station row, no MTS-K line`, async () => {
        const res = await fetch(`${BASE}/${lang}/place/koeln`, { headers: h });
        expect(res.status).toBe(200);
        const html = await res.text();
        const card = fuelCard(html);
        expect(all(card, ".pcard__fuelslot").length, "the fuel card is framed").toBe(1);
        expect(card).toMatch(/<h3 class="pcard__title"/);
        expect(html).not.toMatch(PRICE);
        expect(html).not.toMatch(FUEL_DATA);
        expect(html, "no fill marker on the cards").not.toMatch(/<div class="place-fill" data-vf-fill=/);
      });
    }
    it(`/${lang} with a location (the home's IP rung): the place block's fuel card is deferred too`, async () => {
      const html = await (await fetch(`${BASE}/${lang}`, { headers: { ...NAV, "x-forwarded-for": "192.0.2.77" } })).text();
      // the place block (the home's own Germany-wide fuel TILE is not this issue's)
      const block = /<section class="place" id="place-cards"[\s\S]*?<\/section>/.exec(html)?.[0] ?? "";
      expect(block).not.toBe("");
      expect(all(fuelCard(block), ".pcard__fuelslot").length).toBe(1);
      expect(block).not.toMatch(PRICE);
      expect(block).not.toMatch(FUEL_DATA);
    });
  }
  it("the document renders asked nothing", () => {
    expect(mcp.refreshes).toEqual([]);
  });
});

// Owner 2026-10-27: a station page's area carries the city page's fuel card (#1084) — "users see the fuel, agents and
// crawlers - no", the same deferral as the place and motorway pages.
describe("#1084 + #1065: the station page's HTML holds no fuel price either", () => {
  for (const lang of ["de", "en"] as const) {
    for (const [who, h] of [["a person's navigation", NAV], ["GPTBot", { "user-agent": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)" }], ["ClaudeBot", { "user-agent": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0)" }]] as const) {
      it(`/${lang}/station/koeln-hbf, ${who}: the fuel card's frame, no price, no station row, no MTS-K line`, async () => {
        const res = await fetch(`${BASE}/${lang}/station/koeln-hbf`, { headers: h });
        expect(res.status).toBe(200);
        const html = await res.text();
        expect(all(fuelCard(html), ".pcard__fuelslot").length, "the fuel card is framed").toBe(1);
        expect(html).not.toMatch(PRICE);
        expect(html).not.toMatch(FUEL_DATA);
      });
    }
  }
  it("a crawler's browser (JavaScript on) on a station page: the sentence, no price, nothing asked", async () => {
    const ctx = await browser.newContext({ userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/en/station/koeln-hbf`, { waitUntil: "networkidle" });
    // the slot, not the card: the grid stretches a station's fuel card to its row (beside the long transport card), so
    // centring the CARD leaves its slot above the window; a person scrolling down passes the slot.
    await page.locator("#pcard-fuel .pcard__fuelslot").scrollIntoViewIfNeeded();
    await page.waitForSelector("#pcard-fuel .pcard__fuelout .place-fuel", { timeout: 2_000 });
    expect(await page.locator("#pcard-fuel .pcard__fuelout").textContent()).toBe("The prices are shown only to a person viewing this page.");
    expect(await page.content()).not.toMatch(PRICE);
    await ctx.close();
    expect(mcp.refreshes).toEqual([]);
  });
  it("a person's view of a station page: the prices fill the card once it is in view", async () => {
    const ctx = await browser.newContext({ userAgent: CHROME });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/de/station/koeln-hbf`, { waitUntil: "networkidle" });
    // the slot, not the card: the grid stretches a station's fuel card to its row (beside the long transport card), so
    // centring the CARD leaves its slot above the window; a person scrolling down passes the slot.
    await page.locator("#pcard-fuel .pcard__fuelslot").scrollIntoViewIfNeeded();
    await page.waitForSelector("#pcard-fuel .pcard__fuelout .place-fuel", { timeout: 2_000 });
    expect(await page.locator("#pcard-fuel .pcard__fuelout").innerHTML()).toMatch(PRICE);
    await ctx.close();
  });
});

describe("#1065: a person's view shows the prices with no click", () => {
  it("the card in view: the prices fill the same card, the site door is asked once — and nothing was asked before it came into view", async () => {
    const ctx = await browser.newContext({ userAgent: CHROME, viewport: { width: 400, height: 300 } });
    const page = await ctx.newPage();
    const asked: string[] = [];
    page.on("request", (q) => {
      if (q.url().includes(PLACE_FUEL_PATH)) asked.push(q.url());
    });
    await page.goto(`${BASE}/de/place/koeln`, { waitUntil: "networkidle" });
    // below the fold of a small window: no fragment yet
    expect(await page.locator("#pcard-fuel").isVisible()).toBe(true);
    const at = await page.locator("#pcard-fuel .pcard__fuelslot").evaluate((e) => ({ top: Math.round(e.getBoundingClientRect().top), scrollY: Math.round(window.scrollY), h: window.innerHeight }));
    expect(at.top < at.h, `the fuel card starts below the fold of a 400×300 window: ${JSON.stringify(at)}`).toBe(false);
    expect(asked, "nothing is asked for a card not yet in view").toEqual([]);
    expect(mcp.refreshes).toEqual([]);
    await page.locator("#pcard-fuel .pcard__fuelslot").scrollIntoViewIfNeeded();
    await page.waitForSelector("#pcard-fuel .pcard__fuelout .place-fuel", { timeout: 10_000 });
    const out = (await page.locator("#pcard-fuel .pcard__fuelout").innerHTML()) ?? "";
    expect(out).toMatch(PRICE);
    expect(out).toContain("MTS-K");
    expect(await page.locator("#pcard-fuel .pcard__fueljs").isHidden()).toBe(true);
    expect(asked).toHaveLength(1);
    expect(asked[0]).toContain(`${PLACE_FUEL_PATH}?place=koeln&lang=de`);
    expect(mcp.refreshes).toHaveLength(1);
    expect(mcp.refreshes[0]).toBe(JSON.stringify({ at: "ags:05315000" }));
    await ctx.close();
  });

  it("JavaScript off: the sentence that prices need JavaScript, and no price", async () => {
    const ctx = await browser.newContext({ userAgent: CHROME, javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/en/place/koeln`, { waitUntil: "networkidle" });
    expect(await page.locator("#pcard-fuel .pcard__fueljs").textContent()).toBe("Loading the prices needs JavaScript on this page.");
    expect(await page.content()).not.toMatch(PRICE);
    await ctx.close();
    expect(mcp.refreshes).toEqual([]);
  });

  it("a crawler's browser (JavaScript on): the card says the prices are for a person viewing the page, nothing is asked", async () => {
    const ctx = await browser.newContext({ userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/en/place/koeln`, { waitUntil: "networkidle" });
    await page.locator("#pcard-fuel .pcard__fuelslot").scrollIntoViewIfNeeded();
    await page.waitForSelector("#pcard-fuel .pcard__fuelout .place-fuel", { timeout: 10_000 });
    expect(await page.locator("#pcard-fuel .pcard__fuelout").textContent()).toBe("The prices are shown only to a person viewing this page.");
    expect(await page.content()).not.toMatch(PRICE);
    await ctx.close();
    expect(mcp.refreshes).toEqual([]);
  });

  it("the fragment asked from another site, as a HEAD or as a prefetch: the sentence, no data", async () => {
    const url = `${BASE}${PLACE_FUEL_PATH}?place=koeln&lang=en`;
    const fetchy = { "user-agent": CHROME, "sec-fetch-mode": "cors", "sec-fetch-dest": "empty" };
    for (const h of [{ ...fetchy, "sec-fetch-site": "cross-site" }, { ...fetchy, "sec-fetch-site": "same-origin", "sec-purpose": "prefetch" }]) {
      const r = await fetch(url, { headers: h });
      expect(r.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive, nosnippet");
      expect(r.headers.get("cache-control")).toBe("private, no-store");
      const body = await r.text();
      expect(body).toContain("The prices are shown only to a person viewing this page.");
      expect(body).not.toMatch(PRICE);
    }
    const head = await fetch(url, { method: "HEAD", headers: { ...fetchy, "sec-fetch-site": "same-origin" } });
    expect(head.headers.get("cache-control")).toBe("private, no-store");
    expect(mcp.refreshes).toEqual([]);
  });
});

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Each language's price-time words ("Preis von {t}", "prix de {t}", "{t} fiyatı" …), read from the digest's own packs. */
const L10N = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "digest", "src", "presentation", "l10n");
const priceTimeWords = (lang: string): string => {
  const m = /"fuel\.board\.seen":\s*"([^"]+)"/.exec(readFileSync(join(L10N, `${lang}.ts`), "utf8"));
  if (m === null) throw new Error(`no fuel.board.seen in ${lang}.ts`);
  return m[1]!;
};
const stationCountWords = (lang: string): string => {
  const m = /"fuel\.sample":\s*"([^"]+)"/.exec(readFileSync(join(L10N, `${lang}.ts`), "utf8"));
  if (m === null) throw new Error(`no fuel.sample in ${lang}.ts`);
  return m[1]!;
};
/**
 * A template's words with its `{n}`/`{t}` as a number, for a case-blind search of the page — at the start of a text
 * node or after a separator, as the fuel card and tile print it ("· Preis von 11:55", ">312 Tankstellen"), so a
 * sentence of another card that merely contains the word ("Вне станций: 2 велосипеда", shared bikes) is not one.
 */
const templateRe = (tpl: string, slot: string): RegExp => new RegExp(`(?:^|>|·)\\s*${tpl.split(slot).map((w) => escapeRe(w)).join("\\d[\\d\\s.,:]*")}`, "i");
/** The fixture's Tankerkönig stations near Köln: names, brands, streets, postcodes. */
const STATION = /bft Tankstelle|Aral Köln|Köln-Ehrenfeld|Vogelsanger|Innere Kanalstr|50827|50823|\bbft\b|\bARAL\b/;
const FIGURE = /\b[12][.,]\d{3}\s*(?:€|EUR)|€\/l|EUR\/l|tankerk|MTS-K|Markttransparenzstelle|Verbraucherinformation/i;
/** The head's crawlable text: the title, every meta content, every JSON-LD block. */
const headParts = (html: string): string[] => [
  ...[...html.matchAll(/<title>([\s\S]*?)<\/title>/g)].map((m) => m[1]!),
  ...[...html.matchAll(/<meta\b[^>]*\bcontent="([^"]*)"/g)].map((m) => m[1]!),
  ...[...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]!),
];

describe("#1065 steward C3: no place page, in any live language, carries a fuel datum — body, title, meta/OG or JSON-LD", () => {
  it("the fixture would leak if the gate did not hold: a person's fragment carries the prices, a station and the MTS-K note", async () => {
    const r = await fetch(`${BASE}${PLACE_FUEL_PATH}?place=koeln&lang=de`, { headers: { "user-agent": CHROME, "sec-fetch-site": "same-origin", "sec-fetch-mode": "cors", "sec-fetch-dest": "empty" } });
    const body = await r.text();
    expect(body).toMatch(PRICE);
    expect(body).toMatch(STATION);
    expect(body).toMatch(FIGURE);
    expect(body).toMatch(templateRe(priceTimeWords("de"), "{t}"));
  });

  for (const lang of LIVE_LANGS) {
    it(`${placePath(lang, "koeln")}: no Tankerkönig string, MTS-K note, price, station, price time or station count`, async () => {
      for (const h of [NAV, { "user-agent": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)" }]) {
        const res = await fetch(`${BASE}${placePath(lang, "koeln")}`, { headers: h });
        expect(res.status, lang).toBe(200);
        const html = await res.text();
        const card = fuelCard(html);
        expect(all(card, ".pcard__fuelslot").length, `${lang}: the fuel card is framed`).toBe(1);
        // #1088: the card's place chip ("Köln · 5,0 km") names the place and the radius — a distance, not a fuel figure.
        const chip = /<a class="pcard__at"[\s\S]*?<\/a>/.exec(card)?.[0] ?? "";
        expect(chip.replace(/<[^>]+>/g, ""), `${lang}: the place chip`).toMatch(/^Köln · \d+[.,]\d km$/u);
        expect(card.replace(chip, "").replace(/<[^>]+>/g, ""), `${lang}: the fuel card holds no figure`).not.toMatch(/\d/);
        expect(html, lang).not.toMatch(PRICE);
        expect(html, lang).not.toMatch(FIGURE);
        expect(html, lang).not.toMatch(STATION);
        expect(html, `${lang}: the price-time words`).not.toMatch(templateRe(priceTimeWords(lang), "{t}"));
        expect(html, `${lang}: a fuel station count`).not.toMatch(templateRe(stationCountWords(lang), "{n}"));
        const head = headParts(html);
        expect(head.length, `${lang}: the head was read`).toBeGreaterThan(3);
        for (const part of head) {
          expect(part, lang).not.toMatch(PRICE);
          expect(part, lang).not.toMatch(FIGURE);
          expect(part, lang).not.toMatch(STATION);
        }
      }
      expect(mcp.refreshes, `${lang}: the document renders asked nothing`).toEqual([]);
    });
  }
});

/**
 * #1116 AC4 in a person's browser: the grade switch above the fuel rows puts the chosen grade's column first (the sort
 * of the stations by it is `place-tiles.test.ts`'s, over a fixture of several stations — the shell's fixture holds one
 * priced station near Köln), keeps the choice on the device only after the click, never on load, and the next visit
 * asks with it. Every grade is a 44 px target.
 */
describe("#1116 AC4: the fuel grade switch in a person's browser", () => {
  it("nothing stored on load; a click leads every table with the grade and stores it; the next visit reads it", async () => {
    const ctx = await browser.newContext({ userAgent: CHROME });
    const page = await ctx.newPage();
    const asked: string[] = [];
    page.on("request", (q) => {
      if (q.url().includes(PLACE_FUEL_PATH)) asked.push(q.url());
    });
    const heads = (): Promise<string[][]> => page.locator("#pcard-fuel table.fuelst").evaluateAll((ts) => ts.map((t) => [...t.querySelectorAll("thead th")].map((th) => th.textContent ?? "")));
    await page.goto(`${BASE}/de/place/koeln`, { waitUntil: "networkidle" });
    await page.locator("#pcard-fuel .pcard__fuelslot").scrollIntoViewIfNeeded();
    await page.waitForSelector("#pcard-fuel .fuelg__opt", { timeout: 2_000 });
    expect(await page.evaluate(() => localStorage.getItem("viafrei.fuelgrade")), "nothing stored on load").toBeNull();
    expect(asked).toHaveLength(1);
    expect(asked[0]).not.toContain("grade=");
    expect(await heads()).toEqual([["Super E5", "Super E10", "Diesel"]]);
    expect(await page.locator("#pcard-fuel .fuelg__opt").evaluateAll((bs) => bs.map((b) => [(b as HTMLButtonElement).value, b.getAttribute("aria-pressed")]))).toEqual([
      ["e5", "false"],
      ["e10", "false"],
      ["diesel", "false"],
    ]);
    for (const [w, h] of await page.locator("#pcard-fuel .fuelg__opt").evaluateAll((bs) => bs.map((b) => b.getBoundingClientRect()).map((r) => [r.width, r.height]))) {
      expect(w, "a grade's width").toBeGreaterThanOrEqual(44);
      expect(h, "a grade's height").toBeGreaterThanOrEqual(44);
    }

    await page.locator('#pcard-fuel .fuelg__opt[value="diesel"]').click();
    await page.waitForSelector('#pcard-fuel .fuelg__opt[value="diesel"][aria-pressed="true"]', { timeout: 2_000 });
    expect(asked.at(-1)).toContain("grade=diesel");
    expect(await heads()).toEqual([["Diesel", "Super E5", "Super E10"]]);
    expect(await page.evaluate(() => localStorage.getItem("viafrei.fuelgrade")), "stored after the click").toBe("diesel");

    const before = asked.length;
    await page.goto(`${BASE}/de/place/koeln`, { waitUntil: "networkidle" });
    await page.locator("#pcard-fuel .pcard__fuelslot").scrollIntoViewIfNeeded();
    await page.waitForSelector('#pcard-fuel .fuelg__opt[value="diesel"][aria-pressed="true"]', { timeout: 2_000 });
    expect(asked.slice(before).every((u) => u.includes("grade=diesel"))).toBe(true);
    expect(await heads()).toEqual([["Diesel", "Super E5", "Super E10"]]);
    await ctx.close();
  });
});
