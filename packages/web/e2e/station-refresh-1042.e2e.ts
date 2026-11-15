/**
 * #1042 "Refresh" criterion against the REAL built shell and the REAL digest (Köln Hbf's fixture board), in a real
 * browser with a fake clock: after the board's data changes, the departures card refreshes by itself at its cadence
 * (`STATION_LIVE_REFRESH_SECONDS.board`, 60 s) WITHOUT a page reload, the new rows replace the old ones in place; while
 * the tab is hidden (the Page Visibility API) no refresh is asked, and one is asked at once when it returns.
 *
 * The change is planted in the card's own answer: the first refresh is the digest's card with one more departure row
 * (a destination the fixture holds nowhere), so "the departures changed" is observable as that row appearing — the
 * shell and the digest render exactly as in production, only the data under the card moved. Measured in the Linux
 * image only (the lead runs the e2e suite there).
 */
import type { ChildProcess } from "node:child_process";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { stationPath } from "../src/site/stations.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8964;
const BASE = `http://127.0.0.1:${String(PORT)}`;
const CARD = "#pcard-station-board";
const PLANTED = "Planthausen Hbf";
/** No wait above 2 s (owner 2026-10-26). */
const WAIT = { timeout: 2000 } as const;

let browser: Browser;
let shell: ChildProcess;
let digest: Awaited<ReturnType<typeof startRealDigest>>;

beforeAll(async () => {
  digest = await startRealDigest();
  shell = await startShell(PORT, { DIGEST_URL: digest.url, WEB_TILE_TIMEOUT_MS: "2000" });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
});

/** The board card's refresh requests the page made. */
function boardAsks(page: Page): string[] {
  const seen: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/fragment/card?") && r.url().includes("card=board")) seen.push(r.url());
  });
  return seen;
}

/** Every refresh of the board answers the digest's card with one more row: the departures changed under the card. */
async function plantChangedBoard(page: Page): Promise<void> {
  await page.route("**/fragment/card?**card=board**", async (route) => {
    const res = await route.fetch();
    const html = await res.text();
    const row = `<tr class="vf-planted"><td>12:34</td><td>RE 99</td><td>${PLANTED}</td><td>7</td></tr>`;
    const changed = html.includes("</tbody>") ? html.replace("</tbody>", `${row}</tbody>`) : html.replace("</article>", `<p class="vf-planted">${PLANTED}</p></article>`);
    await route.fulfill({ status: 200, headers: { ...res.headers(), "content-type": "text/html; charset=utf-8", etag: '"cd-0000000000000000000000aa"' }, body: changed });
  });
}

describe("#1042: the departures refresh in place, and only while the tab is visible", () => {
  it("an auto refresh brings the changed board without a reload; hidden, nothing is asked; back, one refresh at once", async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    ctx.setDefaultTimeout(2000);
    const page = await ctx.newPage();
    await page.clock.install();
    const asks = boardAsks(page);
    await plantChangedBoard(page);
    await page.goto(`${BASE}${stationPath("de", "koeln-hbf")}`, { waitUntil: "domcontentloaded" });
    await page.locator(CARD).waitFor(WAIT);
    const every = Number(await page.locator(CARD).getAttribute("data-refresh"));
    expect(every, "the board refreshes every minute").toBe(60);
    expect(await page.locator(`${CARD} .vf-planted`).count(), "the page's own board carries no planted row").toBe(0);
    await page.evaluate(() => ((window as unknown as { __vfMark: number }).__vfMark = 1042));

    // the cadence passes: one refresh, the changed board in place, the same document
    await page.clock.runFor(every * 1000 + 1000);
    await expect.poll(() => asks.length, WAIT).toBe(1);
    await page.locator(`${CARD} .vf-planted`).waitFor(WAIT);
    expect(await page.locator(CARD).textContent()).toContain(PLANTED);
    expect(await page.evaluate(() => (window as unknown as { __vfMark?: number }).__vfMark), "no reload").toBe(1042);

    // hidden: two cadences pass and nothing is asked
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.clock.runFor(every * 1000 * 2);
    expect(asks.length, "no refresh while the tab is hidden").toBe(1);

    // visible again: one refresh at once
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect.poll(() => asks.length, WAIT).toBe(2);
    expect(await page.evaluate(() => (window as unknown as { __vfMark?: number }).__vfMark)).toBe(1042);
    // a refresh still in flight must not reach route.fetch after the context is gone (an unhandled rejection otherwise)
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await ctx.close();
  });
});
