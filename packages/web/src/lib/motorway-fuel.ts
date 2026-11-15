/**
 * The motorway page's deferred fuel fragment (#716, steward ruling M14–M22):
 * `GET /fragment/motorway-fuel?road=A7&lang=de[&from=…&to=…&dir=…]`, asked by
 * the page's one script when the fuel card comes into a person's view (PF2,
 * extended to this layer by the owner on 2026-10-26; it was a click, M16 d),
 * never on a hidden or prerendering page, from a prefetch or a speculation rule.
 *
 *  - (a) its path is `Disallow`ed in EVERY robots.txt group (`/fragment/`,
 *    `site/discovery.ts`);
 *  - (b) every answer carries `X-Robots-Tag: noindex, nofollow, noarchive,
 *    nosnippet` and `Cache-Control: private, no-store` (`MOTORWAY_FUEL_HEADERS`);
 *  - (c) the D4 gate (`personAsks(req, "fragment")`: same-origin, a user
 *    agent that is not a crawler, no HEAD, no prefetch/prerender) — otherwise
 *    the answer is the sentence and no data;
 *  - (f) HTML only — the digest's fragment, checked for its shape and for any
 *    script, never JSON;
 *  - (g) the uniform nginx rate limit of the shell applies, nothing more;
 *  - (h) `MOTORWAY_FUEL_FRAGMENT_ON`, the off switch, pinned by a test.
 *
 * The digest reads its own database through the read-only role and asks no
 * provider (M19). **A person's view of an empty layer asks** (#712, owner 2026-10-15:
 * "a person's click on a motorway page's fuel layer is a person's request";
 * since 2026-10-26 the card coming into a person's view, PF2/MF1):
 * when the stretch holds no price inside the cache window, the digest names
 * the ONE point it is answered for (`Fuel-Ask`, the service area nearest the
 * middle of the visible stretch, a compose-network header the browser never
 * sees), and THIS route — for a person viewing the page only, the same D4 gate — asks
 * the MCP process's site door about it: the same queue, the same merge and
 * covered rules, at most `fuel.ask_ids` stations. The layer then shows the
 * place card's note ("queued, position N, about M min") and is re-read about
 * then, like the place card, until it settles — no count, no clock (owner
 * 2026-10-15: no lost requests); paused while the page is hidden.
 */
import { isLang } from "../i18n/index.js";
import { askRefresh, fillCounter, fillOf, FUEL_FILL_HEAD_STEPS, FUEL_FILL_MIN_MS, FUEL_FILL_POLLS_SEEN, FUEL_REFRESH_BG_MS, fuelQuery as noteQuery, personAsks, type FuelNote, type PostLike } from "./fuel-refresh.js";
import { FUEL_FRAGMENT_HEADERS, fuelAnswer, fuelLoaderJs, isFragmentOf, readFuelFragment, refillOf } from "./fuel-fragment.js";
import { mapQuery, type TileFetchOptions } from "./tiles.js";
import { MOTORWAY_NUMBER } from "../site/motorways.js";

export { fuelAskOf } from "./fuel-fragment.js";

/** The off switch (M16 h): false answers every request with the sentence, and the page's layer shows only the sentence. */
export const MOTORWAY_FUEL_FRAGMENT_ON = true;

/** The fragment's path on this origin; the robots.txt rule covers `/fragment/` as a whole. */
export const MOTORWAY_FUEL_PATH = "/fragment/motorway-fuel";

export const MOTORWAY_FUEL_HEADERS: Readonly<Record<string, string>> = FUEL_FRAGMENT_HEADERS;

/** The fragment's root class. */
const ROOT = "motorway-fuel";

/** The digest fragment's shape: one `<div class="motorway-fuel">`, no script, no style, no `javascript:`. */
export function isFuelFragment(body: string): boolean {
  return isFragmentOf(ROOT, body);
}

/** The layer wrapped to be re-read (#712): the delay and the poll count ride on the fragment's own tag. */
export function refillFragment(body: string, delayMs: number, polls: number, head = 0): string {
  return refillOf(ROOT, body, delayMs, polls, head);
}

export type MotorwayFuelOptions = TileFetchOptions & { readonly refreshUrl?: string | undefined; readonly refreshFetch?: PostLike };

/** The query the digest is asked with: only the names it knows (#892: the road, the language, the stretch and the direction segments), each by its own shape; anything else is dropped. */
export function fuelQuery(url: URL): { readonly road: string; readonly lang: string; readonly rest: string } | null {
  const road = url.searchParams.get("road") ?? "";
  const lang = url.searchParams.get("lang") ?? "";
  if (!MOTORWAY_NUMBER.test(road) || !isLang(lang)) return null;
  const rest: string[] = [];
  // #892: the page's stretch and direction are path segments (`stretch`, `towards`), each a slug.
  for (const k of ["stretch", "towards"] as const) {
    const v = url.searchParams.get(k);
    if (v !== null && v.length <= 80 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v)) rest.push(`${k}=${v}`);
  }
  return { road, lang, rest: rest.join("&") };
}

const answer = fuelAnswer;

/** The route, as a function of the request (the test drives it without Astro). */
export async function motorwayFuelRoute(req: Request, o: MotorwayFuelOptions): Promise<Response> {
  const reqUrl = new URL(req.url);
  const q = fuelQuery(reqUrl);
  if (q === null) return answer(404, "");
  const asks = MOTORWAY_FUEL_FRAGMENT_ON && personAsks({ method: req.method, headers: req.headers, url: req.url }, "fragment");
  const base = `${o.baseUrl}/internal/motorway/${q.road}/fuel?lang=${q.lang}${asks ? (q.rest === "" ? "" : `&${q.rest}`) : "&refused=1"}${mapQuery(o)}`;
  const read = (url: string) => readFuelFragment(url, o, ROOT);
  const first = await read(base);
  if (first === null) return answer(502, "");
  // #712: an empty stretch, a person viewing it, a refresh door configured — ask, then answer with what it did.
  if (!asks || first.ask === null || o.refreshUrl === undefined) return answer(200, first.body);
  const polls = fillCounter(Number(reqUrl.searchParams.get("polls") ?? "0"), FUEL_FILL_POLLS_SEEN);
  // `anchor` (#775 W3): the digest's `Fuel-Ask` is the stretch's public anchor; a wide refresh is sent about it as it is.
  const note: FuelNote | null = await askRefresh(first.ask, { url: o.refreshUrl, timeoutMs: FUEL_REFRESH_BG_MS, anchor: true, ...(o.refreshFetch === undefined ? {} : { fetchImpl: o.refreshFetch }) });
  if (note === null) return answer(200, first.body);
  const head = fillCounter(Number(reqUrl.searchParams.get("head") ?? "0"), FUEL_FILL_HEAD_STEPS);
  const next = fillOf(note, polls > 0 ? "fill" : "manual", polls, head);
  const second = await read(`${base}${noteQuery(note)}`);
  if (second === null) return answer(502, "");
  return answer(200, next === null ? second.body : refillFragment(second.body, next.delayMs ?? FUEL_FILL_MIN_MS, next.polls, next.head));
}

/**
 * The page's one script (PF2, extended from the place card to the motorway
 * layer by the owner on 2026-10-26: "show fuel prices on autobahn pages the
 * same way as on city pages, without a click"): when the fuel card comes into
 * a person's VIEW — never on a hidden or prerendering page, never from a
 * prefetch or a speculation rule (the loader's `shown()`) — fetch the fragment
 * for the motorway, stretch and direction in this page's address, once per
 * view (the observer disconnects), and put it in the container. A fragment the
 * route wrapped to be re-read (`data-vf-refill`, #712) is fetched again after
 * that delay, with its poll count, while it is still the one shown. The gate
 * and headers (a)–(h) above are unchanged. No event sent to analytics (M22, G4).
 * #1142: the loading line keeps its box from the first paint but is invisible until the read is made.
 */
export function motorwayFuelScript(): string {
  const loader = fuelLoaderJs({ path: MOTORWAY_FUEL_PATH, root: ROOT, params: `const p=new URLSearchParams({road:m[2].toUpperCase(),lang:m[1]});if(m[3]){if(!m[4]&&m[3].indexOf("towards-")===0)p.set("towards",m[3]);else p.set("stretch",m[3])}if(m[4])p.set("towards",m[4]);` });
  return `(()=>{const s=document.querySelector(".motorway__fuel");if(!s)return;const o=s.querySelector(".motorway__fuelout"),l=s.querySelector(".motorway__fuelloading"),f=s.querySelector(".motorway__fuelfailed"),n=s.querySelector(".motorway__nojs");if(!o)return;const m=location.pathname.match(/^\\/([a-z]{2})\\/autobahn\\/(a[1-9][0-9]{0,2})(?:\\/([a-z0-9-]+))?(?:\\/([a-z0-9-]+))?$/);if(!m)return;if(n)n.hidden=true;if(l){l.hidden=false;l.style.visibility="hidden"}${loader}const go=async()=>{await shown();if(l){l.hidden=false;l.style.visibility=""}if(f)f.hidden=true;try{await load(0,0)}catch(e){if(f)f.hidden=false}finally{if(l)l.hidden=true}};if(typeof IntersectionObserver!=="function"){go();return}const v=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting)){v.disconnect();go()}});v.observe(s)})();`;
}
