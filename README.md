# viafrei-web

The ViaFrei user interface: the public website viafrei.de and the building blocks every ViaFrei page is made of.

ViaFrei is a group of projects. Each one has its own area, and **the database is the only interface between the data and the services**.

| project | area |
|---|---|
| **viafrei-web** (this one) | the UI: the site shell, its pages, languages and islands, the design system, the visual and accessibility gates |
| viafrei | the product core: the MCP server, the digest (the live fragments the site embeds) and the status console |
| viafrei-database | the schema and its changes: migrations, partitions, roles and grants, views |
| viafrei-ingestor | collects open data and writes it into the shared domain tables |
| viafrei-infra | runs everything: Kubernetes, the host, the edge, deploys, backups and monitoring |

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
