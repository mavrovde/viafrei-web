# viafrei-web

The ViaFrei user interface: the public website viafrei.de and the building blocks every ViaFrei page is made of.

## The ViaFrei projects

ViaFrei is a group of private repositories, each with its own area. The database is the only interface between the data and the services; a change that crosses an area is an issue in the project that owns it.

| project | area |
|---|---|
| [viafrei](https://github.com/mavrovde/viafrei) | the product core: the MCP server (the product), the digest (the live fragments the site embeds) and the status console |
| **viafrei-web** (this one) | the UI: the viafrei.de site shell, the design system and the UI gates |
| [viafrei-database](https://github.com/mavrovde/viafrei-database) | the schema and its changes: migrations, partitions, roles and grants, views, the throwaway test database |
| [viafrei-ingestor](https://github.com/mavrovde/viafrei-ingestor) | collects open data and writes it into the shared domain tables |
| [viafrei-infra](https://github.com/mavrovde/viafrei-infra) | runs everything: Kubernetes, the host, the edge, deploys, backups and monitoring |

Several areas still live in `viafrei` and move out step by step: the UI to viafrei-web ([viafrei-web#1](https://github.com/mavrovde/viafrei-web/issues/1)), the database code to viafrei-database ([viafrei-database#1](https://github.com/mavrovde/viafrei-database/issues/1)), and the collectors and runtime already moved to viafrei-ingestor and viafrei-infra are removed from viafrei afterwards ([viafrei#1298](https://github.com/mavrovde/viafrei/issues/1298)).

## What this project owns

- **The site shell** (today `packages/web` in viafrei): Astro SSR with Svelte islands.
  - every page of the page map, every language, place pages, the News page, sitemaps, robots.txt and the AI-reader files;
  - consent and analytics, the CSP middleware, location choice.
- **The design system** (today `packages/design`):
  - the tokens and their contrast gate;
  - the typed UI building blocks, shared with the status console.
- **The UI gates:** the copy-deck parity across languages, contrast, the visual baselines, the end-to-end and Lighthouse runs, and the page-weight budget.

## What it does not own

- **The data:** the shell reads no database. It embeds the digest's fragments over the internal network; the digest stays in viafrei.
- **The edge and the nginx routing:** viafrei-infra. The site's route map is the contract between the two.
- **The MCP server and its tools:** viafrei.

## Open boundary questions (decided in the tracking issue)

- Do the digest's HTML fragments (tile, place card and motorway templates) move here as presentation, with the digest keeping only its queries?
- Do the status console's pages move here, or stay with the status service?

## Status

Created 2026-11-13. The UI code still lives in the viafrei repository (`packages/web`, `packages/design` and the web gates under `scripts/`). It moves here according to the tracking issue, and is removed from viafrei once this project ships it.
