/**
 * The site shell's server entry (#1332): `astro.config.mjs` makes it the adapter's `serverEntrypoint`,
 * so `node packages/web/dist/server/entry.mjs` runs this file, bundled with the rest of the shell.
 *
 * It is @astrojs/node's own standalone entry plus one step. The started server gets the idle keep-alive
 * every HTTP server in this repository shares (`@viafrei/design/http-idle`: keepAliveTimeout 120 s,
 * headersTimeout 125 s). Node's 5 s default is shorter than the 90 s for which the proxy in front
 * (Traefik, then the landing's nginx) reuses an idle connection, so the first request after a pause met a
 * closing socket. The table of every hop is the infra's idle-timeout table.
 *
 * `./no-autostart.js` must stay the FIRST import: it stops the adapter's module from starting a server
 * on import, so the one server is the one started here. A caller's own ASTRO_NODE_AUTOSTART=disabled
 * (preview.js sets it) is kept, and then nothing starts.
 */
import { AUTOSTART_DISABLED_BY_CALLER } from "./no-autostart.js";
import { handler, options, startServer as startAdapterServer } from "@astrojs/node/server.js";
import { withIdleTimeouts } from "@viafrei/design/http-idle";

/** The adapter's standalone server with the shared idle keep-alive; what `entry.mjs` runs at start. */
export function startServer(): ReturnType<typeof startAdapterServer> {
  const started = startAdapterServer();
  withIdleTimeouts(started.server.server);
  return started;
}

// `options` is the adapter's virtual config module, which carries no type: read its one field as what it is.
// The adapter's own rule: start in standalone mode unless the caller disabled the autostart.
if ((options as { readonly mode?: unknown }).mode === "standalone" && !AUTOSTART_DISABLED_BY_CALLER) startServer();

export { handler, options };
