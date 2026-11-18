/**
 * The shell's place routes (#564 § 5, § 7): the island's two POST fragments
 * (the key in the BODY, never the URL — the edge logs the request line) and
 * the place pages' resolution: unknown is the 404, a digest that did not answer
 * is a 503 and never a 404, a non-canonical slug or segment is a 301.
 */
import { readFileSync } from "node:fs";
import { all, first, text } from "@viafrei/design/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { placeRoute, suggestRoute } from "../src/lib/fragment-route.js";
import { withAgentClass } from "../src/lib/agent-class.js";
import { CRAWLER_PAGE_BUDGET_MS } from "../src/lib/page-budget.js";
import { PLACE_NAME_INDEX_TTL_MS, PLACE_PAGE_BUDGET_MS, PLACE_PAGE_CARDS_MS, resetPlaceNameIndex, resolvePlacePage, type PlacePageAnswer } from "../src/lib/place-page.js";
import { resetSlugKeys } from "../src/lib/place.js";
import { CARDS_MIN_MS, placeFirstRender } from "../src/lib/place-first.js";
import { PLACE_NAME_CHOICES, placesByName } from "../src/site/places.js";
import { placesLangXml } from "../src/site/sitemaps.js";
import { LIVE_LANGS } from "../src/site/pages.js";
import { lastmodOf } from "../src/site/lastmod.js";
import { placeMeta } from "../src/site/meta.js";
import { liftPlaceFirst, placeNowOf } from "../src/lib/place-head.js";
import { robotsTxt } from "../src/site/discovery.js";
import { DEFAULT_PLACE_TIMEOUT_MS, DEFAULT_TILE_TIMEOUT_MS } from "../src/lib/env.js";
import type { FetchLike } from "../src/lib/tiles.js";

/** #892: the Gemeinden the stub's `place_slugs` holds — slug → AGS. `koeln-alt` stands for a link built before a slug was stored. */
const KEYS: Readonly<Record<string, string>> = {
  koeln: "05315000",
  "koeln-alt": "05315000",
  muenchen: "09162000",
  "frankfurt-am-main": "06412000",
  "frankfurt-oder": "12053000",
  "halle-saale": "15002000",
  "halle-westf": "05754012",
  alsdorf: "05334002",
  "neustadt-in-holstein": "01055032",
};
const SLUG_OF: Readonly<Record<string, string>> = { "05315000": "koeln", "09162000": "muenchen", "06412000": "frankfurt-am-main", "05334002": "alsdorf" };
const digest = (asked: string[], status = 200, keyStatus = 200): FetchLike => (url) => {
  asked.push(url);
  const key = /\/internal\/place\/key\?slug=([a-z0-9-]+)$/.exec(url);
  if (key !== null) {
    const ags = KEYS[key[1]!];
    const st = keyStatus !== 200 ? keyStatus : ags === undefined ? 404 : 200;
    return Promise.resolve({ status: st, headers: { get: (n: string) => (n === "content-type" ? "text/html; charset=utf-8" : null) }, text: () => Promise.resolve(st === 200 ? `<p class="place-key">ags:${ags!}</p>` : "") });
  }
  // the index as the digest renders it (#1224: a stub that gave none would now be a digest that did not answer)
  if (url.endsWith("/internal/place/index")) {
    const li = Object.keys(SLUG_OF).map((a) => `<li><a href="/de/place/${SLUG_OF[a]!}">${SLUG_OF[a]!}</a></li>`).join("");
    return Promise.resolve({ status, headers: { get: (n: string) => (n === "content-type" ? "text/html; charset=utf-8" : null) }, text: () => Promise.resolve(`<ul class="place-index">${li}</ul>`) });
  }
  const at = /[?&]at=ags%3A(\d{8})/.exec(url)?.[1] ?? "05315000";
  const body = url.includes("/suggest") ? '<div class="place-suggest"><ul></ul></div>' : '<section class="place" id="place-cards"><h2>Köln</h2></section>';
  return Promise.resolve({
    status,
    headers: { get: (n: string) => ({ "content-type": "text/html; charset=utf-8", "place-key": `ags:${at}`, "place-label": encodeURIComponent("Köln"), "place-point": "0", ...(SLUG_OF[at] === undefined ? {} : { "place-slug": SLUG_OF[at] }) })[n] ?? null },
    text: () => Promise.resolve(body),
  });
};
const post = (body: unknown, type = "application/json"): Request => new Request("http://shell/fragment/place", { method: "POST", headers: { "content-type": type }, body: typeof body === "string" ? body : JSON.stringify(body) });

describe("POST /fragment/place and /fragment/suggest", () => {
  it("answers the digest's fragment with the pill's two headers", async () => {
    const asked: string[] = [];
    const res = await placeRoute(post({ at: "pt:50.94,6.96", lang: "en" }), { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: digest(asked) });
    expect(res.status).toBe(200);
    expect(res.headers.get("place-key")).toBe("ags:05315000");
    expect(decodeURIComponent(res.headers.get("place-label") ?? "")).toBe("Köln");
    // #1143: the place page's slug rides beside its name, so the pill links to the place it names
    expect(res.headers.get("place-slug")).toBe("koeln");
    // #1065 (steward C2): the fuel fragments' headers; a POST with no Fetch-Metadata is no person's, so the fuel card is its frame.
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive, nosnippet");
    expect(asked).toEqual(["http://digest/internal/place/cards?at=pt%3A50.94%2C6.96&lang=en&fuelRows=0"]);
  });

  // #1070: a position outside Germany — the digest's word is carried, the island remembers nothing on either.
  it("a far position is answered with 'Ganz Deutschland' and place-outside: far, never a 404 (#1070)", async () => {
    for (const [lang, word] of [["de", "Ganz Deutschland"], ["en", "All of Germany"]] as const) {
      const far: FetchLike = () => Promise.resolve({ status: 404, headers: { get: (n: string) => (n === "place-outside" ? "far" : n === "content-type" ? "text/html; charset=utf-8" : null) }, text: () => Promise.resolve("<p>no such place in Germany</p>") });
      const res = await placeRoute(post({ at: "pt:48.855,2.355", lang, how: "browser" }), { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: far });
      expect(res.status).toBe(200);
      expect(res.headers.get("place-outside")).toBe("far");
      expect(decodeURIComponent(res.headers.get("place-label") ?? "")).toBe(word);
      const html = await res.text();
      expect(html).toMatch(/^<section class="place" id="place-cards"/);
      expect(all(html, ".place__far")).toHaveLength(1);
      expect(html).not.toContain("48.855");
    }
    // a 404 that does not say far is still "no such place"
    const plain: FetchLike = () => Promise.resolve({ status: 404, headers: { get: () => null }, text: () => Promise.resolve("") });
    expect((await placeRoute(post({ at: "pt:50.94,6.96", lang: "de" }), { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: plain })).status).toBe(404);
  });
  it("a border position passes place-outside: border beside the nearest German place's key (#1070)", async () => {
    const border: FetchLike = () =>
      Promise.resolve({
        status: 200,
        headers: { get: (n: string) => ({ "content-type": "text/html; charset=utf-8", "place-key": "ags:08317057", "place-label": "Kehl", "place-point": "0", "place-outside": "border" })[n] ?? null },
        text: () => Promise.resolve('<section class="place" id="place-cards"><h2>Kehl</h2></section>'),
      });
    const res = await placeRoute(post({ at: "pt:48.58,7.7475", lang: "de" }), { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: border });
    expect(res.status).toBe(200);
    expect(res.headers.get("place-outside")).toBe("border");
    expect(res.headers.get("place-key")).toBe("ags:08317057");
  });

  it("refuses a GET, a form post, an oversized body, a bad key or language — and asks the digest nothing", async () => {
    const asked: string[] = [];
    const o = { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: digest(asked) };
    expect((await placeRoute(new Request("http://shell/fragment/place?at=ags:05315000"), o)).status).toBe(405);
    expect((await placeRoute(post("at=ags:05315000&lang=de", "application/x-www-form-urlencoded"), o)).status).toBe(400);
    expect((await placeRoute(post({ at: "ags:05315000", lang: "de", pad: "x".repeat(600) }), o)).status).toBe(400);
    expect((await placeRoute(post({ at: "Köln", lang: "de" }), o)).status).toBe(404);
    expect((await placeRoute(post({ at: "ags:05315000", lang: "ja" }), o)).status).toBe(400);
    expect(asked).toEqual([]);
  });

  it("reads at most 512 BYTES of the body and no further (review N3)", async () => {
    const asked: string[] = [];
    const o = { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: digest(asked) };
    // an endless upload with no content-length: refused after the cap, the rest never pulled
    let pulls = 0;
    let cancelled = false;
    const endless = new ReadableStream<Uint8Array>({
      pull(c) {
        pulls += 1;
        c.enqueue(new TextEncoder().encode(" ".repeat(100)));
      },
      cancel() {
        cancelled = true;
      },
    });
    const streamed = new Request("http://shell/fragment/place", { method: "POST", headers: { "content-type": "application/json" }, body: endless, duplex: "half" } as RequestInit);
    expect((await placeRoute(streamed, o)).status).toBe(400);
    expect(pulls).toBeLessThanOrEqual(8);
    expect(cancelled).toBe(true);
    // bytes, not characters: with 240 umlauts the body is under 512 characters and over 512 bytes
    expect((await placeRoute(post(`{"at":"ags:05315000","lang":"de","p":"${"ä".repeat(240)}"}`), o)).status).toBe(400);
    // a declared length above the cap is refused before any read
    const declared = new Request("http://shell/fragment/place", { method: "POST", headers: { "content-type": "application/json", "content-length": "513" }, body: JSON.stringify({ at: "ags:05315000", lang: "de" }) });
    expect((await placeRoute(declared, o)).status).toBe(400);
    expect(asked).toEqual([]);
    // and a body of exactly 512 bytes is read whole
    const base = JSON.stringify({ at: "pt:50.94,6.96", lang: "de", p: "" });
    const exact = JSON.stringify({ at: "pt:50.94,6.96", lang: "de", p: "x".repeat(512 - base.length) });
    expect(new TextEncoder().encode(exact).byteLength).toBe(512);
    expect((await placeRoute(post(exact), o)).status).toBe(200);
  });

  it("suggests for 2 to 80 characters; anything else is a 400 (2.5.8: a digest that does not answer is a 200 that says so)", async () => {
    const o = { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: digest([]) };
    const ok = await suggestRoute(new Request("http://shell/fragment/suggest", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q: "Köl", lang: "de" }) }), o);
    expect(ok.status).toBe(200);
    const short = await suggestRoute(new Request("http://shell/fragment/suggest", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q: "K", lang: "de" }) }), o);
    expect(short.status).toBe(400);
  });

  // 2.4.9 (#1088 reopened): "Wilhelmshöher Allee 100" — a street and a number with no town — is asked of the digest as
  // typed, and its address line comes back whole: the pick key, the address as the name, the OpenStreetMap credit
  // and the § 4.6 offer — a PASS-THROUGH check of the shell (it would pass on 2.4.8); #1088 itself is proved at the digest layer, place-address-anywhere-1088.db.test.ts (the fragment's shape is the digest's `renderSuggestions`, held by its own DB test).
  it("a street and a number typed without a town reach the digest as typed, and the address line and its OSM credit come back", async () => {
    const asked: string[] = [];
    const fragment =
      '<div class="place-suggest"><ul class="place-suggest__list" aria-label="Vorschläge"><li class="place-sug"><a class="place-opt" href="#pt:51.3135,9.4735">' +
      '<span class="place-opt__name" translate="no">Wilhelmshöher Allee 99, Kassel</span> <span class="place-opt__where">· Straße</span> <span class="place-opt__note">Hausnummer 100 nicht gefunden – nächste: 99</span></a></li></ul>' +
      '<p class="credit">© OpenStreetMap-Mitwirkende, ODbL 1.0</p><p class="odbl"><a href="/impressum">Datenbank anfordern</a></p></div>';
    const fetchImpl: FetchLike = (url) => {
      asked.push(url);
      return Promise.resolve({ status: 200, headers: { get: (n: string) => (n === "content-type" ? "text/html; charset=utf-8" : null) }, text: () => Promise.resolve(fragment) });
    };
    const res = await suggestRoute(new Request("http://shell/fragment/suggest", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q: "Wilhelmshöher Allee 100", lang: "de" }) }), { baseUrl: "http://digest", timeoutMs: 500, fetchImpl });
    expect(res.status).toBe(200);
    // #1153: the header's one search asks the place list and the site search side by side
    expect(asked).toContain(`http://digest/internal/place/suggest?q=${encodeURIComponent("Wilhelmshöher Allee 100")}&lang=de`);
    expect(asked.filter((u) => u.includes("/internal/place/suggest")).length).toBe(1);
    const html = await res.text();
    expect(all(html, "a.place-opt").map((a) => a.attrs["href"])).toEqual(["#pt:51.3135,9.4735"]);
    expect(html).toContain("Wilhelmshöher Allee 99, Kassel");
    expect(html).toContain("OpenStreetMap");
    expect(html).toContain('href="/impressum"');
  });
});

describe("the place pages", () => {
  const o = (status = 200, keyStatus = 200): { baseUrl: string; timeoutMs: number; fetchImpl: FetchLike } => ({ baseUrl: "http://digest", timeoutMs: 500, fetchImpl: digest([], status, keyStatus) });
  beforeEach(() => {
    resetSlugKeys();
    resetPlaceNameIndex();
  });
  it("render at their canonical address, the stored slug, in every language (#892)", async () => {
    expect(await resolvePlacePage("de", "koeln", o())).toMatchObject({ kind: "page", slug: "koeln" });
    expect(await resolvePlacePage("en", "koeln", o())).toMatchObject({ kind: "page", slug: "koeln" });
  });
  it("ask the digest for the slug's key, never the AGS in the address, and keep it", async () => {
    const asked: string[] = [];
    const k = { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: digest(asked) };
    await resolvePlacePage("de", "koeln", k);
    await resolvePlacePage("ru", "koeln", k);
    expect(asked.filter((u) => u.includes("/internal/place/key"))).toEqual(["http://digest/internal/place/key?slug=koeln"]);
    expect(asked.filter((u) => u.includes("/internal/place/cards")).every((u) => u.includes("at=ags%3A05315000"))).toBe(true);
  });
  it("redirect a slug whose Gemeinde's stored slug is another one, permanently", async () => {
    expect(await resolvePlacePage("de", "koeln-alt", o())).toEqual({ kind: "redirect", to: "/de/place/koeln" });
  });
  it("an address that is no slug at all (an AGS, a digit run) is never looked up as a key", async () => {
    const asked: string[] = [];
    expect(await resolvePlacePage("de", "05315000-koeln", { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: digest(asked) })).toEqual({ kind: "missing" });
    expect(asked.some((u) => u.includes("/internal/place/key"))).toBe(false);
  });
  it("an unknown place is missing; a digest that did not answer is unavailable, never missing", async () => {
    expect(await resolvePlacePage("de", "atlantis", o())).toEqual({ kind: "missing" });
    expect(await resolvePlacePage("de", "koeln", o(404))).toEqual({ kind: "missing" });
    // a digest that gives neither cards nor index (nothing held): unavailable
    resetSlugKeys();
    resetPlaceNameIndex();
    expect(await resolvePlacePage("de", "koeln", o(500))).toEqual({ kind: "unavailable" });
    resetSlugKeys();
    expect(await resolvePlacePage("de", "koeln", o(200, 500))).toEqual({ kind: "unavailable" });
  });
  it("guard (behaviour before #1224, kept): a busy key read (503) is unavailable, never missing — for a stored slug and an unknown one", async () => {
    expect(await resolvePlacePage("de", "koeln", o(503, 503))).toEqual({ kind: "unavailable" });
    // the digest's key route answers busy before its slugs are read: the shell does not know "atlantis" is none
    expect(await resolvePlacePage("de", "atlantis", o(503, 503))).toEqual({ kind: "unavailable" });
  });
  it("#1224: cards that are neither a place nor the digest's own 404 (here `far`) are unavailable; only that 404 is missing", async () => {
    // the key resolves, and the cards' read answers 404 — with `Place-Outside: far` (a kind no Gemeinde's key should
    // give) or without (the digest's own "no such place")
    const cardsRefused = (outside: string | null): FetchLike => (url, init) => {
      if (url.includes("/internal/place/key") || url.endsWith("/internal/place/index")) return digest([])(url, init);
      return Promise.resolve({ status: 404, headers: { get: (n: string) => (n === "content-type" ? "text/html; charset=utf-8" : n === "place-outside" ? outside : null) }, text: () => Promise.resolve("<p>no such place in Germany</p>") });
    };
    expect(await resolvePlacePage("de", "koeln", { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: cardsRefused("far") })).toEqual({ kind: "unavailable" });
    resetSlugKeys();
    expect(await resolvePlacePage("de", "koeln", { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: cardsRefused(null) })).toEqual({ kind: "missing" });
  });
  it("are listed in their own sitemaps, one per language, address and lastmod only (alternates in the page's head, 2.4.2), and robots.txt names each (#715)", () => {
    const locs = LIVE_LANGS.flatMap((l) => [...placesLangXml(l, ["koeln"], "2026-10-12").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
    expect(locs).toEqual(LIVE_LANGS.map((l) => `https://viafrei.de/${l}/place/koeln`));
    expect(placesLangXml("en", ["koeln"])).not.toContain("hreflang");
    expect(robotsTxt()).toMatch(/^Sitemap: https:\/\/viafrei\.de\/sitemap-places\.xml$/m);
    for (const l of LIVE_LANGS) expect(robotsTxt()).toContain(`Sitemap: https://viafrei.de/sitemap-places-${l}.xml`);
    // the default lastmod is the place TEMPLATE's content day per language, never today's
    for (const l of ["de", "en", "tr"] as const) expect(placesLangXml(l, ["koeln"])).toContain(`<loc>https://viafrei.de/${l}/place/koeln</loc><lastmod>${lastmodOf("place", l)!}</lastmod>`);
  });
});

describe("a place page waits on a slow digest inside its own two-second deadline, never past it (#709, #1166)", () => {
  /** A digest that answers after `ms`, and honours the abort like fetch does. */
  const slow = (ms: number): FetchLike => (url, init) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        void digest([])(url, init).then(resolve, reject);
      }, ms);
      init.signal.addEventListener("abort", () => {
        clearTimeout(timer);
        const e = new Error("aborted");
        e.name = "AbortError";
        reject(e);
      });
    });
  beforeEach(() => resetSlugKeys());
  it("a cold digest inside the page's deadline is the page, not a 503; past it, unavailable and never missing", async () => {
    expect(await resolvePlacePage("de", "koeln", { baseUrl: "http://digest", timeoutMs: 400, fetchImpl: slow(150) })).toMatchObject({ kind: "page" });
    resetSlugKeys();
    expect(await resolvePlacePage("de", "koeln", { baseUrl: "http://digest", timeoutMs: 60, fetchImpl: slow(150) })).toEqual({ kind: "unavailable" });
  });
  it("#1166: no page waits on the digest above the two-second ceiling — the default page deadline is the tiles' 2 s, and a place page's whole budget is 2 s", () => {
    expect(DEFAULT_PLACE_TIMEOUT_MS).toBe(2_000);
    expect(DEFAULT_PLACE_TIMEOUT_MS).toBeLessThanOrEqual(DEFAULT_TILE_TIMEOUT_MS);
    expect(PLACE_PAGE_BUDGET_MS).toBe(2_000);
    expect(PLACE_PAGE_CARDS_MS).toBeLessThan(PLACE_PAGE_BUDGET_MS);
  });
  it("both place pages and the island's place fragment use the place deadline; the home, tiles and suggestions keep the panel deadline", () => {
    const src = (p: string): string => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
    for (const p of ["pages/[lang]/place/[slug].astro", "pages/fragment/place.ts"]) {
      expect(src(p), p).toContain("timeoutMs: env.placeTimeoutMs");
      expect(src(p), p).not.toContain("env.tileTimeoutMs");
    }
    for (const p of ["layouts/Home.astro", "pages/fragment/tile.ts", "pages/fragment/suggest.ts"]) expect(src(p), p).toContain("timeoutMs: env.tileTimeoutMs");
  });
  it("one card refreshed in place waits a tile's 2 s — a station's area card too, since its round was made fast (2.5.2, undoing the hotfix of 2026-10-30)", () => {
    const card = readFileSync(new URL("../src/pages/fragment/card.ts", import.meta.url), "utf8");
    expect(card).toContain("timeoutMs: env.tileTimeoutMs");
    expect(card).not.toContain("placeTimeoutMs");
  });
});

describe("a place page asked by its name alone (#739)", () => {
  // The digest's index as it renders it (renderPlaceIndex): since #892 the stored slugs, `/de/place/<slug>`.
  const INDEX = [
    ["koeln", "Köln"],
    ["muenchen", "München"],
    ["frankfurt-am-main", "Frankfurt am Main"],
    ["frankfurt-oder", "Frankfurt (Oder)"],
    ["halle-saale", "Halle (Saale)"],
    ["halle-westf", "Halle (Westf.)"],
    ["alsdorf", "Alsdorf"],
    ["neustadt-in-holstein", "Neustadt in Holstein"],
  ] as const;
  const indexHtml = `<ul class="place-index">${INDEX.map(([slug, name]) => `<li><a href="/de/place/${slug}">${name.replace("&", "&amp;")}</a></li>`).join("")}</ul>`;
  const withIndex = (asked: string[], indexStatus = 200): FetchLike => (url, init) => {
    if (!url.endsWith("/internal/place/index")) return digest(asked)(url, init);
    asked.push(url);
    return Promise.resolve({ status: indexStatus, headers: { get: (n: string) => (n === "content-type" ? "text/html; charset=utf-8" : null) }, text: () => Promise.resolve(indexHtml) });
  };
  const o = (asked: string[] = [], indexStatus = 200) => ({ baseUrl: "http://digest", timeoutMs: 500, fetchImpl: withIndex(asked, indexStatus) });
  beforeEach(() => {
    resetPlaceNameIndex();
    resetSlugKeys();
  });

  it("a stored slug is the page itself; a typed name (umlaut, capitals) redirects to it, in the asked language", async () => {
    expect(await resolvePlacePage("de", "koeln", o())).toMatchObject({ kind: "page", slug: "koeln" });
    expect(await resolvePlacePage("de", "köln", o())).toEqual({ kind: "redirect", to: "/de/place/koeln", temporary: true });
    expect(await resolvePlacePage("en", "muenchen", o())).toMatchObject({ kind: "page", slug: "muenchen" });
    expect(await resolvePlacePage("tr", "München", o())).toEqual({ kind: "redirect", to: "/tr/place/muenchen", temporary: true });
    // an exact name wins over the places it is a prefix of: "Frankfurt am Main" asked in full is one page
    expect(await resolvePlacePage("de", "Frankfurt am Main", o())).toEqual({ kind: "redirect", to: "/de/place/frankfurt-am-main", temporary: true });
    expect(await resolvePlacePage("de", "frankfurt-am-main", o())).toMatchObject({ kind: "page" });
  });

  it("offers the choice when several places carry the name — Frankfurt (Main and Oder), Halle", async () => {
    expect(await resolvePlacePage("de", "frankfurt", o())).toEqual({
      kind: "choice",
      options: [
        { name: "Frankfurt am Main", path: "/de/place/frankfurt-am-main" },
        { name: "Frankfurt (Oder)", path: "/de/place/frankfurt-oder" },
      ],
    });
    expect(await resolvePlacePage("en", "halle", o())).toEqual({
      kind: "choice",
      options: [
        { name: "Halle (Saale)", path: "/en/place/halle-saale" },
        { name: "Halle (Westf.)", path: "/en/place/halle-westf" },
      ],
    });
  });

  it("is missing for a name no page carries and a prefix that is not a whole word", async () => {
    expect(await resolvePlacePage("de", "atlantis", o())).toEqual({ kind: "missing" });
    // "frank" is not a word of "frankfurt-…": no match, never a guess
    expect(await resolvePlacePage("de", "frank", o())).toEqual({ kind: "missing" });
    // a short generic first word stands for no place (PLACE_NAME_PREFIX_MIN)
    expect(placesByName([{ slug: "bad-toelz" }, { slug: "bad-kissingen" }], "bad")).toEqual([]);
  });

  it("#1224: a digest that gave no index (busy, and none held) is unavailable — the degraded page — never a 404", async () => {
    resetPlaceNameIndex();
    expect(await resolvePlacePage("de", "köln", o([], 500))).toEqual({ kind: "unavailable" });
    resetPlaceNameIndex();
    expect(await resolvePlacePage("de", "köln", o([], 503))).toEqual({ kind: "unavailable" });
    // a slug the key route did not know AND no index: not known to be none either
    resetPlaceNameIndex();
    expect(await resolvePlacePage("de", "atlantis", o([], 503))).toEqual({ kind: "unavailable" });
    // once an index is held, a failed refresh keeps it and an unknown name is the 404 again
    resetPlaceNameIndex();
    expect(await resolvePlacePage("de", "köln", o())).toEqual({ kind: "redirect", to: "/de/place/koeln", temporary: true });
    expect(await resolvePlacePage("de", "atlantis", o([], 503))).toEqual({ kind: "missing" });
  });

  it("reads the index once for a burst of guessed addresses (PLACE_NAME_INDEX_TTL_MS)", async () => {
    const asked: string[] = [];
    for (const n of ["köln", "München", "frankfurt", "atlantis"]) await resolvePlacePage("de", n, o(asked));
    expect(asked.filter((u) => u.endsWith("/internal/place/index"))).toHaveLength(1);
    expect(PLACE_NAME_INDEX_TTL_MS).toBe(600_000);
  });

  it("caps the choice at PLACE_NAME_CHOICES", () => {
    const many = Array.from({ length: PLACE_NAME_CHOICES + 5 }, (_, i) => ({ slug: `neustadt-${i}` }));
    expect(placesByName(many, "Neustadt")).toHaveLength(PLACE_NAME_CHOICES);
  });
});

describe("#1166: a place page answers inside two seconds — late cards are filled in the browser, never a 503 after 8 s", () => {
  const INDEX_HTML = '<ul class="place-index"><li><a href="/de/place/koeln">Köln</a></li><li><a href="/de/place/muenchen">München</a></li></ul>';
  const html = (status: number, body: string) => ({ status, headers: { get: (n: string) => (n === "content-type" ? "text/html; charset=utf-8" : null) }, text: () => Promise.resolve(body) });
  /** A request that never answers, and honours the abort as fetch does. */
  const hang = (init: { signal: AbortSignal }) =>
    new Promise<never>((_, reject) =>
      init.signal.addEventListener("abort", () => {
        const e = new Error("aborted");
        e.name = "AbortError";
        reject(e);
      }),
    );
  /** `cards`: how the cards route behaves; `key`/`index` likewise. Everything else is the shared stub. */
  const saturated = (asked: string[], b: { cards?: "hang" | 500; key?: "hang"; index?: 200 | 500 } = {}): FetchLike => (url, init) => {
    asked.push(url);
    if (url.includes("/internal/place/key") && b.key === "hang") return hang(init);
    if (url.endsWith("/internal/place/index")) return Promise.resolve(html(b.index ?? 200, INDEX_HTML));
    if (url.includes("/internal/place/cards") && b.cards === "hang") return hang(init);
    if (url.includes("/internal/place/cards") && b.cards === 500) return Promise.resolve(html(500, ""));
    return digest([])(url, init);
  };
  /** The production deadline: what `readEnv()` hands the page (2 000 ms). */
  const prod = (f: FetchLike) => ({ baseUrl: "http://digest", timeoutMs: DEFAULT_PLACE_TIMEOUT_MS, fetchImpl: f });
  beforeEach(() => {
    resetSlugKeys();
    resetPlaceNameIndex();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  /** Whether the answer is a page whose cards are the loading placeholder the filler fetches. */
  const loading = (a: PlacePageAnswer | null): boolean => a?.kind === "page" && first(a.place.html, "div.place-fill.place-fill--loading[data-vf-fill]") !== null;
  /** Resolve the page under fake time; `null` when it had not answered after `ms`. */
  const within = async (p: Promise<PlacePageAnswer>, ms: number): Promise<PlacePageAnswer | null> => {
    let out: PlacePageAnswer | null = null;
    void p.then((a) => (out = a));
    await vi.advanceTimersByTimeAsync(ms);
    return out;
  };

  it("cards later than the page's deadline: the page renders (200) with the cards loading, the index's name and its own address", async () => {
    const asked: string[] = [];
    const a = await within(resolvePlacePage("de", "koeln", prod(saturated(asked, { cards: "hang" }))), PLACE_PAGE_CARDS_MS + 50);
    // the cards given the 2 s fetch deadline (or no deadline at all) has not answered yet
    expect(a).not.toBeNull();
    expect(a).toMatchObject({ kind: "page", slug: "koeln", place: { at: "ags:05315000", label: "Köln", point: false, slug: "koeln" } });
    const page = a as Extract<PlacePageAnswer, { kind: "page" }>;
    // the placeholder the page's filler fetches whole: the cards of THIS place, as a person's page asks
    expect(page.place.html).toContain('data-vf-fill="/fragment/place"');
    expect(page.place.html).toContain("&quot;at&quot;:&quot;ags:05315000&quot;");
    expect(page.place.html).toContain('data-vf-id="place-cards"');
    expect(page.place.html).toContain("Die Karten für diesen Ort werden geladen");
    // without JavaScript: a link asking for the page again, inside the placeholder's frame (the swap takes it away)
    expect(page.place.html).toMatch(/<noscript><p class="place-fill__note"><a href="\/de\/place\/koeln">Seite neu laden, um die Karten zu sehen<\/a><\/p><\/noscript><\/div>$/);
    expect(asked.filter((u) => u.endsWith("/internal/place/index"))).toHaveLength(1);
  });

  it("in every language the placeholder speaks the page's language and links the page's own address", async () => {
    const a = await within(resolvePlacePage("en", "muenchen", prod(saturated([], { cards: "hang" }))), PLACE_PAGE_CARDS_MS + 50);
    const page = a as Extract<PlacePageAnswer, { kind: "page" }>;
    expect(page.place.label).toBe("München");
    expect(page.place.html).toContain("The cards for this place are loading");
    const reload = first(page.place.html, "noscript p.place-fill__note a");
    expect(reload?.attrs["href"]).toBe("/en/place/muenchen");
    expect(text(reload!)).toBe("Reload the page to see the cards");
  });

  it("cards the digest failed to give are the same loading page, at once", async () => {
    const a = await within(resolvePlacePage("de", "koeln", prod(saturated([], { cards: 500 }))), 20);
    expect(a).toMatchObject({ kind: "page", place: { label: "Köln" } });
    expect(loading(a)).toBe(true);
  });

  it("the charging filter of the address rides the fill, so the late cards are the filtered ones", async () => {
    const a = await within(resolvePlacePage("de", "koeln", { ...prod(saturated([], { cards: "hang" })), ev: "ev_op=swm&ev_free=1" }), PLACE_PAGE_CARDS_MS + 50);
    expect((a as Extract<PlacePageAnswer, { kind: "page" }>).place.html).toContain("&quot;ev&quot;:&quot;ev_op=swm&amp;ev_free=1&quot;");
  });

  it("cards inside the deadline are the page as before: no placeholder, not deferred", async () => {
    const a = await within(resolvePlacePage("de", "koeln", prod(saturated([]))), 20);
    expect(a).toMatchObject({ kind: "page", slug: "koeln" });
    expect(loading(a)).toBe(false);
    expect((a as Extract<PlacePageAnswer, { kind: "page" }>).place.html).not.toContain("data-vf-fill");
  });

  it("an unknown slug is still the 404, whatever the cards do", async () => {
    expect(await within(resolvePlacePage("de", "atlantis", prod(saturated([], { cards: "hang" }))), 20)).toEqual({ kind: "missing" });
  });

  it("a key that does not arrive is a 503 inside the two seconds — even when the env would allow longer", async () => {
    const f = saturated([], { key: "hang" });
    expect(await within(resolvePlacePage("de", "koeln", { baseUrl: "http://digest", timeoutMs: 10_000, fetchImpl: f }), PLACE_PAGE_BUDGET_MS - 100)).toBeNull();
    resetSlugKeys();
    expect(await within(resolvePlacePage("de", "koeln", { baseUrl: "http://digest", timeoutMs: 10_000, fetchImpl: f }), PLACE_PAGE_BUDGET_MS + 10)).toEqual({ kind: "unavailable" });
  });

  it("late cards and no name to title the page with: a 503 inside the budget, never a page named by a guess", async () => {
    const a = await within(resolvePlacePage("de", "koeln", prod(saturated([], { cards: "hang", index: 500 }))), PLACE_PAGE_BUDGET_MS + 10);
    expect(a).toEqual({ kind: "unavailable" });
  });

  /** The stub, with the slug's key answering only after `ms` (and honouring the abort as fetch does). */
  const lateKey = (asked: string[], ms: number, b: { cards?: "hang" } = {}): FetchLike => (url, init) => {
    if (!url.includes("/internal/place/key")) return saturated(asked, b)(url, init);
    asked.push(url);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => void digest([])(url, init).then(resolve, reject), ms);
      init.signal.addEventListener("abort", () => {
        clearTimeout(timer);
        const e = new Error("aborted");
        e.name = "AbortError";
        reject(e);
      });
    });
  };

  it("a cold key arriving at 1 900 ms: no cards read, the loading page by 2 000 ms — no floor stacks past the budget", async () => {
    const asked: string[] = [];
    const a = await within(resolvePlacePage("de", "koeln", prod(lateKey(asked, 1_900))), PLACE_PAGE_BUDGET_MS);
    expect(a).toMatchObject({ kind: "page", slug: "koeln", place: { label: "Köln" } });
    expect(loading(a)).toBe(true);
    // too little left for the cards' least wait and the name index: the cards were never asked
    expect(asked.some((u) => u.includes("/internal/place/cards"))).toBe(false);
  });

  it("#1310 A2: a verified crawler's key arriving at 3 000 ms is its page, not the 503 a person's two seconds leave", async () => {
    const asked: string[] = [];
    const a = await within(withAgentClass("search", () => resolvePlacePage("de", "koeln", prod(lateKey(asked, 3_000)))), CRAWLER_PAGE_BUDGET_MS);
    expect(a).toMatchObject({ kind: "page", slug: "koeln", place: { label: "Köln" } });
    resetSlugKeys();
    expect(await within(resolvePlacePage("de", "koeln", prod(lateKey([], 3_000))), PLACE_PAGE_BUDGET_MS + 10)).toEqual({ kind: "unavailable" });
  });

  it("#1310 A2: a verified crawler's key that never arrives is still answered inside its eight seconds", async () => {
    const a = await within(withAgentClass("search", () => resolvePlacePage("de", "koeln", prod(saturated([], { key: "hang" })))), CRAWLER_PAGE_BUDGET_MS + 10);
    expect(a).toEqual({ kind: "unavailable" });
  });

  it("a key arriving at 1 300 ms and cards that hang: the cards get what is left after the index's share, the page by 2 000 ms", async () => {
    const asked: string[] = [];
    const a = await within(resolvePlacePage("de", "koeln", prod(lateKey(asked, 1_300, { cards: "hang" }))), PLACE_PAGE_BUDGET_MS);
    expect(a).toMatchObject({ kind: "page", place: { label: "Köln" } });
    expect(loading(a)).toBe(true);
    expect(asked.some((u) => u.includes("/internal/place/cards"))).toBe(true);
  });

  it("the cards' live answers are never waited on past the budget, even when their read ignores its own deadline", async () => {
    const person = { method: "GET", url: "http://shell/de/place/koeln", headers: new Headers({ "user-agent": "Mozilla/5.0", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" }) };
    const never: FetchLike = () => new Promise<never>(() => undefined);
    const a = await within(resolvePlacePage("de", "koeln", { ...prod(saturated([])), request: person, asksUrl: "http://mcp", asksFetch: never }), PLACE_PAGE_BUDGET_MS);
    // the cards arrived: the page is theirs, without the answers that did not come in time
    expect(a).toMatchObject({ kind: "page", slug: "koeln" });
    expect(loading(a)).toBe(false);
  });

  it("placeFirstRender: the cards' least wait (CARDS_MIN_MS) never goes past the page's budget", async () => {
    const head = { method: "HEAD", headers: { get: () => null } };
    let out: string | null = null;
    void placeFirstRender("ags:05315000", "de", { ...prod(saturated([], { cards: "hang" })), how: "page", request: head, deadlineMs: 10, endsAt: Date.now() + 100 }).then((r) => (out = r.kind));
    await vi.advanceTimersByTimeAsync(100);
    expect(out).toBe("deferred");
    expect(CARDS_MIN_MS).toBeGreaterThan(100);
  });

  it("a request whose budget is partly spent (a legacy lookup before it) gives the page only what is left", async () => {
    const asked: string[] = [];
    const endsAt = Date.now() + 600;
    const a = await within(resolvePlacePage("de", "koeln", { ...prod(saturated(asked, { cards: "hang" })), endsAt }), 600);
    expect(a).toMatchObject({ kind: "page", place: { label: "Köln" } });
    expect(loading(a)).toBe(true);
    expect(asked.some((u) => u.includes("/internal/place/cards"))).toBe(false);
  });

  it("the deferred page's meta description is the place's own, from the index's name, in every language — never empty (#1141: a crawler gets this 200, not a 503)", async () => {
    for (const lang of LIVE_LANGS) {
      resetSlugKeys();
      const a = await within(resolvePlacePage(lang, "koeln", prod(saturated([], { cards: "hang" }))), PLACE_PAGE_CARDS_MS + 50);
      expect(loading(a), lang).toBe(true);
      const page = a as Extract<PlacePageAnswer, { kind: "page" }>;
      // what PlacePage.astro puts in the head (pinned below as its source)
      const meta = placeMeta(page.place.label, lang, placeNowOf(liftPlaceFirst(page.place.html).first));
      expect(meta.description, lang).toBe(placeMeta("Köln", lang).description);
      expect(meta.description, lang).toContain("Köln");
      expect(meta.description.length, lang).toBeGreaterThanOrEqual(60);
      expect(meta.description, lang).not.toMatch(/\{place\}|place\.pageDescription/);
      expect(meta.title, lang).toContain("Köln");
    }
    const layout = readFileSync(new URL("../src/layouts/PlacePage.astro", import.meta.url), "utf8");
    // the head's meta IS that one: nothing after it in the same object overrides its title or description
    expect(layout).toMatch(/dynamic=\{\{ \.\.\.placeMeta\(place\.label, lang, placeNowOf\(lifted\.first\), land\), path: placePath\(lang, slug\), alternates, jsonLd: [^}]*\}\}/);
  });

  it("an index the digest does not refresh keeps the one the shell holds (a stale name beats no page)", async () => {
    await within(resolvePlacePage("de", "koeln", prod(saturated([], { cards: "hang" }))), PLACE_PAGE_CARDS_MS + 50);
    await vi.advanceTimersByTimeAsync(PLACE_NAME_INDEX_TTL_MS + 1_000);
    resetSlugKeys();
    const a = await within(resolvePlacePage("de", "koeln", prod(saturated([], { cards: "hang", index: 500 }))), PLACE_PAGE_CARDS_MS + 50);
    expect(a).toMatchObject({ kind: "page", place: { label: "Köln" } });
    expect(loading(a)).toBe(true);
  });

  it("a fuel, charging or motorway page IS its fragment (head, 301, 404 come from it): a late digest is answered at the page deadline, now 2 s — a person's degraded 200, a crawler's 503 with Retry-After (#1205)", () => {
    const src = (p: string): string => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
    for (const p of ["pages/[lang]/fuel/[slug].astro", "pages/[lang]/charging/[slug].astro", "pages/[lang]/autobahn/[road]/[...rest].astro", "pages/[lang]/autobahn.astro"]) {
      expect(src(p), p).toContain("timeoutMs: env.placeTimeoutMs");
      expect(src(p), p).toContain('if (a.kind === "unavailable") return unavailableAnswer(lang, Astro.request);');
    }
    // the legacy redirects and the motorway fragments are bounded by the same 2 s
    expect(src("middleware.ts")).toContain("timeoutMs: env.placeTimeoutMs");
    for (const p of ["pages/fragment/motorway-near.ts", "pages/fragment/motorway-around.ts", "pages/fragment/motorway-fuel.ts"]) expect(src(p), p).toContain("timeoutMs: env.placeTimeoutMs");
  });

  it("the page loads the filler under the nonce and is never kept (a loading page is not a finished one)", () => {
    const layout = readFileSync(new URL("../src/layouts/PlacePage.astro", import.meta.url), "utf8");
    expect(layout).toContain('Astro.response.headers.set("Cache-Control", "no-store");');
    // SOURCE text (an Astro template), read as such: the filler's script element, inline under the nonce
    expect(layout).toMatch(/<script is:inline set:html=\{fillScript\(\)\} \/>/);
    const route = readFileSync(new URL("../src/pages/[lang]/place/[slug].astro", import.meta.url), "utf8");
    expect(route).toContain('if (a.kind === "unavailable") return unavailableAnswer(lang, Astro.request);');
  });
});
