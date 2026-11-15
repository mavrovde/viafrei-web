/**
 * #1173: the one pattern of a page's head. AC 10: the markup has one implementation; AC 12: the three shared states have
 * one key set in all languages, and an unknown is never drawn as a good state.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { raw } from "../src/html.js";
import { nowDescription, nowTitle, NOW_DESCRIPTION_MAX, NOW_TITLE_MAX, PAGE_HEAD_COPY, PAGE_HEAD_LANGS } from "../src/page-head-copy.js";
import { bySeverity, jumpLinks, sectionHead, SEVERITY_ORDER, statusLine, TOP_ITEMS_DESK, TOP_ITEMS_MAX, topItems, type TopItem } from "../src/page-head.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const r = (s: string) => raw(s);
const row = (severity: TopItem["severity"], where: string): TopItem => ({ severity, what: r(severity), where: r(where) });

describe("the status line", () => {
  it("a lamp, a sentence, the Stand; none when nothing was read", () => {
    const a = statusLine({ lamp: "red", lampWord: r("Rot"), sentence: r("2 Sperrungen"), stand: r("Stand 21:59"), id: "x" });
    expect(a).toMatch(/statusline--red/u);
    expect(a).toContain('aria-label="Rot"');
    expect(a).toContain("2 Sperrungen");
    expect(a).toContain("Stand 21:59");
    expect(a).toContain('id="x"');
    expect(statusLine({ lamp: "unknown", lampWord: r("x"), sentence: r("y") })).not.toContain("statusline__stand");
  });
  it("unknown has its own lamp, which is not green", () => {
    const u = statusLine({ lamp: "unknown", lampWord: r("x"), sentence: r("y") });
    expect(u).toContain("statusline--unknown");
    expect(u).not.toContain("statusline--green");
  });
});

describe("the top items", () => {
  it("three on a phone and five on a desktop (#1180), in the one severity order; among equals the caller's order", () => {
    const items = [row("info", "i"), row("roadworks", "w"), row("jam", "j1"), row("closure", "c"), row("jam", "j2"), row("info", "i2")];
    expect(bySeverity(items).map((x) => x.where as unknown as string)).toEqual(["c", "j1", "j2", "w", "i", "i2"]);
    const html = topItems(items, r("l"));
    const rows = [...html.matchAll(/<li class="([^"]+)"/g)].map((m) => m[1]!);
    expect(rows.map((c) => /topitems__row--([a-z]+)/.exec(c)?.[1])).toEqual(["closure", "jam", "jam", "roadworks", "info"]);
    // the first three are the phone's, untouched; the fourth and fifth are the desktop's alone (hidden below 1024 px)
    expect(rows.map((c) => c.split(" ").includes("topitems__extra"))).toEqual([false, false, false, true, true]);
    expect(TOP_ITEMS_MAX).toBe(3);
    expect(TOP_ITEMS_DESK).toBe(5);
    expect(topItems([], r("l"))).toBe("");
    expect([...SEVERITY_ORDER]).toEqual(["closure", "jam", "disruption", "roadworks", "info"]);
  });
});

describe("the jump links", () => {
  it("one chip per non-empty section with its count; a 0 gets none, an uncounted one no number", () => {
    const html = jumpLinks([{ target: "a", label: r("A"), count: 2 }, { target: "b", label: r("B"), count: 0 }, { target: "c", label: r("C"), count: null }], r("l"));
    expect([...html.matchAll(/href="#([a-z]+)"/g)].map((m) => m[1])).toEqual(["a", "c"]);
    expect(html).toMatch(/jumps__n">2</u);
    expect(jumpLinks([{ target: "b", label: r("B"), count: 0 }], r("l"))).toBe("");
  });
  it("a section's head is an H2 with its count", () => {
    expect(sectionHead({ id: "s", title: r("T"), count: 3 })).toBe('<h2 class="section__title" id="s">T <span class="section__n">3</span></h2>');
  });
});

describe("the shared words, all languages", () => {
  it("22 languages, none empty, none the German on a translated page's state keys", () => {
    expect(PAGE_HEAD_LANGS).toHaveLength(22);
    for (const lang of PAGE_HEAD_LANGS) {
      const c = PAGE_HEAD_COPY[lang];
      for (const v of [c.nothing, c.stale, c.error, c.top, c.jumps, c.map, c.showCounted, c.showAll, c.since, c.until, ...Object.values(c.lamp), ...Object.values(c.what), ...Object.values(c.now)]) expect(v.trim(), lang).not.toBe("");
      if (lang !== "de") for (const k of ["nothing", "stale", "error"] as const) expect(c[k], `${lang} ${k}`).not.toBe(PAGE_HEAD_COPY.de[k]);
    }
  });
  it("the title and the description hold the limits for the longest name a page has", () => {
    const longest = "Autobahnkreuz Oberhausen-Lirich-Nord";
    for (const lang of PAGE_HEAD_LANGS)
      for (const kind of ["closure", "jam", "disruption", "roadworks", "nothing"] as const) expect(nowTitle(lang, longest, kind).length, `${lang} ${kind}`).toBeLessThanOrEqual(NOW_TITLE_MAX);
    const status = "A7: 2 Sperrungen · Stand 21:59.";
    expect(nowDescription(status, null)).toBe(status);
    expect(nowDescription(status, "x".repeat(200)).length).toBeLessThanOrEqual(NOW_DESCRIPTION_MAX);
  });
});

describe("one implementation (#1173 AC 10)", () => {
  function files(dir: string): string[] {
    return readdirSync(dir).flatMap((n) => {
      const f = join(dir, n);
      if (statSync(f).isDirectory()) return n === "generated" ? [] : files(f);
      return /\.(ts|astro|svelte)$/u.test(n) && !/\.test\.ts$|\.test\.support\.ts$/u.test(n) ? [f] : [];
    });
  }
  it("no package writes the pattern's markup itself", () => {
    const own: string[] = [];
    for (const pkg of ["digest/src", "web/src", "status/src"])
      for (const f of files(join(ROOT, pkg))) if (/class="(?:statusline|topitems|jumps)(?:__[a-z]+)?[ "]/u.test(readFileSync(f, "utf8"))) own.push(f.slice(ROOT.length));
    expect(own).toEqual([]);
  });
});
