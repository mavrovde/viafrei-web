# Working on the site

## What you need

- Node 26 (`package.json` `engines`).
- Docker, for the image, the local stack and the browser tests.
- A registry login that can read the pinned digest image (`ghcr.io/mavrovde/viafrei-app`): the
  tests import its compiled packages.

## First run

```bash
npm ci
npm run pinned        # extracts the pinned digest release into .pinned/ (never committed)
npm run typecheck
npm run lint
npm test
```

## Seeing the site

- **Against the pinned releases**, the way production runs it:

  ```bash
  bash scripts/stack.sh up      # a throwaway database, the pinned digest, and the shell built here
  bash scripts/stack.sh status
  bash scripts/stack.sh down
  ```

  `stack.sh up` prints the address the shell answers on (loopback only).
  `bash scripts/stack-smoke.sh` brings the same stack up, checks a few pages and the fragments they
  use, and says what it found.

- **While editing pages:** `npm run web:dev` starts Astro's development server. Without a digest
  running, the live blocks show their unavailable state; the rest of each page renders.

## Changing things

| you change | also do |
|---|---|
| words on a page | change the same key in every catalogue under `packages/web/src/i18n/`; `npm test` fails when one is missing |
| a page or a language | edit `packages/web/src/site/pages.ts`, then regenerate the route map: `npx tsx packages/web/scripts/site-map.ts > scripts/site-pages.txt` |
| a colour | edit `packages/design/tokens.css` and its `@contrast` pairs; run `npm run gates` |
| the fallback or preview page | run `bash scripts/check_static_pages.sh` |
| how a page looks | compare the screenshots in the container: `bash scripts/visual-container.sh` (and `--update` to re-record an intended change) |
| an inline script | `npm run web:inline` regenerates its minified copy (`packages/web/src/generated/inline-scripts.json`); `npm test` fails while it is stale |

The page dates of the sitemaps (`packages/web/src/generated/lastmod.json`) are regenerated only at
a release; leave that file out of ordinary changes (see [RELEASING](RELEASING.md#the-lastmod-map-at-the-cut)).

## Tests

- `npm test`: the unit tests of both packages.
- `npm run coverage`: the same, with a coverage report for `packages/`.
- The browser suite (`npm run web:e2e`), the visual comparison and Lighthouse run on Linux in the
  Playwright container, never with a browser installed on a laptop. CI runs them in its `Web` job.
- Shell scripts carry their own self-tests, next to them as `*.test.sh`; run them with `bash`.

[CONTRIBUTING](../CONTRIBUTING.md) has the full list a change should pass before it is pushed, and
the rules those checks hold.

## Sending a change

Open a pull request against `main`. Commit subjects follow
[Conventional Commits](https://www.conventionalcommits.org) (`feat:`, `fix:`, `chore:`…), because
Release Please writes the changelog and the version from them. CI runs every check on the pull
request; a pull request that changes only prose runs one short job instead.
