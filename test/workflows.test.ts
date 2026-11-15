/**
 * The workflows hold to what this repository promises about them (viafrei-web#2; the claims
 * viafrei-database's test/workflows.test.ts holds, for the ones that apply here).
 */
import { execFileSync } from "node:child_process";
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
  it("are the five this repository runs", () => {
    expect(files).toEqual(["ci.yml", "release-please.yml", "release.yml", "scorecard.yml", "security.yml"]);
  });

  it("pin every action by a full commit sha, with its version beside it, and the sha the siblings pin", () => {
    let n = 0;
    for (const f of files) {
      for (const line of text(f).split("\n")) {
        const m = /^\s*(?:-\s+)?uses:\s*(\S+)(.*)$/u.exec(line);
        if (m === null) continue;
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

  it("save CI minutes: no schedule, prose skips every job but one, heavy steps at a minor only", () => {
    for (const f of files) {
      expect(text(f), `${f} has a schedule`).not.toMatch(/^\s+schedule:/mu);
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
    for (const step of ["npm run web:lighthouse", "npm run web:visual\n", "bash scripts/web-i18n-mutation.sh"]) {
      expect(ci, step).toContain(`        if: ${minor}\n        run: ${step}`);
    }
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
    expect(logins).toBe(5);
    expect(ci.split("password: ${{ secrets.GHCR_READ_TOKEN }}").length - 1).toBe(logins);
    expect(ci.split("- name: GHCR_READ_TOKEN must be set").length - 1).toBe(logins);
    expect(ci, "a job asks for packages it no longer reads").not.toMatch(/packages: read/u);
    expect(ci).not.toContain("Manage Actions access");
    // release.yml pushes and reads this repository's own image: there GITHUB_TOKEN is right
    expect(text("release.yml").split("password: ${{ secrets.GITHUB_TOKEN }}").length - 1).toBe(3);
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
    const indent = (lines[run + 1] ?? "").search(/\S/u);
    const body: string[] = [];
    for (const l of lines.slice(run + 1)) {
      if (l.trim() !== "" && l.search(/\S/u) < indent) break;
      body.push(l.slice(indent));
    }
    return body.join("\n");
  };
  const runTagStep = (manifest: string, tag: "found" | "missing"): { out: string; calls: string } => {
    const dir = mkdtempSync(join(tmpdir(), "rp-tag-"));
    const gh = join(dir, "gh");
    writeFileSync(gh, [
      "#!/usr/bin/env bash",
      `echo "$*" >> "${dir}/calls"`,
      `case "$*" in *release-please-manifest*) echo '{".":"${manifest}"}';;`,
      tag === "found" ? "  *git/ref/tags*) echo abc;;" : "  *git/ref/tags*) echo 'gh: Not Found (HTTP 404)' >&2; exit 1;;",
      "esac",
    ].join("\n"));
    chmodSync(gh, 0o755);
    writeFileSync(join(dir, "step.sh"), tagStep());
    const outFile = join(dir, "out");
    writeFileSync(outFile, "");
    execFileSync("bash", ["-e", join(dir, "step.sh")], { env: { ...process.env, PATH: `${dir}:${process.env.PATH ?? ""}`, GITHUB_OUTPUT: outFile, GH_REPO: "o/r" }, stdio: "pipe" });
    const res = { out: readFileSync(outFile, "utf8"), calls: existsSync(join(dir, "calls")) ? readFileSync(join(dir, "calls"), "utf8") : "" };
    rmSync(dir, { recursive: true, force: true });
    return res;
  };

  it("builds the first release pull request from manifest 0.0.0 without waiting for a v0.0.0 tag", () => {
    const r = runTagStep("0.0.0", "missing");
    expect(r.out).toBe("tagged=true\n");
    expect(r.calls).not.toContain("git/ref/tags");
  });

  it("after a release, waits for that version's tag and builds once it exists", () => {
    expect(runTagStep("0.1.0", "missing").out).toBe("tagged=false\n");
    expect(runTagStep("0.1.0", "found").out).toBe("tagged=true\n");
  });
});
