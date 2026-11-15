/**
 * #1110 item 3 ("one next step on every entry page", from the landing log: 91–95 % of the visitors who arrived from
 * Google on a place or exit page left after that one page, and one in 166 reached the connect page). Every place,
 * motorway, exit and interchange page carries a short "Weiter" row after its first answer: the roads its own cards
 * name, each a link, and "Frag deine KI nach <Ort>", a link to the connect page carrying THAT page's subject. The
 * connect page turns the subject into a prefilled question to copy (`askQuestion`); such a view is `noindex` and its
 * canonical is the bare connect page.
 *
 * ONE rule for every page type, no list: the roads are the motorways of the register the page's own fragment prints a
 * shield of (`placeRoadsOf`), its own road first on an exit page; with none, the motorway index stands in, so every
 * row holds a road link. The subject travels as one of three closed shapes and is refused, never echoed, when it does
 * not fit one (`askAboutOf`).
 */
import { esc } from "@viafrei/design";
import { t } from "../i18n/index.js";
import { placeRoadsOf } from "./place-head.js";
import { MOTORWAY_REGISTER, canonicalMotorway, motorwayPath } from "../site/motorways.js";
import { pathFor, type Lang } from "../site/pages.js";

/**
 * What a visitor asks their AI about: a place, a motorway, one junction of a motorway, or a Land (#1182: a Land page's
 * box). A Land travels to the connect page as a place (`about=<name>`), so the connect page's own check is unchanged.
 */
export type AskAbout =
  | { readonly kind: "place"; readonly place: string }
  | { readonly kind: "land"; readonly place: string }
  | { readonly kind: "road"; readonly road: string }
  | { readonly kind: "exit"; readonly road: string; readonly exit: string };

/** At most this many road links in the row. */
export const NEXT_ROADS_MAX = 3;

/** A subject's name: 1–60 characters of letters, digits, spaces and the punctuation place and junction names carry. */
const NAME = /^[\p{L}\p{N}][\p{L}\p{N} .,'’()/-]{0,59}$/u;

const cleanName = (v: string | null): string | null => {
  if (v === null) return null;
  const s = v.replace(/\s+/gu, " ").trim();
  return NAME.test(s) ? s : null;
};

/** The subject a connect URL carries, or null — an unknown shape is refused, never shown. */
export function askAboutOf(params: URLSearchParams): AskAbout | null {
  const rawRoad = params.get("road");
  const road = rawRoad === null ? null : canonicalMotorway(rawRoad);
  if (rawRoad !== null && (road === null || !MOTORWAY_REGISTER.includes(road))) return null;
  const about = params.get("about");
  const name = cleanName(about);
  if (about !== null && name === null) return null;
  if (road !== null) return name === null ? { kind: "road", road } : { kind: "exit", road, exit: name };
  return name === null ? null : { kind: "place", place: name };
}

/** Whether a connect URL carries any subject parameter at all (the view is then `noindex`, valid or not). */
export const asksAbout = (params: URLSearchParams): boolean => params.has("about") || params.has("road");

/** The connect page's address for a subject. */
export function askHref(lang: Lang, a: AskAbout): string {
  const q = new URLSearchParams();
  if (a.kind === "place" || a.kind === "land") q.set("about", a.place);
  else if (a.kind === "road") q.set("road", a.road);
  else {
    q.set("road", a.road);
    q.set("about", a.exit);
  }
  return `${pathFor("connect", lang)}?${q.toString()}`;
}

/**
 * The row's AI link: the connect page with the subject when the subject passes the connect page's own check (it
 * round-trips through `askAboutOf`), an exit's road alone when its name does not, and the bare connect page otherwise.
 */
export function askLink(lang: Lang, a: AskAbout): { readonly href: string; readonly label: string; readonly html: string } {
  const href = askHref(lang, a);
  const back = askAboutOf(new URLSearchParams(href.slice(href.indexOf("?") + 1)));
  if (back !== null) return { href, label: askLabel(lang, back), html: askLabelHtml(lang, back) };
  if (a.kind === "exit") return askLink(lang, { kind: "road", road: a.road });
  return { href: pathFor("connect", lang), label: askLabel(lang, a), html: askLabelHtml(lang, a) };
}

/** The subject's name as the page shows it. */
export const subjectOf = (a: AskAbout): string => (a.kind === "place" || a.kind === "land" ? a.place : a.kind === "road" ? a.road : `${a.road} ${a.exit}`);

/** The subject as the row's link names it ("Frag deine KI nach Köln"). */
export function askLabel(lang: Lang, a: AskAbout): string {
  return t(lang, "next.ask", { place: subjectOf(a) });
}

/**
 * The same label as HTML, the subject a name marked translate="no" (#449, the #1051 shape): "Köln" on an English page
 * is the place's name, not German copy (language e2e, 2.5.2).
 */
export function askLabelHtml(lang: Lang, a: AskAbout): string {
  const MARK = "\u0000";
  const [before = "", after = ""] = t(lang, "next.ask", { place: MARK }).split(MARK);
  return `${esc(before)}<span translate="no">${esc(subjectOf(a))}</span>${esc(after)}`;
}

/** The prefilled question the connect page offers to copy, in the page's language. */
export function askQuestion(lang: Lang, a: AskAbout): string {
  if (a.kind === "place" || a.kind === "land") return t(lang, "connectPage.about.place", { place: a.place });
  if (a.kind === "road") return t(lang, "connectPage.about.road", { road: a.road });
  return t(lang, "connectPage.about.exit", { road: a.road, exit: a.exit });
}

/** One road link of the row. */
export type NextRoad = { readonly label: string; readonly href: string };

/**
 * The row's road links: `first` (an exit page's own motorway), then the register motorways the fragment prints a
 * shield of, each once, at most `NEXT_ROADS_MAX`, never `except` (a motorway page's own road); none at all: the
 * motorway index.
 */
export function nextRoads(lang: Lang, fragment: string, o: { readonly first?: string; readonly except?: string } = {}): readonly NextRoad[] {
  const register = MOTORWAY_REGISTER;
  const roads: string[] = [];
  for (const r of [...(o.first === undefined ? [] : [o.first]), ...placeRoadsOf(fragment)]) {
    const road = canonicalMotorway(r);
    if (road === null || road === o.except || !register.includes(road) || roads.includes(road)) continue;
    roads.push(road);
  }
  const out = roads.slice(0, NEXT_ROADS_MAX).map((road) => ({ label: road, href: motorwayPath(lang, road) }));
  return out.length > 0 ? out : [{ label: t(lang, "next.motorways"), href: pathFor("motorways", lang) }];
}
