# Contributing

This repository holds two things:

- the viafrei.de site shell (`packages/web`);
- the copy of the design tokens and building blocks the shell is made of (`packages/design`).

Changes reach `main` through a pull request with green checks. `main` is squash-merged and linear.

A pull request from a fork cannot read the repository's secrets, `GHCR_READ_TOKEN` among them, so
its `Lint`, `Unit tests`, `Site gates`, `Web` and `Stack` jobs fail on the pull of the private
viafrei-app image (each says `GHCR_READ_TOKEN must be set`). That is not a fault in the change: a
maintainer re-runs it by pushing the same commits to a branch of this repository and opening the
pull request from there.

## Running it

You need Node 26 (CI and the image run 26.12.1), and Docker for the image and the stack.

The tests import the compiled packages of the pinned viafrei-app image. So `npm run pinned`
extracts that image into `.pinned/` first. It needs a registry login that can read
`ghcr.io/mavrovde/viafrei-app`.

```bash
npm ci
npm run pinned
npm run typecheck && npm run lint && npm test
npm run gates && bash scripts/check_static_pages.sh && bash scripts/web-i18n-mutation.sh
bash scripts/check_lastmod_commits.sh && bash scripts/changes.test.sh
bash scripts/pins.sh lint && bash scripts/pins.test.sh
docker build -t viafrei-web:local . && IMAGE=viafrei-web:local bash scripts/image-smoke.sh
bash scripts/stack-smoke.sh && bash scripts/stack.sh down
```

The browser suite, the visual comparison and Lighthouse run on Linux only, in the Playwright
container. On a laptop, never install a browser. On macOS the visual test prints `DID NOT RUN` and
proves nothing either way. To compare against the baselines, or re-record them after an intended
change, run it in the container (amd64, the image CI uses):

```bash
bash scripts/visual-container.sh            # compare
bash scripts/visual-container.sh --update   # re-record packages/web/e2e/__screenshots__/linux/
```

In CI the browser suite, the visual comparison, Lighthouse, latency and the page-weight budget run
once per release, in release.yml's `Web` job before the image is published, and on no pull request
or push, so a page change is checked here, in the container, before the push (see
[RELEASING](docs/RELEASING.md#visual-baselines)). `gh workflow run release.yml --ref <branch>`
runs that job alone on a branch and publishes nothing.

## Rules the gates hold

- **The shell reads no database** (`scripts/check_web_boundary.sh`). Live content comes from the
  digest's fragments over the internal network; that the edge routes nothing under `/internal` is
  viafrei-infra's rule.
- **The lastmod map changes only at a release** (`scripts/check_lastmod_commits.sh`; see
  [RELEASING](docs/RELEASING.md#the-lastmod-map-at-the-cut)).
- **Every colour pair is declared and passes the contrast check** in both themes: 4.5:1, and 7:1
  for body text (`scripts/web-contrast.mjs` over `packages/design/tokens.css`).
- **Every catalogue has every key in every language** (`packages/web/test/i18n-parity.test.ts`).
  `scripts/web-i18n-mutation.sh` proves that check can fail.
- **`scripts/site-pages.txt` is generated** from `packages/web/src/site/pages.ts` by
  `packages/web/scripts/site-map.ts`. If the file drifts from the page map, `site-map.test.ts`
  fails.
- **The static pages** in `packages/web/static/` follow `scripts/check_static_pages.sh`:
  - one sentence;
  - both legal links;
  - no script and no external asset;
  - at most 4096 bytes.
- **Every skipped test carries its reason** (`cross-repo(<repo>)` or `pin-skew`), and has a row in
  `docs/moved-from-viafrei.md`. `test/moved.test.ts` checks both.
- **Every action is pinned by commit SHA, and every third-party image by digest**
  (`test/workflows.test.ts`).

`packages/design` is a copy, and the status console in viafrei keeps its own. A change to a token
here changes the site only.

## Pull requests

- **One topic per pull request**, with a Conventional Commit title (`feat:`, `fix:`, `docs:`,
  `deps:`, `ci:`…).
  - The squashed title becomes the commit on `main`.
  - release-please reads those commits to choose the next version (see
    [RELEASING](docs/RELEASING.md#version-rules)).
- **Do not edit by hand** a released section of `CHANGELOG.md` or the version in `package.json`.
  The release pull request writes both.
- **Say so in the body, with the route diff,** when a change alters what a visitor or infra sees:
  a route, a status code, the static pages, an image path or an environment variable.
- **Re-record the visual baselines** in the same pull request when a page changes. Do it in the
  Playwright container.
- **Never put a real credential, host, address or production figure** in a commit, a comment or a
  test fixture. The secret scan reads the whole history.

## Releases

See [docs/RELEASING.md](docs/RELEASING.md).
