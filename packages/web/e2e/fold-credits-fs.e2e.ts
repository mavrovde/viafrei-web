/**
 * Data-steward ruling FS-2026-11-06, FS9 (c) and (d): the home with a known place on a 390 px phone, where the place's
 * cards and the "Deutschland jetzt" tiles below the first fold WITH their credit lines.
 *  - a closed fold that holds credit lines shows its FS3 line ("Quellen: …") in its summary, at the 13 px credit floor,
 *    not hidden from assistive technology, naming publishers and never "und N weitere";
 *  - opened with the keyboard, every line the sources component keeps in view (`mustShow`, #1120) is visible at once,
 *    with no second click;
 *  - in print every fold is open;
 *  - the raw response carries every credit line the page shows (no script adds one, none is fetched on opening);
 *  - opening and closing folds writes no storage and no cookie;
 *  - the fuel tile, the fuel card and the moments' fuel requests (FS5) have no fold around them;
 *  - a moment's fold of recorded answers names their publishers in its summary (FS3).
 *
 * Run in the pinned Linux image only.
 */
import { type ChildProcess } from "node:child_process";
import { all, text } from "@viafrei/design/testing";
import { mustShow } from "@viafrei/digest";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 9003;
const PHONE = { width: 390, height: 844 } as const;
const PATH = "/de?at=ags:05315000";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const ID = { IMPRESSUM_NAME: "Fold Probe", IMPRESSUM_STREET: "Probeweg 5", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "fold@example.invalid" };
const THIRD_PARTY = /googletagmanager\.com|google-analytics\.com|clarity\.ms/u;
const FOLDS = "details.pcard__fold, details.now__fold, details.ampel__mapfold";

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

async function open(): Promise<{ readonly ctx: BrowserContext; readonly page: Page }> {
  const ctx = await browser.newContext({ viewport: PHONE, userAgent: UA, hasTouch: true });
  ctx.setDefaultTimeout(2_000);
  await ctx.route(THIRD_PARTY, (r) => r.fulfill({ status: 204, body: "" }));
  const page = await ctx.newPage();
  await page.goto(`${base}${PATH}`);
  return { ctx, page };
}

describe("FS-2026-11-06 FS9 (c): a folded card's or tile's credits at 390 px", () => {
  it("each closed fold holding credit lines shows its FS3 line, ≥ 13 px, readable by assistive technology, naming publishers", async () => {
    const { ctx, page } = await open();
    const folds = await page.locator(FOLDS).evaluateAll((ds) =>
      ds
        .filter((d) => d.querySelector("p.credit") !== null)
        .map((d) => {
          const line = d.querySelector(":scope > summary .fold__sources");
          const r = line?.getBoundingClientRect();
          return {
            open: (d as HTMLDetailsElement).open,
            line: line?.textContent ?? null,
            names: line === null ? 0 : line.querySelectorAll('span[translate="no"]').length,
            px: line === null ? 0 : parseFloat(getComputedStyle(line).fontSize),
            shown: r !== undefined && r.height > 0 && r.width > 0,
            hidden: line?.closest('[aria-hidden="true"]') !== null && line !== null,
          };
        }),
    );
    expect(folds.length, "the fixture's home folds credit lines with their data").toBeGreaterThan(3);
    for (const f of folds) {
      expect(f.open, "closed on a phone").toBe(false);
      expect(f.line, "its summary names the sources").not.toBeNull();
      expect(f.line!).toMatch(/^Quellen: /u);
      expect(f.line!).not.toMatch(/weitere|\bmore\b/u);
      expect(f.names).toBeGreaterThan(0);
      expect(f.px).toBeGreaterThanOrEqual(13);
      expect(f.shown).toBe(true);
      expect(f.hidden).toBe(false);
    }
    await ctx.close();
  });

  it("FS3: each moment's fold holding recorded answers' credits — the first question's and the further questions' — names their publishers in its summary, under a visible label", async () => {
    const { ctx, page } = await open();
    const folds = await page.locator("details.moment__qfold, details.moment__more").evaluateAll((ds) =>
      ds
        .filter((d) => d.querySelector(".qa-answer__credits li") !== null)
        .map((d) => {
          const line = d.querySelector(":scope > summary .fold__sources");
          const r = line?.getBoundingClientRect();
          // a further-questions fold behind a closed first-question fold is not drawn at all (its moment shows one summary)
          const drawn = d.getBoundingClientRect().height > 0;
          const label = d.querySelector(":scope > summary .fold__label")?.getBoundingClientRect();
          const labelShown = label !== undefined && label.width > 1 && label.height > 1;
          return { cls: d.getAttribute("class") ?? "", line: line?.textContent ?? null, names: line === null ? 0 : line.querySelectorAll('span[translate="no"]').length, shown: !drawn || (r !== undefined && r.height > 0 && r.width > 0), labelShown: !drawn || labelShown, drawn };
        }),
    );
    expect(folds.filter((f) => f.cls.includes("moment__more") && f.drawn).length, "the further questions' folds hold credited answers").toBeGreaterThan(1);
    for (const f of folds) {
      expect(f.line, f.cls).not.toBeNull();
      expect(f.line!, f.cls).toMatch(/^Quellen: /u);
      expect(f.names, f.cls).toBeGreaterThan(0);
      expect(f.shown, f.cls).toBe(true);
      // the summary says in words what opening it shows, not a bare "+"
      expect(f.labelShown, f.cls).toBe(true);
    }
    await ctx.close();
  });

  it("opened with the keyboard, every line that stays in view is visible at once — no second click", async () => {
    const { ctx, page } = await open();
    const n = await page.locator(FOLDS).count();
    let judged = 0;
    for (let i = 0; i < n; i++) {
      const fold = page.locator(FOLDS).nth(i);
      const lines = await fold.locator("p.credit").evaluateAll((ps) => ps.map((p) => p.outerHTML));
      const kept = lines.map((h, j) => ({ h, j })).filter(({ h }) => mustShow(h));
      if (kept.length === 0) continue;
      await fold.locator("> summary").focus();
      await page.keyboard.press("Enter");
      expect(await fold.evaluate((d) => (d as HTMLDetailsElement).open)).toBe(true);
      for (const { j } of kept) expect(await fold.locator("p.credit").nth(j).isVisible(), lines[j]!.slice(0, 120)).toBe(true);
      judged++;
    }
    expect(judged, "the fixture folds at least one ALWAYS_SHOWN or condition line with its data").toBeGreaterThan(0);
    await ctx.close();
  });

  it("in print every fold is open and its credit lines are laid out", async () => {
    const { ctx, page } = await open();
    await page.emulateMedia({ media: "print" });
    const closed = await page.locator(FOLDS).evaluateAll((ds) =>
      ds.flatMap((d) => Array.from(d.querySelectorAll(":scope > :not(summary)")).slice(0, 1)).filter((e) => e.getBoundingClientRect().height === 0).length,
    );
    expect(closed).toBe(0);
    const credits = await page.locator(`:is(${FOLDS}) p.credit`).evaluateAll((ps) => ps.filter((p) => p.closest("details.sources") === null).map((p) => p.getBoundingClientRect().height > 0));
    expect(credits.length).toBeGreaterThan(0);
    expect(credits.every(Boolean)).toBe(true);
    await ctx.close();
  });

  it("the raw response carries every credit line the page shows, and opening folds writes no storage", async () => {
    const { ctx, page } = await open();
    const raw = await (await fetch(`${base}${PATH}`, { headers: { "user-agent": UA } })).text();
    const rawLines = new Set(all(raw, "p.credit").map((p) => text(p)));
    // #1183 part 5: the home's live map is the one block a person's browser fetches (the home's byte budget), and its
    // credit lines come in the SAME fragment as the map they credit, inside the roads fold — the credit folds and arrives
    // with its data (FS-2026-11-06 FS1), never apart from it. Every other credit line is in the raw response.
    // Review S3: the map's lines are judged once the loader's fetch has landed — before it, the loop below ran zero times.
    await page.waitForSelector("#lmap-home-slot figure.lmap", { state: "attached" });
    const lines = await page.locator("p.credit").evaluateAll((ps) =>
      ps.map((p) => ({ t: (p.textContent ?? "").replace(/\s+/gu, " ").trim(), map: p.closest("#lmap-home-slot") !== null, withFigure: (p.closest("#lmap-home-slot")?.querySelector("figure.lmap") ?? null) !== null, folded: p.closest("details.now__fold") !== null })),
    );
    const shown = lines.filter((l) => !l.map).map((l) => l.t);
    expect(shown.length).toBeGreaterThan(10);
    for (const s of shown) expect(rawLines.has(s), s.slice(0, 120)).toBe(true);
    expect(lines.filter((x) => x.map).length, "the live map's credit lines arrived with it").toBeGreaterThan(0);
    for (const l of lines.filter((x) => x.map)) {
      expect(l.withFigure, `${l.t.slice(0, 60)}: the live map's credit stands with its map`).toBe(true);
      expect(l.folded, `${l.t.slice(0, 60)}: in the fold that holds the map`).toBe(true);
    }
    const state = (): Promise<string> => page.evaluate(() => JSON.stringify([Object.keys(localStorage).sort(), Object.keys(sessionStorage).sort(), document.cookie]));
    const before = await state();
    const cookiesBefore = (await ctx.cookies()).length;
    const n = Math.min(await page.locator(FOLDS).count(), 6);
    for (let i = 0; i < n; i++) {
      const s = page.locator(FOLDS).nth(i).locator("> summary");
      // by the keyboard: a pointer's second click lands on the action bar once the first has scrolled the page under it
      await s.focus();
      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter");
    }
    expect(await state()).toBe(before);
    expect((await ctx.cookies()).length).toBe(cookiesBefore);
    await ctx.close();
  });
});

describe("review S2 of aa0dd63ee: the home's live map on a phone, as before", () => {
  it("opening the roads fold shows the map at once — its own fold draws no line below 1024 px — and its summary names the map's publishers", async () => {
    const { ctx, page } = await open();
    await page.waitForSelector("#lmap-home-slot figure.lmap", { state: "attached" });
    const outer = page.locator("details.now__fold:has(#lmap-home-slot)");
    await outer.locator("> summary").focus();
    await page.keyboard.press("Enter");
    const m = await page.$eval("#lmap-home-slot > details.lmap__homefold", (d) => ({
      summary: d.querySelector(":scope > summary")!.getBoundingClientRect().height,
      map: d.querySelector("figure.lmap")!.checkVisibility(),
      sources: d.querySelector(":scope > summary .fold__sources")?.querySelectorAll('span[translate="no"]').length ?? 0,
    }));
    expect(m.summary, "no second line on a phone").toBe(0);
    expect(m.map, "the map stands open in the opened roads fold").toBe(true);
    expect(m.sources, "FS3: the map fold's summary names its publishers").toBeGreaterThan(0);
    await ctx.close();
  });
});

describe("FS-2026-11-06 FS9 (d): fuel never folds", () => {
  it("neither the fuel tile nor the fuel card has a fold around it", async () => {
    const { ctx, page } = await open();
    const fuel = await page.locator("#tile-fuel, #pcard-fuel").evaluateAll((es) => es.map((e) => ({ id: e.id, folded: e.closest("details.fold") !== null, inner: e.querySelector("details.fold.pcard__fold, details.fold.now__fold") !== null })));
    expect(fuel.length).toBeGreaterThan(0);
    for (const f of fuel) expect(f, f.id).toEqual({ id: f.id, folded: false, inner: false });
    await ctx.close();
  });
  it("FS5: the fuel requests — recorded Tankerkönig prices — stand open at 390 px, in no fold, their credits visible", async () => {
    const { ctx, page } = await open();
    const asks = page.locator("#fuel-asks");
    expect(await asks.evaluate((e) => ({ tag: e.tagName, folded: e.closest("details") !== null }))).toEqual({ tag: "SECTION", folded: false });
    expect(await asks.locator(".qa-answer__credits").first().isVisible()).toBe(true);
    await ctx.close();
  });
});
