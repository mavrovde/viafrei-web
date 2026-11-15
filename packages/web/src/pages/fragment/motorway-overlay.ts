import type { APIRoute } from "astro";
import { readEnv } from "../../lib/env.js";
import { motorwayOverlayRoute } from "../../lib/live-map.js";

/** GET `/fragment/motorway-overlay` — the live map's states now or at a past hour of today (#1183). */
export const GET: APIRoute = ({ request }) => {
  const env = readEnv();
  return motorwayOverlayRoute(request, { baseUrl: env.digestUrl, timeoutMs: env.tileTimeoutMs });
};
export const ALL: APIRoute = () => new Response(null, { status: 405, headers: { allow: "GET", "cache-control": "no-store" } });
