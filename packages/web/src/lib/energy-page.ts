/**
 * #1076: one fuel station's and one charging site's page, fetched from the digest's internal routes like a Land page
 * (`lib/state-page.ts`): one GET under a deadline, an answer that is not recognisably ours is no answer, nothing throws
 * past the caller.
 *
 * The page's head — title, description, robots, the name, the day it last changed and the address facts the JSON-LD is
 * built from — is carried on the fragment's root (`renderFuelPage` / `renderChargingPage` in the digest) and read and
 * STRIPPED here. A value that is not plausibly the digest's is ignored, and the layout falls back to its own words.
 *
 * What an address resolves to is decided before anything renders (Astro lets only a PAGE answer with a redirect):
 *   - a slug that cannot be one (no ten-letter key) → the 404 page, nothing asked;
 *   - the digest's page → the page;
 *   - the digest's `data-moved` (another wording of the same key) → 301 to the current slug;
 *   - the digest's 404 → the 404 page;
 *   - the digest not answering → 503, never a redirect.
 *
 * No fuel figure travels this way (data-steward #1065 PF1, applied to one station): the page's prices are a slot the
 * person-gated `/fragment/fuel-station` fills (`lib/fuel-station.ts`).
 */
import type { Lang } from "../site/pages.js";
import { energyPath, isEnergySlug, type EnergyKind } from "../site/energy.js";
import { logFragmentFailure } from "./log.js";
import { mapQuery, type FetchLike, type TileFetchOptions } from "./tiles.js";
import { digestFetch } from "./agent-class.js";
import { unescapeAttr } from "./motorway-head.js";
import { fetchArea, type ObjectArea } from "./object-area.js";

export const ENERGY_HEAD_TITLE_LIMIT = 140;
export const ENERGY_HEAD_DESCRIPTION_LIMIT = 300;

export const ENERGY_PAGE_SHAPE = /^<section class="energypage energypage--(fuel|charging)" id="energypage"([^>]*)>/;

export type EnergyHead = {
  /** The fragment without the head attributes. */
  readonly html: string;
  /** #1178: the short heading the fragment names; else the title's. */
  readonly h1: string | null;
  readonly title: string | null;
  readonly description: string | null;
  readonly name: string | null;
  readonly lastmod: string | null;
  readonly street: string | null;
  readonly postcode: string | null;
  readonly city: string | null;
};

function attr(attrs: string, name: string): string | null {
  const m = new RegExp(` ${name}="([^"]*)"`).exec(attrs);
  return m === null ? null : unescapeAttr(m[1] ?? "");
}

const clean = (v: string | null, limit: number): string | null => {
  if (v === null) return null;
  const t = v.trim();
  if (t === "" || t.length > limit || /[<>{}]|\bundefined\b|\bnull\b/.test(t)) return null;
  return t;
};

/** The head off a page's fragment, and the fragment without it. A fragment about another page (kind or slug) yields no head. */
export function energyHeadOf(fragment: string, kind: EnergyKind, slug: string): EnergyHead {
  const root = ENERGY_PAGE_SHAPE.exec(fragment);
  const none = { html: fragment, h1: null, title: null, description: null, name: null, lastmod: null, street: null, postcode: null, city: null };
  if (root === null) return none;
  const attrs = root[2] ?? "";
  const kept = attrs.replace(/ data-(?:kind|slug|h1|title|description|name|robots|lastmod|street|postcode|city)="[^"]*"/g, "");
  const html = `<section class="energypage energypage--${root[1] ?? kind}" id="energypage"${kept}>${fragment.slice(root[0].length)}`;
  if (root[1] !== kind || attr(attrs, "data-kind") !== kind || attr(attrs, "data-slug") !== slug) return { ...none, html };
  const name = clean(attr(attrs, "data-name"), 100);
  const lm = attr(attrs, "data-lastmod");
  return {
    html,
    h1: clean(attr(attrs, "data-h1"), 120),
    name,
    title: clean(attr(attrs, "data-title"), ENERGY_HEAD_TITLE_LIMIT),
    description: clean(attr(attrs, "data-description"), ENERGY_HEAD_DESCRIPTION_LIMIT),
    lastmod: lm !== null && /^\d{4}-\d{2}-\d{2}$/.test(lm) ? lm : null,
    street: clean(attr(attrs, "data-street"), 120),
    postcode: ((p) => (p !== null && /^\d{5}$/.test(p) ? p : null))(attr(attrs, "data-postcode")),
    city: clean(attr(attrs, "data-city"), 80),
  };
}

export type EnergyFetched = { readonly kind: "ok"; readonly html: string } | { readonly kind: "moved"; readonly slug: string } | { readonly kind: "missing" } | { readonly kind: "failed"; readonly reason: string };

/** One page's fragment by its slug. */
export async function fetchEnergyPage(kind: EnergyKind, slug: string, lang: Lang, o: TileFetchOptions): Promise<EnergyFetched> {
  if (!isEnergySlug(slug)) return { kind: "missing" };
  const url = `${o.baseUrl}/internal/${kind}/${slug}?lang=${lang}${mapQuery(o)}`;
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
    const moved = new RegExp(`^<section class="energypage energypage--${kind}" id="energypage" data-moved="([a-z0-9-]{1,80})"></section>$`).exec(body.trim());
    if (moved !== null) return isEnergySlug(moved[1]!) && moved[1] !== slug ? { kind: "moved", slug: moved[1]! } : { kind: "failed", reason: "a move to nowhere" };
    const root = ENERGY_PAGE_SHAPE.exec(body);
    if (root === null || root[1] !== kind || !body.trimEnd().endsWith("</section>") || /<script|<style|javascript:|<iframe/i.test(body)) return { kind: "failed", reason: "not a station page fragment" };
    return { kind: "ok", html: body };
  } catch (err) {
    const reason = err instanceof Error && err.name === "AbortError" ? `timeout after ${o.timeoutMs} ms` : String(err);
    logFragmentFailure(url, null, reason, Date.now() - t0);
    return { kind: "failed", reason };
  } finally {
    clearTimeout(timer);
  }
}

export type EnergyPageAnswer =
  | { readonly kind: "unavailable" }
  | { readonly kind: "missing" }
  | { readonly kind: "redirect"; readonly to: `/${string}` }
  | { readonly kind: "page"; readonly slug: string; readonly path: `/${string}`; readonly head: EnergyHead; readonly area: ObjectArea };

/**
 * `raw`: the segment after `fuel/` or `charging/`. #1188: the page's around block (`lib/object-area.ts`) is asked in
 * parallel, under the same deadline — a slow block is its loading state, never a slow page; a slug that cannot be a
 * page asks nothing.
 */
export async function resolveEnergyPage(kind: EnergyKind, lang: Lang, raw: string, o: TileFetchOptions): Promise<EnergyPageAnswer> {
  if (!isEnergySlug(raw)) return { kind: "missing" };
  const [r, area] = await Promise.all([fetchEnergyPage(kind, raw, lang, o), fetchArea({ kind, slug: raw }, lang, o)]);
  if (r.kind === "missing") return { kind: "missing" };
  if (r.kind === "failed") return { kind: "unavailable" };
  if (r.kind === "moved") return { kind: "redirect", to: energyPath(kind, lang, r.slug) };
  return { kind: "page", slug: raw, path: energyPath(kind, lang, raw), head: energyHeadOf(r.html, kind, raw), area };
}
