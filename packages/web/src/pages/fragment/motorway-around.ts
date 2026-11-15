import type { APIRoute } from "astro";
import { readEnv } from "../../lib/env.js";
import { motorwayAroundRoute } from "../../lib/motorway-around.js";

/** POST `/fragment/motorway-around` — what is around the visitor's rounded cell on one motorway, for the location island (#890). */
export const POST: APIRoute = ({ request, locals }) => {
  const env = readEnv();
  return motorwayAroundRoute(request, { baseUrl: env.digestUrl, timeoutMs: env.placeTimeoutMs, mapPlatform: locals.mapPlatform });
};
export const ALL: APIRoute = () => new Response(null, { status: 405, headers: { allow: "POST", "cache-control": "no-store" } });
