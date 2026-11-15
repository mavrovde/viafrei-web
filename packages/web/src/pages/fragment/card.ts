import type { APIRoute } from "astro";
import { readEnv } from "../../lib/env.js";
import { CARD_REFRESH_HEADERS, cardRefreshRoute } from "../../lib/card-refresh.js";

/** GET `/fragment/card` — one place card refreshed in place (#939), revalidated by its data version. */
export const GET: APIRoute = ({ request, locals }) => {
  const env = readEnv();
  // A station's area card (`area=1`) is cut from the place-card round of its cell and waits a tile's 2 s like every
  // other card: the round's costliest statement (the charging card's English-town lookup) was made cheap in 2.5.2
  // (migration 0237), which is what the hotfix of 2026-10-30 had worked around by waiting the place page's deadline.
  return cardRefreshRoute(request, { baseUrl: env.digestUrl, timeoutMs: env.tileTimeoutMs, fragmentUrl: env.fragmentUrl, mapPlatform: locals.mapPlatform });
};
export const ALL: APIRoute = () => new Response(null, { status: 405, headers: { ...CARD_REFRESH_HEADERS, allow: "GET" } });
