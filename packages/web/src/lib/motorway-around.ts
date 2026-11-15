/**
 * The "around you" block of a motorway page (#890), asked by the location
 * island after the visitor's position is known, and by the page itself for the
 * IP rung's approximate cell.
 *
 * POST with a small JSON body like the place route (`lib/fragment-route.ts`):
 * the position travels in the body, never in the access-logged URL. The key is
 * the cell the DEVICE rounded (`pt:` on the ~500 m grid) or a chosen Gemeinde
 * (`ags:`/`slug:`); the digest refuses anything finer. The answer is the
 * digest's HTML fragment, `no-store`.
 */
import { chargingFilterForward } from "./charging-filter.js";
import { isLang } from "../i18n/index.js";
import type { Lang } from "../site/pages.js";
import { canonicalMotorway, motorwaySlug } from "../site/motorways.js";
import { isPlaceKey } from "../location/ladder.js";
import { motorwayIpCell } from "../location/server.js";
import { placeScopeOf } from "./place-scope.js";
import { bodyOf } from "./fragment-route.js";
import { getFragment, placeKeyOfSlug } from "./place.js";
import { mapQuery, type TileFetchOptions } from "./tiles.js";
import { MOTORWAY_LAYERS } from "./motorway.js";
import { budgetLeft } from "./page-budget.js";
import { motorwayHeadOf } from "./motorway-head.js";

/** The radius chips (km) and the default — the digest's `RADIUS_CHIPS_KM`/`RADIUS_DEFAULT_KM`, pinned by test/motorway-around.test.ts. */
export const AROUND_CHIPS_KM = [5, 10, 25, 50, 100] as const;
export const AROUND_DEFAULT_KM = 25;
export const AROUND_MIN_KM = 1;
export const AROUND_MAX_KM = 100;
const HOWS = new Set(["browser", "ip", "manual", "saved"]);

/**
 * OFF until the data steward reopens G1/G5 (data-sources skill, the #716 ruling: "the motorway pages carry no
 * location ladder … a later feature that adds one reopens G1, because the place pages are unmeasured for exactly
 * that reason") and § 5 of the Datenschutzerklärung changes with it (G6). While off, the motorway page renders no
 * position bar and `/fragment/motorway-around` answers 404 — the page is exactly as before. `VF_MOTORWAY_AROUND=1`
 * turns it on (the e2e server sets it; production's `.env` does not until that ruling).
 */
export function motorwayAroundOn(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return env["VF_MOTORWAY_AROUND"] === "1";
}

/** The radius of the address (`?r=`): an integer 1–100, else the default; `asked` says whether the address carried one at all. */
export function aroundRadius(params: URLSearchParams): { readonly km: number; readonly raw: string | null } {
  const raw = params.get("r");
  const n = raw !== null && /^\d{1,3}$/.test(raw) ? Number(raw) : NaN;
  return { km: n >= AROUND_MIN_KM && n <= AROUND_MAX_KM ? n : AROUND_DEFAULT_KM, raw };
}

/**
 * The digest's answer: the around block, and (#890, 2.3.8) the page's main block rendered for the radius's stretch —
 * since #901 D12 also with a stretch in the address (narrowed inside the radius), null when the digest sent none (`main=0`). The main block is the fragment as the page
 * would embed it (`motorwayHeadOf`: its head attributes and intro taken off, the page keeps its static ones, G5.4).
 */
export type AroundFragment = { readonly html: string; readonly main: string | null; readonly key: string; readonly label: string };

/** Where the main block starts in the digest's answer. */
const MAIN_START = '<section class="motorway" id="motorway"';
/** The element the POST answer carries the main block in, for the island to swap (a template: inert, never rendered where it lies). */
export const MAIN_NEXT_ID = "mw-main-next";

/** The layer ids the address may carry (`?layer=…&f=1`), forwarded as the address's view, never a position. */
const layersOf = (v: unknown): readonly string[] | null =>
  Array.isArray(v) && v.length <= MOTORWAY_LAYERS.length && v.every((x) => typeof x === "string" && (MOTORWAY_LAYERS as readonly string[]).includes(x)) ? (v as string[]) : null;

/** The digest's block for one key; null when it did not answer or the key is not one it takes. */
const SEG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/**
 * The address's view segments after the road (`nesselwang-to-kempten`, `towards-kempten`, or both, `/`-joined):
 * a stretch wins over the radius for the lists, a direction orders the around block and makes "Ihre Fahrt" (#890, #894).
 * Anything else is dropped, never forwarded.
 */
export function viewSegments(s: unknown): { readonly stretch: string | null; readonly towards: string | null } {
  const out = { stretch: null as string | null, towards: null as string | null };
  if (typeof s !== "string" || s.length > 160) return out;
  for (const seg of s.split("/").filter((x) => x !== "")) {
    if (!SEG.test(seg) || seg.length > 80) return { stretch: null, towards: null };
    if (seg.startsWith("towards-")) out.towards = seg;
    else out.stretch = seg;
  }
  return out;
}
const isStretch = (s: unknown): s is string => typeof s === "string" && s.length <= 160;

export async function fetchMotorwayAround(road: string, at: string, r: string, how: string, lang: Lang, o: TileFetchOptions, stretch: string | null = null, layers: readonly string[] | null = null, withMain = true, ev = ""): Promise<AroundFragment | null> {
  if (!/^(?:pt|ags):/.test(at) || !isPlaceKey(at)) return null;
  const q = `at=${encodeURIComponent(at)}&r=${encodeURIComponent(r)}&how=${HOWS.has(how) ? how : "manual"}&lang=${lang}${(() => {
    const v = viewSegments(stretch);
    return `${v.stretch !== null ? `&stretch=${v.stretch}` : ""}${v.towards !== null ? `&towards=${v.towards}` : ""}`;
  })()}${layers === null ? "" : `&f=1${layers.map((l) => `&layer=${l}`).join("")}`}${withMain ? "" : "&main=0"}${((fwd) => (fwd === "" ? "" : `&${fwd}`))(chargingFilterForward(new URLSearchParams(ev)))}${mapQuery(o)}`;
  const f = await getFragment(`${o.baseUrl}/internal/motorway/${encodeURIComponent(road)}/around?${q}`, o, /^<section class="mwa" id="motorway-around"/, "</section>");
  if (!f.ok) return null;
  let label = "";
  try {
    label = decodeURIComponent(f.headers.get("place-label") ?? "");
  } catch {
    label = "";
  }
  const i = f.html.indexOf(MAIN_START);
  const html = i < 0 ? f.html : f.html.slice(0, i);
  if (!html.trimEnd().endsWith("</section>")) return null;
  const main = i < 0 ? null : motorwayHeadOf(road, f.html.slice(i)).html;
  return { html, main, key: f.headers.get("place-key") ?? at, label: label.slice(0, 200) };
}

const empty = (status: number): Response => new Response(null, { status, headers: { "cache-control": "no-store" } });

/** POST `/fragment/motorway-around`: `{ at, road, r, how, lang }`. */
export async function motorwayAroundRoute(req: Request, o: TileFetchOptions, on: boolean = motorwayAroundOn()): Promise<Response> {
  if (req.method !== "POST") return empty(405);
  if (!on) return empty(404);
  const b = await bodyOf(req);
  if (b === null || typeof b["lang"] !== "string" || !isLang(b["lang"]) || typeof b["at"] !== "string" || typeof b["road"] !== "string") return empty(400);
  const road = canonicalMotorway(b["road"]);
  if (road === null || motorwaySlug(road) !== b["road"].toLowerCase()) return empty(400);
  let at = b["at"];
  if (at.startsWith("slug:")) {
    const key = await placeKeyOfSlug(at.slice("slug:".length), o);
    if (key === undefined) return empty(503);
    if (key === null) return empty(404);
    at = key;
  }
  const r = typeof b["r"] === "number" || typeof b["r"] === "string" ? String(b["r"]) : String(AROUND_DEFAULT_KM);
  // `main: false` (2.3.11): a place that is not the visitor's own position has no radius, so the main block stays the road's.
  // #1081: the radius view's charging list under the page's filter (the island sends the address's `ev_*`)
  const ev = typeof b["ev"] === "string" && b["ev"].length <= 2000 ? chargingFilterForward(new URLSearchParams(b["ev"])) : "";
  const f = await fetchMotorwayAround(road, at, r, typeof b["how"] === "string" ? b["how"] : "manual", b["lang"], o, isStretch(b["s"]) ? b["s"] : null, layersOf(b["l"]), b["main"] !== false, ev);
  if (f === null) return empty(404);
  // The main block rides in an inert <template> after the around block; the island moves it into the page (2.3.8).
  return new Response(f.main === null ? f.html : `${f.html}<template id="${MAIN_NEXT_ID}">${f.main}</template>`, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "place-key": f.key, "place-label": encodeURIComponent(f.label) } });
}

/**
 * #1166: the least of the request's budget worth spending on the block — below it the block is not asked, the bar
 * is offered without it (the island asks once it runs).
 */
export const AROUND_MIN_MS = 250;

/**
 * What the motorway page's first HTML holds for the position bar: null when the feature is off (G5); otherwise the
 * radius, and the IP rung's cell with the block the digest rendered for it (the address is looked up and dropped).
 * `o.endsAt` (#1166): where the request's budget ends — each read gets what is left of it, none when less than
 * `AROUND_MIN_MS` is left, so the page's own read and these never add up past two seconds.
 */
export async function aroundFirstRender(
  headers: { get(n: string): string | null },
  road: string,
  lang: Lang,
  params: URLSearchParams,
  o: TileFetchOptions & { readonly geoipFile: string | undefined; readonly endsAt?: number | undefined },
  on: boolean = motorwayAroundOn(),
  stretch: string | null = null,
): Promise<{
  readonly radiusKm: number;
  readonly ip: ReturnType<typeof motorwayIpCell> | { readonly source: "germany"; readonly at: null; readonly usedGeoIp: false } | { readonly source: "chosen"; readonly at: string; readonly usedGeoIp: false };
  readonly block: AroundFragment | null;
  readonly layers: readonly string[] | null;
} | null> {
  if (!on) return null;
  // The read's options under what is left of the budget, or null: too little left to ask.
  const budgeted = (): TileFetchOptions | null => {
    const left = budgetLeft(o.endsAt);
    return left < AROUND_MIN_MS ? null : { ...o, timeoutMs: Math.min(o.timeoutMs, left) };
  };
  const radius = aroundRadius(params);
  const layers = addressLayers(params);
  // #1088: "Ganz Deutschland" (`?scope=de`) looks nothing up: the whole road, no position.
  // 2.4.6 (owner, the A4 with `?at=ags:14612000`): a place the ADDRESS names (`?at=`, an addressable key only — a point
  // never stands in a URL) is the block's place, chosen, before and instead of any IP lookup; the island then keeps it.
  const ask = placeScopeOf(params);
  if (ask.kind === "at") {
    const b = budgeted();
    const chosen = b === null ? null : await fetchMotorwayAround(road, ask.at, String(AROUND_DEFAULT_KM), "manual", lang, b, stretch, layers, false);
    if (chosen !== null) return { radiusKm: radius.km, ip: { source: "chosen", at: ask.at, usedGeoIp: false }, block: chosen, layers };
  }
  const ip = ask.kind === "germany" ? { source: "germany" as const, at: null, usedGeoIp: false as const } : motorwayIpCell(headers, { geoipFile: o.geoipFile });
  // The first HTML keeps the page's own main block (so "all of Germany" can restore it, and the page stays within its
  // budget): the island asks for the radius's main block once it has settled on this rung.
  // 2.3.11: an IP guess is not the visitor's own position, so it has no radius (#890): `?r=` does not apply to it.
  const b = ip.at === null ? null : budgeted();
  const block = ip.at === null || b === null ? null : await fetchMotorwayAround(road, ip.at, String(AROUND_DEFAULT_KM), "ip", lang, b, stretch, layers, false);
  return { radiusKm: radius.km, ip, block, layers };
}

/**
 * #1205 review B1: whether the first render's around block read the visitor — the IP rung ran (neither "Ganz
 * Deutschland" nor a place the address names answered it), so the page carries something placed by the client's
 * address (or its absence) and may not be held for another client.
 */
export function aroundReadVisitor(around: Awaited<ReturnType<typeof aroundFirstRender>>): boolean {
  return around !== null && around.ip.source !== "germany" && around.ip.source !== "chosen";
}

/** The address's layer choice (`f=1` and the `layer` values the page knows), or null: every layer. */
export function addressLayers(params: URLSearchParams): readonly string[] | null {
  if (params.get("f") !== "1") return null;
  return params.getAll("layer").filter((l, i, all) => (MOTORWAY_LAYERS as readonly string[]).includes(l) && all.indexOf(l) === i);
}

/**
 * The page's own scripts (the fuel layer's view, the copy button) bind to elements of the main block; when the island swaps
 * that block for the radius's (#890, 2.3.8) they are run again on `vf:main`, so the new buttons work too.
 */
export function rebindOnMainSwap(js: string): string {
  return js === "" ? "" : `(()=>{const f=()=>{${js}};f();document.addEventListener("vf:main",f)})();`;
}
