/**
 * #1076: one fuel station's deferred prices, the place card's pattern (#1065, steward ruling M14–M22, PF1–PF5) for
 * one station. The station's page (`/<lang>/fuel/<slug>`) prints the frame and heading with NO price and no MTS-K
 * figure; the prices come from `GET /fragment/fuel-station?station=<slug>&lang=de`, asked by the page's one script
 * when the slot comes into VIEW — never on a hidden or prerendered page, never from a prefetch:
 *
 *  - (a) its path is under `/fragment/`, `Disallow`ed in EVERY robots.txt group (`FRAGMENT_DISALLOW`);
 *  - (b) every answer carries `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet` and
 *    `Cache-Control: private, no-store` (`FUEL_FRAGMENT_HEADERS`);
 *  - (c) the D4 gate (`personAsks(req, "fragment")`) AND no user-agent class from nginx (`X-VF-Agent-Class`, #1141):
 *    otherwise the answer is the sentence and no data, the digest reads nothing (`refused=1`) and NO refresh is ever
 *    asked — a crawler never spends a Tankerkönig request (`test/fuel-station.test.ts`);
 *  - (f) HTML only — the digest's fragment, checked for its shape;
 *  - (h) `FUEL_STATION_FRAGMENT_ON`, the off switch.
 *
 * #712 for one station: a person's view whose held prices are all outside the cache window is answered with the
 * digest's `Fuel-Ask` (the station's own point, a compose-network header) — the route asks the MCP site door about
 * that point, and an answer still pending is wrapped to be re-read (`data-vf-refill`) until it settles.
 */
import { isLang } from "../i18n/index.js";
import { isEnergySlug } from "../site/energy.js";
import { askRefresh, fillCounter, fillOf, FUEL_FILL_HEAD_STEPS, FUEL_FILL_MIN_MS, FUEL_FILL_POLLS_SEEN, FUEL_REFRESH_BG_MS, fuelQuery as noteQuery, personAsks, type FuelNote, type PostLike } from "./fuel-refresh.js";
import { fuelAnswer, fuelLoaderJs, readFuelFragment, refillOf } from "./fuel-fragment.js";
import { AGENT_CLASS_HEADER } from "./agent-class.js";
import { mapQuery, type TileFetchOptions } from "./tiles.js";

/** The off switch (h): false answers every request with the sentence, and no page carries the script. */
export const FUEL_STATION_FRAGMENT_ON = true;

/** The fragment's path on this origin; the robots.txt rule covers `/fragment/` as a whole. */
export const FUEL_STATION_PATH = "/fragment/fuel-station";

/** The digest fragment's root class (`FUEL_STATION_PRICES_ROOT` in `packages/digest/src/presentation/energy-page-html.ts`). */
export const FUEL_STATION_ROOT = "fuel-station";

export type FuelStationOptions = TileFetchOptions & { readonly refreshUrl?: string | undefined; readonly refreshFetch?: PostLike };

/** The query: a page slug and a site language; anything else is dropped. */
export function fuelStationQuery(url: URL): { readonly slug: string; readonly lang: string } | null {
  const slug = url.searchParams.get("station") ?? "";
  const lang = url.searchParams.get("lang") ?? "";
  return isEnergySlug(slug) && isLang(lang) ? { slug, lang } : null;
}

/** (c): a person's own view from this origin's page, and no crawler class from nginx. */
export function stationPersonAsks(req: Request): boolean {
  if (!FUEL_STATION_FRAGMENT_ON) return false;
  if ((req.headers.get(AGENT_CLASS_HEADER) ?? "").trim() !== "") return false;
  return personAsks({ method: req.method, headers: req.headers, url: req.url }, "fragment");
}

/** The route, as a function of the request (the test drives it without Astro). */
export async function fuelStationRoute(req: Request, o: FuelStationOptions): Promise<Response> {
  const reqUrl = new URL(req.url);
  const q = fuelStationQuery(reqUrl);
  if (q === null) return fuelAnswer(404, "");
  const base = `${o.baseUrl}/internal/fuel/${q.slug}/prices?lang=${q.lang}${mapQuery(o)}`;
  if (!stationPersonAsks(req)) {
    // (c): the sentence alone; the digest reads nothing for it, and no refresh is asked.
    const refused = await readFuelFragment(`${base}&refused=1`, o, FUEL_STATION_ROOT);
    return refused === null ? fuelAnswer(502, "") : fuelAnswer(200, refused.body);
  }
  const polls = fillCounter(Number(reqUrl.searchParams.get("polls") ?? "0"), FUEL_FILL_POLLS_SEEN);
  const head = fillCounter(Number(reqUrl.searchParams.get("head") ?? "0"), FUEL_FILL_HEAD_STEPS);
  // A first view and a re-read alike: read what is held, and ask only when nothing held is inside the cache window
  // (the digest's `Fuel-Ask`). A re-read of a pending refresh asks again, joining the request the queue still holds.
  const first = await readFuelFragment(base, o, FUEL_STATION_ROOT);
  if (first === null) return fuelAnswer(502, "");
  if (first.ask === null || o.refreshUrl === undefined) return fuelAnswer(200, first.body);
  const ask = first.ask;
  const note: FuelNote | null = await askRefresh(ask, { url: o.refreshUrl, timeoutMs: FUEL_REFRESH_BG_MS, ...(o.refreshFetch === undefined ? {} : { fetchImpl: o.refreshFetch }) });
  const next = fillOf(note, polls > 0 ? "fill" : "page", polls, head);
  const got = await readFuelFragment(`${base}${noteQuery(note)}`, o, FUEL_STATION_ROOT);
  if (got === null) return fuelAnswer(502, "");
  return fuelAnswer(200, next === null ? got.body : refillOf(FUEL_STATION_ROOT, got.body, next.delayMs ?? FUEL_FILL_MIN_MS, next.polls, next.head));
}

/**
 * The page's one script: the prices slot (`.energypage__prices`) asks for its prices when it comes into view — never
 * while the page is hidden or prerendering, never from a prefetch. The station is the slot's own `data-station`. A
 * failure says so in the slot. No event is sent to analytics.
 */
export function fuelStationScript(): string {
  const loader = fuelLoaderJs({ path: FUEL_STATION_PATH, root: FUEL_STATION_ROOT, params: `const p=new URLSearchParams({station:st,lang:lg});` });
  return `(()=>{const s=document.querySelector(".energypage__prices");if(!s)return;const o=s.querySelector(".energypage__pricesout"),l=s.querySelector(".energypage__pricesloading"),f=s.querySelector(".energypage__pricesfailed"),j=s.querySelector(".energypage__pricesjs"),st=s.getAttribute("data-station")||"",lg=(document.documentElement.getAttribute("lang")||"").slice(0,2);if(!o||!/^[a-z0-9-]{1,80}$/.test(st)||!/^[a-z]{2}$/.test(lg)){if(f)f.hidden=false;return}if(j)j.hidden=true;${loader}const go=async()=>{await shown();if(l)l.hidden=false;try{await load(0,0)}catch(x){if(f)f.hidden=false}finally{if(l)l.hidden=true}};if(typeof IntersectionObserver!=="function"){go();return}const v=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting)){v.disconnect();go()}});v.observe(s)})();`;
}
