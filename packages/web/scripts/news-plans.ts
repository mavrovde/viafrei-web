/**
 * The News page's "Plans" against GitHub (#588): which open issues the owner
 * has labelled `planned` have no `kind: "plan"` entry in `src/news/entries.ts`,
 * and which plan entries name an issue that is closed or no longer labelled.
 *
 *   npx tsx packages/web/scripts/news-plans.ts
 *
 * Run by the lead at a release. It READS GitHub through `gh` (an authenticated
 * CLI, the repository resolved from this checkout's `origin`) and writes
 * nothing: a missing plan is written by a person, and a stale one is removed or
 * turned into a "new" entry when its issue ships. The comparison itself is the
 * pure `planReport`, which `test/news.test.ts` drives from fixtures — no test
 * calls `gh` or the network.
 *
 * Exit 0: every `planned` issue has a plan and every plan an open, labelled
 * issue. Exit 1: findings, each printed. Exit 2: `gh` could not answer, which
 * is never read as "nothing planned".
 */
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NEWS_ENTRIES, type NewsEntry } from "../src/news/entries.js";

export const PLANNED_LABEL = "planned";

export type GhIssue = { readonly number: number; readonly title: string; readonly state: string; readonly labels: readonly string[] };

export type PlanReport = {
  /** Open issues labelled `planned` with no plan entry. */
  readonly unlisted: readonly GhIssue[];
  /** Plan entries whose issue is closed, unlabelled or could not be read. */
  readonly stale: readonly { readonly id: string; readonly issue: number; readonly why: "closed" | "unlabelled" | "unreadable" }[];
};

/**
 * `planned`: the open issues carrying the label. `issueOf`: each plan entry's
 * issue as GitHub has it now (null when it could not be read).
 */
export function planReport(planned: readonly GhIssue[], issueOf: (n: number) => GhIssue | null, entries: readonly NewsEntry[] = NEWS_ENTRIES): PlanReport {
  const plans = entries.filter((e) => e.kind === "plan");
  const listed = new Set(plans.map((e) => e.issue));
  const unlisted = planned.filter((i) => i.state === "OPEN" && i.labels.includes(PLANNED_LABEL) && !listed.has(i.number));
  const stale: PlanReport["stale"][number][] = [];
  for (const e of plans) {
    const i = issueOf(e.issue);
    const why = i === null ? "unreadable" : i.state !== "OPEN" ? "closed" : !i.labels.includes(PLANNED_LABEL) ? "unlabelled" : null;
    if (why !== null) stale.push({ id: e.id, issue: e.issue, why });
  }
  return { unlisted, stale };
}

export function renderPlanReport(r: PlanReport): string {
  const lines: string[] = [];
  for (const i of r.unlisted) lines.push(`✗ #${i.number} is labelled ${PLANNED_LABEL} and has no plan entry: ${i.title}`);
  for (const s of r.stale) {
    const what = s.why === "closed" ? "is closed — remove the plan or make it a new entry" : s.why === "unlabelled" ? `no longer carries ${PLANNED_LABEL} — remove the plan` : "could not be read";
    lines.push(`✗ plan ${s.id}: #${s.issue} ${what}`);
  }
  if (lines.length === 0) lines.push("✓ news-plans: every planned issue has a plan entry, and every plan an open, labelled issue");
  return `${lines.join("\n")}\n`;
}

type Raw = { number: number; title: string; state: string; labels: { name: string }[] };
const toIssue = (r: Raw): GhIssue => ({ number: r.number, title: r.title, state: r.state, labels: r.labels.map((l) => l.name) });

function gh(args: readonly string[], cwd: string): string {
  return execFileSync("gh", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30_000 });
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  let planned: GhIssue[];
  try {
    planned = (JSON.parse(gh(["issue", "list", "--label", PLANNED_LABEL, "--state", "open", "--limit", "500", "--json", "number,title,state,labels"], root)) as Raw[]).map(toIssue);
  } catch {
    process.stderr.write("✗ news-plans: gh could not list the planned issues — nothing was compared\n");
    process.exit(2);
  }
  if (planned.length === 500) {
    process.stderr.write("✗ news-plans: the listing came back at its limit and may be truncated — nothing was compared\n");
    process.exit(2);
  }
  const issueOf = (n: number): GhIssue | null => {
    try {
      return toIssue(JSON.parse(gh(["issue", "view", String(n), "--json", "number,title,state,labels"], root)) as Raw);
    } catch {
      return null;
    }
  };
  const report = planReport(planned, issueOf);
  process.stdout.write(renderPlanReport(report));
  process.exit(report.unlisted.length + report.stale.length === 0 ? 0 : report.stale.some((s) => s.why === "unreadable") ? 2 : 1);
}
