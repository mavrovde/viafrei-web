# Security policy

## Reporting a vulnerability

Please do not report security issues in public issues, pull requests or
discussions. Use GitHub's
[private vulnerability reporting](https://github.com/mavrovde/viafrei-web/security/advisories/new).

- **Acknowledgement** within 3 working days.
- **Coordinated disclosure:** we publish an advisory once a fix is released,
  and at the latest 90 days after your report unless we agree another date
  with you.
- **Remediation targets** from confirmation: critical 2 days, high 7 days,
  medium 30 days, low with the next minor release.

Please describe a leaked credential or token by where you found it, not by
quoting it: a quoted secret in a report is one more copy of it.

## Supported versions

Until 1.0.0 only the newest release receives fixes.

## What is in scope

- the site shell as it runs: every route of `scripts/site-pages.txt`, its
  CSP and headers, the consent and analytics code, the location choice (the
  browser position is rounded on the device; an IP lookup is never stored);
- the container image as published, including `/srv/site-static/*` and
  `/app/scripts/geoip-build.mjs`;
- the boundary: the shell reads no database (`scripts/check_web_boundary.sh`).

The digest that renders the fragments, the MCP server and the status console
are viafrei's; the edge and nginx are viafrei-infra's. Report those there.

## Automated checks

To save CI minutes, nothing runs on a schedule, a pull request
that changes prose only (`*.md`, `docs/`) skips every job but the one that decides so, and on
`main` only the merge commit of a release pull request runs the full set (the release gate reads
its jobs). Everything is run locally before the one push.

| Check | Workflow | Runs on |
|---|---|---|
| type checking, linting, shell syntax, actionlint | CI (Lint) | every pull request, every push to `main` |
| unit tests, with coverage | CI | every pull request, a release's merge commit |
| contrast, boundary, static pages, the pins | CI (Site gates) | every pull request, a release's merge commit |
| the i18n mutation proof | CI (Site gates) | a minor's release pull request, a dispatch |
| the browser suite, page weight, latency | CI (Web) | every pull request, a release's merge commit |
| visual, Lighthouse | CI (Web) | a minor's release pull request, a dispatch |
| Trivy over the image, the image smoke | CI (Image) | every pull request, a release's merge commit |
| the shell against the pinned releases | CI (Stack) | every pull request, a release's merge commit |
| SonarCloud | CI | every pull request, a release's merge commit |
| CodeQL (SAST), Snyk, gitleaks, OWASP ZAP (DAST) | Security | every pull request, a release's merge commit |
| dependency licences | Security | every pull request, every push to `main` |
| dependency review | Security | pull requests only |
| OpenSSF Scorecard | Scorecard | by hand only |

A new advisory against an unchanged tree is found by Dependabot (monthly) and by a dispatch of
Security, not by a schedule.

**What CodeQL reads.** Every source file except the test suites: `packages/*/test/` and
`packages/web/e2e/` are left out (`.github/codeql/codeql-config.yml`), because no test file reaches
the image — it ships the built `packages/web/dist` alone — and the security queries there flag
assertion code, not a reachable path. `packages/*/src` (the design package's test helpers in
`src/testing/` included), `packages/web/scripts/`, `scripts/` and the root `test/` are analysed.

**What gitleaks allows.** `.gitleaks.toml` keeps every default rule and makes one exception: the
`generic-api-key` rule, in three named test files, for a literal that is the hexadecimal digits in
order — the test IndexNow and staging keys, which are no service's keys. On a pull request the base
revision's copy judges, so a pull request cannot widen it, and a `.gitleaksignore` is refused.

Dependabot proposes updates monthly, after a seven-day cooldown, for npm, the actions
(each pinned by commit SHA), the Dockerfile's base image and the compose
file. A TypeScript release at or above typescript-eslint's supported upper
bound (today 6.1.0) is not proposed; `test/workflows.test.ts` keeps the bound
equal to that range.

### What a public CI log can carry

The tests run against the pinned viafrei-app release, extracted into `.pinned/` (never committed).
That is private compiled code, and some tests assert on its source text: a FAILING assertion of
that kind prints the text it compared, into a CI log that anyone can read on this public
repository. Coverage is limited to `packages/**` and leaves `.pinned/` out, and the uploaded
artifacts (coverage, visual baselines, the ZAP report) are kept one day. A failing source-text
assertion is still printed in full; read such a failure, and fix it, without quoting the code
it shows.

### Images bumped by hand

Pinned by digest inside a `run:` line, a script or the compose file where
Dependabot does not look (`test/workflows.test.ts` refuses one without a
digest):

| Image | Used by | Where it is pinned |
|---|---|---|
| `rhysd/actionlint` | the Lint job | `.github/workflows/ci.yml` |
| `aquasec/trivy` | the image scan | `.github/workflows/ci.yml` |
| `zricethezav/gitleaks` | the history scan | `.github/workflows/security.yml` |
| `zaproxy/zap-stable` | the DAST scan | `scripts/zap-scan.sh` |
| `postgis/postgis` | the stack's throwaway database | `docker-compose.yml` |

The two ViaFrei images the stack runs are pinned in `images.pin`
([RELEASING](docs/RELEASING.md#the-pins-imagespin)).

Release images are signed with cosign (keyless) and carry a build-provenance
attestation and an SPDX SBOM; [RELEASING](docs/RELEASING.md) shows how to
verify them. An image that does not verify against that identity, or whose
signing commit is not on `main`, is not ours.

## Release tags

The release workflow always runs on a tag, as it is in the tagged commit, and
its certificate names `release.yml@refs/tags/vX.Y.Z`. The tag rulesets
([RELEASING](docs/RELEASING.md#tag-rulesets-applied-once-by-a-repository-admin-no-workflow-applies-them))
keep a `v*` tag from being moved or deleted, and the gate refuses a tag whose
commit is not on `main` or is not the commit the run was started for.
Before an image is built, `scripts/ghcr-not-released.sh` asks the registry
whether `:X.Y.Z` already exists, and asks again before tagging.
