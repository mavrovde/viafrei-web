/**
 * `scripts/site-pages.txt` — the PUBLIC routes of viafrei.de after the 1.6
 * cutover (#381 item 9, #382), projected from `src/site/pages.ts` and never
 * typed. Four columns (route, file, lang, flags — the shape of the pre-1.6
 * `scripts/landing-pages.txt`, retired with the static landing in #405)
 * because `the deploy` (route probes) and `the public smoke` (the two-vantage
 * comparison) read only the route and whether it is a `redirect=`.
 * `test/site-map.test.ts` fails when the committed file and
 * this projection differ.
 *
 * A FIFTH column, `live`, stands on the rows of a page whose body carries live
 * figures that move between two fetches (#1052: the motorway index's counts per
 * motorway). `the public smoke` compares such a page on a STRUCTURAL digest — the
 * page with the text of its live-figure elements left out — and every other
 * page on the full one. A column of its own rather than a flag, because every
 * reader of the flags column compares it whole (`page`, `identity`). The 404 pages are left out: both readers expect 200
 * or 301, and the 404 is covered by the web e2e.
 *
 *   npx tsx packages/web/scripts/site-map.ts > scripts/site-pages.txt
 */
import { fileURLToPath } from "node:url";
import { LIVE_LANGS, PAGES, REDIRECTS, pathFor, type PageId } from "../src/site/pages.js";
import { LEGACY_FIXED } from "../src/lib/legacy-redirects.js";
import { searchPath } from "../src/site/search.js";

/** The machine-readable routes of #531 and #734, each a GET that answers 200 (`src/pages/llms*.txt.ts`, `src/pages/.well-known/`). */
export const DISCOVERY_ROUTES = ["/llms.txt", "/llms-full.txt", "/.well-known/mcp/server-card.json", "/.well-known/mcp-registry-auth", "/.well-known/mcp.json", "/.well-known/security.txt"] as const;

/**
 * The pages whose body carries live figures (#1052) — the rows `the public smoke` compares structurally. Only a page a
 * smoke has shown to move between two fetches belongs here: every page on this list is compared less strictly.
 */
export const LIVE_PAGES: ReadonlySet<PageId> = new Set<PageId>(["motorways"]);

export function siteMap(): string {
  const rows: string[] = [
    "# GENERATED from packages/web/src/site/pages.ts by packages/web/scripts/site-map.ts — do not edit.",
    "# route            file  lang  flags  [live]",
    // `/` is the negotiated front door (A4, #380): no page of its own in the map, but a public route.
    `${"/".padEnd(18)} -     de    page`,
  ];
  for (const p of PAGES.filter((x) => x.id !== "404")) {
    for (const l of LIVE_LANGS) rows.push(`${pathFor(p.id, l).padEnd(18)} -     ${l}    ${p.legal ? "identity" : "page"}${LIVE_PAGES.has(p.id) ? "  live" : ""}`);
  }
  // #1111: the search page, every language — no row of the map (noindex, in no sitemap), but a public route that answers 200.
  for (const l of LIVE_LANGS) rows.push(`${searchPath(l).padEnd(18)} -     ${l}    page`);
  // #715: the sitemap index too — it needs no digest, so a deploy can probe it; the per-language files do.
  rows.push(`${"/sitemap.xml".padEnd(18)} -     de    page`, `${"/sitemap-index.xml".padEnd(18)} -     de    page`, `${"/robots.txt".padEnd(18)} -     de    page`);
  // The discovery files of #531 (`src/site/discovery.ts`), probed and compared like the sitemap.
  for (const f of DISCOVERY_ROUTES) rows.push(`${f.padEnd(18)} -     en    page`);
  for (const r of REDIRECTS) rows.push(`${r.from.padEnd(18)} -     ${r.from.startsWith("/en") ? "en" : "de"}    redirect=${r.to}`);
  // #892: the TEMPORARY 301s of the pre-#892 page addresses (`src/lib/legacy-redirects.ts`, removed by #898) — answered
  // by the shell, not by nginx, which the `legacy` flag tells `scripts/landing-conf.test.sh`; probed and compared like any.
  for (const r of LEGACY_FIXED) rows.push(`${r.from.padEnd(18)} -     ${r.from.slice(1, 3)}    redirect=${r.to},legacy`);
  return `${rows.join("\n")}\n`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.stdout.write(siteMap());
