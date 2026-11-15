/**
 * #1205 review N7, behavioural: the real `onRequest` around a planted page. A verified crawler's 503 is replayed from
 * the render a verified crawler was served; a person's render — with or without a cookie — is never held, and neither
 * is a crawler's render that declared it read the visitor. The digest is a stub (`fetch`), so nothing leaves the test.
 */
import { all, text as textOf } from "@viafrei/design/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEGRADED_HEADER } from "../src/lib/degraded.js";
import { clearHeldPages, heldPages } from "../src/lib/page-held.js";
import { VERIFIED_BOT_HEADER } from "../src/overload/verified-class.js";

vi.mock("astro:middleware", () => ({ defineMiddleware: <T>(f: T): T => f }));

type Locals = Record<string, unknown>;
type Mw = (context: unknown, next: () => Promise<Response>) => Promise<Response>;
const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const BROWSER = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const PATH = "/de/place/koeln";

beforeEach(() => {
  clearHeldPages();
  // the pressure probe answers "not saturated"; every other digest read is a small fragment
  vi.stubGlobal("fetch", (url: string) => Promise.resolve(url.endsWith("/internal/pressure") ? new Response("ok\n", { status: 200 }) : new Response("[]", { status: 200, headers: { "content-type": "application/json" } })));
});
afterEach(() => {
  vi.unstubAllGlobals();
  clearHeldPages();
});

const page = (marker: string, onLocals?: (l: Locals) => void) => (locals: Locals) => (): Promise<Response> => {
  onLocals?.(locals);
  return Promise.resolve(new Response(`<!doctype html><html><head><script nonce="x">1</script></head><body><h1>${marker}</h1></body></html>`, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } }));
};
const unavailable = () => (): Promise<Response> => Promise.resolve(new Response(null, { status: 503, headers: { "retry-after": "60", "cache-control": "no-store", [DEGRADED_HEADER]: "1" } }));

async function run(who: "crawler" | "person", next: (l: Locals) => () => Promise<Response>, o: { cookie?: boolean } = {}): Promise<Response> {
  const { onRequest } = (await import("../src/middleware.js")) as unknown as { onRequest: Mw };
  const url = new URL(`http://127.0.0.1${PATH}`);
  const headers: Record<string, string> = who === "crawler" ? { "user-agent": GOOGLEBOT, [VERIFIED_BOT_HEADER]: "1" } : { "user-agent": BROWSER };
  if (o.cookie === true) headers["cookie"] = "vf_place=koeln";
  const locals: Locals = {};
  return onRequest({ request: new Request(url, { headers }), url, locals, routePattern: "/[lang]/place/[slug]" }, next(locals));
}

describe("#1205 review N7: the middleware holds only a verified crawler's own render, and replays it to a verified crawler", () => {
  it("a verified crawler's 503 is answered with the render a verified crawler was served before", async () => {
    expect((await run("crawler", page("crawler-render"))).status).toBe(200);
    expect(heldPages().pages).toBe(1);
    const miss = await run("crawler", unavailable);
    expect(miss.status).toBe(200);
    expect(miss.headers.get(DEGRADED_HEADER)).toBe("1");
    expect(all(await miss.text(), "h1").map(textOf)).toEqual(["crawler-render"]);
  });

  it("a person's render is never held, without and with a cookie: the crawler's later miss stays the 503", async () => {
    expect((await run("person", page("person-render"))).status).toBe(200);
    expect((await run("person", page("person-render-cookie"), { cookie: true })).status).toBe(200);
    expect(heldPages().pages).toBe(0);
    expect((await run("crawler", unavailable)).status).toBe(503);
  });

  it("a verified crawler's render that read the visitor (locals.perVisitor) is not held", async () => {
    await run("crawler", page("near-ip", (l) => (l["perVisitor"] = true)));
    expect(heldPages().pages).toBe(0);
    expect((await run("crawler", unavailable)).status).toBe(503);
  });

  it("a person's 503 is never answered from a crawler's copy", async () => {
    await run("crawler", page("crawler-render"));
    const r = await run("person", unavailable);
    expect(r.status).toBe(503);
  });
});
