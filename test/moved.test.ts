/**
 * The skips of the move are counted, not silent (viafrei-web#2): every `it.skip`/`describe.skip` under
 * packages/ carries a `cross-repo(...)` or `pin-skew` marker on the line above it, and the table in
 * docs/moved-from-viafrei.md names exactly those files with exactly those counts — and, as `file`
 * rows, exactly the whole files `vitest.config.ts` excludes as cross-repo.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO } from "./helpers.js";

type Row = { readonly marker: string; readonly count: string };

function table(): Map<string, Row> {
  const doc = readFileSync(join(REPO, "docs/moved-from-viafrei.md"), "utf8");
  const m = /<!-- skips:begin -->([\s\S]*?)<!-- skips:end -->/u.exec(doc);
  if (m === null) throw new Error("docs/moved-from-viafrei.md has no skips:begin/skips:end block");
  const rows = new Map<string, Row>();
  for (const line of (m[1] ?? "").split("\n")) {
    const r = /^\| `([^`]+)` \| (cross-repo|pin-skew) \| (\d+|file) \|/u.exec(line);
    if (r === null) continue;
    rows.set(r[1] ?? "", { marker: r[2] ?? "", count: r[3] ?? "" });
  }
  return rows;
}

function skipsInTree(): { counts: Map<string, Row>; unmarked: string[] } {
  const files = execFileSync("git", ["-C", REPO, "ls-files", "packages/*.ts"], { encoding: "utf8" }).split("\n").filter((f) => f.endsWith(".ts"));
  const counts = new Map<string, Row>();
  const unmarked: string[] = [];
  for (const f of files) {
    const lines = readFileSync(join(REPO, f), "utf8").split("\n");
    lines.forEach((line, i) => {
      if (!/\b(?:it|test|describe)\.skip\(/u.test(line)) return;
      const above = lines[i - 1] ?? "";
      const mk = /\/\/ (cross-repo)\([a-z-]+\):|\/\/ (pin-skew):/u.exec(above);
      if (mk === null) { unmarked.push(`${f}:${String(i + 1)}`); return; }
      const marker = mk[1] ?? mk[2] ?? "";
      const prev = counts.get(f);
      if (prev !== undefined && prev.marker !== marker) throw new Error(`${f} mixes cross-repo and pin-skew skips; give each its own row`);
      counts.set(f, { marker, count: String(Number(prev?.count ?? "0") + 1) });
    });
  }
  return { counts, unmarked };
}

function excludedFiles(): string[] {
  const cfg = readFileSync(join(REPO, "vitest.config.ts"), "utf8");
  return [...cfg.matchAll(/"(packages\/web\/test\/[^"]+\.test\.ts)", \/\/ /gu)].map((m) => m[1] ?? "");
}

describe("the skips of the move (docs/moved-from-viafrei.md)", () => {
  it("every skip under packages/ carries a cross-repo or pin-skew marker on the line above", () => {
    expect(skipsInTree().unmarked).toEqual([]);
  });

  it("the table names exactly the files that skip, each with its marker and count", () => {
    const want = [...table()].filter(([, r]) => r.count !== "file").sort(([a], [b]) => a.localeCompare(b));
    const got = [...skipsInTree().counts].sort(([a], [b]) => a.localeCompare(b));
    expect(got.length, "a census over nothing proves nothing").toBeGreaterThan(5);
    expect(got).toEqual(want);
  });

  it("the table's whole-file rows are exactly the cross-repo excludes of vitest.config.ts", () => {
    const want = [...table()].filter(([, r]) => r.count === "file").map(([f]) => f).sort();
    const got = excludedFiles().sort();
    expect(got.length).toBeGreaterThan(0);
    expect(got).toEqual(want);
  });
});
