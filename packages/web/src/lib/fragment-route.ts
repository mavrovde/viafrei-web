/**
 * The two fragment routes the location island calls (#564 § 7), as plain
 * functions of a request so a test can drive them without Astro.
 *
 * POST with a small JSON body, never a query string: the edge's access log
 * records the request line for seven days (the edge configuration `vf_visits`),
 * so a place or a typed town in the URL would sit there beside the address.
 * The body is read up to 512 bytes, the answer is the digest's HTML fragment
 * (checked by `lib/place.ts`) and `no-store`; anything else is a 400, a 404
 * or a 503 with an empty body (#1224: the digest did not answer, so the page asks again). The visitor's address is not read here at all.
 */
import { isLang, t } from "../i18n/index.js";
import type { Lang } from "../site/pages.js";
import { placeFill } from "./fill.js";
import { askRefresh, fillCounter, FUEL_FILL_HEAD_STEPS, FUEL_FILL_POLLS_SEEN, FUEL_FILL_RETRY_MS, FUEL_REFRESH_BG_MS, fillOf, fragmentAsks, personAsks, type FuelNote, type PostLike } from "./fuel-refresh.js";
import { FUEL_PRIVATE_HEADERS } from "./fuel-fragment.js";
import { farPlaceHtml, fetchPlaceAnswer, placeKeyOfSlug, placePointOfPick } from "./place.js";
import { isPickKey } from "../location/ladder.js";
import { chargingFilterForward } from "./charging-filter.js";
import { fetchLocalAsks, PLACE_ASKS_FILL_MS, PLACE_ASKS_SSR_MS, spliceAnswers } from "./place-asks.js";
import { fetchTile, isEmbeddedTile, type FetchLike, type TileFetchOptions } from "./tiles.js";
import { fetchStationSuggest } from "./suggest.js";
import { renderResults, siteSearch } from "./site-search.js";
import { headerSuggest } from "./header-suggest.js";

const MAX_BODY = 512;

/**
 * At most `MAX_BODY` BYTES of the body, read from the stream and no further:
 * a larger body is refused after byte 513 is seen and the rest is never read
 * (review N3 — `req.text()` buffered the whole upload before the check). A
 * declared `content-length` above the cap is refused before any read.
 */
async function capped(req: Request): Promise<string | null> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY) return null;
  if (req.body === null) return "";
  const reader = req.body.getReader();
  const parts: Uint8Array[] = [];
  let n = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      n += value.byteLength;
      if (n > MAX_BODY) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      parts.push(value);
    }
  } catch {
    return null;
  }
  const all = new Uint8Array(n);
  let o = 0;
  for (const p of parts) {
    all.set(p, o);
    o += p.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(all);
}

export async function bodyOf(req: Request): Promise<Record<string, unknown> | null> {
  if (!(req.headers.get("content-type") ?? "").startsWith("application/json")) return null;
  const text = await capped(req);
  if (text === null) return null;
  try {
    const v: unknown = JSON.parse(text);
    return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const NO_STORE: Readonly<Record<string, string>> = { "cache-control": "no-store" };
/**
 * #1065 (steward C2 / PF4): every answer of `/fragment/place` — it can hand a person's script the fuel card's
 * Tankerkönig rows — carries the fuel fragments' `private, no-store` and the full `X-Robots-Tag`, a 4xx and a 5xx too.
 */
export const PLACE_FRAGMENT_HEADERS: Readonly<Record<string, string>> = FUEL_PRIVATE_HEADERS;
const empty = (status: number, base: Readonly<Record<string, string>> = NO_STORE): Response => new Response(null, { status, headers: { ...base } });
const html = (body: string, extra: Record<string, string> = {}, base: Readonly<Record<string, string>> = NO_STORE): Response =>
  new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8", ...base, ...extra } });

const langOf = (b: Record<string, unknown>): Lang | null => (typeof b["lang"] === "string" && isLang(b["lang"]) ? b["lang"] : null);

/** Where the fuel refresh is asked (the MCP process's internal listener), and an injectable fetch for the tests. */
export type RefreshOptions = {
  readonly refreshUrl?: string | undefined;
  readonly refreshFetch?: PostLike;
  /** The same listener's live answers for the cards (#745), and an injectable fetch for the tests. */
  readonly asksUrl?: string | undefined;
  readonly asksFetch?: FetchLike;
};

/** #1184: how long the placeholder of a refused fill waits before it asks again (the filler's own floor). */
export const PLACE_BUSY_REFILL_MS = 2_000;

/**
 * #1198 review: a read that did not ARRIVE (the deadline, a refused connection, a 5xx other than the 503 refusal) is the
 * expensive case — a digest that is slow or away — so its placeholder backs off: 2 s on the first miss (the first ask of
 * an unread place answered the next time in 1.6 s on prod), doubling per miss, never beyond the filler's 30 s retry.
 */
export function placeLateRefillMs(polls: number): number {
  return Math.min(PLACE_BUSY_REFILL_MS * 2 ** Math.max(0, polls), FUEL_FILL_RETRY_MS);
}

/**
 * The island's place request. Since #564 it carries `how` — how the place was
 * obtained (`manual`, `browser`, `saved`, `auto`, `page`, `ip`, or `fill`, the
 * background re-read of a first render whose fuel prices were on their way) —
 * and a person's request with a known `how` asks the fuel refresh for the
 * place first (`lib/fuel-refresh.ts`; every limit lives in the MCP process).
 * A missing or unknown `how`, `held` (the island on a page the meta refresh
 * reloaded), a crawler, a prefetch, a request the browser does not mark as
 * coming from this origin's page: the cards from held prices, no refresh. `snap: true` answers a point as its Gemeinde (the IP rung's fill).
 * The answer is the digest's section; while the prices are STILL on their way
 * (the request runs or waits in the MCP queue) it is wrapped to be filled
 * again (`lib/fill.ts`), for as long as they are pending — no count, no clock
 * (owner 2026-10-15: no lost requests). Every fill asks the refresh again, so a
 * request an MCP restart lost is submitted again (#712).
 */
export async function placeRoute(req: Request, o: TileFetchOptions & RefreshOptions): Promise<Response> {
  if (req.method !== "POST") return empty(405, PLACE_FRAGMENT_HEADERS);
  const b = await bodyOf(req);
  const lang = b === null ? null : langOf(b);
  if (b === null || lang === null || typeof b["at"] !== "string") return empty(400, PLACE_FRAGMENT_HEADERS);
  // #892: a place picked by its page's link is named by its slug; the refresh, the live answers and the cards take
  // the Gemeinde's key, so the slug is turned into it first (`placeKeyOfSlug`, kept per slug in this process).
  let at = b["at"];
  if (at.startsWith("slug:")) {
    const key = await placeKeyOfSlug(at.slice("slug:".length), o);
    if (key === undefined) return empty(503, PLACE_FRAGMENT_HEADERS);
    if (key === null) return empty(404, PLACE_FRAGMENT_HEADERS);
    at = key;
  }
  // #1088: a picked district or postcode keeps its own key for the cards (the digest heads them by exactly what was
  // picked); the fuel refresh is asked about the point it stands for, which the digest names.
  let refreshAt = at;
  if (isPickKey(at)) {
    const point = await placePointOfPick(at, o);
    if (point === undefined) return empty(503, PLACE_FRAGMENT_HEADERS);
    if (point === null) return empty(404, PLACE_FRAGMENT_HEADERS);
    refreshAt = point;
  }
  const how = b["how"];
  const snap = b["snap"] === true;
  let fuel: FuelNote | null = null;
  const person = fragmentAsks(req, how);
  // #745: the cards' live answers, for the same person's request only, asked beside the fuel refresh when the key is
  // already a Gemeinde's, else once the cards name it. A person's own request waits the first render's short deadline;
  // only the background fill (`how: "fill"`, which nobody is watching load) waits longer.
  const asksMs = how === "fill" ? PLACE_ASKS_FILL_MS : PLACE_ASKS_SSR_MS;
  const local = (key: string) => fetchLocalAsks(key, { baseUrl: o.asksUrl, timeoutMs: asksMs, ...(o.asksFetch === undefined ? {} : { fetchImpl: o.asksFetch }) });
  const early = person && /^ags:\d{8}$/u.test(at) ? local(at) : null;
  if (person) {
    fuel = await askRefresh(refreshAt, { url: o.refreshUrl, timeoutMs: FUEL_REFRESH_BG_MS, snap, ...(o.refreshFetch === undefined ? {} : { fetchImpl: o.refreshFetch }) });
  }
  // What the cards come back wrapped for, if anything (#712: `fillOf` holds the
  // fill rule — re-read while the request waits in the queue, until it settles).
  const polls = fillCounter(b["polls"], FUEL_FILL_POLLS_SEEN);
  // No lost requests (owner 2026-10-15): a pending card is wrapped again for as long as it is pending — never
  // turned into "unavailable" by a count or a clock; only the MCP process's own `failed`/`refused` says that.
  const head = fillCounter(b["head"], FUEL_FILL_HEAD_STEPS);
  const next = person ? fillOf(fuel, how, polls, head) : null;
  // #1065 (steward C2 / PF4): the fuel card's rows go to a PERSON's script only — a crawler, a cross-site or
  // Fetch-Metadata-less request, a HEAD or a prefetch gets the card as its frame (`fuelRows=0`); every other card is
  // served to everyone. `personAsks`, not `fragmentAsks`: the home's own `held` reload still shows a person the prices.
  const shows = personAsks(req, "fragment");
  // #1081: the page's charging filter, as the island read it off the address — cut to its shape again here.
  const ev = typeof b["ev"] === "string" && b["ev"].length <= 2000 ? chargingFilterForward(new URLSearchParams(b["ev"])) : "";
  // #1184: the fill lane only for the shape of a script's fetch from this origin's page (`personAsks(…, "fragment")`:
  // same-origin, `Sec-Fetch-Dest: empty`, no crawler, no prefetch) — a walk replaying a navigation asks in the page lane
  const a = await fetchPlaceAnswer(at, lang, { ...o, fuel, fill: shows, ...(snap ? { snap: true } : {}), ...(shows ? {} : { deferFuel: true }), ...(ev === "" ? {} : { ev }) });
  // #1070: a position far from Germany is answered with "all of Germany" — the island shows it and remembers nothing.
  if (a.kind === "far") return html(farPlaceHtml(lang), { "place-outside": "far", "place-label": encodeURIComponent(t(lang, "place.germany")) }, PLACE_FRAGMENT_HEADERS);
  // #1184: cards the digest refused at its cold-read limit are the placeholder again, re-filled after the filler's
  // shortest delay (2 s) — never the 404 the filler takes as final, which would leave a person "could not be loaded";
  // #1198: so are cards whose read missed the deadline (the first ask of a place nobody had asked for yet)
  // — those back off per miss (`placeLateRefillMs`, the miss count carried as `polls`); the 503 refusal stays at 2 s
  if (a.kind === "failed" && a.busy === true) {
    const late = a.late === true;
    const miss = late ? { polls: Math.min(polls + 1, FUEL_FILL_POLLS_SEEN) } : {};
    return html(placeFill(null, { at, lang, how: "fill", ...miss, ...(snap ? { snap: true as const } : {}) }, fuelFailText(lang), lang, late ? placeLateRefillMs(polls) : PLACE_BUSY_REFILL_MS), {}, PLACE_FRAGMENT_HEADERS);
  }
  // #1198: "no such place" is the 404 and nothing else. #1224: any other answer that is not the cards is a digest that
  // did not answer — a 503, private and no-store, which the island and the filler ask again (`lib/fragment-retry.ts`)
  if (a.kind === "missing") return empty(404, PLACE_FRAGMENT_HEADERS);
  if (a.kind !== "place") return empty(503, PLACE_FRAGMENT_HEADERS);
  const p = a.place;
  const cards = spliceAnswers(p.html, lang, person ? await (early ?? local(p.at)) : new Map());
  const body = next !== null ? placeFill(cards, { at, lang, how: next.how, polls: next.polls, head: next.head, ...(snap ? { snap: true as const } : {}) }, fuelFailText(lang), lang, next.delayMs) : cards;
  // #1143: the place page's slug beside its name, so the pill links to the place it names (a point has none)
  return html(body, { "place-key": p.at, "place-label": encodeURIComponent(p.label), ...(p.slug === undefined ? {} : { "place-slug": p.slug }), ...(p.outside === "border" ? { "place-outside": "border" } : {}) }, PLACE_FRAGMENT_HEADERS);
}

/**
 * The sentence the fuel card's pending note becomes when its background fill
 * fails: the digest's own "could not be asked" words, carried by the shell
 * because the shell is what saw the failure. Kept identical to
 * `packages/digest` `PLACE_COPY[lang].fuel.refresh.unavailable` by a test.
 */
export function fuelFailText(lang: Lang): string {
  return t(lang, "place.fuelUnavailable");
}

/** GET `/fragment/tile?id=…&lang=…` — one live tile, for a placeholder the first render could not fill in time (#564). */
export async function tileRoute(req: Request, o: TileFetchOptions): Promise<Response> {
  if (req.method !== "GET") return empty(405);
  const u = new URL(req.url);
  const id = u.searchParams.get("id");
  const lang = u.searchParams.get("lang");
  if (!isEmbeddedTile(id) || lang === null || !isLang(lang)) return empty(400);
  const r = await fetchTile(id, lang, o);
  // The shell's error tile is not an answer here: the placeholder turns itself into it.
  return r.fetched === "ok" ? html(r.html) : empty(502);
}

/** POST `/fragment/station-suggest` (2.4.6) — the station search's suggestions for what was typed, `{ q, lang }`. */
export async function stationSuggestRoute(req: Request, o: TileFetchOptions): Promise<Response> {
  if (req.method !== "POST") return empty(405);
  const b = await bodyOf(req);
  const lang = b === null ? null : langOf(b);
  if (b === null || lang === null || typeof b["q"] !== "string") return empty(400);
  const s = await fetchStationSuggest(b["q"], lang, o);
  return s === null ? empty(502) : html(s);
}

/**
 * POST `/fragment/search` (#1111) — the header box's suggestions for what was typed, `{ q, lang }`: the digest's groups
 * and the shell's own (pages, News), merged. What was typed travels in the body, never in an address, and is kept by
 * nobody (no-store; nothing logs it).
 */
export async function siteSearchRoute(req: Request, o: TileFetchOptions): Promise<Response> {
  if (req.method !== "POST") return empty(405);
  const b = await bodyOf(req);
  const lang = b === null ? null : langOf(b);
  if (b === null || lang === null || typeof b["q"] !== "string") return empty(400);
  const q = b["q"];
  const r = await siteSearch(lang, q, o, { mode: "suggest" });
  return r === null ? empty(400) : html(renderResults(lang, q, r, { mode: "suggest" }));
}

/**
 * POST `/fragment/suggest` — the header's one search (#1153): the places and the site search's other kinds in one list
 * (`lib/header-suggest.ts`), `{ q, lang }`. 2.5.8 (#1111 AC 7): a query it accepts is always a 200 — a digest that is
 * late or down leaves its groups out and the box says so; a 400 is what is no question (2–80 characters).
 */
export async function suggestRoute(req: Request, o: TileFetchOptions): Promise<Response> {
  if (req.method !== "POST") return empty(405);
  const b = await bodyOf(req);
  const lang = b === null ? null : langOf(b);
  if (b === null || lang === null || typeof b["q"] !== "string") return empty(400);
  const s = await headerSuggest(lang, b["q"], o);
  return s === null ? empty(400) : html(s);
}
