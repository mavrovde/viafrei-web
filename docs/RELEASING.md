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
  -> CI and Security succeed on that commit (the newest run of each, a push to main)
  -> a draft GitHub release, then the annotated tag vX.Y.Z on that commit
     (CI and Security checked again first; an existing tag is refused, never moved)
  -> release.yml, started on that tag:
     gate -> build linux/amd64 + linux/arm64 -> checks of the image -> push by digest
     -> cosign sign (keyless) -> SLSA build provenance -> SPDX SBOM
     -> verify (pull, cosign verify, both attestations against the tag's commit, boot, /healthz)
     -> only then :X.Y.Z, :X.Y (newest patch of its minor) and :latest (newest tag)
  -> the release page: site-pages.txt uploaded as an asset and read back, then published with
     the digest and the commands to verify it
```

There is no `edge` image, no image for a branch, a commit or a pull request, and no `sha-…` tag.
A tag whose commit is not on `main`, whose version is not `package.json`'s, that has a suffix
(`-rc.1`) or that is lightweight publishes nothing.

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
- **The fault is in the tagged commit:** fix it on `main` and release a new patch.

Rollback is infra's: it deploys the previous digest (viafrei-infra). This repository never
re-tags an older image as `latest`.

## What runs, and when (owner 2026-11-15: GitHub by minimum)

Everything is verified locally before the single push, and nothing is pushed to re-run CI.

| workflow | triggers | what runs |
|---|---|---|
| CI | `pull_request` and `push` to `main`, both ignoring prose; `workflow_dispatch` | on a pull request every job. On `main` only `Lint`, unless the commit is a release's merge (`chore: release X.Y.Z`), which runs every job. Visual, Lighthouse and the i18n mutations only on a dispatch or a minor's release pull request (`X.Y.0`) |
| Security | the same | on `main` only `Dependency licences`, unless it is a release's merge |
| Release Please | `workflow_run` of CI and Security on `main`, `workflow_dispatch` | the release pull request, the draft, the tag |
| Release | `push` of a `v*` tag, `workflow_dispatch` on a tag | the gate, then the publish |
| Scorecard | `workflow_dispatch` only | |

No workflow has a `schedule`. CI and Security cancel a pull request's older run
(`cancel-in-progress`). Dependabot opens its pull requests monthly.

The push to `main` stays because the release gate (`scripts/ci-gate.ts`) requires CI and Security
to have concluded success on the release's own merge commit, and Release Please starts from their
completion; on any other merge they run `Lint` and `Dependency licences` alone.

## Branch protection and required checks

`main` is protected: a pull request, squash merge, linear history, no force push, no deletion,
0 approving reviews (the release pull request is opened by the workflow's token), and these checks
required by name:

<!-- required-checks:begin -->
- `Lint`
- `Unit tests`
- `Site gates`
- `Web (the site shell, built and judged)`
- `Image (build, scan, smoke)`
- `Stack (the shell against the pinned releases)`
- `CodeQL (TypeScript)`
- `Dependency review`
- `Dependency licences`
- `Secrets in history (gitleaks)`
- `DAST (OWASP ZAP against the container)`
<!-- required-checks:end -->

`test/workflows.test.ts` holds this list to the jobs that exist.

A pull request that changes prose only (`*.md`, `docs/`, the issue templates) runs no workflow, so
its required checks never report: it is merged with the administrator's bypass, which is the
cost of not spending runs on prose. `SonarCloud analysis`, `Snyk
(dependencies)` and `Scorecard analysis` run and report but are not required: each depends on an
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
    { "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always" },
    { "actor_id": 15368, "actor_type": "Integration", "bypass_mode": "always" }
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

## Owner setup, once

- **Actions may create pull requests** (Settings, Actions, General, Workflow permissions).
- **Read access to `viafrei-app`.** The CI jobs that pull the pinned digest image log in with the
  workflow's `GITHUB_TOKEN`; the `viafrei-app` package (private) must grant this repository
  read access (Package settings, Manage Actions access). `viafrei-database` is public.
- **Secrets:** `SONAR_TOKEN` and `SNYK_TOKEN`, each also as a Dependabot secret. A missing token
  fails its job with a message naming the secret; it never passes as a skip.
- **SonarCloud:** project `mavrovde_viafrei-web` in organisation `mavrovde`, automatic analysis off.
- **The rulesets above, and branch protection with the required checks.**

## The pins (`images.pin`)

`images.pin` is the one file naming the released images this repository depends on, each by
version tag AND digest:

- `digest`: the viafrei-app image whose digest service renders the fragments the shell embeds;
  its compiled packages are also what the tests import (`scripts/pinned-app.sh`).
- `database`: the viafrei-database image that migrates the stack's throwaway database.

To bump one: replace the line with the new `X.Y.Z@sha256:<digest>` (read with
`docker buildx imagetools inspect ghcr.io/mavrovde/<image>:X.Y.Z`), then run
`bash scripts/pins.sh lint`, `bash scripts/pins.sh check`, `npm run pinned`, `npm test` and
`bash scripts/stack-smoke.sh`. Un-skip any `pin-skew` case the new image settles, and update the
skips table in `docs/moved-from-viafrei.md` (`test/moved.test.ts` holds the two equal). A pin is
never `latest`, `edge` or a bare tag: `pins.sh lint` refuses each.

## Visual baselines

The visual test compares screenshots against `packages/web/e2e/__screenshots__/linux/`. They are
recorded on Linux only, in the Playwright container (the e2e-arm image; on a laptop, never install
a browser), and CI's `Web` job runs the same image. To re-record after an intended change:

```bash
npm run web:build
# inside the Playwright container, with the repository mounted:
npm run web:visual -- --update   # writes packages/web/e2e/__screenshots__/linux/
```

and commit the changed PNGs in the same pull request as the change, saying why each moved. The comparison runs on a dispatch of CI and on a minor's release pull request; a
`workflow_dispatch` of CI uploads the screenshots it took when the comparison fails.
