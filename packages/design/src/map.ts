/**
 * The map links of an item (#944): the openstreetmap.org link every item with
 * a point has carried since 2.0.10, and beside it ONE link that opens the same
 * item in the visitor's usual map app — the only place a map URL is built.
 *
 *  - `other` (a desktop, or anything not Android or iOS): Google Maps through its documented Maps URLs (`api=1`), no key,
 *    no script;
 *  - `android`: a `geo:` URI, which opens the map app the person set as default;
 *  - `ios`: maps.apple.com, because iOS has no "default map" link.
 *
 * Nothing is requested before a click: these are plain anchors, with
 * `rel="noopener noreferrer nofollow"` like the OSM link, so the target never
 * learns which of our pages it came from.
 *
 * A target is a POINT (rounded to five decimals, about a metre) or an address
 * SEARCH (the priced fuel rows: a station's point is never put into a link,
 * data steward 2026-10-13 (a′), so neither link carries one). Every query
 * value is percent-encoded (RFC 3986 strict) and the finished href is
 * HTML-escaped, so a label can carry no markup.
 */
import { esc, raw, type Html } from "./html.js";

/** The three kinds of map link, decided by the web shell from the `User-Agent` (`mapPlatformOfUserAgent`). */
export const MAP_PLATFORMS = ["other", "android", "ios"] as const;
export type MapPlatform = (typeof MAP_PLATFORMS)[number];

/** The `map` query value the shell sends the digest: one of the three, anything else (or nothing) is `other`. */
export function mapPlatformOf(v: unknown): MapPlatform {
  return v === "android" || v === "ios" ? v : "other";
}

/**
 * The platform of a `User-Agent`: "Android" is Android; "iPhone", "iPad" or
 * "iPod" is iOS, and so is "Macintosh" with a "Mobile/" build token (the iPad
 * in-app browsers that present themselves as a Mac). iPadOS Safari in its
 * default desktop mode sends a plain Mac string and gets the `other` link,
 * Google Maps in the browser, which works there too. Everything else — and no
 * header at all — is `other`.
 */
export function mapPlatformOfUserAgent(ua: string | null | undefined): MapPlatform {
  if (typeof ua !== "string" || ua === "") return "other";
  if (/\bAndroid\b/i.test(ua)) return "android";
  if (/\b(iPhone|iPad|iPod)\b/.test(ua)) return "ios";
  if (/\bMacintosh\b/.test(ua) && /\bMobile\/\w+/.test(ua)) return "ios";
  return "other";
}

/**
 * Where an item's own point may be: Germany's box with a margin — 47.27–55.06 °N,
 * 5.87–15.04 °E — so a swapped pair (lon, lat), a zero or a point abroad gets
 * no link rather than a link to the wrong place.
 */
export const MAP_LAT: readonly [number, number] = [47, 56];
export const MAP_LON: readonly [number, number] = [5, 16];

/** A point as the links carry it: five decimals, or null for no point, a non-finite coordinate or one outside the box. */
export function mapPoint(lat: number | null | undefined, lon: number | null | undefined): { readonly lat: string; readonly lon: string } | null {
  if (typeof lat !== "number" || typeof lon !== "number" || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < MAP_LAT[0] || lat > MAP_LAT[1] || lon < MAP_LON[0] || lon > MAP_LON[1]) return null;
  return { lat: lat.toFixed(5), lon: lon.toFixed(5) };
}

/** What a link opens: a point (already `mapPoint`ed) or an address search. */
export type MapTarget = { readonly kind: "point"; readonly lat: string; readonly lon: string } | { readonly kind: "search"; readonly query: string };

/** `encodeURIComponent`, and ! ' ( ) * as well (RFC 3986 strict), so a value can close no `(label)` and needs no entity. */
export function encodeQuery(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** The openstreetmap.org URL of a target: a marker at the point (`zoom`, 15 by default), or a search. Not HTML-escaped. */
export function osmMapUrl(t: MapTarget, zoom = 15): string {
  return t.kind === "point" ? `https://www.openstreetmap.org/?mlat=${t.lat}&mlon=${t.lon}#map=${zoom}/${t.lat}/${t.lon}` : `https://www.openstreetmap.org/search?query=${encodeQuery(t.query)}`;
}

/** The longest label a link may carry (data steward 2026-10-23, condition 3). */
export const MAP_LABEL_MAX = 80;

/**
 * The URL that opens a target in the platform's map app. Not HTML-escaped.
 *
 *  - a point: Google `search/?api=1&query=<lat>,<lon>`, Android
 *    `geo:<lat>,<lon>?q=<lat>,<lon>(<label>)`, Apple's unified
 *    `place?coordinate=<lat>,<lon>&name=<label>` — the digits are the target's,
 *    byte for byte the OSM sibling's;
 *  - an address search (the priced fuel rows, which carry NO coordinate in
 *    any link — steward rulings (a)/(a′) of 2026-10-13 and of 2026-10-23):
 *    Google `search/?api=1&query=<address>`, `geo:0,0?q=<address>`, Apple
 *    `search?query=<address>`.
 *
 * `label` (optional) names the pin on Android and Apple only — never on the
 * Google link (condition 3): text the row already prints, from a
 * non-Tankerkönig row, cut to {@link MAP_LABEL_MAX} characters and
 * percent-encoded. It is ignored for an address search.
 */
export function appMapUrl(t: MapTarget, platform: MapPlatform, label?: string): string {
  if (t.kind === "search") {
    const q = encodeQuery(t.query);
    if (platform === "android") return `geo:0,0?q=${q}`;
    if (platform === "ios") return `https://maps.apple.com/search?query=${q}`;
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  }
  const named = label === undefined ? "" : [...label.trim()].slice(0, MAP_LABEL_MAX).join("").trim();
  const ll = `${t.lat},${t.lon}`;
  if (platform === "android") return `geo:${ll}?q=${ll}${named === "" ? "" : `(${encodeQuery(named)})`}`;
  if (platform === "ios") return `https://maps.apple.com/place?coordinate=${ll}${named === "" ? "" : `&name=${encodeQuery(named)}`}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeQuery(ll)}`;
}

/** The words of the platform links in one language: Google's and Apple's own names for their maps there, and Android's "open in the map app". */
export type MapAppWords = { readonly google: string; readonly apple: string; readonly android: string };

/** The rel every map link carries. */
export const MAP_REL = "noopener noreferrer nofollow";

/** An anchor to `href` (escaped here) with the words given as `Html`; `name` marks the words a proper name (`translate="no"`). */
export function mapAnchor(href: string, words: Html, name = false): Html {
  return raw(`<a href="${esc(href)}" rel="${MAP_REL}"${name ? ' translate="no"' : ""}>${words}</a>`);
}

/** The OSM link of a target, with its words (the page's "Karte", or the item's own words). */
export function osmMapLink(t: MapTarget, words: Html, zoom = 15): Html {
  return mapAnchor(osmMapUrl(t, zoom), words);
}

/** The platform link of a target, in the page's words for that platform. */
export function appMapLink(t: MapTarget, platform: MapPlatform, words: MapAppWords, label?: string): Html {
  const word = platform === "android" ? words.android : platform === "ios" ? words.apple : words.google;
  // Google's and Apple's map names are brands — proper names a translated page keeps (#449) and a translator leaves alone; Android's words are ours.
  return mapAnchor(appMapUrl(t, platform, label), esc(word), platform !== "android");
}

/** Both links of one item: "Karte · Google Maps" (the separator the cards use between a row's parts). */
export function mapLinks(t: MapTarget, platform: MapPlatform, o: { readonly osmWords: Html; readonly words: MapAppWords; readonly label?: string; readonly zoom?: number }): Html {
  return raw(`${osmMapLink(t, o.osmWords, o.zoom)} · ${appMapLink(t, platform, o.words, o.label)}`);
}
