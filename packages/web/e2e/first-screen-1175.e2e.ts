/**
 * #1175: a station on a phone, 375×812: the H1, the status line and the first departure in the first viewport; every jump
 * link lands on its section; the page's length and weight. Köln Hbf is the fixture's station: one national rule, so any
 * station reads the same.
 *
 * Run in the pinned Linux image only.
 */
import { type ChildProcess } from "node:child_process";
import { gzipSync } from "node:zlib";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { stationPath } from "../src/site/stations.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8897;
const PHONE = { width: 375, height: 812 } as const;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const ID = { IMPRESSUM_NAME: "Fold Probe", IMPRESSUM_STREET: "Probeweg 5", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "fold@example.invalid" };
const THIRD_PARTY = /googletagmanager\.com|google-analytics\.com|clarity\.ms/u;

let browser: Browser;
let digest: Awaited<ReturnType<typeof startRealDigest>>;
let shell: ChildProcess;
const base = `http://127.0.0.1:${String(PORT)}`;

beforeAll(async () => {
  digest = await startRealDigest({});
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

describe("the first viewport of a station (#1175 AC 1, 375×812)", () => {
  const measured: Record<string, unknown> = {};
  afterAll(() => {
    console.log(`first screen 1175: ${JSON.stringify(measured)}`);
  });
  for (const lang of ["de", "en"] as const) {
    it(`${lang}: the H1, the status line, the first departure`, async () => {
      const { ctx, page } = await open(stationPath(lang, "koeln-hbf"));
      const h1Top = Math.round((await page.locator("main h1").boundingBox())!.y);
      const m = { h1Top, statusEnd: await end(page, "#page-first .statusline"), itemEnd: (await page.locator("#page-first .topitems__row").count()) === 0 ? null : await end(page, "#page-first .topitems__row") };
      measured[lang] = m;
      expect(m.h1Top).toBeLessThanOrEqual(200);
      expect(m.statusEnd).toBeLessThanOrEqual(PHONE.height);
      expect(m.itemEnd, "the fixture's board has a departure").not.toBeNull();
      expect(m.itemEnd!).toBeLessThanOrEqual(PHONE.height);
      expect(await page.locator("#page-first").count()).toBe(1);
      await ctx.close();
    });
  }
  it("each jump link lands on its section", async () => {
    const { ctx, page } = await open(stationPath("de", "koeln-hbf"));
    const hrefs = await page.locator("#page-first .jumps__chip").evaluateAll((els) => els.map((e) => e.getAttribute("href")!));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) expect(await page.locator(href).count(), href).toBe(1);
    await ctx.close();
  });
  it("at most 20 screens and 200 000 B gzip, the page does not scroll sideways", async () => {
    const path = stationPath("de", "koeln-hbf");
    const { ctx, page } = await open(path);
    const m = await page.evaluate(() => ({ height: document.documentElement.scrollHeight, width: document.documentElement.scrollWidth }));
    const html = await (await fetch(`${base}${path}`, { headers: { "user-agent": UA } })).text();
    const gz = gzipSync(html).length;
    console.log(`station budget 1175: ${JSON.stringify({ ...m, raw: Buffer.byteLength(html), gz, screens: (m.height / PHONE.height).toFixed(1) })}`);
    expect(m.width).toBeLessThanOrEqual(PHONE.width);
    expect(m.height).toBeLessThanOrEqual(20 * PHONE.height);
    expect(gz).toBeLessThanOrEqual(200_000);
    await ctx.close();
  });
});
