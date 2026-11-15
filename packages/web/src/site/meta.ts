/**
 * Each page's own `<title>`, description and social card (launch audit F-20).
 *
 * Until v1.8.5 every page — the 404 and both legal pages included — carried the
 * home's title and description, so a search result, a browser tab and a shared
 * link could not tell /de/business from the front page. Every string comes from
 * the page's OWN catalogue, from keys the page already renders (its `<h1>` and
 * lead, or the footer's link label for the two legal pages), so no new copy is
 * written here and a page in Turkish is described in Turkish only (#449).
 */
import { nowDescription, nowTitle, type NowKind } from "@viafrei/design";
import { t } from "../i18n/index.js";
import { htmlLangOf } from "../i18n/locales.js";
import { SITE_ORIGIN } from "./endpoints.js";
import type { Lang, PageId } from "./pages.js";
import { listFormat } from "../lib/intl-formats.js";

/** `og`: the social card's own title and description where they differ from the page's (#935: the home's card is the tagline and the whole pitch). */
export type PageMeta = { readonly title: string; readonly description: string; readonly og?: { readonly title: string; readonly description: string } };

/** `<page> — ViaFrei`, the brand last so a tab shows what the page is. */
const titled = (lang: Lang, head: string): string => `${head} — ${t(lang, "meta.siteName")}`;

export function pageMeta(page: PageId, lang: Lang): PageMeta {
  // #935: the home's title is the brand line, exempt from the length fit (owner rule); every other page is fitted (#1020).
  if (page === "start") return rawPageMeta(page, lang);
  const m = rawPageMeta(page, lang);
  // #992: the business and developers descriptions are written to fit (≤ 160 characters, whole sentences, every
  // language — `test/seo-992.test.ts`), so nothing cuts them: a description that does not fit is a test failure, not "…".
  if (WRITTEN_TO_FIT.has(page)) return { ...m, title: fitTitle(m.title) };
  return { ...m, title: fitTitle(m.title), description: fitDescription(m.description) };
}

/** #992: the pages whose description is never fitted, because the deck writes it within the bound. */
export const WRITTEN_TO_FIT: ReadonlySet<PageId> = new Set<PageId>(["business", "developers"]);

/** A page's title and description as the copy deck writes them, before the length fit (#1020); `pageMeta` is this, fitted. */
export function rawPageMeta(page: PageId, lang: Lang): PageMeta {
  switch (page) {
    // #935 (owner 2026-10-22, marketing rule 1): the home alone is brand-led — "ViaFrei – <tagline>", the pitch as its description.
    case "start":
      return homeMeta(t(lang, "meta.tagline"), t(lang, "meta.pitch"));
    // 2.1.13 (#715): the connect page's and the motorway index's are written for search — the search terms
    // first, about 60/155 characters, the brand last (`test/meta.test.ts`).
    case "connect":
      return { title: t(lang, "seo.connectTitle"), description: t(lang, "seo.connectDescription") };
    case "developers":
      return { title: titled(lang, t(lang, "seo.developersTitle")), description: t(lang, "seo.developersDescription") };
    case "business":
      return { title: titled(lang, t(lang, "seo.businessTitle")), description: t(lang, "seo.businessDescription") };
    case "fuel":
      return { title: titled(lang, t(lang, "fuelPage.title")), description: t(lang, "fuelPage.lead") };
    case "news":
      return { title: titled(lang, t(lang, "newsPage.title")), description: t(lang, "newsPage.lead") };
    case "motorways":
      return { title: t(lang, "seo.motorwaysTitle"), description: t(lang, "seo.motorwaysDescription") };
    // #1041: the station catalogue, written for search like the motorway index's
    case "stations":
      return { title: t(lang, "seo.stationsTitle"), description: t(lang, "seo.stationsDescription") };
    // #1074: the index of the sixteen Länder, written for search like the station catalogue's
    case "states":
      return { title: t(lang, "statePages.title"), description: t(lang, "statePages.description") };
    case "examples":
      return { title: titled(lang, t(lang, "examplesPage.title")), description: t(lang, "examplesPage.lead") };
    // #1020: each legal page has a description of its own (they shared the site's, so two results read the same).
    case "impressum":
      return { title: titled(lang, t(lang, "footer.imprint")), description: t(lang, "seo.imprintDescription") };
    case "datenschutz":
      return { title: titled(lang, t(lang, "footer.privacy")), description: t(lang, "seo.privacyDescription") };
    case "terms":
      return { title: titled(lang, t(lang, "footer.terms")), description: t(lang, "seo.termsDescription") };
    case "404":
      return { title: titled(lang, t(lang, "notFound.title")), description: t(lang, "notFound.text") };
  }
}

/**
 * THE LENGTH RULE (#1020): a title of at most `TITLE_FIT` characters, a
 * description of `DESCRIPTION_FIT_MIN`–`DESCRIPTION_MAX` — what a result page
 * shows uncut. The copy is written to fit; where a language, a long town name
 * or a long lead does not, the text is SHORTENED BY ITS OWN STRUCTURE, never cut
 * mid-word:
 *   - a title drops its brand suffix (` – ViaFrei`), then its last list items
 *     (`, …`), then the clause after a dash or colon, until it fits;
 *   - a description keeps the most whole sentences that fit; when even the
 *     first does not reach the minimum within the bound, it is cut at the last
 *     word inside the bound, with "…".
 * The home's title is the brand line and exempt (owner, #935; `test/brand.test.ts`).
 */
export const TITLE_FIT = 60;
export const DESCRIPTION_FIT_MIN = 70;

const BRAND_SUFFIX = /\s[—–]\sViaFrei$/u;

export function fitTitle(title: string, max: number = TITLE_FIT): string {
  let out = title;
  if (out.length > max) out = out.replace(BRAND_SUFFIX, "");
  while (out.length > max && /,\s[^,]+$/u.test(out)) out = out.replace(/,\s[^,]+$/u, "");
  if (out.length > max) {
    const dash = out.search(/\s[—–]\s|:\s/u);
    if (dash > 0) out = out.slice(0, dash);
  }
  return out.length > max ? cutAtWord(out, max) : out;
}

export function fitDescription(text: string, max: number = DESCRIPTION_MAX): string {
  if (text.length <= max) return text;
  let out = "";
  for (const s of text.split(/(?<=[.!?])\s+/u)) {
    const next = out === "" ? s : `${out} ${s}`;
    if (next.length > max) break;
    out = next;
  }
  return out.length >= DESCRIPTION_FIT_MIN ? out : cutAtWord(text, max);
}

/** The text cut at its last whole word within `max` characters, "…" included. */
function cutAtWord(text: string, max: number): string {
  const room = text.slice(0, max - 1);
  const at = room.lastIndexOf(" ");
  return `${(at > 0 ? room.slice(0, at) : room).replace(/[\s,;:–—-]+$/u, "")}…`;
}

/** The brand, as every catalogue's `meta.siteName` writes it. */
export const BRAND = "ViaFrei";

/**
 * The home's head (#935, marketing rules 1 and 3): the `<title>` is the brand
 * first, then the tagline; the description is the pitch within 160 characters;
 * the social card is the tagline and the whole pitch. One language's two strings in.
 */
export function homeMeta(tagline: string, pitch: string): PageMeta {
  return { title: `${BRAND} – ${tagline}`, description: pitchWithin(pitch, DESCRIPTION_MAX), og: { title: tagline, description: pitch } };
}

/**
 * The pitch in a field of `max` characters (#935, owner rule 4): the whole pitch;
 * else its first sentence and its close (the pitch without its second sentence, the
 * list of what is live); else the first sentence alone. The English form of the same
 * rule is `brandWithin` in `packages/mcp/src/content/brand.ts`, held equal by `test/brand.test.ts`.
 */
export function pitchWithin(pitch: string, max: number): string {
  const sentences = pitch.split(/(?<=\.)\s+/u);
  const forms = [pitch, [sentences[0] ?? "", ...sentences.slice(2)].join(" "), sentences[0] ?? ""];
  const fit = forms.find((f) => f.length <= max && f !== "");
  if (fit === undefined) throw new Error(`the pitch fits no form within ${String(max)} characters: ${pitch}`);
  return fit;
}

/** A motorway page's own title and description (#715): `A7 aktuell: Stau, Sperrungen, Baustellen – live – ViaFrei`. */
export function motorwayMeta(road: string, lang: Lang): PageMeta {
  return { title: fitTitle(t(lang, "seo.motorwayTitle", { road })), description: fitDescription(t(lang, "seo.motorwayDescription", { road })) };
}

/** A station page's own title and description (#1041): the station's name, written for search like a place page's. */
export function stationMeta(name: string, lang: Lang, city: string | null = null, now: { readonly kind: NowKind; readonly status: string } | null = null): PageMeta {
  const label = stationLabel(name, city);
  // #1175: the status leads the description; a title changes only for something reported (a quiet station keeps its search phrase)
  if (now !== null) return { title: now.kind === "nothing" ? fitTitle(t(lang, "seo.stationTitle", { name: label })) : nowTitle(lang, label, now.kind), description: nowDescription(`${label}: ${now.status}.`, t(lang, "seo.stationDescription", { name: label })) };
  return { title: fitTitle(t(lang, "seo.stationTitle", { name: label })), description: fitDescription(t(lang, "seo.stationDescription", { name: label })) };
}

/**
 * #1044: a station named with its town when the name does not say it already — "Kleinhalt (Görlitz)", but "Köln Hbf"
 * and "Frankfurt (Main) Hbf" as they are (every word of the town is in the name). A name is unique with its town, so
 * every title built from the pair is unique across the station set.
 */
export function stationLabel(name: string, city: string | null): string {
  if (city === null || city.trim() === "") return name;
  const fold = (s: string): string => s.toLocaleLowerCase("de").normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  // every word of the town's name (four letters or more: "am", "an", "der" say nothing) must be in the station's name
  const words = fold(city.trim())
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 4);
  const own = fold(name);
  return words.length > 0 && words.every((w) => own.includes(w)) ? name : `${name} (${city.trim()})`;
}

/** A place page's own title and description (#564; written for search in 2.1.13, #715). */
export function placeMeta(place: string, lang: Lang, roads: readonly string[] = [], now: { readonly kind: NowKind; readonly status: string; readonly item: string | null } | null = null): PageMeta {
  // #1176: what is happening now leads, as the block on the page says it; a translated page names no German street (#449)
  if (now !== null) return { title: nowTitle(lang, place, now.kind), description: nowDescription(`${place}: ${now.status}.`, lang === "de" ? now.item : null) };
  return { title: fitTitle(t(lang, "place.pageTitle", { place })), description: placeDescription(place, lang, roads) };
}

/**
 * #1020 round 2 (the Search Console baseline: local searches name the road and the place): when the
 * page's cards list roads (`placeRoadsOf`), the description leads with the place and as many of them as
 * fit, in the cards' order, in the language's own list form; with none, the place's general description.
 * A road number is the same in every language (#449: neutral).
 */
export function placeDescription(place: string, lang: Lang, roads: readonly string[]): string {
  const list = (xs: readonly string[]): string => listFormat(htmlLangOf(lang), { style: "long", type: "conjunction" }).format(xs);
  for (let k = roads.length; k >= 1; k--) {
    const text = t(lang, "place.pageDescriptionRoads", { place, roads: list(roads.slice(0, k)) });
    if (text.length <= DESCRIPTION_MAX) return text;
  }
  return fitDescription(t(lang, "place.pageDescription", { place }));
}

/**
 * The lengths a title and a description are written to (#715, 2.1.13): about 60
 * and 155 characters, measured with a reference place and motorway
 * (`Köln`, `A7`) — a search result cuts what is longer.
 */
export const TITLE_MAX = 61;
export const DESCRIPTION_MIN = 110;
export const DESCRIPTION_MAX = 160;

/** The social card's image: static, text-free but for the brand (scripts/og-image.ts). */
export const OG_IMAGE = { url: `${SITE_ORIGIN}/og.png`, width: 1200, height: 630, type: "image/png" } as const;

/** `og:locale` for a page language. */
const ALL_OG_LOCALES = {
  de: "de_DE", en: "en_GB", ru: "ru_RU", bg: "bg_BG", uk: "uk_UA", ro: "ro_RO", tr: "tr_TR",
  fr: "fr_FR", es: "es_ES", nl: "nl_NL", pl: "pl_PL", it: "it_IT", lt: "lt_LT", cs: "cs_CZ", hu: "hu_HU",
  sk: "sk_SK", da: "da_DK", pt: "pt_PT", hr: "hr_HR", sr: "sr_RS", el: "el_GR", lv: "lv_LV",
} as const;
export const OG_LOCALE: Readonly<Record<Lang, string>> = ALL_OG_LOCALES;
