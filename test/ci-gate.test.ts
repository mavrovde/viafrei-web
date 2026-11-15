import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO } from "./helpers.js";
import { jobsOf, judgeCi, judgeRuns, newestRuns, REQUIRED_JOBS, REQUIRED_WORKFLOWS, runsOf, type Job, type Run } from "../scripts/ci-gate.js";

const SHA = "a".repeat(40);
const REPO_ = "mavrovde/viafrei-web";
const run = (o: Partial<Run> & { path: string }): Run => ({
  id: 1,
  head_sha: SHA,
  head_branch: "main",
  event: "push",
  status: "completed",
  conclusion: "success",
  created_at: "2026-11-13T10:00:00Z",
  head_repository: { full_name: REPO_ },
  ...o,
});
const green = REQUIRED_WORKFLOWS.map((path, i) => run({ path, id: i + 1 }));
/** Every required job of every run passed, plus a pull-request-only job that was skipped. */
const passed = (id: number): Job[] => [
  ...(REQUIRED_JOBS[REQUIRED_WORKFLOWS[id - 1] ?? REQUIRED_WORKFLOWS[0]] ?? []).map((name) => ({ name, status: "completed", conclusion: "success" })),
  { name: "Dependency review", status: "completed", conclusion: "skipped" },
];
const jobsWith = (path: string, name: string, o: Partial<Job> | null) => (id: number): Job[] => {
  const base = passed(id);
  if (REQUIRED_WORKFLOWS[id - 1] !== path) return base;
  return o === null ? base.filter((j) => j.name !== name) : base.map((j) => (j.name === name ? { ...j, ...o } : j));
};

describe("judgeCi", () => {
  it("passes when every required workflow's newest push-to-main run succeeded", () => {
    expect(judgeCi(green, SHA, REPO_, passed)).toEqual({ ok: true, lines: REQUIRED_WORKFLOWS.map((p, i) => `✓ ${p}: run ${String(i + 1)} concluded success, its ${String(REQUIRED_JOBS[p].length)} required job(s) each success`) });
  });

  it("refuses a missing workflow and names it", () => {
    const r = judgeCi(green.slice(0, 1), SHA, REPO_, passed);
    expect(r.ok).toBe(false);
    expect(r.lines[1]).toBe(`✗ ${REQUIRED_WORKFLOWS[1]}: no push-to-main run of ${REPO_} on ${SHA.slice(0, 12)}`);
  });

  it.each<[string, Partial<Run>]>([
    ["a pull request's run", { event: "pull_request" }],
    ["another branch's run", { head_branch: "feature" }],
    ["a fork's run", { head_repository: { full_name: "someone/viafrei-web" } }],
    ["a run on another commit", { head_sha: "b".repeat(40) }],
  ])("never counts %s as evidence", (_n, o) => {
    const runs = [run({ path: REQUIRED_WORKFLOWS[0], ...o }), ...green.slice(1)];
    expect(judgeCi(runs, SHA, REPO_, passed).ok).toBe(false);
  });

  it("judges the NEWEST run: a later failure beats an earlier success, a later re-run attempt beats its first", () => {
    const path = REQUIRED_WORKFLOWS[0];
    const later = run({ path, id: 9, conclusion: "failure", created_at: "2026-11-13T11:00:00Z" });
    expect(judgeCi([...green, later], SHA, REPO_, passed).lines[0]).toBe(`✗ ${path}: run 9 concluded failure`);
    const rerun = run({ path, id: 1, run_attempt: 2, conclusion: "success" });
    const first = run({ path, id: 1, run_attempt: 1, conclusion: "failure" });
    expect(judgeCi([first, rerun, ...green.slice(1)], SHA, REPO_, passed).ok).toBe(true);
  });

  it("refuses a run still in progress instead of waiting", () => {
    const r = judgeCi([run({ path: REQUIRED_WORKFLOWS[0], status: "in_progress", conclusion: null }), ...green.slice(1)], SHA, REPO_, passed);
    expect(r.lines[0]).toContain("is in_progress, not completed");
  });

  it("refuses a sha that is not 40 hex", () => {
    expect(judgeCi(green, "v1.2.3", REPO_, passed)).toEqual({ ok: false, lines: ["✗ 'v1.2.3' is not a 40-hex commit"] });
  });
});

describe("judgeCi reads the jobs, not the run's conclusion alone", () => {
  const ci = REQUIRED_WORKFLOWS[0];
  it("the mutant this exists for: a run that concluded success with its required jobs SKIPPED is refused", () => {
    // the shape a prose-only answer (or a broken Changes job answering false) leaves: Changes ran, the rest skipped
    const allSkipped = (id: number): Job[] => passed(id).map((j) => (j.name === "Changes (code, or prose only)" ? j : { ...j, conclusion: "skipped" }));
    const r = judgeCi(green, SHA, REPO_, allSkipped);
    expect(r.ok).toBe(false);
    expect(r.lines[0]).toContain("concluded success, but a required job did not run and pass — Lint: skipped");
    expect(r.lines[0]).not.toContain("Changes (code, or prose only): skipped");
  });
  it.each(REQUIRED_JOBS[ci].map((n) => [n]))("refuses when %s alone was skipped", (name) => {
    const r = judgeCi(green, SHA, REPO_, jobsWith(ci, name, { conclusion: "skipped" }));
    expect(r.ok).toBe(false);
    expect(r.lines[0]).toContain(`${name}: skipped`);
  });
  it("refuses a required job that is not in the run at all, naming it", () => {
    const r = judgeCi(green, SHA, REPO_, jobsWith(REQUIRED_WORKFLOWS[1], "Dependency licences", null));
    expect(r.ok).toBe(false);
    expect(r.lines[1]).toContain("Dependency licences: not in the run");
  });
  it("refuses a required job that failed or was cancelled", () => {
    expect(judgeCi(green, SHA, REPO_, jobsWith(ci, "Site gates", { conclusion: "failure" })).ok).toBe(false);
    expect(judgeCi(green, SHA, REPO_, jobsWith(ci, "Stack (the shell against the pinned releases)", { conclusion: "cancelled" })).ok).toBe(false);
  });
  it("a skipped Dependency review (pull requests only) is no reason to refuse", () => {
    expect(judgeCi(green, SHA, REPO_, passed).ok).toBe(true);
    expect(Object.values(REQUIRED_JOBS).flat()).not.toContain("Dependency review");
  });
  it("judges a job's newest attempt", () => {
    const retried = (id: number): Job[] => [...passed(id).map((j) => (j.name === "Lint" ? { ...j, conclusion: "failure", run_attempt: 1 } : j)), ...(id === 1 ? [{ name: "Lint", status: "completed", conclusion: "success", run_attempt: 2 }] : [])];
    expect(judgeCi(green, SHA, REPO_, retried).ok).toBe(true);
  });
  it("asks for the jobs of a successful run only, and an unreadable listing throws (the CLI's exit 2)", () => {
    const asked: number[] = [];
    judgeCi([run({ path: ci, id: 7, conclusion: "failure" }), ...green.slice(1)], SHA, REPO_, (id) => (asked.push(id), passed(id)));
    expect(asked).toEqual([2]);
    expect(() => judgeCi(green, SHA, REPO_, () => jobsOf({ message: "Not Found" }))).toThrow("no jobs array");
  });
});

describe("judgeRuns (Release Please's trigger, never a release gate)", () => {
  it("passes on green runs without reading a job, and refuses a missing or failed run", () => {
    expect(judgeRuns(green, SHA, REPO_)).toEqual({ ok: true, lines: REQUIRED_WORKFLOWS.map((p, i) => `✓ ${p}: run ${String(i + 1)} concluded success`) });
    expect(judgeRuns(green.slice(1), SHA, REPO_).ok).toBe(false);
    expect(judgeRuns([run({ path: REQUIRED_WORKFLOWS[0], conclusion: "failure" }), ...green.slice(1)], SHA, REPO_).ok).toBe(false);
  });
});

describe("newestRuns", () => {
  it("gives each required workflow's newest push-to-main run, and none for a workflow without one", () => {
    const later = run({ path: REQUIRED_WORKFLOWS[0], id: 9, created_at: "2026-11-13T11:00:00Z" });
    const m = newestRuns([...green, later, run({ path: REQUIRED_WORKFLOWS[1], id: 5, event: "pull_request" })].filter((r) => r.path === REQUIRED_WORKFLOWS[0] || r.id === 5), SHA, REPO_);
    expect(m.get(REQUIRED_WORKFLOWS[0])?.id).toBe(9);
    expect(m.get(REQUIRED_WORKFLOWS[1])).toBeUndefined();
  });
});

describe("jobsOf", () => {
  it("reads --slurp pages and a single page", () => {
    expect(jobsOf([{ jobs: passed(1).slice(0, 2) }, { jobs: passed(1).slice(2) }])).toEqual(passed(1));
    expect(jobsOf({ jobs: passed(2) })).toEqual(passed(2));
  });
});

describe("runsOf", () => {
  it("reads --slurp pages and a single page", () => {
    expect(runsOf([{ workflow_runs: [green[0]] }, { workflow_runs: [green[1]] }])).toEqual(green);
    expect(runsOf({ workflow_runs: green })).toEqual(green);
  });
  it("refuses anything else", () => {
    expect(() => runsOf({ message: "Not Found" })).toThrow("no workflow_runs array");
    expect(() => runsOf(null)).toThrow("no workflow_runs array");
  });
});

describe("the CLI", () => {
  const cli = (args: string[], stdin: string): number => spawnSync(process.execPath, [join(REPO, "scripts/ci-gate.ts"), ...args], { input: stdin, encoding: "utf8" }).status ?? -1;
  const listing = JSON.stringify([{ workflow_runs: green }]);
  it("newest prints one id per required workflow; the verdict reads jobs-<id>.json from the directory", () => {
    const out = spawnSync(process.execPath, [join(REPO, "scripts/ci-gate.ts"), "newest", SHA, REPO_], { input: listing, encoding: "utf8" });
    expect(out.stdout.trim().split("\n")).toEqual(["1", "2"]);
    const dir = mkdtempSync(join(tmpdir(), "ci-gate-"));
    try {
      for (const id of [1, 2]) writeFileSync(join(dir, `jobs-${String(id)}.json`), JSON.stringify([{ jobs: passed(id) }]));
      expect(cli([SHA, REPO_, dir], listing)).toBe(0);
      writeFileSync(join(dir, "jobs-2.json"), JSON.stringify([{ jobs: passed(2).map((j) => ({ ...j, conclusion: "skipped" })) }]));
      expect(cli([SHA, REPO_, dir], listing), "skipped required jobs").toBe(1);
      rmSync(join(dir, "jobs-2.json"));
      expect(cli([SHA, REPO_, dir], listing), "a missing jobs file is unusable input").toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("refuses a malformed call", () => {
    expect(cli([SHA, REPO_], listing)).toBe(2);
    expect(cli(["newest", SHA], listing)).toBe(2);
    expect(cli(["newest", SHA, REPO_], "{}")).toBe(2);
    expect(cli(["runs", SHA, REPO_], listing)).toBe(0);
    expect(cli(["runs", SHA], listing)).toBe(2);
  });
});
