/**
 * #986 against the BUILT shell and the REAL digest (`real-digest.ts`): on /de/autobahn/a7 every panel's head shows
 * one freshness sign — its shape, its word and a time — in a real browser; the relative age beside an absolute time is
 * written by the page's island script and moves with the clock without a reload (Playwright's clock); and with
 * JavaScript off the absolute `<time datetime>` is still there, which is never wrong.
 */
import type { ChildProcess } from "node:child_process";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { motorwayPath } from "../src/site/motorways.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8897;
const BASE = `http://127.0.0.1:${PORT}`;
const PERSON_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const ID = { IMPRESSUM_NAME: "Fresh Probe", IMPRESSUM_STREET: "Probeweg 7", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "fresh@example.invalid" };
const A7 = motorwayPath("de", "A7");

let browser: Browser;
let shell: ChildProcess;
let digest: Awaited<ReturnType<typeof startRealDigest>>;

beforeAll(async () => {
  digest = await startRealDigest();
  shell = await startShell(PORT, { ...ID, DIGEST_URL: digest.url });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
});

async function open(o: { js: boolean; clockAt?: Date; path?: string }): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 1000 }, userAgent: PERSON_UA, javaScriptEnabled: o.js });
  const page = await ctx.newPage();
  if (o.clockAt !== undefined) await page.clock.install({ time: o.clockAt });
  await page.goto(`${BASE}${o.path ?? A7}`);
  return { ctx, page };
}

/** Each panel of the page — a card, a folded panel or a compact one — with what its head shows. */
type Head = { id: string; signs: number; word: string; hasShape: boolean; time: string | null; text: string };
const heads = (page: Page): Promise<Head[]> =>
  page.$$eval(".mwk", (ps) =>
    ps.map((p) => {
      // #1051: a chip of the quiet line carries its one sign in its summary (delayed, stale) or its fold (live, reference)
      const head = p.classList.contains("mwk-chip") ? p : p.querySelector(":scope > .mwk__head");
      const sign = head?.querySelector(".fresh") ?? null;
      return {
        id: p.id,
        signs: head?.querySelectorAll(".fresh").length ?? 0,
        word: sign?.querySelector(".fresh__w")?.textContent?.trim() ?? "",
        hasShape: sign?.querySelector("svg.fresh__i use") !== null && sign !== null,
        time: sign?.querySelector("time")?.getAttribute("datetime") ?? null,
        text: sign?.textContent?.trim() ?? "",
      };
    }),
  );
const ages = (page: Page): Promise<string[]> => page.$$eval(".fresh__age", (xs) => xs.map((x) => x.textContent ?? ""));

describe("#986 e2e: the freshness sign on a motorway page", () => {
  it("every panel head shows exactly one sign: its shape, its word and its time", async () => {
    const { ctx, page } = await open({ js: true });
    const hs = await heads(page);
    expect(hs.length).toBeGreaterThanOrEqual(8);
    for (const h of hs) {
      expect(h.signs, h.id).toBe(1);
      expect(h.hasShape, h.id).toBe(true);
      expect(h.word.length, h.id).toBeGreaterThan(0);
      // a time (a clock or a data date) or "never read on this host" — never a bare word; the fuel panel alone is
      // its word ("prices on request"): its figures are read when asked and have no clock of their own
      if (h.id !== "mwk-fuel") expect(h.text.length, h.id).toBeGreaterThan(h.word.length);
    }
    // the sign is seen, not only present: the first head's sign has a box
    const shown = await page.locator(".mwk .mwk__head .fresh").first().isVisible();
    expect(shown).toBe(true);
    await ctx.close();
  });

  it("the relative age is written by the island and moves with the clock, without a reload", async () => {
    const probe = await open({ js: false });
    const at = (await heads(probe.page)).map((h) => h.time).find((t) => t !== null && t !== undefined);
    await probe.ctx.close();
    expect(at, "a sign with a clock time").toBeTruthy();
    const t0 = new Date(Date.parse(at!) + 3 * 60_000);
    const { ctx, page } = await open({ js: true, clockAt: t0 });
    const before = await ages(page);
    expect(before.length).toBeGreaterThan(0);
    expect(before.some((a) => /\(.+\)/.test(a))).toBe(true);
    const url = page.url();
    await page.clock.runFor(2 * 3_600_000);
    const after = await ages(page);
    expect(page.url()).toBe(url);
    expect(after).not.toEqual(before);
    // the browser's own words for "2 hours ago" in the page's language, from the same Intl the script uses
    const twoHours = await page.evaluate(() => new Intl.RelativeTimeFormat(document.documentElement.lang || "de", { numeric: "auto", style: "short" }).format(-2, "hour"));
    expect(after.some((a) => a.includes(twoHours)), `${after.join(" | ")} vs ${twoHours}`).toBe(true);
    await ctx.close();
  });

  it("with JavaScript off the absolute time remains and no relative age is invented", async () => {
    const { ctx, page } = await open({ js: false });
    const times = await page.$$eval(".mwk .fresh time[datetime]", (ts) => ts.map((t) => ({ dt: t.getAttribute("datetime") ?? "", text: t.textContent?.trim() ?? "" })));
    expect(times.length).toBeGreaterThan(0);
    for (const t of times) {
      expect(Number.isNaN(Date.parse(t.dt)), t.dt).toBe(false);
      expect(t.text.length).toBeGreaterThan(0);
    }
    expect((await ages(page)).every((a) => a === "")).toBe(true);
    await ctx.close();
  });
});

describe("review S3 e2e: the motorway overview's sign has its relative age too", () => {
  const OVERVIEW = "/de/autobahn";
  it("with JavaScript the overview's .fresh__age is filled beside its absolute time, and it moves with the clock", async () => {
    const probe = await open({ js: false, path: OVERVIEW });
    const at = await probe.page.getAttribute("#motorway-index .fresh time.fresh__t", "datetime");
    // without JavaScript: the absolute time, and no age invented
    expect((await ages(probe.page)).every((a) => a === "")).toBe(true);
    await probe.ctx.close();
    expect(at, "the overview's sign carries a clock time").toBeTruthy();
    const { ctx, page } = await open({ js: true, clockAt: new Date(Date.parse(at!) + 3 * 60_000), path: OVERVIEW });
    const before = await ages(page);
    expect(before.length).toBeGreaterThan(0);
    expect(before.every((a) => /\(.+\)/.test(a)), before.join(" | ")).toBe(true);
    await page.clock.runFor(2 * 3_600_000);
    const twoHours = await page.evaluate(() => new Intl.RelativeTimeFormat(document.documentElement.lang || "de", { numeric: "auto", style: "short" }).format(-2, "hour"));
    expect((await ages(page)).some((a) => a.includes(twoHours))).toBe(true);
    await ctx.close();
  });
});
