import type { APIRoute } from "astro";
import { readEnv } from "../../lib/env.js";
import { stationSuggestRoute } from "../../lib/fragment-route.js";

/** POST `/fragment/station-suggest` — the station search's suggestions for what was typed (2.4.6). */
export const POST: APIRoute = ({ request }) => {
  const env = readEnv();
  return stationSuggestRoute(request, { baseUrl: env.digestUrl, timeoutMs: env.tileTimeoutMs });
};
export const ALL: APIRoute = () => new Response(null, { status: 405, headers: { allow: "POST", "cache-control": "no-store" } });
