/**
 * The live answers under the place cards' questions (#745) and the credits
 * every live answer carries (#744), over PRODUCTION's own answers: the MCP
 * side's fixture of real local answers (Leipzig and Fulda), projected by the
 * MCP side's own code, then parsed and rendered by the shell's — so the wire
 * format between the two is checked from both ends, and the data-steward's
 * conditions of 2026-10-15 are pinned on what a visitor would actually see:
 * C1 the DWD summary line, C2 the ODbL offer, C4 every source credited from the
 * register, C5 no fuel answer, C6 the share-alike note verbatim.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { all, text as nodeText } from "@viafrei/design/testing";
import { projectSiteExample, type SiteExampleKey } from "../../mcp/src/presentation/site-examples.js";
import { PLACE_CARD_IDS } from "../../digest/src/analysis/place.js";
import catalogue from "../src/generated/catalogue.json" with { type: "json" };
import { t } from "../src/i18n/index.js";
import { answerCreditsHtml, answerHtml, offerHtml } from "../src/lib/answer-html.js";
import { parseAsk, type AskEntry, type AskKey } from "../src/lib/ask.js";
import { placeRoute } from "../src/lib/fragment-route.js";
import { fetchLocalAsks, LOCAL_ASKS_PATH, PLACE_ASKS_FILL_MS, PLACE_ASKS_SSR_MS, PLACE_CARD_ASK, spliceAnswers } from "../src/lib/place-asks.js";
import { resolvePlacePage } from "../src/lib/place-page.js";
import { LIVE_LANGS, pathFor } from "../src/site/pages.js";
import type { FetchLike } from "../src/lib/tiles.js";

const REPO = new URL("../../../", import.meta.url);
const read = (rel: string): string => readFileSync(new URL(rel, REPO), "utf8");
const fixture = JSON.parse(read("packages/mcp/src/server/site-examples.fixture.json")) as { answers: Record<string, { structuredContent: unknown; _meta: unknown }> };
const TOOL: Readonly<Record<string, string>> = {
  weather: "check_weather_warnings",
  nearby: "find_nearby",
  poi: "find_poi",
  transit: "check_transit_disruption",
  roadsNear: "check_road_status",
  parking: "find_parking",
  chargingNear: "find_charging_station",
};
const AS_OF = "2026-10-15T00:50:00.000Z";
const NOW = new Date("2026-10-15T00:55:00.000Z");

/** One production answer, as the MCP process serves it and the shell parses it. */
function entry(id: string): AskEntry {
  const key = id.split(".")[1]!;
  const a = fixture.answers[id]!;
  const projection = projectSiteExample(key as SiteExampleKey, a.structuredContent, a._meta);
  expect(projection, id).not.toBeNull();
  const e = parseAsk(JSON.parse(JSON.stringify({ key, tool: TOOL[key], askedAt: AS_OF, projection })));
  expect(e, `${id} parses on the shell's side`).not.toBeNull();
  return e!;
}
const ids = Object.keys(fixture.answers);

describe("production's local answers, rendered (#745)", () => {
  it("every one of them renders in all seven languages", () => {
    expect(ids.length).toBe(14);
    for (const id of ids) for (const lang of LIVE_LANGS) expect(answerHtml(lang, entry(id), NOW, "place"), `${id} ${lang}`).toMatch(/^<div class="qa-answer live-ask__answer is-(?:ok|stale)" data-ask="/u);
  });

  it("C4: every source they carry is in the register's catalogue, so each is credited with its licence link — never the plain fallback", () => {
    const known = new Set(catalogue.credits.map((c) => c.id));
    for (const id of ids) {
      for (const s of entry(id).projection.sources) expect(known.has(s), `${id}: ${s}`).toBe(true);
      const html = answerCreditsHtml("de", entry(id));
      expect(all(html, "ul.credits.qa-answer__credits").length, id).toBeGreaterThan(0);
      expect(html, id).not.toContain("live-ask__credit");
    }
    // The BKG's GN250 links (the words "BKG" and "dl-de/by-2-0"), where the transit answer names a Gemeinde from it.
    const bkg = catalogue.credits.find((c) => c.id === "bkg_gvisys");
    if (bkg?.parts != null) for (const p of bkg.parts.filter((x) => x.href !== null)) expect(answerCreditsHtml("de", entry("leipzig.transit"))).toContain(`href="${p.href}"`);
  });

  it("C1: a weather answer is credited 'Datenbasis: Deutscher Wetterdienst, zusammengefasst' with the licence link, never 'Quelle:', and without the road-station note", () => {
    for (const at of ["leipzig", "fulda"]) {
      const html = answerHtml("de", entry(`${at}.weather`), NOW, "place")!;
      expect(html).toContain(">Datenbasis: Deutscher Wetterdienst, zusammengefasst</a>");
      expect(html).toContain('href="https://creativecommons.org/licenses/by/4.0/"');
      expect(html).not.toContain("Quelle: Deutscher Wetterdienst");
      expect(html).not.toContain("Glättemeldeanlagen");
      expect(html).not.toContain("BMVBS");
    }
  });

  it("C2: an answer from OpenStreetMap carries the ODbL § 4.6 offer in the page's language, linking that language's Impressum", () => {
    for (const id of ["leipzig.nearby", "fulda.nearby", "leipzig.poi", "fulda.poi"]) {
      for (const lang of LIVE_LANGS) {
        const html = answerHtml(lang, entry(id), NOW, "place")!;
        const link = `<a href="${pathFor("impressum", lang)}">`;
        expect(html, `${id} ${lang}`).toContain(link);
        expect(all(html, ".qa-answer__note.qa-answer__offer").length, `${id} ${lang}`).toBeGreaterThan(0);
        expect(html.replace(/<[^>]+>/gu, "").replace(/&#39;/gu, "'"), `${id} ${lang}`).toContain(t(lang, "ask.offerOsm", { link: t(lang, "ask.offerLink") }));
      }
    }
    // An answer with no ODbL source carries no offer.
    for (const id of ["leipzig.roadsNear", "fulda.chargingNear", "leipzig.weather"]) expect(answerHtml("de", entry(id), NOW, "place"), id).not.toContain("qa-answer__offer");
  });

  it("C2: Trucklounge's rows carry the offer naming its database, once for both of its feeds", () => {
    const html = offerHtml("en", ["autobahn", "mobilithek_park_trucklounge", "mobilithek_park_trucklounge_occ"]);
    expect(html.match(/qa-answer__offer/gu)).toHaveLength(1);
    expect(all(html, "span[translate=\"no\"]").map(nodeText)).toContain("Trucklounge Ecopark");
    expect(all(html, "a[href=\"/en/impressum\"]").map(nodeText)).toContain("imprint");
    expect(offerHtml("de", ["osm", "mobilithek_park_trucklounge"]).match(/qa-answer__offer/gu)).toHaveLength(2);
    expect(offerHtml("de", ["autobahn", "bnetza_lsr"])).toBe("");
  });

  it("the offers are the digest's own sentences, so a place card and its answer make the same offer", async () => {
    const { PLACE_COPY } = await import("../../digest/src/presentation/i18n-place.js");
    const { PLACE_MORE_COPY } = await import("../../digest/src/presentation/i18n-place-more.js");
    const tile = read("packages/digest/src/cards/parking/html.ts");
    expect(tile).toContain('const SHARE_ALIKE_DATABASE_NAME = { trucklounge: "Trucklounge Ecopark"');
    for (const lang of LIVE_LANGS) {
      expect(t(lang, "ask.offerOsm", { link: "L" })).toBe(PLACE_COPY[lang].odbl.offer.replace("{link}", "L"));
      expect(t(lang, "ask.offerDb", { db: "D", link: "L" })).toBe(PLACE_MORE_COPY[lang].shareAlike.offer.replace("{db}", "D").replace("{link}", "L"));
      expect(t(lang, "ask.offerLink")).toBe(PLACE_COPY[lang].odbl.offerLink);
    }
  });

  it("C6: DELFI's share-alike note (the adapter's licence) stands verbatim under a transit answer", () => {
    for (const at of ["leipzig", "fulda"]) {
      const note = (fixture.answers[`${at}.transit`]!.structuredContent as { shareAlikeNote: string }).shareAlikeNote;
      expect(note).toContain("CC BY-SA");
      const esc = note.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;").replace(/"/gu, "&quot;").replace(/'/gu, "&#39;");
      expect(all(answerHtml("de", entry(`${at}.transit`), NOW, "place") ?? "", "p.qa-answer__note[lang=\"de\"]").map(nodeText)).toContain(`${esc}`);
    }
  });

  it("C5: the shell refuses an answer that carries Tankerkönig, whatever the MCP side sent", () => {
    const e = JSON.parse(JSON.stringify({ key: "roadsNear", tool: "check_road_status", askedAt: AS_OF, projection: entry("leipzig.roadsNear").projection })) as { projection: { sources: string[] } };
    expect(parseAsk(e)).not.toBeNull();
    for (const id of ["tankerkoenig", "tankerkoenig_hist"]) expect(parseAsk({ ...e, projection: { ...e.projection, sources: [...e.projection.sources, id] } }), id).toBeNull();
    expect(parseAsk({ ...e, projection: { ...e.projection, summarised: "yes" } })).toBeNull();
  });
});

/** A place section in the digest's shape (`place-tiles.ts` `card()`), pinned to the digest's source below. */
function cards(...ids: readonly { readonly id: string; readonly ask: boolean }[]): string {
  return (
    '<section class="place" id="place-cards">' +
    ids
      .map(
        (c) =>
          `<article class="pcard pcard--ok" id="pcard-${c.id}" aria-labelledby="pcard-${c.id}-t"><header class="pcard__head"><h3 class="pcard__title" id="pcard-${c.id}-t">${c.id}</h3></header>` +
          `<p class="pcard__lead">lead</p>` +
          (c.ask ? `<p class="pcard__ask"><span class="pcard__asklabel">Fragen:</span> <q class="pcard__q">Q ${c.id}</q></p>` : "") +
          `<footer class="pcard__foot">credits</footer></article>`,
      )
      .join("") +
    "</section>"
  );
}
const local = (): ReadonlyMap<AskKey, AskEntry> => new Map(["weather", "roadsNear", "poi", "chargingNear", "parking"].map((k) => [k as AskKey, entry(`fulda.${k}`)]));

describe("spliceAnswers", () => {
  it("puts each answer directly after its card's question, inside that card, before its footer", () => {
    const html = spliceAnswers(cards({ id: "warnings", ask: true }, { id: "roads", ask: true }, { id: "health", ask: true }, { id: "charging", ask: true }, { id: "parking", ask: true }), "de", local(), NOW);
    for (const [card, key] of Object.entries(PLACE_CARD_ASK)) {
      const a = html.indexOf(`id="pcard-${card}"`);
      const end = html.indexOf("</article>", a);
      const q = html.indexOf(`<q class="pcard__q">Q ${card}</q></p>`, a);
      expect(html.slice(q + `<q class="pcard__q">Q ${card}</q></p>`.length), card).toMatch(new RegExp(`^<div class="qa-answer live-ask__answer is-(?:ok|stale)" data-ask="${key}">`, "u"));
      expect(html.indexOf('<footer class="pcard__foot">', a)).toBeGreaterThan(html.indexOf(`data-ask="${key}"`, a));
      expect(html.slice(a, end).match(/data-ask=/gu), card).toHaveLength(1);
    }
  });

  it("leaves a card alone that asks nothing (an error card), has no answer, or has no answering ask — and the whole HTML when there are none", () => {
    const html = cards({ id: "warnings", ask: false }, { id: "roads", ask: true }, { id: "stations", ask: true }, { id: "fuel", ask: true });
    const only = new Map<AskKey, AskEntry>([["poi", entry("fulda.poi")]]);
    expect(spliceAnswers(html, "de", only, NOW)).toBe(html);
    expect(spliceAnswers(html, "de", new Map(), NOW)).toBe(html);
    const w = spliceAnswers(html, "de", local(), NOW);
    expect(w).not.toContain('data-ask="weather"');
    expect(w).toContain('data-ask="roadsNear"');
    expect(w.match(/data-ask=/gu)).toHaveLength(1);
  });

  it("never asks for fuel, and answers only cards the digest renders", () => {
    expect(Object.keys(PLACE_CARD_ASK)).not.toContain("fuel");
    for (const card of Object.keys(PLACE_CARD_ASK)) expect(PLACE_CARD_IDS as readonly string[]).toContain(card);
  });

  it("relies on exactly the markup the digest's card renderer writes", () => {
    const tile = read("packages/digest/src/presentation/place-tiles.ts");
    expect(tile).toContain('`<article class="pcard pcard--${c.verdict}" id="pcard-${c.id}" aria-labelledby="pcard-${c.id}-t"${refreshData(lang, c.id, refresh)}>`');
    expect(tile).toContain('`<p class="pcard__ask"><span class="pcard__asklabel">${safe(copy.ask.label)}:</span> <q class="pcard__q">${fillHtml(cardAsk(lang, c.id), { place: nameHtml(place) })}</q></p>`');
    // The question line comes before the footer; the watch line (a second `pcard__ask`) after it.
    expect(tile.indexOf("    ask +\n    watch +")).toBeGreaterThan(0);
  });
});

/** A listener stub: records each URL, answers `body` with `status`. */
const listener = (asked: string[], body: unknown, status = 200): FetchLike => (url) => {
  asked.push(url);
  return Promise.resolve({ status, headers: { get: () => "application/json" }, text: () => Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)) });
};
const wire = (id: string): unknown => JSON.parse(JSON.stringify(entry(id)));

describe("fetchLocalAsks", () => {
  it("asks the internal listener for a Gemeinde key and keeps the first answer per key", async () => {
    const asked: string[] = [];
    const m = await fetchLocalAsks("ags:06631009", { baseUrl: "http://mcp:8788", timeoutMs: 500, fetchImpl: listener(asked, { state: "answered", answers: [wire("fulda.poi"), wire("leipzig.poi"), wire("fulda.weather"), { key: "fuel" }] }) });
    expect(asked).toEqual([`http://mcp:8788${LOCAL_ASKS_PATH}?at=ags:06631009`]);
    expect([...m.keys()]).toEqual(["poi", "weather"]);
    expect(m.get("poi")?.projection).toEqual(entry("fulda.poi").projection);
  });

  it("asks nothing for anything but ags:<8 digits>, or with no listener configured", async () => {
    const asked: string[] = [];
    for (const at of ["pt:50.55,9.68", "ags:0663100", "ags:066310091", "ags:06631009&x=1", ""]) expect((await fetchLocalAsks(at, { baseUrl: "http://mcp:8788", timeoutMs: 500, fetchImpl: listener(asked, {}) })).size, at).toBe(0);
    expect((await fetchLocalAsks("ags:06631009", { baseUrl: undefined, timeoutMs: 500, fetchImpl: listener(asked, {}) })).size).toBe(0);
    expect(asked).toEqual([]);
  });

  it("a non-200, a body that is not JSON or not the shape, or a fetch that throws: no answers, never an error", async () => {
    const o = (f: FetchLike) => fetchLocalAsks("ags:06631009", { baseUrl: "http://mcp:8788", timeoutMs: 500, fetchImpl: f });
    expect((await o(listener([], { answers: [wire("fulda.poi")] }, 503))).size).toBe(0);
    expect((await o(listener([], "<html>"))).size).toBe(0);
    expect((await o(listener([], { answers: "no" }))).size).toBe(0);
    expect((await o(() => Promise.reject(new Error("down")))).size).toBe(0);
  });
});

describe("the place fragment route asks the answers for a person only (#745)", () => {
  const PERSON = { "content-type": "application/json", "user-agent": "Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0", "sec-fetch-site": "same-origin", "sec-fetch-mode": "cors", "sec-fetch-dest": "empty" };
  const digest: FetchLike = () =>
    Promise.resolve({
      status: 200,
      headers: { get: (n: string) => ({ "content-type": "text/html; charset=utf-8", "place-key": "ags:06631009", "place-label": "Fulda", "place-point": "0" })[n] ?? null },
      text: () => Promise.resolve(cards({ id: "health", ask: true })),
    });
  const post = (body: unknown, headers: Record<string, string>): Request => new Request("http://shell/fragment/place", { method: "POST", headers, body: JSON.stringify(body) });

  it("a person's request: the answers of the Gemeinde the cards name, spliced under the question", async () => {
    const asked: string[] = [];
    const res = await placeRoute(post({ at: "pt:50.55,9.68", lang: "de", how: "browser" }, PERSON), { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: digest, asksUrl: "http://mcp:8788", asksFetch: listener(asked, { answers: [wire("fulda.poi")] }) });
    expect(asked).toEqual([`http://mcp:8788${LOCAL_ASKS_PATH}?at=ags:06631009`]);
    expect(await res.text()).toContain('data-ask="poi"');
  });

  it("a Gemeinde key is asked at once, beside the cards", async () => {
    const asked: string[] = [];
    await placeRoute(post({ at: "ags:06631009", lang: "de", how: "manual" }, PERSON), { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: digest, asksUrl: "http://mcp:8788", asksFetch: listener(asked, { answers: [] }) });
    expect(asked).toHaveLength(1);
  });

  it("a crawler, a request from another site, `held` or no `how`: the digest's cards as they are, and the listener is never asked", async () => {
    const cases: [Record<string, unknown>, Record<string, string>][] = [
      [{ at: "ags:06631009", lang: "de", how: "manual" }, { ...PERSON, "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" }],
      [{ at: "ags:06631009", lang: "de", how: "manual" }, { ...PERSON, "sec-fetch-site": "cross-site" }],
      [{ at: "ags:06631009", lang: "de", how: "held" }, PERSON],
      [{ at: "ags:06631009", lang: "de" }, PERSON],
    ];
    for (const [body, headers] of cases) {
      const asked: string[] = [];
      const res = await placeRoute(post(body, headers), { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: digest, asksUrl: "http://mcp:8788", asksFetch: listener(asked, { answers: [wire("fulda.poi")] }) });
      expect(asked, JSON.stringify(body)).toEqual([]);
      expect(await res.text()).toBe(cards({ id: "health", ask: true }));
    }
  });
});

/** A listener that never answers: it settles only when the caller's deadline aborts the request. */
const hanging = (asked: string[]): FetchLike => (url, init) => {
  asked.push(url);
  return new Promise((_resolve, reject) => {
    const signal = (init as { signal?: AbortSignal } | undefined)?.signal;
    signal?.addEventListener("abort", () => reject(new Error("aborted")));
  });
};
const fuldaDigest: FetchLike = (url) =>
  // #892: a place page's slug is resolved to its key first
  url.includes("/internal/place/key?slug=")
    ? Promise.resolve({ status: 200, headers: { get: (n: string) => (n === "content-type" ? "text/html; charset=utf-8" : null) }, text: () => Promise.resolve('<p class="place-key">ags:06631009</p>') })
    : Promise.resolve({
    status: 200,
    headers: { get: (n: string) => ({ "content-type": "text/html; charset=utf-8", "place-key": "ags:06631009", "place-label": "Fulda", "place-point": "0" })[n] ?? null },
    text: () => Promise.resolve(cards({ id: "health", ask: true })),
  });

describe("deadlines (2.1.18 review): a person's own request never waits long for the answers", () => {
  const PERSON = { "content-type": "application/json", "user-agent": "Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0", "sec-fetch-site": "same-origin", "sec-fetch-mode": "cors", "sec-fetch-dest": "empty" };
  const post = (body: unknown): Request => new Request("http://shell/fragment/place", { method: "POST", headers: PERSON, body: JSON.stringify(body) });

  it("the island's request (a located visitor, how: browser) waits at most the short deadline, then answers the cards unchanged", async () => {
    const asked: string[] = [];
    const t0 = Date.now();
    const res = await placeRoute(post({ at: "pt:50.55,9.68", lang: "de", how: "browser" }), { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: fuldaDigest, asksUrl: "http://mcp:8788", asksFetch: hanging(asked) });
    const ms = Date.now() - t0;
    expect(asked).toHaveLength(1);
    expect(await res.text()).toBe(cards({ id: "health", ask: true }));
    expect(ms).toBeGreaterThanOrEqual(PLACE_ASKS_SSR_MS - 20);
    expect(ms).toBeLessThan(PLACE_ASKS_SSR_MS + 600);
  });

  it("only the background fill (how: fill) waits the longer deadline", async () => {
    const t0 = Date.now();
    await placeRoute(post({ at: "ags:06631009", lang: "de", how: "fill" }), { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: fuldaDigest, asksUrl: "http://mcp:8788", asksFetch: hanging([]) });
    expect(Date.now() - t0).toBeGreaterThanOrEqual(PLACE_ASKS_FILL_MS - 20);
  }, PLACE_ASKS_FILL_MS + 5_000);
});

describe("the first render of a place page asks the answers for a person only (#745, 2.1.18 review)", () => {
  const NAV = { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document", "sec-fetch-site": "none" };
  const req = (method: string, headers: Record<string, string>): { method: string; headers: Headers; url: string } => ({ method, headers: new Headers(headers), url: "http://shell/de/place/fulda" });
  const slug = "fulda";
  const page = (request: ReturnType<typeof req>, asksFetch: FetchLike) =>
    resolvePlacePage("de", slug, { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: fuldaDigest, asksUrl: "http://mcp:8788", asksFetch, request });

  it("a person's navigation asks once and the page carries the answer under its card's question", async () => {
    const asked: string[] = [];
    const r = await page(req("GET", NAV), listener(asked, { answers: [wire("fulda.poi")] }));
    expect(asked).toEqual([`http://mcp:8788${LOCAL_ASKS_PATH}?at=ags:06631009`]);
    expect(r.kind).toBe("page");
    expect(r.kind === "page" ? r.place.html : "").toContain('data-ask="poi"');
  });

  it("a crawler, a prefetch, a HEAD or the page's own reload: the listener is never asked and the cards are the digest's, byte for byte", async () => {
    const cases: [string, ReturnType<typeof req>][] = [
      ["Googlebot", req("GET", { ...NAV, "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" })],
      ["prefetch", req("GET", { ...NAV, "sec-purpose": "prefetch" })],
      ["HEAD", req("HEAD", NAV)],
      ["no user agent", req("GET", { ...NAV, "user-agent": "" })],
    ];
    for (const [name, r0] of cases) {
      const asked: string[] = [];
      const r = await page(r0, listener(asked, { answers: [wire("fulda.poi")] }));
      expect(asked, name).toEqual([]);
      expect(r.kind === "page" ? r.place.html : "", name).toBe(cards({ id: "health", ask: true }));
    }
  });

  it("a listener that never answers holds the page no longer than the short deadline", async () => {
    const t0 = Date.now();
    const r = await page(req("GET", NAV), hanging([]));
    expect(Date.now() - t0).toBeLessThan(PLACE_ASKS_SSR_MS + 600);
    // the digest's cards as they came — since #1065 unwrapped: the fuel card's own fragment asks the prices (no fill marker)
    expect(r.kind === "page" ? r.place.html : "").not.toContain("data-vf-fill");
    expect(r.kind === "page" ? r.place.html : "").toContain(cards({ id: "health", ask: true }));
  });
});
