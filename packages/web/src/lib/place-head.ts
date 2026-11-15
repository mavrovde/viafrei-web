/**
 * The roads a place page LISTS (#1020 round 2, from the Search Console
 * baseline: searchers type "sperrung l249 nideggen", "straßensperrung
 * friesoythe"): read off the place's own cards, the digest fragment the page
 * embeds, so the description can name them. A road is listed when the cards
 * print its shield (`class="shield"`, the digest's `shieldHtml`, with the
 * road's number as its text) — a motorway nearby, a road with a closure,
 * works or a jam. In the order the cards print them, each once.
 *
 * Nothing is invented: a fragment with no shield gives no road, and the
 * description is then the place's general one (`placeMeta`). The shell reads
 * no database (A2): the cards are the only source.
 */

/** A road number as the shields print it: A7, B96, L249, K12, St2047, S7 (an optional letter suffix: B27a). */
const ROAD = /^(?:A|B|L|K|St|S)\s?\d{1,4}[a-z]?$/u;

/** The shields' road numbers in the fragment, in order, each once. */
export function placeRoadsOf(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<(?:a|span)\b[^>]*\bclass="shield(?:\s[^"]*)?"[^>]*>([^<]{1,12})<\/(?:a|span)>/gu)) {
    const road = (m[1] ?? "").trim().replace(/\s+/gu, "");
    if (ROAD.test(road) && !out.includes(road)) out.push(road);
  }
  return out;
}

const PLACE_FIRST = /<div class="pagefirst" id="page-first">([\s\S]*?)<\/div><!--\/page-first-->/u;
const TEXT_OF = (s: string): string => s.replace(/<[^>]+>/gu, " ").replace(/\s+/gu, " ").replace(/\s([,.·])/gu, (_, x: string) => (x === "·" ? " ·" : x)).trim();

/** #1176: the fragment's status block, lifted under the page's H1; the fragment without it. Unchanged when it holds none. */
export function liftPlaceFirst(html: string): { readonly html: string; readonly first: string | null } {
  const m = PLACE_FIRST.exec(html);
  return m === null ? { html, first: null } : { html: html.replace(m[0], ""), first: m[1] ?? "" };
}

/**
 * #1176: what the block says now, for the title and the description: read off the block itself, so the head can never
 * say something the page does not. Null when the place's read failed: such a page claims nothing about now.
 */
export function placeNowOf(first: string | null): { readonly kind: "closure" | "jam" | "disruption" | "roadworks" | "nothing"; readonly status: string; readonly item: string | null } | null {
  // FS11d (data-steward FS-2026-11-06): a block whose statement rests on an ALWAYS_SHOWN source's data holds it in a
  // `data-nosnippet` box (`guardNow`), and nothing of it reaches the title or the description, which carry no credit
  if (first === null || /statusline--unknown/u.test(first) || first.includes("data-nosnippet")) return null;
  const status = /<p [^>]*statusline[\s\S]*?<\/p>/u.exec(first)?.[0];
  if (status === undefined) return null;
  const row = /topitems__row--([a-z]+)">([\s\S]*?)<\/li>/u.exec(first);
  const kind = row?.[1];
  // no road row and not green: a warning or a failed read leads the block, and the title does not call that quiet
  if (row === null && !/statusline--green/u.test(status)) return null;
  return {
    kind: kind === "closure" || kind === "jam" || kind === "disruption" || kind === "roadworks" ? kind : "nothing",
    status: TEXT_OF(status),
    item: row?.[2] === undefined ? null : TEXT_OF(row[2]),
  };
}

/**
 * #1175: a station's rows are its departures, none of them news, so only its lamp says what the title and the description
 * may claim. A station whose reads failed claims nothing.
 */
export function stationNowOf(first: string | null): { readonly kind: "disruption" | "nothing"; readonly status: string } | null {
  if (first === null || /statusline--unknown/u.test(first) || first.includes("data-nosnippet")) return null;
  const status = /<p [^>]*statusline[\s\S]*?<\/p>/u.exec(first)?.[0];
  if (status === undefined) return null;
  return { kind: /statusline--green/u.test(status) ? "nothing" : "disruption", status: TEXT_OF(status) };
}
