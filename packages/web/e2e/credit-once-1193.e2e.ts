/**
 * #1193 against the BUILT shell and the REAL digest (`startRealDigest({ lorry: "sevas" })`: SEVAS's lorry restrictions
 * around the place): the road card printed SEVAS's credit line twice, one under the other — inside its lorry block and
 * again in the card's footer — on a phone (390 px), folded, in German and English. Each register line is on the card
 * once: in the DOM a phone renders with the card folded, and with its fold opened; and the fold's
 * "Quellen" line names the publisher once (FS3), and so does the opened card's short sources line (#1120). The line
 * is never dropped: it stays beside the lorry rows (K7.1).
 */
import type { ChildProcess } from "node:child_process";
import { LICENCE_CATALOGUE } from "@viafrei/ingest";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8973;
const BASE = `http://127.0.0.1:${String(PORT)}`;
const SEVAS_LINE = LICENCE_CATALOGUE["lorry_sevas_nrw"]?.attribution ?? "";
let browser: Browser;
let shell: ChildProcess;
let digest: Awaited<ReturnType<typeof startRealDigest>>;

beforeAll(async () => {
  digest = await startRealDigest({ lorry: "sevas" });
  shell = await startShell(PORT, { DIGEST_URL: digest.url, WEB_TILE_TIMEOUT_MS: "2000" });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
});

const times = (s: string, needle: string): number => s.split(needle).length - 1;

/** The road card's element: its article, or — on the all-clear list — the row holding its footer. */
async function roadsTexts(page: Page): Promise<{ readonly text: string; readonly credits: string[]; readonly summary: string; readonly folded: boolean }> {
  return page.evaluate(() => {
    const el = document.querySelector("#pcard-roads") ?? document.querySelector("#pcard-roads-sources")?.closest("li") ?? null;
    if (el === null) return { text: "", credits: [], summary: "", folded: false };
    const credits = [...el.querySelectorAll("p.credit")].map((p) => (p.textContent ?? "").replace(/\s+/gu, " "));
    const fold = el.querySelector("details.pcard__fold");
    return { text: (el.textContent ?? "").replace(/\s+/gu, " "), credits, summary: (fold?.querySelector("summary")?.textContent ?? "").replace(/\s+/gu, " "), folded: fold !== null && !(fold as HTMLDetailsElement).open };
  });
}

describe("#1193: SEVAS's lorry credit once on the road card, folded on a phone", () => {
  it("the register line under test is SEVAS's", () => {
    expect(SEVAS_LINE).toContain("NRW.Mobidrom GmbH (SEVAS)");
  });

  for (const path of ["/de/place/koeln", "/en/place/koeln"] as const) {
    it(`${path}: the card holds the line once on a 390 px phone, folded and opened`, async () => {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
      const page = await ctx.newPage();
      const r = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
      expect(r?.status(), path).toBe(200);
      // the lorry block is on the road card (the fixture answered), and its line is on the card once
      expect(await page.locator("#pcard-roads .pcard__lorry-db, li .pcard__lorry-db").count(), path).toBeGreaterThan(0);
      const before = await roadsTexts(page);
      expect(times(before.text, SEVAS_LINE), path).toBe(1);
      expect(before.credits.filter((t) => t.includes(SEVAS_LINE)), path).toHaveLength(1);
      // folded on a phone (the card's second place or later), and the fold's FS3 line names the publisher once
      expect(before.folded, path).toBe(true);
      expect(times(before.summary, "NRW.Mobidrom GmbH"), path).toBe(1);
      await page.$$eval("details.pcard__fold:not([open])", (ds) => ds.forEach((d) => d.setAttribute("open", "")));
      const after = await roadsTexts(page);
      expect(after.credits.filter((t) => t.includes(SEVAS_LINE)), path).toHaveLength(1);
      // no credit line of the card is printed twice
      expect(new Set(after.credits).size, path).toBe(after.credits.length);
      // the opened card's short sources line (#1120) names every provider of its credit lines — NRW.Mobidrom, whose
      // line stands in the lorry block and not in the footer, exactly once
      const short = await page.evaluate(() => (document.querySelector("#pcard-roads-sources .sources__line")?.textContent ?? "").replace(/\s+/gu, " "));
      expect(short, path).not.toBe("");
      expect(times(short, "NRW.Mobidrom GmbH"), path).toBe(1);
      await ctx.close();
    });
  }
});
