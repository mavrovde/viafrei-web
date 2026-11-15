/**
 * #1158 (owner 2026-11-03): a recent place opens its own target, a station picked in the search is kept as a station,
 * and the header reads the same on a phone and a desktop. Against the REAL built shell and a stand-in digest
 * (`stub-digest.ts`).
 *
 *  - the rows, top to bottom, in the order the keyboard walks them: "live for" and the radios (the status one line
 *    under them), "use my location", the search, the recent places as a vertical list, the foot line;
 *  - no horizontal scroll at 320, 360, 390 and 768 px in de, ru, tr and el, in both themes, and the recent rows full
 *    width and at least 44 px tall;
 *  - a town chip on a station page opens the town's page; a station chip opens the station's page; a bare position from
 *    the News page goes to the home through the stored place, never through the address;
 *  - a station picked in the header's search is stored as a station with its page.
 *
 * Run in the pinned Linux image (laptop results are not evidence): `npx vitest run --config packages/web/vitest.e2e.config.ts header-1158`.
 */
import { type ChildProcess } from "node:child_process";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startShell } from "./server.js";
import { startStubDigest } from "./stub-digest.js";
import { pathFor } from "../src/site/pages.js";
import { placePath } from "../src/site/places.js";
import { stationPath } from "../src/site/stations.js";

const PORT = 8993;
const BASE = `http://127.0.0.1:${String(PORT)}`;
let browser: Browser;
let shell: ChildProcess;
let digest: Awaited<ReturnType<typeof startStubDigest>>;

const M = 24321; // a month stamp inside the keep window (2026)
const RECENT = [
  { at: "pt:50.94303,6.95873", label: "Köln Hbf, Köln", m: M, k: "station", p: "koeln-hbf" },
  { at: "slug:neuried-muenchen", label: "Neuried", m: M, k: "place", p: "neuried-muenchen" },
  { at: "pt:51.3115,9.4575", label: "Wilhelmshöher Allee 99", m: M },
];

beforeAll(async () => {
  digest = await startStubDigest({}, 5000, { fullCards: true, around: true });
  shell = await startShell(PORT, { DIGEST_URL: digest.url, WEB_TILE_TIMEOUT_MS: "2000", VF_MOTORWAY_AROUND: "1" });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
});

/** A context whose every wait gives up after 2 s (owner 2026-10-26: no test timeout above 2 s), with recent places. */
async function context(opts: Parameters<Browser["newContext"]>[0] = {}, recent: unknown[] | null = RECENT): Promise<BrowserContext> {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ...opts });
  ctx.setDefaultTimeout(2000);
  ctx.setDefaultNavigationTimeout(2000);
  if (recent !== null)
    await ctx.addInitScript((r: string) => {
      try {
        if (localStorage.getItem("viafrei.place.recent") === null) localStorage.setItem("viafrei.place.recent", r);
      } catch {
        /* no storage: the page renders without it */
      }
    }, JSON.stringify(recent));
  return ctx;
}
/** #1174: a phone shows the bar as one line until tapped; these cases are about the opened bar's rows. */
async function unfold(page: Page): Promise<void> {
  const opener = page.locator("#place-open");
  if (await opener.isVisible()) await opener.click();
}
async function open(page: Page, path: string): Promise<void> {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await unfold(page);
}
const recentOf = (page: Page): Promise<{ at: string; k?: string; p?: string }[]> => page.evaluate(() => JSON.parse(localStorage.getItem("viafrei.place.recent") ?? "[]") as { at: string; k?: string; p?: string }[]);

describe("#1158 the header's rows, on a phone and a desktop", () => {
  it("rows in visual order equal to the focus order, no horizontal scroll, recent rows full width and 44 px", async () => {
    for (const lang of ["de", "ru", "tr", "el"] as const)
      for (const width of [320, 360, 390, 768, 1280])
        for (const colorScheme of ["light", "dark"] as const) {
          if (colorScheme === "dark" && width !== 390) continue;
          const ctx = await context({ viewport: { width, height: 900 }, colorScheme });
          const page = await ctx.newPage();
          await open(page, stationPath(lang, "koeln-hbf"));
          await page.locator("#place-recent a[data-at]").first().waitFor();
          const at = `${lang} ${String(width)} ${colorScheme}`;
          const m = await page.evaluate(() => {
            const top = (s: string): number => document.querySelector(s)?.getBoundingClientRect().top ?? -1;
            const rows = [...document.querySelectorAll("#place-recent li")].map((li) => li.getBoundingClientRect());
            const col = document.querySelector(".site-place__wrap")!.getBoundingClientRect();
            return {
              order: ["#place-scope", "#place-geo", "#place-hq", "#place-recent", ".site-place__foot"].map(top),
              scroll: document.documentElement.scrollWidth,
              vw: window.innerWidth,
              rows: rows.map((r) => [Math.round(r.width), Math.round(r.height), Math.round(r.left)]),
              col: [Math.round(col.width), Math.round(col.left)],
            };
          });
          expect(m.order.every((n) => n >= 0), at).toBe(true);
          expect([...m.order].sort((a, b) => a - b), at).toEqual(m.order);
          expect(m.scroll, at).toBeLessThanOrEqual(m.vw);
          expect(m.rows.length, at).toBe(3);
          // the gutter: 16 px on a phone, a centred column of 640 px on a desktop
          expect(m.col[0], at).toBe(Math.min(width - 32, 640));
          for (const [w, h] of m.rows) {
            expect(w, at).toBe(m.col[0]);
            expect(h, at).toBeGreaterThanOrEqual(44);
          }
          // the keyboard walks the rows top to bottom: the radio, the close button of a folded bar (#1174), "use my location", the field, the first chip
          const ids: string[] = [];
          await page.locator("#place-scope [tabindex='0']").focus();
          for (let i = 0; i < 5; i++) {
            await page.keyboard.press("Tab");
            ids.push(await page.evaluate(() => document.activeElement?.id || document.activeElement?.getAttribute("data-at") || document.activeElement?.tagName || ""));
          }
          expect(ids.filter((x) => x !== "place-close").slice(0, 3), at).toEqual(["place-geo", "place-hq", RECENT[0]!.at]);
          await ctx.close();
        }
  });
});

describe("#1158 a recent place opens its own target", () => {
  it("on a station page the town chip opens the town's page, and the station chip its station page", async () => {
    const ctx = await context();
    const page = await ctx.newPage();
    await open(page, pathFor("news", "de"));
    expect(await page.locator('#place-recent a[data-at="slug:neuried-muenchen"]').getAttribute("href")).toBe(placePath("de", "neuried-muenchen"));
    expect(await page.locator('#place-recent a[data-at="pt:50.94303,6.95873"]').getAttribute("data-kind")).toBe("station");
    await page.locator('#place-recent a[data-at="pt:50.94303,6.95873"]').click();
    await page.waitForURL(`${BASE}${stationPath("de", "koeln-hbf")}`);
    await unfold(page);
    await page.locator('#place-recent a[data-at="slug:neuried-muenchen"]').waitFor();
    await page.locator('#place-recent a[data-at="slug:neuried-muenchen"]').click();
    await page.waitForURL(`${BASE}${placePath("de", "neuried-muenchen")}`);
    await ctx.close();
  });

  it("a bare position from the News page goes to the home through the stored place, never through the address", async () => {
    const ctx = await context();
    const page = await ctx.newPage();
    await open(page, pathFor("news", "de"));
    const chip = page.locator('#place-recent a[data-at="pt:51.3115,9.4575"]');
    expect(await chip.getAttribute("data-kind")).toBe("point");
    await chip.click();
    await page.waitForURL(`${BASE}/de`);
    expect(page.url()).not.toContain("51.31");
    const kept = await page.evaluate(() => JSON.parse(localStorage.getItem("viafrei.place") ?? "null") as { at: string } | null);
    expect(kept?.at).toBe("pt:51.3115,9.4575");
    await ctx.close();
  });

  it("without JavaScript the popular chips are plain links", async () => {
    const ctx = await context({ javaScriptEnabled: false }, null);
    const page = await ctx.newPage();
    await open(page, stationPath("de", "koeln-hbf"));
    const hrefs = await page.locator("#place-recent a.chip").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    expect(hrefs.length).toBeGreaterThan(5);
    expect(hrefs.every((h) => typeof h === "string" && h.startsWith("/de/place/"))).toBe(true);
    await ctx.close();
  });
});

describe("#1158 a station picked in the header's search is kept as a station", () => {
  it("stored with its kind and its page, and its chip links the station page", async () => {
    const ctx = await context({}, null);
    const page = await ctx.newPage();
    await open(page, pathFor("news", "de"));
    await page.locator("header #place-hq").pressSequentially("Köln Hbf", { delay: 20 });
    const opt = page.locator('#place-hresults a.place-opt[data-kind="station"]').first();
    await opt.waitFor();
    await opt.click();
    await page.locator('#place-recent a[data-kind="station"]').waitFor();
    const r = await recentOf(page);
    expect(r[0]).toMatchObject({ at: "pt:50.94303,6.95873", k: "station", p: "koeln-hbf" });
    expect(await page.locator('#place-recent a[data-kind="station"]').getAttribute("href")).toBe(stationPath("de", "koeln-hbf"));
    await ctx.close();
  });
});
