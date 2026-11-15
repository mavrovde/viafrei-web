import type { APIRoute } from "astro";
import { readEnv } from "../../lib/env.js";
import { siteSearchRoute } from "../../lib/fragment-route.js";

/** POST `/fragment/search` — the site search's suggestions for what was typed (#1111). */
export const POST: APIRoute = ({ request }) => {
  const env = readEnv();
  return siteSearchRoute(request, { baseUrl: env.digestUrl, timeoutMs: env.tileTimeoutMs });
};
export const ALL: APIRoute = () => new Response(null, { status: 405, headers: { allow: "POST", "cache-control": "no-store" } });
