/**
 * Data-steward ruling FS-2026-11-06, addendum FS10: the consent sheet (`.consent--sheet`) in a real Chromium against the
 * BUILT server with a tag, on the home. FS10g (ii) at 320 and 390 px in de and el, (iii) the same at 200 % text, and
 * FS10b's first view at 320, 360 and 390 px in every live language:
 *   - FS10a: the box says its text goes on — a dashed cut line, in view, while there is more to read;
 *   - FS10b: at the box's first scroll the title is whole and the first body line has begun;
 *   - FS10c: both buttons are whole inside the viewport, equal and unoverlapped, also at 200 % text;
 *   - FS10d: scrolling, focusing and tabbing decide nothing and fetch nothing; Escape in the box stores `denied`;
 *   - Shift+Tab from accept reaches decline, then the Datenschutz link (scrolled into view), then the box.
 * The unit half (FS10f and the stylesheet's cue) is `test/consent-sheet-fs10.test.ts`. Linux only, like every browser
 * suite here (the laptop is macOS).
 */
import type { ChildProcess } from "node:child_process";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LIVE_LANGS } from "../src/site/pages.js";
import { startShell } from "./server.js";
import { startStubDigest } from "./stub-digest.js";

const ID = { IMPRESSUM_NAME: "Sheet Probe", IMPRESSUM_STREET: "Probeweg 7", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "sheet@example.invalid" };
const PORT = 8905;
const KEY = "viafrei.consent.analytics";
const SHEET = ".consent.consent--sheet[role=dialog]";
const BOX = `${SHEET} .consent__text`;
const LINK = `${SHEET} .consent__body a`;
const ACCEPT = `${SHEET} [data-vf-consent="granted"]`;
const DECLINE = `${SHEET} [data-vf-consent="denied"]`;
const GTM = /googletagmanager\.com/u;
const THIRD_PARTY = /googletagmanager\.com|google-analytics\.com|clarity\.ms/u;
const PERSON_UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";

let shell: ChildProcess | undefined;
let stub: Awaited<ReturnType<typeof startStubDigest>>;
let browser: Browser;
const url = (path: string): string => `http://127.0.0.1:${String(PORT)}${path}`;

beforeAll(async () => {
  stub = await startStubDigest({});
  shell = await startShell(PORT, { ...ID, DIGEST_URL: stub.url, GOOGLE_TAG: "G-0" });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await stub?.close();
});

type Open = { readonly ctx: BrowserContext; readonly page: Page; readonly gtm: string[] };
async function open(width: number, lang: string, big = false): Promise<Open> {
  const ctx = await browser.newContext({ viewport: { width, height: 700 }, userAgent: PERSON_UA, hasTouch: true });
  ctx.setDefaultTimeout(2_000);
  const page = await ctx.newPage();
  const gtm: string[] = [];
  page.on("request", (r) => {
    if (GTM.test(r.url())) gtm.push(r.url());
  });
  await page.route(THIRD_PARTY, (r) => void r.fulfill({ status: 204, body: "" }));
  await page.goto(url(`/${lang}`));
  // 200 % text: the root's size doubled through the CSSOM (the page's CSP refuses an injected <style>), as a browser's
  // text-size setting doubles the default the stylesheet's `font-size: 100%` resolves against
  if (big) await page.evaluate(() => document.documentElement.style.setProperty("font-size", "200%", "important"));
  await page.waitForSelector(SHEET);
  return { ctx, page, gtm };
}

type R = { readonly top: number; readonly bottom: number; readonly left: number; readonly right: number; readonly width: number; readonly height: number };
const rect = (page: Page, sel: string): Promise<R> =>
  page.locator(sel).first().evaluate((e) => {
    const r = e.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
  });
const overlap = (a: R, b: R): boolean => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
const stored = (page: Page): Promise<string | null> => page.evaluate((k) => window.localStorage.getItem(k), KEY);
const active = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const e = document.activeElement;
    if (e === null) return "";
    if (e.matches("[data-vf-consent]")) return e.getAttribute("data-vf-consent") ?? "";
    if (e.matches(".consent__body a")) return "link";
    if (e.matches(".consent__text")) return "box";
    return e.tagName;
  });

/** FS10c: both buttons whole inside the viewport, equal, not over each other nor over the text box. */
async function buttonsWhole(page: Page, width: number, label: string): Promise<void> {
  const vh = page.viewportSize()!.height;
  const a = await rect(page, DECLINE);
  const b = await rect(page, ACCEPT);
  const box = await rect(page, BOX);
  for (const [n, r] of [["decline", a], ["accept", b]] as const) {
    expect(r.left, `${label} ${n} left`).toBeGreaterThanOrEqual(0);
    expect(r.right, `${label} ${n} right`).toBeLessThanOrEqual(width);
    expect(r.top, `${label} ${n} top`).toBeGreaterThanOrEqual(0);
    expect(r.bottom, `${label} ${n} bottom`).toBeLessThanOrEqual(vh);
    expect(overlap(r, box), `${label} ${n} clear of the text`).toBe(false);
  }
  expect(Math.abs(a.width - b.width), `${label} same width`).toBeLessThanOrEqual(1);
  expect(Math.abs(a.height - b.height), `${label} same height`).toBeLessThanOrEqual(1);
  expect(overlap(a, b), `${label} not over each other`).toBe(false);
}

/** FS10b: at the first scroll the title is whole inside the box and the first body line has begun. */
async function firstView(page: Page, label: string): Promise<void> {
  expect(await page.locator(BOX).evaluate((e) => e.scrollTop), `${label} first scroll`).toBe(0);
  const box = await rect(page, BOX);
  const title = await rect(page, `${SHEET} .consent__title`);
  const body = await rect(page, `${SHEET} .consent__body`);
  const lh = await page.locator(BOX).evaluate((e) => parseFloat(getComputedStyle(e).lineHeight));
  expect(title.top, `${label} title top`).toBeGreaterThanOrEqual(box.top - 0.5);
  expect(title.bottom, `${label} title whole`).toBeLessThanOrEqual(box.bottom + 0.5);
  expect(body.top + lh * 0.6, `${label} the first body line has begun`).toBeLessThanOrEqual(box.bottom + 0.5);
}

describe("FS10g (ii): the sheet at 320 and 390 px in de and el", () => {
  for (const width of [320, 390] as const) {
    for (const lang of ["de", "el"] as const) {
      it(`${lang} ${String(width)} px: buttons whole, the cue shown, the end reachable, the keyboard's order, Escape refuses, nothing fetched`, async () => {
        const { ctx, page, gtm } = await open(width, lang);
        const label = `${lang} ${String(width)}`;
        await buttonsWhole(page, width, label);
        await firstView(page, label);
        // FS10a: there is more to read, and the box says so with a dashed cut line, opaque at the first scroll
        const cue = await page.locator(BOX).evaluate((e) => {
          const c = getComputedStyle(e, "::after");
          return { more: e.scrollHeight > e.clientHeight + 1, line: c.borderBottomStyle, width: c.borderBottomWidth, opacity: Number(c.opacity), position: c.position };
        });
        expect(cue, label).toEqual({ more: true, line: "dashed", width: "1px", opacity: 1, position: "sticky" });
        // scrolling the box to its end shows the Datenschutz link — and decides nothing
        await page.locator(BOX).evaluate((e) => {
          e.scrollTop = e.scrollHeight;
        });
        const box = await rect(page, BOX);
        const link = await rect(page, LINK);
        expect(link.top, `${label} link in view`).toBeGreaterThanOrEqual(box.top - 0.5);
        expect(link.bottom, `${label} link in view`).toBeLessThanOrEqual(box.bottom + 0.5);
        await page.locator(BOX).evaluate((e) => {
          e.scrollTop = 0;
        });
        // the keyboard: accept has the focus on open; Shift+Tab reaches decline, the link (scrolled into view), the box
        await page.locator(ACCEPT).focus();
        await page.keyboard.press("Shift+Tab");
        expect(await active(page), label).toBe("denied");
        await page.keyboard.press("Shift+Tab");
        expect(await active(page), label).toBe("link");
        const box2 = await rect(page, BOX);
        const link2 = await rect(page, LINK);
        expect(link2.bottom, `${label} focusing the link scrolls it into view`).toBeLessThanOrEqual(box2.bottom + 0.5);
        expect(link2.top, `${label} focusing the link scrolls it into view`).toBeGreaterThanOrEqual(box2.top - 0.5);
        await page.keyboard.press("Shift+Tab");
        expect(await active(page), label).toBe("box");
        // FS10d: none of that decided or fetched anything
        expect(await stored(page), `${label} nothing stored before a decision`).toBeNull();
        expect(await page.locator(SHEET).count(), `${label} still asking`).toBe(1);
        // Escape, from inside the box, refuses
        await page.keyboard.press("Escape");
        expect((await stored(page))?.split("|")[0], `${label} Escape stored a refusal`).toBe("denied");
        await page.waitForSelector(SHEET, { state: "detached" });
        await page.waitForLoadState("networkidle");
        expect(gtm, `${label} no request to Google before or after a refusal`).toEqual([]);
        await ctx.close();
      });
    }
  }
});

describe("FS10g (iii): the same at 200 % text — the sheet may grow, nothing is clipped", () => {
  for (const width of [320, 390] as const) {
    for (const lang of ["de", "el"] as const) {
      it(`${lang} ${String(width)} px at 200 %: buttons whole, the title whole, the first line begun`, async () => {
        const { ctx, page, gtm } = await open(width, lang, true);
        const label = `${lang} ${String(width)} 200%`;
        expect(await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize)), "the text really is doubled").toBe(32);
        await buttonsWhole(page, width, label);
        await firstView(page, label);
        expect(await stored(page)).toBeNull();
        expect(gtm).toEqual([]);
        await ctx.close();
      });
    }
  }
});

describe("FS10b: the first view at 320, 360 and 390 px in every live language", () => {
  for (const width of [320, 360, 390] as const) {
    it(`${String(width)} px: the title whole and the first body line begun, in all ${String(LIVE_LANGS.length)} languages`, async () => {
      const ctx = await browser.newContext({ viewport: { width, height: 700 }, userAgent: PERSON_UA, hasTouch: true });
      ctx.setDefaultTimeout(2_000);
      await ctx.route(THIRD_PARTY, (r) => void r.fulfill({ status: 204, body: "" }));
      const page = await ctx.newPage();
      const asked: string[] = [];
      for (const lang of LIVE_LANGS) {
        await page.goto(url(`/${lang}`));
        await page.waitForSelector(SHEET);
        asked.push(lang);
        await firstView(page, `${lang} ${String(width)}`);
        await buttonsWhole(page, width, `${lang} ${String(width)}`);
      }
      expect(asked, "every language was really shown the sheet").toEqual([...LIVE_LANGS]);
      await ctx.close();
    });
  }
});
