import type { APIRoute } from "astro";
import { commuteRoute } from "../../lib/commute.js";
import { readEnv } from "../../lib/env.js";

/** POST `/fragment/commute` — the starred road's status card for the home (#1181 feature 4). */
export const POST: APIRoute = ({ request, locals }) => {
  const env = readEnv();
  return commuteRoute(request, { baseUrl: env.digestUrl, timeoutMs: env.placeTimeoutMs, mapPlatform: locals.mapPlatform });
};
export const ALL: APIRoute = () => new Response(null, { status: 405, headers: { allow: "POST", "cache-control": "no-store" } });
