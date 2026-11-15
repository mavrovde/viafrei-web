import type { APIRoute } from "astro";
import { readEnv } from "../../lib/env.js";
import { FUEL_FRAGMENT_HEADERS } from "../../lib/fuel-fragment.js";
import { fuelStationRoute } from "../../lib/fuel-station.js";

/** GET `/fragment/fuel-station` — one fuel station's prices, for a person's page view only (#1076, the place card's #1065 rule). */
export const GET: APIRoute = ({ request, locals }) => {
  const env = readEnv();
  return fuelStationRoute(request, { baseUrl: env.digestUrl, timeoutMs: env.placeTimeoutMs, mapPlatform: locals.mapPlatform, refreshUrl: env.fuelRefreshUrl });
};
export const ALL: APIRoute = () => new Response(null, { status: 405, headers: { ...FUEL_FRAGMENT_HEADERS, allow: "GET" } });
