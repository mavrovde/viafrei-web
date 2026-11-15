import type { APIRoute } from "astro";
import { readEnv } from "../../lib/env.js";
import { spotRoute } from "../../lib/spot.js";

/** POST `/fragment/spot` — is the precise position of a "use my location" click at one of our object pages (#1171)? */
export const POST: APIRoute = ({ request }) => spotRoute(request, { baseUrl: readEnv().digestUrl });
export const ALL: APIRoute = () => new Response(null, { status: 405, headers: { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow", allow: "POST" } });
