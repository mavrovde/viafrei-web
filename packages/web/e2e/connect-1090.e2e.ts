/**
 * #1090 (owner 2026-10-28), on the built page: Claude's block shows a REAL screenshot per step — lazy, sized (no
 * layout shift), described in the page's language — ChatGPT's a diagram in our own style captioned "Diagram, not a
 * screenshot", and every block its official guide in a new tab; since 2.4.8 the terminal clients their transcripts,
 * each row its own check line, and a full-size view by `:target`, no script. Run in the pinned Linux image (laptop
 * results are not evidence).
 */
import type { ChildProcess } from "node:child_process";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { t } from "../src/i18n/index.js";
import { clientAnchor } from "../src/site/connect-clients.js";
import { pathFor } from "../src/site/pages.js";
import { startShell } from "./server.js";
import { startStubDigest } from "./stub-digest.js";

const PORT = 8943;
const BASE = `http://127.0.0.1:${String(PORT)}`;
let browser: Browser;
let shell: ChildProcess;
let digest: Awaited<ReturnType<typeof startStubDigest>>;

beforeAll(async () => {
  digest = await startStubDigest({});
  shell = await startShell(PORT, { DIGEST_URL: digest.url, WEB_TILE_TIMEOUT_MS: "2000" });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
});

describe("#1090: the connect page's client blocks", () => {
  for (const lang of ["de", "en", "ru"] as const) {
    it(`${lang}: Claude's steps each show a real screenshot — lazy, sized, described, loaded only once opened`, async () => {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await ctx.newPage();
      const asked: string[] = [];
      page.on("request", (r) => {
        if (r.url().endsWith(".webp")) asked.push(r.url());
      });
      await page.goto(`${BASE}${pathFor("connect", lang)}`, { waitUntil: "networkidle" });
      expect(asked, "nothing is fetched while the block is closed").toEqual([]);
      const block = page.locator(`#${clientAnchor("claudeAi")}`);
      await block.locator("summary").click();
      const imgs = block.locator("figure.cshot a.cshot__open img");
      expect(await imgs.count()).toBe(4);
      for (let i = 0; i < 4; i++) {
        const img = imgs.nth(i);
        expect(await img.getAttribute("loading")).toBe("lazy");
        expect((await img.getAttribute("alt"))?.length ?? 0).toBeGreaterThan(20);
        const w = Number(await img.getAttribute("width"));
        const h = Number(await img.getAttribute("height"));
        expect(w * h).toBeGreaterThan(0);
        await img.scrollIntoViewIfNeeded();
        await expect.poll(() => img.evaluate((e) => (e as HTMLImageElement).complete && (e as HTMLImageElement).naturalWidth > 0)).toBe(true);
        // the box the page reserved is the file's own shape: no shift when it arrives
        const [nw, nh, bw, bh] = await img.evaluate((e) => {
          const r = e.getBoundingClientRect();
          return [(e as HTMLImageElement).naturalWidth, (e as HTMLImageElement).naturalHeight, r.width, r.height];
        });
        expect(Math.abs(nh / nw - h / w)).toBeLessThan(0.01);
        expect(Math.abs(bh / bw - h / w)).toBeLessThan(0.02);
      }
      expect(await block.locator(".draft").count()).toBe(0);
      expect(await block.locator("p.ccheck").count()).toBe(1);
      expect(await block.locator("figure.cshot figcaption").first().textContent()).toContain("claude.ai");
      await ctx.close();
    });
  }

  it("ChatGPT: a diagram in our own boxes, captioned as such, no image; the draft line stays", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}${pathFor("connect", "de")}`, { waitUntil: "networkidle" });
    const block = page.locator(`#${clientAnchor("chatgpt")}`);
    await block.locator("summary").click();
    expect(await block.locator("figure.cdiag .cdiag__box").count()).toBe(3);
    expect((await block.locator("figure.cdiag figcaption").textContent())?.trim()).toBe(t("de", "connectPage.shot.diagram"));
    expect(await block.locator("img").count()).toBe(0);
    expect(await block.locator(".draft").count()).toBe(1);
    expect(await block.locator("figure.cdiag").isVisible()).toBe(true);
    await ctx.close();
  });

  it("a thumbnail opens its full-size view on the same page, with no script; a click on it closes it again (#1090, 2.4.8)", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}${pathFor("connect", "de")}`, { waitUntil: "networkidle" });
    const url = page.url();
    const block = page.locator(`#${clientAnchor("claudeCode")}`);
    await block.locator("summary").click();
    const full = page.locator("#shot-claudeCode1-full");
    expect(await full.isVisible()).toBe(false);
    await block.locator("a.cshot__open").click();
    await expect.poll(() => full.isVisible()).toBe(true);
    expect(page.url()).toBe(`${url}#shot-claudeCode1-full`);
    const box = await full.boundingBox();
    expect(box).toEqual({ x: 0, y: 0, width: 1280, height: 900 });
    const big = full.locator("img");
    await expect.poll(() => big.evaluate((e) => (e as HTMLImageElement).complete && (e as HTMLImageElement).naturalWidth > 0)).toBe(true);
    await full.click();
    await expect.poll(() => full.isVisible()).toBe(false);
    expect(page.url()).toBe(`${url}#shot-claudeCode1`);
    await ctx.close();
  });

  it("the terminal clients each show their transcript and say they were checked in the client; a pending row keeps its draft line", async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}${pathFor("connect", "en")}`, { waitUntil: "networkidle" });
    for (const id of ["claudeCode", "geminiCli", "generic", "stdio"] as const) {
      const block = page.locator(`#${clientAnchor(id)}`);
      await block.locator("summary").click();
      const img = block.locator("figure.cshot a.cshot__open img");
      expect(await img.count(), id).toBe(1);
      await img.scrollIntoViewIfNeeded();
      await expect.poll(() => img.evaluate((e) => (e as HTMLImageElement).complete && (e as HTMLImageElement).naturalWidth > 0)).toBe(true);
      expect(await block.locator(".draft").count(), id).toBe(0);
      expect(await block.locator("p.ccheck").textContent(), id).toMatch(/^Checked in the client on /u);
    }
    const cursor = page.locator(`#${clientAnchor("cursor")}`);
    await cursor.locator("summary").click();
    expect(await cursor.locator("p.ccheck .draft").count()).toBe(1);
    expect(await cursor.locator("img").count()).toBe(0);
    await ctx.close();
  });

  it("every block's guide opens the vendor's page in a new tab, without referrer", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}${pathFor("connect", "en")}`, { waitUntil: "networkidle" });
    const blocks = await page.locator("#clients details.client").count();
    expect(blocks).toBeGreaterThan(10);
    expect(await page.locator("#clients details.client p.cguide").count()).toBe(blocks);
    for (const a of await page.locator("#clients p.cguide a").all()) {
      expect(await a.getAttribute("target")).toBe("_blank");
      expect(await a.getAttribute("rel")).toBe("noopener noreferrer");
      expect(await a.getAttribute("href")).toMatch(/^https:\/\//u);
    }
    await ctx.close();
  });
});
