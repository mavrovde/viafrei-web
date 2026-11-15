/**
 * Spikes S2 and S3 of #376, asserted rather than described.
 *
 * S2 — CSP + CSS: the page renders under
 *   `default-src 'none'; style-src 'self'; img-src 'self'; connect-src 'self'; script-src 'none'`
 *   with ZERO console CSP errors, ONE external stylesheet at
 *   `/_a/site.<hash>.css` with an immutable cache header, and no <script>.
 * S3 — the consent island: with GOOGLE_TAG set, the one island is on the page
 *   under `script-src 'nonce-…' 'strict-dynamic' <googletagmanager>`, every
 *   script carries that nonce, nothing is fetched from Google before the
 *   accept control is clicked, one gtag.js request follows the click, a
 *   remembered consent sends page_view and no second consent_accept on the
 *   next page (#477), and a decline is remembered — no Google request on
 *   reload. Without a tag the
 *   document holds zero <script> elements.
 *
 * Two real servers from `dist/` (one per case), one real Chromium. Every
 * request to a Google host is answered by Playwright's router so the test
 * never reaches the network (PLAYBOOK §2 rule 3). A missing `dist/` is a
 * FAILURE with the build command in the message — never a skip.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GTAG_ORIGIN, contentSecurityPolicy } from "../src/security/csp.js";
import { LIVE_LANGS } from "../src/site/pages.js";
import { LIMITS } from "../scripts/budget.js";
import { startStubDigest } from "./stub-digest.js";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENTRY = process.env["WEB_E2E_ENTRY"] ?? join(PKG, "dist", "server", "entry.mjs"); // the override of server.ts
const NO_TAG_PORT = 8795;
const TAG_PORT = 8796;
const FAKE_TAG = "G-0"; // a placeholder; never a real measurement id (GA rule 3)

const servers: ChildProcess[] = [];
let browser: Browser;
let stub: Awaited<ReturnType<typeof startStubDigest>>;

async function boot(port: number, tag: string): Promise<void> {
  const child = spawn("node", [ENTRY], {
    env: { ...process.env, HOST: "127.0.0.1", PORT: String(port), ASTRO_NODE_LOGGING: "disabled", GOOGLE_TAG: tag, CLARITY_PROJECT_ID: "", CLARITY_ENABLED: "", DIGEST_URL: stub.url },
    stdio: "ignore",
  });
  servers.push(child);
  const until = Date.now() + 10_000;
  while (Date.now() < until) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/de`);
      if (r.ok) return;
    } catch {
      /* not yet */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`the web server did not answer on ${port} within 10 s`);
}

type Observed = { csp: string[]; errors: string[]; google: string[] };

/** Open a page that records CSP violations, console errors and every request to a Google host — answered locally, never sent. */
async function open(port: number, path: string): Promise<{ page: Page; seen: Observed; headers: Record<string, string> }> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const seen: Observed = { csp: [], errors: [], google: [] };
  page.on("console", (m) => {
    const text = m.text();
    if (/Content.Security.Policy|Refused to/i.test(text)) seen.csp.push(text);
    else if (m.type() === "error") seen.errors.push(text);
  });
  page.on("pageerror", (e) => seen.errors.push(`pageerror: ${e.message}`));
  await page.route(/https:\/\/([a-z0-9-]+\.)*(googletagmanager|google-analytics|analytics\.google)\.com\/.*/, (route) => {
    seen.google.push(route.request().url());
    void route.fulfill({ status: 200, contentType: "application/javascript", body: "/* intercepted by csp.e2e.ts — never fetched */" });
  });
  const response = await page.goto(`http://127.0.0.1:${port}${path}`, { waitUntil: "networkidle" });
  if (!response) throw new Error(`no response for ${path}`);
  return { page, seen, headers: response.headers() };
}

beforeAll(async () => {
  if (!existsSync(ENTRY)) {
    throw new Error(`${ENTRY} is missing — run \`npm run web:build\` first; this suite refuses to pass on nothing`);
  }
  stub = await startStubDigest({});
  await Promise.all([boot(NO_TAG_PORT, ""), boot(TAG_PORT, FAKE_TAG)]);
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
  for (const s of servers) s.kill();
  await stub?.close();
});

describe("#944: every HTML answer varies on the User-Agent, on both of the middleware's paths", () => {
  // The map links follow the User-Agent's platform: a shared cache must never serve one platform's page to another.
  // Both servers: without a tag a script-less page leaves through the plain path, a page with a script (or any page with a tag) through the nonce path.
  const listed = (v: string | null): string[] => (v ?? "").split(",").map((x) => x.trim().toLowerCase());
  for (const [port, paths] of [[NO_TAG_PORT, ["/de/connect", "/de", "/en/news"]], [TAG_PORT, ["/de", "/en/connect"]]] as const)
    for (const path of paths)
      it(`${port === TAG_PORT ? "with a tag" : "without a tag"} ${path}: Vary names User-Agent, once`, async () => {
        const r = await fetch(`http://127.0.0.1:${port}${path}`, { headers: { "user-agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile" } });
        expect(r.status).toBe(200);
        expect(r.headers.get("content-type")).toMatch(/^text\/html/);
        expect(listed(r.headers.get("vary")).filter((x) => x === "user-agent")).toHaveLength(1);
      });
  it("a stylesheet is no HTML answer: it does not vary on the User-Agent", async () => {
    const html = await (await fetch(`http://127.0.0.1:${NO_TAG_PORT}/de`)).text();
    const href = /<link rel="stylesheet" href="([^"]+)"/.exec(html)?.[1] ?? "";
    expect(href).toMatch(/^\/_a\//);
    expect(listed((await fetch(`http://127.0.0.1:${NO_TAG_PORT}${href}`)).headers.get("vary"))).not.toContain("user-agent");
  });
});

describe("S2 — one external stylesheet under the no-script CSP", () => {
  // The home carries the board's inline script since #404, since #1003 every page with an endpoint chip (the connect
  // page among them) carries its copy script, and since #1111 every page but the fuel board carries the header search's
  // type-ahead; the fuel board ran no script from v1.8.18 and, since #1198 (owner 2026-11-06, "add the place script"),
  // carries the header's place script — under this request's nonce, with no analytics and no Google origin.
  for (const path of ["/de/fuel", "/en/fuel"]) {
    it(`${path}: the header is the nonce policy with no Google origin and the console shows no CSP error`, async () => {
      const { page, seen, headers } = await open(NO_TAG_PORT, path);
      const nonce = /'nonce-([A-Za-z0-9_-]{16,})'/.exec(headers["content-security-policy"] ?? "")?.[1] ?? "";
      // #1111: the header search is a GET form to this origin on every page, so the policy says `form-action 'self'`
      expect(headers["content-security-policy"]).toBe(contentSecurityPolicy(nonce, undefined, true, true));
      for (const d of ["default-src 'none'", `style-src 'self' 'nonce-${nonce}'`, "img-src 'self'", `script-src 'nonce-${nonce}' 'strict-dynamic'`, "form-action 'self'"]) {
        expect(headers["content-security-policy"]).toContain(d);
      }
      expect(headers["content-security-policy"]).not.toMatch(/google|clarity/u);
      expect(await page.$$eval("script:not([type='application/ld+json'])", (ss, n) => ss.filter((x) => x.nonce !== n).length, nonce)).toBe(0);
      expect(seen.csp).toEqual([]);
      expect(seen.errors).toEqual([]);
      expect(seen.google).toEqual([]);
      await page.context().close();
    });
  }

  for (const path of ["/de", "/en"]) {
    it(`${path}: exactly one stylesheet, at /_a/site.<hash>.css, immutable, and it applied`, async () => {
      const { page } = await open(NO_TAG_PORT, path);
      const sheets = await page.$$eval('link[rel="stylesheet"]', (ls) => ls.map((l) => l.getAttribute("href") ?? ""));
      expect(sheets).toHaveLength(1);
      expect(sheets[0]).toMatch(/^\/_a\/site\.[A-Za-z0-9_-]+\.css$/);
      const css = await fetch(`http://127.0.0.1:${NO_TAG_PORT}${sheets[0]}`);
      expect(css.status).toBe(200);
      // the APP's header; the public edge replaces it with a 300 s revalidating one (the edge asset rules, #1185 V5)
      expect(css.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
      expect(css.headers.get("content-type")).toMatch(/^text\/css/);
      // the stylesheet was not blocked: a token-driven colour reached the body
      const bg = await page.$eval("body", (b) => getComputedStyle(b).backgroundColor);
      expect(bg).toBe("rgb(243, 245, 248)"); // --bg in the light theme
      // no style attribute in the markup (the CSP refuses one); the ONE property a script sets through the CSSOM, which
      // the CSP allows, is the desktop dashboard's header height on <html> (#1180, `lib/desk.ts`: `--desk-top`), and only
      // from 1024 px: below, the script writes nothing, so the exception does not hold there
      const desk = (page.viewportSize()?.width ?? 0) >= 1024;
      const inlineStyles = await page.$$eval("[style]", (els, d) => els.filter((e) => !(d && e === document.documentElement && /^--desk-top: \d+px;$/.test(e.getAttribute("style") ?? ""))).length, desk);
      expect(inlineStyles).toBe(0);
      const served = await (await fetch(`http://127.0.0.1:${NO_TAG_PORT}${path}`)).text();
      expect(served).not.toMatch(/<[a-z][^>]*\sstyle=/i);
      await page.context().close();
    });
  }

  it("without a tag the developers page holds SEVEN executable <script>s — since #1174 the bottom bar's fallback, since #1153 the header's place headline and location island beside the station type-ahead, since #992 the code boxes' and the endpoint chip's copy, since #1186 the recent places' kinds — and no Google string, beside its JSON-LD data block, all under this request's nonce (#531)", async () => {
    const { page, headers, seen } = await open(NO_TAG_PORT, "/de/developers");
    const csp = headers["content-security-policy"] ?? "";
    const nonce = /'nonce-([A-Za-z0-9_-]+)'/.exec(csp)?.[1] ?? "";
    expect(nonce.length).toBeGreaterThanOrEqual(16);
    expect(csp).toContain(`script-src 'nonce-${nonce}' 'strict-dynamic';`);
    expect(csp).not.toContain("google");
    expect(await page.$$eval("script:not([type='application/ld+json'])", (ss) => ss.map((x) => ({ src: x.getAttribute("src"), nonce: x.nonce })))).toEqual([
      { src: null, nonce },
      { src: null, nonce },
      { src: null, nonce },
      { src: null, nonce },
      { src: null, nonce },
      { src: null, nonce },
      { src: null, nonce },
    ]);
    const ld = await page.$$eval("script[type='application/ld+json']", (ss) => ss.map((x) => ({ nonce: x.nonce ?? "", text: x.textContent ?? "" })));
    expect(ld).toHaveLength(1);
    expect(ld[0]!.nonce).toBe(nonce);
    expect(() => JSON.parse(ld[0]!.text) as unknown).not.toThrow();
    expect(seen.csp).toEqual([]);
    expect(await page.content()).not.toContain("googletagmanager");
    await page.context().close();
  });

  it("without a tag the home holds exactly TWELVE scripts — since #1181 the starred road's commute card's, since #1180 the desktop dashboard's, since #1174 the bottom bar's fallback, the board's, since #564 the place block's and the render-then-fill filler's, since #1003 the endpoint chip's copy, since #939 the place cards' in-place refresh, since #707 the SID gate's, since 2.4.4 (review B2) the charging filter's submit, since #1088 the place headline's, since 2.4.6 the station search's type-ahead, since #1186 the recent places' kinds, all inline under this request's nonce — and the nonce policy with no Google origin (#404)", async () => {
    const { page, seen, headers } = await open(NO_TAG_PORT, "/de");
    const csp = headers["content-security-policy"] ?? "";
    const nonce = /'nonce-([A-Za-z0-9_-]+)'/.exec(csp)?.[1] ?? "";
    expect(nonce.length).toBeGreaterThanOrEqual(16);
    expect(csp).toContain(`script-src 'nonce-${nonce}' 'strict-dynamic';`);
    expect(csp).not.toContain("google");
    const scripts = await page.$$eval("script:not([type='application/ld+json'])", (ss) => ss.map((x) => ({ src: x.getAttribute("src"), nonce: x.nonce })));
    expect(scripts).toEqual([
      { src: null, nonce },
      { src: null, nonce },
      { src: null, nonce },
      { src: null, nonce },
      { src: null, nonce },
      { src: null, nonce },
      { src: null, nonce },
      { src: null, nonce },
      { src: null, nonce },
      { src: null, nonce },
      { src: null, nonce },
      { src: null, nonce },
    ]);
    // and the JSON-LD data block (#531), which runs nothing, carries the same nonce
    expect(await page.$$eval("script[type='application/ld+json']", (ss) => ss.map((x) => x.nonce))).toEqual([nonce]);
    expect(seen.csp).toEqual([]);
    expect(seen.errors).toEqual([]);
    expect(seen.google).toEqual([]);
    expect(await page.content()).not.toContain("googletagmanager");
    await page.context().close();
  });

  it("the home is two requests to this origin — the document and the stylesheet (A8)", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const urls: string[] = [];
    page.on("request", (r) => urls.push(r.url()));
    await page.goto(`http://127.0.0.1:${NO_TAG_PORT}/de`, { waitUntil: "networkidle" });
    const ours = urls.filter((u) => u.startsWith(`http://127.0.0.1:${NO_TAG_PORT}/`) && !u.endsWith("/favicon.svg"));
    expect(ours).toHaveLength(2);
    expect(urls.filter((u) => !u.startsWith("http://127.0.0.1:"))).toEqual([]);
    await ctx.close();
  });

  it("stays inside the page budget: raw HTML under the gate's limit (LIMITS.rawHtml), under the gate's gzip limit (LIMITS.gzipTotal, D2; 200 KB since #1064, owner 2026-10-25)", async () => {
    const r = await fetch(`http://127.0.0.1:${NO_TAG_PORT}/de`);
    const html = await r.text();
    expect(html.length).toBeLessThan(LIMITS.rawHtml);
    const { gzipSync } = await import("node:zlib");
    const sheet = /href="(\/_a\/site\.[^"]+\.css)"/.exec(html)?.[1] ?? "";
    const css = await (await fetch(`http://127.0.0.1:${NO_TAG_PORT}${sheet}`)).text();
    const transfer = gzipSync(html).length + gzipSync(css).length;
    // #1064: the gate's own limit (200 KB since the owner decision of 2026-10-25; 80 KB since #891), never a second copy of it.
    expect(transfer).toBeLessThan(LIMITS.gzipTotal);
  });
});

describe("S3 — the consent island, the only script, only with a tag", () => {
  it("with a tag: the nonce policy, every script carries the nonce, zero CSP errors, nothing from Google before consent", async () => {
    const { page, seen, headers } = await open(TAG_PORT, "/de");
    const csp = headers["content-security-policy"] ?? "";
    const nonce = /'nonce-([A-Za-z0-9_-]+)'/.exec(csp)?.[1];
    expect(nonce, csp).toBeDefined();
    expect(csp).toContain(`script-src 'nonce-${nonce}' 'strict-dynamic' ${GTAG_ORIGIN}`);
    expect(csp).not.toMatch(/script-src[^;]*'self'/);
    // `.nonce`, not getAttribute: browsers hide the attribute value from the DOM on purpose
    const scripts = await page.$$eval("script", (s) => s.map((x) => x.nonce));
    expect(scripts.length).toBeGreaterThan(0);
    for (const n of scripts) expect(n).toBe(nonce);
    expect(await page.$("astro-island")).not.toBeNull();
    await page.waitForSelector(".consent[role=dialog]", { state: "visible" });
    expect(seen.csp).toEqual([]);
    expect(seen.errors).toEqual([]);
    expect(seen.google).toEqual([]);
    // decline has the same size as accept (GA rule 1)
    const [no, yes] = await page.$$eval(".consent__actions .btn", (b) => b.map((x) => x.getBoundingClientRect()));
    expect(no?.height).toBe(yes?.height);
    expect(Math.abs((no?.width ?? 0) - (yes?.width ?? 0))).toBeLessThan(2);
    // Owner 2026-10-19: agree is the default action — the accept control has the focus
    // when the bar opens, decline stays first and one step away. Focus is no consent:
    // nothing has gone to Google while the focused bar waits for a press.
    await page.waitForFunction(() => document.activeElement === document.querySelector(".consent__actions .btn:last-child"));
    await page.waitForTimeout(300);
    expect(seen.google).toEqual([]);
    expect(await page.evaluate(() => localStorage.getItem("viafrei.consent.analytics"))).toBeNull();
    // Data-steward condition: the purpose is read out before the focused action.
    expect(await page.$eval(".consent[role=dialog]", (d) => d.getAttribute("aria-describedby"))).toBe("vf-consent-body");
    expect(await page.$eval("#vf-consent-body", (b) => (b.textContent ?? "").trim().length)).toBeGreaterThan(20);
    await page.context().close();
  });

  it("Escape on the focused bar refuses in one step: denied is remembered and nothing goes to Google", async () => {
    const { page, seen } = await open(TAG_PORT, "/de");
    await page.waitForSelector(".consent[role=dialog]", { state: "visible" });
    await page.waitForFunction(() => document.activeElement === document.querySelector(".consent__actions .btn:last-child"));
    await page.keyboard.press("Escape");
    expect(await page.$(".consent[role=dialog]")).toBeNull();
    expect(await page.evaluate(() => (localStorage.getItem("viafrei.consent.analytics") ?? "").split("|")[0])).toBe("denied");
    await page.waitForTimeout(300);
    expect(seen.google).toEqual([]);
    await page.context().close();
  });

  it("accept loads gtag.js (intercepted) exactly once; decline is remembered and sends nothing on reload", async () => {
    const a = await open(TAG_PORT, "/de");
    await a.page.waitForSelector(".consent[role=dialog]", { state: "visible" });
    await a.page.click(".consent__actions .btn:last-child"); // accept
    await a.page.waitForFunction(() => (window as unknown as { vfAnalytics?: boolean }).vfAnalytics === true);
    await a.page.waitForTimeout(200);
    expect(a.seen.google.filter((u) => u.startsWith(`${GTAG_ORIGIN}/gtag/js?id=`))).toHaveLength(1);
    // gtag.js reads ARGUMENTS objects off the dataLayer and drops arrays: every
    // entry must be Arguments-like, and the consent update, the config and the
    // two events must all be there in that shape.
    const layer = await a.page.evaluate(() =>
      ((window as unknown as { dataLayer?: unknown[] }).dataLayer ?? []).map((e) => ({ kind: Object.prototype.toString.call(e), first: (e as ArrayLike<unknown>)[0], second: (e as ArrayLike<unknown>)[1] })),
    );
    expect(layer.length).toBeGreaterThanOrEqual(5);
    for (const e of layer) expect(e.kind).toBe("[object Arguments]");
    expect(layer.map((e) => `${String(e.first)}:${typeof e.second === "string" ? e.second : ""}`)).toEqual(
      expect.arrayContaining(["consent:default", "consent:update", "config:G-0", "event:page_view", "event:consent_accept"]),
    );
    expect(a.seen.csp).toEqual([]);
    expect(await a.page.$(".consent[role=dialog]")).toBeNull();
    // #477: a remembered consent loads the tag and sends page_view on the next
    // page, and never a second consent_accept — the decision is one event.
    await a.page.goto(`http://127.0.0.1:${TAG_PORT}/en`, { waitUntil: "networkidle" });
    await a.page.waitForFunction(() => (window as unknown as { vfAnalytics?: boolean }).vfAnalytics === true);
    expect(await a.page.$(".consent[role=dialog]")).toBeNull();
    const events = await a.page.evaluate(() =>
      ((window as unknown as { dataLayer?: unknown[] }).dataLayer ?? [])
        .map((e) => e as ArrayLike<unknown>)
        .filter((e) => e[0] === "event")
        .map((e) => String(e[1])),
    );
    // #564: the home also reports HOW it found the place (`location_source`), never the place
    expect(events).toEqual(["page_view", "location_source"]);
    await a.page.context().close();

    const d = await open(TAG_PORT, "/en");
    await d.page.waitForSelector(".consent[role=dialog]", { state: "visible" });
    // F-10: cookies an EARLIER consent left (its twelve months ran out) are expired by the decline.
    await d.page.context().addCookies([
      { name: "_ga", value: "GA1.1.1.1", url: `http://127.0.0.1:${TAG_PORT}/` },
      { name: "_gid", value: "GA1.1.2", url: `http://127.0.0.1:${TAG_PORT}/` },
    ]);
    await d.page.click(".consent__actions .btn:first-child"); // decline
    expect(await d.page.$(".consent[role=dialog]")).toBeNull();
    expect((await d.page.context().cookies()).map((c) => c.name)).toEqual([]);
    await d.page.reload({ waitUntil: "networkidle" });
    await d.page.waitForTimeout(200);
    expect(await d.page.$(".consent[role=dialog]")).toBeNull(); // remembered
    expect(d.seen.google).toEqual([]);
    expect(d.seen.csp).toEqual([]);
    await d.page.context().close();
  });

  it("the tag value itself never appears in the no-tag document, and the island is absent there", async () => {
    const r = await fetch(`http://127.0.0.1:${NO_TAG_PORT}/de`);
    const html = await r.text();
    expect(html).not.toContain("astro-island");
    expect(html).not.toContain(FAKE_TAG);
  });
});

describe("#1003: the connect page's scripts are the endpoint chip's copy, (#1153) the header's place headline, location island and the type-ahead, and (#1186) the recent places' kinds, under the nonce policy and no Google origin", () => {
  it("/de/connect without a tag: seven inline scripts (since #1174 the bottom bar's fallback, since #1180 the desktop dashboard's) under this request's nonce, no CSP error, and the chip's button revealed by it", async () => {
    const { page, seen, headers } = await open(NO_TAG_PORT, "/de/connect");
    const csp = headers["content-security-policy"] ?? "";
    const nonce = /'nonce-([A-Za-z0-9_-]+)'/.exec(csp)?.[1] ?? "";
    expect(nonce.length).toBeGreaterThanOrEqual(16);
    expect(csp).toContain(`script-src 'nonce-${nonce}' 'strict-dynamic';`);
    expect(csp).not.toContain("google");
    expect(await page.$$eval("script:not([type='application/ld+json'])", (ss) => ss.map((x) => ({ src: x.getAttribute("src"), nonce: x.nonce })))).toEqual([
      { src: null, nonce },
      { src: null, nonce },
      { src: null, nonce },
      { src: null, nonce },
      { src: null, nonce },
      { src: null, nonce },
      { src: null, nonce },
    ]);
    expect(await page.$$eval(".endpoint-chip__copy", (bs) => bs.length > 0 && bs.every((b) => !(b as HTMLButtonElement).hidden))).toBe(true);
    expect(seen.csp).toEqual([]);
    expect(seen.errors).toEqual([]);
    await page.context().close();
  });
});

describe("#1144: the 404 page's scripts carry the nonce its policy names — every language, every way a 404 is reached", () => {
  // An address no route matches is rendered as `404.astro` by a second middleware pass inside the first; the outer
  // pass used to write a fresh nonce into the header while the body kept the inner one, and the browser refused the
  // page's script (seen on prod at an unmatched root path). The pair is judged on the answer itself, per language.
  const nonces = (html: string): string[] => [...html.matchAll(/<script\b[^>]*\snonce="([^"]*)"/g)].map((m) => m[1] ?? "");
  for (const port of [NO_TAG_PORT, TAG_PORT])
    it(`${port === TAG_PORT ? "with a tag" : "without a tag"}: header and body name one nonce on /<lang>/404, /<lang>/<nothing> and /<nothing> in each language`, async () => {
      const seen: string[] = [];
      for (const lang of LIVE_LANGS)
        for (const path of [`/${lang}/404`, `/${lang}/no-such-page-1144`, "/no-such-page-1144"]) {
          const r = await fetch(`http://127.0.0.1:${port}${path}`, { headers: { "accept-language": lang } });
          const csp = r.headers.get("content-security-policy") ?? "";
          const nonce = /'nonce-([A-Za-z0-9_-]{16,})'/.exec(csp)?.[1] ?? "";
          const body = nonces(await r.text());
          expect(r.status, `${lang} ${path}`).toBe(404);
          expect(body.length, `${lang} ${path}: at least the JSON-LD block`).toBeGreaterThan(0);
          expect(body.filter((n) => n !== nonce), `${lang} ${path}: a script under another nonce than the header's`).toEqual([]);
          seen.push(path);
        }
      expect(seen).toHaveLength(LIVE_LANGS.length * 3);
    });

  for (const path of ["/no-such-page-1144", "/de/no-such-page-1144", "/en/404"])
    it(`with a tag, in a real browser: ${path} raises no CSP violation`, async () => {
      const { page, seen } = await open(TAG_PORT, path);
      expect(seen.csp).toEqual([]);
      await page.context().close();
    });
});
