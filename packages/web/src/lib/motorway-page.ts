/**
 * What a motorway address resolves to (#715), decided before anything renders
 * — Astro lets only a PAGE answer with a redirect, so the route files call this.
 *
 * NO 404 on a motorway address (owner 2026-10-14):
 *   - the canonical address (`/de/autobahn/a7`, `/en/autobahn/a7`, #892) → the page;
 *   - a spelling of a motorway number (`A 3`, `a03`, `BAB3`, `A7` in capitals)
 *     → 301 to the canonical address;
 *   - a motorway the register does not hold (the digest's 404) and anything
 *     that is not a motorway number → 301 to the index;
 *   - the digest not answering → 503, never a redirect that would tell an
 *     index the page has moved.
 */
import type { Lang } from "../site/pages.js";
import { canonicalMotorway, motorwayPath, motorwaySlug } from "../site/motorways.js";
import { pathFor } from "../site/pages.js";
import { fetchMotorwayIndex, fetchMotorwayPage, motorwayChoice, motorwayIndexChoice, motorwayViewQuery } from "./motorway.js";
import type { TileFetchOptions } from "./tiles.js";
import { EXIT_SEGMENT } from "./motorway.js";
import { fetchArea, type ObjectArea } from "./object-area.js";

/** #1188: the query the around block's topic form writes (`topicsOf`): an exit page with it is still its junction's. */
const AROUND_TOPIC_KEYS: ReadonlySet<string> = new Set(["topics", "f"]);

export type MotorwayPageAnswer =
  | { readonly kind: "unavailable" }
  /** `status` (#892): 301 for an address that moved, 303 for the filter form's submission, whose answer is the stretch's own address. */
  | { readonly kind: "redirect"; readonly to: `/${string}`; readonly status?: 301 | 303 }
  | {
      readonly kind: "page";
      readonly road: string;
      readonly html: string;
      readonly variant: boolean;
      readonly path: `/${string}`;
      /** #1188: an exit page's "In der Nähe" — the cards around its junction; absent on every other view. */
      readonly area?: ObjectArea;
    };

/** The pure half: which canonical road an address names, or the index. */
export function motorwayAddress(lang: Lang, raw: string): { readonly kind: "canonical"; readonly road: string } | { readonly kind: "redirect"; readonly to: `/${string}` } {
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = "";
  }
  const road = canonicalMotorway(decoded);
  if (road === null) return { kind: "redirect", to: pathFor("motorways", lang) };
  if (raw !== motorwaySlug(road)) return { kind: "redirect", to: motorwayPath(lang, road) };
  return { kind: "canonical", road };
}

/**
 * `rest` (#892): the path below the road (`nesselwang-to-kempten`,
 * `nesselwang-to-kempten/towards-wuerzburg`, `exit-138-nesselwang`) — the
 * stretch and the direction are PAGES. `params`: the address's query — the
 * form's fields, answered with a 303 to the stretch's path, and the layers,
 * which stay a query (#716: a layer choice is never kept and is `noindex`).
 *
 * The digest says which address the choice HAS (`Motorway-Path`); any other
 * spelling of it (a stretch read backwards, a segment that names nothing on
 * this road) is a 301 there, with the layers kept.
 */
export async function resolveMotorwayPage(lang: Lang, raw: string, rest: string | undefined, o: TileFetchOptions, params: URLSearchParams = new URLSearchParams()): Promise<MotorwayPageAnswer> {
  const a = motorwayAddress(lang, raw);
  if (a.kind === "redirect") return a;
  const segments = rest === undefined || rest === "" ? [] : rest.split("/");
  if (segments.length > 2) return { kind: "redirect", to: motorwayPath(lang, a.road) };
  const choice = motorwayChoice(params, segments);
  // #1188: an exit page (one `exit-…` segment; no query but the block's own topic choice) asks its junction's cards
  // beside the page, under the same deadline
  const exit = segments.length === 1 && EXIT_SEGMENT.test(segments[0] ?? "") && [...params.keys()].every((k) => AROUND_TOPIC_KEYS.has(k)) ? (segments[0] ?? "") : null;
  const [r, area] = await Promise.all([fetchMotorwayPage(a.road, lang, o, choice), exit === null ? Promise.resolve(undefined) : fetchArea({ kind: "exit", road: a.road, segment: exit }, lang, o)]);
  if (r.kind === "missing") return { kind: "redirect", to: pathFor("motorways", lang) };
  if (r.kind === "failed") return { kind: "unavailable" };
  const asked = `${motorwayPath(lang, a.road)}${segments.map((s) => `/${s}`).join("")}`;
  const path = (r.path ?? motorwayPath(lang, a.road)) as `/${string}`;
  const view = motorwayViewQuery(params);
  const form = params.has("from") || params.has("to") || params.has("dir");
  if (form || path !== asked) return { kind: "redirect", to: `${path}${view === "" ? "" : `?${view}`}` as `/${string}`, status: form ? 303 : 301 };
  return { kind: "page", road: a.road, html: r.html, variant: segments.length > 0 || [...params.keys()].length > 0, path, ...(area === undefined ? {} : { area }) };
}

export type MotorwayIndexAnswer = { readonly kind: "unavailable" } | { readonly kind: "redirect"; readonly to: `/${string}` } | { readonly kind: "page"; readonly html: string; readonly variant: boolean };

/**
 * `params`: the address's query (#716 C1). A search or an order renders the
 * same index for that choice, is never kept, and is marked `noindex` with the
 * bare index as its canonical (`MotorwaysPage.astro`).
 */
export async function resolveMotorwayIndex(lang: Lang, o: TileFetchOptions, params: URLSearchParams = new URLSearchParams()): Promise<MotorwayIndexAnswer> {
  const choice = motorwayIndexChoice(params);
  const r = await fetchMotorwayIndex(lang, o, choice);
  return r.kind === "ok" ? { kind: "page", html: r.html, variant: choice !== "" || [...params.keys()].length > 0 } : { kind: "unavailable" };
}
