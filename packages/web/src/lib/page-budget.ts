/**
 * #1166 (owner 2026-10-26: no visitor waits above two seconds): ONE budget per
 * request for everything a page waits on the digest for. The middleware opens
 * it (`locals.budgetEndsAt`) before the legacy redirect's lookup, and every
 * read after it — the legacy lookup, a page's resolve, a motorway page's
 * "around you" block, a place page's key, cards and name index — gets what is
 * left of it, never a fresh 2 s of its own. Sequential reads therefore share
 * the two seconds instead of adding up.
 */
import { currentAgentClass, type AgentClass } from "./agent-class.js";

export const PAGE_BUDGET_MS = 2_000;

/**
 * #1310 A2/A3 (owner 2026-11-14: a verified search engine or AI assistant is never refused): the budget of a request on
 * the search lane (`currentAgentClass() === "search"`, `overload/verified-class.ts`). The two seconds are a PERSON's
 * wait; a crawler is not one, and it was the two seconds that refused it: with nothing held (`page-held.ts`, a page a
 * crawler had not been served in this process, every exit page among them) a fragment that missed them was a 503 with
 * an empty body — 5 bytes of chunked framing at the landing, e.g. Googlebot and Applebot on two exit pages in the same
 * second, 2026-11-15 03:38:34Z. Eight seconds sit below the landing's 12 s `proxy_read_timeout`
 * (`vf-web-proxy.inc`), with room for the render after the read.
 */
export const CRAWLER_PAGE_BUDGET_MS = 8_000;

/** The budget of a request of class `cls`: a verified crawler's eight seconds, everyone else's two. */
export const pageBudgetMs = (cls: AgentClass | null = currentAgentClass()): number => (cls === "search" ? CRAWLER_PAGE_BUDGET_MS : PAGE_BUDGET_MS);

/** Where a budget opened now ends (epoch ms), for a request of class `cls`. */
export const budgetFrom = (now: number = Date.now(), cls: AgentClass | null = null): number => now + pageBudgetMs(cls);

/** What is left of a budget ending at `endsAt`, ms, never below 0; no budget at all is unbounded here (the read's own deadline holds). */
export function budgetLeft(endsAt: number | undefined, now: number = Date.now()): number {
  return endsAt === undefined ? Number.POSITIVE_INFINITY : Math.max(0, endsAt - now);
}

/**
 * `o` with its read deadline cut to what is left of the budget. #1310: a verified crawler's read gets what is left of
 * ITS budget, not the person's per-read deadline (`WEB_PLACE_TIMEOUT_MS`/`WEB_TILE_TIMEOUT_MS`, two seconds at most).
 */
export function withinBudget<O extends { readonly timeoutMs: number }>(o: O, endsAt: number | undefined, cls: AgentClass | null = currentAgentClass()): O {
  const left = budgetLeft(endsAt);
  return { ...o, timeoutMs: cls === "search" && endsAt !== undefined ? left : Math.min(o.timeoutMs, left) };
}
