/**
 * #1201: the compact desktop header (from 1024 px, #1180) with a place kept on the device. The kept-place line ("Ihr
 * Browser merkt sich diesen Ort · Ort vergessen") made the place cell's one-line length its auto column's width, and the
 * beta notice beside it was squeezed into a ~60 px column: the header was 311 px tall at 1024 px in Chromium (213 px on
 * a motorway page at 1100 px), 310 px in the owner's Firefox.
 *
 * At 1024, 1100, 1200, 1280 and 1440 px, with and without a kept place, on the home, a place page, a motorway page and
 * the news: the beta notice is at least 18rem wide, is one line or two broken at words (nothing inside it overflows),
 * and the header is its two rows — the brand row and the taller of the notice and the place cell — and nothing more.
 * Chromium (owner 2026-11-06: Chromium first; this fault shows there at 213–311 px).
 *
 * Run in the pinned Linux image (`e2e-arm.sh`); every wait is under the two-second ceiling.
 */
import type { ChildProcess } from "node:child_process";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pathFor } from "../src/site/pages.js";
import { placePath } from "../src/site/places.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8976;
const ID = { IMPRESSUM_NAME: "Fold Probe", IMPRESSUM_STREET: "Probeweg 5", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "fold@example.invalid" };
const THIRD_PARTY = /googletagmanager\.com|google-analytics\.com|clarity\.ms/u;
const KEPT = { at: "ags:06611000", how: "manual", label: "Kassel" };
const WIDTHS = [1024, 1100, 1200, 1280, 1440] as const;
const PAGES = [pathFor("start", "de"), placePath("en", "koeln"), "/en/motorway/a5", "/de/autobahn/a7", pathFor("news", "de")] as const;
const MIN_BETA = 18 * 16;

let browser: Browser;
let digest: Awaited<ReturnType<typeof startRealDigest>>;
let shell: ChildProcess;
const base = `http://127.0.0.1:${String(PORT)}`;

beforeAll(async () => {
  digest = await startRealDigest({});
  shell = await startShell(PORT, { ...ID, DIGEST_URL: digest.url, VF_MOTORWAY_AROUND: "1" });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
});

describe("the compact header keeps the beta notice readable and stays two rows (#1201)", () => {
  const measured: Record<string, unknown> = {};
  afterAll(() => console.log(`header 1201: ${JSON.stringify(measured)}`));
  for (const kept of [true, false]) {
    for (const path of PAGES) {
      it(`${path} ${kept ? "with" : "without"} a kept place, ${WIDTHS.join("/")} px`, async () => {
        const bad: string[] = [];
        for (const width of WIDTHS) {
          const ctx = await browser.newContext({ viewport: { width, height: 900 } });
          ctx.setDefaultTimeout(2_000);
          await ctx.route(THIRD_PARTY, (r) => r.fulfill({ status: 204, body: "" }));
          if (kept) await ctx.addInitScript((k) => localStorage.setItem("viafrei.place", JSON.stringify(k)), KEPT);
          const page = await ctx.newPage();
          await page.goto(`${base}${path}`);
          // the island names the kept place in the header (the kept line shown), or the page has none
          if (kept) await page.locator("#place-kept:not([hidden])").first().waitFor({ state: "visible", timeout: 1_500 }).catch(() => undefined);
          const m = await page.evaluate(() => {
            const box = (s: string): DOMRect | null => document.querySelector(s)?.getBoundingClientRect() ?? null;
            const head = box(".site-head");
            const row = box(".site-head > .site-head__row");
            const beta = box(".site-head > .beta");
            const place = box(".site-head > .site-place");
            const text = document.querySelector<HTMLElement>(".site-head > .beta .beta__text");
            const lh = text === null ? 0 : parseFloat(getComputedStyle(text).lineHeight) || 16;
            const over = [...(document.querySelectorAll<HTMLElement>(".site-head > .beta *"))].filter((e) => e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0).length;
            const shown = document.querySelector<HTMLElement>("#place-kept")?.hidden === false;
            const compact = getComputedStyle(document.querySelector(".site-head")!).display === "grid";
            return { compact, shown, head: head?.height ?? 0, row: row?.height ?? 0, beta: beta?.width ?? 0, betaH: beta?.height ?? 0, place: place?.height ?? 0, lines: text === null ? 0 : Math.round(text.getBoundingClientRect().height / lh), over };
          });
          measured[`${path} ${String(width)} ${kept ? "kept" : "none"}`] = { head: Math.round(m.head), beta: Math.round(m.beta), lines: m.lines, kept: m.shown };
          await ctx.close();
          expect(m.compact, `${path} at ${String(width)}: the compact header (#1180)`).toBe(true);
          if (kept) expect(m.shown, `${path} at ${String(width)}: the kept place is named in the header`).toBe(true);
          if (m.beta < MIN_BETA - 1) bad.push(`${String(width)}: the beta notice is ${String(Math.round(m.beta))} px wide (at least ${String(MIN_BETA)})`);
          if (m.lines > 2) bad.push(`${String(width)}: the beta notice runs to ${String(m.lines)} lines`);
          if (m.over > 0) bad.push(`${String(width)}: ${String(m.over)} element(s) of the beta notice overflow (a word broken off)`);
          // two rows: the brand row, then the place cell (the notice beside it is never what makes the row taller than
          // the cell's two lines) and the header's own padding
          const two = m.row + Math.max(m.place, 52) + 12;
          if (m.head > two) bad.push(`${String(width)}: the header is ${String(Math.round(m.head))} px tall, more than its two rows (${String(Math.round(two))})`);
        }
        expect(bad, `${path}: the beta notice keeps its width and the header its two rows`).toEqual([]);
      });
    }
  }
});
