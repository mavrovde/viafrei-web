# Phase 0 spikes — measured 2026-10-03 (#376 PR-01)

Three questions the 1.6 architecture (#375 A1, A6, A8, A9) depends on, each
answered by a number against its threshold, each reproducible by the command
beside it. All three **PASS**; no fallback is recorded.

Toolchain: astro 7.3.5, @astrojs/node 11.1.6, @astrojs/svelte 9.0.1,
svelte 5.57.1, playwright 1.63.0 (Chromium headless shell 153), Node 22 in the
image (`node:22-alpine`), Node 26.10 on the measuring laptop, Docker Desktop
on macOS.

## S1 — image: the web bundle ships in the production image

**Threshold:** `scripts/check_image_deps.sh` green with the web entry as a
runtime entry of the reachability walk; image growth ≤ 40 MB; `node
dist/server/entry.mjs` healthy ≤ 2 s; idle RSS ≤ 150 MB.

**What changed to measure it (the one Dockerfile change of this phase):**
the build stage copies `packages/web/package.json`, runs `npm run build -w
@viafrei/web` after `tsc -b` and the test/declaration sweep; the runtime stage
copies `packages/web/package.json` (devDependencies only, so `npm ci
--omit=dev` installs nothing for it) and `COPY --from=build
/app/packages/web/dist`. No compose service, no nginx location, no CI deploy
change — the web process is reachable by nobody until PR-04/PR-13.

| measurement | number | threshold | verdict |
|---|---|---|---|
| image size, `origin/main` (v1.5.9) built from `git archive` | 356 795 737 B | — | baseline |
| image size with the web bundle | 358 913 679 B | | |
| **growth** | **+2 117 942 B (+2.1 MB)** | ≤ 40 MB | **PASS** |
| `dist/` on disk (server 1.3 MB bundled, client 44 KB) | 1.3 MB | — | |
| time from `docker run` to the first `200` on `/de` | **0.38 s** | ≤ 2 s | **PASS** |
| idle RSS of the node process after 3 s (`/proc/<pid>/status` in the container) | **88.6 MB** | ≤ 150 MB | **PASS** |
| idle container memory (`docker stats`) | 28.5 MiB | — | |
| `bash scripts/check_image_deps.sh viafrei/app:local` | **53 passed, 0 failed** | green | **PASS** |
| of which: reachability | 297 of 297 shipped .js/.mjs reachable; 35 allow-listed by name, 3 by directory | | |

Commands:

```bash
git archive --format=tar origin/main | docker build -q -t viafrei/app:base -
docker build -q -t viafrei/app:local .
docker image inspect viafrei/app:base viafrei/app:local --format '{{.RepoTags}} {{.Size}}'
docker run -d --name s1 -p 127.0.0.1:8794:8792 -e HOST=0.0.0.0 -e PORT=8792 viafrei/app:local \
  node packages/web/dist/server/entry.mjs      # then poll http://127.0.0.1:8794/de until 200
docker exec s1 sh -c 'grep VmRSS /proc/7/status'
bash scripts/check_image_deps.sh viafrei/app:local
```

**What the gate had to learn, and why (the `check_image_deps.sh` experiment
#376 allows):**

- The runtime entries the parser reads were the ten of the Dockerfile CMD and
  the prod compose when S1 was measured (#376 says "tenth" because it was
  written before v1.5.5 added the zHV fetch); the web entry was named in the
  gate and handed to the walk as an extra root. **Since PR-04 (#378) the prod
  compose runs the `web` service**, so the parser reads the entry out of it as
  the eleventh runtime command (`EXPECTED_ENTRIES=11`, extension set
  `js|mjs|ts`) and §4b keeps only what the walk cannot see: the stylesheet
  shipped, nothing of astro/svelte/@astrojs in the runtime.
- The shipped set is `.js` **and `.mjs`** now; a set that stopped at `.js`
  judged none of the bundle.
- `dist/client/` (the stylesheet, the island's two modules) is a DIRECTORY
  exemption with a reason, asserted used: hashed names cannot be allow-listed
  by name.
- The walker reads TEXT, and Astro's server bundle carries text that is not an
  import: the browser island runtime embedded as a string (`import(e)` is
  browser code) and a bundled dependency's JSDoc `import('./types.js')`. Both
  are scoped to `packages/web/dist/server/` by an exemption that is asserted
  used AND made safe by a new assertion that every `.mjs` under that
  directory is in the closure from the entry (it is: all of them) — so a miss
  the walker makes inside the bundle cannot hide a dead file.
- Three new positive assertions: the web entry ships, the one stylesheet ships
  under `dist/client/_a/`, and nothing of `astro`, `svelte` or `@astrojs` is
  installed in the runtime (`vite.ssr.noExternal: true` did what it promises).

**Fallback (not needed):** a static Astro build on the existing `landing`
nginx with the live tiles included from digest fragments through SSI (#375
A9). Not recorded as the branch; PR-04 follows the SSR branch.

## S2 — CSP + CSS: one external stylesheet under the no-script policy

**Threshold:** the page renders under `default-src 'none'; style-src 'self';
img-src 'self'; script-src 'none'` with zero console CSP errors in Playwright;
the stylesheet is ONE external file at `/_a/site.<hash>.css`, immutable.

| measurement | number | verdict |
|---|---|---|
| CSP header on `/de` and `/en` without a tag | `default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; style-src 'self'; img-src 'self'; script-src 'none'` | the four required directives present |
| console CSP errors, `/de` and `/en`, Chromium | **0** | **PASS** |
| `<link rel="stylesheet">` elements | **1**, `/_a/site.D19PPp5a.css` (hash per build) | **PASS** |
| `Cache-Control` on the stylesheet (set by the node adapter for `build.assets`) | `public, max-age=31536000, immutable` | **PASS** |
| `[style]` attributes / `<style>` elements / `<script>` elements | 0 / 0 / 0 | |
| requests to this origin for the home | **2** (document + stylesheet; the favicon is not requested by Chromium headless) | A8 ≤ 2 |
| document, raw / gzip | 25 482 B / 5 859 B (DE); 24 928 B / 5 667 B (EN) | #138 ≤ 100 KB raw |
| stylesheet, raw / gzip | 20 KB / 4 658 B | |
| **transfer per page, gzip** | **≈ 10.5 KB** | D2 < 60 KB, **PASS** |

The three hardening directives beyond the four the issue names (`base-uri`,
`form-action`, `frame-ancestors`) are the digest's and cost nothing. Asserted
by `e2e/csp.e2e.ts` (S2 block, 6 tests) on every `npm run web:test`.

## S3 — the consent island: the only script, only with a tag

**Threshold:** one Svelte island (`Consent.svelte`) under `script-src
'nonce-…' https://www.googletagmanager.com` only when `GOOGLE_TAG` is set,
mirroring the digest's `contentSecurityPolicy()`; with no tag, zero `<script>`
elements; both cases asserted by a test.

| measurement | number | verdict |
|---|---|---|
| no tag: `<script>` elements in the document | **0**; no `astro-island`, no `googletagmanager` string | **PASS** |
| tag set: CSP header | `script-src 'nonce-<22 chars>' 'strict-dynamic' https://www.googletagmanager.com; style-src 'self' 'nonce-…'; connect-src <the digest's four Google origins>; img-src 'self' https://www.google-analytics.com` | |
| tag set: scripts on the page, all carrying the header's nonce | **2 inline** (Astro's `client:load` directive, the island runtime) + the island's two modules loaded by it | **PASS** |
| tag set: console CSP errors before and after consent | **0** | **PASS** |
| Google requests before the accept click | **0** | GA rule 1 |
| Google requests after accept (intercepted by Playwright, never sent) | **1** (`/gtag/js?id=…`) | |
| Google requests after decline, and after reload (remembered) | **0** | GA rule 1 |
| decline and accept buttons | same height, same width (grid, two equal columns) | GA rule 1 |

**The one deviation from the issue's literal policy, and why it is right:**
the header carries **`'strict-dynamic'`** beside the nonce and the origin.
Astro hydrates an island through an inline runtime script that then loads the
component and the renderer as ES modules from this origin (`/_a/Consent.<hash>.js`,
`/_a/client.svelte.<hash>.js`); under a nonce-only policy those two loads need
`'self'`, which the GA rules forbid ("nonce plus the googletagmanager origin
only"). `'strict-dynamic'` extends the nonce's trust to what the nonce'd script
loads — and to nothing else — so the policy stays closed to `'self'`. Browsers
that honour `'strict-dynamic'` ignore the host allow-list; the origin is kept
beside it so the policy reads as the digest's and so an old CSP2 browser still
has it. Astro also emits `astro-island{display:contents}` as an inline
`<style>`; the middleware writes the nonce onto it and `style-src` carries the
same nonce in the tag case only. Both are in `src/security/csp.ts` with this
reasoning, and the digest's policy is unchanged.

**Why the nonce is written by the middleware and not by a template:** Astro
emits the island runtime for us; no template owns that `<script>`. The
middleware mints a nonce per request, sets the header, and rewrites `<script`
and `<style` openings on the HTML on its way out — only when a tag is set, so
the no-tag page is streamed through untouched.

Asserted by `e2e/csp.e2e.ts` (S3 block, 3 tests) on every `npm run web:test`
— two real servers from `dist/`, one Chromium, every Google host answered by
Playwright's router so no test reaches the network.

## How to reproduce all three

```bash
npm run web:build                                  # astro build → packages/web/dist
npm run web:test                                   # builds, then e2e/csp.e2e.ts: 10 tests
npx tsx packages/web/scripts/preview-shots.ts      # the eight screenshots, console asserted silent
bash scripts/ci-local.sh image                     # Dockerfile build + check_image_deps.sh
```
