/**
 * The Land pages (#1074), fetched from the digest's internal routes like a road page (`lib/road-page.ts`): one GET
 * under a deadline, an answer that is not recognisably ours is no answer, nothing throws past the caller.
 *
 * The page's head — title, description, robots, the Land's name in this language and the day it last changed — is
 * carried on the fragment's root (`renderStatePage` in the digest) and read and STRIPPED here (`stateHeadOf`). A value
 * that is not plausibly the digest's — empty, over its bound, not naming the Land, markup or a slot left in it — is
 * ignored, and the layout falls back to its own words.
 *
 * What an address resolves to is decided before anything renders (Astro lets only a PAGE answer with a redirect):
 *   - the slug (`/de/state/bayern`) → the page;
 *   - another spelling of one (`Bayern`, `by`, `bavaria`, `Thüringen`) → 301 to the slug;
 *   - anything else → the 404 page;
 *   - the digest not answering → 503, never a redirect.
 *
 * No fuel figure travels this way (data-steward MF1): the page's fuel card is a plain link to the fuel page.
 */
import type { Lang } from "../site/pages.js";
import { isStateSlug, stateAddress, statePath } from "../site/states.js";
import { logFragmentFailure } from "./log.js";
import { mapQuery, type FetchLike, type TileFetchOptions } from "./tiles.js";
import { digestFetch } from "./agent-class.js";
import { unescapeAttr } from "./motorway-head.js";

export const STATE_HEAD_TITLE_LIMIT = 100;
export const STATE_HEAD_DESCRIPTION_LIMIT = 240;
/** The sitemap's read of the Land list: sixteen lines. */
export const STATE_LIST_TIMEOUT_MS = 2_000;

export const STATE_PAGE_SHAPE = /^<section class="statepage" id="statepage"([^>]*)>/;
export const STATE_INDEX_SHAPE = /^<section class="stateindex" id="stateindex"([^>]*)>/;

export type StateHead = {
  /** The fragment without the head attributes. */
  readonly html: string;
  readonly title: string | null;
  readonly description: string | null;
  /** The Land's name in the page's language, as the fragment wrote it. */
  readonly name: string | null;
  readonly lastmod: string | null;
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

/** The head off a Land page's fragment, and the fragment without it. `slug`: a fragment about another Land is not this page's. */
export function stateHeadOf(fragment: string, slug: string): StateHead {
  const root = STATE_PAGE_SHAPE.exec(fragment);
  if (root === null) return { html: fragment, title: null, description: null, name: null, lastmod: null };
  const attrs = root[1] ?? "";
  const mine = attr(attrs, "data-land") === slug;
  const name = mine ? clean(attr(attrs, "data-land-name"), 60, null) : null;
  const title = name === null ? null : clean(attr(attrs, "data-title"), STATE_HEAD_TITLE_LIMIT, name);
  const description = name === null ? null : clean(attr(attrs, "data-description"), STATE_HEAD_DESCRIPTION_LIMIT, name);
  const lm = attr(attrs, "data-lastmod");
  const lastmod = lm !== null && /^\d{4}-\d{2}-\d{2}$/.test(lm) ? lm : null;
  const kept = attrs.replace(/ data-(?:title|description|robots|land|land-name|lastmod)="[^"]*"/g, "");
  return { html: `<section class="statepage" id="statepage"${kept}>${fragment.slice(root[0].length)}`, title, description, name, lastmod };
}

/** The index fragment without its head attributes (the page map gives the index its title). */
export function stateIndexBody(fragment: string): string {
  const root = STATE_INDEX_SHAPE.exec(fragment);
  if (root === null) return fragment;
  const kept = (root[1] ?? "").replace(/ data-(?:title|description|robots|path)="[^"]*"/g, "");
  return `<section class="stateindex" id="stateindex"${kept}>${fragment.slice(root[0].length)}`;
}

export type StateFetched = { readonly kind: "ok"; readonly html: string } | { readonly kind: "missing" } | { readonly kind: "failed"; readonly reason: string };

async function fetchFragment(url: string, shape: RegExp, o: TileFetchOptions): Promise<StateFetched> {
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
    if (!shape.test(body) || !body.trimEnd().endsWith("</section>") || /<script|<style|javascript:/i.test(body)) return { kind: "failed", reason: "not a Land fragment" };
    return { kind: "ok", html: body };
  } catch (err) {
    const reason = err instanceof Error && err.name === "AbortError" ? `timeout after ${o.timeoutMs} ms` : String(err);
    logFragmentFailure(url, null, reason, Date.now() - t0);
    return { kind: "failed", reason };
  } finally {
    clearTimeout(timer);
  }
}

/** One Land's page fragment by its slug. */
export function fetchStatePage(slug: string, lang: Lang, o: TileFetchOptions): Promise<StateFetched> {
  if (!isStateSlug(slug)) return Promise.resolve({ kind: "missing" });
  return fetchFragment(`${o.baseUrl}/internal/state/${slug}?lang=${lang}${mapQuery(o)}`, STATE_PAGE_SHAPE, o);
}

/** The index of the sixteen. */
export function fetchStateIndex(lang: Lang, o: TileFetchOptions): Promise<StateFetched> {
  return fetchFragment(`${o.baseUrl}/internal/state/index?lang=${lang}`, STATE_INDEX_SHAPE, o);
}

export type StateListEntry = { readonly slug: string; readonly day: string };

/**
 * The sixteen with the day each was last shown from (the sitemap's source): one `slug<TAB>YYYY-MM-DD` line each. Null
 * when the digest does not answer, or answers anything but that shape — a line that is not one, or not sixteen of
 * them, is a failed read, never a shorter list.
 */
export async function fetchStateList(o: TileFetchOptions): Promise<readonly StateListEntry[] | null> {
  const fetchImpl: FetchLike = o.fetchImpl ?? ((u, init) => digestFetch(u, init));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), o.timeoutMs);
  try {
    const res = await fetchImpl(`${o.baseUrl}/internal/state/list`, { signal: controller.signal, headers: { accept: "text/plain" } });
    if (res.status !== 200 || !(res.headers.get("content-type") ?? "").startsWith("text/plain")) return null;
    const out: StateListEntry[] = [];
    for (const l of (await res.text()).split("\n").filter((x) => x !== "")) {
      const m = /^([a-z-]{4,40})\t(\d{4}-\d{2}-\d{2})$/.exec(l);
      if (m === null || !isStateSlug(m[1]!)) return null;
      out.push({ slug: m[1]!, day: m[2]! });
    }
    if (out.length !== 16 || new Set(out.map((e) => e.slug)).size !== 16) return null;
    const declared = res.headers.get("state-pages");
    if (declared !== null && Number(declared) !== out.length) return null;
    return out;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type StatePageAnswer =
  | { readonly kind: "unavailable" }
  | { readonly kind: "missing" }
  | { readonly kind: "redirect"; readonly to: `/${string}` }
  | { readonly kind: "page"; readonly slug: string; readonly path: `/${string}`; readonly head: StateHead };

/** `raw`: the segment after `state/`. */
export async function resolveStatePage(lang: Lang, raw: string, o: TileFetchOptions): Promise<StatePageAnswer> {
  const a = stateAddress(raw);
  if (a.kind === "none") return { kind: "missing" };
  if (a.kind === "respell") return { kind: "redirect", to: statePath(lang, a.slug) };
  const r = await fetchStatePage(a.slug, lang, o);
  if (r.kind === "missing") return { kind: "missing" };
  if (r.kind === "failed") return { kind: "unavailable" };
  return { kind: "page", slug: a.slug, path: statePath(lang, a.slug), head: stateHeadOf(r.html, a.slug) };
}

export type StateIndexAnswer = { readonly kind: "unavailable" } | { readonly kind: "page"; readonly html: string };

export async function resolveStateIndex(lang: Lang, o: TileFetchOptions): Promise<StateIndexAnswer> {
  const r = await fetchStateIndex(lang, o);
  return r.kind === "ok" ? { kind: "page", html: stateIndexBody(r.html) } : { kind: "unavailable" };
}
