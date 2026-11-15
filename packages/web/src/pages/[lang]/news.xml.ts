/** `/<lang>/news.xml` — the News page's Atom feed per language (#588; #892: German's was `/de/neuigkeiten.xml`, now a temporary 301). */
import type { APIRoute } from "astro";
import { feedResponse } from "../../news/atom.js";

export const GET: APIRoute = ({ params }) => feedResponse(params["lang"] ?? "", "news");
