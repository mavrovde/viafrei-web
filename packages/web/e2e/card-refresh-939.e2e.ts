/**
 * #939 and #938 B4 against the REAL built shell and the REAL digest renderer over the production-scale fixture (no
 * database, no network), at 390 px:
 *
 *  - every card of the Köln place page carries its ↻; without JavaScript it is a link to the page at the card;
 *  - a press of ↻ asks `/fragment/card` for that card alone: the page is not reloaded, the scroll position and the
 *    focus stay; the second press revalidates (If-None-Match) and the unchanged card is a 304;
 *  - a failed refresh keeps the card and says "Stand HH:MM – Aktualisierung fehlgeschlagen";
 *  - a live card refreshes by itself at its table's cadence (fake clock), not while the tab is hidden, and once when
 *    the tab returns;
 *  - #938 B4: a step of the pager that fails keeps the entries shown, says so beside the fold and closes it; the next
 *    press loads the step.
 */
import { type ChildProcess } from "node:child_process";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8904;
const BASE = `http://127.0.0.1:${String(PORT)}`;
const PHONE = { width: 390, height: 844 };

let browser: Browser;
let shell: ChildProcess;
let digest: Awaited<ReturnType<typeof startRealDigest>>;

beforeAll(async () => {
  digest = await startRealDigest({ scale: "production" });
  shell = await startShell(PORT, { DIGEST_URL: digest.url, WEB_TILE_TIMEOUT_MS: "2000" });
  browser = await chromium.launch();
}, 120_000);
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
});

/** The card requests a page made, with their status and the validator they sent. */
function cardRequests(page: Page): { url: string; status: number; inm: string | null }[] {
  const seen: { url: string; status: number; inm: string | null }[] = [];
  page.on("response", (r) => {
    if (r.url().includes("/fragment/card?")) seen.push({ url: r.url(), status: r.status(), inm: r.request().headers()["if-none-match"] ?? null });
  });
  return seen;
}

/** The first card of the page that refreshes in place, by itself when `live`. */
async function firstCard(page: Page, live: boolean): Promise<string> {
  const id = await page.evaluate((l) => document.querySelector(l ? "article.pcard[data-card][data-refresh]" : "article.pcard[data-card]")?.id ?? "", live);
  expect(id, "the Köln page holds such a card").not.toBe("");
  return id;
}

describe("#939: a card refreshed in place", () => {
  it("every card carries its ↻; without JavaScript it links the page at the card", async () => {
    const ctx = await browser.newContext({ viewport: PHONE, javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/de/place/koeln`);
    const cards = await page.locator("article.pcard").evaluateAll((xs) => xs.map((x) => ({ id: x.id, href: x.querySelector(".pcard__refresh")?.getAttribute("href") ?? null })));
    expect(cards.length).toBeGreaterThan(2);
    for (const c of cards) expect(c.href, c.id).toBe(`/de/place/koeln#${c.id}`);
    await ctx.close();
  });

  it("↻ asks for that card alone: no reload, scroll and focus kept; the second press is a 304", async () => {
    const page = await browser.newPage({ viewport: PHONE });
    const seen = cardRequests(page);
    await page.goto(`${BASE}/de/place/koeln`);
    const id = await firstCard(page, false);
    await page.evaluate(() => {
      (window as unknown as { vfMark: number }).vfMark = 1;
    });
    const button = page.locator(`#${id} .pcard__refresh`);
    await button.scrollIntoViewIfNeeded();
    await button.focus();
    const scrollY = await page.evaluate(() => window.scrollY);
    await button.click();
    await page.waitForFunction(() => document.querySelectorAll("[aria-busy]").length === 0);
    await expect.poll(() => seen.length).toBe(1);
    expect(seen[0]!.status).toBe(200);
    expect(seen[0]!.url).toContain(`card=${id.replace("pcard-", "")}`);
    // the same document: nothing reloaded it
    expect(await page.evaluate(() => (window as unknown as { vfMark?: number }).vfMark)).toBe(1);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
    expect(await page.evaluate(() => document.activeElement?.classList.contains("pcard__refresh") ?? false)).toBe(true);
    await page.locator(`#${id} .pcard__refresh`).click();
    await expect.poll(() => seen.length).toBe(2);
    expect(seen[1]!.inm).toMatch(/^"cd-/);
    expect(seen[1]!.status).toBe(304);
    await page.close();
  });

  it("a failed refresh keeps the card and says the Stand it kept", async () => {
    const page = await browser.newPage({ viewport: PHONE });
    await page.goto(`${BASE}/de/place/koeln`);
    const id = await firstCard(page, false);
    const before = await page.locator(`#${id} .pcard__title`).textContent();
    await page.route("**/fragment/card?**", (r) => r.fulfill({ status: 503, body: "" }));
    await page.locator(`#${id} .pcard__refresh`).click();
    const line = page.locator(`#${id} .pcard__refreshfail`);
    await line.waitFor();
    expect(await line.textContent()).toMatch(/^Stand \d\d:\d\d – Aktualisierung fehlgeschlagen$/);
    expect(await page.locator(`#${id} .pcard__title`).textContent()).toBe(before);
    // the next success clears it
    await page.unroute("**/fragment/card?**");
    await page.locator(`#${id} .pcard__refresh`).click();
    await line.waitFor({ state: "detached" });
    await page.close();
  });

  it("a live card refreshes by itself at its cadence, never while the tab is hidden, and once when it returns", async () => {
    const page = await browser.newPage({ viewport: PHONE });
    await page.clock.install();
    const seen = cardRequests(page);
    await page.goto(`${BASE}/de/place/koeln`);
    const id = await firstCard(page, true);
    const every = Number(await page.locator(`#${id}`).getAttribute("data-refresh"));
    expect(every).toBeGreaterThan(0);
    const mine = (): number => seen.filter((s) => s.url.includes(`card=${id.replace("pcard-", "")}`)).length;
    await page.clock.runFor(every * 1000 - 1000);
    expect(mine()).toBe(0);
    await page.clock.runFor(2000);
    await expect.poll(mine).toBe(1);
    // hidden: the next cadence passes with no request
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    });
    await page.clock.runFor(every * 1000 * 2);
    expect(mine()).toBe(1);
    // back: one refresh at once
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect.poll(mine).toBe(2);
    await page.close();
  });
});

describe("#938 B4: a pager step that fails", () => {
  it("keeps the entries shown, says so beside the fold, closes it, and the next press loads the step", async () => {
    const page = await browser.newPage({ viewport: PHONE });
    await page.goto(`${BASE}/de/autobahn/a1`);
    const CARD = "#mwk-cities";
    const rows = page.locator(`${CARD} li[id^="mw-city-"]`);
    expect(await rows.count()).toBe(12);
    await page.route("**/fragment/more?**", (r) => r.fulfill({ status: 503, body: "" }));
    await page.locator(`${CARD} details.pager > summary`).first().click();
    const failed = page.locator(`${CARD} .pager__failed`);
    await failed.waitFor();
    expect(await failed.textContent()).toBe("Konnte nicht geladen werden – zum erneuten Versuch noch einmal öffnen");
    expect(await rows.count()).toBe(12);
    expect(await page.locator(`${CARD} details.pager`).first().evaluate((d) => (d as HTMLDetailsElement).open)).toBe(false);
    await page.unroute("**/fragment/more?**");
    await page.locator(`${CARD} details.pager > summary`).first().click();
    await page.waitForFunction((sel) => document.querySelectorAll(sel).length > 12, `${CARD} li[id^="mw-city-"]`);
    await failed.waitFor({ state: "detached" });
    await page.close();
  });
});
