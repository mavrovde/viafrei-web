/**
 * #1205 review S3/B1/S7/S9: every held page family answers a verified crawler's miss with the copy a verified crawler
 * was itself last served, and only with nothing held keeps the 503 — counted apart. A copy is taken only from a
 * verified crawler's own render that read no visitor; a person's render, a render that read the visitor, an answer
 * that says it is one client's, and every fuel page are never held. One case per family, run through the very
 * functions the middleware calls; the rendered pages that read the visitor are in `page-held-visitor-1205.test.ts`
 * and the middleware itself in `page-held-middleware-1205.test.ts`.
 */
import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { all, text as textOf } from "@viafrei/design/testing";
import { afterEach, describe, expect, it } from "vitest";
import { DEGRADED_HEADER } from "../src/lib/degraded.js";
import { HeldStore, owned } from "../src/lib/held-store.js";
import { HELD_PAGE, PAGE_HELD_ENTRY_MAX_BYTES, PAGE_HELD_MAX_BYTES, answerIsPerClient, clearHeldPages, countVerifiedRefused, heldPages, keepRendered, verifiedReplay } from "../src/lib/page-held.js";
import { SITEMAP_HELD_ENTRY_MAX_BYTES, SITEMAP_HELD_MAX_BYTES, clearHeldSitemaps, heldSitemaps, sitemapAnswer } from "../src/lib/sitemap-held.js";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const read = (rel: string): string => readFileSync(join(REPO, rel), "utf8");

/** One address per held page family (the page files of `src/pages/[lang]` that can be unavailable, fuel excepted). */
const FAMILIES: readonly [string, string][] = [
  ["place", "/de/place/koeln"],
  ["station", "/de/station/hamburg-hbf"],
  ["station stop", "/de/station/hamburg-hbf/stop/gleis-5"],
  ["station index", "/en/station"],
  ["motorway", "/de/autobahn/a1"],
  ["motorway exit", "/de/autobahn/a1/exit/koeln-nord"],
  ["motorway index", "/de/autobahn"],
  ["road", "/de/road/b1"],
  ["state", "/de/state/bayern"],
  ["states", "/de/states"],
  ["charging", "/de/charging/ionity-koeln"],
];
const NONCE = "abc123";
const BODY = (path: string): string => `<!doctype html><html><head><script type="application/ld+json" nonce="${NONCE}">{}</script></head><body><h1>${path}</h1></body></html>`;
const flags = { hasScript: true, hasForm: false, clarityPage: false };
/** What every database page layout sends: `no-store`, for freshness. */
const ok = (more: Record<string, string> = {}): Headers => new Headers({ "content-type": "text/html; charset=utf-8", "cache-control": "no-store", ...more });
const refused = (): Response => new Response(null, { status: 503, headers: { "retry-after": "60", [DEGRADED_HEADER]: "1" } });
type KeepOpts = { cls?: string | null; perVisitor?: boolean; cookie?: boolean; status?: number; headers?: Headers; method?: string; mapPlatform?: string; raw?: string };
const keep = (path: string, o: KeepOpts = {}): boolean =>
  keepRendered({
    method: o.method ?? "GET",
    url: new URL(`http://shell${path}`),
    mapPlatform: o.mapPlatform ?? "other",
    cls: o.cls === undefined ? "search" : o.cls,
    perVisitor: o.perVisitor ?? false,
    status: o.status ?? 200,
    headers: o.headers ?? ok(),
    cookie: o.cookie ?? false,
    raw: o.raw ?? BODY(path),
    nonce: NONCE,
    flags,
  });
const replay = (path: string, cls: string | null, o: { method?: string; mapPlatform?: string; response?: Response } = {}) =>
  verifiedReplay({ method: o.method ?? "GET", url: new URL(`http://shell${path}`), mapPlatform: o.mapPlatform ?? "other", cls, response: o.response ?? refused() });

afterEach(() => {
  clearHeldPages();
  clearHeldSitemaps();
});

describe("#1205 review S3: a verified crawler's miss is answered with the copy a verified crawler was served, per page family", () => {
  for (const [family, path] of FAMILIES) {
    it(`${family} (${path}): held → a 200 marked degraded, the copy's body and declarations; nothing held → the 503`, async () => {
      expect(HELD_PAGE.test(path), "a held page family").toBe(true);
      const none = replay(path, "search");
      expect(none.flags).toBeNull();
      expect(none.response.status).toBe(503);
      expect(keep(path)).toBe(true);
      const r = replay(path, "search");
      expect(r.response.status).toBe(200);
      expect(r.response.headers.get(DEGRADED_HEADER)).toBe("1");
      expect(r.response.headers.get("cache-control")).toBe("no-store");
      expect(r.flags).toEqual({ ...flags, cacheControl: "no-store" });
      const html = await r.response.text();
      expect(all(html, "h1").map(textOf)).toEqual([path]);
      expect(html, "the render's nonce is not replayed").not.toContain(NONCE);
    });
  }

  it("the family list is every page file that can be unavailable but fuel; fuel's addresses are not a held family", () => {
    const dir = join(REPO, "packages/web/src/pages/[lang]");
    const walk = (d: string, out: string[] = []): string[] => {
      for (const e of readdirSync(d)) {
        const p = join(d, e);
        if (statSync(p).isDirectory()) walk(p, out);
        else out.push(p);
      }
      return out;
    };
    const files = walk(dir).filter((f) => f.endsWith(".astro") && readFileSync(f, "utf8").includes('"unavailable"'));
    expect(files.length).toBe(11);
    for (const f of files) {
      const route = `/de/${f.slice(dir.length + 1).replace(/\.astro$/, "").replace(/\[\.\.\.[a-z]+\]|\[[a-z]+\]/g, "x")}`;
      expect(HELD_PAGE.test(route), route).toBe(!route.startsWith("/de/fuel"));
    }
    for (const p of ["/de", "/de/connect", "/de/news", "/de/search", "/sitemap.xml", "/de/fuel", "/de/fuel/aral-koeln", "/en/fuel/x"]) expect(HELD_PAGE.test(p), p).toBe(false);
  });
});

describe("#1205 review B1: only a verified crawler's own render that read no visitor is held; fuel never", () => {
  it("a person's render is never held, with or without a cookie; an unverified crawler's and an SEO tool's neither", () => {
    expect(keep("/de/place/koeln", { cls: null }), "a person, no cookie").toBe(false);
    expect(keep("/de/place/koeln", { cls: null, cookie: true }), "a person with a cookie").toBe(false);
    expect(keep("/de/place/koeln", { cls: "crawler" }), "an unverified crawler").toBe(false);
    expect(keep("/de/place/koeln", { cls: "seo" }), "an SEO tool").toBe(false);
    expect(heldPages().pages).toBe(0);
    expect(replay("/de/place/koeln", "search").response.status, "so nothing is replayed").toBe(503);
  });

  it("a verified crawler's render that read the visitor (locals.perVisitor) is never held, and so never replayed", () => {
    expect(keep("/en/station", { perVisitor: true })).toBe(false);
    expect(keep("/de/autobahn/a1", { perVisitor: true })).toBe(false);
    expect(heldPages().pages).toBe(0);
    expect(replay("/en/station", "search").response.status).toBe(503);
    expect(replay("/de/autobahn/a1", "search").response.status).toBe(503);
  });

  it("a fuel page is neither held nor replayed, whoever asked and whatever it answered", () => {
    for (const p of ["/de/fuel", "/de/fuel/aral-koeln", "/en/fuel/aral-koeln"]) {
      expect(keep(p), p).toBe(false);
      expect(replay(p, "search").response.status, p).toBe(503);
    }
    expect(heldPages().pages).toBe(0);
  });

  it("only the verified class is replayed: a person, an unverified crawler and an SEO tool keep what the page answered", () => {
    keep("/de/place/koeln");
    for (const cls of [null, "crawler", "seo"]) expect(replay("/de/place/koeln", cls).response.status, String(cls)).toBe(503);
    const page = new Response("<p>x</p>", { status: 200 });
    expect(replay("/de/place/koeln", "search", { response: page }).response).toBe(page);
    expect(replay("/de/place/koeln", "search", { mapPlatform: "ios" }).response.status).toBe(503);
    expect(replay("/de/place/bonn", "search").response.status).toBe(503);
    const head = replay("/de/place/koeln", "search", { method: "HEAD" });
    expect(head.response.status).toBe(200);
    expect(head.response.body).toBeNull();
  });

  it("only a whole render for a request without a cookie is kept", () => {
    expect(keep("/de/place/koeln", { cookie: true }), "a cookie").toBe(false);
    expect(keep("/de/place/koeln", { status: 404 }), "not a 200").toBe(false);
    expect(keep("/de/place/koeln", { headers: new Headers({ [DEGRADED_HEADER]: "1" }) }), "a degraded page").toBe(false);
    expect(keep("/de/place/koeln", { method: "HEAD" }), "a HEAD carries no body").toBe(false);
    expect(keep("/de/connect"), "not a held family").toBe(false);
    expect(heldPages().pages).toBe(0);
  });
});

describe("#1205 review S7: an answer that says it is one client's is never held", () => {
  const cases: [string, Record<string, string>][] = [
    ["Set-Cookie", { "set-cookie": "vf_lang=en; Path=/" }],
    ["Vary: Cookie", { vary: "Accept-Language, Cookie" }],
    ["Vary: *", { vary: "*" }],
    ["Vary: X-Forwarded-For (the home, the fuel page)", { vary: "Accept-Language, X-Forwarded-For" }],
    ["Cache-Control: private", { "cache-control": "private, no-cache" }],
    ["Cache-Control: private, no-store", { "cache-control": "private, no-store" }],
  ];
  for (const [name, h] of cases) {
    it(`${name}: refused`, () => {
      expect(answerIsPerClient(ok(h)), name).toBe(true);
      expect(keep("/de/place/koeln", { headers: ok(h) }), name).toBe(false);
      expect(heldPages().pages).toBe(0);
    });
  }
  it("no-store alone (every database page layout's freshness header) and Vary: Accept-Language are not a client's answer", () => {
    expect(answerIsPerClient(ok({ vary: "Accept-Language" }))).toBe(false);
    expect(keep("/de/place/koeln", { headers: ok({ vary: "Accept-Language" }) })).toBe(true);
  });
});

describe("#1205 review S9: the bytes counted are the bytes held", () => {
  it("a small gzip result is a view into a larger buffer; the copy kept owns exactly its length", () => {
    const gz = gzipSync("<p>hello</p>", { level: 1 });
    expect(gz.buffer.byteLength, "the measurement this rule rests on").toBeGreaterThan(gz.length * 10);
    const own = owned(gz);
    expect(own.buffer.byteLength).toBe(own.length);
    expect(own.equals(gz)).toBe(true);
  });

  it("after many small pages the count equals what their allocations hold, pages and sitemaps alike", () => {
    for (let i = 0; i < 200; i++) keep(`/de/place/p${String(i)}`);
    const p = heldPages();
    expect(p.pages).toBe(200);
    expect(p.backingBytes).toBe(p.bytes);
    expect(p.bytes).toBeLessThan(200 * 1024);
    for (let i = 0; i < 50; i++) sitemapAnswer(`sitemap-${String(i)}`, `<urlset><url><loc>https://viafrei.de/${String(i)}</loc></url></urlset>`);
    const s = heldSitemaps();
    expect(s.lists).toBe(50);
    expect(s.backingBytes).toBe(s.bytes);
  });
});

describe("#1205 review: a new answer too large to keep never costs the copy held", () => {
  it("set() compresses first: over the entry bound it answers false and the old copy STAYS, its bytes still counted", () => {
    const store = new HeldStore<string>(1024 * 1024, 4096);
    expect(store.set("k", "<p>small</p>", "old")).toBe(true);
    const before = store.stats();
    const big = randomBytes(64 * 1024).toString("base64");
    expect(store.set("k", big, "new")).toBe(false);
    expect(store.get("k")).toEqual({ text: "<p>small</p>", meta: "old" });
    expect(store.stats()).toEqual(before);
    expect(store.set("k", "<p>fits</p>", "new")).toBe(true);
    expect(store.get("k")).toEqual({ text: "<p>fits</p>", meta: "new" });
    expect(store.stats().entries).toBe(1);
  });
});

describe("#1205 review S3/S8: the bounds", () => {
  const noise = (bytes: number): string => randomBytes(bytes).toString("base64");

  it("pages: compressed bytes, the oldest copy goes first, an oversized body is not kept", () => {
    expect(PAGE_HELD_MAX_BYTES).toBe(8 * 1024 * 1024);
    for (let i = 0; i < 20; i++) keep(`/de/place/p${String(i)}`, { raw: noise(450_000) });
    const h = heldPages();
    expect(h.bytes).toBeLessThanOrEqual(PAGE_HELD_MAX_BYTES);
    expect(h.pages).toBeLessThan(20);
    expect(replay("/de/place/p0", "search").response.status, "the oldest went first").toBe(503);
    expect(replay("/de/place/p19", "search").response.status).toBe(200);
    clearHeldPages();
    expect(keep("/de/place/huge", { raw: noise(Math.ceil(PAGE_HELD_ENTRY_MAX_BYTES * 1.2)) })).toBe(false);
    expect(heldPages().pages, "a body over the entry bound is not kept").toBe(0);
  });

  it("sitemaps (S8): a planted 2 MB list is held compressed and served back whole; the bound holds in bytes, oldest first", async () => {
    expect(SITEMAP_HELD_MAX_BYTES).toBe(4 * 1024 * 1024);
    // a urlset of ~2 MB whose random slugs compress about 6:1 (~330 KB): sixteen of them are over the 4 MiB bound
    const urls = (seed: number): string => {
      let s = "<urlset>";
      while (s.length < 2_000_000) s += `<url><loc>https://viafrei.de/de/place/${randomBytes(9).toString("hex")}-${String(seed)}</loc></url>`;
      return `${s}</urlset>`;
    };
    const big = urls(0);
    expect(big.length).toBeGreaterThanOrEqual(2_000_000);
    sitemapAnswer("sitemap-places-de-0", big);
    const one = heldSitemaps();
    expect(one.lists).toBe(1);
    expect(one.bytes, "held compressed").toBeLessThan(big.length / 2);
    expect(one.bytes).toBeLessThanOrEqual(SITEMAP_HELD_ENTRY_MAX_BYTES);
    const back = sitemapAnswer("sitemap-places-de-0", null);
    expect(back.headers.get(DEGRADED_HEADER)).toBe("1");
    expect(await back.text()).toBe(big);
    for (let i = 1; i < 16; i++) sitemapAnswer(`sitemap-places-de-${String(i)}`, urls(i));
    const many = heldSitemaps();
    expect(many.bytes).toBeLessThanOrEqual(SITEMAP_HELD_MAX_BYTES);
    expect(many.lists).toBeLessThan(16);
    expect(sitemapAnswer("sitemap-places-de-0", null).status, "the oldest went first").toBe(503);
    expect(sitemapAnswer("sitemap-places-de-15", null).status).toBe(200);
  });
});

describe("#1205 review S3: the count and the middleware's wiring", () => {
  it("the last resort is counted apart: its own count and its own log kind", () => {
    countVerifiedRefused("/de/place/:slug", 503, 12);
    countVerifiedRefused(null, 503, 3);
    expect(heldPages().verifiedRefused).toBe(2);
    expect(read("packages/web/src/lib/page-held.ts")).toMatch(/logLine\(40, \{ kind: "verified_refused"/);
  });

  it("the middleware replays before it logs and hands keepRendered the request's class and the render's perVisitor", () => {
    const src = read("packages/web/src/middleware.ts");
    expect(src.indexOf("verifiedReplay({")).toBeLessThan(src.indexOf('kind: "route_5xx"'));
    expect(src).toMatch(/keepRendered\(\{[^}]*\bcls, perVisitor: context\.locals\.perVisitor === true,/);
  });
});

describe("#1205 review S3: a sitemap a verified crawler asks for is its last list whenever one was built", () => {
  it("held → the list, marked degraded; nothing held → the 503 the middleware counts for a verified crawler", async () => {
    expect(sitemapAnswer("sitemap-stations-de", null, 300).status).toBe(503);
    sitemapAnswer("sitemap-stations-de", "<urlset/>");
    const held = sitemapAnswer("sitemap-stations-de", null, 300);
    expect(held.status).toBe(200);
    expect(held.headers.get(DEGRADED_HEADER)).toBe("1");
    expect(await held.text()).toBe("<urlset/>");
  });
});
