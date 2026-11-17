/**
 * The idle keep-alive of every HTTP server this repository starts (#1332): mcp (public and internal
 * listener), digest, status and the site shell (`packages/web/src/server/entry.ts`). ONE place, because
 * the four sit behind the same proxies and must outlast them by the same rule.
 *
 * WHY. A keep-alive connection that carries nothing is closed by one side after an idle timeout. The side
 * that REUSES it (the proxy in front) must give it up BEFORE the side that closes it (this server).
 * Otherwise the proxy sends a request into a socket Node is closing at that moment: a 502 from Traefik, or
 * a 520 with origin status 0 from Cloudflare. Node's default `keepAliveTimeout` is 5 s. Traefik keeps an
 * idle upstream connection for 90 s (its serversTransport `idleConnTimeout`), so the first request after
 * a pause was the one that failed. Owner's live test, 2026-11-16: 3 of 22 MCP calls failed and each
 * worked on retry.
 *
 * THE TABLE, one row per hop. Each server closes later than its client gives up. The source of truth is
 * the infra's idle-timeout table:
 *
 *   Cloudflare → Caddy       900 s (Cloudflare, fixed)        < 960 s  Caddy servers idle
 *   Caddy → Traefik          120 s Caddy reverse_proxy        < 180 s  Traefik entry-point idleTimeout
 *   Traefik → mcp, status     90 s Traefik idleConnTimeout    < 120 s  KEEP_ALIVE_TIMEOUT_MS, here
 *   Traefik → landing nginx   90 s                            < 120 s  its keepalive_timeout (the infra's)
 *   landing → web,           no reuse: nginx keeps no idle upstream connection
 *   fragcache → digest         without an `upstream { keepalive }` block
 *   web → fragcache, web →   undici follows the server's `Keep-Alive` hint, else its 4 s default,
 *   mcp internal, status →   minus its own margin; below the server's 65 s (fragcache nginx) or
 *   mcp                      120 s (KEEP_ALIVE_TIMEOUT_MS)
 *
 * the infra holds its Traefik value (its traefik configuration) against this one
 * and holds this value above it. If the infra raises it, this test fails until the value here moves too.
 *
 * `headersTimeout` stays above `keepAliveTimeout` so that, whatever moment the header timer is
 * measured from, a request that starts at the very end of a keep-alive idle still has its full time
 * for the headers. It stays below Node's `requestTimeout` (300 s by default), the bound for the whole
 * request.
 *
 * A leaf module: no import, a structural type. The site shell may not import `@viafrei/ingest`
 * (`scripts/check_web_boundary.sh`), and this package is the leaf all four already reach.
 */

/** What Traefik, the proxy in front of every server here, keeps an idle upstream connection for. */
export const UPSTREAM_IDLE_MS = 90_000;

/** How long a server here keeps an idle keep-alive connection: above {@link UPSTREAM_IDLE_MS}. */
export const KEEP_ALIVE_TIMEOUT_MS = 120_000;

/** How long a server waits for a request's headers: above {@link KEEP_ALIVE_TIMEOUT_MS}. */
export const HEADERS_TIMEOUT_MS = 125_000;

/** The two fields of `node:http`'s `Server` this sets; structural, so the leaf imports nothing. */
export interface IdleTunable {
  keepAliveTimeout: number;
  headersTimeout: number;
}

/**
 * Give `server` the idle keep-alive of the table above and return it, so a call site reads
 * `withIdleTimeouts(app.listen(port, host, cb))`. Setting the fields straight after `listen` is
 * enough. Node reads `keepAliveTimeout` when a response ends, and no connection is accepted before
 * the event loop turns.
 */
export function withIdleTimeouts<S extends IdleTunable>(server: S): S {
  server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS;
  server.headersTimeout = HEADERS_TIMEOUT_MS;
  return server;
}
