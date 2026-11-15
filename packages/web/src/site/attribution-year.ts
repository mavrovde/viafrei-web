/**
 * The year of retrieval in a credit line (#804) — the site's copy of
 * `@viafrei/ingest`'s `datedAttribution`, because the shell may not import a
 * package that holds a database (`check_web_boundary.sh`). Held equal to it by
 * `test/attribution-year.test.ts`, on both sides of the Berlin New Year.
 *
 * A line that names "Stadt Aachen" and "das Jahr des Datenbezugs in Klammern"
 * carries the token in the register; the page prints the reader's Berlin year,
 * by the clock of the request that renders it.
 */

/** The token a register line carries where the year of retrieval stands. */
export const RETRIEVAL_YEAR = "{Jahr}";

const YEAR = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", year: "numeric" });

/** A credit line with its year of retrieval resolved to `now`'s Berlin year; any other line unchanged. */
export function datedCredit(text: string, now: Date): string {
  return text.includes(RETRIEVAL_YEAR) ? text.split(RETRIEVAL_YEAR).join(YEAR.format(now)) : text;
}

/**
 * The register lines a page's tiles carry (the "sources" block, #378): each
 * line DATED first, because the tiles print it dated — a register line holding
 * the token would otherwise match no tile and be dropped, or print the token
 * itself (2.2.6, the GeoNutzV lines). The lines come back dated.
 */
export function shownCredits<T extends { readonly attribution: string }>(lines: readonly T[], html: string, now: Date): T[] {
  return lines
    .map((l) => ({ ...l, attribution: datedCredit(l.attribution, now) }))
    .filter((l) => html.includes(l.attribution.replace(/&/g, "&amp;")) || html.includes(l.attribution));
}
