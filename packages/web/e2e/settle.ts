/**
 * Open a page and wait until it is whole: parsed (`load`) AND the network quiet for 500 ms after that.
 *
 * Playwright's `networkidle` alone is not that. It is "no request for 500 ms", counted from the response, and it
 * does not wait for the parser: in the Linux e2e container (an emulated amd64 image on an arm64 host) the home's
 * HTML takes ~2 s to parse and lay out, and `networkidle` fired while `document.readyState` was still "loading" —
 * the DOM then held the header and half of `<main>`: no moment questions, no footer (measured on 2.5.7 and on the
 * trees before #1153, so the race is the harness's, not the release's). `scripts/visual.ts` `settled()` met the same
 * race in 2.4.3 and waits for `load` too. The quiet window is counted from `load` on, so a request the islands send
 * on `DOMContentLoaded` or later (a deferred card, a tile) is waited for as well.
 */
import type { Page, Response } from "playwright";

const QUIET_MS = 500;

export async function gotoSettled(page: Page, url: string, opts: { readonly timeout?: number } = {}): Promise<Response | null> {
  const timeout = opts.timeout ?? 2_000; // the two-second ceiling (owner 2026-10-26): a page not whole in 2 s is a finding, not a wait
  let inflight = 0;
  let last = Date.now();
  const up = (): void => { inflight += 1; last = Date.now(); };
  const down = (): void => { inflight = Math.max(0, inflight - 1); last = Date.now(); };
  page.on("request", up);
  page.on("requestfinished", down);
  page.on("requestfailed", down);
  try {
    const res = await page.goto(url, { waitUntil: "load", timeout });
    const until = Date.now() + timeout;
    while (inflight > 0 || Date.now() - last < QUIET_MS) {
      if (Date.now() > until) throw new Error(`gotoSettled: ${url} not quiet after ${String(timeout)} ms (${String(inflight)} request(s) in flight)`);
      await page.waitForTimeout(50);
    }
    return res;
  } finally {
    page.off("request", up);
    page.off("requestfinished", down);
    page.off("requestfailed", down);
  }
}
