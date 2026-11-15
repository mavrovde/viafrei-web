/**
 * Microsoft Clarity behind the one consent (#717), in a real Chromium against
 * the BUILT shell, each test in a clean browser profile (a new context):
 *
 *   • before accept: no request to clarity.ms or bing.com, no `window.clarity`,
 *     no `#clarity-script` — yet the CSP of a page with the island names
 *     Clarity's origins, and the body carries `data-clarity-mask`;
 *   • accept: exactly ONE tag request, to `www.clarity.ms/tag/<fixture>`, the
 *     queued consent signal is analytics granted / ads denied, never identify;
 *     a remembered accept starts it again on the next page;
 *   • decline: nothing, and nothing again after a reload (remembered);
 *   • withdrawal on the Datenschutz page: no Clarity request there, Clarity's
 *     cookies expired, and the next page asks again and loads nothing;
 *   • a page without the island, a shell without an id and a shell with the id
 *     switched off: no Clarity origin in the CSP and no request after accept;
 *   • steward ruling C-4: a REAL click on a place card's ↻ on the home (inside
 *     the `vf-noclarity` place bar) calls `clarity("stop")` from a window
 *     capture listener BEFORE a document capture listener (where the tag
 *     records clicks) runs, and that listener — removed by the stop, as
 *     clarity-js's `event.reset()` does — never sees the click; a click
 *     outside is recorded;
 *   • the C-4 fallback (2026-10-27): a motorway page runs no Clarity at all —
 *     no origin in its CSP, no mask, no id in its HTML, no request after
 *     accept, nor from a remembered accept;
 *   • C-5: a page whose address carries `q=` or `find=` loads no Clarity, even
 *     after accept; C-3: the home's privacy sentences name Clarity only when on.
 *
 * Every request to a Clarity, Bing or Google host is answered by Playwright's
 * router and never reaches the network (PLAYBOOK §2 rule 3); the id is a
 * FIXTURE, never the real project's. A missing `dist/` is a failure.
 */
import type { ChildProcess } from "node:child_process";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pathFor } from "../src/site/pages.js";
import { POPULAR_PLACES } from "../src/site/places.js";
import { startShell } from "./server.js";
import { startStubDigest } from "./stub-digest.js";

const FIXTURE = "vfprobe717";
const ON = 8851;
const NO_ID = 8852;
const OFF = 8853;
/** A shell whose digest answers a place with all its cards, each carrying its ↻ (the C-4 click). */
const CARDS = 8854;
const ID = { IMPRESSUM_NAME: "Clarity Probe", IMPRESSUM_STREET: "Probeweg 7", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "clarity@example.invalid" };
const THIRD = /^https:\/\/([a-z0-9-]+\.)*(clarity\.ms|bing\.com|googletagmanager\.com|google-analytics\.com|analytics\.google\.com)\//;

let browser: Browser;
const shells: ChildProcess[] = [];
let stub: Awaited<ReturnType<typeof startStubDigest>>;
let cardStub: Awaited<ReturnType<typeof startStubDigest>>;

beforeAll(async () => {
  stub = await startStubDigest({});
  shells.push(await startShell(ON, { ...ID, DIGEST_URL: stub.url, GOOGLE_TAG: "G-0", CLARITY_PROJECT_ID: FIXTURE }));
  shells.push(await startShell(NO_ID, { ...ID, DIGEST_URL: stub.url, GOOGLE_TAG: "G-0" }));
  shells.push(await startShell(OFF, { ...ID, DIGEST_URL: stub.url, GOOGLE_TAG: "G-0", CLARITY_PROJECT_ID: FIXTURE, CLARITY_ENABLED: "false" }));
  cardStub = await startStubDigest({}, 5000, { fullCards: true, refreshLinks: true });
  shells.push(await startShell(CARDS, { ...ID, DIGEST_URL: cardStub.url, GOOGLE_TAG: "G-0", CLARITY_PROJECT_ID: FIXTURE }));
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  for (const s of shells) s.kill();
  await stub?.close();
  await cardStub?.close();
});

type Seen = { clarity: string[]; csp: string[] };

/** A clean profile whose every third-party request is recorded and answered locally. */
async function profile(): Promise<{ ctx: BrowserContext; seen: Seen }> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const seen: Seen = { clarity: [], csp: [] };
  await ctx.route(THIRD, (route) => {
    const url = route.request().url();
    if (/clarity\.ms|bing\.com/.test(url)) seen.clarity.push(url);
    void route.fulfill({ status: 200, contentType: "application/javascript", body: "/* intercepted by clarity-717.e2e.ts — never fetched */" });
  });
  ctx.on("page", (p) => p.on("console", (m) => (/Content.Security.Policy|Refused to/i.test(m.text()) ? seen.csp.push(m.text()) : undefined)));
  return { ctx, seen };
}

async function open(ctx: BrowserContext, port: number, path: string): Promise<{ page: Page; csp: string }> {
  const page = await ctx.newPage();
  const r = await page.goto(`http://127.0.0.1:${port}${path}`, { waitUntil: "networkidle" });
  if (r === null) throw new Error(`no response for ${path}`);
  expect(r.status(), path).toBe(200);
  return { page, csp: r.headers()["content-security-policy"] ?? "" };
}

const started = (page: Page): Promise<boolean> => page.evaluate(() => typeof (window as { clarity?: unknown }).clarity === "function" || document.getElementById("clarity-script") !== null);
const queue = (page: Page): Promise<unknown[][]> =>
  page.evaluate(() => ((window as { clarity?: { q?: ArrayLike<unknown>[] } }).clarity?.q ?? []).map((a) => Array.from(a)));
const ACCEPT = ".consent__actions .btn:last-child";
const DECLINE = ".consent__actions .btn:first-child";
const TAG_URL = `https://www.clarity.ms/tag/${FIXTURE}?ref=npm`;

describe("with a tag and a Clarity id (the prod shape)", () => {
  it("before accept nothing of Clarity's exists; after accept exactly one tag request and the analytics-only consent signal", async () => {
    const { ctx, seen } = await profile();
    const { page, csp } = await open(ctx, ON, pathFor("start", "de"));
    for (const d of ["script-src", "connect-src", "img-src"]) {
      const dir = csp.split("; ").find((x) => x.startsWith(d)) ?? "";
      expect(dir, d).toContain("https://*.clarity.ms");
      expect(dir, d).toContain("https://c.bing.com");
    }
    expect(csp).not.toContain("unsafe-inline");
    expect(await page.getAttribute("body", "data-clarity-mask")).toBe("true");
    await page.waitForSelector(ACCEPT);
    await page.waitForTimeout(300);
    expect(seen.clarity).toEqual([]);
    expect(await started(page)).toBe(false);

    await page.click(ACCEPT);
    await page.waitForFunction(() => document.getElementById("clarity-script") !== null);
    await page.waitForLoadState("networkidle");
    expect(seen.clarity).toEqual([TAG_URL]);
    const q = await queue(page);
    expect(q).toContainEqual(["consentv2", { ad_Storage: "denied", analytics_Storage: "granted" }]);
    expect(q.map((a) => a[0])).not.toContain("identify");
    expect(q.map((a) => a[0])).not.toContain("set");
    expect(seen.csp).toEqual([]);

    // a remembered accept starts it again on the next page, once
    const next = await open(ctx, ON, pathFor("connect", "en"));
    await next.page.waitForFunction(() => document.getElementById("clarity-script") !== null);
    await next.page.waitForLoadState("networkidle");
    expect(seen.clarity).toEqual([TAG_URL, TAG_URL]);
    expect(await next.page.$(".consent")).toBeNull();
    await ctx.close();
  });

  it("decline sends nothing, and is remembered across a reload and another page", async () => {
    const { ctx, seen } = await profile();
    const { page } = await open(ctx, ON, pathFor("start", "de"));
    await page.click(DECLINE);
    await page.waitForTimeout(300);
    await page.reload({ waitUntil: "networkidle" });
    expect(await page.$(".consent")).toBeNull();
    const other = await open(ctx, ON, pathFor("developers", "de"));
    await other.page.waitForTimeout(300);
    expect(seen.clarity).toEqual([]);
    expect(await started(other.page)).toBe(false);
    await ctx.close();
  });

  it("withdrawal on the Datenschutz page loads nothing there, expires Clarity's cookies, and the next page asks again and loads nothing", async () => {
    const { ctx, seen } = await profile();
    const { page } = await open(ctx, ON, pathFor("start", "de"));
    await page.click(ACCEPT);
    await page.waitForFunction(() => document.getElementById("clarity-script") !== null);
    expect(seen.clarity).toHaveLength(1);
    // what Clarity's script would have written after consent (the intercepted stub writes nothing)
    await ctx.addCookies([
      { name: "_clck", value: "probe", domain: "127.0.0.1", path: "/" },
      { name: "_clsk", value: "probe", domain: "127.0.0.1", path: "/" },
    ]);
    const priv = await open(ctx, ON, pathFor("datenschutz", "de"));
    expect(priv.csp).not.toMatch(/clarity|bing/);
    expect(await priv.page.$("#clarity")).not.toBeNull();
    await priv.page.click("#vf-consent-reset");
    await priv.page.waitForFunction(() => (document.getElementById("vf-consent-state")?.textContent ?? "") !== "");
    expect((await ctx.cookies()).map((c) => c.name).filter((n) => n === "_clck" || n === "_clsk")).toEqual([]);
    expect(seen.clarity).toHaveLength(1);
    const again = await open(ctx, ON, pathFor("start", "de"));
    await again.page.waitForSelector(ACCEPT);
    await again.page.waitForTimeout(300);
    expect(seen.clarity).toHaveLength(1);
    expect(await started(again.page)).toBe(false);
    await ctx.close();
  });

  it("a page without the island names no Clarity origin and loads nothing, even with a remembered accept", async () => {
    const { ctx, seen } = await profile();
    const { page } = await open(ctx, ON, pathFor("start", "de"));
    await page.click(ACCEPT);
    await page.waitForFunction(() => document.getElementById("clarity-script") !== null);
    for (const path of [pathFor("fuel", "en"), pathFor("impressum", "de"), pathFor("news", "en")]) {
      const p = await open(ctx, ON, path);
      expect(p.csp, path).not.toMatch(/clarity|bing/);
      expect(await p.page.getAttribute("body", "data-clarity-mask"), path).toBeNull();
      await p.page.waitForTimeout(200);
      expect(await started(p.page), path).toBe(false);
    }
    expect(seen.clarity).toEqual([TAG_URL]);
    await ctx.close();
  });
});

describe("the steward ruling's conditions in the browser (C-3, C-4, C-5)", () => {
  it("C-4: a REAL click on a place card's ↻ on the home stops Clarity before the tag's document capture listener reads it; a click outside is read", async () => {
    const { ctx } = await profile();
    // a remembered place (the island swaps its cards in) and a remembered accept (Clarity starts on load)
    const place = POPULAR_PLACES[0];
    if (place === undefined) throw new Error("no popular place");
    await ctx.addInitScript(
      ([at, label]) => {
        window.localStorage.setItem("viafrei.place", JSON.stringify({ at, label, how: "manual" }));
        window.localStorage.setItem("viafrei.consent.analytics", `granted|${String(Date.now())}`);
      },
      [`ags:${place.ags}`, place.name] as const,
    );
    const { page } = await open(ctx, CARDS, pathFor("start", "de"));
    await page.waitForFunction(() => document.getElementById("clarity-script") !== null);
    const reload = page.locator("#place-slot article.pcard .pcard__refresh").first();
    await reload.waitFor({ state: "visible" });
    // the preconditions: the ↻ is a place-derived link, inside the marked place bar
    expect(await reload.getAttribute("href")).toMatch(/^\/de\/place\/[a-z0-9-]+#pcard-/);
    expect(await reload.evaluate((el) => el.closest(".vf-noclarity")?.id ?? null)).toBe("place");
    await page.evaluate(() => {
      const out: string[] = [];
      (window as unknown as { vfLog: string[] }).vfLog = out;
      const w = window as unknown as { clarity: (m: string, ...a: unknown[]) => unknown };
      const queued = w.clarity;
      // the tag's click recorder (clarity-js interaction/click.ts: a capture listener on document) …
      const rec = (e: Event): void => void out.push(`rec:${e.type}`);
      document.addEventListener("click", rec, true);
      document.addEventListener("contextmenu", rec, true);
      // … and its stop(), which removes every listener it bound (core/event.ts reset())
      w.clarity = (m: string, ...a: unknown[]) => {
        if (m === "stop") {
          out.push("stop");
          document.removeEventListener("click", rec, true);
          document.removeEventListener("contextmenu", rec, true);
        }
        return queued(m, ...a);
      };
      // keep the page where it is after the ↻ (a stub card has no in-place refresh): a BUBBLE listener on window, the
      // last to run, so it changes nothing of the capture order under test
      window.addEventListener("click", (e) => {
        if ((e.target as Element | null)?.closest?.(".pcard__refresh")) e.preventDefault();
      });
    });
    const log = (): Promise<string[]> => page.evaluate(() => [...(window as unknown as { vfLog: string[] }).vfLog]);
    // a real click outside every marked region (the beta notice's label: no link) is read by the tag
    await page.click("#beta-notice .beta__label");
    expect(await log()).toEqual(["rec:click"]);
    // the real click on the ↻: the stop comes first, and the tag never reads it
    await reload.click();
    expect(await log()).toEqual(["rec:click", "stop"]);
    // and nothing is read after the stop
    await page.click("#beta-notice .beta__label");
    expect(await log()).toEqual(["rec:click", "stop"]);
    expect((await queue(page)).map((a) => a[0])).toContain("stop");
    expect(new URL(page.url()).pathname).toBe(pathFor("start", "de"));
    await ctx.close();
  });

  it("the C-4 fallback (2026-10-27): a motorway page runs no Clarity — no origin in its CSP, no mask, no id, and no request after accept", async () => {
    const { ctx, seen } = await profile();
    const r = await ctx.request.get(`http://127.0.0.1:${String(ON)}/de/autobahn/a7`);
    expect(r.status()).toBe(200);
    // the precondition: the page carries the island (GA is measured there, G1)
    const html = await r.text();
    expect(html).toContain("astro-island");
    expect(html).not.toContain(FIXTURE);
    const { page, csp } = await open(ctx, ON, "/de/autobahn/a7");
    expect(csp).toContain("googletagmanager");
    expect(csp).not.toMatch(/clarity|bing/);
    expect(await page.getAttribute("body", "data-clarity-mask")).toBeNull();
    await page.waitForSelector(ACCEPT);
    expect(await page.textContent(".consent__body")).not.toContain("Clarity");
    await page.click(ACCEPT);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(300);
    expect(seen.clarity).toEqual([]);
    expect(await started(page)).toBe(false);
    // a remembered accept from the home (where Clarity runs) starts nothing on a motorway page either
    const home = await open(ctx, ON, pathFor("start", "de"));
    await home.page.waitForFunction(() => document.getElementById("clarity-script") !== null);
    expect(seen.clarity).toEqual([TAG_URL]);
    const again = await open(ctx, ON, "/de/autobahn/a7");
    await again.page.waitForTimeout(300);
    expect(await started(again.page)).toBe(false);
    expect(seen.clarity).toEqual([TAG_URL]);
    await ctx.close();
  });

  for (const path of ["/de?q=Kassel", "/de?find=Kassel"]) {
    it(`C-5: ${path} loads no Clarity on accept; the plain page then starts it from the remembered accept`, async () => {
      const { ctx, seen } = await profile();
      const { page } = await open(ctx, ON, path);
      await page.click(ACCEPT);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(300);
      expect(seen.clarity).toEqual([]);
      expect(await started(page)).toBe(false);
      const plain = await open(ctx, ON, pathFor("start", "de"));
      await plain.page.waitForFunction(() => document.getElementById("clarity-script") !== null);
      expect(seen.clarity).toEqual([TAG_URL]);
      await ctx.close();
    });
  }

  it("C-3: the home's privacy sentences and the bar say what Microsoft does when Clarity is on, and only then", async () => {
    const { ctx } = await profile();
    const on = await open(ctx, ON, pathFor("start", "de"));
    expect(await on.page.textContent("#sources")).toContain("Google Analytics und Microsoft Clarity laufen nur, wenn Sie zustimmen.");
    await on.page.waitForSelector(ACCEPT);
    expect(await on.page.textContent(".consent__body")).toContain("Microsoft nutzt diese Daten auch für eigene Zwecke, auch für Werbung.");
    for (const port of [NO_ID, OFF]) {
      const off = await open(ctx, port, pathFor("start", "de"));
      expect(await off.page.textContent("#sources"), String(port)).not.toContain("Clarity");
    }
    await ctx.close();
  });
});

describe("without a Clarity id, or with it switched off", () => {
  for (const [port, label] of [[NO_ID, "no id"], [OFF, "CLARITY_ENABLED=false"]] as const) {
    it(`${label}: no Clarity origin, no mask, the GA-only consent text, no Datenschutz subsection, and nothing after accept`, async () => {
      const { ctx, seen } = await profile();
      const { page, csp } = await open(ctx, port, pathFor("start", "de"));
      expect(csp).toContain("googletagmanager");
      expect(csp).not.toMatch(/clarity|bing/);
      expect(await page.getAttribute("body", "data-clarity-mask")).toBeNull();
      await page.waitForSelector(ACCEPT);
      expect(await page.textContent(".consent__body")).not.toContain("Clarity");
      await page.click(ACCEPT);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(300);
      expect(seen.clarity).toEqual([]);
      expect(await started(page)).toBe(false);
      const priv = await open(ctx, port, pathFor("datenschutz", "de"));
      expect(await priv.page.$("#clarity")).toBeNull();
      await ctx.close();
    });
  }
});
