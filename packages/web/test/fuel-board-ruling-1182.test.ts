/**
 * The data steward's ruling of 2026-11-08 on #1182 (B1–B6): the fuel index's per-Land board may keep its prices in
 * the HTML, on conditions — the place block is no provider request (B1), the C2 disclosure sits directly before the
 * board under a visible heading (B2), a declared automation client, corpus crawler or SEO tool gets no board (B3), the
 * public "not for crawlers" sentence is true (B5, in `discovery.test.ts`), and nothing new about personal data (B6).
 *
 * The board is a planted fragment that DOES carry a price, a station and the Tankerkönig credit — what a withheld
 * board must not let through. The digest is a stub; nothing here reaches a provider or the network.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { all, classesOf, text } from "@viafrei/design/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import { boardWithheld, fuelBoardSectionHtml, fuelCitiesHtml, fuelHereHtml, fuelHereOf, isBoard } from "../src/lib/fuel-index.js";
import { AI_ASSISTANTS, AUTOMATION_AGENTS, CORPUS_CRAWLERS, SEO_CRAWLERS, isAutomationAgent } from "../src/site/crawlers.js";
import type { FetchLike } from "../src/lib/tiles.js";
import type { GeoIp } from "../src/location/geoip.js";
import { t } from "../src/i18n/index.js";
import { LIVE_LANGS, type Lang } from "../src/site/pages.js";

/** Each `p.lead` of the page as its classes and its text, so the lead and the not-available line are told apart by class. */
const leads = (html: string): string[] => all(html, "p.lead").map((p) => `${classesOf(p).join(" ")}: ${text(p)}`);

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const geo = { lookup: () => ({ country: "DE", lat: 50.8752, lon: 6.1694 }) } as unknown as GeoIp;

const BOARD =
  '<section class="tile" id="tile-fuel"><div class="fuel-board"><ul class="fuel-board__lands"><li class="fuel-board__land"><p class="fuel-board__land-head"><span class="fuel-board__land-name">Hessen</span></p>' +
  '<ul class="fuel-board__stations"><li class="fuel-board__station">ARAL Teststraße 1 · <span class="fuel-board__price">E10 <span class="num">1,749</span> €</span></li></ul></li></ul>' +
  '<p class="tile__credit">Tankerkönig (CC BY 4.0) tankerkoenig.de</p></div></section>';
const ERROR_TILE = '<section class="tile is-error" id="tile-fuel"><p>Nicht verfügbar</p></section>';

/** One page body as `FuelPage.astro` composes it, in its order: the place, the cities, the board's section. */
const page = (lang: Lang, ua: string, board: string = BOARD): string =>
  fuelHereHtml(lang, { label: "Alsdorf", slug: "alsdorf" }) + fuelCitiesHtml(lang) + fuelBoardSectionHtml(lang, boardWithheld(ua) ? null : board);

/** The digest stub: a place's cards that carry a price and a station. */
function digest() {
  const asked: string[] = [];
  const f: FetchLike = (url) => {
    asked.push(url);
    return Promise.resolve({
      status: 200,
      headers: { get: (n: string) => ({ "content-type": "text/html; charset=utf-8", "place-key": "ags:05334002", "place-label": "Alsdorf", "place-point": "0", "place-slug": "alsdorf" })[n] ?? null },
      text: () => Promise.resolve('<section class="place" id="place-cards"><div class="fuel-board"><p class="fuel-row">ARAL Alsdorf · E10 1,749 €</p></div></section>'),
    });
  };
  return { asked, f };
}
const o = (f: FetchLike, g: GeoIp = geo) => ({ baseUrl: "http://digest", timeoutMs: 1_000, fetchImpl: f, geoipFile: undefined, geo: g });
const person = (h: Record<string, string> = {}) => new Headers({ "user-agent": CHROME, "x-forwarded-for": "192.0.2.81", ...h });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("B1: the place block is no provider request", () => {
  it("fuelHereOf asks the digest's cards once, exactly, with fuelRows=0 and no fuel parameter, and nothing reaches /internal/fuel/refresh", async () => {
    const net = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("no network in tests"));
    const d = digest();
    expect(await fuelHereOf(person(), "de", o(d.f))).toEqual({ label: "Alsdorf", slug: "alsdorf" });
    expect(d.asked).toHaveLength(1);
    expect(d.asked[0]).toMatch(/^http:\/\/digest\/internal\/place\/cards\?at=[^&]+&lang=de&snap=gemeinde&fuelRows=0$/u);
    expect(d.asked[0]).not.toMatch(/[?&]fuel(?:At)?=/u);
    expect(d.asked.some((u) => u.includes("/internal/fuel/refresh"))).toBe(false);
    expect(net).not.toHaveBeenCalled();
  });
});

describe("B2: the disclosure sits directly before the board", () => {
  it("in every language: the lead after the cities section and before the board's first row, under a visible heading that states the bound", () => {
    for (const lang of LIVE_LANGS) {
      const html = page(lang, CHROME);
      const cities = html.indexOf('<section class="fuel-cities"');
      const citiesEnd = html.indexOf("</section>", cities);
      const head = html.indexOf(`<h2 id="board-h" class="fuel-page__h">${t(lang, "fuelPage.boardHead")}</h2>`);
      const lead = html.indexOf(`<p class="lead">${t(lang, "fuelPage.lead")}</p>`);
      const firstRow = html.indexOf('class="fuel-board__station"');
      expect(cities, lang).toBeGreaterThan(0);
      expect(head, lang).toBeGreaterThan(citiesEnd);
      expect(lead, lang).toBeGreaterThan(head);
      expect(firstRow, lang).toBeGreaterThan(lead);
      // the lead once, and never above the place block
      expect(html.split(t(lang, "fuelPage.lead")).length - 1, lang).toBe(1);
      expect(html, lang).not.toMatch(/<h2 id="board-h"[^>]*visually-hidden/u);
    }
  });

  it("the page head keeps the C1 title alone; the board's section comes after the cities; a withheld board is never asked for", () => {
    const src = readFileSync(fileURLToPath(new URL("../src/layouts/FuelPage.astro", import.meta.url)), "utf8");
    expect(src).toContain('<PageHead as="div" wrap={false} h1={t(lang, "fuelPage.title")} />');
    expect(src).not.toContain('"fuelPage.lead"');
    expect(src).not.toContain("visually-hidden");
    expect(src.indexOf("fuelBoardSectionHtml(lang,")).toBeGreaterThan(src.indexOf("fuelCitiesHtml(lang)"));
    expect(src).toContain('const withheld = boardWithheld(Astro.request.headers.get("user-agent") ?? "");');
    expect(src).toContain("withheld ? Promise.resolve(null) : fetchFuelBoard(lang,");
  });

  it("no board (the digest's error tile, a quiet answer, withheld): the not-available line in the lead's place (N5)", () => {
    for (const board of [ERROR_TILE, "", null]) {
      const html = fuelBoardSectionHtml("de", board);
      expect(leads(html)).toEqual([`lead fuel-page__unavailable: ${t("de", "fuelPage.unavailable")}`]);
      expect(html).not.toContain(t("de", "fuelPage.lead"));
    }
    expect(isBoard(BOARD)).toBe(true);
    expect(isBoard(ERROR_TILE)).toBe(false);
  });
});

describe("B3: a declared automation client, corpus crawler or SEO tool gets the board without prices", () => {
  const LEAK = /1,749|ARAL|fuel-board|tankerkoenig/iu;
  const withheld = (ua: string): void => {
    expect(boardWithheld(ua), ua).toBe(true);
    for (const lang of LIVE_LANGS) {
      const html = page(lang, ua);
      expect(html, `${lang} ${ua}`).not.toMatch(LEAK);
      expect(leads(html), `${lang} ${ua}`).toContain(`lead fuel-page__unavailable: ${t(lang, "fuelPage.unavailable")}`);
    }
  };

  it("every AUTOMATION_AGENTS token, each with a reason; Lightpanda's own user agent and headless Chrome", () => {
    expect(AUTOMATION_AGENTS.length).toBeGreaterThan(10);
    expect(new Set(AUTOMATION_AGENTS.map((a) => a.token.toLowerCase())).size).toBe(AUTOMATION_AGENTS.length);
    for (const a of AUTOMATION_AGENTS) {
      expect(a.reason.length, a.token).toBeGreaterThan(10);
      const ua = `Mozilla/5.0 (X11; Linux x86_64) ${a.token}1.0`;
      expect(isAutomationAgent(ua), a.token).toBe(true);
      expect(isAutomationAgent(ua.toUpperCase()), a.token).toBe(true);
      withheld(ua);
    }
    withheld("Lightpanda/1.0");
    withheld("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/130.0.0.0 Safari/537.36");
  });

  it("every CORPUS_CRAWLERS token", () => {
    for (const c of CORPUS_CRAWLERS) withheld(`Mozilla/5.0 (compatible; ${c}/1.0; +https://example.org/bot)`);
  });

  it("every SEO_CRAWLERS token", () => {
    for (const c of SEO_CRAWLERS) withheld(`Mozilla/5.0 (compatible; ${c}/7.0; +https://example.org/bot)`);
  });

  it("#1290: the AI assistants' lane priority lifts no licence ruling — ClaudeBot and Amazonbot, the corpus crawlers among them, are still withheld the board", () => {
    expect((AI_ASSISTANTS as readonly string[]).includes("ClaudeBot")).toBe(true);
    // owner 2026-11-14: "Add Amazon bot to the priority also" — a lane, not a licence ruling
    expect((AI_ASSISTANTS as readonly string[]).includes("Amazonbot")).toBe(true);
    withheld("Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)");
    withheld("Mozilla/5.0 (compatible; Amazonbot/0.1; +https://developer.amazon.com/support/amazonbot)");
  });

  it("Googlebot, Bingbot, every AI assistant but the corpus crawler and a person's Chrome keep the board — its lead, its row and the fragment's credit", () => {
    const keep = [
      CHROME,
      "",
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/130.0.0.0 Safari/537.36",
      "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
      ...AI_ASSISTANTS.filter((a) => !(CORPUS_CRAWLERS as readonly string[]).includes(a)).map((a) => `Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ${a}/1.0)`),
    ];
    for (const ua of keep) {
      expect(isAutomationAgent(ua), ua).toBe(false);
      expect(boardWithheld(ua), ua).toBe(false);
      for (const lang of ["de", "en", "lv"] as const) {
        const html = page(lang, ua);
        expect(html, `${lang} ${ua}`).toContain("ARAL Teststraße 1");
        expect(html, `${lang} ${ua}`).toContain("tankerkoenig.de");
        expect(leads(html), `${lang} ${ua}`).toContain(`lead: ${t(lang, "fuelPage.lead")}`);
      }
    }
  });
});

describe("B6: nothing new about personal data", () => {
  it("the IP rung is never asked for a crawler, an SEO tool, a headless browser, Do-Not-Track or GPC", async () => {
    for (const h of [{ "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" }, { "user-agent": "Mozilla/5.0 (compatible; AhrefsBot/7.0)" }, { "user-agent": "HeadlessChrome/130" }, { dnt: "1" }, { "sec-gpc": "1" }]) {
      const lookup = vi.fn(() => ({ country: "DE", lat: 50.8752, lon: 6.1694 }));
      const d = digest();
      expect(await fuelHereOf(person(h), "de", o(d.f, { lookup } as unknown as GeoIp)), JSON.stringify(h)).toBeNull();
      expect(lookup, JSON.stringify(h)).not.toHaveBeenCalled();
      expect(d.asked, JSON.stringify(h)).toEqual([]);
    }
  });

  it("the resolved place is kept as its label and slug only, nothing is logged, and neither file stores anything", async () => {
    const logs = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => undefined));
    const d = digest();
    const here = await fuelHereOf(person(), "de", o(d.f));
    expect(Object.keys(here ?? {}).sort()).toEqual(["label", "slug"]);
    for (const l of logs) expect(l).not.toHaveBeenCalled();
    for (const f of ["../src/layouts/FuelPage.astro", "../src/lib/fuel-index.ts"]) {
      const src = readFileSync(fileURLToPath(new URL(f, import.meta.url)), "utf8");
      expect(src, f).not.toMatch(/console\.|logger|localStorage|sessionStorage|document\.cookie|Set-Cookie/u);
      expect(src, f).not.toMatch(/import [^;]*\blog\b/u);
    }
    const page = readFileSync(fileURLToPath(new URL("../src/layouts/FuelPage.astro", import.meta.url)), "utf8");
    expect(page).toContain('headers.set("Cache-Control", "private, no-store")');
    expect(page).toContain('headers.set("Vary", "Accept-Language, X-Forwarded-For")');
  });
});
