/**
 * #1115 against the REAL built shell and the REAL digest (Köln's fixture stations card), the browser half of the
 * issue's 360 px criterion, light and dark: on Köln's place page the page scrolls sideways nowhere, every stop's
 * departure table stays inside the card, the platform and state cells are not clipped, and the first two stops show
 * their departure rows in full — no inner scroll box hides them. The markup half (every stop in full, no "more stops",
 * the five columns) is `packages/digest/src/cards/stations/departure-board-1115.test.ts` and the #1115 describe of
 * `stations-card.test.ts`.
 */
import type { ChildProcess } from "node:child_process";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { placePath } from "../src/site/places.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";
import { gotoSettled } from "./settle.js";

const PORT = 8963;
const BASE = `http://127.0.0.1:${String(PORT)}`;
const CARD = "#pcard-stations";
let browser: Browser;
let shell: ChildProcess;
let digest: Awaited<ReturnType<typeof startRealDigest>>;

beforeAll(async () => {
  digest = await startRealDigest();
  shell = await startShell(PORT, { DIGEST_URL: digest.url, WEB_TILE_TIMEOUT_MS: "2000" });
  browser = await chromium.launch();
}, 120_000);
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
});

describe("#1115: the stations card at 360 px reads as a board, no part of it clipped or scrolled away", () => {
  for (const scheme of ["light", "dark"] as const) {
    it(`360 px, ${scheme}`, async () => {
      const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, colorScheme: scheme });
      ctx.setDefaultTimeout(2000);
      const page = await ctx.newPage();
      // parsed and quiet, not `networkidle`, which can fire before the page is parsed (e2e/settle.ts)
      await gotoSettled(page, `${BASE}${placePath("de", "koeln")}`, { timeout: 2000 });
      const tables = page.locator(`${CARD} table.pcard__board`);
      // the precondition: at least two stops carry a board, so every measure below is about real tables
      expect(await tables.count()).toBeGreaterThanOrEqual(2);

      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over, `the page scrolls sideways by ${String(over)} px`).toBeLessThanOrEqual(0);

      const m = await page.$eval(CARD, (card) => {
        const box = card.getBoundingClientRect();
        const visible = (e: Element): boolean => (e as HTMLElement).offsetParent !== null;
        const ts = [...card.querySelectorAll("table.pcard__board")].filter(visible);
        const cells = [...card.querySelectorAll("td.pcard__pf, td.pcard__st")].filter(visible) as HTMLElement[];
        // any element between the card and a table that would hide rows behind its own scroll bar
        const scrollers = ts.flatMap((t) => {
          const out: string[] = [];
          for (let e = t.parentElement; e !== null && e !== card; e = e.parentElement) {
            const cs = getComputedStyle(e);
            if (/(auto|scroll|hidden)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 1) out.push(e.className);
            if (/(auto|scroll)/.test(cs.overflowX) && e.scrollWidth > e.clientWidth + 1) out.push(e.className);
          }
          return out;
        });
        return {
          tablesOut: ts.filter((t) => t.getBoundingClientRect().right > box.right + 0.5 || t.getBoundingClientRect().left < box.left - 0.5).length,
          cells: cells.length,
          clipped: cells.filter((c) => c.scrollWidth > c.clientWidth + 1).map((c) => c.textContent?.trim() ?? ""),
          scrollers,
        };
      });
      expect(m.tablesOut, "a stop's table wider than the card").toBe(0);
      expect(m.cells).toBeGreaterThan(0);
      expect(m.clipped, "a platform or state cell is clipped").toEqual([]);
      expect(m.scrollers, "an inner scroll box hides part of a board").toEqual([]);

      // the first two stops' departure rows are rendered and on screen when scrolled to, none of them hidden
      for (const i of [0, 1]) {
        const rows = tables.nth(i).locator("tbody tr");
        const n = await rows.count();
        expect(n, `stop ${String(i + 1)} carries departures`).toBeGreaterThan(0);
        for (let r = 0; r < n; r++) {
          const row = rows.nth(r);
          if (!(await row.isVisible())) continue; // a row the fold holds back is #938's, not hidden by layout
          const b = await row.boundingBox();
          expect(b, `stop ${String(i + 1)} row ${String(r + 1)}`).not.toBeNull();
          expect((b?.x ?? -1) >= 0 && (b?.x ?? 0) + (b?.width ?? 0) <= 360.5, `stop ${String(i + 1)} row ${String(r + 1)} inside 360 px`).toBe(true);
        }
      }
      await ctx.close();
    });
  }
});
