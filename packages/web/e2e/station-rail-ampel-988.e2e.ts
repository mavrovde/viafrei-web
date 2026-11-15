/**
 * #988: the rail Ampel on a station page, in a real browser with no script — the lamp with its word in the status
 * line, every reason a link that lands (an anchor on the page, or the board with one choice), and a lamp per line that
 * filters the board to that line by the address (`?line=`). Köln Hbf of the real digest's fixture.
 *
 * Run in the pinned Linux image only.
 */
import { type ChildProcess } from "node:child_process";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { stationPath } from "../src/site/stations.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8898;
const ID = { IMPRESSUM_NAME: "Ampel Probe", IMPRESSUM_STREET: "Probeweg 5", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "ampel@example.invalid" };
const THIRD_PARTY = /googletagmanager\.com|google-analytics\.com|clarity\.ms/u;
const ROWS = "#pcard-station-board .stlive__panel:not([hidden]) table.stlive__board tbody tr";

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
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, javaScriptEnabled: false });
  ctx.setDefaultTimeout(2_000);
  await ctx.route(THIRD_PARTY, (r) => r.fulfill({ status: 204, body: "" }));
  const page = await ctx.newPage();
  await page.goto(`${base}${path}`);
  return { ctx, page };
}

describe("the rail Ampel of a station (#988)", () => {
  it("the lamp has its word, and every reason link lands", async () => {
    const { ctx, page } = await open(stationPath("de", "koeln-hbf"));
    expect(await page.locator("#page-first .statusline .statusline__lamp[aria-label]").count()).toBe(1);
    const hrefs = await page.locator("#page-first .railampel__why").evaluateAll((els) => els.map((e) => e.getAttribute("href")!));
    for (const href of hrefs) {
      if (href.startsWith("#")) expect(await page.locator(href).count(), href).toBe(1);
      else expect(href, href).toMatch(/^\/de\/station\/koeln-hbf\?[^#]+#pcard-station-board$/u);
    }
    await ctx.close();
  });

  it("a line lamp filters the board to its line, with no script", async () => {
    const { ctx, page } = await open(stationPath("de", "koeln-hbf"));
    const lamps = page.locator("#page-first ul.railampel li.railampel__line a");
    expect(await lamps.count(), "the fixture's board names its lines").toBeGreaterThan(0);
    const all = await lamps.evaluateAll((els) => els.map((e) => ({ href: e.getAttribute("href")!, label: e.querySelector('span[translate="no"]')?.textContent?.trim() ?? "" })));
    for (const l of all) expect(await page.locator(`#page-first a[href="${l.href}"] .statusline__lamp[aria-label]`).count(), l.label).toBe(1);
    const pick = all.find((l) => l.href.includes("line="));
    expect(pick, "a lamp of one line").toBeDefined();
    await Promise.all([page.waitForURL(/line=/u), page.click(`#page-first a[href="${pick!.href}"]`)]);
    expect(new URL(page.url()).searchParams.get("line")).toBe(pick!.label);
    const lines = await page.locator(ROWS).evaluateAll((rows) => rows.map((r) => r.textContent ?? ""));
    for (const text of lines) expect(text.replace(/\s+/gu, ""), text).toContain(pick!.label.replace(/\s+/gu, ""));
    await ctx.close();
  });
});
