/**
 * #1166 (owner 2026-10-26: no visitor waits above two seconds): ONE budget per
 * request for everything a page waits on the digest for. The middleware opens
 * it (`locals.budgetEndsAt`) before the legacy redirect's lookup, and every
 * read after it — the legacy lookup, a page's resolve, a motorway page's
 * "around you" block, a place page's key, cards and name index — gets what is
 * left of it, never a fresh 2 s of its own. Sequential reads therefore share
 * the two seconds instead of adding up.
 */
export const PAGE_BUDGET_MS = 2_000;

/** Where a budget opened now ends (epoch ms). */
export const budgetFrom = (now: number = Date.now()): number => now + PAGE_BUDGET_MS;

/** What is left of a budget ending at `endsAt`, ms, never below 0; no budget at all is unbounded here (the read's own deadline holds). */
export function budgetLeft(endsAt: number | undefined, now: number = Date.now()): number {
  return endsAt === undefined ? Number.POSITIVE_INFINITY : Math.max(0, endsAt - now);
}

/** `o` with its read deadline cut to what is left of the budget. */
export function withinBudget<O extends { readonly timeoutMs: number }>(o: O, endsAt: number | undefined): O {
  return { ...o, timeoutMs: Math.min(o.timeoutMs, budgetLeft(endsAt)) };
}
