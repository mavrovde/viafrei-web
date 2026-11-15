/** `/llms-full.txt` (#531): the summary plus every registered tool, prompt, resource and source, generated from the catalogue. */
import type { APIRoute } from "astro";
import { TEXT_HEADERS, llmsFullTxt } from "../site/discovery.js";

export const GET: APIRoute = () => new Response(llmsFullTxt(), { headers: TEXT_HEADERS });
