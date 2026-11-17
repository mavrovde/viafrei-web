/**
 * #1310 A2/A3 (owner 2026-11-14: a verified search engine or AI assistant is never refused, through a web restart or a
 * digest roll too): the 5-byte 503s that reached Googlebot and Applebot on exit pages (2026-11-15 03:38:34Z) were the
 * shell's own empty-bodied 503 — `unavailableAnswer` for a client that is not a person, chunked as `0\r\n\r\n` at the
 * landing — left when a fragment missed a PERSON's two seconds and nothing was held (`page-held.ts`). Pinned here:
 *  - a verified crawler's budget is eight seconds, everyone else's two (`page-budget.ts`), and its reads get what is
 *    left of it, never the person's per-read two seconds;
 *  - a search-lane read that failed to arrive (a reset, a refused connect, a 502/504 while a digest pod rolls) is asked
 *    again inside the caller's deadline; an answer the digest gave (a 503 among them) is never asked again, and a
 *    person's read is never asked twice;
 *  - every database page resolves inside `withinBudget(…, Astro.locals.budgetEndsAt)`, and the middleware opens the
 *    budget for the request's class.
 * No network: the global fetch is a stub.
 */
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AGENT_CLASS_HEADER, currentAgentClass, digestFetch, SEARCH_RETRY_WAITS_MS, withAgentClass } from "../src/lib/agent-class.js";
import { budgetFrom, CRAWLER_PAGE_BUDGET_MS, PAGE_BUDGET_MS, pageBudgetMs, withinBudget } from "../src/lib/page-budget.js";
import { VERIFIED_BOT_HEADER } from "../src/overload/verified-class.js";

vi.mock("astro:middleware", () => ({ defineMiddleware: <T>(f: T): T => f }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("the crawler's budget (page-budget.ts)", () => {
  it("is eight seconds on the search lane and two for everyone else", () => {
    expect(pageBudgetMs("search")).toBe(CRAWLER_PAGE_BUDGET_MS);
    expect(CRAWLER_PAGE_BUDGET_MS).toBe(8_000);
    // below the landing's 12 s proxy_read_timeout (vf-web-proxy.inc), with room for the render
    expect(CRAWLER_PAGE_BUDGET_MS).toBeLessThanOrEqual(10_000);
    for (const c of [null, "crawler", "seo"] as const) expect(pageBudgetMs(c)).toBe(PAGE_BUDGET_MS);
    expect(budgetFrom(1_000, "search")).toBe(9_000);
    expect(budgetFrom(1_000, "crawler")).toBe(3_000);
    expect(budgetFrom(1_000)).toBe(3_000);
    expect(withAgentClass("search", () => pageBudgetMs())).toBe(CRAWLER_PAGE_BUDGET_MS);
    expect(pageBudgetMs()).toBe(PAGE_BUDGET_MS);
  });
  it("gives a verified crawler's read what is left of ITS budget; a person's keeps the smaller of its deadline and the budget", () => {
    const endsAt = Date.now() + 7_000;
    expect(withinBudget({ timeoutMs: 2_000 }, endsAt, "search").timeoutMs).toBeGreaterThan(6_900);
    expect(withAgentClass("search", () => withinBudget({ timeoutMs: 2_000 }, endsAt).timeoutMs)).toBeGreaterThan(6_900);
    expect(withinBudget({ timeoutMs: 2_000 }, endsAt, null).timeoutMs).toBe(2_000);
    expect(withinBudget({ timeoutMs: 2_000 }, endsAt, "crawler").timeoutMs).toBe(2_000);
    expect(withinBudget({ timeoutMs: 2_000 }, Date.now() + 500, null).timeoutMs).toBeLessThanOrEqual(500);
    // no budget at all: the read's own deadline, for the crawler too
    expect(withinBudget({ timeoutMs: 2_000 }, undefined, "search").timeoutMs).toBe(2_000);
  });
});

type Step = Response | Error;
/** A fetch stub answering `steps` in order (the last one for good), recording each call's class header. */
function stub(steps: readonly Step[]): { readonly calls: (string | null)[] } {
  const calls: (string | null)[] = [];
  vi.stubGlobal("fetch", (_url: string, init: RequestInit = {}) => {
    calls.push(new Headers(init.headers).get(AGENT_CLASS_HEADER));
    const s = steps[Math.min(calls.length - 1, steps.length - 1)]!;
    return s instanceof Error ? Promise.reject(s) : Promise.resolve(s.clone());
  });
  return { calls };
}
const reset = (): Error => Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNRESET" } });
const ok = (): Response => new Response("<section>x</section>", { status: 200 });

describe("a verified crawler's read that failed to arrive is asked again (agent-class.ts, #1310 A3)", () => {
  it("rides a reset and a refused connect to the next pod's answer", async () => {
    const s = stub([reset(), reset(), ok()]);
    const res = await withAgentClass("search", () => digestFetch("http://digest/internal/motorway/a1", { signal: AbortSignal.timeout(5_000) }));
    expect(res.status).toBe(200);
    expect(s.calls).toEqual(["search", "search", "search"]);
  });
  it("asks again after a 502 or a 504 (the cache or the Service while a pod rolls)", async () => {
    for (const status of [502, 504]) {
      const s = stub([new Response(null, { status }), ok()]);
      const res = await withAgentClass("search", () => digestFetch("http://digest/x", {}));
      expect(res.status).toBe(200);
      expect(s.calls.length).toBe(2);
    }
  });
  it("never asks again after an answer the digest gave: a 503 refusal, a 404, a 200", async () => {
    for (const status of [503, 404, 200]) {
      const s = stub([new Response(null, { status }), ok()]);
      const res = await withAgentClass("search", () => digestFetch("http://digest/x", {}));
      expect(res.status).toBe(status);
      expect(s.calls.length).toBe(1);
    }
  });
  it("gives up after its waits, with the last failure", async () => {
    const s = stub([new Response(null, { status: 502 })]);
    vi.useFakeTimers();
    const p = withAgentClass("search", () => digestFetch("http://digest/x", {}));
    await vi.advanceTimersByTimeAsync(SEARCH_RETRY_WAITS_MS.reduce((a, b) => a + b, 0) + 10);
    expect((await p).status).toBe(502);
    expect(s.calls.length).toBe(SEARCH_RETRY_WAITS_MS.length + 1);
    const t = stub([reset()]);
    const q = withAgentClass("search", () => digestFetch("http://digest/x", {})).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(SEARCH_RETRY_WAITS_MS.reduce((a, b) => a + b, 0) + 10);
    expect(await q).toBeInstanceOf(TypeError);
    expect(t.calls.length).toBe(SEARCH_RETRY_WAITS_MS.length + 1);
  });
  it("stops at the caller's deadline: no attempt after the abort, and the abort is what it throws", async () => {
    const s = stub([reset()]);
    vi.useFakeTimers();
    const c = new AbortController();
    const p = withAgentClass("search", () => digestFetch("http://digest/x", { signal: c.signal })).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(50);
    c.abort();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(s.calls.length).toBe(1);
    expect((await p as Error).name).toBe("AbortError");
    const aborted = Object.assign(new Error("aborted"), { name: "AbortError" });
    const t = stub([aborted, ok()]);
    const q = withAgentClass("search", () => digestFetch("http://digest/x", {})).catch((e: unknown) => e);
    expect(await q).toBe(aborted);
    expect(t.calls.length).toBe(1);
  });
  it("a deadline that passed while the failed read was out is not waited on, and a reason that is no Error is an AbortError", async () => {
    const c = new AbortController();
    const calls: number[] = [];
    vi.stubGlobal("fetch", () => {
      calls.push(1);
      c.abort("budget spent");
      return Promise.resolve(new Response(null, { status: 502 }));
    });
    const e = await withAgentClass("search", () => digestFetch("http://digest/x", { signal: c.signal })).catch((x: unknown) => x);
    expect((e as Error).name).toBe("AbortError");
    expect(calls.length).toBe(1);
  });
  it("a person's read, an unverified crawler's and a POST are asked once, as before", async () => {
    const calls: (string | null)[] = [];
    const run = async (cls: "crawler" | "search" | null, init: RequestInit): Promise<void> => {
      const s = stub([reset(), ok()]);
      await expect(withAgentClass(cls, () => digestFetch("http://digest/x", init))).rejects.toThrow("fetch failed");
      calls.push(...s.calls);
    };
    await run(null, {});
    await run("crawler", {});
    await run("search", { method: "POST", body: "a" });
    expect(calls).toEqual([null, "crawler", "search"]);
  });
});

describe("every database page resolves inside the request's budget (the routes, #1310)", () => {
  const route = (p: string): string => readFileSync(new URL(`../src/pages/${p}`, import.meta.url), "utf8");
  it.each([
    "[lang]/state/[slug].astro",
    "[lang]/charging/[slug].astro",
    "[lang]/station/[slug].astro",
    "[lang]/station/[slug]/stop/[stop].astro",
    "[lang]/road/[...rest].astro",
    "[lang]/autobahn.astro",
    "[lang]/autobahn/[road]/[...rest].astro",
    "[lang]/states.astro",
    "[lang]/station.astro",
  ])("%s", (p) => {
    expect(route(p)).toMatch(/withinBudget\(\{ baseUrl: env\.digestUrl, timeoutMs: env\.(?:tile|place)TimeoutMs[^}]*\}, Astro\.locals\.budgetEndsAt\)/);
  });
  // 2.6.18 review N1: the real `onRequest`, driven once with a verified search engine and once with a person — the
  // budget is read off the locals the page would be handed, never off the middleware's source text.
  it("the middleware opens the budget for the request's class: eight seconds for a verified search engine, two for a person", async () => {
    type Mw = (context: unknown, next: () => Promise<Response>) => Promise<Response>;
    // the overload gate's pressure probe answers "not saturated"; the station-name list is an empty one
    vi.stubGlobal("fetch", (url: string) => Promise.resolve(url.endsWith("/internal/pressure") ? new Response("ok\n", { status: 200 }) : new Response("[]", { status: 200, headers: { "content-type": "application/json" } })));
    const { onRequest } = (await import("../src/middleware.js")) as unknown as { onRequest: Mw };
    const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
    const BROWSER = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
    const budgetOf = async (headers: Record<string, string>): Promise<{ readonly lead: number; readonly cls: string | null }> => {
      const url = new URL("http://127.0.0.1/de/place/koeln");
      const locals: Record<string, unknown> = {};
      let cls: string | null = "unset";
      const before = Date.now();
      await onRequest({ request: new Request(url, { headers }), url, locals, routePattern: "/[lang]/place/[slug]" }, () => {
        cls = currentAgentClass();
        return Promise.resolve(new Response("<!doctype html><p>x</p>", { headers: { "content-type": "text/html; charset=utf-8" } }));
      });
      const endsAt = locals["budgetEndsAt"];
      expect(typeof endsAt).toBe("number");
      return { lead: (endsAt as number) - before, cls };
    };
    const crawler = await budgetOf({ "user-agent": GOOGLEBOT, [VERIFIED_BOT_HEADER]: "1" });
    expect(crawler.cls).toBe("search");
    expect(crawler.lead).toBeGreaterThanOrEqual(CRAWLER_PAGE_BUDGET_MS);
    expect(crawler.lead).toBeLessThan(CRAWLER_PAGE_BUDGET_MS + 1_000);
    const person = await budgetOf({ "user-agent": BROWSER });
    expect(person.cls).toBeNull();
    expect(person.lead).toBeGreaterThanOrEqual(PAGE_BUDGET_MS);
    expect(person.lead).toBeLessThan(PAGE_BUDGET_MS + 1_000);
  });
});
