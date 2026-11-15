import type { APIRoute } from "astro";
import { readEnv } from "../../lib/env.js";
import { stationNearRoute } from "../../lib/station-near.js";

/** POST `/fragment/station-near` — the stations nearest the visitor's remembered place, for the station index (#1182). */
export const POST: APIRoute = ({ request }) => {
  const env = readEnv();
  return stationNearRoute(request, { baseUrl: env.digestUrl, timeoutMs: env.placeTimeoutMs });
};
export const ALL: APIRoute = () => new Response(null, { status: 405, headers: { allow: "POST", "cache-control": "private, no-store", vary: "X-Forwarded-For" } });
