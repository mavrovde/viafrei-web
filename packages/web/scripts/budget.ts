/**
 * The page-weight gate (#381 item 2): for every page of `pages.ts` in every
 * live language, against the BUILT shell fed by the REAL digest renderer over
 * the fixture snapshot (production markup, fixture figures) — at production's
 * SIZE: the fuel board covers all sixteen Länder at three stations each (the
 * snapshot held two Länder until v1.8.18, so this gate was green while every
 * production home carried ~43 KB more), and a Google tag is configured, as on
 * the host, so the consent island's markup (~5.6 KB) is counted on the four
 * pages that carry it:
 *
 *   - raw HTML at most 700 KB (2.4.3, owner 2026-10-27: production's A1 already measured 615 KB raw on
 *     2026-10-25 while its gzip is half the 200 KB limit; the #138 hard limit of 100 KB, raised by the owner
 *     with the city jam panel, #520, twice for #703, and to 500 KB for the assistant answers beside every
 *     card, #742: "Update limit to 500"),
 *   - gzip transfer of HTML + every stylesheet + every script under 200 KB (#1064, owner 2026-10-25: "Increase the
 *     budget to 200"; 80 KB since #891, owner 2026-10-21; 60 KB before),
 *   - at most 2 requests on a page without the consent island (HTML + one
 *     stylesheet) — the island's own module requests are counted separately
 *     and only on the four measured pages, and
 *   - zero third-party requests: every `src`/stylesheet `href` is same-origin.
 *
 * The render-then-fill filler (#564, `lib/fill.ts`) is an INLINE script, so it
 * is no request; its background fetches go to this origin only and exist only
 * for a panel that missed the first render's deadline. A measured page with
 * such a placeholder is "could not check" below, so every page this gate
 * passes made ZERO background requests — the count above is the whole first load.
 *
 * Exit 1 names each page over a limit, exit 2 is "could not check" — an empty
 * page list, a page that did not answer, or no stylesheet found at all
 * (PLAYBOOK §5b: a budget over nothing is not a pass). Three more "could not
 * check" cases since v1.8.18, because each makes a page LIGHTER than
 * production and so reads as a pass about markup that never rendered:
 *   - a content page carrying `class="tile is-error"` (a tile the shell
 *     replaced with its error placeholder — no figure, no credit lines), or
 *     since #564 a LOADING placeholder (`tile is-loading`, `place-fill--loading`:
 *     a panel that missed the first render's deadline and would be filled in
 *     the background — its weight is not in the first HTML either);
 *   - a fuel page whose board does not carry every Land at
 *     `FUEL_BOARD_PER_LAND` stations (16 × 3 = 48 `fuel-board__station` items);
 *   - a 404 from any path other than the 404 page's own;
 *   - since #744, a home whose Wegweiser carries no LIVE answer, or whose
 *     "Heute" strip pairs fewer than three facts with a live answer: the run
 *     serves production's recorded answers (`test/fixtures/asks.json`) from a
 *     stand-in for the MCP internal listener, so a home without them is a home
 *     the stand-in did not reach, and lighter than production's.
 *   - since #1064, a motorway page any of whose cards carries fewer entries than
 *     production's profile (`test/fixtures/motorway-profile.json`, read off
 *     A1, A3 and A7 on 2026-10-25): the gate measured a fixture A7 of 399 KB
 *     while production's A3 shipped 612 KB, because three cards (cities,
 *     weather, messages) had no production-sized rows, the page was measured
 *     without a location (no place island, no "around you" block, and the
 *     shell started without production's `VF_MOTORWAY_AROUND`), and the A1,
 *     production's heaviest, was never measured. The motorway pages are now
 *     the A1 and the A7 at the fixture's PRODUCTION scale
 *     (`startRealDigest({ scale: "production" })`), each without and with the
 *     IP rung, in every language (`motorwayPlan`).
 * And one defect (exit 1): a fuel page carrying an analytics script or the
 * consent island — the page is not one of the four measured ones
 * (`ANALYTICS_PAGES`), and this run sets a Google tag, so an island there would
 * show here. Since #1198 (owner 2026-11-06, "add the place script") the board
 * carries the header's scripts like every page (the pill names the kept place);
 * none of them is analytics.
 *
 * What the fixture still does NOT match, measured against viafrei.de/ru on
 * 2026-10-06: the reports tile renders 3 446 B against production's 3 840 B
 * (~394 B; production's ten closures carried a few more publisher subtitles
 * than the fixture's), and every other tile is byte-identical or within a few
 * bytes. The headroom kept on every page (≥ 4 KB) covers that gap ten times.
 *
 *   npm run build -w @viafrei/web && npx tsx packages/web/scripts/budget.ts
 */
import { randomInt } from "node:crypto";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { AGS_LAENDER, exitSlug } from "@viafrei/ingest";
import { FUEL_BOARD_PER_LAND } from "@viafrei/digest";
import { PAGES, LIVE_LANGS, pathFor, type PageId } from "../src/site/pages.js";
import { placePath } from "../src/site/places.js";
import { stationPath } from "../src/site/stations.js";
import { motorwayPath } from "../src/site/motorways.js";
import { startRealDigest } from "../e2e/real-digest.js";
import { AUTOHOF_CHARGING_SLUG, AUTOHOF_FUEL_SLUG, AUTOHOF_POINTS } from "../e2e/energy-autohof.js";
import { energyPath } from "../src/site/energy.js";
import { ENERGY_POINTS_SHOWN } from "../../digest/src/presentation/energy-page-html.js";
import { startShell } from "../e2e/server.js";
import { startAsksStub } from "../e2e/asks-stub.js";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * #564: every rung of the location ladder is measured, because the home now
 * differs by visitor — the IP rung (a German documentation-range address in the
 * fixture GeoIP file, a busy city's cards), a border address (#1070: the nearest
 * German place's cards) and a far one ("Ganz Deutschland"), and one place page per language. The file is built from the
 * test fixture by the real builder; no download.
 */
export const RUNGS = [
  { ip: "192.0.2.77", label: " [ip]", expect: /id="place-cards"/ },
  // #1070: a Basel address is at the border — Weil am Rhein's cards under the honest line; a US address is far.
  { ip: "198.51.100.7", label: " [border]", expect: /class="place__outside"/ },
  { ip: "203.0.113.9", label: " [far]", expect: /class="place__far"/ },
] as const;

/**
 * `rawHtml`: 700 KB since 2.4.3 (owner 2026-10-27, "Raise raw to 700 KB": production's A1 was 615 KB raw on
 * 2026-10-25 and the fixture's Greek A1 crossed 500 KB; gzip, what a visitor downloads, stays the limit that
 * binds). 500 KB since #742 (owner 2026-10-14: "Update limit to 500") — every
 * card gains its assistant question and live answer, and no example is deleted
 * to make room. Before: 200 KB since #703 — the owner raised it to 160 KB
 * (2026-10-12) when the place cards gained the signed detours, Hamburg
 * roadworks, the DWD road forecast and the P+R forecast (150 KB since #520, the
 * city jam panel, 2026-10-06); and to 200 KB the same day ("Ok 200kb"); keep
 * headroom under it on every page.
 *
 * `gzipTotal` (HTML + stylesheet, gzip): 200 KB since #1064 (owner 2026-10-25,
 * verbatim: "Increase the budget to 200") — when the gate first weighed the
 * motorway pages production ships (A1 about 111 KB with its stylesheet). 80 KB
 * since #891 before it (owner 2026-10-21, from 60 KB: the parking cards name
 * what is near each listed site). The raw-HTML limit was 500 KB then.
 */
export const LIMITS = { rawHtml: 700 * 1024, gzipTotal: 200 * 1024, requests: 2 } as const;

/**
 * #1064: production's per-card entry counts on the motorway pages (the maximum over A1, A3 and A7 on 2026-10-25). A
 * measured motorway page below any of them is lighter than production and cannot be judged.
 */
export type MotorwayProfile = {
  readonly measured: string;
  readonly pages: readonly string[];
  readonly cards: Readonly<Record<string, number>>;
  /** #1061: production's crossings card — its rows, the motorway links they carry, and the most one row may carry. */
  readonly crossings: { readonly rows: number; readonly links: number; readonly maxPerRow: number };
};
export const MOTORWAY_PROFILE: MotorwayProfile = JSON.parse(readFileSync(new URL("../test/fixtures/motorway-profile.json", import.meta.url), "utf8")) as MotorwayProfile;

/** #1064: the motorways the gate measures — production's heaviest page (A1) and the longest motorway (A7). */
export const MOTORWAY_ROADS = ["A1", "A7"] as const;
/** #1064: each road in every language, without a location and at the IP rung (the place island and "around you" in the first HTML). */
export function motorwayPlan<L extends string>(langs: readonly L[]): readonly { readonly road: (typeof MOTORWAY_ROADS)[number]; readonly lang: L; readonly ip: string | null }[] {
  return langs.flatMap((lang) => MOTORWAY_ROADS.flatMap((road) => [{ road, lang, ip: null }, { road, lang, ip: RUNGS[0].ip }]));
}
/**
 * #1064: production's own switches of the `web` service (the production compose file), set on the measured shell
 * too — without `VF_MOTORWAY_AROUND` the motorway page carries no "around you" block, and the gate weighed a page
 * production does not serve. `test/budget.test.ts` holds this equal to the compose file.
 */
export const SHELL_SWITCHES: Readonly<Record<string, string>> = { VF_MOTORWAY_AROUND: "1" };

/** #1064: each motorway card's entry count, read off its header (`<data class="mwk__n" value=N>`); a card with no count is absent. */
export function motorwayCards(html: string): Readonly<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const m of html.matchAll(/id="mwk-([a-z]+)"(?:(?!id="mwk-[a-z]+")[\s\S])*?<data class="mwk__n" value="(\d+)"/g)) out[m[1]!] = Number(m[2]);
  return out;
}

/** #1061: the crossings card's shown rows and the motorway links each carries (`.mwc__other`); null without the card. */
export function crossingsShape(html: string): { readonly rows: number; readonly links: readonly number[] } | null {
  const at = html.indexOf('id="mwk-crossings"');
  if (at < 0) return null;
  const end = html.indexOf("</section>", at);
  const card = html.slice(at, end < 0 ? undefined : end);
  // #1032: the related motorways that are not crossed follow the crossing rows in the same card, each with its own
  // `.mwc__other`; they are no crossing's links, so the rows end where that block begins.
  const rel = card.indexOf('class="mwrel__h"');
  const rows = (rel < 0 ? card : card.slice(0, rel)).split(/<li id="mwc-/u).slice(1);
  return { rows: rows.length, links: rows.map((r) => (r.match(/class="mwc__other"/gu) ?? []).length) };
}

/**
 * #1061: a measured crossings card off production's shape — fewer links over its shown rows than production's rate
 * (rounded down), or a row over the per-row maximum; an absent card or one with no row shown is off too.
 */
export function crossingsOffProfile(shape: ReturnType<typeof crossingsShape>, p: MotorwayProfile["crossings"] = MOTORWAY_PROFILE.crossings): readonly string[] {
  if (shape === null || shape.rows === 0) return ["crossings: no row shown"];
  const total = shape.links.reduce((a, b) => a + b, 0);
  const floor = Math.floor((shape.rows * p.links) / p.rows);
  const out: string[] = [];
  if (total < floor) out.push(`crossings links ${String(total)} < ${String(floor)} over ${String(shape.rows)} rows`);
  const most = Math.max(...shape.links);
  if (most > p.maxPerRow) out.push(`crossings row with ${String(most)} motorways > ${String(p.maxPerRow)}`);
  return out;
}

/** #1064: the cards of a measured page below production's profile, named with both counts ("cities 0 < 160"); an absent card counts 0. */
export function lighterThanProfile(cards: Readonly<Record<string, number>>, floor: Readonly<Record<string, number>> = MOTORWAY_PROFILE.cards): readonly string[] {
  return Object.entries(floor)
    .filter(([k, n]) => (cards[k] ?? 0) < n)
    .map(([k, n]) => `${k} ${String(cards[k] ?? 0)} < ${String(n)}`);
}

export type Measured = {
  readonly path: string;
  readonly status: number;
  readonly rawHtml: number;
  readonly gzipTotal: number;
  /** HTML + stylesheets + classic scripts — the island's module graph is not a first-paint request. */
  readonly requests: number;
  readonly thirdParty: readonly string[];
  /** Which page of the map this is — the 404 may answer 404, the fuel page must carry the board. */
  readonly page: PageId;
  /** `class="tile is-error"` sections: the shell's placeholder for a tile that did not render. */
  readonly errorTiles: number;
  /** `<li class="fuel-board__station` items. */
  readonly boardStations: number;
  /** EXECUTABLE `<script` elements, inline or not — the JSON-LD data block every page carries (#531) runs nothing and is not counted. */
  readonly scripts: number;
  /** #1198: scripts that load or call analytics (Google's tag, Clarity) — never on the fuel page. */
  readonly analytics: number;
  readonly island: boolean;
  /** #1064: a motorway page's card entry counts (`motorwayCards`), judged against production's profile; absent on every other page. */
  readonly cards?: Readonly<Record<string, number>>;
  /** #1061: a motorway page's crossings card shape (`crossingsShape`), judged against production's; absent on every other page. */
  readonly crossings?: ReturnType<typeof crossingsShape>;
  /** #1076: a page's own raw-HTML limit when it is stricter than the site's (`LIMITS.rawHtml`); absent on every other page. */
  readonly rawMax?: number;
};

/** Every Land at the board's constant bound: what a fuel page must carry before its weight means anything. */
export const BOARD_STATIONS = AGS_LAENDER.length * FUEL_BOARD_PER_LAND;

/** What the gate reads off a page's HTML besides its weight. */
export function inspect(html: string): Pick<Measured, "errorTiles" | "boardStations" | "scripts" | "analytics" | "island"> {
  return {
    errorTiles: (html.match(/class="(?:tile is-(?:error|loading)|place-fill place-fill--loading)\b/g) ?? []).length,
    boardStations: (html.match(/<li class="fuel-board__station[ "]/g) ?? []).length,
    scripts: (html.match(/<script\b(?![^>]*\btype="application\/ld\+json")/g) ?? []).length,
    analytics: (html.match(/<script\b[^>]*\bsrc="[^"]*(?:googletagmanager\.com|clarity\.ms)|<script\b[^>]*>(?:(?!<\/script>)[\s\S])*?(?:googletagmanager\.com|clarity\.ms|gtag\(|dataLayer)/g) ?? []).length,
    island: /<astro-island\b/.test(html),
  };
}

/** Same-origin sub-resources a page asks for at load: stylesheets and scripts. */
export function subresources(html: string): { readonly css: string[]; readonly js: string[] } {
  const css = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map((m) => m[1]!);
  const js = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]!);
  return { css, js };
}

export function judge(rows: readonly Measured[]): { readonly code: 0 | 1 | 2; readonly lines: readonly string[] } {
  if (rows.length === 0) return { code: 2, lines: ["✗ budget: could not check — no page was measured"] };
  // only the 404 page may answer 404: anywhere else a 404 is a page that did not render
  const bad = rows.filter((r) => r.status !== 200 && !(r.status === 404 && r.page === "404"));
  if (bad.length > 0) return { code: 2, lines: bad.map((r) => `✗ budget: could not check — ${r.path} answered ${r.status}`) };
  const unrendered = [
    ...rows.filter((r) => r.page !== "404" && r.errorTiles > 0).map((r) => `✗ budget: could not check — ${r.path} carries ${r.errorTiles} error tile(s); a tile that did not render weighs less than production's`),
    ...rows.filter((r) => r.page === "fuel" && r.boardStations !== BOARD_STATIONS).map((r) => `✗ budget: could not check — ${r.path} carries ${r.boardStations} board stations, not ${BOARD_STATIONS} (16 Länder × ${FUEL_BOARD_PER_LAND})`),
    ...rows.flatMap((r) => {
      const short = r.cards === undefined ? [] : [...lighterThanProfile(r.cards), ...(r.crossings === undefined ? [] : crossingsOffProfile(r.crossings))];
      return short.length === 0 ? [] : [`✗ budget: could not check — ${r.path} is lighter than production (${MOTORWAY_PROFILE.measured}): ${short.join(", ")}`];
    }),
  ];
  if (unrendered.length > 0) return { code: 2, lines: unrendered };
  const lines: string[] = [];
  for (const r of rows) {
    const why: string[] = [];
    const rawMax = Math.min(LIMITS.rawHtml, r.rawMax ?? LIMITS.rawHtml);
    if (r.rawHtml > rawMax) why.push(`raw HTML ${r.rawHtml} B > ${rawMax}`);
    if (r.gzipTotal >= LIMITS.gzipTotal) why.push(`gzip total ${r.gzipTotal} B ≥ ${LIMITS.gzipTotal}`);
    if (r.requests > LIMITS.requests) why.push(`${r.requests} requests > ${LIMITS.requests}`);
    if (r.thirdParty.length > 0) why.push(`third-party: ${r.thirdParty.join(", ")}`);
    if (r.page === "fuel" && (r.analytics > 0 || r.island)) why.push(`analytics on the fuel page: ${r.analytics} script(s)${r.island ? ", the consent island" : ""}`);
    if (why.length > 0) lines.push(`✗ ${r.path}: ${why.join("; ")}`);
  }
  if (lines.length > 0) return { code: 1, lines };
  return { code: 0, lines: [`✓ budget: ${rows.length} page(s) within raw ≤ ${LIMITS.rawHtml / 1024} KB, gzip < ${LIMITS.gzipTotal / 1024} KB, ≤ 2 requests, no third party`] };
}

/**
 * #1081 D6: the Köln place page per language, measured only with the charging card's filter bar in it — and once
 * more under a filter (fast chargers with a CCS2 plug, free now), measured only when the bar's match count rendered,
 * so the heaviest place page a visitor can ask for is weighed with the bar and with the filter's lines.
 */
export const PLACE_PAGE = { label: " [place page]", expect: /id="place-cards"[\s\S]*<form class="tpf evf"/ } as const;
export const PLACE_PAGE_FILTERED = { label: " [place page] [ev filter]", expect: /id="place-cards"[\s\S]*<form class="tpf evf"[\s\S]*class="pcard__note evf__(?:count|none)"/ } as const;
export const PLACE_FILTER_QUERY = "?ev_kw=fast&ev_plug=ccs2&ev_free=1";

/** #1083 AC 9: one station page per language, measured only with its live block and the board's table in it. */
/** #1043 (c): measured with the stops around it rendered — the map, the stop list and the road rings — not with the card's empty state. */
export const STATION_PAGE = { label: " [station page]", expect: /id="station-live"[\s\S]*<table class="[^"]*\bstlive__board\b[\s\S]*id="pcard-station-nearby"[\s\S]*<svg class="stmap"[\s\S]*<li class="stlive__stop"[\s\S]*<section class="stlive__roads">[\s\S]*<ul class="[^"]*\bstlive__roadlist\b/ } as const;

/**
 * #1076 AC 6: the station pages' heaviest case, the Autohof hub of `AUTOHOF_POINTS` charge points and its fuel station
 * (`e2e/energy-autohof.ts`), in every language — under the issue's 500 KB raw (stricter than the site's 700 KB) and the
 * site's 200 KB gzip. Measured only when the page carries what makes it heavy: the charging page its full point table
 * (`ENERGY_POINTS_SHOWN` rows and the "+N" line), the fuel page its prices slot and its nearby charging links. The row
 * count is a TEMPERED repetition (each row's lead-in may not contain the next cell), so a page one row short fails in
 * linear time — the lazy `[\s\S]*?` form backtracked exponentially on exactly that page.
 */
export const ENERGY_RAW_MAX = 500 * 1024;
export const ENERGY_PAGES = [
  { kind: "charging", slug: AUTOHOF_CHARGING_SLUG, label: " [charging site page]", expect: new RegExp(`<table class="evpts">(?:(?:(?!<td class="evpt evpt--)[\\s\\S])*<td class="evpt evpt--){${String(ENERGY_POINTS_SHOWN)}}[\\s\\S]*?<p>\\+${String(AUTOHOF_POINTS - ENERGY_POINTS_SHOWN)}</p>`) },
  { kind: "fuel", slug: AUTOHOF_FUEL_SLUG, label: " [fuel station page]", expect: /class="energypage__prices" data-station="[^"]+"[\s\S]*class="energypage__near"/ },
] as const;

/**
 * #1188: a motorway exit's page — the planted A4's AS Köln-Lövenich (`e2e/real-digest.ts` `A4_POINTS`), its junction's
 * two directions first (`#exit-ways`), then the cards around the junction. Measured in every language.
 */
export const EXIT_PAGE = { road: "A4", segment: exitSlug({ no: "8", name: "Köln-Lövenich" }), label: " [exit page]", expect: /id="exit-ways"/ } as const;

/**
 * #1188: an object page measured without its around block ("In der Nähe", the place cards of its cell) would weigh less
 * than production's: the block's frame and its cards' region must be in the page. Asserted on the station page and on
 * both energy pages.
 */
export const AROUND_BLOCK = /data-vf-around[\s\S]*?<section class="place" id="place-cards" aria-labelledby="place-title">[\s\S]*?<article class="pcard/;

async function measure(base: string, page: PageId, path: string, cache: Map<string, number>, as: { readonly ip?: string; readonly label?: string; readonly expect?: RegExp; readonly profile?: boolean; readonly rawMax?: number; readonly around?: boolean } = {}): Promise<Measured> {
  const res = await fetch(base + path, { redirect: "manual", headers: as.ip === undefined ? {} : { "x-forwarded-for": as.ip } });
  const html = await res.text();
  const { css, js } = subresources(html);
  const all = [...css, ...js];
  const thirdParty = all.filter((u) => /^(https?:)?\/\//.test(u));
  let gz = gzipSync(html).length;
  for (const u of all.filter((x) => !thirdParty.includes(x))) {
    if (!cache.has(u)) cache.set(u, gzipSync(Buffer.from(await (await fetch(base + u)).arrayBuffer())).length);
    gz += cache.get(u)!;
  }
  if (css.length === 0) throw new Error(`${path}: no stylesheet in the page — the shell did not render`);
  // A rung measured without its block would weigh less than production's: refuse it.
  if (as.expect !== undefined && !as.expect.test(html)) throw new Error(`${path}${as.label ?? ""}: the place block did not render`);
  if (as.around === true && !AROUND_BLOCK.test(html)) throw new Error(`${path}${as.label ?? ""}: the around block did not render`);
  // 2.1.16 (#716 C1): a home measured without its motorway catalogue would weigh less than production's; an index without its overview map too
  // (since #1183 the figure carries the live map's `lmap` class beside the two, so the class list is matched by its head).
  if (page === "start" && as.label?.startsWith(" [place page]") !== true && !/id="motorway-top"/.test(html)) throw new Error(`${path}${as.label ?? ""}: the home's motorway block did not render`);
  if (page === "motorways" && as.label === undefined && !/class="motorway__map motorway-overview(?: [^"]*)?"/.test(html)) throw new Error(`${path}: the index's overview map did not render`);
  // #744: a home without its live answers weighs less than production's.
  if (page === "start" && as.label?.startsWith(" [place page]") !== true) {
    if (!/<figure class="sign[^"]*" data-live="1"/.test(html)) throw new Error(`${path}${as.label ?? ""}: the Wegweiser carries no live answer`);
    const paired = (html.match(/class="qa-answer live-ask__answer/g) ?? []).length;
    if (paired < 3) throw new Error(`${path}${as.label ?? ""}: ${String(paired)} live answer(s) in the Heute strip, 3 expected`);
  }
  return { path: `${path}${as.label ?? ""}`, status: res.status, rawHtml: Buffer.byteLength(html), gzipTotal: gz, requests: 1 + css.length + js.length, thirdParty, page, ...inspect(html), ...(as.profile === true ? { cards: motorwayCards(html), crossings: crossingsShape(html) } : {}), ...(as.rawMax === undefined ? {} : { rawMax: as.rawMax }) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = 18_900 + randomInt(90); // spreads parallel runs over ports; not a secret
  // #1064: the fixture at production's size (the motorway pages' cards at production's profile)
  const digest = await startRealDigest({ scale: "production", energy: "autohof" });
  // #744: production's recorded assistant answers, from a stand-in for the MCP internal listener.
  const mcp = await startAsksStub();
  const geoDir = mkdtempSync(join(tmpdir(), "vf-budget-geo-"));
  const here = fileURLToPath(new URL(".", import.meta.url));
  execFileSync("node", [join(here, "..", "..", "..", "scripts", "geoip-build.mjs"), "--release", "2026-10", "--out", join(geoDir, "geoip.vfgeo"), "--min-de-ranges", "1"], { input: readFileSync(join(here, "..", "test", "fixtures", "geoip-fixture.csv")), stdio: ["pipe", "ignore", "inherit"] });
  const shell = await startShell(port, {
    GEOIP_FILE: join(geoDir, "geoip.vfgeo"),
    DIGEST_URL: digest.url,
    MCP_INTERNAL_URL: mcp.url,
    IMPRESSUM_NAME: "Budget Probe",
    IMPRESSUM_STREET: "Probestraße 1",
    IMPRESSUM_CITY: "00000 Probe",
    IMPRESSUM_EMAIL: "probe@example.invalid",
    // production runs with GOOGLE_TAG set; a placeholder id renders the same island markup.
    // Lowercase on purpose and as long as the one it stood in for: #54's acceptance check
    // refuses G- plus capitals in any committed file (deploy.test.sh uses the same trick).
    GOOGLE_TAG: "G-budgetprobe",
    ...SHELL_SWITCHES,
  });
  let code: 0 | 1 | 2 = 2;
  try {
    const cache = new Map<string, number>();
    const rows: Measured[] = [];
    for (const p of PAGES) for (const lang of LIVE_LANGS) rows.push(await measure(`http://127.0.0.1:${port}`, p.id, pathFor(p.id, lang), cache));
    for (const lang of LIVE_LANGS) for (const r of RUNGS) rows.push(await measure(`http://127.0.0.1:${port}`, "start", pathFor("start", lang), cache, r));
    for (const lang of LIVE_LANGS) rows.push(await measure(`http://127.0.0.1:${port}`, "start", placePath(lang, "koeln"), cache, PLACE_PAGE));
    for (const lang of LIVE_LANGS) rows.push(await measure(`http://127.0.0.1:${port}`, "start", placePath(lang, "koeln") + PLACE_FILTER_QUERY, cache, PLACE_PAGE_FILTERED));
    // #1083 AC 9: the station page with its departure board, in every language — refused when the board did not render
    for (const lang of LIVE_LANGS) rows.push(await measure(`http://127.0.0.1:${port}`, "stations", stationPath(lang, "koeln-hbf"), cache, { ...STATION_PAGE, around: true }));
    // #1076 AC 6: the biggest station pages, the Autohof hub and its fuel station, in every language — refused when the table did not render
    for (const lang of LIVE_LANGS) for (const e of ENERGY_PAGES) rows.push(await measure(`http://127.0.0.1:${port}`, "stations", energyPath(e.kind, lang, e.slug), cache, { label: e.label, expect: e.expect, rawMax: ENERGY_RAW_MAX, around: true }));
    // #1188: the exit page with its junction's block, in every language — refused when either did not render
    for (const lang of LIVE_LANGS) rows.push(await measure(`http://127.0.0.1:${port}`, "motorways", `${motorwayPath(lang, EXIT_PAGE.road)}/${EXIT_PAGE.segment}`, cache, { label: EXIT_PAGE.label, expect: EXIT_PAGE.expect, around: true }));
    // #715, #1064: the A1 and the A7 in every language at production's profile, without a location and at the IP rung.
    for (const m of motorwayPlan(LIVE_LANGS))
      rows.push(
        await measure(`http://127.0.0.1:${port}`, "motorways", motorwayPath(m.lang, m.road), cache, {
          label: ` [${m.road}]${m.ip === null ? "" : " [ip]"}`,
          ...(m.ip === null ? { expect: /id="motorway"/ } : { ip: m.ip, expect: /id="motorway-around"/ }),
          profile: true,
        }),
      );
    for (const r of rows) console.log(`  ${r.path.padEnd(34)} raw ${String(r.rawHtml).padStart(6)} B  gzip ${String(r.gzipTotal).padStart(6)} B  req ${r.requests}`);
    const v = judge(rows);
    for (const l of v.lines) console.log(l);
    code = v.code;
  } catch (e) {
    console.log(`✗ budget: could not check — ${(e as Error).message}`);
  } finally {
    shell.kill();
    await digest.close();
    await mcp.close();
    rmSync(geoDir, { recursive: true, force: true });
  }
  process.exit(code);
}
