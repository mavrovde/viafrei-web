import type { APIRoute } from "astro";
import { readEnv } from "../../lib/env.js";
import { suggestRoute } from "../../lib/fragment-route.js";

/** POST `/fragment/suggest` — the place sheet's suggestions for what was typed (#564). */
export const POST: APIRoute = ({ request }) => {
  const env = readEnv();
  return suggestRoute(request, { baseUrl: env.digestUrl, timeoutMs: env.tileTimeoutMs });
};
export const ALL: APIRoute = () => new Response(null, { status: 405, headers: { allow: "POST", "cache-control": "no-store" } });
