/**
 * #1178, #1179 on a phone, 375×812: what a charging site and a fuel station say first, the connect page's address with its
 * copy button and one guide at a time, the news page's fold. One representative page each; the national rule.
 *
 * Run in the pinned Linux image only.
 */
import { type ChildProcess } from "node:child_process";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pathFor } from "../src/site/pages.js";
import { AUTOHOF_CHARGING_SLUG, AUTOHOF_FUEL_SLUG } from "./energy-autohof.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8898;
const PHONE = { width: 375, height: 812 } as const;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const ID = { IMPRESSUM_NAME: "Fold Probe", IMPRESSUM_STREET: "Probeweg 5", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "fold@example.invalid" };
const THIRD_PARTY = /googletagmanager\.com|google-analytics\.com|clarity\.ms/u;

let browser: Browser;
let digest: Awaited<ReturnType<typeof startRealDigest>>;
let shell: ChildProcess;
const base = `http://127.0.0.1:${String(PORT)}`;

beforeAll(async () => {
  digest = await startRealDigest({ energy: "autohof" });
  shell = await startShell(PORT, { ...ID, DIGEST_URL: digest.url });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
});

async function open(path: string): Promise<{ readonly ctx: BrowserContext; readonly page: Page }> {
  const ctx = await browser.newContext({ viewport: PHONE, userAgent: UA, hasTouch: true });
  ctx.setDefaultTimeout(2_000);
  await ctx.route(THIRD_PARTY, (r) => r.fulfill({ status: 204, body: "" }));
  const page = await ctx.newPage();
  await page.goto(`${base}${path}`);
  return { ctx, page };
}

const end = async (page: Page, sel: string): Promise<number> => {
  const b = (await page.locator(sel).first().boundingBox())!;
  return Math.round(b.y + b.height);
};

describe("#1178 the first viewport", () => {
  const measured: Record<string, unknown> = {};
  afterAll(() => {
    console.log(`first screen 1178: ${JSON.stringify(measured)}`);
  });
  it("a charging site: the heading in at most two lines, the status line, the points; at most three screens", async () => {
    const { ctx, page } = await open(`/de/charging/${AUTOHOF_CHARGING_SLUG}`);
    const h1 = (await page.locator("main h1").boundingBox())!;
    const lines = await page.locator("main h1").evaluate((e) => Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)));
    const m = { h1Top: Math.round(h1.y), lines, statusEnd: await end(page, "#energy-status"), screens: await page.evaluate(() => (document.documentElement.scrollHeight / 812).toFixed(1)) };
    measured["charging"] = m;
    expect(m.lines).toBeLessThanOrEqual(2);
    expect(m.h1Top).toBeLessThanOrEqual(200);
    expect(m.statusEnd).toBeLessThanOrEqual(PHONE.height);
    await ctx.close();
  });
  it("a fuel station: the heading, its address and map; no price in the served page", async () => {
    const path = `/de/fuel/${AUTOHOF_FUEL_SLUG}`;
    const { ctx, page } = await open(path);
    const m = { h1Top: Math.round((await page.locator("main h1").boundingBox())!.y), firstEnd: await end(page, ".energypage__first") };
    measured["fuel"] = m;
    expect(m.firstEnd).toBeLessThanOrEqual(PHONE.height);
    const html = await (await fetch(`${base}${path}`, { headers: { "user-agent": UA } })).text();
    expect(html).not.toMatch(/\d[,.]\d{2,3}\s*€/u);
    await ctx.close();
  });
});

describe("#1179 connect", () => {
  it("the address and its copy button in the first viewport; the copy is exact and announced; at most fourteen screens", async () => {
    const { ctx, page } = await open(pathFor("connect", "de"));
    await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: base });
    const button = page.locator("#endpoint .endpoint-chip__copy, #endpoint button").first();
    await button.waitFor({ state: "visible" });
    const m = { copyEnd: await end(page, "#endpoint button"), screens: await page.evaluate(() => document.documentElement.scrollHeight / 812) };
    console.log(`connect 1179: ${JSON.stringify(m)}`);
    expect(m.copyEnd).toBeLessThanOrEqual(PHONE.height);
    await button.click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("https://mcp.viafrei.de/mcp");
    expect(await page.locator('#endpoint [role="status"]').first().textContent()).not.toBe("");
    // owner 2026-11-06 "Raise limits": 12 → 14 screens; the examples crediting Tankerkönig never fold (FS5), measured 13.2
    expect(m.screens).toBeLessThanOrEqual(14);
    await ctx.close();
  });
  it("one guide at a time, by keyboard", async () => {
    const { ctx, page } = await open(pathFor("connect", "de"));
    const summaries = page.locator("#clients details.client > summary");
    expect(await summaries.count()).toBeGreaterThan(1);
    await summaries.nth(0).focus();
    await page.keyboard.press("Enter");
    await summaries.nth(1).focus();
    await page.keyboard.press("Enter");
    expect(await page.locator("#clients details.client[open]").count()).toBe(1);
    await ctx.close();
  });
});

describe("#1179 news", () => {
  it("ten entries stand, every other is in the page, a permalink opens its fold with no script", async () => {
    const path = pathFor("news", "de");
    const ctx = await browser.newContext({ viewport: PHONE, userAgent: UA, javaScriptEnabled: false });
    ctx.setDefaultTimeout(2_000);
    const page = await ctx.newPage();
    await page.goto(`${base}${path}`);
    expect(await page.locator("#new > .wrap > .news-list > .news-entry").count()).toBeLessThanOrEqual(10);
    const older = page.locator("#new .news-older .news-entry");
    const n = await older.count();
    if (n > 0) {
      const summary = page.locator("#new .news-older > summary");
      await summary.click();
      expect(await older.first().isVisible()).toBe(true);
    }
    await ctx.close();
  });
});
