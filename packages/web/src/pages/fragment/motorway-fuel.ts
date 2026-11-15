import type { APIRoute } from "astro";
import { readEnv } from "../../lib/env.js";
import { MOTORWAY_FUEL_HEADERS, motorwayFuelRoute } from "../../lib/motorway-fuel.js";

/** GET `/fragment/motorway-fuel` — a motorway page's fuel prices, for a person viewing the page only (#716, steward M16; PF2 since 2026-10-26). */
export const GET: APIRoute = ({ request, locals }) => {
  const env = readEnv();
  // #712: a person's view of an empty layer asks the MCP site door (the same queue as the place card).
  return motorwayFuelRoute(request, { baseUrl: env.digestUrl, timeoutMs: env.placeTimeoutMs, mapPlatform: locals.mapPlatform, refreshUrl: env.fuelRefreshUrl });
};
export const ALL: APIRoute = () => new Response(null, { status: 405, headers: { ...MOTORWAY_FUEL_HEADERS, allow: "GET" } });
