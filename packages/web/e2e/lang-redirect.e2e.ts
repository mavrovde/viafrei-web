/**
 * "Redirect once" (owner 2026-10-27, 2.4.4), against the BUILT shell in a real browser:
 *   - a Bulgarian browser that ENTERS on a German page (no Referer, a typed address) lands on the same page in
 *     Bulgarian, the query and the fragment kept;
 *   - a choice in the language menu is kept in `vf_lang` (first party, HttpOnly, a year) and the address is clean;
 *   - owner rule 2026-10-27: after ANY menu choice — German or Bulgarian — a re-entry on a German page stays German;
 *   - a click from one of our own pages to a German page is never redirected (Sec-Fetch-Site: same-origin);
 *   - at the HTTP level: the 302's headers, a robot, HEAD, and the German page's own Vary/Cache-Control.
 * The decision table itself is `test/lang-redirect.test.ts`.
 */
import type { ChildProcess } from "node:child_process";
import { request } from "node:http";
import { chromium, type Browser, type BrowserContext } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startShell } from "./server.js";
import { startStubDigest } from "./stub-digest.js";

const PORT = 8911;
const BASE = `http://127.0.0.1:${String(PORT)}`;
/** A person's browser: the headless default announces itself as HeadlessChrome, which the shell treats as a robot. */
const CHROME = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
let shell: ChildProcess;
let stub: Awaited<ReturnType<typeof startStubDigest>>;
let browser: Browser;

beforeAll(async () => {
  stub = await startStubDigest({});
  shell = await startShell(PORT, { DIGEST_URL: stub.url, IMPRESSUM_NAME: "Lang Probe", IMPRESSUM_STREET: "Probeweg 5", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "lang@example.invalid" });
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await stub?.close();
});

const bgContext = (): Promise<BrowserContext> => browser.newContext({ locale: "bg-BG", userAgent: CHROME });
const path = (url: string): string => {
  const u = new URL(url);
  return `${u.pathname}${u.search}${u.hash}`;
};

describe("a Bulgarian browser entering on a German page (2.4.4)", () => {
  it("lands once on the same page in Bulgarian, the query and the fragment kept", async () => {
    const ctx = await bgContext();
    try {
      const page = await ctx.newPage();
      await page.goto(`${BASE}/de/connect?x=1#beta`, { waitUntil: "load" });
      expect(path(page.url())).toBe("/bg/connect?x=1#beta");
      expect(await page.getAttribute("html", "lang")).toBe("bg");
      expect(await ctx.cookies()).toEqual([]);
    } finally {
      await ctx.close();
    }
  });

  it("picks Deutsch in the menu: the German page, a clean address, vf_lang=de; a re-entry on /de stays German", async () => {
    const ctx = await bgContext();
    try {
      const page = await ctx.newPage();
      await page.goto(`${BASE}/de/connect`, { waitUntil: "load" });
      expect(path(page.url())).toBe("/bg/connect");
      await page.click(".site-head .langmenu__summary");
      await Promise.all([page.waitForURL(`${BASE}/de/connect`), page.click('.site-head .langmenu__panel a[hreflang="de"]')]);
      expect(path(page.url())).toBe("/de/connect");
      const cookies = await ctx.cookies();
      expect(cookies.map((c) => ({ name: c.name, value: c.value, httpOnly: c.httpOnly, path: c.path, sameSite: c.sameSite }))).toEqual([{ name: "vf_lang", value: "de", httpOnly: true, path: "/", sameSite: "Lax" }]);
      const year = Date.now() / 1000 + 364 * 86_400;
      expect(cookies[0]?.expires ?? 0).toBeGreaterThan(year);

      const again = await ctx.newPage();
      await again.goto(`${BASE}/de/connect`, { waitUntil: "load" });
      expect(path(again.url())).toBe("/de/connect");
      await again.goto(`${BASE}/de/developers`, { waitUntil: "load" });
      expect(path(again.url())).toBe("/de/developers");
    } finally {
      await ctx.close();
    }
  });

  it("owner rule 2026-10-27: a Bulgarian choice in the menu also ends the switching — a re-entry on /de stays German", async () => {
    const ctx = await bgContext();
    try {
      const page = await ctx.newPage();
      await page.goto(`${BASE}/de/business`, { waitUntil: "load" });
      expect(path(page.url())).toBe("/bg/business");
      await page.click(".site-head .langmenu__summary");
      await Promise.all([page.waitForURL(`${BASE}/bg/business`), page.click('.site-head .langmenu__panel a[hreflang="bg"]')]);
      expect((await ctx.cookies()).map((c) => `${c.name}=${c.value}`)).toEqual(["vf_lang=bg"]);
      const again = await ctx.newPage();
      await again.goto(`${BASE}/de/business`, { waitUntil: "load" });
      expect(path(again.url())).toBe("/de/business");
    } finally {
      await ctx.close();
    }
  });

  it("a navigation from one of our own pages to a German page is never redirected", async () => {
    const ctx = await bgContext();
    try {
      const page = await ctx.newPage();
      await page.goto(`${BASE}/bg/connect`, { waitUntil: "load" });
      await Promise.all([page.waitForURL(`${BASE}/de/developers`), page.evaluate(() => { window.location.href = "/de/developers"; })]);
      expect(path(page.url())).toBe("/de/developers");
      expect(await ctx.cookies()).toEqual([]);
    } finally {
      await ctx.close();
    }
  });

  it("a German browser is never redirected", async () => {
    const ctx = await browser.newContext({ locale: "de-DE", userAgent: CHROME });
    try {
      const page = await ctx.newPage();
      await page.goto(`${BASE}/de/connect`, { waitUntil: "load" });
      expect(path(page.url())).toBe("/de/connect");
    } finally {
      await ctx.close();
    }
  });
});

describe("the HTTP answers", () => {
  // node:http and not fetch: undici adds `Sec-Fetch-Mode: cors` and `Accept-Language: *` to every request, which would
  // make each case below "not a navigation" and pass the 200s for the wrong reason. These send exactly what is named.
  type Answer = { readonly status: number; readonly headers: { get(name: string): string | null } };
  const get = (p: string, headers: Readonly<Record<string, string>>, method = "GET"): Promise<Answer> =>
    new Promise((resolve, reject) => {
      const req = request(`${BASE}${p}`, { method, headers }, (res) => {
        res.resume();
        res.on("end", () => {
          const h = res.headers;
          resolve({ status: res.statusCode ?? 0, headers: { get: (n) => { const v = h[n.toLowerCase()]; return v === undefined ? null : Array.isArray(v) ? v.join(", ") : v; } } });
        });
      });
      req.on("error", reject);
      req.end();
    });

  it("the probe sends what it names and nothing else: a Bulgarian navigation is a 302", async () => {
    expect((await get("/de/connect", { "user-agent": CHROME, "accept-language": "bg" })).status).toBe(302);
  });

  it("the 302 names the twin and is private, no-store and varies with the language headers", async () => {
    const r = await get("/de/place/koeln?topics=roads", { "user-agent": CHROME, "accept-language": "bg-BG,bg;q=0.9", "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate" });
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toBe("/bg/place/koeln?topics=roads");
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    expect(r.headers.get("vary")).toBe("Accept-Language, Cookie");
    expect(r.headers.get("set-cookie")).toBeNull();
  });

  it("the German page itself, not redirected, is private and varies with Accept-Language and Cookie", async () => {
    const r = await get("/de/connect", { "user-agent": CHROME, "accept-language": "de-DE" });
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toMatch(/private/);
    const vary = (r.headers.get("vary") ?? "").split(",").map((s) => s.trim());
    expect(vary).toEqual(expect.arrayContaining(["Accept-Language", "Cookie", "User-Agent"]));
  });

  it("a robot, a HEAD, and a request with only `*` are answered 200 where they asked", async () => {
    expect((await get("/de/connect", { "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1)", "accept-language": "bg" })).status).toBe(200);
    expect((await get("/de/connect", { "user-agent": CHROME, "accept-language": "bg" }, "HEAD")).status).toBe(200);
    expect((await get("/de/connect", { "user-agent": "curl/8.7.1", "accept-language": "*" })).status).toBe(200);
    expect((await get("/de/connect", { "user-agent": CHROME })).status, "no Accept-Language at all, as the deploy probes send").toBe(200);
  });

  it("a cookie of the choice, whatever it names, ends the switching", async () => {
    for (const c of ["vf_lang=de", "vf_lang=bg"]) {
      expect((await get("/de/connect", { "user-agent": CHROME, "accept-language": "bg", cookie: c })).status, c).toBe(200);
    }
  });

  it("the menu's marker from another site is stripped without storing anything", async () => {
    const r = await get("/de/connect?setlang=1", { "user-agent": CHROME, "sec-fetch-site": "cross-site" });
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toBe("/de/connect");
    expect(r.headers.get("set-cookie")).toBeNull();
  });
});
