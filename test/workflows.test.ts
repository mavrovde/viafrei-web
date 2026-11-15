/**
 * The workflows hold to what this repository promises about them (viafrei-web#2; the claims
 * viafrei-database's test/workflows.test.ts holds, for the ones that apply here).
 */
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REQUIRED_JOBS } from "../scripts/ci-gate.js";
import { REPO } from "./helpers.js";

const WF = join(REPO, ".github/workflows");
const files = readdirSync(WF).filter((f) => f.endsWith(".yml")).sort();
const text = (f: string): string => readFileSync(join(WF, f), "utf8");
const read = (p: string): string => readFileSync(join(REPO, p), "utf8");
/** One job of a workflow, from its `  <id>:` line to the next job's (or the end of the file). */
const job = (t: string, id: string): string => {
  const m = new RegExp(`^ {2}${id}:\n((?: {4}.*\n|\n)*)`, "mu").exec(t);
  return m?.[1] ?? "";
};

/** The action pins of viafrei-database main (a92153a) and viafrei-api main (23b3f24), newest where they differ. */
const SIBLING_PINS: Record<string, string> = {
  "actions/attest-build-provenance": "4d101475d8b20a2381f78447822ac1eab6504dd8",
  "actions/checkout": "3d3c42e5aac5ba805825da76410c181273ba90b1",
  "actions/dependency-review-action": "a1d282b36b6f3519aa1f3fc636f609c47dddb294",
  "actions/download-artifact": "9000827ccba6bdab643e8b6fd33ac0654aef8333",
  "actions/setup-node": "949feb2413d6458794dcd2491c4babbbce0c15c1",
  "actions/upload-artifact": "cf430e030ddbb5b0abf93d22962f4752f3646cd9",
  "anchore/sbom-action": "66cbf4bc1f1c0d2edc94016e65bc221b6bb0ad6c",
  "docker/build-push-action": "c3c9e263c25d99ce0380d002d59b67737d91b0dc",
  "docker/login-action": "8aa5831fb8d48d8f76594c7ddde61ae58019f550",
  "docker/setup-buildx-action": "f87e5991a6d7451dcb8d9637bfbc97413f497069",
  "docker/setup-qemu-action": "99012661954931238ded8c8b007157a8430204e1",
  "github/codeql-action/analyze": "33d7b85da1a04171e211befe2c739303b9a4c066",
  "github/codeql-action/init": "33d7b85da1a04171e211befe2c739303b9a4c066",
  "github/codeql-action/upload-sarif": "33d7b85da1a04171e211befe2c739303b9a4c066",
  "googleapis/release-please-action": "45996ed1f6d02564a971a2fa1b5860e934307cf7",
  "ossf/scorecard-action": "fa7117db83c52d787ae5a89f350999701505d78e",
  "sigstore/cosign-installer": "756fe2d284c7292c4e9b62c8a28f1e5629c59532",
  "SonarSource/sonarqube-scan-action": "4d1dc0c91ee400dcf8a6dddf2f705ac36542e304",
};

describe("the workflows", () => {
  it("are the six this repository runs", () => {
    expect(files).toEqual(["ci.yml", "release-please.yml", "release.yml", "scorecard.yml", "security.yml", "snyk.yml"]);
  });

  it("pin every action by a full commit sha, with its version beside it, and the sha the siblings pin", () => {
    let n = 0;
    for (const f of files) {
      for (const line of text(f).split("\n")) {
        const m = /^\s*(?:-\s+)?uses:\s*(\S+)(.*)$/u.exec(line);
        if (m === null) continue;
        // a workflow of this repository, called by its path, is pinned by the commit that runs it
        if ((m[1] ?? "").startsWith("./.github/workflows/")) continue;
        n++;
        const [action, sha] = (m[1] ?? "").split("@");
        expect(sha, `${f}: ${line.trim()}`).toMatch(/^[0-9a-f]{40}$/u);
        expect(m[2], `${f}: ${line.trim()} names no version`).toMatch(/^ # v\d+(\.\d+)*$/u);
        expect(SIBLING_PINS[action ?? ""], `${f}: ${action ?? ""} is pinned by no sibling`).toBe(sha);
      }
    }
    expect(n).toBeGreaterThan(30);
  });

  it("run on the Node of the image", () => {
    const docker = /^FROM node:(\d+\.\d+\.\d+)-/mu.exec(read("Dockerfile"))?.[1];
    expect(docker).toMatch(/^\d+\.\d+\.\d+$/u);
    const seen = files.flatMap((f) => [...text(f).matchAll(/(?:node-version|NODE_VERSION):\s*(?!\$\{)(\S+)/gu)].map((m) => `${f} ${m[1] ?? ""}`));
    expect(seen.length).toBeGreaterThan(3);
    for (const s of seen) expect(s.split(" ")[1], s).toBe(docker);
  });

  it("run every third-party image by digest (the ones CONTRIBUTING.md says are bumped by hand)", () => {
    const sources = files.map((f) => `.github/workflows/${f}`).concat(["Dockerfile", "docker-compose.yml", "scripts/zap-scan.sh"]);
    const all = sources.map((p) => read(p)).join("\n");
    for (const image of ["rhysd/actionlint", "aquasec/trivy", "zricethezav/gitleaks", "zaproxy/zap-stable", "postgis/postgis"]) {
      const refs = [...all.matchAll(new RegExp(`(?:^|[\\s="])(${image.replace("/", "\\/")}(?::[\\w.-]+)?)(@sha256:[0-9a-f]{64})?`, "gmu"))];
      expect(refs.length, `${image} is used nowhere`).toBeGreaterThan(0);
      for (const r of refs) expect(r[2], `${r[1] ?? ""} is not pinned by digest`).toBeDefined();
    }
    const from = [...read("Dockerfile").matchAll(/^FROM (\S+)/gmu)].map((m) => m[1] ?? "");
    expect(from.length).toBe(2);
    for (const f of from) expect(f).toMatch(/^node:[\w.-]+@sha256:[0-9a-f]{64}$/u);
  });

  it("allow exactly the licences scripts/licences.mjs allows", () => {
    const set = /export const ALLOWED = new Set\(\[([^\]]+)\]\)/u.exec(read("scripts/licences.mjs"))?.[1] ?? "";
    const allowed = [...set.matchAll(/"([^"]+)"/gu)].map((m) => m[1] ?? "");
    expect(allowed.length).toBeGreaterThan(5);
    const line = /allow-licenses: (.+)$/mu.exec(text("security.yml"))?.[1] ?? "";
    expect(line.split(",").map((s) => s.trim()).sort()).toEqual(allowed.sort());
  });

  it("publish only from a gate: release.yml's identity and image are this repository's", () => {
    const r = text("release.yml");
    expect(r).toContain("IMAGE: ghcr.io/mavrovde/viafrei-web\n");
    expect(r).toContain("IDENTITY: ^https://github\\.com/mavrovde/viafrei-web/\\.github/workflows/release\\.yml@refs/tags/v[0-9]+\\.[0-9]+\\.[0-9]+$");
    const code = r.split("\n").filter((l) => !/^\s*#/u.test(l)).join("\n");
    expect(code, "only a comment may name the sibling it was copied from").not.toMatch(/viafrei-database/u);
    for (const job of ["gate:", "publish:", "verify:", "tag:", "release-page:"]) expect(r).toContain(`\n  ${job}\n`);
    expect(r).toContain("gh release upload \"$TAG\" scripts/site-pages.txt");
    expect(r).not.toMatch(/npm publish/u);
  });

  it("save CI minutes: no schedule but Snyk's weekly one, prose skips every job but one, heavy steps at a minor only", () => {
    for (const f of files) {
      if (f !== "snyk.yml") expect(text(f), `${f} has a schedule`).not.toMatch(/^\s+schedule:/mu);
      expect(text(f), `${f} runs on a push to any branch`).not.toMatch(/^ {2}push:\n(?! {4}(branches: \[main\]|tags:))/mu);
    }
    const minor = "github.event_name == 'workflow_dispatch' || (startsWith(github.head_ref, 'release-please--') && endsWith(github.event.pull_request.title, '.0'))";
    const releasePush = "github.event_name != 'push' || startsWith(github.event.head_commit.message, 'chore: release ')";
    const code = "needs.changes.outputs.code == 'true'";
    for (const f of ["ci.yml", "security.yml"]) {
      const t = text(f);
      // no workflow-level filter: a skipped workflow never reports its required checks (a merge would need the bypass)
      expect(t, `${f}: a workflow-level paths filter`).not.toMatch(/^\s+paths(-ignore)?:/mu);
      expect(t, `${f}: the changes job`).toContain('  changes:\n    name: Changes (code, or prose only)\n');
      // the base's copy judges; the pull request's own copy only when the base has none (the bootstrap)
      expect(t).toContain('if git show "$PR_BASE:scripts/changes.sh" > "$RUNNER_TEMP/changes.sh" 2> /dev/null; then');
      expect(t).toContain('code="$(CHANGES_ROOT="$PWD" bash "$judge" "$PR_BASE" "$PR_HEAD")" ;;');
      expect(t).toContain('push) code="$(bash scripts/changes.sh "$BEFORE" "$AFTER")" ;;');
      expect(t).toContain("*) code=true ;;");
      expect(t).toContain("cancel-in-progress: ${{ github.event_name == 'pull_request' }}");
      // every other job needs the changes job and runs only on code
      const jobs = [...t.matchAll(/^ {2}([a-z-]+):\n((?: {4}.*\n|\n)+?)(?= {4}runs-on:)/gmu)];
      expect(jobs.length, `${f}: jobs read`).toBeGreaterThan(4);
      for (const [, name, head] of jobs) {
        if (name === "changes") continue;
        expect(head, `${f} ${name ?? ""}: needs changes`).toMatch(/^ {4}needs: (changes|\[changes, [a-z]+\])$/mu);
        const cond = (/^ {4}if: (.+)$/mu.exec(head ?? "")?.[1] ?? "").replace(/^"/u, "");
        expect(cond.startsWith(code), `${f} ${name ?? ""}: runs only on code (${cond})`).toBe(true);
      }
      expect(t).toContain(`${code} && (${releasePush})`);
    }
    const ci = text("ci.yml");
    expect(ci).toContain(`        if: ${minor}\n        run: bash scripts/web-i18n-mutation.sh`);
    const prc = JSON.parse(read("release-please-config.json")) as { "pull-request-title-pattern": string };
    expect(prc["pull-request-title-pattern"], "the release-push condition reads the release commit by this title").toBe("chore: release ${version}");
    expect(text("scorecard.yml")).toMatch(/\non:\n(?:\s*#[^\n]*\n)*\s+workflow_dispatch:\n\n/u);
  });

  it("name every required check of docs/RELEASING.md as a job", () => {
    const doc = read("docs/RELEASING.md");
    const block = /<!-- required-checks:begin -->([\s\S]*?)<!-- required-checks:end -->/u.exec(doc)?.[1] ?? "";
    const required = [...block.matchAll(/^- `([^`]+)`/gmu)].map((m) => m[1] ?? "");
    expect(required.length).toBeGreaterThan(5);
    const names = new Set(files.flatMap((f) => [...text(f).matchAll(/^ {4}name: (.+)$/gmu)].map((m) => (m[1] ?? "").trim())));
    for (const c of required) expect(names.has(c), `required check "${c}" is no job's name`).toBe(true);
  });

  it("gate a release on exactly the required checks that run on a push (scripts/ci-gate.ts REQUIRED_JOBS)", () => {
    const block = /<!-- required-checks:begin -->([\s\S]*?)<!-- required-checks:end -->/u.exec(read("docs/RELEASING.md"))?.[1] ?? "";
    const required = [...block.matchAll(/^- `([^`]+)`/gmu)].map((m) => m[1] ?? "");
    // Dependency review runs on pull requests only, so a release's push run never has it
    expect(required).toContain("Dependency review");
    expect([...new Set(Object.values(REQUIRED_JOBS).flat())].sort()).toEqual(required.filter((c) => c !== "Dependency review").sort());
    // the Changes job gates every other job of both workflows, so both runs must carry it
    for (const jobs of Object.values(REQUIRED_JOBS)) expect(jobs).toContain("Changes (code, or prose only)");
    for (const [wf, jobs] of Object.entries(REQUIRED_JOBS)) {
      const names = [...read(wf).matchAll(/^ {4}name: (.+)$/gmu)].map((m) => (m[1] ?? "").trim());
      for (const j of jobs) expect(names, `${wf}: ${j}`).toContain(j);
    }
  });

  it("pull the private viafrei-app with GHCR_READ_TOKEN, each pull behind a check that the secret is set", () => {
    const ci = text("ci.yml");
    const logins = ci.split("docker/login-action@").length - 1;
    expect(logins).toBe(4);
    expect(ci.split("password: ${{ secrets.GHCR_READ_TOKEN }}").length - 1).toBe(logins);
    expect(ci.split("- name: GHCR_READ_TOKEN must be set").length - 1).toBe(logins);
    expect(ci, "a job asks for packages it no longer reads").not.toMatch(/packages: read/u);
    expect(ci).not.toContain("Manage Actions access");
    // release.yml pushes and reads this repository's own image: there GITHUB_TOKEN is right; its
    // browser job alone pulls the private viafrei-app, with GHCR_READ_TOKEN behind the same check
    const r = text("release.yml");
    expect(r.split("password: ${{ secrets.GITHUB_TOKEN }}").length - 1).toBe(3);
    expect(r.split("password: ${{ secrets.GHCR_READ_TOKEN }}").length - 1).toBe(1);
    const web = job(r, "web");
    expect(web).toContain("password: ${{ secrets.GHCR_READ_TOKEN }}");
    expect(web.indexOf("- name: GHCR_READ_TOKEN must be set")).toBeGreaterThan(-1);
    expect(web.indexOf("- name: GHCR_READ_TOKEN must be set")).toBeLessThan(web.indexOf("password: ${{ secrets.GHCR_READ_TOKEN }}"));
  });

  // Owner 2026-11-15: Snyk weekly on main and once per release, never on a pull request or a push.
  it("run Snyk weekly on main and once per release, before publish, never on a pull request or a push", () => {
    const sn = text("snyk.yml");
    expect(sn).toMatch(/^ {2}schedule:\n {4}- cron: "17 5 \* \* 1"/mu);
    expect(sn).toMatch(/^ {2}workflow_call:\n/mu);
    expect(sn).not.toMatch(/^ {2}(pull_request|push):/mu);
    // anything but a call from release.yml runs on main only, and refuses (exit 2) rather than skipping
    expect(sn).toContain("elif [[ $GITHUB_REF != refs/heads/main ]]; then");
    expect(sn).toContain("./snyk test --all-projects --severity-threshold=high");
    for (const f of files) if (f !== "snyk.yml") expect(text(f), `${f} runs the Snyk CLI`).not.toMatch(/snyk test/u);
    const r = text("release.yml");
    expect(r).toMatch(/\n {2}snyk:\n {4}name: Snyk \(dependencies\)\n {4}needs: gate\n {4}if: needs\.gate\.outputs\.publish == 'true'\n[\s\S]*? {4}uses: \.\/\.github\/workflows\/snyk\.yml\n {4}with:\n {6}ref: \$\{\{ needs\.gate\.outputs\.commit \}\}/u);
    expect(r).toMatch(/\n {2}publish:\n {4}name: [^\n]+\n {4}needs: \[gate, web, snyk\]\n/u);
  });

  // The guard step's own shell text, run in both directions with the shell GitHub runs a step with.
  const snykGuard = (refIn: string, ref: string): number => {
    const lines = text("snyk.yml").split("\n");
    const at = lines.findIndex((l) => l.includes("- name: The run scans main or a release's commit"));
    const run = lines.findIndex((l, i) => i > at && l.trim() === "run: |");
    expect(at).toBeGreaterThanOrEqual(0);
    expect(run).toBeGreaterThan(at);
    const indent = (lines[run + 1] ?? "").search(/\S/u);
    const body: string[] = [];
    for (const l of lines.slice(run + 1)) {
      if (l.trim() !== "" && l.search(/\S/u) < indent) break;
      body.push(l.slice(indent));
    }
    const dir = mkdtempSync(join(tmpdir(), "snyk-guard-"));
    try {
      writeFileSync(join(dir, "step.sh"), body.join("\n"));
      return spawnSync("bash", ["--noprofile", "--norc", "-eo", "pipefail", join(dir, "step.sh")], { env: { ...process.env, REF_IN: refIn, GITHUB_REF: ref }, stdio: "pipe" }).status ?? -1;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it("refuse a Snyk run on any branch but main unless release.yml passed a commit, by running the guard", () => {
    const sha = "0123456789abcdef0123456789abcdef01234567";
    expect(snykGuard("", "refs/heads/feature")).toBe(2);
    expect(snykGuard("", "refs/heads/main")).toBe(0);
    expect(snykGuard(sha, "refs/tags/v0.1.0")).toBe(0);
    expect(snykGuard("main", "refs/tags/v0.1.0")).toBe(2);
    expect(snykGuard(`${sha}0`, "refs/heads/main")).toBe(2);
    const sn = text("snyk.yml");
    // the called run checks out the commit release.yml passed, not main's tip
    expect(sn).toContain("          ref: ${{ inputs.ref || github.sha }}\n");
    // a dispatch takes no input, so it cannot hand the guard a commit
    expect(sn).toMatch(/^ {2}workflow_dispatch:\n {2}workflow_call:\n/mu);
    expect(sn).toContain([
      "        run: |",
      "          mkdir -p sarif",
      "          ./snyk test --all-projects --severity-threshold=high --sarif-file-output=sarif/snyk.sarif",
      "      - name: Upload SARIF to code scanning",
    ].join("\n"));
    expect(text("release.yml")).toContain("    secrets:\n      SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}\n\n");
    for (const f of files) expect(text(f), `${f} inherits every secret`).not.toMatch(/secrets:\s*inherit/u);
  });

  it("run the browser suite once per release: release.yml's web job, which publish needs, and no CI job", () => {
    const ci = text("ci.yml");
    expect(ci, "ci.yml has a web job").not.toMatch(/^ {2}web:$/mu);
    expect(ci, "ci.yml names the Web job").not.toContain("Web (the site shell, built and judged)");
    for (const s of ["web:e2e", "web:browsers", "web:build", "web:budget", "web:lighthouse", "web:latency", "web:visual"]) {
      for (const f of files.filter((x) => x !== "release.yml")) expect(text(f), `${f} runs ${s}`).not.toContain(`npm run ${s}`);
    }
    const r = text("release.yml");
    const web = job(r, "web");
    expect(web).toMatch(/^ {4}name: Web \(the site shell, built and judged\)\n {4}needs: gate\n/u);
    expect(web).toContain("    if: needs.gate.outputs.publish == 'true' || needs.gate.outputs.browser == 'true'\n");
    // the measured ceiling, with its measurement beside it
    expect(web).toMatch(/ {4}# Measured on PR #15 [^\n]+\n(?: {4}#[^\n]*\n)* {4}timeout-minutes: 75\n/u);
    // contents: read and nothing else
    expect(web).toMatch(/\n {4}permissions:\n {6}contents: read\n {4}steps:\n/u);
    expect(web).not.toMatch(/cache: npm/u);
    expect(web).toContain("ref: ${{ needs.gate.outputs.commit || github.sha }}");
    // every check, in order, and none of them conditional but the bootstrap
    const order = ["npm run pinned", "npm run web:browsers", "npm run web:build", "npm run web:e2e\n", "npm run web:budget", "npm run web:lighthouse", "npm run web:latency", "npm run web:visual\n", "npm run web:visual -- --update", "name: visual-baselines-linux"];
    let at = -1;
    for (const s of order) {
      const i = web.indexOf(s);
      expect(i, `the web job runs ${s} after the step before`).toBeGreaterThan(at);
      at = i;
    }
    expect(web.split("\n        if:").length - 1, "only the two bootstrap steps are conditional").toBe(2);
    // publish needs it, so a failure blocks the signed image; verify, tag and the page need publish
    expect(job(r, "publish")).toMatch(/^ {4}name: [^\n]+\n {4}needs: \[gate, web, snyk\]\n {4}if: needs\.gate\.outputs\.publish == 'true'\n/u);
    for (const j of ["verify", "tag", "release-page"]) expect(job(r, j), j).toMatch(/^ {4}name: [^\n]+\n {4}needs: \[gate, publish[\],]/u);
    // a dispatch on a branch is the browser job alone: the gate checks nothing out and sets no publish
    const gate = job(r, "gate");
    expect(gate).toContain("      browser: ${{ steps.on.outputs.browser }}\n");
    expect(gate).toContain('if [[ $GITHUB_EVENT_NAME == workflow_dispatch && $GITHUB_REF == refs/heads/* ]]; then');
    expect(gate.split("        if: steps.on.outputs.browser == 'false'\n").length - 1, "the checkout and the tag check").toBe(2);
    expect(r).toContain("  group: ${{ github.ref_type == 'branch' && format('browser-{0}', github.ref) || 'release' }}\n");
    // the gate does not wait for a CI job that no longer exists
    expect(Object.values(REQUIRED_JOBS).flat()).not.toContain("Web (the site shell, built and judged)");
  });

  it("send a prose file a test reads through the suites (scripts/changes.sh TESTED_PROSE)", () => {
    const listed = (/^TESTED_PROSE="([^"]+)"$/mu.exec(read("scripts/changes.sh"))?.[1] ?? "").split(" ");
    const tests = ["test", "packages/web/test"].flatMap((d) => readdirSync(join(REPO, d)).filter((f) => f.endsWith(".ts")).map((f) => read(`${d}/${f}`)));
    const named = new Set(tests.flatMap((t) => [...t.matchAll(/["'`(]((?:docs\/|packages\/)[\w./-]+\.md)["'`)]/gu)].map((m) => m[1] ?? "")));
    const here = [...named].filter((p) => existsSync(join(REPO, p))).sort();
    expect(here.length).toBeGreaterThan(1);
    for (const p of here) expect(listed, p).toContain(p);
  });

  it("document a tag ruleset whose one bypass is the admin role", () => {
    const doc = read("docs/RELEASING.md");
    expect(doc, "GitHub refuses an Integration bypass actor on a user-owned repository (422)").not.toMatch(/"actor_type": "Integration"/u);
    expect(doc).toContain('{ "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always" }');
  });
});

describe("dependabot", () => {
  it("proposes no TypeScript beyond typescript-eslint's peer range", () => {
    const lock = JSON.parse(read("package-lock.json")) as { packages: Record<string, { peerDependencies?: Record<string, string> }> };
    const peer = lock.packages["node_modules/typescript-eslint"]?.peerDependencies?.["typescript"] ?? "";
    const upper = /<(\d+\.\d+\.\d+)/u.exec(peer)?.[1];
    expect(upper).toBeDefined();
    expect(read(".github/dependabot.yml")).toContain(`versions: [">=${upper ?? ""}"]`);
  });

  it("proposes no lighthouse that brings the FSL-licensed sentry CLI, and the tree holds one that does not", () => {
    const npm = /^ {2}- package-ecosystem: npm\n((?: {4}.*\n|\n)+)/mu.exec(read(".github/dependabot.yml"))?.[1] ?? "";
    expect(npm).toContain('      - dependency-name: lighthouse\n        versions: [">=13.6.0"]\n');
    const lock = JSON.parse(read("package-lock.json")) as { packages: Record<string, { version?: string }> };
    const lighthouse = Object.entries(lock.packages).filter(([k]) => k.endsWith("node_modules/lighthouse"));
    expect(lighthouse.length).toBeGreaterThan(0);
    for (const [k, v] of lighthouse) expect(v.version, k).toMatch(/^13\.[0-5]\./u);
    expect(Object.keys(lock.packages).filter((k) => k.endsWith("node_modules/sentry"))).toEqual([]);
  });

  it("watches npm, the actions, the Dockerfile and the compose file", () => {
    const d = read(".github/dependabot.yml");
    for (const e of ["npm", "github-actions", "docker", "docker-compose"]) expect(d).toContain(`package-ecosystem: ${e}\n`);
  });
});

describe("release-please", () => {
  it("is the node release type of viafrei-web, counted from this repository's first commit before the move", () => {
    const c = JSON.parse(read("release-please-config.json")) as { "bootstrap-sha": string; packages: Record<string, { "release-type": string; "package-name": string }> };
    expect(c["bootstrap-sha"]).toMatch(/^[0-9a-f]{40}$/u);
    expect(c.packages["."]?.["release-type"]).toBe("node");
    expect(c.packages["."]?.["package-name"]).toBe("viafrei-web");
    const m = JSON.parse(read(".release-please-manifest.json")) as Record<string, string>;
    const pkg = JSON.parse(read("package.json")) as { version: string };
    expect(m["."]).toBe(pkg.version);
  });

  // The step's own shell text, run behind a stub gh: the manifest answer and the tag answer are planted.
  const tagStep = (): string => {
    const lines = read(".github/workflows/release-please.yml").split("\n");
    const at = lines.findIndex((l) => l.includes("- name: The released version has its tag"));
    const run = lines.findIndex((l, i) => i > at && l.trim() === "run: |");
    expect(at).toBeGreaterThanOrEqual(0);
    expect(run).toBeGreaterThan(at);
    const indent = (lines[run + 1] ?? "").search(/\S/u);
    const body: string[] = [];
    for (const l of lines.slice(run + 1)) {
      if (l.trim() !== "" && l.search(/\S/u) < indent) break;
      body.push(l.slice(indent));
    }
    return body.join("\n");
  };
  const runTagStep = (manifest: string, tag: "found" | "missing" | "error"): { out: string; calls: string } => {
    const dir = mkdtempSync(join(tmpdir(), "rp-tag-"));
    const gh = join(dir, "gh");
    writeFileSync(gh, [
      "#!/usr/bin/env bash",
      `echo "$*" >> "${dir}/calls"`,
      `case "$*" in *release-please-manifest*) echo '{".":"${manifest}"}';;`,
      {
        found: "  *git/ref/tags*) echo abc;;",
        missing: "  *git/ref/tags*) echo 'gh: Not Found (HTTP 404)' >&2; exit 1;;",
        error: "  *git/ref/tags*) echo 'gh: Server Error (HTTP 500)' >&2; exit 1;;",
      }[tag],
      "esac",
    ].join("\n"));
    try {
      chmodSync(gh, 0o755);
      writeFileSync(join(dir, "step.sh"), tagStep());
      const outFile = join(dir, "out");
      writeFileSync(outFile, "");
      // The shell GitHub runs a `run:` step with.
      execFileSync("bash", ["--noprofile", "--norc", "-eo", "pipefail", join(dir, "step.sh")], { env: { ...process.env, PATH: `${dir}:${process.env.PATH ?? ""}`, GITHUB_OUTPUT: outFile, GH_REPO: "o/r" }, stdio: "pipe" });
      return { out: readFileSync(outFile, "utf8"), calls: existsSync(join(dir, "calls")) ? readFileSync(join(dir, "calls"), "utf8") : "" };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it("the first release is 0.1.0: release-please's own first version is 1.0.0 and bump-minor-pre-major never applies to it", () => {
    const c = JSON.parse(read("release-please-config.json")) as { packages: Record<string, Record<string, unknown>> };
    expect(c.packages["."]?.["initial-version"]).toBe("0.1.0");
  });

  it("builds the first release pull request from manifest 0.0.0 without waiting for a v0.0.0 tag", () => {
    const r = runTagStep("0.0.0", "missing");
    expect(r.out).toBe("tagged=true\n");
    expect(r.calls).not.toContain("git/ref/tags");
  });

  it("after a release, waits for that version's tag and builds once it exists", () => {
    expect(runTagStep("0.1.0", "missing").out).toBe("tagged=false\n");
    expect(runTagStep("0.1.0", "found").out).toBe("tagged=true\n");
  });

  it("a tag read that fails for another reason than 404 fails the step", () => {
    expect(() => runTagStep("0.1.0", "error")).toThrow();
  });
});
