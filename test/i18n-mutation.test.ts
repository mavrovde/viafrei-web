// The shards of the catalogue parity mutants (scripts/web-i18n-mutation.sh --shard k/n, ci.yml's
// four-job matrix): disjoint, together the whole list, none of the four empty, and every bad
// --shard or empty shard refused with exit 2 before any mutant or control runs.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO } from "./helpers.js";

const SCRIPT = join(REPO, "scripts/web-i18n-mutation.sh");
const run = (...args: string[]) => spawnSync("bash", [SCRIPT, ...args], { cwd: REPO, encoding: "utf8", env: { ...process.env, WEB_I18N_MUTATION_LANGS: "" } });
const listed = (...args: string[]): string[] => {
  const r = run("--list", ...args);
  expect(r.status, r.stdout + r.stderr).toBe(0);
  return r.stdout.split("\n").filter((l) => l !== "" && !l.startsWith("web-i18n-mutation: shard "));
};

describe("the catalogue parity mutants' shards", () => {
  const all = listed();
  const langs = readdirSync(join(REPO, "packages/web/src/i18n")).filter((f) => f.endsWith(".json") && f !== "de.json");

  it("list five mutants for every catalogue but the German one", () => {
    expect(langs.length).toBeGreaterThan(0);
    expect(all.length).toBe(langs.length * 5);
    expect(new Set(all).size).toBe(all.length);
  });

  it("cut into four shards that are disjoint, together the whole list, and none empty", () => {
    const COUNT = 4; // ci.yml's matrix (test/workflows.test.ts holds it to [1, 2, 3, 4] and --shard "$SHARD/4")
    const shards = Array.from({ length: COUNT }, (_, k) => listed("--shard", `${String(k + 1)}/${String(COUNT)}`));
    const flat = shards.flat();
    expect(new Set(flat).size).toBe(flat.length);
    expect([...flat].sort()).toEqual([...all].sort());
    for (const s of shards) expect(s.length).toBeGreaterThan(0);
    // position p goes to shard p mod 4 + 1
    expect(shards[1]).toEqual(all.filter((_, p) => p % COUNT === 1));
  });

  it("sort a given WEB_I18N_MUTATION_LANGS with LC_ALL=C, so its order never changes a shard", () => {
    const two = [...langs].sort().slice(0, 2).map((f) => f.replace(/\.json$/u, ""));
    const given = (order: string[]) => spawnSync("bash", [SCRIPT, "--list", "--shard", "2/4"], { cwd: REPO, encoding: "utf8", env: { ...process.env, WEB_I18N_MUTATION_LANGS: order.join(" ") } });
    const a = given(two);
    const b = given([...two].reverse());
    expect(a.status, a.stdout + a.stderr).toBe(0);
    expect(b.stdout).toBe(a.stdout);
  });

  it("refuse a bad --shard, a second --shard, an unknown argument and an empty shard with exit 2", () => {
    for (const bad of ["0/4", "5/4", "1/0", "-1/4", "1/4/2", "1.5/4", "01/4", "a/4", "1", "", " 1/4"]) {
      const r = run("--shard", bad);
      expect(r.status, bad).toBe(2);
      expect(r.stdout, bad).toContain("refused: --shard takes <k>/<n>");
    }
    expect(run("--shard").status).toBe(2);
    expect(run("--shard", "1/4", "--shard", "2/4").status).toBe(2);
    expect(run("--bogus").status).toBe(2);
    const n = all.length + 1;
    const empty = run("--shard", `${String(n)}/${String(n)}`);
    expect(empty.status).toBe(2);
    expect(empty.stdout).toContain("refused: this shard selects no mutant");
    expect(empty.stdout).not.toContain("UNMUTATED");
  });
});
