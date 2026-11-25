/**
 * The sitemaps' `<lastmod>` is the day a page's CONTENT last changed
 * (`scripts/lastmod.ts`, `src/generated/lastmod.json`), never the build's day.
 * Since #934 the map is a release artefact, regenerated once at the cut, so
 * these tests judge the committed map's SHAPE only — whether its hashes are
 * current is the cut's question (`lastmod.ts --check-fresh`, run by the push
 * hook's `lastmod` leg on a version bump and by `ci-local.sh web --release`).
 * The rule itself is pinned against a map built from today's hashes: two
 * builds of unchanged content give the same dates; a change to one page moves
 * that page's rows alone; a catalogue string moves only the page (and
 * language) that prints it.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  allHashes,
  assignDates,
  checkFile,
  closure,
  diskReader,
  drift,
  ENTRY,
  freshProblems,
  LASTMOD_FILE,
  META_KEYS,
  pageHash,
  readMap,
  shapeProblems,
  todayBerlin,
  WEB_ROOT as WEB,
  type Reader,
} from "../scripts/lastmod.js";
import catalogue from "../src/generated/catalogue.json" with { type: "json" };
import { newestNewsDate } from "../src/news/entries.js";
import { sitemapXml } from "../src/pages/sitemap.xml.js";
import { berlinDay, fromParsed, readMap as parseMap, writeMap } from "../src/site/lastmod-map.js";
import { lastmodFrom, lastmodOf, releaseDay } from "../src/site/lastmod.js";
import { releaseDateOf } from "../scripts/generate-catalogue.js";
import { LIVE_LANGS, PAGES } from "../src/site/pages.js";

const committedText = readFileSync(LASTMOD_FILE, "utf8");
const committed = readMap(LASTMOD_FILE);
const live = allHashes();
/** The map a cut on 2026-10-01 would write for today's content: the base every rule case starts from. */
const base = assignDates(null, live, "2026-10-01");

/** A reader that serves `rel` with `edit` applied and every other file from disk. */
const editing = (rel: string, edit: (s: string) => string): Reader => (r) => {
  const text = diskReader(r);
  return r === rel && text !== null ? edit(text) : text;
};

/** `rows` without `key`. */
const without = <V>(rows: Readonly<Record<string, V>>, key: string): Record<string, V> => Object.fromEntries(Object.entries(rows).filter(([k]) => k !== key));

const movedKeys = (after: Readonly<Record<string, string>>): string[] => Object.keys(live).filter((k) => after[k] !== live[k as keyof typeof live]);

describe("the committed lastmod map: its shape, on every run (#934)", () => {
  it("is committed, version 2, one line per page, every hash a SHA-256 and every day a real day no later than today", () => {
    expect(committed).not.toBeNull();
    expect(shapeProblems(committedText, todayBerlin())).toEqual([]);
    expect(checkFile(committedText, false, live, todayBerlin()).code).toBe(0);
    // one entry per line: the 242 rows of 2.3.18 are 242 lines plus five of frame
    expect(committedText.split("\n").length - 1).toBe(Object.keys(committed!.pages).length + 5);
  });

  it("every row is a page of the map in a live language, or one removed since the cut (never anything else)", () => {
    const d = drift(committed!, live);
    for (const k of Object.keys(committed!.pages)) if (!d.removed.includes(k)) expect(live[k as keyof typeof live], k).toBeDefined();
    for (const k of d.removed) expect(k, "a removed row is still <page>:<lang>").toMatch(/^[a-z]+:[a-z]{2}$/);
  });

  it("the hashed pages are every page of the map but the 404 and the News page, and the place and motorway pages, in every language", () => {
    const keys = Object.keys(live);
    // seven pages of the map, the motorway index (#715), the station catalogue (#1041), the examples page (#747), the terms of use (#707), the Land index (#1074), the place pages and the motorway pages
    expect(keys).toHaveLength(14 * LIVE_LANGS.length);
    expect(keys.some((k) => k.startsWith("news:") || k.startsWith("404:"))).toBe(false);
  });
});

describe("the format: version 2, one line per page (#934 C3, C4)", () => {
  it("a version-1 map reads as the same rows, and a version-2 map round-trips byte for byte", () => {
    const v1 = { version: 1, pages: Object.fromEntries(Object.entries(base.pages).map(([k, [hash, date]]) => [k, { hash, date }])) };
    expect(fromParsed(v1)).toEqual(base);
    expect(parseMap(JSON.stringify(v1, null, 2))).toEqual(base);
    const text = writeMap(base);
    expect(writeMap(parseMap(text))).toBe(text);
    expect(writeMap(parseMap(committedText))).toBe(committedText);
  });

  it("one changed page is a ONE-line diff (four lines in version 1)", () => {
    const key = Object.keys(base.pages)[7]!;
    const next = { version: 2 as const, pages: { ...base.pages, [key]: [base.pages[key]![0], "2026-10-02"] as const } };
    const a = writeMap(base).split("\n");
    const b = writeMap(next).split("\n");
    expect(a.length).toBe(b.length);
    expect(a.filter((l, i) => l !== b[i])).toHaveLength(1);
  });

  it("a day in the future, a day that is not YYYY-MM-DD, a hash that is not SHA-256, a hand-edited layout and a version-1 map each fail the shape", () => {
    const today = "2026-10-23";
    const k = Object.keys(base.pages)[0]!;
    const withRow = (row: readonly [string, string]): string => writeMap({ version: 2, pages: { ...base.pages, [k]: row } });
    expect(shapeProblems(writeMap(base), today)).toEqual([]);
    expect(shapeProblems(withRow([base.pages[k]![0], "2026-10-24"]), today).join()).toMatch(/in the future/);
    expect(shapeProblems(withRow([base.pages[k]![0], "2026-10-2"]), today).join()).toMatch(/not YYYY-MM-DD/);
    expect(shapeProblems(withRow([base.pages[k]![0], "2026-02-30"]), today).join()).toMatch(/not YYYY-MM-DD/);
    expect(shapeProblems(withRow(["abc", "2026-10-01"]), today).join()).toMatch(/not a SHA-256/);
    expect(shapeProblems(JSON.stringify(base, null, 2), today).join()).toMatch(/one-line-per-page form/);
    const v1 = { version: 1, pages: Object.fromEntries(Object.entries(base.pages).map(([kk, [hash, date]]) => [kk, { hash, date }])) };
    expect(shapeProblems(JSON.stringify(v1, null, 2), today).join()).toMatch(/not version 2/);
    expect(shapeProblems("{", today).join()).toMatch(/does not read/);
    expect(checkFile(withRow([base.pages[k]![0], "2026-10-24"]), false, live, today).lines.at(-1)).toMatch(/regenerate it at the release cut/);
  });
});

describe("the cut: --check-fresh is the release gate (#934 D2)", () => {
  it("passes a map written for today's content and fails one whose page moved, lacks a row or holds a row for a gone page", () => {
    const today = "2026-10-23";
    expect(freshProblems(writeMap(base), live, today)).toEqual([]);
    const k = Object.keys(base.pages)[3]!;
    const moved = { version: 2 as const, pages: { ...base.pages, [k]: ["0".repeat(64), "2026-10-01"] as const } };
    expect(freshProblems(writeMap(moved), live, today)).toEqual([`${k}: its content changed since the map was written`]);
    const rest = without(base.pages, k);
    expect(freshProblems(writeMap({ version: 2, pages: rest }), live, today)).toEqual([`${k}: a page with no row (new since the last cut)`]);
    const extra = { version: 2 as const, pages: { ...base.pages, "gone:de": ["0".repeat(64), "2026-10-01"] as const } };
    expect(freshProblems(writeMap(extra), live, today)).toEqual(["gone:de: a row for a page that no longer exists"]);
    // the message names the release step
    expect(checkFile(writeMap(moved), true, live, today).lines.at(-1)).toMatch(/IN THE RELEASE COMMIT/);
    // ...and the shape check (every ordinary run) passes all three: a stale map is not a feature commit's problem
    for (const m of [moved, { version: 2 as const, pages: rest }, extra]) expect(shapeProblems(writeMap(m), today)).toEqual([]);
  });

  it("a cut regenerated at 00:30 Berlin records the Berlin day, not the UTC day before (#925)", () => {
    expect(todayBerlin(new Date("2026-10-22T22:30:00Z"))).toBe("2026-10-23"); // CEST
    expect(todayBerlin(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01"); // CET
    expect(todayBerlin(new Date("2026-10-23T21:59:59Z"))).toBe("2026-10-23");
    const k = Object.keys(live)[0]!;
    const next = assignDates(base, { ...live, [k]: "f".repeat(64) }, todayBerlin(new Date("2026-10-22T22:30:00Z")));
    expect(next.pages[k]![1]).toBe("2026-10-23");
  });

  it("two cuts on different days: the later cut's day is on what moved in it, the earlier cut's on the rest, and a re-run of either changes nothing", () => {
    const k = Object.keys(live)[5]!;
    const cutA = assignDates(null, live, "2026-10-20");
    const changed = { ...live, [k]: "e".repeat(64) };
    const cutB = assignDates(cutA, changed, "2026-10-22");
    for (const key of Object.keys(live)) expect(cutB.pages[key]![1], key).toBe(key === k ? "2026-10-22" : "2026-10-20");
    expect(assignDates(cutB, changed, "2026-10-25")).toEqual(cutB);
    expect(assignDates(cutA, live, "2026-10-25")).toEqual(cutA);
  });
});

describe("the content rule is unchanged (#934 A3)", () => {
  it("two builds of unchanged content give identical hashes and identical dates", () => {
    expect(allHashes()).toEqual(live);
    const first = assignDates(base, allHashes(), "2026-11-01");
    const second = assignDates(first, allHashes(), "2026-11-02");
    expect(second).toEqual(first);
    expect(first).toEqual(base);
  });

  it("a change to ONE page's own file moves that page's rows and no other", () => {
    const read = editing("src/layouts/FuelPage.astro", (s) => s.replace("</Base>", "<p>planted</p></Base>"));
    const after = allHashes(read);
    expect(movedKeys(after).sort()).toEqual(LIVE_LANGS.map((l) => `fuel:${l}`).sort());
    const next = assignDates(base, after, "2031-01-01");
    for (const k of Object.keys(live)) expect(next.pages[k]![1], k).toBe(k.startsWith("fuel:") ? "2031-01-01" : base.pages[k]![1]);
  });

  it("a changed catalogue string moves only the page and language that print it", () => {
    const read = editing("src/i18n/en.json", (s) => {
      const deck = JSON.parse(s) as { fuelPage: { title: string } };
      deck.fuelPage.title = `${deck.fuelPage.title} planted`;
      return JSON.stringify(deck);
    });
    expect(movedKeys(allHashes(read))).toEqual(["fuel:en"]);
  });

  it("META_KEYS are the keys meta.ts reads for each page", () => {
    const meta = readFileSync(join(WEB, "src", "site", "meta.ts"), "utf8");
    for (const [page, keys] of Object.entries(META_KEYS)) {
      if (page === "place" || page === "motorway") continue;
      const arm = new RegExp(`case "${page}":\\s*return ([^;]+);`).exec(meta)?.[1] ?? "";
      const named = [...arm.matchAll(/t\(lang, "([\w.]+)"\)/g)].map((m) => m[1]);
      expect(named.sort(), page).toEqual([...keys].sort());
    }
  });

  it("the chrome every page shares is not any page's content: a header change moves nothing", () => {
    const read = editing("src/components/Header.astro", (s) => `${s}\n<!-- planted -->`);
    expect(allHashes(read)).toEqual(live);
  });

  it("a page's content files are its own closure, and they exist", () => {
    for (const [page, entry] of Object.entries(ENTRY)) {
      const files = closure(entry);
      expect(files, page).toContain(entry);
      expect(files.some((f) => f.startsWith("src/layouts/Base")), page).toBe(false);
    }
    expect(closure(ENTRY.connect)).toContain("src/layouts/ConnectPage.astro");
    expect(pageHash("connect", "de")).toMatch(/^[0-9a-f]{64}$/);
    expect(pageHash("connect", "de")).not.toBe(pageHash("connect", "en"));
  });

  it("refuses an import that resolves to nothing rather than hashing less", () => {
    const read = editing("src/layouts/FuelPage.astro", (s) => s.replace('import Base from "./Base.astro";', 'import Base from "./Base.astro";\nimport Gone from "./Gone.astro";'));
    expect(() => allHashes(read)).toThrow(/Gone\.astro/);
  });
});

describe("the sitemap between cuts (#934 C1, C2, A4)", () => {
  it("the catalogue's release date is the CHANGELOG heading's, else the regeneration's Berlin day — never null (2.4.1: a patch has no block until the milestone closes)", () => {
    const log = "## [Unreleased]\n\n## [2.4.0] — 2026-10-25\n";
    expect(releaseDateOf(log, "2.4.0", new Date("2026-10-26T12:00:00Z"))).toBe("2026-10-25");
    expect(releaseDateOf(log, "2.4.1", new Date("2026-10-26T12:00:00Z"))).toBe("2026-10-26");
    expect(releaseDateOf(log, "2.4.1", new Date("2026-10-26T23:30:00Z"))).toBe("2026-10-27");
    expect(releaseDateOf("## [2.4.10] — 2026-11-01\n", "2.4.1", new Date("2026-10-26T12:00:00Z"))).toBe("2026-10-26");
    expect(catalogue.release.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("a version's date, once committed, is kept on any later day — a rebuild on the next day equals the committed file (2.4.1 review B1)", () => {
    const log = "## [Unreleased]\n\n## [2.4.0] — 2026-10-25\n";
    const committed = { version: "2.4.1", date: "2026-10-26" };
    for (const at of ["2026-10-27T08:00:00Z", "2026-11-30T23:30:00Z", "2027-01-02T00:00:00Z"]) expect(releaseDateOf(log, "2.4.1", new Date(at), committed), at).toBe("2026-10-26");
    // the committed block of ANOTHER version, or an unreadable one, is no date for this one
    expect(releaseDateOf(log, "2.4.2", new Date("2026-10-27T08:00:00Z"), committed)).toBe("2026-10-27");
    expect(releaseDateOf(log, "2.4.1", new Date("2026-10-27T08:00:00Z"), { version: "2.4.1", date: null })).toBe("2026-10-27");
    expect(releaseDateOf(log, "2.4.1", new Date("2026-10-27T08:00:00Z"), null)).toBe("2026-10-27");
    // the CHANGELOG heading, once written at the milestone close, wins
    expect(releaseDateOf("## [2.4.1] — 2026-10-28\n", "2.4.1", new Date("2026-10-27T08:00:00Z"), committed)).toBe("2026-10-28");
    // and the committed catalogue is what a rebuild on any day reproduces
    expect(releaseDateOf("", catalogue.release.version, new Date("2099-01-01T12:00:00Z"), catalogue.release)).toBe(catalogue.release.date);
  });
  it("a page new since the cut carries the release day — the build's Berlin day, else the catalogue's release date — never a missing <lastmod>", () => {
    expect(releaseDay({ APP_BUILT_AT: "2026-10-22T22:30:00Z" })).toBe("2026-10-23");
    expect(releaseDay({ APP_BUILT_AT: "2026-10-23T09:00:00Z" })).toBe(berlinDay(new Date("2026-10-23T09:00:00Z")));
    expect(releaseDay({})).toBe(catalogue.release.date);
    expect(releaseDay({ APP_BUILT_AT: "not a time" })).toBe(catalogue.release.date);
    const rows = without(committed!.pages, "fuel:tr");
    expect(lastmodFrom(rows, "fuel", "tr", () => "2026-10-30")).toBe("2026-10-30");
    expect(lastmodFrom(rows, "fuel", "de", () => "2026-10-30")).toBe(committed!.pages["fuel:de"]![1]);
    const xml = sitemapXml((p, l) => lastmodFrom(rows, p, l, () => "2026-10-30"));
    const urls = xml.match(/<url>/g)?.length ?? 0;
    expect(urls).toBeGreaterThan(0);
    expect(xml.match(/<\/loc><lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g)?.length).toBe(urls);
    // #49: /sitemap.xml lists de and en alone, so the new row is read through an English one
    expect(xml).not.toContain("<loc>https://viafrei.de/tr/fuel</loc>");
    const rowsEn = without(committed!.pages, "fuel:en");
    expect(sitemapXml((p, l) => lastmodFrom(rowsEn, p, l, () => "2026-10-30"))).toContain("/en/fuel</loc><lastmod>2026-10-30</lastmod>");
  });

  it("a row whose page has gone is in no sitemap meanwhile, and the next cut drops it", () => {
    const rows = { ...committed!.pages, "gone:de": ["0".repeat(64), "1999-01-01"] as const };
    expect(sitemapXml((p, l) => lastmodFrom(rows, p, l))).toBe(sitemapXml((p, l) => lastmodFrom(committed!.pages, p, l)));
    expect(sitemapXml()).not.toContain("1999-01-01");
    expect(assignDates({ version: 2, pages: rows }, live, "2026-10-30").pages["gone:de"]).toBeUndefined();
  });

  it("the 404 has no <lastmod> and the News page keeps its newest entry's date", () => {
    expect(lastmodOf("404", "de")).toBeNull();
    expect(lastmodOf("news", "de")).toBe(newestNewsDate());
    expect(PAGES.some((p) => p.id === "news")).toBe(true);
  });
});
