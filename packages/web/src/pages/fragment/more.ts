import type { APIRoute } from "astro";
import { readEnv } from "../../lib/env.js";
import { CARD_MORE_HEADERS, cardMoreRoute } from "../../lib/card-more.js";

/** GET `/fragment/more` — a card's next entries behind the "›" fold (#1061), from the digest's kept fragments. */
export const GET: APIRoute = ({ request, locals }) => {
  const env = readEnv();
  return cardMoreRoute(request, { baseUrl: env.digestUrl, timeoutMs: env.tileTimeoutMs, fragmentUrl: env.fragmentUrl, mapPlatform: locals.mapPlatform });
};
export const ALL: APIRoute = () => new Response(null, { status: 405, headers: { ...CARD_MORE_HEADERS, allow: "GET" } });
