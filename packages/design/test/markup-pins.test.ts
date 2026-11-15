/**
 * #922 B2: a test pins markup as STRUCTURE (`@viafrei/design/testing`), not as
 * a substring of it — so a class re-ordered or an attribute added fails only
 * the tests that are about it. The literal pins that remain are listed in
 * `markup-pins.allow.tsv`, each under one of the reasons below, and this test
 * is the ratchet: a new literal pin fails until it is converted or listed with
 * a reason, and a listed one that is gone fails too, so the list cannot
 * outlive what it excuses.
 *
 * The census is the issue's own two greps, asked of git over the TRACKED tree
 * (not `--untracked`, which also reads non-ignored scratch such as a local
 * Playwright `test-results/`), never a directory walk that could be pointed
 * at the wrong one; a new test file is judged once it is added. A pin is keyed by its file and its quoted literal,
 * never its line number, so moving a test does not churn the list.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../..");

/** Why a pin stays literal. Every reason is a claim about BYTES, or about text that is not rendered markup. */
export const REASONS = {
  escaping: "proves a value was escaped, or an injected tag is absent, in the bytes sent — a parsed document would read the tag as an element and hide the defect",
  csp: "the nonce on a script tag is the CSP contract on the exact bytes the middleware rewrites",
  feed: "a sitemap or Atom element, an external contract its crawlers read byte for byte",
  source: "the subject is SOURCE text (an Astro template, a TypeScript file), not rendered markup",
  sequence: "pins the order or adjacency of several elements and text in one run (a table row, a swatch and its label, a literal cut inside a tag), which presence of each part does not express",
} as const;
// viafrei-web#2: `provider` and `own-escaping` are reasons only the digest, ingest and mcp pins used; they stay in viafrei
type Reason = keyof typeof REASONS;

/** `git grep` in its portable ERE: the two patterns of #922 B2. */
const PATTERNS = ["toContain\\(.*class=", "toContain\\([\"'`]<[a-z]"] as const;
/** The quoted first argument of `toContain(`, as written in the source. */
const LITERAL = /toContain\((["'`])((?:\\.|(?!\1).)*)\1/;

type Pin = { readonly file: string; readonly line: number; readonly literal: string };

function census(pattern: string): readonly Pin[] {
  let out = "";
  try {
    out = execFileSync("git", ["-c", "color.ui=false", "grep", "-nE", pattern, "--", "packages/web", "packages/design"] /* viafrei-web#2: the two packages that live here */, { cwd: ROOT, encoding: "utf8" });
  } catch (e) {
    // git grep exits 1 on no match; anything else is a failed read, not "no pins"
    if ((e as { status?: number }).status !== 1) throw e;
  }
  return out
    .split("\n")
    .filter((l) => l !== "")
    .map((l) => {
      const [file = "", n = "", ...rest] = l.split(":");
      return { file, line: Number(n), literal: LITERAL.exec(rest.join(":"))?.[2] ?? "<unparsed>" };
    });
}

const key = (file: string, literal: string): string => `${file}\t${literal}`;

function allowList(): ReadonlyMap<string, { readonly reason: Reason; readonly count: number }> {
  const m = new Map<string, { reason: Reason; count: number }>();
  for (const row of readFileSync(join(HERE, "markup-pins.allow.tsv"), "utf8").split("\n")) {
    if (row === "" || row.startsWith("#")) continue;
    const [reason = "", file = "", ...lit] = row.split("\t");
    if (!(reason in REASONS)) throw new Error(`markup-pins.allow.tsv: unknown reason "${reason}" on ${file}`);
    const k = key(file, lit.join("\t"));
    const had = m.get(k);
    m.set(k, { reason: reason as Reason, count: (had?.count ?? 0) + 1 });
  }
  return m;
}

/** The pins of both patterns, once each (a line matching both is one pin). */
function pins(): readonly Pin[] {
  const seen = new Map<string, Pin>();
  for (const p of PATTERNS.flatMap(census)) seen.set(`${p.file}:${String(p.line)}`, p);
  return [...seen.values()];
}

/** What the census holds that the list does not, and what the list holds that the census does not. */
export function judge(found: readonly Pin[], allowed: ReadonlyMap<string, { readonly count: number }>): { readonly unlisted: readonly string[]; readonly stale: readonly string[] } {
  const counts = new Map<string, number>();
  for (const p of found) counts.set(key(p.file, p.literal), (counts.get(key(p.file, p.literal)) ?? 0) + 1);
  const unlisted = found.filter((p) => (counts.get(key(p.file, p.literal)) ?? 0) > (allowed.get(key(p.file, p.literal))?.count ?? 0)).map((p) => `${p.file}:${String(p.line)}  ${p.literal}`);
  const stale = [...allowed].filter(([k, v]) => (counts.get(k) ?? 0) < v.count).map(([k]) => k.replace("\t", "  "));
  return { unlisted, stale };
}

describe("#922 B2: markup is pinned as structure", () => {
  it("the issue's two counts are under their targets (212 → < 40, 366 → < 80)", () => {
    const [classes, tags] = PATTERNS.map((p) => census(p).length);
    // the floor: a census of nothing would pass the ceiling, and these are the ones the list names
    expect(classes).toBeGreaterThan(0);
    expect(classes).toBeLessThan(40);
    expect(tags).toBeLessThan(80);
  });

  it("every literal pin that remains is listed with a reason, and every listed one still exists", () => {
    const found = pins();
    expect(found.length, "the census read nothing — git grep pointed at the wrong tree?").toBeGreaterThanOrEqual(25) /* viafrei-web#2: 32 pins in packages/web and packages/design at the move (viafrei: 50 over five packages) */;
    expect(found.filter((p) => p.literal === "<unparsed>")).toEqual([]);
    expect(judge(found, allowList())).toEqual({ unlisted: [], stale: [] });
  });

  it("the judge can say no: a new pin is unlisted, a removed one is stale", () => {
    const pin = { file: "packages/x/a.test.ts", line: 3, literal: '<span class="a">' };
    const listed = new Map([[key(pin.file, pin.literal), { count: 1 }]]);
    expect(judge([pin], listed)).toEqual({ unlisted: [], stale: [] });
    expect(judge([pin, { ...pin, line: 9 }], listed).unlisted).toEqual(['packages/x/a.test.ts:3  <span class="a">', 'packages/x/a.test.ts:9  <span class="a">']);
    expect(judge([], listed).stale).toEqual(['packages/x/a.test.ts  <span class="a">']);
    expect(judge([{ ...pin, literal: 'class="b"' }], listed)).toEqual({ unlisted: ['packages/x/a.test.ts:3  class="b"'], stale: ['packages/x/a.test.ts  <span class="a">'] });
  });

  it("every reason the list uses is defined, and every defined reason is used", () => {
    const used = new Set([...allowList().values()].map((v) => v.reason));
    expect([...used].sort()).toEqual(Object.keys(REASONS).sort());
  });
});
