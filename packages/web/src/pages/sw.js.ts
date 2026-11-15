/** `/sw.js` (#1181 feature 7): the service worker, registered only once a page is starred (`lib/star.ts`, `lib/pwa.ts`). */
import type { APIRoute } from "astro";
import { SW_HEADERS, serviceWorkerSource } from "../lib/pwa.js";

export const GET: APIRoute = () => new Response(serviceWorkerSource(), { headers: SW_HEADERS });
