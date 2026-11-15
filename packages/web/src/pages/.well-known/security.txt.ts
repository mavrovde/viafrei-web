/**
 * `/.well-known/security.txt` (RFC 9116, #734): `securityTxt()` in
 * `site/discovery.ts`. mcp.viafrei.de answers the same path with a 301 here.
 */
import type { APIRoute } from "astro";
import { TEXT_HEADERS, securityTxt } from "../../site/discovery.js";

export const GET: APIRoute = () => new Response(securityTxt(), { headers: TEXT_HEADERS });
