/**
 * #1181 features 3, 4 and 7: the star and its marks (`lib/star.ts`), the commute card (`lib/commute.ts`) and the
 * installable site (`lib/pwa.ts`). Device storage only after a click; the service worker never keeps a fragment, a
 * private page or a `noarchive` page (the fuel pages, data terms).
 */
import { Script, createContext, runInContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { commuteCard, commuteRoute, PAGE_FIRST_CLOSE, PAGE_FIRST_OPEN } from "../src/lib/commute.js";
import { contentSecurityPolicy } from "../src/security/csp.js";
import { manifest, serviceWorkerSource, SW_CACHE, SW_MAX_PAGES, SW_NEVER } from "../src/lib/pwa.js";
import { commuteScript, sinceMarks, STAR_STORE, starScript } from "../src/lib/star.js";

describe("since your last visit (#1181 feature 3)", () => {
  const a = { k: "jam|A|N", l: 10, n: "Köln-Ost" };
  const b = { k: "closure|B|S", l: null, n: "Kamen" };
  it("marks a new item, a longer one (five minutes or more) and lists the gone ones by name", () => {
    expect(sinceMarks([a, b], [{ ...a, l: 15 }, { k: "jam|C|N", l: 3, n: "Hilden" }])).toEqual({ fresh: ["jam|C|N"], longer: ["jam|A|N"], gone: ["Kamen"] });
  });
  it("a jitter under five minutes or an unknown length is not longer; nothing kept marks everything new", () => {
    expect(sinceMarks([a], [{ ...a, l: 14 }]).longer).toEqual([]);
    expect(sinceMarks([b], [{ ...b, l: 30 }]).longer).toEqual([]);
    expect(sinceMarks([], [a, b])).toEqual({ fresh: [a.k, b.k], longer: [], gone: [] });
  });
});

/** A minimal page for the star script: a button, the first block's items, a counting localStorage. */
function starPage(stored: string | null) {
  const writes: string[] = [];
  const store = new Map<string, string>(stored === null ? [] : [[STAR_STORE, stored]]);
  const listeners: Record<string, () => void> = {};
  const el = (attrs: Record<string, string>) => ({
    hidden: true,
    textContent: "",
    attrs,
    getAttribute: (k: string) => attrs[k] ?? null,
    hasAttribute: (k: string) => k in attrs,
    setAttribute: (k: string, v: string) => (attrs[k] = v),
    addEventListener: (k: string, f: () => void) => (listeners[k] = f),
    querySelector: () => ({ textContent: "Köln-Ost", prepend: () => undefined }),
    after: () => undefined,
  });
  const btn = el({ "data-key": "/de/autobahn/a3", "data-label": "A3", "data-road": "A3", "data-words": JSON.stringify({ add: "Merken", remove: "Gemerkt", neu: "neu", gone: "aufgehoben: {list}", longer: "länger" }) });
  const item = el({ "data-vf-key": "jam|K|N", "data-vf-len": "12" });
  const registered: string[] = [];
  const ctx = createContext({
    window: { addEventListener: () => undefined },
    location: { pathname: "/de/autobahn/a3" },
    navigator: { serviceWorker: { register: (p: string) => (registered.push(p), Promise.resolve()) } },
    document: { getElementById: (id: string) => (id === "vf-star" ? btn : null), querySelectorAll: () => [item], querySelector: () => null, createElement: () => el({}) },
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => (writes.push(k), store.set(k, v)),
      removeItem: (k: string) => (writes.push(`-${k}`), store.delete(k)),
    },
  });
  runInContext(starScript(), ctx);
  return { btn, writes, store, registered, click: () => listeners["click"]!() };
}

describe("the star (#1181 features 3 and 7)", () => {
  it("parses, sends nothing anywhere and fires no analytics event", () => {
    const js = starScript();
    expect(() => new Script(js)).not.toThrow();
    expect(js).not.toMatch(/fetch\(|sendBeacon|gtag|dataLayer|dispatchEvent|sessionStorage|document\.cookie/u);
  });
  it("a first visit stores nothing and registers no service worker; the click stores the page, a second click removes the key", () => {
    const p = starPage(null);
    expect(p.writes).toEqual([]);
    expect(p.registered).toEqual([]);
    expect(p.btn.hidden).toBe(false);
    p.click();
    expect(p.writes).toEqual([STAR_STORE]);
    expect(p.registered).toEqual(["/sw.js"]);
    const kept = JSON.parse(p.store.get(STAR_STORE)!) as { p: Record<string, { a: string; r: string; n: number; i: unknown[] }> };
    expect(kept.p["/de/autobahn/a3"]).toMatchObject({ a: "A3", r: "A3", n: 1, i: [{ k: "jam|K|N", l: 12, n: "Köln-Ost" }] });
    p.click();
    expect(p.writes).toEqual([STAR_STORE, `-${STAR_STORE}`]);
    expect(p.store.has(STAR_STORE)).toBe(false);
  });
  it("a visit of a page starred before counts the visit and keeps its items", () => {
    const p = starPage(JSON.stringify({ p: { "/de/autobahn/a3": { h: "/de/autobahn/a3", a: "A3", r: "A3", n: 1, t: 1, i: [] } } }));
    expect(p.writes).toEqual([STAR_STORE]);
    expect((JSON.parse(p.store.get(STAR_STORE)!) as { p: Record<string, { n: number }> }).p["/de/autobahn/a3"]!.n).toBe(2);
  });
});

describe("my commute (#1181 feature 4)", () => {
  const page = `<section class="mwpage">${PAGE_FIRST_OPEN}<p class="statusline" id="s1">Stau</p><a href="#jams">2 Staus</a>${PAGE_FIRST_CLOSE}<div id="jams"></div></section>`;
  it("cuts the page's first block, points its jump links at the road's page and drops its ids", () => {
    const c = commuteCard("de", "A3", page)!;
    expect(c).toMatch(/^<section class="commute" id="commute-card"/u);
    expect(c).toContain('href="/de/autobahn/a3#jams"');
    expect(c).not.toContain('id="s1"');
    expect(c).not.toContain('id="jams"');
    expect(commuteCard("de", "A3", "<section></section>")).toBeNull();
  });
  it("answers a POST only, and refuses a road or a language it does not know before asking anyone", async () => {
    const o = { baseUrl: "http://digest.invalid", timeoutMs: 1 };
    expect((await commuteRoute(new Request("http://x/fragment/commute"), o)).status).toBe(405);
    const post = (b: unknown) => new Request("http://x/fragment/commute", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
    for (const b of [{ lang: "de", road: "B1" }, { lang: "xx", road: "A3" }, { lang: "de" }]) {
      const r = await commuteRoute(post(b), o);
      expect(r.status, JSON.stringify(b)).toBe(400);
      expect(r.headers.get("cache-control")).toBe("no-store");
    }
  });
  it("the home's script reads the store but writes none, asks for the newest starred road and shows only the card", async () => {
    const js = commuteScript("de");
    expect(js).not.toMatch(/setItem|removeItem|sendBeacon|gtag|dataLayer/u);
    const run = async (stored: string | null, answer: string) => {
      const slot = { hidden: true, innerHTML: "" };
      const asked: { url: string; body: unknown; credentials: unknown }[] = [];
      const ctx = createContext({
        document: { getElementById: (id: string) => (id === "commute" ? slot : null) },
        localStorage: { getItem: () => stored },
        fetch: (url: string, o: { body: string; credentials: string }) => (asked.push({ url, body: JSON.parse(o.body), credentials: o.credentials }), Promise.resolve({ status: 200, text: () => Promise.resolve(answer) })),
      });
      runInContext(js, ctx);
      await new Promise((r) => setTimeout(r, 0));
      return { slot, asked };
    };
    const card = commuteCard("de", "A3", page)!;
    const two = JSON.stringify({ p: { a: { r: "A3", t: 2 }, b: { r: "A1", t: 1 }, c: { t: 9 } } });
    const ok = await run(two, card);
    expect(ok.asked).toEqual([{ url: "/fragment/commute", body: { road: "A3", lang: "de" }, credentials: "omit" }]);
    expect(ok.slot).toEqual({ hidden: false, innerHTML: card });
    expect((await run(two, "<p>other</p>")).slot.hidden).toBe(true);
    expect((await run(null, card)).asked).toEqual([]);
  });
});

/** Runs the service worker against stubbed `fetch` and `caches`, returning what one navigation kept. */
async function navigate(path: string, res: () => Response, offline = false) {
  const cache = new Map<string, Response>();
  const listeners: Record<string, (e: unknown) => void> = {};
  const waits: Promise<unknown>[] = [];
  const caches = { open: () => Promise.resolve({ put: (r: Request, x: Response) => (cache.set(r.url, x), Promise.resolve()), keys: () => Promise.resolve([...cache.keys()]), delete: (k: string) => Promise.resolve(cache.delete(k)), match: (r: Request) => Promise.resolve(cache.get(r.url)) }), keys: () => Promise.resolve([]), delete: () => Promise.resolve(true) };
  const ctx = createContext({ self: { location: { origin: "https://viafrei.de" }, addEventListener: (k: string, f: (e: unknown) => void) => (listeners[k] = f), skipWaiting: () => undefined, clients: { claim: () => undefined } }, caches, fetch: () => (offline ? Promise.reject(new Error("offline")) : Promise.resolve(res())), URL, Headers, Response, Intl, Date, Number, String, Promise });
  runInContext(serviceWorkerSource(), ctx);
  let answered: Promise<Response> | null = null;
  const request = { url: `https://viafrei.de${path}`, method: "GET", mode: "navigate" } as unknown as Request;
  listeners["fetch"]!({ request, respondWith: (p: Promise<Response>) => (answered = p), waitUntil: (p: Promise<unknown>) => waits.push(p) });
  const out = answered === null ? null : await (answered as Promise<Response>);
  await Promise.all(waits);
  return { kept: cache, answered: out };
}

const html = (headers: Record<string, string> = {}, body = '<html lang="de"><head><meta name="vf-offline" content="Stand {t}, offline"></head><main id="m"><h1>A3</h1></main></html>') => () => {
  const r = new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8", ...headers } });
  Object.defineProperty(r, "type", { value: "basic" });
  return r;
};

describe("the installable site (#1181 feature 7)", () => {
  it("the worker parses and never answers a fragment, an internal read or an asset", async () => {
    expect(() => new Script(serviceWorkerSource())).not.toThrow();
    for (const p of ["/fragment/commute", "/internal/tiles/x", "/_a/site.css"]) {
      expect(SW_NEVER.test(p), p).toBe(true);
      expect((await navigate(p, html())).answered, p).toBeNull();
    }
  });
  it("keeps a plain public page, never a private, no-store, noarchive (header or meta) or queried one", async () => {
    expect((await navigate("/de/autobahn/a3", html())).kept.size).toBe(1);
    for (const [p, r] of [
      ["/", html({ "cache-control": "private, no-store" })],
      ["/de/autobahn/a3", html({ "cache-control": "no-store" })],
      ["/de/ort/koeln", html({ "x-robots-tag": "noarchive" })],
      ["/de/ort/koeln", html({}, '<html><head><meta name="robots" content="index, noarchive"></head><main></main></html>')],
      ["/de/autobahn/a3?r=10", html()],
    ] as const)
      expect((await navigate(p, r)).kept.size, `${p} ${JSON.stringify(r().headers)}`).toBe(0);
  });
  it("offline, a kept page carries the 'Stand <time>, offline' line after <main> and is not stored again", async () => {
    const first = await navigate("/de/autobahn/a3", html());
    const kept = first.kept.get("https://viafrei.de/de/autobahn/a3")!;
    const cache = new Map([["https://viafrei.de/de/autobahn/a3", kept]]);
    const listeners: Record<string, (e: unknown) => void> = {};
    const caches = { open: () => Promise.resolve({ match: (r: Request) => Promise.resolve(cache.get(r.url)) }) };
    const ctx = createContext({ self: { location: { origin: "https://viafrei.de" }, addEventListener: (k: string, f: (e: unknown) => void) => (listeners[k] = f), skipWaiting: () => undefined, clients: { claim: () => undefined } }, caches, fetch: () => Promise.reject(new Error("offline")), URL, Headers, Response, Intl, Date, Number, String, Promise });
    runInContext(serviceWorkerSource(), ctx);
    let answered: Promise<Response> | null = null;
    listeners["fetch"]!({ request: { url: "https://viafrei.de/de/autobahn/a3", method: "GET", mode: "navigate" }, respondWith: (p: Promise<Response>) => (answered = p), waitUntil: () => undefined });
    const res = await (answered as unknown as Promise<Response>);
    const body = await res.text();
    expect(body).toMatch(/<main id="m"><p class="offline" role="status">Stand \d\d:\d\d, offline<\/p><h1>/u);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
  it("every page may load the manifest; only a page with a script may run this origin's worker", () => {
    const n = "abcdefghijklmnopqrstuv";
    expect(contentSecurityPolicy(n, undefined)).toContain("manifest-src 'self'");
    expect(contentSecurityPolicy(n, undefined)).not.toContain("worker-src");
    for (const csp of [contentSecurityPolicy(n, undefined, true), contentSecurityPolicy(n, "G-0", true, false, true)]) {
      expect(csp).toContain("manifest-src 'self'");
      expect(csp).toMatch(/worker-src 'self'(;|$)/u);
    }
  });
  it("names its cache and its limit, and the manifest is the site's", () => {
    expect(serviceWorkerSource()).toContain(JSON.stringify(SW_CACHE));
    expect(serviceWorkerSource()).toContain(`MAX=${String(SW_MAX_PAGES)}`);
    expect(manifest()).toMatchObject({ name: "ViaFrei", start_url: "/", scope: "/", display: "standalone" });
  });
});
