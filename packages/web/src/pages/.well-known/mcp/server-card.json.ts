/**
 * `/.well-known/mcp/server-card.json` (#531, #534): the MCP Server Card
 * (SEP-2127) — the document mcp.viafrei.de serves, generated at build time
 * from the server's own `serverCard()` (`site/discovery.ts` says how).
 */
import type { APIRoute } from "astro";
import { CARD_HEADERS, serverCard } from "../../../site/discovery.js";

export const GET: APIRoute = () => new Response(`${JSON.stringify(serverCard(), null, 2)}\n`, { headers: CARD_HEADERS });
