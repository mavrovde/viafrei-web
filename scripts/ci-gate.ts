/**
 * ci-gate: may this commit be released? Yes only when every required
 * workflow's NEWEST run on the commit concluded `success`, that run was a
 * push to main of this repository (a fork's run, a pull request's run or a
 * run on another branch is never evidence), AND every one of its required
 * jobs concluded `success` in it. The last clause is not redundant: a run
 * whose jobs were all SKIPPED (an `if:` that did not hold) concludes
 * `success` too, so a run's conclusion alone would release a commit nothing
 * tested. A run still queued or in progress is a refusal, not a wait.
 *
 *   node scripts/ci-gate.ts newest <sha> <owner/repo> < runs.json     the newest run id per required workflow
 *   node scripts/ci-gate.ts runs <sha> <owner/repo> < runs.json       the runs alone: did both workflows
 *                                                                      finish green? (Release Please's
 *                                                                      trigger, never a release gate)
 *   node scripts/ci-gate.ts <sha> <owner/repo> <jobs-dir> < runs.json  the verdict
 *
 * runs.json is `gh api --paginate --slurp "repos/R/actions/runs?head_sha=SHA&per_page=100"`, and
 * <jobs-dir>/jobs-<id>.json is `gh api --paginate --slurp "repos/R/actions/runs/<id>/jobs?per_page=100"`
 * for each id `newest` printed (scripts/ci-gate.sh does both). A missing jobs file is unusable input.
 * Exit 0 = released may proceed; 1 = refused (the reason on stderr); 2 = unusable input.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** The workflows whose jobs are the required checks (README of branch protection). */
export const REQUIRED_WORKFLOWS = [".github/workflows/ci.yml", ".github/workflows/security.yml"] as const;

/**
 * The jobs each required workflow must have RUN and passed: the required checks of docs/RELEASING.md,
 * less `Dependency review`, which runs on pull requests only (test/workflows.test.ts holds the two equal).
 * The browser job is not here: it is a job of release.yml itself, which publish needs.
 */
export const REQUIRED_JOBS: Readonly<Record<(typeof REQUIRED_WORKFLOWS)[number], readonly string[]>> = {
  ".github/workflows/ci.yml": [
    "Changes (code, or prose only)",
    "Lint",
    "Unit tests",
    "Site gates",
    "Image (build, scan, smoke)",
    "Stack (the shell against the pinned releases)",
  ],
  ".github/workflows/security.yml": ["Changes (code, or prose only)", "CodeQL (TypeScript)", "Dependency licences", "Secrets in history (gitleaks)", "DAST (OWASP ZAP against the container)"],
};

export type Job = { readonly name: string; readonly status: string; readonly conclusion: string | null; readonly run_attempt?: number };

export type Run = {
  readonly id: number;
  readonly path: string;
  readonly head_sha: string;
  readonly head_branch: string | null;
  readonly event: string;
  readonly status: string;
  readonly conclusion: string | null;
  readonly run_attempt?: number;
  readonly created_at: string;
  readonly head_repository?: { readonly full_name?: string } | null;
};

export type GateResult = { readonly ok: boolean; readonly lines: readonly string[] };

/** `--slurp` gives an array of pages, each `{ workflow_runs: [...] }`; a single page object is accepted too. */
export function runsOf(json: unknown): Run[] {
  const pages = Array.isArray(json) ? json : [json];
  const out: Run[] = [];
  for (const p of pages) {
    const runs = (p as { workflow_runs?: unknown } | null)?.workflow_runs;
    if (!Array.isArray(runs)) throw new Error("not a workflow-runs listing (no workflow_runs array)");
    out.push(...(runs as Run[]));
  }
  return out;
}

/** `--slurp` gives an array of pages, each `{ jobs: [...] }`; a single page object is accepted too. */
export function jobsOf(json: unknown): Job[] {
  const pages = Array.isArray(json) ? json : [json];
  const out: Job[] = [];
  for (const p of pages) {
    const jobs = (p as { jobs?: unknown } | null)?.jobs;
    if (!Array.isArray(jobs)) throw new Error("not a jobs listing (no jobs array)");
    out.push(...(jobs as Job[]));
  }
  return out;
}

/** Each required workflow's newest push-to-main run of `repo` on `sha` (undefined when there is none). */
export function newestRuns(runs: readonly Run[], sha: string, repo: string, required: readonly string[] = REQUIRED_WORKFLOWS): Map<string, Run | undefined> {
  const out = new Map<string, Run | undefined>();
  for (const path of required) {
    const mine = runs
      .filter((r) => r.path === path && r.head_sha === sha && r.event === "push" && r.head_branch === "main" && r.head_repository?.full_name === repo)
      .sort((a, b) => (a.created_at === b.created_at ? (b.run_attempt ?? 1) - (a.run_attempt ?? 1) : a.created_at < b.created_at ? 1 : -1));
    out.set(path, mine[0]);
  }
  return out;
}

/**
 * The verdict. `jobsFor(id)` gives a run's jobs (the newest attempt's, which is what the jobs endpoint lists);
 * it is asked only for a run that concluded success, and it may throw (unusable input).
 */
export function judgeCi(
  runs: readonly Run[],
  sha: string,
  repo: string,
  jobsFor: (runId: number) => readonly Job[],
  required: Readonly<Record<string, readonly string[]>> = REQUIRED_JOBS,
): GateResult {
  if (!/^[0-9a-f]{40}$/.test(sha)) return { ok: false, lines: [`✗ '${sha.slice(0, 50)}' is not a 40-hex commit`] };
  const lines: string[] = [];
  let ok = true;
  for (const [path, newest] of newestRuns(runs, sha, repo, Object.keys(required))) {
    if (newest === undefined) {
      ok = false;
      lines.push(`✗ ${path}: no push-to-main run of ${repo} on ${sha.slice(0, 12)}`);
      continue;
    }
    if (newest.status !== "completed") {
      ok = false;
      lines.push(`✗ ${path}: run ${String(newest.id)} is ${newest.status}, not completed — a release never waits on a running check`);
      continue;
    }
    if (newest.conclusion !== "success") {
      ok = false;
      lines.push(`✗ ${path}: run ${String(newest.id)} concluded ${newest.conclusion ?? "nothing"}`);
      continue;
    }
    const jobs = jobsFor(newest.id);
    const bad: string[] = [];
    for (const name of required[path] ?? []) {
      const job = jobs.filter((j) => j.name === name).sort((a, b) => (b.run_attempt ?? 1) - (a.run_attempt ?? 1))[0];
      if (job === undefined) bad.push(`${name}: not in the run`);
      else if (job.conclusion !== "success") bad.push(`${name}: ${job.conclusion ?? job.status}`);
    }
    if (bad.length > 0) {
      ok = false;
      lines.push(`✗ ${path}: run ${String(newest.id)} concluded success, but a required job did not run and pass — ${bad.join("; ")}`);
    } else {
      lines.push(`✓ ${path}: run ${String(newest.id)} concluded success, its ${String((required[path] ?? []).length)} required job(s) each success`);
    }
  }
  return { ok, lines };
}

/**
 * The runs alone, no job read: both workflows' newest push-to-main runs concluded success. This is
 * what tells Release Please that both completions are in (after an ordinary merge only Lint and
 * Dependency licences run, so the jobs gate would refuse every one); it never releases anything.
 */
export function judgeRuns(runs: readonly Run[], sha: string, repo: string): GateResult {
  const none = Object.fromEntries(REQUIRED_WORKFLOWS.map((p) => [p, [] as readonly string[]]));
  const r = judgeCi(runs, sha, repo, () => [], none);
  return { ok: r.ok, lines: r.lines.map((l) => l.replace(/, its 0 required job\(s\) each success$/u, "")) };
}

function readRuns(): Run[] {
  return runsOf(JSON.parse(readFileSync(0, "utf8")) as unknown);
}

const REPO_RE = /^[\w.-]+\/[\w.-]+$/;

function main(argv: readonly string[]): number {
  if (argv[0] === "newest") {
    const [, sha, repo] = argv;
    if (sha === undefined || repo === undefined || !REPO_RE.test(repo) || argv.length !== 3) {
      process.stderr.write("usage: node scripts/ci-gate.ts newest <sha> <owner/repo> < runs.json\n");
      return 2;
    }
    let runs: Run[];
    try {
      runs = readRuns();
    } catch (e) {
      process.stderr.write(`✗ the runs listing is unusable: ${(e as Error).message}\n`);
      return 2;
    }
    for (const r of newestRuns(runs, sha, repo).values()) if (r !== undefined) process.stdout.write(`${String(r.id)}\n`);
    return 0;
  }
  if (argv[0] === "runs") {
    const [, sha, repo] = argv;
    if (sha === undefined || repo === undefined || !REPO_RE.test(repo) || argv.length !== 3) {
      process.stderr.write("usage: node scripts/ci-gate.ts runs <sha> <owner/repo> < runs.json\n");
      return 2;
    }
    let runs: Run[];
    try {
      runs = readRuns();
    } catch (e) {
      process.stderr.write(`✗ the runs listing is unusable: ${(e as Error).message}\n`);
      return 2;
    }
    const r = judgeRuns(runs, sha, repo);
    for (const l of r.lines) (r.ok ? process.stdout : process.stderr).write(`${l}\n`);
    return r.ok ? 0 : 1;
  }
  const [sha, repo, dir] = argv;
  if (sha === undefined || repo === undefined || dir === undefined || !REPO_RE.test(repo) || argv.length !== 3) {
    process.stderr.write("usage: node scripts/ci-gate.ts <sha> <owner/repo> <jobs-dir> < runs.json\n");
    return 2;
  }
  let runs: Run[];
  try {
    runs = readRuns();
  } catch (e) {
    process.stderr.write(`✗ the runs listing is unusable: ${(e as Error).message}\n`);
    return 2;
  }
  let r: GateResult;
  try {
    r = judgeCi(runs, sha, repo, (id) => jobsOf(JSON.parse(readFileSync(join(dir, `jobs-${String(id)}.json`), "utf8")) as unknown));
  } catch (e) {
    process.stderr.write(`✗ a jobs listing is unusable: ${(e as Error).message}\n`);
    return 2;
  }
  for (const l of r.lines) (r.ok ? process.stdout : process.stderr).write(`${l}\n`);
  return r.ok ? 0 : 1;
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(main(process.argv.slice(2)));
