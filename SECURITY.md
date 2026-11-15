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
- the boundary: the shell reads no database and routes nothing under
  `/internal` (`scripts/check_web_boundary.sh`).

The digest that renders the fragments, the MCP server and the status console
are viafrei's; the edge and nginx are viafrei-infra's. Report those there.

## Automated checks

| Check | Workflow | Runs on |
|---|---|---|
| type checking, linting, shell syntax, actionlint | CI | every pull request and every push to `main` |
| unit tests, with coverage | CI | every pull request and every push to `main` |
| contrast, boundary, static pages, the i18n mutation proof, the pins | CI (Site gates) | every pull request and every push to `main` |
| the browser suite, page weight, latency, visual | CI (Web) | every pull request and every push to `main` |
| Trivy over the image, the image smoke | CI (Image) | every pull request and every push to `main` |
| the shell against the pinned releases | CI (Stack) | every pull request and every push to `main` |
| SonarCloud | CI | every pull request and every push to `main` |
| CodeQL (SAST) | Security | every pull request, every push to `main`, and weekly |
| dependency review | Security | pull requests only |
| dependency licences | Security | every pull request, every push to `main`, and weekly |
| Snyk | Security | every pull request, every push to `main`, and weekly |
| gitleaks over the full history | Security | every pull request, every push to `main`, and weekly |
| an OWASP ZAP baseline scan against the built container (DAST) | Security | every pull request, every push to `main`, and weekly |
| OpenSSF Scorecard | Scorecard | every push to `main`, weekly, and on a branch-protection change |

Dependabot proposes updates after a seven-day cooldown for npm, the actions
(each pinned by commit SHA), the Dockerfile's base image and the compose
file. A TypeScript release at or above typescript-eslint's supported upper
bound (today 6.1.0) is not proposed; `test/workflows.test.ts` keeps the bound
equal to that range.

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
