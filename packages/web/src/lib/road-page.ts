/**
 * The road pages (#1027), fetched from the digest's internal routes like a station page (`lib/station.ts`): one GET
 * under a deadline, an answer that is not recognisably ours is no answer, nothing throws past the caller.
 *
 * The page's head — title, description, robots, the day it last changed and its main place — is carried on the
 * fragment's root (`renderRoadPage` in the digest) and read and STRIPPED here (`roadHeadOf`), as a motorway page's is
 * (`lib/motorway-head.ts`). A value that is not plausibly the digest's — empty, over its bound, not naming the road,
 * markup or a slot left in it — is ignored, and the layout falls back to its own words.
 *
 * What an address resolves to is decided before anything renders (Astro lets only a PAGE answer with a redirect):
 *   - the canonical id (`/de/road/b51`, `/de/road/nw/l249`) → the page;
 *   - another spelling of one (`B51`, `B%2051`, `NW/L249`) → 301 to the canonical address;
 *   - anything else, or an id the digest does not answer → the 404 page;
 *   - the digest not answering → 503, never a redirect.
 */
import type { Lang } from "../site/pages.js";
import { isRoadId, roadAddress, roadPath } from "../site/roads.js";
import { logFragmentFailure } from "./log.js";
import { mapQuery, type FetchLike, type TileFetchOptions } from "./tiles.js";
import { digestFetch } from "./agent-class.js";
import { unescapeAttr } from "./motorway-head.js";

/** The digest's bounds on a road page's head (`ROAD_TITLE_MAX`, `ROAD_DESCRIPTION_MAX`); anything longer is not the digest's. */
export const ROAD_HEAD_TITLE_LIMIT = 100;
export const ROAD_HEAD_DESCRIPTION_LIMIT = 200;
/** The sitemap's read of the road list: the sitemaps' own deadline (a list of a few thousand lines). */
export const ROAD_LIST_TIMEOUT_MS = 2_000;

export const ROAD_PAGE_SHAPE = /^<section class="roadpage" id="roadpage"([^>]*)>/;

export type RoadHead = {
  /** The fragment without the head attributes. */
  readonly html: string;
  readonly title: string | null;
  readonly description: string | null;
  readonly robots: "index, follow" | "noindex, follow" | null;
  /** The road's label as the fragment wrote it (`B 51`). */
  readonly road: string | null;
  readonly lastmod: string | null;
  /** The Gemeinde most of the road's items are at, with its place page in this language. */
  readonly place: { readonly name: string; readonly path: `/${string}` } | null;
};

function attr(attrs: string, name: string): string | null {
  const m = new RegExp(` ${name}="([^"]*)"`).exec(attrs);
  return m === null ? null : unescapeAttr(m[1] ?? "");
}

const clean = (v: string | null, limit: number, must: string | null): string | null => {
  if (v === null) return null;
  const t = v.trim();
  if (t === "" || t.length > limit || /[<>{}]|\bundefined\b|\bnull\b/.test(t) || (must !== null && !t.includes(must))) return null;
  return t;
};

const ROAD_LABEL = /^[BLS] [1-9][0-9]{0,3}[a-z]?$/;
const PLACE_PATH = /^\/([a-z]{2})\/place\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The head off a road page's fragment, and the fragment without it. `lang`: a place path in another language is not this page's. */
export function roadHeadOf(fragment: string, lang: Lang): RoadHead {
  const root = ROAD_PAGE_SHAPE.exec(fragment);
  if (root === null) return { html: fragment, title: null, description: null, robots: null, road: null, lastmod: null, place: null };
  const attrs = root[1] ?? "";
  const r = attr(attrs, "data-road");
  const road = r !== null && ROAD_LABEL.test(r) ? r : null;
  const title = road === null ? null : clean(attr(attrs, "data-title"), ROAD_HEAD_TITLE_LIMIT, road);
  const description = road === null ? null : clean(attr(attrs, "data-description"), ROAD_HEAD_DESCRIPTION_LIMIT, road);
  const rb = attr(attrs, "data-robots");
  const robots = rb === "index, follow" || rb === "noindex, follow" ? rb : null;
  const lm = attr(attrs, "data-lastmod");
  const lastmod = lm !== null && /^\d{4}-\d{2}-\d{2}$/.test(lm) ? lm : null;
  const pn = clean(attr(attrs, "data-place"), 80, null);
  const pp = attr(attrs, "data-place-path");
  const pm = pp === null ? null : PLACE_PATH.exec(pp);
  const place = pn !== null && pp !== null && pm !== null && pm[1] === lang ? { name: pn, path: pp as `/${string}` } : null;
  const kept = attrs.replace(/ data-(?:title|description|robots|road|lastmod|place|place-path)="[^"]*"/g, "");
  return { html: `<section class="roadpage" id="roadpage"${kept}>${fragment.slice(root[0].length)}`, title, description, robots, road, lastmod, place };
}

export type RoadFetched = { readonly kind: "ok"; readonly html: string } | { readonly kind: "missing" } | { readonly kind: "failed"; readonly reason: string };

/** One road's page fragment by its canonical id. */
export async function fetchRoadPage(id: string, lang: Lang, o: TileFetchOptions): Promise<RoadFetched> {
  if (!isRoadId(id)) return { kind: "missing" };
  const url = `${o.baseUrl}/internal/road/${id}?lang=${lang}${mapQuery(o)}`;
  const fetchImpl: FetchLike = o.fetchImpl ?? ((u, init) => digestFetch(u, init));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), o.timeoutMs);
  const t0 = Date.now();
  try {
    const res = await fetchImpl(url, { signal: controller.signal, headers: { accept: "text/html" } });
    if (res.status === 404) return { kind: "missing" };
    if (res.status !== 200) {
      logFragmentFailure(url, res.status, `HTTP ${res.status}`, Date.now() - t0);
      return { kind: "failed", reason: `HTTP ${res.status}` };
    }
    if (!(res.headers.get("content-type") ?? "").startsWith("text/html")) return { kind: "failed", reason: "not text/html" };
    const body = await res.text();
    if (!ROAD_PAGE_SHAPE.test(body) || !body.trimEnd().endsWith("</section>") || /<script|<style|javascript:/i.test(body)) return { kind: "failed", reason: "not a road fragment" };
    return { kind: "ok", html: body };
  } catch (err) {
    const reason = err instanceof Error && err.name === "AbortError" ? `timeout after ${o.timeoutMs} ms` : String(err);
    logFragmentFailure(url, null, reason, Date.now() - t0);
    return { kind: "failed", reason };
  } finally {
    clearTimeout(timer);
  }
}

export type RoadListEntry = { readonly id: string; readonly day: string };

/**
 * Every indexable road page the digest names (the sitemap's source): one `id<TAB>YYYY-MM-DD` line each. Null when the
 * digest does not answer, or answers anything but that shape — a line that is not one is a failed read, never dropped.
 */
export async function fetchRoadList(o: TileFetchOptions): Promise<readonly RoadListEntry[] | null> {
  const fetchImpl: FetchLike = o.fetchImpl ?? ((u, init) => digestFetch(u, init));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), o.timeoutMs);
  try {
    const res = await fetchImpl(`${o.baseUrl}/internal/road/list`, { signal: controller.signal, headers: { accept: "text/plain" } });
    if (res.status !== 200 || !(res.headers.get("content-type") ?? "").startsWith("text/plain")) return null;
    const out: RoadListEntry[] = [];
    for (const l of (await res.text()).split("\n").filter((x) => x !== "")) {
      const m = /^([a-z0-9/]{2,12})\t(\d{4}-\d{2}-\d{2})$/.exec(l);
      if (m === null || !isRoadId(m[1]!)) return null;
      out.push({ id: m[1]!, day: m[2]! });
    }
    const declared = res.headers.get("road-pages");
    if (declared !== null && Number(declared) !== out.length) return null;
    return out;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type RoadPageAnswer =
  | { readonly kind: "unavailable" }
  | { readonly kind: "missing" }
  | { readonly kind: "redirect"; readonly to: `/${string}` }
  | { readonly kind: "page"; readonly id: string; readonly path: `/${string}`; readonly head: RoadHead };

/** `raw`: the address after `road/` (`b51`, `nw/l249`, or another spelling of one). */
export async function resolveRoadPage(lang: Lang, raw: string, o: TileFetchOptions): Promise<RoadPageAnswer> {
  const a = roadAddress(raw);
  if (a.kind === "none") return { kind: "missing" };
  if (a.kind === "respell") return { kind: "redirect", to: roadPath(lang, a.id) };
  const r = await fetchRoadPage(a.id, lang, o);
  if (r.kind === "missing") return { kind: "missing" };
  if (r.kind === "failed") return { kind: "unavailable" };
  return { kind: "page", id: a.id, path: roadPath(lang, a.id), head: roadHeadOf(r.html, lang) };
}
