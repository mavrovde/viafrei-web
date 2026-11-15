import type { APIRoute } from "astro";
import { readEnv } from "../../lib/env.js";
import { PLACE_FRAGMENT_HEADERS, placeRoute } from "../../lib/fragment-route.js";

/** POST `/fragment/place` — the cards of one area key, for the location island (#564). */
export const POST: APIRoute = ({ request, locals }) => {
  const env = readEnv();
  return placeRoute(request, { baseUrl: env.digestUrl, timeoutMs: env.placeTimeoutMs, mapPlatform: locals.mapPlatform, refreshUrl: env.fuelRefreshUrl, asksUrl: env.mcpInternalUrl });
};
export const ALL: APIRoute = () => new Response(null, { status: 405, headers: { ...PLACE_FRAGMENT_HEADERS, allow: "POST" } });
