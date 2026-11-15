import type { APIRoute } from "astro";
import { readEnv } from "../../lib/env.js";
import { SID_HEADERS, sidRoute } from "../../lib/sid.js";

/** POST `/fragment/sid` — the SID truck-parking figures after the visitor's click on "Belegung anzeigen" (#707). */
export const POST: APIRoute = ({ request }) => {
  const env = readEnv();
  return sidRoute(request, { baseUrl: env.digestUrl, timeoutMs: env.tileTimeoutMs });
};
export const ALL: APIRoute = () => new Response(null, { status: 405, headers: { ...SID_HEADERS, allow: "POST" } });
