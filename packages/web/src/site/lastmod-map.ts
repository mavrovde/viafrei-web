/**
 * The shape of `generated/lastmod.json` (#934): what `scripts/lastmod.ts`
 * writes at the release cut and what `site/lastmod.ts` reads at build time.
 * Pure — no file system — so the site and the script share one parser.
 *
 * VERSION 2 is one line per page: `"business:bg": ["<sha256>", "YYYY-MM-DD"],`,
 * sorted by key, so a page whose content moved is a one-line diff (version 1
 * spent four lines on each). Version 1 is still READ, for the one release that
 * converts it; it is never written.
 */

import { dateTimeFormat } from "../lib/intl-formats.js";

export type LastmodEntry = readonly [hash: string, date: string];
export type LastmodMapV2 = { readonly version: 2; readonly pages: Readonly<Record<string, LastmodEntry>> };
type LastmodMapV1 = { readonly version: 1; readonly pages: Readonly<Record<string, { readonly hash: string; readonly date: string }>> };

/** A parsed map of either version, as version 2. Throws on anything else: a map that cannot be read is not an empty one. */
export function fromParsed(raw: unknown): LastmodMapV2 {
  const m = raw as Partial<LastmodMapV1 | LastmodMapV2> | null;
  if (m === null || typeof m !== "object" || typeof m.pages !== "object" || m.pages === null) throw new Error("lastmod: the map has no pages object");
  const pages: Record<string, LastmodEntry> = {};
  if (m.version === 1) {
    for (const [k, v] of Object.entries((m as LastmodMapV1).pages)) pages[k] = [String(v.hash), String(v.date)];
  } else if (m.version === 2) {
    for (const [k, v] of Object.entries((m as LastmodMapV2).pages)) {
      if (!Array.isArray(v) || v.length !== 2 || typeof v[0] !== "string" || typeof v[1] !== "string") throw new Error(`lastmod: ${k} is not a [hash, date] pair`);
      pages[k] = [v[0], v[1]];
    }
  } else {
    throw new Error(`lastmod: unknown map version ${String(m.version)}`);
  }
  return { version: 2, pages };
}

/** The map's text: version 2, one entry per line, sorted by key, a trailing newline. */
export function writeMap(m: LastmodMapV2): string {
  const keys = Object.keys(m.pages).sort();
  const lines = keys.map((k, i) => `    ${JSON.stringify(k)}: [${JSON.stringify(m.pages[k]![0])}, ${JSON.stringify(m.pages[k]![1])}]${i < keys.length - 1 ? "," : ""}`);
  return `{\n  "version": 2,\n  "pages": {\n${lines.join("\n")}\n  }\n}\n`;
}

/** The map in `text`, either version. */
export const readMap = (text: string): LastmodMapV2 => fromParsed(JSON.parse(text) as unknown);

/** The Europe/Berlin calendar day of an instant, `YYYY-MM-DD` (#925: never the UTC day). */
export function berlinDay(at: Date): string {
  // #1072: the sitemap asks this per page new since the cut, on every render — one kept formatter, not one per call
  const parts = dateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(at);
  const get = (t: string): string => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** A real calendar day in `YYYY-MM-DD` (2026-02-30 is not one). */
export function isDay(s: string): boolean {
  if (!DAY.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
