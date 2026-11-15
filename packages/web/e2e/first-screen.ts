/**
 * #1028 § 3, #1190: what a motorway page puts on a phone's first screen, as one measurement, so the two suites that
 * judge it (`seo-241.e2e.ts`, `place-fold-1190.e2e.ts`) read the same numbers: the map's thumbnail and where the live
 * summary ends.
 *
 * On the index the summary is the `.motorway-summary` block. On a road page it is the intro's live part, the counts with
 * their Stand and, since #1110 item 2, the junctions with something reported; the route sentence after it ("Die A7
 * führt von …") is the road's reference and may run below the fold.
 *
 * What this measures, exactly: Chromium, at scrollY 0, with the action bar asserted NOT visible (`.actionbar` stands at
 * y 743-812 of a 812 px phone and is hidden at rest by its scroll timeline, `animation-timeline` in `site.css`), and no
 * consent bar, because the e2e environment has no analytics tag.
 * What it does NOT measure, so a pass says nothing about them: the consent state (where analytics is on, a first visit has
 * the 184 px consent bar over the bottom of this screen instead, y 628-812) and a browser without scroll-driven animations
 * (there the action bar is always there, over y 743-812). Those two gaps belong to the first-screen series #1173/#1174.
 */
import type { Page } from "playwright";

export const PHONE = { width: 375, height: 812 } as const;

export type FirstScreen = {
  /** Where the map's thumbnail starts and how tall it is. */
  readonly mapTop: number;
  readonly mapHeight: number;
  /** How much of the map is on the first screen. */
  readonly mapShown: number;
  /** Where the live summary starts and ends. */
  readonly summaryTop: number;
  readonly summaryEnd: number;
};

export async function firstScreen(page: Page, path: string): Promise<FirstScreen> {
  // at rest, and with the bar there to be judged: a page with no bar would pass the next line about nothing
  const rest = await page.evaluate(() => ({ y: window.scrollY, bars: document.querySelectorAll(".actionbar").length, consent: document.querySelectorAll(".consent").length }));
  if (rest.y !== 0) throw new Error(`${path}: not at rest, scrollY ${String(rest.y)}`);
  if (rest.bars !== 1) throw new Error(`${path}: ${String(rest.bars)} action bars, want 1`);
  if (rest.consent !== 0) throw new Error(`${path}: a consent bar stands, which this measurement says it does not cover`);
  if (await page.locator(".actionbar").isVisible()) throw new Error(`${path}: the action bar is visible at rest, over the first screen`);
  const thumb = await page.locator(".motorway__thumb svg").first().boundingBox();
  if (thumb === null) throw new Error(`${path}: no map thumbnail`);
  const index = !/\/a\d+$/u.test(path);
  const routeAt = path.startsWith("/en/") ? ". The " : ". Die ";
  const summary = index
    ? await page.locator(".motorway-summary").first().boundingBox().then((b) => {
        if (b === null) throw new Error(`${path}: no live summary`);
        return { top: b.y, end: b.y + b.height };
      })
    : await page.evaluate((marker) => {
        // #1173: the read stands in the status block; a road without one still says it in the intro
        const status = document.querySelector("#page-first .statusline");
        if (status !== null) {
          const b = status.getBoundingClientRect();
          return { top: b.top, end: b.bottom };
        }
        const intro = document.querySelector(".motorway__intro")!;
        const walker = document.createTreeWalker(intro, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) {
          // "… West 59</a>. Die <span>A7</span> führt": the route sentence starts in the text node ". Die "
          const at = (n.textContent ?? "").indexOf(marker);
          if (at < 0) continue;
          const r = document.createRange();
          r.setStart(intro, 0);
          r.setEnd(n, at + 1);
          const rects = Array.from(r.getClientRects());
          return { top: Math.min(...rects.map((x) => x.top)), end: Math.max(...rects.map((x) => x.bottom)) };
        }
        return { top: Number.POSITIVE_INFINITY, end: Number.POSITIVE_INFINITY };
      }, routeAt);
  return {
    mapTop: thumb.y,
    mapHeight: thumb.height,
    mapShown: Math.min(thumb.y + thumb.height, PHONE.height) - thumb.y,
    summaryTop: summary.top,
    summaryEnd: summary.end,
  };
}
