/**
 * #1181 feature 4 ("My commute"): POST `/fragment/commute` `{ road, lang }` — the starred road's status card for the
 * home: the motorway page's own first block (`#page-first`: the status line, the first items, the jump links), cut
 * from the bare page the site already reads and keeps (`fetchMotorwayPage`, the fragment cache), so the card adds no
 * statement and no provider call. The road travels in the body, never the URL (the edge's log, `fragment-route.ts`).
 * Its in-page links point at the road's page; `no-store` and `noindex` like every fragment answer.
 */
import { isLang, t } from "../i18n/index.js";
import { MOTORWAY_NUMBER, motorwayPath } from "../site/motorways.js";
import type { Lang } from "../site/pages.js";
import { bodyOf } from "./fragment-route.js";
import { fetchMotorwayPage } from "./motorway.js";
import type { TileFetchOptions } from "./tiles.js";

/** The digest's first block (`PAGE_FIRST_OPEN` … `PAGE_FIRST_CLOSE`, `motorway-first-html.ts`). */
export const PAGE_FIRST_OPEN = '<div class="pagefirst" id="page-first">';
export const PAGE_FIRST_CLOSE = "</div><!--/page-first-->";

const empty = (status: number): Response => new Response(null, { status, headers: { "cache-control": "no-store" } });

/** The card from a page fragment, or null when the fragment holds no first block. */
export function commuteCard(lang: Lang, road: string, page: string): string | null {
  const i = page.indexOf(PAGE_FIRST_OPEN);
  const j = i < 0 ? -1 : page.indexOf(PAGE_FIRST_CLOSE, i);
  if (i < 0 || j < 0) return null;
  const href = motorwayPath(lang, road);
  // the block's own ids would collide with nothing on the home, but its links name the road page's sections
  const inner = page
    .slice(i + PAGE_FIRST_OPEN.length, j)
    .replace(/href="#/gu, `href="${href}#`)
    .replace(/ id="[^"]*"/gu, "");
  const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return `<section class="commute" id="commute-card" aria-labelledby="commute-h"><h2 class="commute__h" id="commute-h">${esc(t(lang, "star.commute"))}: <a href="${href}" translate="no">${esc(road)}</a></h2><div class="pagefirst">${inner}</div></section>`;
}

export async function commuteRoute(req: Request, o: TileFetchOptions): Promise<Response> {
  if (req.method !== "POST") return empty(405);
  const b = await bodyOf(req);
  if (b === null || typeof b["lang"] !== "string" || !isLang(b["lang"]) || typeof b["road"] !== "string" || !MOTORWAY_NUMBER.test(b["road"])) return empty(400);
  const lang = b["lang"];
  const f = await fetchMotorwayPage(b["road"], lang, o);
  if (f.kind === "missing") return empty(404);
  if (f.kind === "failed") return empty(502);
  const card = commuteCard(lang, b["road"], f.html);
  if (card === null) return empty(502);
  return new Response(card, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" } });
}
