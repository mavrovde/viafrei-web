/**
 * #1176: a place page on a phone, 375×812: the H1, the lamp, the count line and what comes first in the first viewport; a
 * card's rows behind one fold; every topic in view at once, wrapping, each reached by the keyboard (#1194, which
 * replaced #1176 AC 6's one sideways line); the page's length and
 * weight. One place in two languages: the rule is one national rule, the states are planted in `place-first-1176.test.ts`.
 *
 * Run in the pinned Linux image only.
 */
import { type ChildProcess } from "node:child_process";
import { gzipSync } from "node:zlib";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pathFor } from "../src/site/pages.js";
import { placePath } from "../src/site/places.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8896;
const PHONE = { width: 375, height: 812 } as const;
const SCREENS_MAX = 15;
const GZIP_MAX = 200_000;
const ID = { IMPRESSUM_NAME: "Fold Probe", IMPRESSUM_STREET: "Probeweg 5", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "fold@example.invalid" };
const THIRD_PARTY = /googletagmanager\.com|google-analytics\.com|clarity\.ms/u;

let browser: Browser;
let digest: Awaited<ReturnType<typeof startRealDigest>>;
let shell: ChildProcess;
const base = `http://127.0.0.1:${String(PORT)}`;

beforeAll(async () => {
  digest = await startRealDigest({});
  shell = await startShell(PORT, { ...ID, DIGEST_URL: digest.url });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
});

async function open(path: string, viewport: { readonly width: number; readonly height: number } = PHONE): Promise<{ readonly ctx: BrowserContext; readonly page: Page }> {
  const ctx = await browser.newContext({ viewport, hasTouch: viewport.width < 1024 });
  ctx.setDefaultTimeout(2_000);
  await ctx.route(THIRD_PARTY, (r) => r.fulfill({ status: 204, body: "" }));
  const page = await ctx.newPage();
  await page.goto(`${base}${path}`);
  return { ctx, page };
}

describe("the first viewport of a place (#1176 AC 1, 375×812)", () => {
  const measured: Record<string, unknown> = {};
  afterAll(() => {
    console.log(`first screen 1176: ${JSON.stringify(measured)}`);
  });
  for (const lang of ["de", "en"] as const) {
    it(`${lang}: the H1, the lamp, the count line and the jump links`, async () => {
      const { ctx, page } = await open(placePath(lang, "koeln"));
      const h1 = (await page.locator("main h1").first().boundingBox())!;
      const status = (await page.locator("#place-status").boundingBox())!;
      const jumps = await page.locator("#page-first .jumps").boundingBox();
      const item = await page.locator("#page-first .topitems__row").first().boundingBox();
      measured[lang] = { h1Top: Math.round(h1.y), statusEnd: Math.round(status.y + status.height), itemEnd: item === null ? null : Math.round(item.y + item.height), jumpsEnd: jumps === null ? null : Math.round(jumps.y + jumps.height) };
      expect(h1.y).toBeLessThanOrEqual(200);
      expect(status.y + status.height).toBeLessThanOrEqual(PHONE.height);
      if (item !== null) expect(item.y + item.height).toBeLessThanOrEqual(PHONE.height);
      // the status block stands under the H1, once: lifted out of the fragment
      expect(await page.locator("#page-first").count()).toBe(1);
      expect(await page.locator(".place__title ~ #page-first").count(), "not left in the fragment").toBe(0);
      await ctx.close();
    });
  }

  it("each jump link lands on its section", async () => {
    const { ctx, page } = await open(placePath("de", "koeln"));
    const hrefs = await page.locator("#page-first .jumps__chip").evaluateAll((els) => els.map((e) => e.getAttribute("href")!));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) expect(await page.locator(href).count(), href).toBe(1);
    await ctx.close();
  });
});

describe("the length and the weight (#1176 AC 3, AC 4)", () => {
  it("a card stands at three rows at most, and its fold opens on all of them", async () => {
    const { ctx, page } = await open(placePath("de", "koeln"));
    const standing = await page.locator(".pcard__list").evaluateAll((els) => els.filter((e) => e.closest("details") === null).map((e) => e.children.length));
    expect(Math.max(...standing, 0)).toBeLessThanOrEqual(3);
    // a list's own fold in a card that stands (a folded card's list is behind the card's fold, judged below)
    const fold = page.locator("details.pcard__rest:not(.pcard__fold .pcard__rest)").first();
    if ((await fold.count()) > 0) {
      await fold.locator("summary").first().click();
      expect(await fold.evaluate((d) => (d as HTMLDetailsElement).open)).toBe(true);
      expect(await fold.locator("li").count()).toBeGreaterThan(0);
    }
    await ctx.close();
  });
  it("on a phone the cards after the first are folded, head standing, and one tap opens a card", async () => {
    const { ctx, page } = await open(placePath("de", "koeln"));
    const cards = await page.locator("#place-cards .place__cards > .pcard").evaluateAll((els) =>
      els.map((e) => ({ id: e.id, folds: e.querySelectorAll(":scope details.pcard__fold").length, open: e.querySelector("details.pcard__fold")?.hasAttribute("open") ?? false })),
    );
    expect(cards.length, "the fixture's place has several cards").toBeGreaterThan(2);
    expect(cards[0]!.folds, "the first card stands").toBe(0);
    // the fuel card never folds: its prices, sample and MTS-K note may not (#423)
    for (const c of cards.slice(1)) expect(c, c.id).toMatchObject({ folds: c.id === "pcard-fuel" ? 0 : 1, open: false });
    // FS-2026-11-06: a folded card's credit lines fold WITH its data (FS1); a card whose data stands outside its fold — its
    // badge, or its count in the jump links — keeps its ALWAYS_SHOWN and condition lines under the fold, in view (FS4)
    const judged = await page.locator("article.pcard").evaluateAll((els) =>
      els
        .filter((e) => e.querySelector(":scope details.pcard__fold") !== null)
        .map((e) => ({
          id: e.id,
          outside: e.querySelector(".pcard__badge") !== null || document.querySelector(`a.jumps__chip[href="#${e.id}"] .jumps__n`) !== null,
          folded: e.querySelectorAll("details.pcard__fold p.credit").length,
          conditionsFolded: e.querySelectorAll("details.pcard__fold p.credit[class*='credit--'], details.pcard__fold .credit__note").length,
          named: e.querySelector(":scope details.pcard__fold > summary .fold__sources") !== null,
        })),
    );
    for (const c of judged) if (c.outside) expect(c.conditionsFolded, c.id).toBe(0);
    // FS3: every folded card that credits anyone names its publishers in its summary
    for (const c of judged) if (c.folded > 0) expect(c.named, c.id).toBe(true);
    const lifted = page.locator("details.pcard__fold + footer.pcard__foot p.credit");
    for (let i = 0; i < (await lifted.count()); i++) expect(await lifted.nth(i).isVisible()).toBe(true);
    const second = page.locator(`#${cards.slice(1).find((c) => c.folds === 1)!.id}`);
    expect(await second.locator(".pcard__title").isVisible(), "a folded card's head stands").toBe(true);
    const body = second.locator("details.pcard__fold > :not(summary)").first();
    expect(await body.isVisible(), "its body is folded with it").toBe(false);
    await second.locator("details.pcard__fold > summary").click();
    expect(await body.isVisible(), "one tap opens it").toBe(true);
    // the map of the place: one line on a phone
    const map = page.locator("details.ampel__mapfold");
    if ((await map.count()) > 0) expect(await map.evaluate((d) => (d as HTMLDetailsElement).open)).toBe(false);
    await ctx.close();
  });
  it("from 601 px up every card and the map stand open, with no script and no summary", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1024, height: 900 }, javaScriptEnabled: false });
    ctx.setDefaultTimeout(2_000);
    const page = await ctx.newPage();
    await page.goto(`${base}${placePath("de", "koeln")}`);
    const folded = page.locator("details.pcard__fold");
    const n = await folded.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      expect(await folded.nth(i).locator("> summary").isVisible(), `summary ${String(i)}`).toBe(false);
      expect(await folded.nth(i).locator("> :not(summary)").first().isVisible(), `card ${String(i)} reads open`).toBe(true);
    }
    await ctx.close();
  });
  it(`at most ${String(SCREENS_MAX)} screens and ${String(GZIP_MAX)} B gzip`, async () => {
    const { ctx, page } = await open(placePath("de", "koeln"));
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    const html = await (await fetch(`${base}${placePath("de", "koeln")}`)).text();
    const gz = gzipSync(html).length;
    console.log(`place budget 1176: ${String(height)} px = ${(height / PHONE.height).toFixed(1)} screens, ${String(Buffer.byteLength(html))} B raw, ${String(gz)} B gzip`);
    expect(height).toBeLessThanOrEqual(SCREENS_MAX * PHONE.height);
    expect(gz).toBeLessThanOrEqual(GZIP_MAX);
    await ctx.close();
  });
});

describe("every topic in view at once (#1194, replacing #1176 AC 6's one sideways line)", () => {
  const VIEWS = [PHONE, { width: 1440, height: 900 }] as const;
  const pages = (lang: "de" | "en"): readonly (readonly [string, string])[] => [
    ["place", placePath(lang, "koeln")],
    // the fixture's Köln by its Gemeindeschlüssel: the home with a place
    ["home+place", `${pathFor("start", lang)}?at=ags:05315000`],
  ];
  for (const v of VIEWS) {
    for (const lang of ["de", "en"] as const) {
      for (const [name, path] of pages(lang)) {
        it(`${lang} ${name} at ${String(v.width)}×${String(v.height)}: the chips wrap, none is off screen, each reached by the keyboard`, async () => {
          const { ctx, page } = await open(path, v);
          const opts = page.locator(".tpf__opts").first();
          expect(await opts.count(), "the fixture's place shows its topics").toBe(1);
          const m = await opts.evaluate((el) => {
            const chips = Array.from(el.querySelectorAll(".tpf__opt")).map((c) => c.getBoundingClientRect());
            return {
              chips: chips.length,
              outside: chips.filter((r) => r.left < -0.5 || r.right > window.innerWidth + 0.5).length,
              rows: new Set(chips.map((r) => Math.round(r.top))).size,
              scrollWidth: el.scrollWidth,
              clientWidth: el.clientWidth,
              page: document.documentElement.scrollWidth,
              vw: window.innerWidth,
            };
          });
          // the other sideways rows of the page, measured beside it (#1194's review: the jump links, the remembered places)
          const rows = await page.evaluate(() =>
            Array.from(document.querySelectorAll(".jumps__row, .placepos__chips")).map((e) => ({ c: e.className, items: e.children.length, scrollWidth: e.scrollWidth, clientWidth: e.clientWidth, shown: e.getBoundingClientRect().width > 0 })),
          );
          console.log(`topics 1194 ${lang} ${name} ${String(v.width)}: ${JSON.stringify({ ...m, rows })}`);
          expect(m.chips, "more than one topic").toBeGreaterThan(1);
          expect(m.outside, "every chip inside the viewport's width").toBe(0);
          expect(m.scrollWidth, "the chips do not scroll sideways").toBeLessThanOrEqual(m.clientWidth);
          expect(m.page, "the page itself does not scroll sideways").toBeLessThanOrEqual(m.vw);
          // the jump links hid their items the same way (a scrolling row, its scrollbar hidden): they wrap too
          for (const r of rows.filter((x) => x.shown && x.c.includes("jumps__row"))) expect(r.scrollWidth, "the jump links do not scroll sideways").toBeLessThanOrEqual(r.clientWidth);
          // the keyboard: from the first chip, Tab reaches every next one in order
          const inputs = opts.locator("input");
          const n = await inputs.count();
          expect(n).toBe(m.chips);
          await inputs.first().focus();
          for (let k = 1; k < n; k++) {
            await page.keyboard.press("Tab");
            expect(await inputs.nth(k).evaluate((e) => e === document.activeElement), `Tab reaches chip ${String(k + 1)} of ${String(n)}`).toBe(true);
          }
          await ctx.close();
        });
      }
    }
  }
});
