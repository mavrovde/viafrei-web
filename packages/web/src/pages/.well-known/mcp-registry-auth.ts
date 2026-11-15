/**
 * `/.well-known/mcp-registry-auth` (#531): the official MCP Registry's HTTP
 * domain authentication — one line holding the ed25519 PUBLIC key the
 * registry verifies a publish for viafrei.de against (`MCP_REGISTRY_AUTH`),
 * served byte for byte with no trailing newline.
 */
import type { APIRoute } from "astro";
import { MCP_REGISTRY_AUTH, TEXT_HEADERS } from "../../site/discovery.js";

export const GET: APIRoute = () => new Response(MCP_REGISTRY_AUTH, { headers: TEXT_HEADERS });
