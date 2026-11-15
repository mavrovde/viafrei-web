import type { APIRoute } from "astro";
import { readEnv } from "../../lib/env.js";
import { mapLayerRoute } from "../../lib/live-map.js";

/** GET `/fragment/map-layer?l=rail|kreise|sa&lang=<l>` — the live map's rail and weather geometry and its CC BY-SA layer (#1183). */
export const GET: APIRoute = ({ request }) => {
  const env = readEnv();
  return mapLayerRoute(request, { baseUrl: env.digestUrl, timeoutMs: env.tileTimeoutMs });
};
export const ALL: APIRoute = () => new Response(null, { status: 405, headers: { allow: "GET", "cache-control": "no-store" } });
