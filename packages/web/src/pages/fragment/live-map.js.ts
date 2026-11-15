import type { APIRoute } from "astro";
import { liveMapScriptFile } from "../../lib/live-map.js";

/** GET `/fragment/live-map.js?lang=<l>&v=<version>` — the live map's script as a file, the home's loader adds it (#1183 part 5). */
export const GET: APIRoute = ({ request }) => liveMapScriptFile(request);
export const ALL: APIRoute = () => new Response(null, { status: 405, headers: { allow: "GET", "cache-control": "no-store" } });
