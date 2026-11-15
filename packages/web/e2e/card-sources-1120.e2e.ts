/**
 * #1120 in a browser, against the REAL built shell and the REAL digest renderer over the fixture (no database, no
 * network), on Köln's place page — its cards carry OpenStreetMap, transit, charging, parking and road lines:
 *
 *  - the RAW server response (no script has run): every card footer that folds anything carries the short line and the
 *    "Quellen und Lizenzen" disclosure, whose credit lines are the register's own strings in full, with licence links and
 *    the share-alike line; OpenStreetMap's, every ODbL line, the fuel terms, Toll Collect's and every line with a
 *    condition note are OUTSIDE it;
 *  - the disclosure opens and closes with the keyboard and has an accessible name (axe `summary-name`);
 *  - printed, every folded line is visible although no disclosure was opened;
 *  - opening and closing them writes nothing to localStorage, sessionStorage or a cookie (the click-only rule);
 *  - at 360 px and on a desktop, with every disclosure open, nothing scrolls sideways.
 */
import { type ChildProcess } from "node:child_process";
import { AxeBuilder } from "@axe-core/playwright";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { all, text } from "@viafrei/design/testing";
import { LICENCE_CATALOGUE, datedAttribution } from "@viafrei/ingest";
import { ATTRIBUTION } from "@viafrei/mcp";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

/** #1176: on a phone a place's cards after the first (a station's area: every card) are folded; a person opens a card's fold first. */
async function unfold(page: Page): Promise<void> {
  // opened as a person's click does, without one: a desktop or print shows no summary to click (it is open there by CSS)
  await page.$$eval("details.pcard__fold:not([open])", (ds) => ds.forEach((d) => d.setAttribute("open", "")));
}

const PORT = 8983;
const BASE = `http://127.0.0.1:${String(PORT)}`;
const PAGE = "/de/place/koeln";
const PHONE = { width: 360, height: 800 };
const DESKTOP = { width: 1280, height: 900 };

let browser: Browser;
let shell: ChildProcess;
let digest: Awaited<ReturnType<typeof startRealDigest>>;

beforeAll(async () => {
  digest = await startRealDigest();
  shell = await startShell(PORT, { DIGEST_URL: digest.url, WEB_TILE_TIMEOUT_MS: "2000" });
  browser = await chromium.launch();
}, 120_000);
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
});

/** The register's credit strings, dated as a line renders them (#804: the year of retrieval is the reader's year). */
const REGISTER: readonly string[] = [
  ...Object.values(ATTRIBUTION).map((r) => r.text),
  ...Object.values(LICENCE_CATALOGUE).flatMap((r) => (r.attribution === null ? [] : [r.attribution])),
].flatMap((t) => [datedAttribution(t, new Date()), datedAttribution(t, new Date("2026-10-03T10:00:00Z"))]);
/** A line a person must see whole (#1120's table; data-steward ruling 2026-11-03 adds GeoNutzV, the DWD and CC BY 3.0). */
const IN_VIEW = /OpenStreetMap|Open Database License|ODbL|Tankerkönig|MTS-K|Toll Collect|GeoNutzV|Deutscher Wetterdienst|CC BY 3\.0/u;

describe("#1120: the card sources on Köln's place page", () => {
  it("the raw server response carries every disclosure's full register lines, licence links and share-alike line — the must-see lines outside", async () => {
    const html = await (await fetch(`${BASE}${PAGE}`)).text();
    const foots = all(html, "footer.pcard__foot");
    expect(foots.length).toBeGreaterThan(8);
    let folded = 0;
    for (const foot of foots) {
      const d = all(foot, "details.sources");
      if (d.length === 0) continue;
      folded++;
      expect(d, "one disclosure per footer").toHaveLength(1);
      // the short line comes first and names at least one provider, each marked as a name
      expect(all(foot, "p.sources__line"), "a short line").toHaveLength(1);
      expect(all(all(foot, "p.sources__line")[0]!, 'span[translate="no"]').length).toBeGreaterThan(0);
      expect(all(d[0]!, "summary").map(text)).toEqual(["Quellen und Lizenzen"]);
      for (const p of all(d[0]!, "p.credit")) {
        const t = text(p).replace(/\s+/gu, " ");
        expect(REGISTER.some((r) => t.includes(r)), `a folded line is the register's own string in full: ${t}`).toBe(true);
        expect(t, "a line a person must see is never folded").not.toMatch(IN_VIEW);
        expect(p.attrs["class"] ?? "", "a line with a condition note is never folded").toBe("credit");
        expect(all(p, ".credit__note")).toHaveLength(0);
      }
    }
    expect(folded).toBeGreaterThan(8);
    const disclosures = all(html, "details.sources");
    expect(disclosures.flatMap((d) => all(d, 'a[rel~="license"]')).length, "licence links inside").toBeGreaterThan(5);
    expect(disclosures.flatMap((d) => all(d, "p.tile__licence")).length, "the share-alike line inside").toBeGreaterThan(0);
    // nothing in a disclosure waits for a script: no template, no fragment address, no empty body
    for (const d of disclosures) {
      expect(all(d, "template")).toHaveLength(0);
      expect(d.attrs["data-more"]).toBeUndefined();
      expect(all(d, "p").length).toBeGreaterThan(0);
    }
    // OpenStreetMap's line is on the page, and outside every disclosure
    const osm = all(html, "footer.pcard__foot p.credit").filter((p) => /OpenStreetMap/u.test(text(p)));
    expect(osm.length).toBeGreaterThan(0);
  }, 30_000);

  it("the disclosure opens and closes with the keyboard and has an accessible name", async () => {
    const ctx = await browser.newContext({ viewport: PHONE });
    const page = await ctx.newPage();
    await page.goto(`${BASE}${PAGE}`);
    await unfold(page);
    const summary = page.locator("#pcard-charging details.sources > summary");
    const open = (): Promise<boolean> => page.locator("#pcard-charging details.sources").evaluate((d) => (d as HTMLDetailsElement).open);
    const folded = page.locator("#pcard-charging details.sources p.credit").first();
    expect(await open()).toBe(false);
    expect(await folded.isVisible()).toBe(false);
    await summary.focus();
    await page.keyboard.press("Enter");
    expect(await open()).toBe(true);
    expect(await folded.isVisible()).toBe(true);
    await page.keyboard.press("Space");
    expect(await open()).toBe(false);
    // the focus moved there by Tab, too: it is in the page's tab order
    expect(await summary.evaluate((s) => s.tabIndex)).toBeGreaterThanOrEqual(0);
    const r = await new AxeBuilder({ page }).include("details.sources").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.map((x) => x.target.join(" ")).join(", ")}`)).toEqual([]);
    expect(r.passes.map((p) => p.id)).toContain("summary-name");
    await ctx.close();
  }, 60_000);

  it("printed, every folded line is visible without opening a disclosure", async () => {
    const ctx = await browser.newContext({ viewport: DESKTOP });
    const page = await ctx.newPage();
    await page.goto(`${BASE}${PAGE}`);
    await unfold(page);
    const lines = page.locator("details.sources p.credit");
    const n = await lines.count();
    expect(n).toBeGreaterThan(8);
    const visible = async (): Promise<number> => (await Promise.all(Array.from({ length: n }, (_, i) => lines.nth(i).isVisible()))).filter(Boolean).length;
    expect(await visible()).toBe(0);
    await page.emulateMedia({ media: "print" });
    expect(await visible()).toBe(n);
    expect(await page.locator("details.sources[open]").count()).toBe(0);
    await ctx.close();
  }, 60_000);

  it("opening and closing every disclosure writes nothing to storage or a cookie", async () => {
    const ctx = await browser.newContext({ viewport: PHONE });
    await ctx.addInitScript(() => {
      const w = window as unknown as { __vfWrites: string[] };
      w.__vfWrites = [];
      const proto = Storage.prototype as unknown as Record<string, (this: Storage, ...a: unknown[]) => unknown>;
      for (const name of ["setItem", "removeItem", "clear"]) {
        const orig = proto[name]!;
        proto[name] = function (this: Storage, ...a: unknown[]) {
          w.__vfWrites.push(`${this === window.localStorage ? "local" : "session"}.${name}:${String(a[0])}`);
          return orig.apply(this, a);
        };
      }
      const cookie = Object.getOwnPropertyDescriptor(Document.prototype, "cookie")!;
      Object.defineProperty(document, "cookie", {
        configurable: true,
        get: () => cookie.get!.call(document) as string,
        set: (v: string) => {
          w.__vfWrites.push(`cookie:${v.split("=")[0] ?? ""}`);
          cookie.set!.call(document, v);
        },
      });
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}${PAGE}`);
    await unfold(page);
    await page.waitForLoadState("networkidle");
    const before = await page.evaluate(() => (window as unknown as { __vfWrites: string[] }).__vfWrites.slice());
    const cookiesBefore = await ctx.cookies();
    const summaries = page.locator("details.sources > summary");
    const k = await summaries.count();
    expect(k).toBeGreaterThan(8);
    for (let i = 0; i < k; i++) await summaries.nth(i).click();
    expect(await page.locator("details.sources[open]").count()).toBe(k);
    for (let i = 0; i < k; i++) await summaries.nth(i).click();
    expect(await page.locator("details.sources[open]").count()).toBe(0);
    expect(await page.evaluate(() => (window as unknown as { __vfWrites: string[] }).__vfWrites.slice())).toEqual(before);
    expect(await ctx.cookies()).toEqual(cookiesBefore);
    await ctx.close();
  }, 60_000);

  for (const [name, viewport] of [["360 px", PHONE], ["desktop", DESKTOP]] as const) {
    it(`${name}: every disclosure open, nothing scrolls sideways`, async () => {
      const ctx = await browser.newContext({ viewport });
      const page = await ctx.newPage();
      await page.goto(`${BASE}${PAGE}`);
      await unfold(page);
      await page.locator("details.sources").evaluateAll((ds) => ds.forEach((d) => ((d as HTMLDetailsElement).open = true)));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await ctx.close();
    }, 60_000);
  }
});
