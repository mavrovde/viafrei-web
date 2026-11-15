/**
 * #1197: on a motorway page a link of the first block — a jump chip ("Sperrungen 4"), a top item naming one closure —
 * scrolls ONCE to its target and stays. The owner saw the page "jumping there and back" (A5, A81): the browser jumps to
 * the anchor, and then the desk script (`lib/desk.ts`, on `hashchange` and at load) scrolled a second time, centring the
 * target, whether or not the target had been hidden in a fold.
 *
 * Every link of `#page-first` that names an anchor is clicked from the top of the page, and `scrollY` is recorded on
 * every scroll event and every frame for 1.5 s; after the first arrival the position never moves more than 4 px back
 * towards where it started, and the target's top ends below the header and inside the window. The same for a load
 * carrying the hash. Chromium (owner 2026-11-06: Chromium first — the back-step shows there, 261–336 px before the fix;
 * the owner saw it in Firefox, whose run of this file before the fix showed none at these widths); desktop and phone.
 *
 * Run in the pinned Linux image (`e2e-arm.sh`); every wait is under the two-second ceiling.
 */
import type { ChildProcess } from "node:child_process";
import { chromium, type Browser, type BrowserContext, type BrowserType, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8974;
const ID = { IMPRESSUM_NAME: "Fold Probe", IMPRESSUM_STREET: "Probeweg 5", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "fold@example.invalid" };
const THIRD_PARTY = /googletagmanager\.com|google-analytics\.com|clarity\.ms/u;
const VIEWS = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
] as const;
// the A5 the owner saw it on (its closures chip), and two more of the fixture's register
const ROADS = ["/de/autobahn/a5", "/en/motorway/a7", "/de/autobahn/a4"] as const;
const BACK_MAX = 4;
const TRACE_MS = 1_500;
const ENGINES: readonly (readonly [string, BrowserType])[] = [["chromium", chromium]];

let digest: Awaited<ReturnType<typeof startRealDigest>>;
let shell: ChildProcess;
const browsers = new Map<string, Browser>();
const url = (path: string): string => `http://127.0.0.1:${String(PORT)}${path}`;

beforeAll(async () => {
  digest = await startRealDigest({});
  shell = await startShell(PORT, { ...ID, DIGEST_URL: digest.url, VF_MOTORWAY_AROUND: "1" });
  for (const [name, type] of ENGINES) browsers.set(name, await type.launch());
});
afterAll(async () => {
  for (const b of browsers.values()) await b.close();
  shell?.kill();
  await digest?.close();
});

/** The recorder: every scroll event and every frame, from `window.__vfStart()` for TRACE_MS. */
const RECORDER = `(() => {
  const t = [];
  window.__vfTrace = t;
  let until = 0;
  const note = () => { if (performance.now() <= until) t.push(Math.round(window.scrollY)); };
  addEventListener("scroll", note, { passive: true });
  const frame = () => { note(); if (performance.now() <= until) requestAnimationFrame(frame); };
  window.__vfStart = (ms) => { t.length = 0; until = performance.now() + ms; t.push(Math.round(window.scrollY)); requestAnimationFrame(frame); };
})();`;

async function open(engine: string, path: string, viewport: { readonly width: number; readonly height: number }): Promise<{ readonly ctx: BrowserContext; readonly page: Page }> {
  const ctx = await browsers.get(engine)!.newContext({ viewport, hasTouch: viewport.width < 1024 });
  ctx.setDefaultTimeout(2_000);
  await ctx.route(THIRD_PARTY, (r) => r.fulfill({ status: 204, body: "" }));
  await ctx.addInitScript(RECORDER);
  const page = await ctx.newPage();
  return { ctx, page };
}

/** The largest step back towards the start after the first arrival (0: it went once and stayed). */
function backStep(trace: readonly number[], start: number): number {
  const first = trace.findIndex((y) => Math.abs(y - start) > BACK_MAX);
  if (first < 0) return 0;
  const dir = Math.sign(trace[first]! - start);
  let best = trace[first]!;
  let back = 0;
  for (const y of trace.slice(first + 1)) {
    if (dir * (y - best) > 0) best = y;
    back = Math.max(back, dir * (best - y));
  }
  return back;
}

async function landing(page: Page, id: string): Promise<{ readonly top: number; readonly head: number; readonly vh: number }> {
  return page.evaluate((i) => {
    const t = document.getElementById(i);
    const h = document.querySelector(".site-head");
    return { top: t === null ? Number.NaN : Math.round(t.getBoundingClientRect().top), head: h === null ? 0 : Math.max(0, Math.round(h.getBoundingClientRect().bottom)), vh: window.innerHeight };
  }, id);
}

describe("a first-block link on a motorway page scrolls once and stays (#1197)", () => {
  const measured: Record<string, unknown> = {};
  afterAll(() => console.log(`motorway jump 1197: ${JSON.stringify(measured)}`));
  for (const [engine] of ENGINES) {
    for (const v of VIEWS) {
      for (const road of ROADS) {
        it(`${engine} ${road} at ${String(v.width)}×${String(v.height)}: every link clicked`, async () => {
          const { ctx, page } = await open(engine, road, v);
          await page.goto(url(road));
          const hrefs = [...new Set(await page.locator("#page-first a[href^='#']").evaluateAll((as) => as.filter((a) => a.getBoundingClientRect().width > 0).map((a) => a.getAttribute("href")!)))];
          expect(hrefs.length, "the first block links to its sections").toBeGreaterThan(1);
          const bad: string[] = [];
          for (const h of hrefs) {
            await page.evaluate(() => { history.replaceState(null, "", location.pathname + location.search); window.scrollTo({ top: 0, behavior: "instant" }); });
            await page.evaluate((ms) => (window as unknown as { __vfStart: (n: number) => void }).__vfStart(ms), TRACE_MS);
            // the one the visitor sees (a phone holds a second, folded copy of some links)
            await page.locator(`#page-first a[href="${h}"]`).filter({ visible: true }).first().click();
            await page.waitForTimeout(TRACE_MS + 100);
            const trace = await page.evaluate(() => (window as unknown as { __vfTrace: number[] }).__vfTrace.slice());
            const back = backStep(trace, trace[0] ?? 0);
            const l = await landing(page, h.slice(1));
            measured[`${engine} ${road} ${String(v.width)} ${h}`] = { back, from: trace[0], to: trace[trace.length - 1], max: Math.max(...trace), top: l.top, head: l.head };
            if (back > BACK_MAX) bad.push(`${h}: back ${String(back)} px (${trace.join(" ")})`);
            if (!(l.top >= l.head - 1 && l.top < l.vh)) bad.push(`${h}: its top ${String(l.top)} not between the header (${String(l.head)}) and the window's end`);
          }
          expect(bad, "every link scrolls once, and its target stands below the header").toEqual([]);
          await ctx.close();
        });
        it(`${engine} ${road} at ${String(v.width)}×${String(v.height)}: a load carrying the hash`, async () => {
          const probe = await open(engine, road, v);
          await probe.page.goto(url(road));
          // the closures' chip and the first closure row the first block names
          const hrefs = [...new Set(await probe.page.locator("#page-first a[href^='#']").evaluateAll((as) => as.map((a) => a.getAttribute("href")!)))].slice(0, 3);
          await probe.ctx.close();
          const bad: string[] = [];
          for (const h of hrefs) {
            const { ctx, page } = await open(engine, road, v);
            await ctx.addInitScript(`addEventListener("DOMContentLoaded", () => window.__vfStart(${String(TRACE_MS + 500)}));`);
            await page.goto(url(road + h));
            await page.waitForTimeout(TRACE_MS);
            const trace = await page.evaluate(() => (window as unknown as { __vfTrace: number[] }).__vfTrace.slice());
            const back = backStep(trace, 0);
            const l = await landing(page, h.slice(1));
            measured[`${engine} ${road} ${String(v.width)} load ${h}`] = { back, to: trace[trace.length - 1], max: Math.max(...trace), top: l.top, head: l.head };
            if (back > BACK_MAX) bad.push(`${h}: back ${String(back)} px (${trace.join(" ")})`);
            if (!(l.top >= l.head - 1 && l.top < l.vh)) bad.push(`${h}: its top ${String(l.top)} not between the header (${String(l.head)}) and the window's end`);
            await ctx.close();
          }
          expect(bad, "a load with the hash lands once, below the header").toEqual([]);
        });
      }
    }
  }
});
