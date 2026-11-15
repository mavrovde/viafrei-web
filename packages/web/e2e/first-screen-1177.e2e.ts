/**
 * #1177: the home on a phone, 375×812, when it knows a place: the H1 with its sentence, the connect button, the place's
 * lamp and count, what comes first; connecting within eighteen screens (owner 2026-11-06, was fifteen); the page's length and weight; the sticky button
 * never over the first screen, and counted. A home that knows no place keeps its open bar.
 *
 * Run in the pinned Linux image only.
 */
import { type ChildProcess } from "node:child_process";
import { gzipSync } from "node:zlib";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8895;
const PHONE = { width: 375, height: 812 } as const;
const AT = "ags:05315000";
const KEPT = { at: AT, how: "manual", label: "Köln" };
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

async function open(path: string, stored?: Readonly<Record<string, unknown>>): Promise<{ readonly ctx: BrowserContext; readonly page: Page }> {
  const ctx = await browser.newContext({ viewport: PHONE, userAgent: UA, hasTouch: true });
  ctx.setDefaultTimeout(2_000);
  if (stored !== undefined) await ctx.addInitScript((kept) => localStorage.setItem("viafrei.place", JSON.stringify(kept)), stored);
  await ctx.route(THIRD_PARTY, (r) => r.fulfill({ status: 204, body: "" }));
  const page = await ctx.newPage();
  await page.goto(`${base}${path}`);
  return { ctx, page };
}

const bottom = async (page: Page, sel: string): Promise<number> => {
  const b = (await page.locator(sel).first().boundingBox())!;
  return Math.round(b.y + b.height);
};

describe("the first viewport of the home (#1177 AC 1, 375×812)", () => {
  const measured: Record<string, unknown> = {};
  afterAll(() => {
    console.log(`first screen 1177: ${JSON.stringify(measured)}`);
  });
  for (const lang of ["de", "en"] as const) {
    it(`${lang}, a chosen place: the H1, its sentence, the button, the lamp, the count line and the first item`, async () => {
      const { ctx, page } = await open(`/${lang}?at=${AT}`);
      expect(await page.locator("#place-status").isVisible(), "the place block has its status").toBe(true);
      const m = { h1End: await bottom(page, "main h1"), pitchEnd: await bottom(page, ".hero__pitch"), buttonEnd: await bottom(page, ".hero__actions .btn--primary"), statusEnd: await bottom(page, "#place-status"), itemEnd: (await page.locator("#page-first .topitems__row").count()) === 0 ? null : await bottom(page, "#page-first .topitems__row") };
      measured[`${lang} chosen`] = m;
      for (const [k, v] of Object.entries(m)) if (v !== null) expect(v, k).toBeLessThanOrEqual(PHONE.height);
      await ctx.close();
    });
  }
  it("de, a place kept on this device: the bar folds when the island names it, the status stands in the first screen", async () => {
    const { ctx, page } = await open("/de", KEPT);
    await page.waitForFunction(() => document.querySelector("#place-status") !== null);
    expect(await page.locator("#place-fold").getAttribute("data-fold")).toBe("closed");
    const m = { statusEnd: await bottom(page, "#place-status") };
    measured["de kept"] = m;
    expect(m.statusEnd).toBeLessThanOrEqual(PHONE.height);
    await ctx.close();
  });
  it("a home that knows no place keeps its open bar, and its button", async () => {
    const { ctx, page } = await open("/de");
    expect(await page.locator("#place-fold").getAttribute("data-fold")).toBeNull();
    expect(await page.locator("#place-hq").isVisible()).toBe(true);
    expect(await page.locator("#place-open").isVisible()).toBe(false);
    await ctx.close();
  });
});

describe("the length, the order, the weight (#1177 AC 2, AC 3, AC 4)", () => {
  it("connecting within 18 screens, the page within 25, the place block within 10, at most 200 KB gzip, cards at three rows", async () => {
    const path = `/de?at=${AT}`;
    const { ctx, page } = await open(path);
    const m = await page.evaluate(() => {
      const top = (sel: string): number => {
        const e = document.querySelector(sel);
        return e === null ? Number.POSITIVE_INFINITY : e.getBoundingClientRect().top + window.scrollY;
      };
      const place = document.querySelector("#place");
      const rect = place!.getBoundingClientRect();
      const standing = Array.from(document.querySelectorAll("#place .pcard__list")).filter((e) => e.closest("details") === null).map((e) => e.children.length);
      return { start: top("#start"), day: top("#day"), page: document.documentElement.scrollHeight, place: rect.height, standing };
    });
    const html = await (await fetch(`${base}${path}`, { headers: { "user-agent": UA } })).text();
    const gz = gzipSync(html).length;
    console.log(`home budget 1177: ${JSON.stringify({ ...m, standing: undefined, raw: Buffer.byteLength(html), gz, screens: (m.page / PHONE.height).toFixed(1), placeScreens: (m.place / PHONE.height).toFixed(1), startScreens: (m.start / PHONE.height).toFixed(1) })}`);
    // owner 2026-11-06 ("Raise limits"): connecting within 18 screens, was 15
    expect(m.start).toBeLessThanOrEqual(18 * PHONE.height);
    expect(m.start, "connecting comes before the day").toBeLessThan(m.day);
    // owner 2026-11-06 ("Raise limits"): the page within 25 screens, was 20
    expect(m.page).toBeLessThanOrEqual(25 * PHONE.height);
    expect(m.place).toBeLessThanOrEqual(10 * PHONE.height);
    expect(Math.max(...m.standing, 0)).toBeLessThanOrEqual(3);
    expect(gz).toBeLessThanOrEqual(200_000);
    await ctx.close();
  });
});

describe("the folds that keep the home short (#1177 AC 2, owner 2026-11-05)", () => {
  it("on a phone: each Germany group shows its figure, the moments after the second their heading; one tap opens each", async () => {
    const { ctx, page } = await open(`/de?at=${AT}`);
    const groups = await page.locator("#now .now__group").evaluateAll((els) =>
      els.map((g) => ({
        id: g.id,
        first: g.querySelector(":scope .now__grid > div.now__cell")?.querySelector(":scope > details") === null,
        open: g.querySelectorAll("details.now__fold[open]").length,
        folds: g.querySelectorAll("details.now__fold").length,
        // FS-2026-11-06: a folded tile's credit lines fold WITH its data and its summary names the publishers (FS3); a fold
        // that holds a credit line without naming anyone, or the fuel tile in a fold (#423, FS5), is refused
        unnamed: Array.from(g.querySelectorAll("details.now__fold")).filter((d) => d.querySelector("p.credit") !== null && d.querySelector(":scope > summary .fold__sources") === null).length,
        fuelFolded: g.querySelectorAll("details #tile-fuel").length,
      })),
    );
    expect(groups.length).toBeGreaterThan(0);
    for (const g of groups) expect(g, g.id).toMatchObject({ first: true, open: 0, unnamed: 0, fuelFolded: 0 });
    expect(groups.some((g) => g.folds > 0)).toBe(true);
    // every credit line of the band outside a fold is in view on a phone: a credit never folds away from data in view
    const credits = page.locator("#now p.credit:not(details.now__fold p.credit)");
    expect(await credits.count()).toBeGreaterThan(0);
    for (let i = 0; i < (await credits.count()); i++) expect(await credits.nth(i).isVisible(), `credit ${String(i)}`).toBe(true);
    const fold = page.locator("#now details.now__fold").first();
    await fold.locator("> summary").click();
    expect(await fold.locator("> :not(summary)").first().isVisible()).toBe(true);
    const moments = await page.locator("#day .moment").evaluateAll((els) =>
      els.map((m) => ({ folded: m.querySelector("details.moment__qfold") !== null, mtsk: /Tankerkönig|MTS-K/u.test(m.textContent ?? "") })),
    );
    expect(moments.slice(0, 2).map((m) => m.folded)).toEqual([false, false]);
    // FS5 (FS-2026-11-06): every later moment folds its first question, unless what it shows credits the MTS-K's prices,
    // which never go behind a fold
    for (const [i, m] of moments.slice(2).entries()) expect(m.folded || m.mtsk, `moment ${String(i + 3)} folds, or is a fuel one`).toBe(true);
    const k = moments.findIndex((m, i) => i >= 2 && m.folded);
    expect(k, "a later moment folds").toBeGreaterThanOrEqual(2);
    const third = page.locator("#day .moment").nth(k);
    expect(await third.locator(".moment__title").isVisible()).toBe(true);
    expect(await third.locator(".ask").first().isVisible(), "its question waits behind the fold").toBe(false);
    await third.locator("details.moment__qfold > summary").click();
    expect(await third.locator(".ask").first().isVisible()).toBe(true);
    await ctx.close();
  });
  it("from 601 px up nothing is folded: no summary shows, every panel and question stands, with no script", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1024, height: 900 }, javaScriptEnabled: false });
    ctx.setDefaultTimeout(2_000);
    const page = await ctx.newPage();
    await page.goto(`${base}/de?at=${AT}`);
    for (const sel of ["#now details.now__fold", "#day details.moment__qfold", "#place details.pcard__fold"]) {
      const f = page.locator(sel);
      const n = await f.count();
      expect(n, sel).toBeGreaterThan(0);
      for (let i = 0; i < n; i++) expect(await f.nth(i).locator("> summary").isVisible(), `${sel} ${String(i)}`).toBe(false);
    }
    expect(await page.locator("#day .moment").nth(2).locator(".ask").first().isVisible()).toBe(true);
    expect(await page.locator("#now details.now__fold").first().locator("> :not(summary)").first().isVisible()).toBe(true);
    await ctx.close();
  });
});

describe("the sticky button (#1177)", () => {
  it("hidden on the first screen, shown after it, and a person can reach the page's end past it", async () => {
    const { ctx, page } = await open(`/de?at=${AT}`);
    const bar = page.locator(".actionbar");
    expect(await bar.isVisible()).toBe(false);
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".actionbar")!).visibility === "visible", undefined, { timeout: 2000 });
    expect(await bar.locator(".btn--primary").isVisible()).toBe(true);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const covered = await page.evaluate(() => {
      const bar = document.querySelector(".actionbar")!.getBoundingClientRect();
      const foot = document.querySelector("footer")!.getBoundingClientRect();
      return foot.bottom > bar.top + 1 && foot.bottom - bar.top > bar.height;
    });
    expect(covered, "the page's end stands above the bar").toBe(false);
    await ctx.close();
  });
});
