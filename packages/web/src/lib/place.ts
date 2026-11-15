/**
 * The place fragments of the location-aware home (#564), fetched from the
 * digest's internal routes exactly like the tiles (`tiles.ts`): one GET, a
 * deadline, an answer that is not recognisably ours is no answer, and nothing
 * here throws past the caller.
 *
 * What the shell sends the digest is a PLACE KEY and a language — never an
 * address, a header of the visitor's or anything that names a person.
 */
import type { Lang } from "../site/pages.js";
import { t } from "../i18n/index.js";
import { isPickKey, isPlaceKey } from "../location/ladder.js";
import { isPlaceSlug } from "../site/places.js";
import { mapQuery, type FetchLike, type TileFetchOptions } from "./tiles.js";
import { fuelQuery, type FuelNote } from "./fuel-refresh.js";
import { logFragmentFailure } from "./log.js";
import { viaFragmentCache } from "./fragment-cache.js";
import { CHARGING_FILTER_KEYS } from "./charging-filter.js";
import { digestFetch } from "./agent-class.js";
import { didNotAnswer } from "./fragment-retry.js";

export type PlaceFragment = {
  readonly html: string;
  /** The canonical key the cards are for (`ags:…` or `pt:…`). */
  readonly at: string;
  /** The Gemeinde the cards are for (or near, for a point). */
  readonly label: string;
  readonly point: boolean;
  /** The place page's slug (#892, the digest's `Place-Slug`), for a Gemeinde key; absent for a point. */
  readonly slug?: string;
  /** #1070: the position was outside Germany near its border; these are its nearest German place's cards. */
  readonly outside?: "border";
};

/** #1184: the digest's cold-read lane header (packages/digest `CARDS_LANE_HEADER`); `fill` is the page's own script. */
export const CARDS_LANE_HEADER = "x-vf-cards-lane";
/** #1184: the digest marks a cold-read refusal (its `busyPlace`) with this header: the gate working, not a fault. */
export const BUSY_HEADER = "x-vf-busy";

export type Fetched =
  | { readonly ok: true; readonly html: string; readonly headers: { get(n: string): string | null } }
  /** `outside` (#1070): the digest's `Place-Outside` on a refusal — `far` when the point is far from Germany. */
  | { readonly ok: false; readonly status: number | null; readonly reason: string; readonly outside?: string | null; readonly busy?: true };

export async function getFragment(url: string, o: TileFetchOptions, shape: RegExp, end: string, headers: Readonly<Record<string, string>> = {}): Promise<Fetched> {
  const t0 = Date.now();
  const r = await getFragmentRaw(url, o, shape, end, headers);
  // #741: a fragment that did not arrive is a line; a 404 is "no such place", an answer, and a #1184 refusal
  // (`busy`) is the gate working — the digest counts it on its memory line, so a walk does not fill error_events.
  if (!r.ok && r.status !== 404 && r.busy !== true) logFragmentFailure(url, r.status, r.reason, Date.now() - t0);
  return r;
}

async function getFragmentRaw(url: string, o: TileFetchOptions, shape: RegExp, end: string, headers: Readonly<Record<string, string>>): Promise<Fetched> {
  const fetchImpl: FetchLike = o.fetchImpl ?? ((u, init) => digestFetch(u, init));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), o.timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: controller.signal, headers: { accept: "text/html", ...headers } });
    if (res.status !== 200) {
      const busy = res.status === 503 && res.headers.get(BUSY_HEADER) === "1";
      return { ok: false, status: res.status, reason: `HTTP ${res.status}`, outside: res.headers.get("place-outside"), ...(busy ? { busy: true as const } : {}) };
    }
    if (!(res.headers.get("content-type") ?? "").startsWith("text/html")) return { ok: false, status: res.status, reason: "not text/html" };
    const body = await res.text();
    if (!shape.test(body) || !body.trimEnd().endsWith(end) || /<script|<style|javascript:/i.test(body)) return { ok: false, status: res.status, reason: "not a place fragment" };
    return { ok: true, html: body, headers: res.headers };
  } catch (err) {
    return { ok: false, status: null, reason: err instanceof Error && err.name === "AbortError" ? `timeout after ${o.timeoutMs} ms` : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The cards for a place key. `snap`: answer a point as its Gemeinde (the IP
 * rung). Null when the key is not one, the place is not in Germany (404), or
 * the digest did not answer in time — the caller then renders Germany-wide.
 */
export async function fetchPlace(at: string, lang: Lang, o: TileFetchOptions & { readonly snap?: boolean; readonly fuel?: FuelNote | null; readonly deferFuel?: boolean }): Promise<PlaceFragment | null> {
  const r = await fetchPlaceAnswer(at, lang, o);
  return r.kind === "place" ? r.place : null;
}

/** As `fetchPlace`, telling a place the digest does not know (404) from a digest that did not answer. */
export async function fetchPlaceAnswer(
  at: string,
  lang: Lang,
  o: TileFetchOptions & {
    readonly snap?: boolean;
    readonly fuel?: FuelNote | null;
    readonly deferFuel?: boolean;
    readonly open?: string | null;
    readonly ev?: string;
    /**
     * #1184: the cards are asked by the page's own script (`/fragment/place`), so the digest admits their cold read in
     * the lane a walk of document renders cannot fill (`CARDS_LANE_HEADER`). A header, not a query parameter: the
     * fragment cache keys by the address, and a fill answered from a document's cached copy is exactly right.
     */
    readonly fill?: boolean;
  },
): Promise<{ readonly kind: "place"; readonly place: PlaceFragment } | { readonly kind: "missing" } | { readonly kind: "far" } | { readonly kind: "failed"; readonly busy?: true; readonly late?: true }> {
  if (!isPlaceKey(at)) return { kind: "missing" };
  // `fuel`/`fuelAt` (#564): what the on-demand fuel refresh did — words for the card, and the instant its rows landed.
  // `fuelRows=0` (#1065): a document's cards — the fuel card's frame alone, its prices the page's `/fragment/place-fuel`.
  // `open` (#1061): a place page's no-script `?<card>=N`, as `card:N`.
  // #938 E1: or one stop's opened departures, `departures:N@<stop>` (`placeOpenOf`)
  const open = typeof o.open === "string" && /^[a-z]{3,12}:[0-9]{1,2}(?:@[A-Za-z0-9:_.-]{1,64})?$/.test(o.open) ? `&open=${o.open}` : "";
  // #1081: the charging filter (`chargingFilterForward`, already cut to its shape): the digest reads it, answers no-store.
  const ev = typeof o.ev === "string" && o.ev !== "" && o.ev.split("&").every((p) => (CHARGING_FILTER_KEYS as readonly string[]).includes(p.split("=")[0] ?? "")) ? `&${o.ev}` : "";
  const q = `at=${encodeURIComponent(at)}&lang=${lang}${o.snap === true ? "&snap=gemeinde" : ""}${fuelQuery(o.fuel ?? null)}${o.deferFuel === true ? "&fuelRows=0" : ""}${open}${ev}${mapQuery(o)}`;
  // #936 D: the cards may come from the fragment cache (DIGEST_FRAGMENT_URL), the digest when it is away.
  const r = await getFragment(`${o.baseUrl}/internal/place/cards?${q}`, { ...o, fetchImpl: viaFragmentCache(o) }, /^<section class="place" id="place-cards"/, "</section>", o.fill === true ? { [CARDS_LANE_HEADER]: "fill" } : {});
  // #1070: a position far from Germany is its own answer — the page then shows all of Germany, never an error.
  // #1184: a 503 is the digest refusing a cold read at its limit (nothing was read): `busy`, asked again shortly
  // #1198: so is a read that did not arrive (the deadline, a refused connection, a 5xx): the first ask of a place the
  // digest had not read yet missed the deadline on prod and came back the next time in 1.6 s
  if (!r.ok) return r.status === 404 ? (r.outside === "far" ? { kind: "far" } : { kind: "missing" }) : r.status === 503 ? { kind: "failed", busy: true } : didNotAnswer(r.status) ? { kind: "failed", busy: true, late: true } : { kind: "failed" };
  const key = r.headers.get("place-key") ?? "";
  let label = "";
  try {
    label = decodeURIComponent(r.headers.get("place-label") ?? "");
  } catch {
    label = "";
  }
  if (!isPlaceKey(key) || label === "" || label.length > 200) return { kind: "failed" };
  const slug = r.headers.get("place-slug");
  const outside = r.headers.get("place-outside") === "border" ? ({ outside: "border" } as const) : {};
  return { kind: "place", place: { html: r.html, at: key, label, point: r.headers.get("place-point") === "1", ...(slug !== null && isPlaceSlug(slug) ? { slug } : {}), ...outside } };
}

/** The suggestion list for what the visitor typed (2–80 characters). */
export async function fetchSuggest(q: string, lang: Lang, o: TileFetchOptions): Promise<string | null> {
  const t = q.trim();
  if (t.length < 2 || t.length > 80) return null;
  const r = await getFragment(`${o.baseUrl}/internal/place/suggest?q=${encodeURIComponent(t)}&lang=${lang}`, o, /^<div class="place-suggest/, "</div>");
  return r.ok ? r.html : null;
}

/** The place pages for the sitemap and the name lookup (#739): `[slug, name]`, read off the digest's index links (#892: the stored slugs). */
export async function fetchPlaceIndex(o: TileFetchOptions): Promise<readonly PlaceIndexEntry[] | null> {
  const r = await getFragment(`${o.baseUrl}/internal/place/index`, o, /^<ul class="place-index">/, "</ul>");
  if (!r.ok) return null;
  return [...r.html.matchAll(/<a href="\/de\/place\/([a-z0-9-]+)">([^<]*)<\/a>/g)].filter((m) => isPlaceSlug(m[1] ?? "")).map((m) => ({ slug: m[1] ?? "", name: unescapeHtml(m[2] ?? "") }));
}

/**
 * The Gemeinde key a place-page slug names (#892), through the digest's
 * `/internal/place/key`: `ags:…`, or null when no Gemeinde holds the slug
 * ("missing") — `undefined` when the digest did not answer. Kept per slug in
 * this process (a slug never moves, `place_slugs`), bounded by `SLUG_KEYS_MAX`.
 */
export async function placeKeyOfSlug(slug: string, o: TileFetchOptions): Promise<string | null | undefined> {
  if (!isPlaceSlug(slug)) return null;
  const held = slugKeys.get(slug);
  // #1279 review: a key kept WITHOUT a name (asked while the digest had not read `place_slugs`, or of an older digest)
  // asks for the name again, at most once per SLUG_NAME_RETRY_MS — else that town's late page stayed the 503 for the
  // life of this process. A re-ask that brings nothing keeps the held key.
  if (held !== undefined && (slugNames.has(slug) || Date.now() - (nameAskedAt.get(slug) ?? 0) < SLUG_NAME_RETRY_MS)) return held;
  const r = await getFragment(`${o.baseUrl}/internal/place/key?slug=${slug}`, o, /^<p class="place-key">/, "</p>");
  const m = r.ok ? /^<p class="place-key">(ags:\d{8})<\/p>$/.exec(r.html.trim()) : null;
  if (!r.ok || m === null) {
    if (held !== undefined) {
      nameAskedAt.set(slug, Date.now());
      return held;
    }
    return !r.ok && r.status === 404 ? null : undefined;
  }
  if (held === undefined && slugKeys.size >= SLUG_KEYS_MAX) {
    const oldest = slugKeys.keys().next().value!;
    slugKeys.delete(oldest);
    slugNames.delete(oldest);
    nameAskedAt.delete(oldest);
  }
  slugKeys.set(slug, m[1]!);
  const name = placeLabelOf(r.headers.get("place-label"));
  if (name !== null) {
    slugNames.set(slug, name);
    nameAskedAt.delete(slug);
  } else nameAskedAt.set(slug, Date.now());
  return m[1]!;
}

/** #1279 review: how soon a slug whose key came without a name asks the digest for it again. */
export const SLUG_NAME_RETRY_MS = 60_000;
const nameAskedAt = new Map<string, number>();

/** #1279: the name the digest gave beside a slug's key (`Place-Label`), kept with the key; null when none came. */
export function placeNameOfSlug(slug: string): string | null {
  return slugNames.get(slug) ?? null;
}
const slugNames = new Map<string, string>();

/** A `Place-Label` header as a name, or null: undecodable, empty, over 120 characters or carrying a control character. */
function placeLabelOf(raw: string | null): string | null {
  if (raw === null) return null;
  let name: string;
  try {
    name = decodeURIComponent(raw).trim();
  } catch {
    return null;
  }
  return name === "" || name.length > 120 || /[\u0000-\u001f\u007f]/.test(name) ? null : name;
}

/** How many slug → key answers the shell keeps (every Gemeinde, ~11 000, fits; the bound stops a walk over invented slugs). */
export const SLUG_KEYS_MAX = 12_000;
const slugKeys = new Map<string, string>();
/** For tests: forget the kept slug keys (and the kept pick points). */
export function resetSlugKeys(): void {
  slugKeys.clear();
  slugNames.clear();
  nameAskedAt.clear();
  pickPoints.clear();
}

/**
 * #1088: the point a picked district or postcode (`dst:`/`plz:`) stands for, through the digest's
 * `/internal/place/key?pick=`: `pt:…`, or null when none such ("missing") — `undefined` when the digest did not
 * answer. The fuel refresh and the live answers take points; the cards take the pick key itself (its label).
 * Kept per key in this process, bounded like the slugs.
 */
export async function placePointOfPick(pick: string, o: TileFetchOptions): Promise<string | null | undefined> {
  if (!isPickKey(pick)) return null;
  const held = pickPoints.get(pick);
  if (held !== undefined) return held;
  const r = await getFragment(`${o.baseUrl}/internal/place/key?pick=${encodeURIComponent(pick)}`, o, /^<p class="place-key">/, "</p>");
  if (!r.ok) return r.status === 404 ? null : undefined;
  const m = /^<p class="place-key">(pt:-?\d{1,2}(?:\.\d{1,6})?,-?\d{1,3}(?:\.\d{1,6})?)<\/p>$/.exec(r.html.trim());
  if (m === null) return undefined;
  if (pickPoints.size >= SLUG_KEYS_MAX) pickPoints.delete(pickPoints.keys().next().value!);
  pickPoints.set(pick, m[1]!);
  return m[1]!;
}
const pickPoints = new Map<string, string>();

export type PlaceIndexEntry = { readonly slug: string; readonly name: string };

/** The digest escapes a name with `safe` (& < > " '); this is its inverse, and nothing more. */
function unescapeHtml(s: string): string {
  return s.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&amp;", "&");
}

/**
 * #1070: what stands in the cards' place for a position far from Germany (owner 2026-10-25: "show the 'all Germany'
 * mode") — the heading "Ganz Deutschland" and one sentence why, in the cards' own frame so the island swaps it like any
 * cards; the national blocks below are the page. Nothing in it names or locates the position.
 */
export function farPlaceHtml(lang: Lang): string {
  return `<section class="place" id="place-cards" aria-labelledby="place-title"><h2 class="place__title" id="place-title">${unsafeText(t(lang, "place.germany"))}</h2><p class="place__far">${unsafeText(t(lang, "place.outsideFar"))}</p></section>`;
}

/** Text into HTML: the five characters escaped, nothing else. */
function unsafeText(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
