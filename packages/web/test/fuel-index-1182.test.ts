/**
 * #1182 part 2: the fuel index (`/<lang>/fuel`) opens with the visitor's place, then the cities, then the board.
 *
 * The place's prices are person-gated (#1065 PF1/PF2, #1076 S1–S5, the MTS-K "auf Useraktion"): the planted digest's
 * cards DO carry prices and a station, and none of it may reach the document — only the fuel card's frame, whose
 * figures `placeFuelScript()` asks for when the slot is in view. A crawler, Do-Not-Track or GPC request is asked for
 * no place and gets no slot. The digest is a stub; nothing here reaches a provider.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { fuelCitiesHtml, fuelHereHtml, fuelHereOf } from "../src/lib/fuel-index.js";
import type { FetchLike } from "../src/lib/tiles.js";
import type { GeoIp } from "../src/location/geoip.js";
import { t } from "../src/i18n/index.js";
import { LIVE_LANGS } from "../src/site/pages.js";
import { POPULAR_PLACES, placePath, popularSlug } from "../src/site/places.js";

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const geo = { lookup: () => ({ country: "DE", lat: 50.8752, lon: 6.1694 }) } as unknown as GeoIp;
/** A price figure as any card prints one: "1,749 €", "1.749 €", "1,74 €/l". */
const PRICE = /\d[,.]\d{2,3}\s*(?:€|&euro;|EUR)/u;

/** The digest stub: a place's cards that carry a price, a station and the board's class — what the document must not repeat. */
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
const o = (f: FetchLike) => ({ baseUrl: "http://digest", timeoutMs: 1_000, fetchImpl: f, geoipFile: undefined, geo });
const person = (h: Record<string, string> = {}) => new Headers({ "user-agent": CHROME, "x-forwarded-for": "192.0.2.81", ...h });

describe("#1182 fuel index: the visitor's place, person-gated", () => {
  it("a person's place: its name and page, the fuel card's frame, and no figure, station or board in the document", async () => {
    const d = digest();
    const here = await fuelHereOf(person(), "de", o(d.f));
    expect(here).toEqual({ label: "Alsdorf", slug: "alsdorf" });
    // the cards were asked with the fuel rows left out and no refresh
    expect(d.asked).toHaveLength(1);
    expect(d.asked[0]).toContain("&fuelRows=0");
    expect(d.asked[0]).not.toMatch(/[?&]fuel=/u);
    for (const lang of LIVE_LANGS) {
      const html = fuelHereHtml(lang, here) + fuelCitiesHtml(lang);
      expect(html, lang).not.toMatch(PRICE);
      expect(html, lang).not.toContain("ARAL");
      expect(html, lang).not.toContain("fuel-board");
      expect(html, lang).not.toContain("fuel-row");
      // the slot the page's script fills, inside the `.place` it reads the place from
      expect(html, lang).toMatch(/<section class="fuel-here place" id="fuel-here"[^>]*>.*<a class="place__page" href="\/[a-z]{2}\/place\/alsdorf">.*<div class="pcard__fuelslot"><p class="pcard__note pcard__fueljs">.*<div class="pcard__fuelout" aria-live="polite"><\/div><\/div><\/section>/su);
      expect(html, lang).toContain(`href="${placePath(lang, "alsdorf")}"`);
    }
  });

  it("the place link matches the script's own pattern for every language", () => {
    for (const lang of LIVE_LANGS) {
      const href = /<a class="place__page" href="([^"]+)"/u.exec(fuelHereHtml(lang, { label: "Alsdorf", slug: "alsdorf" }))?.[1] ?? "";
      expect(href, lang).toMatch(/^\/([a-z]{2})\/place\/([a-z0-9-]+)$/u);
    }
  });

  it("a crawler, Do-Not-Track and GPC: no lookup, no digest read, no slot — the honest line", async () => {
    for (const h of [{ "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" }, { dnt: "1" }, { "sec-gpc": "1" }]) {
      const d = digest();
      const here = await fuelHereOf(person(h), "en", o(d.f));
      expect(here, JSON.stringify(h)).toBeNull();
      expect(d.asked).toEqual([]);
      const html = fuelHereHtml("en", here);
      expect(html).not.toContain("pcard__fuelslot");
      expect(html).toContain(t("en", "fuelPage.hereNone"));
    }
  });

  it("a digest that does not answer, or a place with no page: no slot, never a wait", async () => {
    const down: FetchLike = () => Promise.reject(new Error("refused"));
    expect(await fuelHereOf(person(), "de", o(down))).toBeNull();
    const noSlug: FetchLike = (url) =>
      Promise.resolve({ status: 200, headers: { get: (n: string) => ({ "content-type": "text/html; charset=utf-8", "place-key": "ags:05334002", "place-label": "Alsdorf" })[n] ?? null }, text: () => Promise.resolve(`<section class="place" id="place-cards">${url}</section>`) });
    expect(await fuelHereOf(person(), "de", o(noSlug))).toBeNull();
  });
});

describe("#1182 fuel index: the cities", () => {
  it("every big city's place page, by its own name, and no figure", () => {
    for (const lang of LIVE_LANGS) {
      const html = fuelCitiesHtml(lang);
      for (const p of POPULAR_PLACES) expect(html, lang).toContain(`href="${placePath(lang, popularSlug(p))}"`);
      expect(html, lang).not.toMatch(PRICE);
    }
  });
});

describe("#1182 fuel index: the page", () => {
  const src = readFileSync(fileURLToPath(new URL("../src/layouts/FuelPage.astro", import.meta.url)), "utf8");
  it("the place first, then the cities, then the board; the fuel script only with a slot; never cached for another visitor", () => {
    const here = src.indexOf("fuelHereHtml(lang, here)");
    const cities = src.indexOf("fuelCitiesHtml(lang)");
    // the board's section, `id="board"`, is built by `fuelBoardSectionHtml` since the ruling of 2026-11-08 (B2)
    const board = src.indexOf("fuelBoardSectionHtml(lang,");
    expect(here).toBeGreaterThan(0);
    expect(cities).toBeGreaterThan(here);
    expect(board).toBeGreaterThan(cities);
    expect(src).toContain("PLACE_FUEL_FRAGMENT_ON && here !== null");
    expect(src).toContain("{fuelScript && <script is:inline set:html={placeFuelScript()} />}");
    expect(src).toContain('headers.set("Cache-Control", "private, no-store")');
    expect(src).toContain('headers.set("Vary", "Accept-Language, X-Forwarded-For")');
    // C5 stays: no cached copy of the board outlives its prices
    expect(src).toContain('robots="noarchive"');
  });
});
