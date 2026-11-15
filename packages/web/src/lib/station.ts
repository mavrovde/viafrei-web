/**
 * The station fragments of #1041, fetched from the digest's internal routes
 * like the motorway pages' (`lib/motorway.ts`): one GET under a deadline, an
 * answer that is not recognisably ours is no answer, nothing throws past the
 * caller. The last body per URL is kept with its ETag and asked again with
 * `If-None-Match`, so an unchanged page costs the digest a 304 and no render;
 * the digest's own cache, keyed by the source version, is the second level
 * (`packages/digest/src/server/station-service.ts`).
 *
 * Redirects are NOT followed: a renamed station's old slug is the digest's 301
 * (`Station-Moved`), which this module reports as `moved` so the page answers
 * the visitor with a 301 to the new address — following it would serve the new
 * page under the old address.
 */
import type { Lang } from "../site/pages.js";
import { isStationSlug } from "../site/stations.js";
import { heapBytesOf } from "./motorway.js";
import { logFragmentFailure } from "./log.js";
import { mapQuery, type TileFetchOptions } from "./tiles.js";
import { chargingFilterForward } from "./charging-filter.js";
import { digestFetch } from "./agent-class.js";
import { viaFragmentCache } from "./fragment-cache.js";

/** At most this many fragments are kept, and this many bytes of them (the shell runs in 128 MB; a station page is ~10–25 KB). */
export const STATION_FRAGMENT_CACHE_MAX = 1_000;
export const STATION_FRAGMENT_CACHE_BYTES = 8 * 1024 * 1024;

/**
 * 2.4.6 review: how long a kept copy may answer for a digest that does not (`stale`): the digest's own bound on a
 * station's page data (`STATION_PAGE_MAX_AGE_S`, the test holds them equal), counted from when the digest last vouched
 * for the copy (a 200 or a 304) — never a copy of unbounded age.
 */
export const STATION_KEPT_SERVE_SECONDS = 24 * 3600;

type Kept = { readonly etag: string; readonly html: string; readonly facts: StationFacts | null; readonly bytes: number; readonly at: number };
const kept = new Map<string, Kept>();
let keptBytes = 0;

/** Forget every kept fragment (tests). */
export function clearStationFragments(): void {
  kept.clear();
  keptBytes = 0;
}

/** The kept fragments: how many, and what they cost (tests). */
export function stationFragmentsKept(): { readonly entries: number; readonly bytes: number } {
  return { entries: kept.size, bytes: keptBytes };
}

function forget(url: string): void {
  const k = kept.get(url);
  if (k === undefined) return;
  keptBytes -= k.bytes;
  kept.delete(url);
}

function keep(url: string, etag: string, html: string, facts: StationFacts | null): void {
  const bytes = heapBytesOf(html) + heapBytesOf(url) + etag.length + 600;
  forget(url);
  if (bytes > STATION_FRAGMENT_CACHE_BYTES) return;
  kept.set(url, { etag, html, facts, bytes, at: Date.now() });
  keptBytes += bytes;
  while (kept.size > STATION_FRAGMENT_CACHE_MAX || keptBytes > STATION_FRAGMENT_CACHE_BYTES) {
    const oldest = kept.keys().next().value;
    if (oldest === undefined) break;
    forget(oldest);
  }
}

/** A fetch that can be told not to follow redirects: the shell's own, or a test's. */
export type StationFetchLike = (url: string, init: { readonly signal: AbortSignal; readonly headers: Record<string, string>; readonly redirect: "manual" }) => Promise<{
  readonly status: number;
  readonly headers: { get(name: string): string | null };
  text(): Promise<string>;
}>;

export type StationFetchOptions = Omit<TileFetchOptions, "fetchImpl"> & { readonly fetchImpl?: StationFetchLike };

/**
 * #1044: StaDa's facts of a station, from the digest's `Station-Facts` header (base64url JSON) — what the page's title
 * and structured data say beyond the name. Read strictly: a value of another shape is no facts, never a guess.
 */
export type StationFacts = {
  readonly street: string | null;
  readonly zip: string | null;
  readonly city: string | null;
  readonly lat: number | null;
  readonly lon: number | null;
  readonly stepless: "yes" | "partial" | "no" | null;
  readonly amenities: readonly string[];
  /** #1087: whose record the facts are — DB StaDa's, or the zHV's for a railway station StaDa does not list. */
  readonly source: "db_stada" | "delfi_zhv";
  /** #1095: the Land in the page's language and its two-digit key (the breadcrumb's middle and the lead), or null. */
  readonly land?: string | null;
  readonly landKey?: string | null;
  /** #1095: the town page the station belongs to (its Gemeinde's place page), or null. */
  readonly place?: { readonly slug: string; readonly name: string } | null;
  /** #1095: the record's own Stand (the graph's dateModified), or null. */
  readonly stand?: Date | null;
};

const text = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() !== "" && v.length <= max && !/[<>]/.test(v) ? v.trim() : null);
const coord = (v: unknown, lo: number, hi: number): number | null => (typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : null);

export function stationFactsOf(header: string | null): StationFacts | null {
  if (header === null || header.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(header)) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(Buffer.from(header, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const amenities = Array.isArray(r["amenities"]) ? r["amenities"].flatMap((a) => (text(a, 80) === null ? [] : [text(a, 80)!])).slice(0, 20) : [];
  const stepless = r["stepless"] === "yes" || r["stepless"] === "partial" || r["stepless"] === "no" ? r["stepless"] : null;
  // a point outside Germany's box is not this station's
  const pl = typeof r["place"] === "object" && r["place"] !== null ? (r["place"] as Record<string, unknown>) : null;
  const placeName = pl === null ? null : text(pl["name"], 80);
  const place = pl !== null && typeof pl["slug"] === "string" && /^[a-z0-9-]{1,80}$/.test(pl["slug"]) && placeName !== null ? { slug: pl["slug"], name: placeName } : null;
  const standMs = typeof r["stand"] === "string" && /^\d{4}-\d{2}-\d{2}T/.test(r["stand"]) ? Date.parse(r["stand"]) : Number.NaN;
  return {
    street: text(r["street"], 120), zip: typeof r["zip"] === "string" && /^\d{5}$/.test(r["zip"]) ? r["zip"] : null, city: text(r["city"], 80), lat: coord(r["lat"], 47, 55.1), lon: coord(r["lon"], 5.8, 15.1), stepless, amenities, source: r["source"] === "delfi_zhv" ? "delfi_zhv" : "db_stada",
    land: text(r["land"], 60), landKey: typeof r["landKey"] === "string" && /^(0[1-9]|1[0-6])$/.test(r["landKey"]) ? r["landKey"] : null, place, stand: Number.isFinite(standMs) ? new Date(standMs) : null,
  };
}

export type StationFetched = { readonly kind: "ok"; readonly html: string; readonly revalidated: boolean; readonly facts?: StationFacts | null; readonly stale?: true } | { readonly kind: "moved"; readonly to: string } | { readonly kind: "missing" } | { readonly kind: "failed"; readonly reason: string };

/** A station page's root, and the catalogue's (`renderStationPage` / `renderStationIndex` in the digest). */
export const STATION_PAGE_SHAPE = /^<section class="stpage" id="station">/;
export const STATION_INDEX_SHAPE = /^<section class="stpage-index" id="station-index">/;

async function getStationFragment(url: string, o: StationFetchOptions, shape: RegExp, keepIt: boolean): Promise<StationFetched> {
  const t0 = Date.now();
  const r = await getRaw(url, o, shape, keepIt);
  if (r.kind === "failed") {
    const m = /^HTTP (\d{3})$/.exec(r.reason);
    logFragmentFailure(url, m === null ? null : Number(m[1]), r.reason, Date.now() - t0);
    // 2.4.6: a slow or failing digest is answered with the last fragment this shell was sent for the address (the
    // static page changes with the source version only), never with a missing page
    const prior = keepIt ? kept.get(url) : undefined;
    if (prior !== undefined && Date.now() - prior.at < STATION_KEPT_SERVE_SECONDS * 1000) return { kind: "ok", html: prior.html, revalidated: true, facts: prior.facts, stale: true };
  }
  return r;
}

/**
 * #1042 caching criterion: the shell's own fetch of a station fragment — through the fragment cache when one is
 * configured (`viaFragmentCache`, which serves a station's page, the bare catalogue and its live part, and asks the
 * digest directly for every other path or when the cache is away), never following a redirect: an old slug's 301 is
 * the page's own answer, through the cache as without it.
 */
function stationFetch(o: StationFetchOptions): StationFetchLike {
  const f = viaFragmentCache({ baseUrl: o.baseUrl, timeoutMs: o.timeoutMs, fetchImpl: (u, init) => digestFetch(u, init), ...(o.fragmentUrl === undefined ? {} : { fragmentUrl: o.fragmentUrl }) });
  return (u, init) => f(u, init);
}

async function getRaw(url: string, o: StationFetchOptions, shape: RegExp, keepIt: boolean): Promise<StationFetched> {
  const fetchImpl: StationFetchLike = o.fetchImpl ?? stationFetch(o);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), o.timeoutMs);
  const prior = keepIt ? kept.get(url) : undefined;
  try {
    const headers: Record<string, string> = { accept: "text/html" };
    if (prior !== undefined) headers["if-none-match"] = prior.etag;
    const res = await fetchImpl(url, { signal: controller.signal, headers, redirect: "manual" });
    if (res.status === 304 && prior !== undefined) {
      // the digest vouched for the copy again: its age restarts
      kept.delete(url);
      kept.set(url, { ...prior, at: Date.now() });
      return { kind: "ok", html: prior.html, revalidated: true, facts: stationFactsOf(res.headers.get("station-facts")) ?? prior.facts };
    }
    if (res.status === 301) {
      const to = res.headers.get("station-moved");
      return to !== null && isStationSlug(to) ? { kind: "moved", to } : { kind: "failed", reason: "a 301 without a station" };
    }
    if (res.status === 404) return { kind: "missing" };
    if (res.status !== 200) return { kind: "failed", reason: `HTTP ${res.status}` };
    if (!(res.headers.get("content-type") ?? "").startsWith("text/html")) return { kind: "failed", reason: "not text/html" };
    const body = await res.text();
    if (!shape.test(body) || !body.trimEnd().endsWith("</section>") || /<script|<style|javascript:/i.test(body)) return { kind: "failed", reason: "not a station fragment" };
    const etag = res.headers.get("etag");
    const facts = stationFactsOf(res.headers.get("station-facts"));
    if (keepIt && etag !== null && /^"[!#-~]{1,80}"$/.test(etag)) keep(url, etag, body, facts);
    return { kind: "ok", html: body, revalidated: false, facts };
  } catch (err) {
    return { kind: "failed", reason: err instanceof Error && err.name === "AbortError" ? `timeout after ${o.timeoutMs} ms` : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

/** One station's page fragment by its slug. */
export function fetchStationPage(slug: string, lang: Lang, o: StationFetchOptions): Promise<StationFetched> {
  if (!isStationSlug(slug)) return Promise.resolve({ kind: "missing" });
  return getStationFragment(`${o.baseUrl}/internal/station/${slug}?lang=${lang}${mapQuery(o)}`, o, STATION_PAGE_SHAPE, true);
}

/** The live part's root (`renderStationLive` in the digest, #1042). */
export const STATION_LIVE_SHAPE = /^<section class="stlive" id="station-live">/;

/** #1092: the board's travel modes (the digest's `TRAVEL_MODES`; the shell reads no ingest package). */
export const BOARD_TRAVEL_MODES = ["long", "regional", "sbahn", "subway", "tram", "bus", "sev"] as const;

/**
 * #1042, #1092: the person's choices the live part takes from the address, each by its own shape, in the digest's
 * fixed order (`boardFilterQuery`) — `side=arr` (the arrivals), `mode` (one of the seven travel modes), `platform` (a
 * track number with a letter, a Steig `s12` or a Bussteig `b85`), `to` (a name, at most 40 characters), `line` (2.4.6:
 * a line of "Linien hier", at most 16 characters), `time=30|60`
 * or `at=HH:MM` (the start), `issues=1`, `stepfree=1`, then `access=1` (the step-free view) — anything else is dropped.
 * Empty: the bare page.
 */
export function stationLiveChoice(params: URLSearchParams): string {
  const out: string[] = [];
  if (params.get("side") === "arr") out.push("side=arr");
  const mode = params.get("mode") ?? "";
  if ((BOARD_TRAVEL_MODES as readonly string[]).includes(mode)) out.push(`mode=${mode}`);
  const g = (params.get("platform") ?? "").trim().toLowerCase();
  if (/^[sb]?\d{1,3}[a-z]?$/.test(g)) out.push(`platform=${g}`);
  const to = (params.get("to") ?? "")
    .normalize("NFC")
    .replace(/[^\p{L}\p{N} .()/-]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 40);
  if (to !== "") out.push(`to=${encodeURIComponent(to)}`);
  // 2.4.6: a line of "Linien hier" (the digest's `boardLineOf` shape)
  const line = (params.get("line") ?? "").normalize("NFC").replace(/\s+/gu, " ").trim();
  if (/^[\p{L}\p{N}][\p{L}\p{N} ./+-]{0,15}$/u.test(line)) out.push(`line=${encodeURIComponent(line)}`);
  const at = params.get("at") ?? "";
  const time = params.get("time") ?? "";
  // a clock time comes as `at` (the address) or as the time select's own value (`time=HH:MM`, the form)
  const clock = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (clock.test(at)) out.push(`at=${encodeURIComponent(at)}`);
  else if (clock.test(time)) out.push(`at=${encodeURIComponent(time)}`);
  else if (time === "30" || time === "60") out.push(`time=${time}`);
  if (params.get("issues") === "1") out.push("issues=1");
  if (params.get("stepfree") === "1") out.push("stepfree=1");
  if (params.get("access") === "1") out.push("access=1");
  // #1081: the charging filter of "Parken und Laden" — a choice like the others (no-store, noindex)
  const ev = chargingFilterForward(params);
  if (ev !== "") out.push(ev);
  return out.join("&");
}

/**
 * One station's live part (#1042): never kept here — the digest holds it for its minute — and never followed past a
 * redirect. A failed or slow answer is the caller's error block, never a missing page.
 */
export function fetchStationLive(slug: string, lang: Lang, o: StationFetchOptions, choice = ""): Promise<StationFetched> {
  if (!isStationSlug(slug)) return Promise.resolve({ kind: "missing" });
  return getStationFragment(`${o.baseUrl}/internal/station/${slug}/live?lang=${lang}${choice === "" ? "" : `&${choice}`}${mapQuery(o)}`, o, STATION_LIVE_SHAPE, false);
}

/** #1043 (c): a stop's own view around a station (`renderStationStop` in the digest). */
export const STATION_STOP_SHAPE = /^<section class="stlive stlive--stop" id="station-stop" /;

/** A stop's address key (a family id with its colons folded), the digest's `isStopKey`. */
export const isStopKey = (x: string): boolean => /^[A-Za-z0-9_.-]{1,80}$/.test(x);

/** One stop around a station on its own address (#1043 (c)): a minute old at most, kept by nobody. */
export function fetchStationStop(slug: string, stop: string, lang: Lang, o: StationFetchOptions): Promise<StationFetched> {
  if (!isStationSlug(slug) || !isStopKey(stop)) return Promise.resolve({ kind: "missing" });
  return getStationFragment(`${o.baseUrl}/internal/station/${slug}/stop/${stop}?lang=${lang}`, o, STATION_STOP_SHAPE, false);
}

/** The stop view's names, from its root's attributes (the digest escapes them; the page's title is built from them). */
export function stationStopNames(html: string): { readonly stop: string; readonly station: string } | null {
  const m = /^<section class="stlive stlive--stop" id="station-stop" data-stop="[^"]*" data-name="([^"]*)" data-station="([^"]*)">/.exec(html);
  if (m === null) return null;
  const un = (x: string): string => x.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  return { stop: un(m[1] ?? ""), station: un(m[2] ?? "") };
}

/** The longest search the catalogue takes (the digest's `maxlength`). */
export const STATION_SEARCH_MAX = 60;

/**
 * The catalogue's choice (`q`: a search, `land`: one Land's two-digit key) — only these, each by its own shape. Empty:
 * the bare catalogue, the only one kept.
 */
export function stationIndexChoice(params: URLSearchParams): string {
  const out: string[] = [];
  const q = (params.get("q") ?? "")
    .normalize("NFC")
    .replace(/[^\p{L}\p{N} .\-()/]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, STATION_SEARCH_MAX);
  if (q !== "") out.push(`q=${encodeURIComponent(q)}`);
  const land = params.get("land");
  if (land !== null && /^(0[1-9]|1[0-6])$/.test(land)) out.push(`land=${land}`);
  return out.join("&");
}

/** The catalogue fragment for the person's choice (`stationIndexChoice`; "" for the bare catalogue). */
export function fetchStationIndex(lang: Lang, o: StationFetchOptions, choice = ""): Promise<StationFetched> {
  return getStationFragment(`${o.baseUrl}/internal/station/index?lang=${lang}${choice === "" ? "" : `&${choice}`}`, o, STATION_INDEX_SHAPE, choice === "");
}

/** The station list's deadline: the digest answers it from its warm index (the two-second ceiling, owner 2026-10-26). */
export const STATION_LIST_TIMEOUT_MS = 2_000;

/** One station page of the sitemap: its slug, the day its record last changed and (2.4.6) its name when the digest sent one. */
export type StationListEntry = { readonly slug: string; readonly day: string; readonly name?: string };

/**
 * Every station page the digest holds (the sitemap's source): one `slug<TAB>YYYY-MM-DD` line each. Null when the
 * digest does not answer, or answers anything but that shape — a line that is not one is a failed read, never
 * dropped silently.
 */
export async function fetchStationList(o: StationFetchOptions): Promise<readonly StationListEntry[] | null> {
  const fetchImpl: StationFetchLike = o.fetchImpl ?? ((u, init) => digestFetch(u, init));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), o.timeoutMs);
  try {
    const res = await fetchImpl(`${o.baseUrl}/internal/station/list`, { signal: controller.signal, headers: { accept: "text/plain" }, redirect: "manual" });
    if (res.status !== 200 || !(res.headers.get("content-type") ?? "").startsWith("text/plain")) return null;
    const lines = (await res.text()).split("\n").filter((l) => l !== "");
    const out: StationListEntry[] = [];
    for (const l of lines) {
      const m = /^([a-z0-9]+(?:-[a-z0-9]+)*)\t(\d{4}-\d{2}-\d{2})(?:\t([^\t]{1,200}))?$/.exec(l);
      if (m === null || !isStationSlug(m[1]!)) return null;
      const name = m[3]?.trim();
      out.push(name === undefined || name === "" ? { slug: m[1]!, day: m[2]! } : { slug: m[1]!, day: m[2]!, name });
    }
    const declared = res.headers.get("station-pages");
    if (declared !== null && Number(declared) !== out.length) return null;
    return out;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
