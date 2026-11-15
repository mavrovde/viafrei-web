/**
 * #1085 AC 1 and 2 (2.4.8) against the REAL built shell and a stand-in digest whose place fragment carries the place
 * Ampel (`STUB_AMPEL`): the topic filter hides a hidden card's marks on the place map, and the bar says when the Ampel
 * took a reason from a hidden card — the motorway page's D8 rule. With JavaScript on (a tick) and off (the GET form's
 * address), because the stylesheet alone does it.
 */
import type { ChildProcess } from "node:child_process";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startShell } from "./server.js";
import { startStubDigest } from "./stub-digest.js";

const PORT = 8913;
const BASE = `http://127.0.0.1:${String(PORT)}`;
let browser: Browser;
let shell: ChildProcess;
let stub: Awaited<ReturnType<typeof startStubDigest>>;

beforeAll(async () => {
  stub = await startStubDigest({}, 5000, { fullCards: true, ampel: true });
  shell = await startShell(PORT, { DIGEST_URL: stub.url, WEB_TILE_TIMEOUT_MS: "2000" });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await stub?.close();
});

const visible = (page: Page, sel: string): Promise<boolean> => page.$eval(sel, (e) => getComputedStyle(e).display !== "none");

async function open(js: boolean, path: string, reducedMotion: "reduce" | "no-preference" = "no-preference"): Promise<Page> {
  const ctx = await browser.newContext({ javaScriptEnabled: js, viewport: { width: 390, height: 844 }, reducedMotion });
  const page = await ctx.newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForSelector("#place-slot #place-ampel", { state: "attached", timeout: 2000 });
  return page;
}

describe("#1085: the topic filter and the place Ampel", () => {
  it("JavaScript off: every topic shows every mark and no note; a choice without roads hides the roads' mark and says a reason is hidden; Keine hides every mark", async () => {
    const all = await open(false, "/de/place/berlin");
    expect(await visible(all, ".pam-mark--in-roads")).toBe(true);
    expect(await visible(all, ".pam-mark--in-motorways")).toBe(true);
    expect(await visible(all, "#tpf-ampel")).toBe(false);
    const some = await open(false, "/de/place/berlin?topics=warnings,motorways,fuel");
    expect(await visible(some, ".pam-mark--in-roads")).toBe(false);
    expect(await visible(some, ".pam-mark--in-motorways")).toBe(true);
    expect(await visible(some, "#tpf-ampel")).toBe(true);
    expect((await some.textContent("#tpf-ampel"))?.trim()).toBe("Die Ampel bewertet weiterhin alles – einige ihrer Gründe sind gerade ausgeblendet.");
    const none = await open(false, "/de/place/berlin?f=1");
    expect(await visible(none, ".pam-mark--in-roads")).toBe(false);
    expect(await visible(none, ".pam-mark--in-motorways")).toBe(false);
    expect(await visible(none, "#tpf-ampel")).toBe(true);
    // the lamp itself is never hidden by a topic: it still judged everything
    expect(await visible(none, "#place-ampel")).toBe(true);
  });
  it("JavaScript on: unticking roads hides its mark and shows the note within 2 s; ticking it again undoes both", async () => {
    const page = await open(true, "/en/place/berlin");
    expect(await visible(page, "#tpf-ampel")).toBe(false);
    await page.uncheck("#tpf input[value=roads]");
    await page.waitForFunction(() => getComputedStyle(document.querySelector("#tpf-ampel")!).display !== "none", undefined, { timeout: 2000 });
    expect(await visible(page, ".pam-mark--in-roads")).toBe(false);
    expect(await visible(page, ".pam-mark--in-motorways")).toBe(true);
    await page.check("#tpf input[value=roads]");
    await page.waitForFunction(() => getComputedStyle(document.querySelector("#tpf-ampel")!).display === "none", undefined, { timeout: 2000 });
    expect(await visible(page, ".pam-mark--in-roads")).toBe(true);
  });
  it("hiding a card the Ampel took no reason from changes nothing", async () => {
    const page = await open(false, "/de/place/berlin?topics=warnings,roads");
    expect(await visible(page, "#tpf-ampel")).toBe(false);
    expect(await visible(page, ".pam-mark--in-roads")).toBe(true);
    expect(await visible(page, ".pam-mark--in-motorways")).toBe(false);
  });
});

describe("#1085 AC 2 (owner 2026-10-28): a map mark links to its row — 24 px target, focusable, works without JavaScript", () => {
  /** Which link the point `dx`,`dy` CSS px from the mark's centre hits, by the browser's own hit test. */
  const hitAt = (page: Page, href: string, dx: number, dy: number): Promise<string | null> =>
    page.$eval(
      `a.map-link[href="${href}"] .map-hit`,
      (el, d) => {
        const svg = (el as SVGGraphicsElement).ownerSVGElement!;
        const m = /M([\d.]+) ([\d.]+)h0/u.exec(el.getAttribute("d") ?? "")!;
        const pt = new DOMPoint(Number(m[1]), Number(m[2])).matrixTransform(svg.getScreenCTM()!);
        const hit = document.elementFromPoint(pt.x + d.dx, pt.y + d.dy);
        return hit?.closest("a.map-link")?.getAttribute("href") ?? null;
      },
      { dx, dy },
    );
  it("JavaScript off: the tap target reaches 11 px from the mark in every direction and not 14 px; a click lands on the row", async () => {
    // reduced motion: the jump is instant (the site's smooth scroll is a preference, not the behaviour under test)
    const page = await open(false, "/de/place/berlin", "reduce");
    await page.$eval("svg.pam__svg", (e) => e.scrollIntoView({ block: "center", behavior: "instant" }));
    for (const [dx, dy] of [[0, 0], [11, 0], [-11, 0], [0, 11], [0, -11], [7, 7]] as const) expect(await hitAt(page, "#parking-r0", dx, dy), `${String(dx)},${String(dy)}`).toBe("#parking-r0");
    expect(await hitAt(page, "#parking-r0", 14, 0)).not.toBe("#parking-r0");
    const box = await page.$eval("a.map-link[href='#parking-r0'] .map-hit", (el) => {
      const svg = (el as SVGGraphicsElement).ownerSVGElement!;
      const m = /M([\d.]+) ([\d.]+)h0/u.exec(el.getAttribute("d") ?? "")!;
      const pt = new DOMPoint(Number(m[1]), Number(m[2])).matrixTransform(svg.getScreenCTM()!);
      return { x: pt.x, y: pt.y };
    });
    await page.mouse.click(box.x + 9, box.y);
    await page.waitForFunction(() => location.hash === "#parking-r0", undefined, { timeout: 2000 });
    // the browser scrolls to the row: in view within 2 s
    await page.waitForFunction(
      () => {
        const r = document.querySelector("#parking-r0")!.getBoundingClientRect();
        return r.top >= 0 && r.bottom <= innerHeight;
      },
      undefined,
      { timeout: 2000 },
    );
  });
  it("every mark is a named link in the tab order whose target exists on the page; the focused mark shows its ring", async () => {
    const page = await open(true, "/de/place/berlin");
    const links = await page.$$eval("svg.pam__svg a.map-link", (as) => as.map((a) => ({ href: a.getAttribute("href") ?? "", name: a.querySelector(":scope > title")?.textContent ?? "", label: a.getAttribute("aria-label"), tab: (a as unknown as SVGAElement).tabIndex })));
    expect(links.length).toBe(3);
    for (const l of links) {
      expect(l.href).toMatch(/^#[a-z][a-z0-9-]*$/u);
      expect(await page.$(l.href)).not.toBeNull();
      // named by its <title>, which keeps the row's translate="no" name (#449) — never an aria-label, which cannot
      expect(l.name.trim()).not.toBe("");
      expect(l.label).toBeNull();
      expect(l.tab).toBeGreaterThanOrEqual(0);
    }
    expect(await page.getAttribute("svg.pam__svg", "role")).toBe("group");
    await page.focus("a.map-link[href='#parking-r0']");
    const ring = await page.$eval("a.map-link[href='#parking-r0'] .map-hit", (e) => getComputedStyle(e).stroke);
    expect(ring).not.toBe("rgba(0, 0, 0, 0)");
    expect(ring).not.toBe("transparent");
  });
  it("a hidden card's mark is hidden with it — JavaScript off, by the GET form's address", async () => {
    const page = await open(false, "/de/place/berlin?topics=roads,motorways");
    expect(await visible(page, "a.map-link.pam-mark--in-parking")).toBe(false);
    expect(await visible(page, "a.map-link.pam-mark--in-roads")).toBe(true);
  });
});
