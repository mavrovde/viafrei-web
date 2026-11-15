# How the site is built

viafrei.de is one server-rendered web application. It reads no database. Everything live on a page
(a motorway's traffic, fuel prices, departures) arrives as a small HTML fragment from another
ViaFrei service, the **digest**, and is placed into the page on the server before the page is sent.

```
browser ──► the edge (viafrei-infra) ──► the shell (this repository, port 8792)
                                              │  one request per fragment, with a deadline
                                              ▼
                                         the digest (viafrei) ──► the database (read-only role)
```

## The parts

| part | where | what it does |
|---|---|---|
| the shell | `packages/web` | an [Astro](https://astro.build) server application on Node, with [Svelte](https://svelte.dev) islands for the consent controls; the other in-page scripts are small inline scripts |
| the page map | `packages/web/src/site/pages.ts` | the one list of pages, their path in each language and their place in the navigation |
| the routes | `packages/web/src/pages/` | one file per route: the pages, the sitemaps, `robots.txt`, `llms.txt`, `/healthz` |
| the copy | `packages/web/src/i18n/*.json` | every word on the site, one catalogue per language, held equal key for key |
| the fragment client | `packages/web/src/lib/` (`tiles.ts`, `fill.ts` and their neighbours) | asks the digest for each fragment, with a deadline; a slow or broken fragment becomes that block's error state, never a broken page |
| the security headers | `packages/web/src/middleware.ts`, `packages/web/src/security/` | a Content-Security-Policy with a fresh nonce on every response |
| the location choice | `packages/web/src/location/` | which place a visitor sees first: a remembered choice, the browser's position rounded on the device, or an approximate place looked up from the IP in a local file, never stored |
| the design | `packages/design` | the colour tokens, the brand stylesheet, the icons and the building blocks (cards, pills) the pages are made of |
| the static pages | `packages/web/static/` | the one-sentence page the edge serves when the shell cannot answer, and the owner preview |

## A page, from request to response

1. The edge passes the request to the shell.
2. The middleware picks the language (the path, or the `Accept-Language` header on `/`), makes the
   nonce and sets the headers.
3. The route renders the page from the copy deck and the design's building blocks.
4. For each live block, the fragment client asks the digest for one fragment, in the page's
   language. A fragment that does not answer in time is shown as unavailable, and the rest of the
   page is unaffected.
5. The page is sent, with every inline script carrying the nonce.

## What stays outside

- **The data.** The shell holds no database connection; `scripts/check_web_boundary.sh` refuses one.
- **The edge** (TLS, routing, rate limits, caching) is viafrei-infra's. Its contract with this
  repository is the route map `scripts/site-pages.txt`, generated from the page map.
- **The digest**, which renders the fragments, lives in viafrei. Here it is a released image, pinned
  in `images.pin`, used by the tests and the local stack.

## The image

`Dockerfile` builds one image: the shell's server bundle, the static pages, the route map and the
GeoIP builder (`scripts/geoip-build.mjs`). It runs as a non-root user on a read-only root and carries
no package manager. The [README](../README.md#the-image) lists what it reads and ships;
[RELEASING](RELEASING.md) explains how it is built, signed and released.
