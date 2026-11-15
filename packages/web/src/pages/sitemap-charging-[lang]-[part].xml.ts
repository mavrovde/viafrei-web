/** `/sitemap-charging-<lang>-<part>.xml` (#1076): one part of the charging pages in one language (`lib/energy-sitemaps.ts`). */
import type { APIRoute } from "astro";
import { readEnv } from "../lib/env.js";
import { energyPartRoute } from "../lib/energy-sitemaps.js";

export const GET: APIRoute = ({ params }) => energyPartRoute("charging", params["lang"] ?? "", params["part"] ?? "", { baseUrl: readEnv().digestUrl });
