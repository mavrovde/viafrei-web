/**
 * #981 C1 (data-steward ruling 2026-10-24), against the REAL built shell: a
 * place page's document render never asks the MCP process for a fuel refresh;
 * since #1065 the fuel card's own fragment does, asked by the page's script
 * when the card is in view in a person's browser, and the card then says the
 * prices were just asked. The walk's shape — a browser user agent, a bare
 * google referer, forged Fetch Metadata, no JavaScript — makes ZERO refresh
 * calls, as do a crawler's browser and a cross-site POST. The digest and the
 * MCP listener are loopback stand-ins; nothing here reaches a provider.
 */
import type { ChildProcess } from "node:child_process";
import { createServer, request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POPULAR_PLACES, popularSlug } from "../src/site/places.js";
import { startShell } from "./server.js";
import { startStubDigest } from "./stub-digest.js";

const PORT = 8834;
const BASE = `http://127.0.0.1:${String(PORT)}`;
const PLACE = POPULAR_PLACES[0]!;
const PATH = `/de/place/${popularSlug(PLACE)}`;
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
let browser: Browser;
let shell: ChildProcess;
let digest: Awaited<ReturnType<typeof startStubDigest>>;
let mcp: { url: string; refreshes: string[]; close(): Promise<void> };

/** The MCP internal listener: records every fuel refresh it is asked and answers it `refreshed`; no local answers. */
async function startMcp(): Promise<typeof mcp> {
  const refreshes: string[] = [];
  const server = createServer((req, res) => {
    if (req.method === "POST" && req.url === "/internal/fuel/refresh") {
      let body = "";
      req.on("data", (c: Buffer) => (body += c.toString("utf8")));
      req.on("end", () => {
        refreshes.push(body);
        res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ state: "refreshed", settledAt: Date.now(), reused: false }));
      });
      return;
    }
    res.writeHead(404, { "content-type": "application/json" }).end("{}");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  return { url: `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`, refreshes, close: () => new Promise<void>((r) => server.close(() => r())) };
}

/** A raw GET with EXACTLY these headers — `fetch` (undici) rewrites the Fetch Metadata the walk forges. */
function rawGet(path: string, headers: Record<string, string>): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const q = httpRequest(`${BASE}${path}`, { method: "GET", headers }, (res) => {
      let body = "";
      res.on("data", (c: Buffer) => (body += c.toString("utf8")));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
    });
    q.on("error", reject);
    q.end();
  });
}

/** A raw POST with EXACTLY these headers (see `rawGet`). */
function rawPost(path: string, headers: Record<string, string>, body: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const q = httpRequest(`${BASE}${path}`, { method: "POST", headers: { ...headers, "content-type": "application/json", "content-length": String(Buffer.byteLength(body)) } }, (res) => {
      let out = "";
      res.on("data", (c: Buffer) => (out += c.toString("utf8")));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: out }));
    });
    q.on("error", reject);
    q.end(body);
  });
}

beforeAll(async () => {
  digest = await startStubDigest({}, 5000, { fullCards: true });
  mcp = await startMcp();
  shell = await startShell(PORT, { DIGEST_URL: digest.url, MCP_INTERNAL_URL: mcp.url, FUEL_REFRESH_URL: mcp.url, WEB_TILE_TIMEOUT_MS: "2000" });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
  await mcp?.close();
});
beforeEach(() => {
  mcp.refreshes.length = 0;
});

describe("a place page's document render never asks Tankerkönig (#981 C1)", () => {
  it("the walk's request (browser UA, forged navigate/document, google referer) fetched without a script: zero refresh calls", async () => {
    for (let i = 0; i < 3; i++) {
      const r = await rawGet(PATH, { "user-agent": CHROME, "sec-fetch-mode": "navigate", "sec-fetch-dest": "document", "sec-fetch-site": "cross-site", "sec-fetch-user": "?1", referer: "https://www.google.com/", accept: "text/html" });
      expect(r.status).toBe(200);
      const html = r.body;
      // #1065: the fuel card deferred — its frame and the box a person's script fills from the card's own fragment
      expect(html).toContain("pcard__fuelslot");
      expect(html).not.toMatch(/<div class="place-fill" data-vf-fill=/);
    }
    expect(mcp.refreshes).toEqual([]);
  });

  it("the same in a browser with JavaScript OFF: the page renders, nothing is asked", async () => {
    const ctx = await browser.newContext({ userAgent: CHROME, javaScriptEnabled: false, extraHTTPHeaders: { referer: "https://www.google.com/" } });
    const page = await ctx.newPage();
    const r = await page.goto(`${BASE}${PATH}`, { waitUntil: "networkidle" });
    expect(r?.status()).toBe(200);
    expect(await page.locator("#pcard-fuel .pcard__fueljs").textContent()).toBe("Zum Laden der Preise braucht diese Seite JavaScript.");
    expect(await page.locator("#pcard-fuel .pcard__fresh").count()).toBe(0);
    await ctx.close();
    expect(mcp.refreshes).toEqual([]);
  });

  it("a person's browser: the fuel card's fragment, asked when the card is in view, asks ONCE, and the card shows the prices just asked (#1065)", async () => {
    const ctx = await browser.newContext({ userAgent: CHROME });
    const page = await ctx.newPage();
    const gets: string[] = [];
    const posts: string[] = [];
    page.on("request", (q) => {
      if (q.url().includes("/fragment/place-fuel?")) gets.push(q.url());
      if (q.method() === "POST" && q.url().endsWith("/fragment/place")) posts.push(q.postData() ?? "");
    });
    await page.goto(`${BASE}${PATH}`, { waitUntil: "networkidle" });
    await page.locator("#pcard-fuel .pcard__fuelslot").scrollIntoViewIfNeeded();
    await page.waitForSelector("#pcard-fuel .pcard__fuelout .pcard__fresh--refreshed", { timeout: 10_000 });
    expect(mcp.refreshes).toEqual([JSON.stringify({ at: `ags:${PLACE.ags}` })]);
    expect(gets).toHaveLength(1);
    expect(gets[0]).toContain(`/fragment/place-fuel?place=${popularSlug(PLACE)}&lang=de`);
    // the cards themselves are not re-read: no fill marker, no POST
    expect(posts).toEqual([]);
    await ctx.close();
  });

  it("a crawler's browser (JavaScript on) and a cross-site POST of the marker ask nothing", async () => {
    const ctx = await browser.newContext({ userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" });
    const page = await ctx.newPage();
    await page.goto(`${BASE}${PATH}`, { waitUntil: "networkidle" });
    expect(await page.locator("[data-vf-fill]").count()).toBe(0);
    await page.locator("#pcard-fuel .pcard__fuelslot").scrollIntoViewIfNeeded();
    await page.waitForSelector("#pcard-fuel .pcard__fuelout .place-fuel", { timeout: 10_000 });
    expect(await page.locator("#pcard-fuel .pcard__fuelout").textContent()).toBe("refused");
    await ctx.close();
    const cross = await fetch(`${BASE}/fragment/place`, { method: "POST", headers: { "user-agent": CHROME, "content-type": "application/json", "sec-fetch-site": "cross-site", "sec-fetch-mode": "cors", origin: "https://example.org" }, body: JSON.stringify({ at: `ags:${PLACE.ags}`, lang: "de", how: "page" }) });
    expect(cross.status).toBeLessThan(500);
    expect(mcp.refreshes).toEqual([]);
  });

  it("review B1: the marker's POST replayed with a NAVIGATION's forged headers (same-origin, navigate/document) asks nothing; a fetch's shape asks once", async () => {
    const body = JSON.stringify({ at: `ags:${PLACE.ags}`, lang: "de", how: "page" });
    const nav = { "user-agent": CHROME, "sec-fetch-site": "same-origin", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document", "sec-fetch-user": "?1" };
    expect((await rawPost("/fragment/place", nav, body)).status).toBeLessThan(500);
    expect((await rawPost("/fragment/place", { "user-agent": CHROME, "sec-fetch-site": "same-origin" }, body)).status).toBeLessThan(500);
    expect(mcp.refreshes).toEqual([]);
    // the control: the same POST in the shape a page script sends it
    expect((await rawPost("/fragment/place", { "user-agent": CHROME, "sec-fetch-site": "same-origin", "sec-fetch-mode": "cors", "sec-fetch-dest": "empty" }, body)).status).toBe(200);
    expect(mcp.refreshes).toEqual([JSON.stringify({ at: `ags:${PLACE.ags}` })]);
  });
});
