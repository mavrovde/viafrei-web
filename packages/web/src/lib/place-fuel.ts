/**
 * The place card's deferred fuel prices (#1065, the motorway page's pattern of
 * #716, steward ruling M14–M22): a place page — and the home's place block —
 * print the fuel card's frame and heading with no price, no station price row
 * and no MTS-K figure (the digest's `fuelRows=0`), so the corpus crawlers may
 * read the page. The prices come from
 * `GET /fragment/place-fuel?place=<slug>&lang=de`, asked by the page's one
 * script when the card comes into VIEW (owner 2026-10-25: no click on place
 * pages) — never on a hidden or prerendered page, never from a prefetch or a
 * speculation rule:
 *
 *  - (a) its path is under `/fragment/`, `Disallow`ed in EVERY robots.txt
 *    group (`site/discovery.ts` `FRAGMENT_DISALLOW`);
 *  - (b) every answer carries `X-Robots-Tag: noindex, nofollow, noarchive,
 *    nosnippet` and `Cache-Control: private, no-store` (`FUEL_FRAGMENT_HEADERS`);
 *  - (c) the D4 gate (`personAsks(req, "fragment")`: a user agent that is not a
 *    crawler, no HEAD, no prefetch/prerender, a same-origin script fetch) —
 *    otherwise the answer is the sentence and no data, and the digest reads
 *    nothing;
 *  - (f) HTML only — the digest's fragment, checked for its shape;
 *  - (g) the shell's uniform nginx rate limit, nothing more;
 *  - (h) `PLACE_FUEL_FRAGMENT_ON`, the off switch, pinned by a test.
 *
 * #712 / #981 C1: the view is a person's request — the route asks the MCP
 * process's site door for the place (its Gemeinde key) like the island's
 * POST did, and an answer still pending in the queue is wrapped to be re-read
 * (`data-vf-refill`), until it settles. `held=1` (the home's automatic reload)
 * shows the held prices and asks nothing. The page's document render asks
 * nothing at all (#981 C1).
 *
 * WHAT EACH ANSWER MEANS (#1222; held by test/place-fuel-1065.test.ts "#1222"),
 * read from the landing access log by its status alone:
 *  - 200 with prices: a person's view. With `data-vf-refill` the ask is still
 *    queued and the page re-reads it; with `pcard__fresh--paused` the site
 *    door's request budget is SPENT (#1221): no provider request was made, the
 *    card is the newest prices held with their times, said so, and it is final.
 *  - 200 with the one sentence (`refused=1`): not a person's request — a
 *    crawler or a declared automation agent (`isAutomationAgent`) that got past
 *    the edge, a HEAD, a prefetch, a navigation, no Fetch Metadata. Nothing is
 *    asked and no price is read. This is where an automated client ends up when
 *    it stays under its limit; it never spends the key.
 *  - 404, empty: an INCOMPLETE or malformed request — no `place`, no `lang`, a
 *    slug of the wrong shape (the 404s of 2026-11-08 were a client calling the
 *    path without its query) — or a well-formed slug that is no place. Final:
 *    the page's script does not ask again, and nothing was read.
 *  - 503, empty: the digest did not answer the slug's key lookup; asked again.
 *  - 502 / 504 / 409, empty: the card could not be read (its shape, a deadline),
 *    or a pager's list moved (409, the pager reloads).
 *  - 429 is NOT this route's: it is the edge's (the edge configuration,
 *    `limit_req_status 429`), before the shell is reached — `vf_auto` (one
 *    bucket for every declared automation agent on `/fragment/`, 1/min, burst
 *    3, keyed on the class so a person on the same address is untouched) or a
 *    per-address or crawler zone. nginx's error log names the zone
 *    (`by zone "vf_auto"`); the console's Host screen counts both per zone and
 *    per agent class (scripts/landing-collect.sh).
 *  - 403: answered by nobody since 2.5.22. It was the interim hand edit of
 *    2026-11-08 (`$vf_block_pf`, Lightpanda refused outright), replaced by the
 *    `vf_auto` zone; a 403 in an older log is that edit.
 */
import { isLang } from "../i18n/index.js";
import { isPlaceSlug } from "../site/places.js";
import { isEnergySlug } from "../site/energy.js";
import { askRefresh, fillCounter, fillOf, FUEL_FILL_HEAD_STEPS, FUEL_FILL_MIN_MS, FUEL_FILL_POLLS_SEEN, FUEL_REFRESH_BG_MS, fuelQuery as noteQuery, personAsks, type FuelNote, type PostLike } from "./fuel-refresh.js";
import { fuelAnswer, fuelLoaderJs, isFragmentOf, readFuelFragment, refillOf } from "./fuel-fragment.js";
import { placeKeyOfSlug } from "./place.js";
import { mapQuery, type TileFetchOptions } from "./tiles.js";
import { digestFetch } from "./agent-class.js";

/** The off switch (h): false answers every request with the sentence, and no page carries the script. */
export const PLACE_FUEL_FRAGMENT_ON = true;

/** The fragment's path on this origin; the robots.txt rule covers `/fragment/` as a whole. */
export const PLACE_FUEL_PATH = "/fragment/place-fuel";

/** #1116 AC4: a fuel grade code as forwarded (the digest's `FUEL_GRADE_SHAPE`). */
const FUEL_GRADE = /^[a-z0-9_]{1,16}$/;

/**
 * #1116 AC4: the one localStorage key of the fuel grade switch — written only by a click on a grade (the owner's
 * click-only rule, as the topic filter's "merken"), read on the next view to ask the prices in that order.
 */
export const FUEL_GRADE_STORE = "viafrei.fuelgrade";

/** The digest fragment's root class (`packages/digest/src/presentation/place-fuel-html.ts`). */
const ROOT = "place-fuel";
/** The empty root: a card the page would not show (no station held, nothing pending) — the script hides the card. */
const NONE = `${ROOT} ${ROOT}--none`;

export function isPlaceFuelFragment(body: string): boolean {
  return isFragmentOf(ROOT, body) || isFragmentOf(NONE, body);
}

export type PlaceFuelOptions = TileFetchOptions & { readonly refreshUrl?: string | undefined; readonly refreshFetch?: PostLike };

/**
 * The query: a stored place slug, a site language, `held=1` (ask nothing), and (#1061) the pager's `from` and `v` —
 * the stations from `from` on, pinned to the list's version; a pager's request is always `held` (it asks nothing).
 * Anything else is dropped.
 */
export function placeFuelQuery(url: URL): { readonly slug: string; readonly lang: string; readonly held: boolean; readonly page: string; readonly grade: string; readonly not: string } | null {
  const slug = url.searchParams.get("place") ?? "";
  const lang = url.searchParams.get("lang") ?? "";
  if (slug.length > 80 || !isPlaceSlug(slug) || !isLang(lang)) return null;
  const fromRaw = url.searchParams.get("from");
  const v = url.searchParams.get("v") ?? "";
  // a negative, empty or non-numeric `from` is the start, as on every pager
  const from = fromRaw === null ? null : /^[0-9]{1,6}$/.test(fromRaw) && Number(fromRaw) >= 1 ? fromRaw : "1";
  const page = from === null ? "" : `&from=${from}${/^[0-9]{1,15}$/.test(v) ? `&v=${v}` : ""}`;
  // #1116 AC4: the visitor's fuel grade, by its shape only — the digest owns which codes mean anything
  const g = url.searchParams.get("grade") ?? "";
  const grade = FUEL_GRADE.test(g) ? `&grade=${g}` : "";
  // #1188 AC 2: on a fuel station's page, its own station is left out of the card under it (a page slug, by its shape)
  const n = url.searchParams.get("not") ?? "";
  const not = isEnergySlug(n) ? `&not=${n}` : "";
  return { slug, lang, held: url.searchParams.get("held") === "1" || page !== "", page, grade, not };
}

/** The route, as a function of the request (the test drives it without Astro). */
export async function placeFuelRoute(req: Request, o: PlaceFuelOptions): Promise<Response> {
  const reqUrl = new URL(req.url);
  const q = placeFuelQuery(reqUrl);
  if (q === null) return fuelAnswer(404, "");
  const key = await placeKeyOfSlug(q.slug, o);
  if (key === undefined) return fuelAnswer(503, "");
  if (key === null) return fuelAnswer(404, "");
  const person = PLACE_FUEL_FRAGMENT_ON && personAsks({ method: req.method, headers: req.headers, url: req.url }, "fragment");
  const base = `${o.baseUrl}/internal/place/fuel?at=${encodeURIComponent(key)}&lang=${q.lang}${q.grade}${q.not}${mapQuery(o)}`;
  if (!person) {
    // (c): the sentence alone; the digest reads nothing for it.
    const refused = await readFuelFragment(`${base}&refused=1`, o, ROOT);
    return refused === null ? fuelAnswer(502, "") : fuelAnswer(200, refused.body);
  }
  // #1061: the pager's next stations — no refresh asked, no refill; a list that moved is 409 (the pager reloads).
  if (q.page !== "") return pageOf(`${base}${q.page}`, o);
  // #712: a person's view asks the site door first (none for `held`), then reads the card with what it did.
  const note: FuelNote | null = q.held ? null : await askRefresh(key, { url: o.refreshUrl, timeoutMs: FUEL_REFRESH_BG_MS, ...(o.refreshFetch === undefined ? {} : { fetchImpl: o.refreshFetch }) });
  const polls = fillCounter(Number(reqUrl.searchParams.get("polls") ?? "0"), FUEL_FILL_POLLS_SEEN);
  const head = fillCounter(Number(reqUrl.searchParams.get("head") ?? "0"), FUEL_FILL_HEAD_STEPS);
  const next = fillOf(note, polls > 0 ? "fill" : "page", polls, head);
  const got = await readCard(`${base}${noteQuery(note)}`, o);
  if (got === null) return fuelAnswer(502, "");
  return fuelAnswer(200, next === null || got.startsWith(`<div class="${NONE}">`) ? got : refillOf(ROOT, got, next.delayMs ?? FUEL_FILL_MIN_MS, next.polls, next.head));
}

/** A pager page of the stations: 200 with the fragment's root, 409 passed on, anything else a 502 (the fold keeps its link). */
async function pageOf(url: string, o: TileFetchOptions): Promise<Response> {
  const fetchImpl = o.fetchImpl ?? ((u: string, init?: RequestInit) => digestFetch(u, init));
  try {
    const r = await fetchImpl(url, { signal: AbortSignal.timeout(o.timeoutMs), headers: { accept: "text/html" } });
    if (r.status === 409) return fuelAnswer(409, "");
    const body = r.status === 200 ? await r.text() : "";
    return r.status === 200 && isFragmentOf(ROOT, body) ? fuelAnswer(200, body) : fuelAnswer(502, "");
  } catch {
    return fuelAnswer(504, "");
  }
}

/** The card's body, or the empty root that hides the card. */
async function readCard(url: string, o: TileFetchOptions): Promise<string | null> {
  const r = await readFuelFragment(url, o, [ROOT, NONE]);
  return r === null ? null : r.body;
}

/**
 * The page's one script: each deferred fuel card (`.pcard__fuelslot`) on the
 * page asks for its prices when it comes into view (`IntersectionObserver`;
 * at once when it already is) — never while the page is hidden or
 * prerendering (`shown()`), never from a prefetch. The place is the card
 * set's own page link (`a.place__page`, `/<lang>/place/<slug>`). A card the
 * fragment calls empty (`place-fuel--none`) is hidden; a failure says so in
 * the card. Only the cards of the first HTML are deferred — the island's own
 * cards (`/fragment/place`) carry their prices — so the script reads the page
 * once, and again for the cards a station page puts in place of its loading
 * block (2.4.6, the `vf:swapped` event of `REFRESH_JS`); a slot is asked once.
 * No event is sent to analytics (G4).
 *
 * #1142: the loading line holds its box from the first paint (the 2.4.3 CLS fix) but is INVISIBLE until the card
 * comes into view and the request is actually made — before, it read "Preise werden geladen …" from the first paint
 * while nothing was asked, so a card far down the page (Köln's, ~5 800 px) said it was loading for as long as nobody
 * scrolled to it, and a check that never reached it saw a load that never came. The line says "loading" only while it is.
 */
export function placeFuelScript(): string {
  const loader = fuelLoaderJs({ path: PLACE_FUEL_PATH, root: ROOT, params: `const p=new URLSearchParams({place:m[2],lang:m[1]});if(held||n<0)p.set("held","1");if(g)p.set("grade",g);if(own)p.set("not",own);if(n<0)n=0;` });
  return `(()=>{const held=new URLSearchParams(location.search).get("r")==="auto";const own=((location.pathname||"").match(/^\\/[a-z]{2}\\/fuel\\/([a-z0-9-]{1,120})$/)||[])[1]||"";const one=s=>{const o=s.querySelector(".pcard__fuelout"),l=s.querySelector(".pcard__fuelloading"),f=s.querySelector(".pcard__fuelfailed"),j=s.querySelector(".pcard__fueljs"),c=s.closest(".place"),a=c?c.querySelector("a.place__page"):null,m=a?(a.getAttribute("href")||"").match(/^\\/([a-z]{2})\\/place\\/([a-z0-9-]+)$/):null;if(!o)return;if(j)j.hidden=true;if(!m){if(f)f.hidden=false;return}if(l){l.hidden=false;l.style.visibility="hidden"}let g=null;try{g=localStorage.getItem(${JSON.stringify(FUEL_GRADE_STORE)})}catch(x){}${loader}o.addEventListener("click",e=>{const b=e.target&&e.target.closest?e.target.closest("button.fuelg__opt"):null;if(!b||!/^[a-z0-9_]{1,16}$/.test(b.value))return;g=b.value;try{localStorage.setItem(${JSON.stringify(FUEL_GRADE_STORE)},g)}catch(x){}load(-1,0).catch(()=>{if(f)f.hidden=false})});const go=async()=>{await shown();if(l){l.hidden=false;l.style.visibility=""}try{await load(0,0);const e=o.firstElementChild;if(e&&e.classList.contains("place-fuel--none")){const k=s.closest(".pcard");if(k)k.hidden=true}}catch(x){if(f)f.hidden=false}finally{if(l)l.hidden=true}};if(typeof IntersectionObserver!=="function"){go();return}const v=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting)){v.disconnect();go()}});v.observe(s)};const seen=new WeakSet();const all=()=>{for(const s of document.querySelectorAll(".pcard__fuelslot"))if(!seen.has(s)){seen.add(s);one(s)}};all();document.addEventListener("vf:swapped",all)})();`;
}
