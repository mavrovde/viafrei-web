/**
 * #1075 against the REAL built shell and the REAL digest, in a real browser: a VBB station-entrance row (the step-free
 * survey table's `vbb_haltestellenzugaenge`) rides on its stop in the place page's stations card, said as the VBB's
 * survey with its lift count — never as working lifts, never with a BFRK data status — and the VBB's own credit line
 * travels with the card, in German and in English. (A page without the row names no VBB: the card's unit suite holds
 * that; the fixture's switch is process-wide, so one process serves one shape.)
 *
 * The row is the fixture's (`startRealDigest({ survey: "vbb" })`, at the Köln fixture's Dom/Hbf stop): the browser
 * layer is what is judged here; the parser, the pairing and the tool are judged in their own suites. Run in the pinned
 * Linux image (`e2e-arm.sh`); every wait is under the two-second ceiling.
 */
import type { ChildProcess } from "node:child_process";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8879;
const BASE = `http://127.0.0.1:${String(PORT)}`;
const CREDIT = "Aufzüge und Zugänge: VBB Verkehrsverbund Berlin-Brandenburg GmbH (Haltestellenzugänge), CC BY 4.0, bearbeitet";

let browser: Browser;
let shell: ChildProcess;
let digest: Awaited<ReturnType<typeof startRealDigest>>;

beforeAll(async () => {
  digest = await startRealDigest({ survey: "vbb" });
  shell = await startShell(PORT, { DIGEST_URL: digest.url, WEB_TILE_TIMEOUT_MS: "2000" });
  browser = await chromium.launch();
}, 120_000);
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
});

/** The place page with every fold opened, as a person's click opens it. */
async function open(base: string, lang: "de" | "en"): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  ctx.setDefaultTimeout(2000);
  const page = await ctx.newPage();
  const r = await page.goto(`${base}/${lang}/place/koeln`, { waitUntil: "domcontentloaded" });
  expect(r?.status()).toBe(200);
  await page.locator("#pcard-stations").waitFor();
  await page.$$eval("details:not([open])", (ds) => ds.forEach((d) => d.setAttribute("open", "")));
  return page;
}
const cardText = async (page: Page): Promise<string> => ((await page.textContent("#pcard-stations")) ?? "").replace(/\s+/g, " ");
const pageText = async (page: Page): Promise<string> => ((await page.textContent("body")) ?? "").replace(/\s+/g, " ");

describe("#1075: the VBB's lifts on the stations card", () => {
  it("de: 'Erhebung VBB: 3 Aufzüge' on the stop, no BFRK status, the VBB's line credited", async () => {
    const page = await open(BASE, "de");
    const t = await cardText(page);
    expect(t).toContain("Erhebung VBB: 3 Aufzüge");
    expect(t).not.toContain("BFRK-Erhebung");
    expect(await pageText(page)).toContain(CREDIT);
    await page.context().close();
  });

  it("en: 'survey by VBB: 3 lifts', the same German credit line verbatim", async () => {
    const page = await open(BASE, "en");
    const t = await cardText(page);
    expect(t).toContain("survey by VBB: 3 lifts");
    expect(t).not.toContain("BFRK survey");
    expect(await pageText(page)).toContain(CREDIT);
    await page.context().close();
  });
});
