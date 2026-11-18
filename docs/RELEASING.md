# Releasing

This repository publishes one thing: the image `ghcr.io/mavrovde/viafrei-web`, the viafrei.de
site shell. It is released the way viafrei-database is (its `release.yml`, `release-please.yml`,
`scripts/ci-gate.ts`, `scripts/ghcr-not-released.sh` and `scripts/approve-release-runs.sh` were
copied, and only the image, the identity and the checks of the image differ). Nothing is published
to npm: `@viafrei/web` and `@viafrei/design` are private workspaces.

## How a release happens

```text
a Conventional Commit lands on main
  -> release-please keeps a release pull request open: package.json's version, CHANGELOG.md
merge of the release pull request into main
  -> CI and Security succeed on that commit (the newest run of each, a push to main), and every
     required job of each ran and passed: a run of skipped jobs concludes success too, so the run
     alone is not evidence (scripts/ci-gate.sh reads its jobs)
  -> a draft GitHub release, then the annotated tag vX.Y.Z on that commit
     (CI and Security checked again first; an existing tag is refused, never moved)
  -> release.yml, started on that tag:
     gate -> the browser job (Web: build, browser suite, page weight, Lighthouse, latency, visual)
     -> build linux/amd64 + linux/arm64 -> checks of the image -> push by digest
     -> cosign sign (keyless) -> SLSA build provenance -> SPDX SBOM
     -> verify (pull, cosign verify, both attestations against the tag's commit, boot, /healthz)
     -> only then :X.Y.Z, :X.Y (newest patch of its minor) and :latest (newest tag)
  -> the release page: site-pages.txt uploaded as an asset and read back, then published with
     the digest and the commands to verify it
```

There is no `edge` image, no image for a branch, a commit or a pull request, and no `sha-…` tag.
A tag whose commit is not on `main`, whose version is not `package.json`'s, that has a suffix
(`-rc.1`) or that is lightweight publishes nothing.

The browser suite runs here and nowhere else in CI: once per release, as release.yml's `Web` job,
between the gate and the publish, and `publish` needs it, so a failing page stops the signed image
before anything is built. No pull request and no push to `main` runs it; it is run locally, in the
Playwright container, before the push. To run it by hand on a branch:
`gh workflow run release.yml --ref <branch>` runs the `Web` job alone on that branch's commit and
publishes nothing (the gate skips every release check, and `publish` does not run).

### The checks of the image (release.yml, before the push)

- the OCI `version` label equals the tag, the `revision` label the tag's commit;
- `/srv/site-static/site-pages.txt` inside the image is byte-equal to `scripts/site-pages.txt`
  of the tagged commit (the route map infra probes);
- after the push, the verify job pulls the published digest and smokes it: hardening, the static
  pages, the route map, the GeoIP builder, `/healthz` and `/de`.

`scripts/image-smoke.sh` (CI `Image`) checks the rest on every pull request: uid 10001, no npm or
npx, the two static pages byte-equal to `packages/web/static/`, `geoip-build.mjs` building a
VFGEO1 file with no network, `/de` with no digest reachable, the CSP header and a 404.

### What the release carries

| artefact | where |
|---|---|
| the image | `ghcr.io/mavrovde/viafrei-web:X.Y.Z` (and `:X.Y`, `:latest`), multi-arch |
| the signature | cosign keyless, identity `release.yml@refs/tags/vX.Y.Z` of this repository |
| provenance | `actions/attest-build-provenance`, pushed to the registry |
| SBOM | SPDX JSON from `anchore/sbom-action`, attested |
| `site-pages.txt` | release asset, equal to the image's `/srv/site-static/site-pages.txt` |

Verify an image:

```bash
cosign verify ghcr.io/mavrovde/viafrei-web@sha256:<digest> \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity-regexp '^https://github\.com/mavrovde/viafrei-web/\.github/workflows/release\.yml@refs/tags/v[0-9]+\.[0-9]+\.[0-9]+$'
gh attestation verify oci://ghcr.io/mavrovde/viafrei-web@sha256:<digest> --repo mavrovde/viafrei-web \
  --signer-workflow mavrovde/viafrei-web/.github/workflows/release.yml
```

Then check that the signing commit (`.optional.githubWorkflowSha` of `cosign verify --output json`)
is on `main`: `gh api repos/mavrovde/viafrei-web/compare/main...<sha> --jq .status` must print
`identical` or `behind`.

### Version rules

While the version is `0.x`: `feat:` raises the minor, `fix:` the patch, and `feat!:` or a
`BREAKING CHANGE:` footer the minor. `docs:`, `deps:`, `ci:`, `build:`, `perf:`, `refactor:` and
`revert:` raise the patch; `test:`, `chore:` and `style:` release nothing on their own. A change
that alters what a visitor or infra sees (a route, a route's status, the static pages, the image's
paths, an environment variable) is said in the release pull request's body.

## When a release stops

A version tag is never reused, moved or deleted:

- **Nothing published yet** (no `:X.Y.Z`): `gh workflow run release.yml --ref vX.Y.Z`. The gate
  runs again in full.
- **The image is tagged, the release page is not:** `gh run rerun <run-id> --failed`.
- **The tag job failed before the tag existed:** fix the cause, `gh run rerun <run-id> --failed`.
- **The tag job failed after the tag existed:** `gh workflow run release.yml --ref vX.Y.Z`, then
  `gh workflow run release-please.yml --ref main` for the next release pull request.
- **The `Web` job failed:** nothing was built or published. A flaky run: `gh run rerun <run-id>
  --failed`. A real fault is a fault in the tagged commit (below).
- **The `Snyk` job failed:** nothing was built or published. An outage (the CLI download or
  Snyk's service): `gh run rerun <run-id> --failed`. A high or critical advisory: fix it on `main`
  and release a new patch. Snyk's free plan has a monthly test quota and `--all-projects` spends
  one test per project; an exhausted quota fails this job like an advisory.
- **The fault is in the tagged commit:** fix it on `main` and release a new patch.

Rollback is infra's: it deploys the previous digest (viafrei-infra). This repository never
re-tags an older image as `latest`.

## What runs, and when

Everything is verified locally before the single push, and nothing is pushed to re-run CI.

| workflow | triggers | what runs |
|---|---|---|
| CI | `pull_request` and `push` to `main`; `workflow_dispatch` | first the `Changes` job (`scripts/changes.sh`): when every changed file is prose, every other job is skipped. Otherwise, on a pull request every job; on `main` only `Lint`, unless the commit is a release's merge (`chore: release X.Y.Z`), which runs every job. The i18n mutations only on a dispatch or a minor's release pull request (`X.Y.0`). No browser check: that is Release's `Web` job |
| Security | the same | the same `Changes` job; on `main` only `Dependency licences`, unless it is a release's merge |
| Release Please | `workflow_run` of CI and Security on `main`, `workflow_dispatch` | the release pull request, the draft, the tag |
| Release | `push` of a `v*` tag, `workflow_dispatch` on a tag or a branch | on a tag: the gate, the `Web` job (the browser suite, page weight, Lighthouse, latency, visual), then Snyk and the publish. On a branch: the `Web` job alone, nothing published |
| Scorecard | `workflow_dispatch` only | |
| Snyk | `schedule` weekly on `main`, `workflow_dispatch` on `main`, `workflow_call` from Release | Snyk over the dependencies, SARIF to code scanning |

One workflow has a `schedule`: Snyk, weekly on `main` (Mondays 05:17 UTC). It runs again in
every release before the image is published, and never on a pull request or a push. CI and Security cancel a pull request's older run
(`cancel-in-progress`). Dependabot opens its pull requests monthly.

The push to `main` stays because the release gate (`scripts/ci-gate.ts`) requires CI and Security
to have concluded success on the release's own merge commit, and Release Please starts from their
completion; on any other merge they run `Lint` and `Dependency licences` alone.

## Branch protection and required checks

`main` is protected: a pull request, squash merge, linear history, no force push, no deletion,
0 approving reviews (the release pull request is opened by the workflow's token), and these checks
required by name:

<!-- required-checks:begin -->
- `Changes (code, or prose only)` (in both CI and Security: a broken one must not let a pull request merge untested)
- `Lint`
- `Unit tests`
- `Site gates`
- `Catalogue parity mutants` (the fan-in of the four shards; skipped, so passing, except on a minor's release pull request or a dispatch)
- `Image (build, scan, smoke)`
- `Stack (the shell against the pinned releases)`
- `CodeQL (TypeScript)`
- `Dependency review`
- `Dependency licences`
- `Secrets in history (gitleaks)`
- `DAST (OWASP ZAP against the container)`
<!-- required-checks:end -->

`test/workflows.test.ts` holds this list to the jobs that exist. `Web (the site shell, built and
judged)` is not a required check: it is a job of `release.yml`, which runs on a tag, so no pull
request ever reports it, and a required check that never reports would block every merge.

A pull request that changes prose only (`*.md`, `docs/`, LICENSE, CODEOWNERS, the issue and pull
request templates) runs the `Changes` job and skips every other job; a skipped job satisfies its
required check, so it merges like any other. A prose file a test reads (`TESTED_PROSE` in
`scripts/changes.sh`, held to the tests by `test/workflows.test.ts`) counts as code. When
`changes.sh` cannot read the diff it answers "code", so an error runs the jobs rather than skipping
them. `SonarCloud analysis` and `Scorecard analysis` run and report but are not required: each depends on an
outside service whose outage must not block a merge.

### Tag rulesets (applied once by a repository admin; no workflow applies them)

```sh
gh api -X POST repos/mavrovde/viafrei-web/rulesets --input - <<'JSON'
{
  "name": "release tags",
  "target": "tag",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/tags/v*"], "exclude": [] } },
  "bypass_actors": [
    { "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always" }
  ],
  "rules": [{ "type": "update" }, { "type": "deletion" }, { "type": "non_fast_forward" }]
}
JSON
gh api -X POST repos/mavrovde/viafrei-web/rulesets --input - <<'JSON'
{
  "name": "no suffixed release tags",
  "target": "tag",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/tags/v*-*", "refs/tags/v*+*"], "exclude": [] } },
  "bypass_actors": [],
  "rules": [{ "type": "creation" }]
}
JSON
```

The one bypass is the repository's admin role. GitHub refuses an `Integration` bypass actor (the
Actions app) on a repository owned by a user rather than an organisation (HTTP 422), so none is
listed: the release workflow creates a tag, which the first ruleset does not restrict, and never
updates or deletes one.

## Owner setup, once

- **Actions may create pull requests** (Settings, Actions, General, Workflow permissions).
- **Read access to `viafrei-app`: `GHCR_READ_TOKEN`.** The `viafrei-app` package is private and
  belongs to another repository, so the CI jobs that pull the pinned digest image (`Lint`,
  `Unit tests`, `Site gates`, `Web`, `Stack`) log in with `GHCR_READ_TOKEN`, never with the
  workflow's `GITHUB_TOKEN`. It is a classic personal access token with the `read:packages` scope
  only and an expiry date, used for nothing but that pull, and it is set both as an Actions secret
  and as a Dependabot secret (Dependabot's pull requests read only Dependabot secrets). A missing
  token fails the job by name (`GHCR_READ_TOKEN must be set`) before anything is pulled.
  `viafrei-database` is public. Release.yml pushes and reads this repository's own image, and for
  that `GITHUB_TOKEN` is right.
- **Secrets:** `GHCR_READ_TOKEN` and `SONAR_TOKEN`, each also as a Dependabot secret, and
  `SNYK_TOKEN` as an Actions secret only (Snyk never runs on a pull request).
  A missing token fails its job with a message naming the secret; it never passes as a skip.
- **SonarCloud:** project `mavrovde_viafrei-web` in organisation `mavrovde`, automatic analysis off.
- **The rulesets above, and branch protection with the required checks.**

## The lastmod map at the cut

`packages/web/src/generated/lastmod.json` dates each page for the sitemaps. It is a release
artefact: no feature commit changes it, and at the release it must be current
(`scripts/check_lastmod_commits.sh`, run by `Site gates` on every pull request over its own
commits; on the release pull request, whose range moves the version, it also runs
`lastmod.ts --check-fresh`). Release Please rewrites its branch whenever `main` moves, so the map
is regenerated last, just before the release pull request is merged:

```bash
gh pr checkout <the release pull request>   # its branch starts release-please--
npx tsx packages/web/scripts/lastmod.ts
git commit -am "chore(release): lastmod" && git push
```

## The pins (`images.pin`)

`images.pin` is the one file naming the released images this repository depends on, each by
version tag AND digest:

- `digest`: the viafrei-app image whose digest service renders the fragments the shell embeds;
  its compiled packages are also what the tests import (`scripts/pinned-app.sh`).
- `database`: the viafrei-database image that migrates the stack's throwaway database.
- `api`: the viafrei-api release the site's API client targets. `packages/web/src/generated/api-operations.ts`
  is generated from that release's `openapi.json` asset (`api/openapi.json` at its tag) with
  `npx tsx packages/web/scripts/api-contract.ts <openapi.json> X.Y.Z`; a bump of the pin regenerates it in the
  same commit (`test/api-client.test.ts` holds the two versions equal).

To bump one: replace the line with the new `X.Y.Z@sha256:<digest>` (read with
`docker buildx imagetools inspect ghcr.io/mavrovde/<image>:X.Y.Z`), then run
`bash scripts/pins.sh lint`, `bash scripts/pins.sh check`, `npm run pinned`, `npm test` and
`bash scripts/stack-smoke.sh`. Un-skip any `pin-skew` case the new image settles, and update the
skips table in `docs/moved-from-viafrei.md` (`test/moved.test.ts` holds the two equal). A pin is
never `latest`, `edge` or a bare tag: `pins.sh lint` refuses each.

## Visual baselines

The visual test compares screenshots against `packages/web/e2e/__screenshots__/linux/`. They are
recorded on Linux only, in the amd64 Playwright container (on a laptop, never install a browser),
and release.yml's `Web` job compares against them. To re-record after an intended change:

```bash
npm run pinned
bash scripts/visual-container.sh --update   # writes packages/web/e2e/__screenshots__/linux/
```

and commit the changed PNGs in the same pull request as the change, saying why each moved. The comparison runs in CI once per release, in release.yml's `Web` job, and on a dispatch of
release.yml on a branch; a dispatched run (release-please starts every release that way) uploads
the screenshots it took when the comparison fails.
