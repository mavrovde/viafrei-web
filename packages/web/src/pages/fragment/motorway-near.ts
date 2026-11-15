import type { APIRoute } from "astro";
import { readEnv } from "../../lib/env.js";
import { motorwayNearRoute } from "../../lib/motorway-near.js";

/** POST `/fragment/motorway-near` — the motorways around the visitor's remembered place, for the motorway index (#1113). */
export const POST: APIRoute = ({ request, locals }) => {
  const env = readEnv();
  return motorwayNearRoute(request, { baseUrl: env.digestUrl, timeoutMs: env.placeTimeoutMs, mapPlatform: locals.mapPlatform });
};
export const ALL: APIRoute = () => new Response(null, { status: 405, headers: { allow: "POST", "cache-control": "no-store" } });
