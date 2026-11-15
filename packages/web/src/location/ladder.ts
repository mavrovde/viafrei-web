/**
 * The location ladder of the home (#564 § 1), as VALUES — no request, no
 * clock, no storage — so every rung and every pair of rungs is a test.
 *
 * The order is the owner's: **browser → IP → typed or picked → Germany**, with
 * the remembered choice of this device on top on a return visit. Two refinements
 * the issue states and this file holds:
 *   - a choice the visitor MADE (typed, picked, saved from a pick) beats an IP
 *     guess, and is not overridden by an automatic browser fix either — a person
 *     in Berlin who picked Köln wants Köln;
 *   - a saved BROWSER position is refreshed by a newer browser fix.
 *
 * The cell grid is the digest's (`packages/digest/src/analysis/place.ts`
 * CELL_DEG — pinned by `test/location.test.ts`, because the site may not import
 * the digest): a position is rounded to it ON THE DEVICE before anything is
 * sent, and again here before anything is asked.
 */
import type { GeoHit } from "./geoip.js";

export const CELL_DEG = { lat: 0.005, lon: 0.0075 } as const;

/** One grid step, without a floating-point tail. */
const snap = (v: number, step: number): number => Number((Math.round(v / step) * step).toFixed(4));

/** The place key of a point, rounded to its cell: `pt:50.94,6.96`. */
export function cellKey(lat: number, lon: number): string {
  return `pt:${snap(lat, CELL_DEG.lat)},${snap(lon, CELL_DEG.lon)}`;
}

/** What the server knows before any script runs: the IP rung's answer. */
export type ServerRung =
  /** A German address: cards for the Gemeinde its point lies in. */
  | { readonly kind: "ip"; readonly at: string }
  /** An address outside Germany: the picker hero; a neighbour's point offers the nearest German towns. */
  | { readonly kind: "outside"; readonly border: string | null }
  /** Unknown, private, a VPN or datacentre range the file does not place, or no file: Germany-wide. */
  | { readonly kind: "none" };

/** The countries whose addresses are offered border towns (the builder keeps a point for these). */
export const NEIGHBOURS: ReadonlySet<string> = new Set(["AT", "BE", "CH", "CZ", "DK", "FR", "LU", "NL", "PL"]);

/** The IP rung, decided from what the local file said (null: nothing). */
export function serverRung(hit: GeoHit | null): ServerRung {
  if (hit === null) return { kind: "none" };
  if (hit.country === "DE") return hit.lat === null || hit.lon === null ? { kind: "none" } : { kind: "ip", at: cellKey(hit.lat, hit.lon) };
  if (NEIGHBOURS.has(hit.country) && hit.lat !== null && hit.lon !== null) return { kind: "outside", border: cellKey(hit.lat, hit.lon) };
  return { kind: "outside", border: null };
}

/** How the page knows the place it shows — the pill's word and the `location_source` event's value. */
export type PlaceSource = "browser" | "ip" | "manual" | "saved" | "none";

/**
 * A key the island may hand to the shell: exactly the digest's grammar, nothing longer (#892: `slug:<place slug>`, a
 * place picked by its page's link; #1088: `dst:<geonameid>` a district and `plz:<five digits>` a postcode picked in
 * the sheet).
 */
export function isPlaceKey(s: unknown): s is string {
  return typeof s === "string" && s.length <= 90 && (/^ags:\d{8}$/.test(s) || /^slug:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) || /^pt:-?\d{1,2}(\.\d{1,6})?,-?\d{1,3}(\.\d{1,6})?$/.test(s) || isPickKey(s));
}

/**
 * #1088: a district (`dst:<geonameid>`), a postcode (`plz:<five digits>`) or (owner 2026-10-28) a point of interest
 * (`poi:<our id>`) picked in the sheet — the digest's `parsePickKey`.
 */
export function isPickKey(s: unknown): s is string {
  return typeof s === "string" && (/^dst:[1-9]\d{0,9}$/.test(s) || (/^plz:\d{5}$/.test(s) && s !== "plz:00000") || /^poi:[1-9]\d{0,12}$/.test(s));
}

/**
 * #1088 design § 4: a key that may stand in a page's address (`?at=`) — a Gemeinde, a district, a postcode or a point
 * of interest (a public place). A point never does: an address or a device position is personal data and travels in
 * a POST body only.
 */
export function isAddressableKey(s: unknown): s is string {
  return typeof s === "string" && (/^ags:\d{8}$/.test(s) || /^slug:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) || isPickKey(s));
}
