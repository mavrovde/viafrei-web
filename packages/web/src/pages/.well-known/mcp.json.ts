/**
 * `/.well-known/mcp.json` (#734): the MCP Server Card at the path mcp.viafrei.de
 * first served it on (#534) — the SAME document as
 * `/.well-known/mcp/server-card.json` beside it, from the server's own
 * `serverCard()` through the generated catalogue (`site/discovery.ts`).
 */
import type { APIRoute } from "astro";
import { CARD_HEADERS, serverCard } from "../../site/discovery.js";

export const GET: APIRoute = () => new Response(`${JSON.stringify(serverCard(), null, 2)}\n`, { headers: CARD_HEADERS });
