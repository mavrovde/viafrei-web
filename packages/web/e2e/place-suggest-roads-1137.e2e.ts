/**
 * #1137: the home's place box lists a motorway the query names (the digest's line, `stub-digest.ts` `stubSuggest`), and
 * clicking it OPENS the motorway's page — the island does not read it as a place key — while a place line beside it is
 * still chosen in place. A real browser against the REAL built shell and a stand-in digest; no network.
 *
 * Run in the pinned Linux image (laptop results are not evidence): `npx vitest run --config packages/web/vitest.e2e.config.ts place-suggest-roads-1137`.
 */
import type { ChildProcess } from "node:child_process";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startShell } from "./server.js";
import { startStubDigest } from "./stub-digest.js";
import { motorwayPath } from "../src/site/motorways.js";

const PORT = 8971;
const BASE = `http://127.0.0.1:${String(PORT)}`;
let browser: Browser;
let shell: ChildProcess;
let digest: Awaited<ReturnType<typeof startStubDigest>>;

beforeAll(async () => {
  digest = await startStubDigest({}, 2000, { fullCards: true });
  shell = await startShell(PORT, { DIGEST_URL: digest.url, WEB_TILE_TIMEOUT_MS: "2000" });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
});

async function home(page: Page): Promise<void> {
  await page.goto(`${BASE}/de`, { waitUntil: "networkidle" });
  await page.waitForSelector("#place-head:not([hidden])");
}

describe("#1137 a motorway in the home's place box", () => {
  it("A4: the motorway is listed first, and its line opens the motorway's page", async () => {
    const page = await browser.newPage();
    await home(page);
    await page.fill("#place-hq", "A4");
    const first = page.locator("#place-hresults a.place-opt").first();
    await first.waitFor({ timeout: 2000 });
    expect(await first.getAttribute("href")).toBe(motorwayPath("de", "A4"));
    expect(await page.locator("#place-hresults").textContent()).not.toContain("Nichts gefunden");
    await Promise.all([page.waitForURL(`${BASE}${motorwayPath("de", "A4")}`, { timeout: 2000 }), first.click()]);
    expect(new URL(page.url()).pathname).toBe("/de/autobahn/a4");
    await page.close();
  });

  it("a place line is still chosen in place: the home stays, the pill names it", async () => {
    const page = await browser.newPage();
    await home(page);
    await page.fill("#place-hq", "Wehlheiden");
    const opt = page.locator("#place-hresults a.place-opt", { hasText: "Wehlheiden" });
    await opt.waitFor({ timeout: 2000 });
    await opt.click();
    await expect.poll(async () => ((await page.locator("#place-pill-label").textContent()) ?? "").trim(), { timeout: 2000 }).toContain("Wehlheiden");
    expect(new URL(page.url()).pathname).toBe("/de");
    await page.close();
  });
});
