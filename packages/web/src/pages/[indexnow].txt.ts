/**
 * `/<INDEXNOW_KEY>.txt` (#544): the IndexNow key file, `keyFileResponse()` in
 * `site/indexnow.ts`. Any other `/<name>.txt` is the 404; the static
 * `robots.txt`, `llms.txt` and `llms-full.txt` routes outrank this one.
 */
import type { APIRoute } from "astro";
import { keyFileResponse } from "../site/indexnow.js";

export const GET: APIRoute = ({ params, rewrite }) => keyFileResponse(params["indexnow"]) ?? rewrite("/404");
