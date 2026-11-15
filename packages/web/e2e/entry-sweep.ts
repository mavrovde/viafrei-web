/**
 * #1061 the page-wide entry sweep: what every entry of a page must carry, read off the HTML the shell sends.
 *
 *  - a WHERE line — on the German page always; on a translated page an entry may leave the publisher's German
 *    place words out (one language per page), but never more entries than the German page quotes such words for;
 *  - a placed entry (its where line links a junction, a town or a road) carries the map links (OSM and Google).
 *
 * Pure, so the e2e can run it over the real pages AND over a planted page with a where line removed (the mutant
 * that proves it can say no).
 */
import { all, text } from "@viafrei/design/testing";

export type EntrySweep = { readonly entries: number; readonly noWhere: number; readonly quoted: number; readonly placedNoMap: readonly string[] };

export function sweepEntries(html: string): EntrySweep {
  const entries = all(html, "div.entry");
  let noWhere = 0;
  let quoted = 0;
  const placedNoMap: string[] = [];
  for (const e of entries) {
    const where = all(e, "span.entry__where")[0];
    if (where === undefined || text(where).trim() === "") {
      noWhere++;
      continue;
    }
    if (all(where, "q").length > 0) quoted++;
    const linked = all(where, "a").length > 0;
    const maps = all(e, "span.entry__src a").filter((a) => /openstreetmap\.org|google\.com\/maps/u.test(a.attrs.href ?? "")).length;
    if (linked && maps < 2) placedNoMap.push(text(where).trim().slice(0, 80));
  }
  return { entries: entries.length, noWhere, quoted, placedNoMap };
}
