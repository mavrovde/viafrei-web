/**
 * The visual gate's frozen clock (2.5.4 cut): the motorway index's `.fresh__age` is filled by AGES_JS from the
 * BROWSER's `Date.now()`, so before the clock was frozen its text grew a day at a time ("vor 30 Tagen", "vor 31 Tagen")
 * against the fixture's fixed instant and the twelve autobahn baselines changed height. A page the gate opens must
 * read the fixture's clock, whatever the calendar says, and keep its timers.
 */
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AGES_JS } from "../src/lib/motorway-filter.js";
import { FROZEN_AT, PAGE_MASKS, frozenPage } from "../scripts/visual.js";
import { NOW } from "./real-digest.js";

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
});

describe("the visual gate's browser clock is the fixture's (2.5.4 cut)", () => {
  it("is frozen at the fixture snapshot's own instant", () => {
    expect(FROZEN_AT.toISOString()).toBe(NOW.toISOString());
    expect(PAGE_MASKS).toContain(".fresh__age");
  });

  it("an age the page computes from Date.now() is the fixture's age, not today's", async () => {
    const ctx = await browser.newContext();
    try {
      const page = await frozenPage(ctx);
      const threeDaysBefore = new Date(FROZEN_AT.getTime() - 3 * 86_400_000).toISOString();
      await page.setContent(
        `<p><time class="fresh__t" datetime="${threeDaysBefore}">x</time><output class="fresh__age"></output></p>` +
          `<script>(function (C) {${AGES_JS}})({ lang: "de" });</script>`,
      );
      await page.waitForFunction(() => (document.querySelector(".fresh__age")?.textContent ?? "") !== "", undefined, { timeout: 2_000 });
      expect(await page.textContent(".fresh__age")).toBe(" (vor 3 Tagen)");
      expect(await page.evaluate(() => new Date().toISOString())).toBe(FROZEN_AT.toISOString());
    } finally {
      await ctx.close();
    }
  });
});
