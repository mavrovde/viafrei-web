/**
 * 2.4.4 review B2: the motorway page's charging block carries the filter bar with its Apply in <noscript> and no
 * data-card (`fragment: null`) — with JavaScript ON, ticking a box must send the form, and the page reloads with the
 * choice applied (the box checked, `ev_*` in the address, the summary of the filtered card). Against the BUILT shell and
 * the real digest (`real-digest.ts`, the fixture A7), like every motorway suite. Linux evidence only (the pinned image).
 */
import type { ChildProcess } from "node:child_process";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { motorwayPath } from "../src/site/motorways.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8931;
const BASE = `http://127.0.0.1:${PORT}`;
const PERSON_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const ID = { IMPRESSUM_NAME: "EV Probe", IMPRESSUM_STREET: "Probeweg 9", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "ev@example.invalid" };

let browser: Browser;
let shell: ChildProcess | undefined;
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

/**
 * #1180 (owner 2026-11-06, the desktop dashboard): from 1024 px a road page's cards stand collapsed — their head, their
 * sources and one "alle N anzeigen" (or their own fold's summary) — so a reader opens the card first. Opens the one
 * holding `sel`, as a reader does; a phone, or a card that stands open, is left as it is.
 */
async function deskOpen(page: Page, sel: string): Promise<void> {
  await page.evaluate((s) => {
    const sec = document.querySelector(s)?.closest("[data-desk='folded'], [data-desk='native'], [data-desk='capped']");
    if (!sec) return;
    if (sec.getAttribute("data-desk") === "native") sec.querySelector<HTMLElement>(":scope > details.fold > summary")?.click();
    else document.querySelector<HTMLElement>(`.desk__more[aria-controls="${sec.id}"]`)?.click();
  }, sel);
}

describe("the motorway page's charging filter with JavaScript on (2.4.4 review B2)", () => {
  it("has no visible Apply, and ticking a box reloads the page with the choice applied", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 1000 }, userAgent: PERSON_UA, javaScriptEnabled: true });
    const page = await ctx.newPage();
    await page.goto(`${BASE}${motorwayPath("de", "A7")}`);
    const form = page.locator("#motorway-main form.evf");
    await deskOpen(page, "#motorway-main form.evf");
    expect(await form.count()).toBe(1);
    // not inside a refreshing card: the shared rule, not the refresh script's in-place re-fetch, sends it
    expect(await form.evaluate((f) => f.closest("article.pcard[data-card]") === null)).toBe(true);
    expect(await page.locator("#motorway-main form.evf button.evf__apply").count()).toBe(0);
    const first = form.locator('input[type="checkbox"]').first();
    const name = (await first.getAttribute("name")) ?? "";
    const value = (await first.getAttribute("value")) ?? "";
    expect(name).toMatch(/^ev_/);
    await Promise.all([page.waitForURL((u) => u.searchParams.getAll(name).some((v) => v.split(",").includes(value)), { timeout: 2_000 }), first.check()]);
    await page.waitForLoadState("domcontentloaded", { timeout: 2_000 });
    // the reloaded page shows the choice: the same box checked by the server, and the filter's summary under the bar
    expect(await page.locator(`#motorway-main form.evf input[name="${name}"][value="${value}"]`).isChecked()).toBe(true);
    expect(await page.locator("#motorway-main .evf__count, #motorway-main .evf__none").count()).toBeGreaterThan(0);
    await ctx.close();
  });
});
