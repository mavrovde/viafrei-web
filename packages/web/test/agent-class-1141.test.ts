/**
 * #1141: the shell hands nginx's user-agent class (`X-VF-Agent-Class`, the edge configuration `$vf_ua_class`) to every
 * fragment it asks of the digest, so the digest reads a crawler's page on its own pool. Covered here:
 *  - the closed list: only `search`, `crawler`, `seo` pass; anything else sends no header (a person, as before);
 *  - `digestFetch` inside a request's scope sends the class, outside it sends nothing, and keeps the caller's headers;
 *  - a real fetcher's DEFAULT path (`getFragment`, no `fetchImpl`) carries it;
 *  - the middleware opens the scope around the whole request — a fragment fetched while the body is being read (a
 *    late part of a streamed render) carries it too — and a request without the header sends none;
 *  - every fetcher in `src/lib/` defaults to `digestFetch` (a sweep, so a new fetcher cannot forget it).
 * No network: the global fetch is a recording fake.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AGENT_CLASSES, AGENT_CLASS_HEADER, agentClassOf, currentAgentClass, digestFetch, withAgentClass } from "../src/lib/agent-class.js";
import { getFragment } from "../src/lib/place.js";

vi.mock("astro:middleware", () => ({ defineMiddleware: <T>(f: T): T => f }));

const LIB = join(import.meta.dirname, "../src/lib");

type Seen = { readonly url: string; readonly cls: string | null; readonly accept: string | null };
let seen: Seen[] = [];
beforeEach(() => {
  seen = [];
  vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
    // #1184: the overload gate's pressure probe is not a fragment: answered "ok" (no overload) and not recorded
    if (url.endsWith("/internal/pressure")) return Promise.resolve(new Response("ok\n", { status: 200 }));
    const h = new Headers(init?.headers);
    seen.push({ url, cls: h.get(AGENT_CLASS_HEADER), accept: h.get("accept") });
    return Promise.resolve(new Response('<p class="x">ok</p>', { status: 200, headers: { "content-type": "text/html" } }));
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("#1141: the class the shell passes on", () => {
  it("is one of nginx's three non-empty classes, or nothing", () => {
    expect([...AGENT_CLASSES]).toEqual(["search", "crawler", "seo"]);
    for (const c of AGENT_CLASSES) expect(agentClassOf(c)).toBe(c);
    for (const v of [null, undefined, "", "Search", "googlebot", "person", "search "]) expect(agentClassOf(v), String(v)).toBeNull();
  });

  it("digestFetch sends the request's class, keeps the caller's headers, and sends none outside a crawler's request", async () => {
    await withAgentClass("search", () => digestFetch("http://digest/internal/place/cards", { headers: { accept: "text/html" } }));
    await withAgentClass(null, () => digestFetch("http://digest/internal/place/cards", { headers: { accept: "text/html" } }));
    await digestFetch("http://digest/internal/station/list");
    expect(seen).toEqual([
      { url: "http://digest/internal/place/cards", cls: "search", accept: "text/html" },
      { url: "http://digest/internal/place/cards", cls: null, accept: "text/html" },
      { url: "http://digest/internal/station/list", cls: null, accept: null },
    ]);
  });

  it("a fetcher's default path carries it: getFragment with no fetchImpl, after an await inside the request", async () => {
    const r = await withAgentClass("crawler", async () => {
      await new Promise((res) => setTimeout(res, 1));
      return getFragment("http://digest/internal/place/koeln/charging?lang=de", { baseUrl: "http://digest", timeoutMs: 1_000 }, /^<p class="x">/, "</p>");
    });
    expect(r.ok).toBe(true);
    expect(seen.map((s) => s.cls)).toEqual(["crawler"]);
  });
});

describe("#1141: the middleware opens the scope around the whole request", () => {
  type Mw = (context: unknown, next: () => Promise<Response>) => Promise<Response>;
  // #1205: the station-name list the middleware keeps from the process's first request is not a request's fragment
  const fragments = (): Seen[] => seen.filter((s) => !s.url.endsWith("/internal/station/list"));
  const run = async (agent: string | null, next: () => Promise<Response>): Promise<Response> => {
    const { onRequest } = (await import("../src/middleware.js")) as unknown as { onRequest: Mw };
    const url = new URL("http://127.0.0.1/de/place/koeln");
    const request = new Request(url, { headers: agent === null ? {} : { [AGENT_CLASS_HEADER]: agent } });
    return onRequest({ request, url, locals: {}, routePattern: "/[lang]/place/[slug]" }, next);
  };

  it("an endpoint's fetch carries the class nginx sent (search only when verified, #1205 review); without the header it carries none", async () => {
    const endpoint = async (): Promise<Response> => {
      await digestFetch("http://digest/internal/place/suggest?q=k");
      return new Response("x", { headers: { "content-type": "text/plain" } });
    };
    await run("crawler", endpoint);
    await run("search", endpoint);
    await run(null, endpoint);
    await run("not-a-class", endpoint);
    // nginx's `search` with nothing proving it (no verified address, no edge marker) is read as a crawler
    expect(fragments().map((s) => s.cls)).toEqual(["crawler", "crawler", null, null]);
  });

  it("a fragment fetched while the middleware reads a streamed page's body carries it too", async () => {
    const page = (): Promise<Response> => {
      const enc = new TextEncoder();
      let part = 0;
      const body = new ReadableStream<Uint8Array>({
        // each pull is a later part of the render, asked for when the middleware reads the body back for its nonce
        async pull(c) {
          part += 1;
          if (part > 2) return c.close();
          const r = await digestFetch(`http://digest/internal/part/${String(part)}`);
          c.enqueue(enc.encode(await r.text()));
        },
      });
      return Promise.resolve(new Response(body, { headers: { "content-type": "text/html; charset=utf-8" } }));
    };
    const res = await run("seo", page);
    expect(await res.text()).toContain("ok");
    expect(fragments().map((s) => [s.url, s.cls])).toEqual([
      ["http://digest/internal/part/1", "seo"],
      ["http://digest/internal/part/2", "seo"],
    ]);
    expect(currentAgentClass()).toBeNull();
  });
});

describe("#1141: every fetcher in src/lib defaults to digestFetch", () => {
  // Not the digest's: the MCP server's examples (ask.ts, place-asks.ts), and the fuel refresh, which a crawler never
  // triggers (`fuel-refresh.ts` `personAsks` refuses a crawler before any request is made).
  const EXEMPT = new Map([
    ["ask.ts", "asks the MCP server, not the digest"],
    ["place-asks.ts", "asks the MCP server, not the digest"],
    ["try-it.ts", "asks the MCP server for its recorded call, not the digest (#992)"],
    ["fuel-refresh.ts", "never runs for a crawler (personAsks)"],
  ]);
  it("no default `(u, init) => fetch(u, init)` is left outside the exempt files, and each exemption is still needed", () => {
    // any arrow handing (u, init) straight to the global fetch — behind `??` or not (station-area.ts had the bare form)
    const bare = /\(\s*(?:u|url)(?::\s*string)?\s*,\s*init[^)]*\)\s*=>\s*fetch\(/;
    const files = readdirSync(LIB).filter((f) => f.endsWith(".ts"));
    expect(files.length).toBeGreaterThan(20);
    const offenders = files.filter((f) => !EXEMPT.has(f) && bare.test(readFileSync(join(LIB, f), "utf8")));
    expect(offenders).toEqual([]);
    for (const f of EXEMPT.keys()) expect(bare.test(readFileSync(join(LIB, f), "utf8")), f).toBe(true);
    const users = files.filter((f) => /\(\s*(?:u|url)(?::\s*string)?\s*,\s*init[^)]*\)\s*=>\s*digestFetch\(/.test(readFileSync(join(LIB, f), "utf8")));
    expect(users.length).toBeGreaterThanOrEqual(11);
  });
});
