import type { APIRoute } from "astro";
import { readEnv } from "../../lib/env.js";
import { tileRoute } from "../../lib/fragment-route.js";

/** GET `/fragment/tile?id=…&lang=…` — one live tile the first render could not fill in time (#564, render-then-fill). */
export const GET: APIRoute = ({ request }) => {
  const env = readEnv();
  return tileRoute(request, { baseUrl: env.digestUrl, timeoutMs: env.tileTimeoutMs });
};
export const ALL: APIRoute = () => new Response(null, { status: 405, headers: { allow: "GET", "cache-control": "no-store" } });
