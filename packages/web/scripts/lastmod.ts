/**
 * `src/generated/lastmod.json` — the day each page's CONTENT last changed, per
 * page and language, for the sitemaps' `<lastmod>` (coordinator, 2026-10-12;
 * #531's build day gave every URL the same date on every deploy, which tells a
 * search engine nothing).
 *
 * THE RULE. A page's content is
 *   - the source files it renders, followed transitively from its route file
 *     through relative imports — WITHOUT the chrome every page shares (the
 *     document shell, header, footer, language list, consent bar) and without
 *     code that renders no words of its own (`lib/`, `location/`,
 *     `analytics/`, `security/`, the page map, the styles); `catalogue.json`
 *     counts without its `release` block, which moves at every release;
 *   - the catalogue strings of ITS language that those files name: every
 *     dotted literal that is a key or a key prefix of the deck
 *     (`"connectPage.title"`, `` `day.${id}.scene` `` → `day.`);
 *   - its own title and description: the deck keys `pageMeta` reads for it
 *     (`META_KEYS`; the brand suffix is chrome).
 * The content hash is SHA-256 over those, in a fixed order. The DATE is kept
 * while the hash is unchanged and set to the day of the regeneration when it
 * moves, so the date is the day a person changed what the page says — never
 * the build's or the request's day, and the same across any number of deploys.
 *
 * WHEN (#934). The map is a RELEASE ARTEFACT: it is regenerated once, at the
 * cut, in the release commit, and a feature commit never touches it (the push
 * hook's `lastmod` leg refuses one, `scripts/check_lastmod_commits.sh`). The
 * day it records is therefore the Europe/Berlin day of the cut (#925) — the
 * day the change became visible, since what reaches production is a tag. A
 * page added after the cut has no row and carries the release day at build
 * time (`site/lastmod.ts`); a row whose page has gone is dropped by the next
 * regeneration and never read meanwhile.
 *
 * The News page is the one exception, by the same request: its `lastmod` is
 * its newest entry's date (`newestNewsDate`), read at build time.
 *
 *   npx tsx packages/web/scripts/lastmod.ts               (the cut: rewrite the map; today's Berlin day for what moved)
 *   npx tsx packages/web/scripts/lastmod.ts --check       (the SHAPE, on every run: version 2 in its one-line form,
 *                                                         every hash and day well-formed, no day in the future)
 *   npx tsx packages/web/scripts/lastmod.ts --check-fresh (the RELEASE GATE: the shape, and every row's hash is the
 *                                                         page's hash now, with no row missing and none left over)
 *   npx tsx packages/web/scripts/lastmod.ts --seed-from-git
 *       (once, for a map that does not exist yet: a new row is dated by the
 *       newest commit touching its content files, not by today)
 *
 * `test/lastmod.test.ts` checks the committed map's shape and pins the rule:
 * unchanged content keeps its date, a changed page moves alone.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { berlinDay, isDay, readMap as parseMap, writeMap, type LastmodMapV2 } from "../src/site/lastmod-map.js";
import { LIVE_LANGS, PAGES, type Lang, type PageId } from "../src/site/pages.js";

export const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const LASTMOD_FILE = join(WEB_ROOT, "src", "generated", "lastmod.json");

/** The rows of the map: every page of `pages.ts` but the 404 and the News page, plus the place pages. */
export type LastmodKey = `${PageId | "place" | "motorway"}:${Lang}`;
export type { LastmodMapV2 } from "../src/site/lastmod-map.js";

/** The route file each page is rendered from (the German legal pages share their layout with this one). */
export const ENTRY: Readonly<Record<Exclude<PageId, "404" | "news"> | "place" | "motorway", string>> = {
  start: "src/pages/[lang]/index.astro",
  connect: "src/pages/[lang]/connect.astro",
  developers: "src/pages/[lang]/developers.astro",
  business: "src/pages/[lang]/business.astro",
  fuel: "src/pages/[lang]/fuel.astro",
  impressum: "src/pages/[lang]/impressum.astro",
  datenschutz: "src/pages/[lang]/datenschutz.astro",
  // #707: the terms of use (the text is `src/site/terms.ts`, reached through the layout's imports)
  terms: "src/pages/[lang]/terms.astro",
  place: "src/pages/[lang]/place/[slug].astro",
  // #715: the motorway index (a page of the map) and a motorway page (dynamic, by its template like a place page)
  motorways: "src/pages/[lang]/autobahn.astro",
  motorway: "src/pages/[lang]/autobahn/[road]/[...rest].astro",
  // #1041: the station catalogue (a page of the map); a station page's sitemap day is the newer of this and its record's
  stations: "src/pages/[lang]/station.astro",
  // #1074: the index of the sixteen Länder (a page of the map)
  states: "src/pages/[lang]/states.astro",
  // #747: the examples page (`/<lang>/examples`; `/de/beispiele` before #892)
  examples: "src/pages/[lang]/examples.astro",
};

/** Shared by every page, or code that prints no words of its own: not a page's content. */
export const CHROME: readonly string[] = [
  "src/layouts/Base.astro",
  "src/components/Header.astro",
  "src/components/Footer.astro",
  "src/components/LanguageList.astro",
  "src/components/Consent.svelte",
  "src/site/pages.ts",
  "src/site/meta.ts",
  "src/i18n/",
  "src/lib/",
  "src/location/",
  "src/analytics/",
  "src/security/",
  "src/styles/",
];

export type Reader = (rel: string) => string | null;
export const diskReader: Reader = (rel) => {
  const p = join(WEB_ROOT, rel);
  return existsSync(p) ? readFileSync(p, "utf8") : null;
};

const isChrome = (rel: string): boolean => CHROME.some((c) => (c.endsWith("/") ? rel.startsWith(c) : rel === c));

/** Relative import specifiers of a source file (`.astro` frontmatter, `.ts`, `.svelte`). */
function imports(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/(?:import|export)\s[^;'"]*?from\s*["'](\.{1,2}\/[^"']+)["']|import\s*["'](\.{1,2}\/[^"']+)["']/g)) out.push((m[1] ?? m[2])!);
  return out;
}

/** The candidates a specifier may name: a `.js` import is the `.ts` source. */
function candidates(fromRel: string, spec: string): string[] {
  const base = normalize(join(dirname(fromRel), spec));
  if (base.endsWith(".js")) return [base.replace(/\.js$/, ".ts"), base];
  return [base, `${base}.ts`, `${base}/index.ts`];
}

/** The content files of a page, sorted: its closure without the chrome. */
export function closure(entry: string, read: Reader = diskReader): string[] {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length > 0) {
    const rel = stack.pop()!;
    if (seen.has(rel) || isChrome(rel)) continue;
    const text = read(rel);
    if (text === null) throw new Error(`lastmod: ${rel} is not readable (imported, so it must exist)`);
    seen.add(rel);
    if (rel.endsWith(".json") || rel.endsWith(".css")) continue;
    for (const spec of imports(text)) {
      const hit = candidates(rel, spec).find((c) => isChrome(c) || read(c) !== null);
      if (hit === undefined) throw new Error(`lastmod: ${rel} imports ${spec}, which resolves to no file`);
      stack.push(hit);
    }
  }
  return [...seen].sort();
}

/** What of a file counts: `catalogue.json` without its release block, everything else verbatim. */
function contentOf(rel: string, text: string): string {
  if (rel === "src/generated/catalogue.json") {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    delete parsed["release"];
    return JSON.stringify(parsed);
  }
  return text;
}

/**
 * The deck keys `pageMeta` (src/site/meta.ts) reads for a page's title and
 * description, beyond those its own files name. `meta.siteName` is the brand
 * suffix every title carries: chrome. `test/lastmod.test.ts` compares this with
 * meta.ts's own text, so the two cannot drift.
 */
export const META_KEYS: Readonly<Record<Exclude<PageId, "404" | "news"> | "place" | "motorway", readonly string[]>> = {
  start: ["meta.tagline", "meta.pitch"],
  connect: ["seo.connectTitle", "seo.connectDescription"],
  developers: ["seo.developersTitle", "seo.developersDescription"],
  business: ["seo.businessTitle", "seo.businessDescription"],
  fuel: ["fuelPage.title", "fuelPage.lead"],
  impressum: ["footer.imprint", "seo.imprintDescription"],
  datenschutz: ["footer.privacy", "seo.privacyDescription"],
  terms: ["footer.terms", "seo.termsDescription"],
  motorways: ["seo.motorwaysTitle", "seo.motorwaysDescription"],
  stations: ["seo.stationsTitle", "seo.stationsDescription"],
  states: ["statePages.title", "statePages.description"],
  examples: ["examplesPage.title", "examplesPage.lead"],
  // the dynamic pages' own title and description (`placeMeta`, `motorwayMeta` in meta.ts)
  place: ["place.pageTitle", "place.pageDescription"],
  motorway: ["seo.motorwayTitle", "seo.motorwayDescription"],
};

function flatten(tree: unknown, prefix: string, out: Record<string, string>): Record<string, string> {
  if (typeof tree === "string") out[prefix] = tree;
  else if (tree !== null && typeof tree === "object") for (const [k, v] of Object.entries(tree)) flatten(v, prefix === "" ? k : `${prefix}.${k}`, out);
  return out;
}

/** One language's deck, flat, read through `read` (so a test can plant a change). */
export function deckOf(lang: Lang, read: Reader = diskReader): Record<string, string> {
  const text = read(`src/i18n/${lang}.json`);
  if (text === null) throw new Error(`lastmod: src/i18n/${lang}.json is not readable`);
  return flatten(JSON.parse(text), "", {});
}

/** The deck keys of one language that the files name (plus `extra`), as `key=value` lines, sorted. */
export function deckLines(texts: readonly string[], flat: Readonly<Record<string, string>>, extra: readonly string[] = []): string[] {
  const keys = Object.keys(flat);
  const tops = new Set(keys.map((k) => k.split(".")[0]!));
  const used = new Set<string>(extra.filter((k) => flat[k] !== undefined));
  for (const text of texts) {
    for (const m of text.matchAll(/["'`]([A-Za-z]\w*(?:\.\w+)*\.?)(?=["'`]|\$\{)/g)) {
      const lit = m[1]!;
      if (!tops.has(lit.split(".")[0]!) || !lit.includes(".")) continue;
      const prefix = lit.endsWith(".") ? lit : `${lit}.`;
      for (const k of keys) if (k === lit || k.startsWith(prefix)) used.add(k);
    }
  }
  return [...used].sort().map((k) => `${k}=${flat[k]}`);
}

/** The content hash of one page in one language. */
export function pageHash(page: PageId | "place" | "motorway", lang: Lang, read: Reader = diskReader): string {
  if (page === "404" || page === "news") throw new Error(`lastmod: ${page} carries no content hash`);
  return hashOf(page, pageFiles(page, read), deckOf(lang, read));
}

type HashedPage = Exclude<PageId, "404" | "news"> | "place" | "motorway";

/** A page's file closure and each file's hashed content — the same for every language. */
function pageFiles(page: HashedPage, read: Reader): { readonly files: readonly string[]; readonly texts: readonly string[] } {
  const files = closure(ENTRY[page], read);
  return { files, texts: files.map((f) => contentOf(f, read(f)!)) };
}

function hashOf(page: HashedPage, { files, texts }: { readonly files: readonly string[]; readonly texts: readonly string[] }, deck: Readonly<Record<string, string>>): string {
  const h = createHash("sha256");
  for (let i = 0; i < files.length; i++) h.update(`\0file ${files[i]}\0${texts[i]}`);
  for (const line of deckLines(texts, deck, META_KEYS[page])) h.update(`\0deck ${line}`);
  return h.digest("hex");
}

/** Every row's hash, in a fixed order — each page's closure and each language's deck read once, not once per row. */
export function allHashes(read: Reader = diskReader): Record<LastmodKey, string> {
  const out: Partial<Record<LastmodKey, string>> = {};
  const ids: HashedPage[] = [...PAGES.map((p) => p.id).filter((id): id is Exclude<PageId, "404" | "news"> => id !== "404" && id !== "news"), "place", "motorway"];
  const decks = new Map(LIVE_LANGS.map((lang) => [lang, deckOf(lang, read)] as const));
  for (const id of ids) {
    const page = pageFiles(id, read);
    for (const lang of LIVE_LANGS) out[`${id}:${lang}`] = hashOf(id, page, decks.get(lang)!);
  }
  return out as Record<LastmodKey, string>;
}

/** The map for these hashes: a row whose hash is unchanged keeps its date, any other gets `today`; a key not hashed is dropped. */
export function assignDates(prev: LastmodMapV2 | null, hashes: Readonly<Record<string, string>>, today: string): LastmodMapV2 {
  if (!isDay(today)) throw new Error(`lastmod: '${today}' is not YYYY-MM-DD`);
  const pages: Record<string, readonly [string, string]> = {};
  for (const key of Object.keys(hashes).sort()) {
    const hash = hashes[key]!;
    const before = prev?.pages[key];
    pages[key] = [hash, before !== undefined && before[0] === hash ? before[1] : today];
  }
  return { version: 2, pages };
}

/**
 * What is wrong with the map's TEXT, judged on its own (`--check`, every run):
 * it must read, be written in exactly the form `writeMap` gives it (version 2,
 * one sorted line per page), and every row must carry a SHA-256 and a real day
 * no later than `today`. Empty means well-formed. It says nothing about whether
 * the hashes are current — that is the cut's question (`freshProblems`).
 */
export function shapeProblems(text: string, today: string): string[] {
  let m: LastmodMapV2;
  try {
    m = parseMap(text);
  } catch (e) {
    return [`the map does not read: ${(e as Error).message}`];
  }
  const out: string[] = [];
  if ((JSON.parse(text) as { version?: unknown }).version !== 2) out.push("the map is not version 2 — regenerate it at the cut");
  else if (writeMap(m) !== text) out.push("the map is not in its one-line-per-page form — regenerate it, never edit it by hand");
  for (const [k, [hash, date]] of Object.entries(m.pages)) {
    if (!/^[a-z0-9]+:[a-z]{2}$/.test(k)) out.push(`${k}: not a <page>:<lang> key`);
    if (!/^[0-9a-f]{64}$/.test(hash)) out.push(`${k}: '${hash}' is not a SHA-256`);
    if (!isDay(date)) out.push(`${k}: '${date}' is not YYYY-MM-DD`);
    else if (date > today) out.push(`${k}: ${date} is in the future (today is ${today})`);
  }
  return out;
}

/** The rows the map lacks (pages new since the cut), the rows it holds for no page (removed since), and the rows whose content moved. */
export function drift(m: LastmodMapV2, hashes: Readonly<Record<string, string>>): { readonly added: string[]; readonly removed: string[]; readonly moved: string[] } {
  const live = Object.keys(hashes);
  return {
    added: live.filter((k) => m.pages[k] === undefined).sort(),
    removed: Object.keys(m.pages).filter((k) => hashes[k] === undefined).sort(),
    moved: live.filter((k) => m.pages[k] !== undefined && m.pages[k][0] !== hashes[k]).sort(),
  };
}

/** The release gate (`--check-fresh`): the shape, and no row added, removed or moved since the map was written. */
export function freshProblems(text: string, hashes: Readonly<Record<string, string>>, today: string): string[] {
  const shape = shapeProblems(text, today);
  if (shape.length > 0) return shape;
  const d = drift(parseMap(text), hashes);
  return [
    ...d.moved.map((k) => `${k}: its content changed since the map was written`),
    ...d.added.map((k) => `${k}: a page with no row (new since the last cut)`),
    ...d.removed.map((k) => `${k}: a row for a page that no longer exists`),
  ];
}

/** Today's Europe/Berlin day (#925): a cut at 00:30 Berlin is that Berlin day, not the UTC day before. */
export const todayBerlin = (now: Date = new Date()): string => berlinDay(now);

/** The newest commit day (`YYYY-MM-DD`) among a page's content files — the seed of a row the map has never held. */
export function gitDay(page: PageId | "place" | "motorway"): string | null {
  if (page === "404" || page === "news") return null;
  const files = closure(ENTRY[page]);
  const out = execFileSync("git", ["-c", "color.ui=false", "log", "-1", "--format=%cs", "--", ...files], { cwd: WEB_ROOT, encoding: "utf8" }).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(out) ? out : null;
}

/** The committed map, either version, as version 2 — or null when there is none. */
export function readMap(file: string = LASTMOD_FILE): LastmodMapV2 | null {
  return existsSync(file) ? parseMap(readFileSync(file, "utf8")) : null;
}

export const renderMap = writeMap;

/** `--check` / `--check-fresh` over the committed file: the lines to print and the exit status. */
export function checkFile(text: string | null, fresh: boolean, hashes: Readonly<Record<string, string>>, today: string): { readonly lines: string[]; readonly code: 0 | 1 } {
  const rel = relative(process.cwd(), LASTMOD_FILE);
  if (text === null) return { lines: [`✗ ${rel} does not exist — run npx tsx packages/web/scripts/lastmod.ts at the release cut`], code: 1 };
  const problems = fresh ? freshProblems(text, hashes, today) : shapeProblems(text, today);
  if (problems.length > 0) {
    return {
      lines: [
        ...problems.slice(0, 40).map((p) => `  ✗ ${p}`),
        fresh
          ? `✗ ${rel} is stale at the cut (${problems.length} problem(s)) — regenerate it IN THE RELEASE COMMIT: npx tsx packages/web/scripts/lastmod.ts`
          : `✗ ${rel} is malformed (${problems.length} problem(s)) — regenerate it at the release cut: npx tsx packages/web/scripts/lastmod.ts`,
      ],
      code: 1,
    };
  }
  const m = parseMap(text);
  const rows = Object.keys(m.pages).length;
  if (fresh) return { lines: [`✓ lastmod map is current at the cut: ${rows} rows, every hash the page's own`], code: 0 };
  const d = drift(m, hashes);
  return {
    lines: [`✓ lastmod map is well-formed: ${rows} rows; since the last cut ${d.moved.length} moved, ${d.added.length} new (release day at build), ${d.removed.length} gone (dropped at the next cut)`],
    code: 0,
  };
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  const today = todayBerlin();
  const onDiskText = existsSync(LASTMOD_FILE) ? readFileSync(LASTMOD_FILE, "utf8") : null;
  const hashes = allHashes();
  if (process.argv.includes("--check") || process.argv.includes("--check-fresh")) {
    const r = checkFile(onDiskText, process.argv.includes("--check-fresh"), hashes, today);
    process.stdout.write(`${r.lines.join("\n")}\n`);
    process.exit(r.code);
  }
  let prev = onDiskText === null ? null : parseMap(onDiskText);
  if (prev === null && process.argv.includes("--seed-from-git")) {
    // A seed is a map whose every row is "unchanged since its last commit".
    const pages: Record<string, readonly [string, string]> = {};
    for (const key of Object.keys(hashes)) {
      const day = gitDay(key.split(":")[0] as PageId | "place" | "motorway");
      if (day !== null) pages[key] = [hashes[key as LastmodKey], day];
    }
    prev = { version: 2, pages };
  }
  const next = assignDates(prev, hashes, today);
  const text = writeMap(next);
  if (text !== onDiskText) writeFileSync(LASTMOD_FILE, text);
  const moved = Object.keys(next.pages).filter((k) => prev?.pages[k]?.[0] !== next.pages[k]![0]);
  process.stdout.write(`lastmod: ${Object.keys(next.pages).length} rows, ${moved.length} moved${moved.length > 0 ? `: ${moved.join(", ")}` : ""}\n`);
}
