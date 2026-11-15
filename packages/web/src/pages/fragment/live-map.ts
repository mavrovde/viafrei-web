import type { APIRoute } from "astro";
import { readEnv } from "../../lib/env.js";
import { liveMapFigureRoute } from "../../lib/live-map.js";

/** GET `/fragment/live-map?lang=<l>` — the home's live map figure, asked by its loader (#1183 part 5). */
export const GET: APIRoute = ({ request }) => {
  const env = readEnv();
  return liveMapFigureRoute(request, { baseUrl: env.digestUrl, timeoutMs: env.tileTimeoutMs });
};
export const ALL: APIRoute = () => new Response(null, { status: 405, headers: { allow: "GET", "cache-control": "no-store" } });
