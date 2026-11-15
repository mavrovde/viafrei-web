/** `/llms.txt` (#531): the llmstxt.org summary of ViaFrei, `llmsTxt()` in `site/discovery.ts`. */
import type { APIRoute } from "astro";
import { TEXT_HEADERS, llmsTxt } from "../site/discovery.js";

export const GET: APIRoute = () => new Response(llmsTxt(), { headers: TEXT_HEADERS });
