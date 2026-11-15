/**
 * #1089 against the REAL built shell: the header's button says "Mit Ihrer KI verbinden" (or its short form where the
 * long one would push the nav), and the header row never wraps at 1024, 1120 and 1280 px in ANY live language — so in
 * the longest one too — on the connect page, and on the home with a place shown, where (since #1153) the header's
 * place row under it names the place ("Live für …", `#place-pill`; the echo of #1088 is retired). The source half (catalogues, accessible name, the two forms) is `test/nav-cta-1089.test.ts`.
 * Measured in the Linux image only (laptop fonts are not evidence).
 */
import type { ChildProcess } from "node:child_process";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { t } from "../src/i18n/index.js";
import { LIVE_LANGS, pathFor } from "../src/site/pages.js";
import { startShell } from "./server.js";
import { startStubDigest } from "./stub-digest.js";

const PORT = 8933;
const BASE = `http://127.0.0.1:${String(PORT)}`;
let browser: Browser;
let shell: ChildProcess;
let stub: Awaited<ReturnType<typeof startStubDigest>>;

beforeAll(async () => {
  stub = await startStubDigest({}, 5000, { fullCards: true });
  shell = await startShell(PORT, { DIGEST_URL: stub.url, WEB_TILE_TIMEOUT_MS: "2000" });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await stub?.close();
});

/** The header row as a visitor sees it: the items' vertical spread, the button's height, the page's overflow, the button's shown label. */
async function measure(page: Page): Promise<{ spread: number; btnHeight: number; lineHeight: number; overflow: number; label: string; shown: string[]; echo: number | null }> {
  return page.evaluate(() => {
    const row = document.querySelector(".site-head__row") as HTMLElement;
    const btn = document.querySelector(".site-head__cta") as HTMLElement;
    const kids = [...row.children].filter((c) => getComputedStyle(c).display !== "none") as HTMLElement[];
    const tops = kids.map((k) => k.getBoundingClientRect().top + k.getBoundingClientRect().height / 2);
    const shown = [...btn.querySelectorAll("span")].filter((s) => getComputedStyle(s).display !== "none").map((s) => s.textContent ?? "");
    const echo = document.getElementById("place-pill");
    return {
      spread: Math.max(...tops) - Math.min(...tops),
      btnHeight: btn.getBoundingClientRect().height,
      lineHeight: Number.parseFloat(getComputedStyle(btn).lineHeight) || 20,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      label: btn.getAttribute("aria-label") ?? "",
      shown,
      echo: echo === null || getComputedStyle(echo).display === "none" ? null : echo.getBoundingClientRect().width,
    };
  });
}

/** One language's header judged: one row, the button unwrapped and in one of its two forms, no horizontal scroll. */
function judge(m: Awaited<ReturnType<typeof measure>>, lang: (typeof LIVE_LANGS)[number], width: number): void {
  expect(m.spread, `${lang}: the row's items are on one line`).toBeLessThanOrEqual(4);
  expect(m.btnHeight, `${lang}: the button did not wrap`).toBeLessThan(m.lineHeight * 2 + 16);
  expect(m.overflow, `${lang}: no horizontal scroll`).toBeLessThanOrEqual(0);
  expect(m.shown, lang).toHaveLength(1);
  expect([t(lang, "nav.cta"), t(lang, "nav.ctaShort")], lang).toContain(m.shown[0]);
  if (width >= 1280) expect(m.shown[0], lang).toBe(t(lang, "nav.cta"));
  expect(m.label, lang).toContain("Claude, ChatGPT");
}

describe("#1089: the header button names its target and the header stays on one line", () => {
  for (const width of [1024, 1120, 1280] as const) {
    it(`${String(width)} px, every live language: one row, the button unwrapped, its label the long or the short form`, async () => {
      const ctx = await browser.newContext({ viewport: { width, height: 800 } });
      ctx.setDefaultTimeout(2000);
      const page = await ctx.newPage();
      for (const lang of LIVE_LANGS) {
        await page.goto(`${BASE}${pathFor("connect", lang)}`, { waitUntil: "domcontentloaded" });
        judge(await measure(page), lang, width);
      }
      await ctx.close();
    });
    // #1153: the place is named in the header's place row, under the brand row, which stays one row
    it(`${String(width)} px, every live language, the home with a place: the header names the place, the brand row still one row`, async () => {
      const ctx = await browser.newContext({ viewport: { width, height: 800 } });
      ctx.setDefaultTimeout(2000);
      const page = await ctx.newPage();
      for (const lang of LIVE_LANGS) {
        await page.goto(`${BASE}${pathFor("start", lang)}?at=dst:2891122`, { waitUntil: "load" });
        // #1098: the header names the address's place from the first render — no switch round-trip to announce it
        await page.waitForFunction(() => (document.querySelector("header #place-pill-label")?.textContent ?? "").includes("Kassel-Wehlheiden"));
        const m = await measure(page);
        expect(m.echo, `${lang}: the place pill is shown`).not.toBeNull();
        expect(m.echo ?? 0, `${lang}: the place pill has its width`).toBeGreaterThan(40);
        judge(m, lang, width);
      }
      await ctx.close();
    });
  }
});
