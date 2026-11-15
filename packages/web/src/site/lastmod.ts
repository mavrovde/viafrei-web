/**
 * The sitemaps' `<lastmod>`: the day a page's CONTENT last changed, read from
 * `generated/lastmod.json` (written by `scripts/lastmod.ts` at the release cut,
 * #934), never the day of the request — so a page whose content did not change
 * keeps its date across any number of deploys. The News page takes its newest
 * entry's date in that language.
 *
 * A page with no row is NEW SINCE THE CUT (a language or a route added after
 * the map was last regenerated): it carries the release day — the build's
 * Europe/Berlin day from `APP_BUILT_AT`, or the catalogue's release date when
 * the process was given none — and never a missing `<lastmod>`. The 404 has
 * no row and is in no sitemap: null, and the element is then left out. A row
 * whose page has gone is never read, because the sitemaps iterate the page map.
 */
import map from "../generated/lastmod.json" with { type: "json" };
import catalogue from "../generated/catalogue.json" with { type: "json" };
import { entriesFor } from "../news/entries.js";
import { berlinDay, fromParsed, isDay, type LastmodMapV2 } from "./lastmod-map.js";
import type { Lang, PageId } from "./pages.js";

const ROWS = fromParsed(map).pages;

/** The release day a page new since the cut carries: the build's Berlin day, else the catalogue's release date. */
export function releaseDay(env: Readonly<Record<string, string | undefined>> = process.env): string {
  const built = new Date((env["APP_BUILT_AT"] ?? "").trim());
  if ((env["APP_BUILT_AT"] ?? "").trim() !== "" && !Number.isNaN(built.getTime())) return berlinDay(built);
  const day = catalogue.release.date;
  if (!isDay(day)) throw new Error(`lastmod: the catalogue's release date '${day}' is not YYYY-MM-DD`);
  return day;
}

/** A page's `<lastmod>` from `rows` (the map's pages); `lastmodOf` is this over the committed map. */
export function lastmodFrom(rows: LastmodMapV2["pages"], page: PageId | "place" | "motorway", lang: Lang, newSinceCut: () => string = releaseDay): string | null {
  if (page === "news") return entriesFor(lang)[0]?.date ?? null;
  if (page === "404") return null;
  return rows[`${page}:${lang}`]?.[1] ?? newSinceCut();
}

export const lastmodOf = (page: PageId | "place" | "motorway", lang: Lang): string | null => lastmodFrom(ROWS, page, lang);
