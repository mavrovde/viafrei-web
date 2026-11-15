import type { APIRoute } from "astro";
import { readEnv } from "../../lib/env.js";
import { FUEL_FRAGMENT_HEADERS } from "../../lib/fuel-fragment.js";
import { placeFuelRoute } from "../../lib/place-fuel.js";

/** GET `/fragment/place-fuel` — a place card's fuel prices, for a person's page view only (#1065, the motorway page's M16). */
export const GET: APIRoute = ({ request, locals }) => {
  const env = readEnv();
  // #712: a person's view asks the MCP site door (the same queue as the motorway layer and the island).
  return placeFuelRoute(request, { baseUrl: env.digestUrl, timeoutMs: env.placeTimeoutMs, mapPlatform: locals.mapPlatform, refreshUrl: env.fuelRefreshUrl });
};
export const ALL: APIRoute = () => new Response(null, { status: 405, headers: { ...FUEL_FRAGMENT_HEADERS, allow: "GET" } });
