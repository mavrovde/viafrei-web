/**
 * #1111: the site search as the shell shows it — the digest's groups (motorways, places, stations, exits and
 * interchanges, areas, points of interest: `packages/digest/src/server/site-search.ts`, each kind within its deadline)
 * merged with the shell's own two kinds, which only the shell holds: the site's PAGES (`site/pages.ts`, in the
 * visitor's language) and the NEWS entries (`news/entries.ts`). Every group is ranked by its best score (3 the name is
 * what was typed, 2 it begins with it, 1 a word of it does), the kinds' order breaking a tie, and every word around the
 * lists — a group's heading, a Gemeinde's "show the cards here", "some results not shown", the empty state — is here,
 * in the visitor's language.
 *
 * What was typed is one person's: it goes to the digest in the request and nowhere else — not logged (a failed
 * fragment logs its path, `log.ts`), not stored, not sent to analytics. The suggestions are POSTed
 * (`/fragment/search`); only the results page carries `?q=`, because that is what Enter does.
 */
import { t } from "../i18n/index.js";
import { entriesFor } from "../news/entries.js";
import { pageMeta } from "../site/meta.js";
import { PAGES, pathFor, type Lang, type PageId } from "../site/pages.js";
import { isSearchQuery, searchPath } from "../site/search.js";
import { esc } from "./answer-html.js";
import { getFragment } from "./place.js";
import type { TileFetchOptions } from "./tiles.js";

/** The digest's kinds, in its tie order, then the shell's own. */
export const DIGEST_KINDS = ["motorway", "road", "place", "station", "exit", "area", "poi"] as const;
export const WEB_KINDS = ["page", "news"] as const;
export const ALL_KINDS = [...DIGEST_KINDS, ...WEB_KINDS] as const;
export type Kind = (typeof ALL_KINDS)[number];
export const isKind = (k: string): k is Kind => (ALL_KINDS as readonly string[]).includes(k);

/** The public route the header box asks (POST, JSON `{ q, lang }`). */
export const SITE_SEARCH_ROUTE = "/fragment/search";
/** What the digest's answer, and the shell's, begins with: the place search's list, so the type-ahead accepts it. */
export const SITE_SEARCH_SHAPE = /^<div class="place-suggest site-results[ "]/;
export const SUGGEST_PER_KIND = 4;
export const RESULTS_PER_PAGE = 20;

export type Group = {
  readonly kind: Kind;
  readonly best: number;
  readonly total: number;
  /** The group's `<li>` items, as rendered (the digest's, or the shell's own). */
  readonly items: string;
};
export type Results = {
  readonly groups: readonly Group[];
  readonly partial: readonly Kind[];
  readonly credits: string;
  /** 2.5.8 (AC 4): the digest's nearest-spelled place, read in the same answer, when it found nothing else. */
  readonly nearest?: Nearest | null;
};

/** The fold both sides of a comparison go through: case, umlauts both ways, ß/ss, accents, hyphens and spaces. */
export function fold(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** 3 the name is what was typed, 2 it begins with it, 1 a word of it does (or, from four letters, it contains it), else 0. */
export function score(name: string, q: string): number {
  const n = fold(name);
  const f = fold(q);
  if (f === "" || n === "") return 0;
  if (n === f) return 3;
  if (n.startsWith(f)) return 2;
  if (n.split(" ").some((w) => w.startsWith(f)) || (f.length >= 4 && n.includes(f))) return 1;
  return 0;
}

/** A page's name: its title without the brand's tail. */
const pageName = (id: PageId, lang: Lang): string => pageMeta(id, lang).title.replace(/\s+[–—-]\s+ViaFrei$/u, "");

type Hit = { readonly name: string; readonly where: string; readonly href: string; readonly score: number };

const li = (kind: Kind, h: Hit): string =>
  `<li class="place-sug place-sug--${kind}"><a class="place-opt" href="${esc(h.href)}"><span class="place-opt__name">${esc(h.name)}</span>${h.where === "" ? "" : ` <span class="place-opt__where">· ${esc(h.where)}</span>`}</a></li>`;

/**
 * The site's pages a query names: by the page's name in the visitor's language, in German and in English (a German
 * "Datenschutz" typed on the English site still finds the page), and by its address word ("connect").
 */
export function pageHits(lang: Lang, q: string): Hit[] {
  const out: Hit[] = [];
  for (const p of PAGES) {
    if (p.id === "404" || p.id === "start") continue;
    const own = pageName(p.id, lang);
    const keys = [own, pageName(p.id, "de"), pageName(p.id, "en"), p.slug.slice(1)];
    const s = Math.max(...keys.map((k) => score(k, q)));
    if (s > 0) out.push({ name: own, where: "", href: pathFor(p.id, lang), score: s });
  }
  return out.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, lang));
}

/** The News entries a query names, by their title in the visitor's language (an entry has text in some languages only). */
export function newsHits(lang: Lang, q: string): Hit[] {
  return entriesFor(lang)
    .map((e) => ({ name: e.t.title, where: e.date, href: `${pathFor("news", lang)}#${e.id}`, score: score(e.t.title, q) }))
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score || b.where.localeCompare(a.where));
}

/** 2.5.8: the digest's nearest spelling, in an answer with no group (`renderSiteSearch`). */
const NEAREST = /^<section class="ss-nearest"><ul class="place-suggest__list">([\s\S]*?)<\/ul><\/section>/;

const GROUP = /<section class="ss-group ss-group--([a-z]+) ss-best-([0-3]) ss-total-(\d+)"><ul class="place-suggest__list">([\s\S]*?)<\/ul><\/section>/g;

/** The digest's answer read back into groups (and its credit lines); null when it is not that answer. */
export function parseDigest(html: string): Results | null {
  if (!SITE_SEARCH_SHAPE.test(html)) return null;
  const open = /^<div class="([^"]*)">/.exec(html)?.[1] ?? "";
  const partial = [...open.matchAll(/\bss-partial--([a-z]+)/g)].map((m) => m[1] ?? "").filter(isKind);
  const groups: Group[] = [];
  let end = open.length + `<div class="">`.length;
  for (const m of html.matchAll(GROUP)) {
    const kind = m[1] ?? "";
    if (!isKind(kind)) continue;
    groups.push({ kind, best: Number(m[2]), total: Number(m[3]), items: m[4] ?? "" });
    end = (m.index ?? 0) + m[0].length;
  }
  // 2.5.8 (AC 4): no group, and the nearest spelling in their place — its item, and the credit line after it
  const near = groups.length === 0 ? NEAREST.exec(html.slice(end)) : null;
  if (near !== null) end += near[0].length;
  const credits = html.slice(end).replace(/<\/div>\s*$/, "");
  return { groups, partial, credits, nearest: near === null ? null : { item: near[1] ?? "", credits } };
}

/** The shell's own groups, cut to `per` (from the page's offset). */
export function webGroups(lang: Lang, q: string, want: (k: Kind) => boolean, from: number, per: number): Group[] {
  const out: Group[] = [];
  for (const [kind, hits] of [["page", pageHits(lang, q)], ["news", newsHits(lang, q)]] as const) {
    if (!want(kind) || hits.length === 0) continue;
    const shown = hits.slice(from, from + per);
    if (shown.length > 0) out.push({ kind, best: Math.max(...hits.map((h) => h.score)), total: hits.length, items: shown.map((h) => li(kind, h)).join("") });
  }
  return out;
}

/** Every group, best first, the kinds' order breaking a tie. */
export function ranked(groups: readonly Group[]): Group[] {
  return [...groups].sort((a, b) => b.best - a.best || ALL_KINDS.indexOf(a.kind) - ALL_KINDS.indexOf(b.kind));
}

/** A Gemeinde's second action, labelled: the home's cards at it. */
const withAltLabels = (items: string, lang: Lang): string => items.replace(/<a class="ss-alt" href="([^"]*)"><\/a>/g, (_m, href: string) => `<a class="ss-alt" href="${href}">${esc(t(lang, "search.alt"))}</a>`);

/** The search page's address for a query, one kind and a page of it. */
export function searchHref(lang: Lang, q: string, kind: Kind | null = null, page = 1): string {
  const u = new URLSearchParams({ q: q.trim() });
  if (kind !== null) u.set("kind", kind);
  if (page > 1) u.set("page", String(page));
  return `${searchPath(lang)}?${u.toString()}`;
}

export type RenderAsk = { readonly mode: "suggest" } | { readonly mode: "page"; readonly kind: Kind | null; readonly page: number };

/** The results as the box's list (`suggest`) or the search page's groups (`page`). */
export function renderResults(lang: Lang, q: string, r: Results, ask: RenderAsk): string {
  const h = ask.mode === "suggest" ? "h3" : "h2";
  const sections = ranked(r.groups).map((g) => {
    const head = `<${h} class="ss-group__head">${esc(t(lang, `search.kind.${g.kind}`))}${g.total > 1 ? ` <span class="ss-group__n">(${String(g.total)})</span>` : ""}</${h}>`;
    let more = "";
    if (ask.mode === "page" && ask.kind === null && g.total > RESULTS_PER_PAGE) more = `<p class="ss-more"><a href="${esc(searchHref(lang, q, g.kind))}">${esc(t(lang, "search.showAll"))}</a></p>`;
    if (ask.mode === "page" && ask.kind === g.kind) {
      const last = Math.max(1, Math.ceil(g.total / RESULTS_PER_PAGE));
      const links = [
        ask.page > 1 ? `<a rel="prev" href="${esc(searchHref(lang, q, g.kind, ask.page - 1))}">${esc(t(lang, "search.prev"))}</a>` : "",
        `<span>${esc(t(lang, "search.pageOf", { page: String(ask.page), pages: String(last) }))}</span>`,
        ask.page < last ? `<a rel="next" href="${esc(searchHref(lang, q, g.kind, ask.page + 1))}">${esc(t(lang, "search.next"))}</a>` : "",
      ].filter((x) => x !== "");
      more = `<nav class="ss-pager" aria-label="${esc(t(lang, "search.pager"))}">${links.join(" ")}</nav>`;
    }
    return `<section class="ss-group ss-group--${g.kind}">${head}<ul class="place-suggest__list">${withAltLabels(g.items, lang)}</ul>${more}</section>`;
  });
  const partial = r.partial.length === 0 ? "" : `<p class="ss-partial">${esc(t(lang, "search.partial"))}</p>`;
  const all = ask.mode === "suggest" && sections.length > 0 ? `<p class="ss-more"><a href="${esc(searchHref(lang, q))}">${esc(t(lang, "search.allResults"))}</a></p>` : "";
  return `<div class="place-suggest site-results">${sections.join("")}${partial}${all}${r.credits}</div>`;
}

/** The empty state: said in words, with the nearest-spelled place (when one answers) and the motorway index. */
export function renderNone(lang: Lang, q: string, nearest: Nearest | null): string {
  const near = nearest === null ? "" : `<p>${esc(t(lang, "search.nearest"))}</p><ul class="place-suggest__list">${withAltLabels(nearest.item, lang)}</ul>`;
  const index = `<p><a href="${esc(pathFor("motorways", lang))}">${esc(t(lang, "search.motorwayIndex"))}</a></p>`;
  return `<div class="place-suggest site-results ss-none"><p class="ss-none__say">${esc(t(lang, "search.none", { q: q.trim() }))}</p>${near}${index}${nearest?.credits ?? ""}</div>`;
}

/** The nearest-spelled place: its list item and the credit line its name owes. */
export type Nearest = { readonly item: string; readonly credits: string };

/** One ask of the digest's search; null when it did not answer (a missing source is said, never waited for). */
async function askDigest(lang: Lang, q: string, o: TileFetchOptions, full: { readonly kind: Kind | null; readonly page: number } | null): Promise<Results | null> {
  const u = new URLSearchParams({ q: q.trim(), lang });
  if (full !== null) {
    u.set("full", "1");
    if (full.kind !== null) u.set("kind", full.kind);
    u.set("page", String(full.page));
  }
  const r = await getFragment(`${o.baseUrl}/internal/search?${u.toString()}`, o, SITE_SEARCH_SHAPE, "</div>");
  return r.ok ? parseDigest(r.html) : null;
}

/**
 * The search, merged: the digest's kinds and the shell's. A digest that did not answer leaves its kinds out and says
 * so ("some results not shown"); the shell's own kinds always answer.
 */
export async function siteSearch(lang: Lang, q: string, o: TileFetchOptions, ask: RenderAsk): Promise<Results | null> {
  if (!isSearchQuery(q)) return null;
  const digestKind = ask.mode === "page" && ask.kind !== null && !(DIGEST_KINDS as readonly string[]).includes(ask.kind) ? "none" : "ask";
  const full = ask.mode === "page" ? { kind: ask.kind, page: ask.page } : null;
  const d = digestKind === "none" ? { groups: [], partial: [], credits: "" } : await askDigest(lang, q, o, full);
  const want = (k: Kind): boolean => ask.mode === "suggest" || ask.kind === null || ask.kind === k;
  const per = ask.mode === "suggest" ? SUGGEST_PER_KIND : RESULTS_PER_PAGE;
  const from = ask.mode === "page" ? (ask.page - 1) * RESULTS_PER_PAGE : 0;
  const own = webGroups(lang, q, want, from, per);
  if (d === null) return { groups: own, partial: DIGEST_KINDS.filter(want), credits: "" };
  return { groups: [...d.groups, ...own], partial: d.partial, credits: d.credits, nearest: d.nearest ?? null };
}
