# viafrei-web

The ViaFrei user interface: the public website viafrei.de and the building blocks every ViaFrei page is made of.

## The ViaFrei projects

ViaFrei is a group of private repositories, each with its own area. The database is the only interface between the data and the services; a change that crosses an area is an issue in the project that owns it.

| project | area |
|---|---|
| [viafrei](https://github.com/mavrovde/viafrei) | the product core: the MCP server (the product), the digest (the live fragments the site embeds) and the status console |
| **viafrei-web** (this one) | the UI: the viafrei.de site shell, the design system and the UI gates |
| [viafrei-database](https://github.com/mavrovde/viafrei-database) | the schema and its changes: migrations, partitions and their retention, roles and grants, views, the throwaway test database |
| [viafrei-ingestor](https://github.com/mavrovde/viafrei-ingestor) | collects open data and writes it into the shared domain tables |
| [viafrei-infra](https://github.com/mavrovde/viafrei-infra) | runs everything: Kubernetes, the host, the edge, deploys, backups and monitoring |

Several areas still live in `viafrei` and move out step by step. The database code moves to viafrei-database ([viafrei-database#1](https://github.com/mavrovde/viafrei-database/issues/1)). The UI has moved here ([viafrei-web#2](https://github.com/mavrovde/viafrei-web/issues/2)). The collectors and runtime have already moved to viafrei-ingestor and viafrei-infra; their old copies in viafrei are removed in [viafrei#1298](https://github.com/mavrovde/viafrei/issues/1298).

## What this project owns

- **The site shell** (`packages/web`): Astro SSR with Svelte islands.
  - every page of the page map, in every language: place pages, the News page, sitemaps,
    robots.txt and the AI-reader files;
  - consent and analytics, the CSP middleware and the location choice.
- **The design tokens and building blocks the site uses** (`packages/design`).
  - This is a copy. The status console in viafrei keeps its own.
  - It is not published as a package.
- **The static pages infra serves when the shell cannot answer:** the nginx fallback and the owner
  preview. They live in `packages/web/static/`, and in the image at
  `/srv/site-static/{fallback,preview}/index.html`.
- **The route map `scripts/site-pages.txt`**, generated from the page map. It is shipped in the
  image at `/srv/site-static/site-pages.txt`, and as an asset of every release.
- **The GeoIP builder `scripts/geoip-build.mjs`**, shipped in the image at
  `/app/scripts/geoip-build.mjs`.
- **The UI gates:**
  - copy-deck parity, contrast and the boundary;
  - the static pages and the visual baselines;
  - the browser suite, Lighthouse, latency and the page-weight budget.

## What it does not own

- **The data.** The shell reads no database. It embeds the digest's fragments over the internal
  network, and the digest stays in viafrei.
- **The edge and the nginx routing.** These belong to viafrei-infra. The route map is the contract
  between the two.
- **The MCP server, its tools and the status console.** These belong to viafrei.

## The image

The image is `ghcr.io/mavrovde/viafrei-web:X.Y.Z`.

- It is built for amd64 and arm64.
- It is signed with cosign (keyless), with SLSA provenance and an SPDX SBOM.
- It is released only from a confirmed `vX.Y.Z` tag. There are no edge or sha tags (see
  [docs/RELEASING.md](docs/RELEASING.md)).

| | |
|---|---|
| port | 8792 (`PORT`); the health check is `/healthz` |
| user | uid 10001; it runs with a read-only root, and has no npm |
| reads | `DIGEST_URL` (the digest's internal base URL), `APP_VERSION`, `APP_BUILT_AT` and the `IMPRESSUM_*` identity. Without the identity, the legal pages answer 500 |
| ships | `/app/packages/web/dist`, `/app/scripts/geoip-build.mjs`, `/srv/site-static/{fallback,preview}/index.html`, `/srv/site-static/site-pages.txt` |

To build the GeoIP file with the image, with no network:

```bash
gunzip -c dbip-city-lite-YYYY-MM.csv.gz | docker run --rm -i --network none -v "$PWD/out:/out" \
  ghcr.io/mavrovde/viafrei-web:X.Y.Z node /app/scripts/geoip-build.mjs --release YYYY-MM --out /out/geoip.vfgeo
```

## What it depends on

It depends on released images only, pinned in `images.pin`:

| key | image | used for |
|---|---|---|
| `digest` | `ghcr.io/mavrovde/viafrei-app:2.6.17` | the digest service the stack runs, and its compiled packages for the tests |
| `database` | `ghcr.io/mavrovde/viafrei-database:0.1.1` | migrating the stack's throwaway database |

## Working on it

[CONTRIBUTING.md](CONTRIBUTING.md) has the commands.

1. Run `npm ci && npm run pinned`.
2. Run `npm run typecheck`, `npm run lint` and `npm test`.
3. Run `bash scripts/stack-smoke.sh` to try the shell against the pinned releases.

## Status

- The shell moved here from viafrei at `ea91377ba` (release/2.6.18), under
  [viafrei-web#2](https://github.com/mavrovde/viafrei-web/issues/2).
- [docs/moved-from-viafrei.md](docs/moved-from-viafrei.md) lists every path, and what could not
  move yet.
- viafrei removes its copy once this repository ships a release and infra runs it
  ([viafrei-infra#31](https://github.com/mavrovde/viafrei-infra/issues/31)).
