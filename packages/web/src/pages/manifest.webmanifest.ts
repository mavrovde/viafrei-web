/** `/manifest.webmanifest` (#1181 feature 7): the installable site's manifest (`lib/pwa.ts`). */
import type { APIRoute } from "astro";
import { manifest } from "../lib/pwa.js";

export const GET: APIRoute = () => new Response(JSON.stringify(manifest()), { headers: { "content-type": "application/manifest+json; charset=utf-8", "cache-control": "public, max-age=3600" } });
