/** `/sitemap-charging.xml` (#1076): the index of the charging pages' part files in every live language (`lib/energy-sitemaps.ts`). */
import type { APIRoute } from "astro";
import { readEnv } from "../lib/env.js";
import { energyIndexRoute } from "../lib/energy-sitemaps.js";

export const GET: APIRoute = () => energyIndexRoute("charging", { baseUrl: readEnv().digestUrl });
