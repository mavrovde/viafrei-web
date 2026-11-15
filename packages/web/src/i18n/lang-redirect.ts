/**
 * Automatic language switching, "redirect once" (owner 2026-10-27, 2.4.4): "Identify system or browser language and
 * switch the site automatically to the right language, Germany is default".
 *
 * `/` already answers in the negotiated language (`negotiate.ts`, 200 + `Vary: Accept-Language`). Every other page
 * lives under a language prefix, and a visitor who ENTERS on a German page (`/de/...`, from a search engine, a shared
 * link, a bookmark) is sent once to the same page in their language — and never again within the visit:
 *
 *   GET /de/<page>  →  302 /<lang>/<page>  when ALL of these hold
 *     1. the method is GET (HEAD, POST and everything else pass untouched);
 *     2. the path is a German page with a twin in every live language (`twinPath`: a page of the map, a place, a
 *        station or a motorway address in its canonical shape — never `/`, a legal page, the 404, a feed, a sitemap,
 *        `/_a/`, `/fragment/*` or `/api/*`, because none of those is a `/de/...` page);
 *     3. the user agent is not a robot (`CRAWLER`, the person gate's own list; it matches headless browsers too);
 *     4. the request carries an `Accept-Language` header at all — no header is never redirected, whatever else holds
 *        (the deploy probes and `the public smoke` send none);
 *     5. it is the FIRST page of a visit: `Sec-Fetch-Site` is not `same-origin` and the `Referer`, when sent, is
 *        another host. Our own pages send their own address as the Referer of a click to another page of ours
 *        (`Referrer-Policy: same-origin`, #1110) and nothing to another site; `Sec-Fetch-Site` and a Referer on our
 *        host are both a same-origin click; a `Sec-Fetch-Mode` other than `navigate` (a fetch, a prefetch) is not a
 *        page entry either;
 *     6. the visitor has NEVER chosen a language here: no `vf_lang` cookie, whatever language it names;
 *     7. `negotiate(Accept-Language)` is a live language other than German.
 *   The query string is kept; the fragment is never sent to a server, and a browser carries it across a 302 whose
 *   Location has none.
 *
 * OWNER RULE (2026-10-27): "If the user changed the language in the past the auto switch of the language should not
 * be triggered." Once a `vf_lang` cookie exists the automatic redirect never fires again — not to the browser's
 * language and not to the cookie's language either. Any choice in the menu counts, German included.
 *
 * The explicit choice: every link of the language menu carries the marker `?setlang=1` (`withPickMarker`). A GET
 * carrying it is answered with a 302 to the same address without the marker, and — when the request is same-origin —
 * with `Set-Cookie: vf_lang=<the page's language>`. Only the marker makes the cookie; nothing is stored because a
 * visitor merely arrived somewhere.
 *
 * PRIVACY (data-steward note, `.claude/skills/data-sources/SKILL.md` § "The language choice cookie"): `vf_lang` holds
 * one of the site's language codes and nothing else — no identifier, no time, no place. It is set only when the
 * visitor clicks a language in the menu, i.e. it stores the setting the visitor explicitly asked the service to
 * keep, so it is strictly necessary for a service the user requested (§ 25 Abs. 2 Nr. 2 TDDDG) and needs no
 * consent. First party, `HttpOnly` (no script reads it), `SameSite=Lax`, `Secure`, one year; the Datenschutz page
 * names it under "Sprachauswahl". nginx forwards THIS cookie alone to the shell (`the edge configuration`
 * `$vf_lang_cookie`); every other cookie is still dropped at the proxy.
 *
 * Two-second rule: pure header logic, no I/O on the request path.
 */
import { CRAWLER } from "../location/server.js";
import { DEFAULT_LANG, LIVE_LANGS, pageAt, pageById, pathFor, type Lang } from "../site/pages.js";
import { PLACE_SEGMENT, isPlaceSlug, placePath } from "../site/places.js";
import { STATION_SEGMENT, isStationSlug, stationPath } from "../site/stations.js";
import { MOTORWAY_NUMBER, MOTORWAY_SEGMENT } from "../site/motorways.js";
import { isSlug } from "../site/slug.js";
import { negotiate } from "./negotiate.js";

/** The cookie the language menu's click sets. */
export const LANG_COOKIE = "vf_lang";
/** The query marker every language-menu link carries. */
export const PICK_PARAM = "setlang";
/** One year, in seconds. */
export const LANG_COOKIE_MAX_AGE_S = 365 * 24 * 60 * 60;

const isLive = (x: string): x is Lang => (LIVE_LANGS as readonly string[]).includes(x);

/**
 * The same page in `lang` for a GERMAN page path, or null when `path` is not a German page that every live language
 * has. Pure: the map, the places', stations' and motorways' path shapes — no lookup.
 */
export function twinPath(path: string, lang: Lang): `/${string}` | null {
  if (path !== "/de" && !path.startsWith("/de/")) return null;
  const page = pageAt(path);
  if (page !== null) {
    if (page.lang !== DEFAULT_LANG || page.id === "404" || pageById(page.id).legal) return null;
    return pathFor(page.id, lang);
  }
  const segs = path.slice("/de/".length).split("/");
  const [word, first, ...rest] = segs;
  if (word === PLACE_SEGMENT && first !== undefined && rest.length === 0 && isPlaceSlug(first)) return placePath(lang, first);
  if (word === STATION_SEGMENT && first !== undefined && rest.length === 0 && isStationSlug(first)) return stationPath(lang, first);
  if (word === MOTORWAY_SEGMENT && first !== undefined && MOTORWAY_NUMBER.test(first.toUpperCase()) && first === first.toLowerCase() && rest.every(isSlug)) {
    return `/${lang}/${segs.join("/")}`;
  }
  return null;
}

/** Whether a German page can be answered with a redirect: such a page varies with the visitor's language headers. */
export const mayRedirect = (path: string): boolean => twinPath(path, "en") !== null;

/** The language a page path is in: its live prefix, or a German legal page at the root. */
export function langOfPath(path: string): Lang | null {
  const first = path.split("/")[1] ?? "";
  if (isLive(first)) return first;
  return pageAt(path)?.lang ?? null;
}

/** A language-menu link: the address with the marker added (before any fragment). */
export function withPickMarker(href: string): string {
  const hash = href.indexOf("#");
  const [base, frag] = hash === -1 ? [href, ""] : [href.slice(0, hash), href.slice(hash)];
  return `${base}${base.includes("?") ? "&" : "?"}${PICK_PARAM}=1${frag}`;
}

/** Whether the visitor chose a language in the menu before: a non-empty `vf_lang` cookie is present, whatever it names. */
export function hasLangChoice(cookie: string | null): boolean {
  if (cookie === null) return false;
  return cookie.split(";").some((part) => {
    const eq = part.indexOf("=");
    return eq !== -1 && part.slice(0, eq).trim() === LANG_COOKIE && part.slice(eq + 1).trim() !== "";
  });
}

/** Whether the request came from one of our own pages: `Sec-Fetch-Site: same-origin`, or a Referer on our host. */
export function sameOrigin(headers: Headers): boolean {
  if (headers.get("sec-fetch-site") === "same-origin") return true;
  const ref = headers.get("referer");
  if (ref === null || ref === "") return false;
  const host = headers.get("host");
  try {
    return host !== null && new URL(ref).host === host;
  } catch {
    // an unreadable Referer is not "another origin" — leave the visitor where they are
    return true;
  }
}

export type LangDecision =
  | { readonly kind: "none"; readonly why: string }
  | { readonly kind: "pick"; readonly location: string; readonly cookie: Lang | null }
  | { readonly kind: "redirect"; readonly location: string; readonly lang: Lang };

/** What to do with one request: nothing, strip the menu's marker (and keep the choice), or send the visitor to their language. */
export function decideLanguage(method: string, url: URL, headers: Headers): LangDecision {
  if (method !== "GET") return { kind: "none", why: "not a GET" };
  const path = url.pathname;

  if (url.searchParams.has(PICK_PARAM)) {
    const lang = langOfPath(path);
    if (lang === null) return { kind: "none", why: "a marker on an address in no language" };
    const params = new URLSearchParams(url.search);
    params.delete(PICK_PARAM);
    const query = params.toString();
    // From a cross-site link the marker is dropped and nothing is stored: only the visitor's own click keeps a choice.
    // An old browser sends no Sec-Fetch-Site, and our pages send no Referer, so both absent counts as our own page.
    const fetchSite = headers.get("sec-fetch-site");
    const ours = fetchSite === null ? headers.get("referer") === null || sameOrigin(headers) : fetchSite === "same-origin";
    return { kind: "pick", location: `${path}${query === "" ? "" : `?${query}`}`, cookie: ours ? lang : null };
  }

  if (!mayRedirect(path)) return { kind: "none", why: "not a German page with a twin" };
  if (CRAWLER.test(headers.get("user-agent") ?? "")) return { kind: "none", why: "a robot" };
  const accept = headers.get("accept-language");
  if (accept === null || accept.trim() === "") return { kind: "none", why: "no Accept-Language" };
  const mode = headers.get("sec-fetch-mode");
  if (mode !== null && mode !== "navigate") return { kind: "none", why: "not a navigation" };
  if (sameOrigin(headers)) return { kind: "none", why: "same-origin navigation" };

  if (hasLangChoice(headers.get("cookie"))) return { kind: "none", why: "chose a language before" };
  const lang = negotiate(accept);
  if (lang === DEFAULT_LANG) return { kind: "none", why: "German or unsupported" };
  const twin = twinPath(path, lang);
  if (twin === null) return { kind: "none", why: "no page in that language" };
  return { kind: "redirect", location: `${twin}${url.search}`, lang };
}

/** The headers every answer of a German page that may redirect carries: it varies with them, and no shared cache may keep it. */
export const REDIRECT_VARY = ["Accept-Language", "Cookie"] as const;

/** The `Set-Cookie` value for a choice. */
export function langCookie(lang: Lang): string {
  return `${LANG_COOKIE}=${lang}; Path=/; Max-Age=${String(LANG_COOKIE_MAX_AGE_S)}; SameSite=Lax; Secure; HttpOnly`;
}

/** The response for a decision, or null when the page renders as it is. */
export function languageResponse(d: LangDecision): Response | null {
  if (d.kind === "none") return null;
  const headers = new Headers({ location: d.location, "cache-control": "private, no-store", vary: REDIRECT_VARY.join(", ") });
  if (d.kind === "pick" && d.cookie !== null) headers.set("set-cookie", langCookie(d.cookie));
  return new Response(null, { status: 302, headers });
}
