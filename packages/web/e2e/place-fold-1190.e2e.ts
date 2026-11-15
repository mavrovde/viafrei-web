/**
 * #1190 (the road pages' part of #1173): the place bar's fold on a phone, in a real browser against the BUILT shell, so
 * it is the script text the page carries that is exercised (lessons: an inline script that was never called). The shell
 * runs as production does (`VF_MOTORWAY_AROUND=1`); a second one holds a GeoIP file, which is what shows the IP guess's
 * confirm row.
 *
 * The fold: the rows hidden, the opener shows them with the search focused; the pill on its way to the search and
 * "Anderer Ort" open them; a scope switch and the radio group's arrow keys never do; the close control and Escape fold
 * them and hand focus back; without script the opener is a link to the search page; on a desktop nothing folds. What the
 * browser keeps stays visible in the fold (`place.privacy.body` promises it), and the first screen holds the map and the
 * whole summary with each of the rows that can stand in the fold.
 */
import { execFileSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { t } from "../src/i18n/index.js";
import { firstScreen, PHONE } from "./first-screen.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8881;
const IP_PORT = 8882;
/** With "around you" off, the one state in which the pill goes back to its place instead of heading for the search. */
const NO_AROUND_PORT = 8883;
const BASE = `http://127.0.0.1:${String(PORT)}`;
const IP_BASE = `http://127.0.0.1:${String(IP_PORT)}`;
const HERE = dirname(fileURLToPath(import.meta.url));
const GEO_DIR = mkdtempSync(join(tmpdir(), "vf-fold-geo-"));
const GEO_FILE = join(GEO_DIR, "geoip.vfgeo");
/** A documentation range (RFC 5737) placed on the fixture A7's point 100, as in `motorway-around.e2e.ts`. */
const A7_IP = "198.18.0.10";
const A7_ROW = "198.18.0.0,198.18.0.255,EU,DE,Niedersachsen,Probe,52.5512,9.4513\n";
const PERSON_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const ID = { IMPRESSUM_NAME: "Fold Probe", IMPRESSUM_STREET: "Probeweg 5", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "fold@example.invalid" };
const A7 = "/de/autobahn/a7";
/** The rows the fold holds back: "Mein Standort", the search, the places, the privacy note. */
const ROWS = [".site-place__geo", "#place-hq", ".site-place__tools", ".placepos__privacy"] as const;

let browser: Browser;
let digest: Awaited<ReturnType<typeof startRealDigest>>;
const shells: ChildProcess[] = [];

beforeAll(async () => {
  digest = await startRealDigest();
  shells.push(await startShell(PORT, { ...ID, DIGEST_URL: digest.url, VF_MOTORWAY_AROUND: "1" }));
  const csv = A7_ROW + readFileSync(join(HERE, "..", "test", "fixtures", "geoip-fixture.csv"), "utf8");
  execFileSync(process.execPath, [join(HERE, "..", "..", "..", "scripts", "geoip-build.mjs"), "--release", "2026-10", "--out", GEO_FILE, "--min-de-ranges", "1"], { input: csv, encoding: "utf8" });
  shells.push(await startShell(IP_PORT, { ...ID, DIGEST_URL: digest.url, VF_MOTORWAY_AROUND: "1", GEOIP_FILE: GEO_FILE }));
  shells.push(await startShell(NO_AROUND_PORT, { ...ID, DIGEST_URL: digest.url }));
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  for (const s of shells) s.kill();
  await digest?.close();
  rmSync(GEO_DIR, { recursive: true, force: true });
});

type Open = { readonly ctx: BrowserContext; readonly page: Page };
async function open(url: string, o: { readonly width?: number; readonly js?: boolean; readonly ip?: string; readonly stored?: Readonly<Record<string, unknown>> } = {}): Promise<Open> {
  const ctx = await browser.newContext({
    viewport: { width: o.width ?? PHONE.width, height: PHONE.height },
    userAgent: PERSON_UA,
    hasTouch: true,
    javaScriptEnabled: o.js ?? true,
    ...(o.ip === undefined ? {} : { extraHTTPHeaders: { "X-Forwarded-For": o.ip } }),
  });
  if (o.stored !== undefined) await ctx.addInitScript((kept) => localStorage.setItem("viafrei.place", JSON.stringify(kept)), o.stored);
  const page = await ctx.newPage();
  await page.goto(url);
  return { ctx, page };
}
const shown = (page: Page, sel: string): Promise<boolean> => page.locator(sel).first().isVisible();
const rowsShown = (page: Page): Promise<readonly boolean[]> => Promise.all(ROWS.map((r) => shown(page, r)));
const focused = (page: Page): Promise<string | undefined> => page.evaluate(() => document.activeElement?.id);
const FOLDED = ROWS.map(() => false);
const OPEN = ROWS.map(() => true);

async function expectFolded(page: Page): Promise<void> {
  expect(await rowsShown(page), "the rows are held back").toEqual(FOLDED);
  expect(await shown(page, "#place-open"), "the opener is the fold's one row").toBe(true);
  expect(await shown(page, "#place-close"), "no close control while folded").toBe(false);
  expect(await page.getAttribute("#place-open", "aria-expanded")).toBe("false");
}
async function expectOpen(page: Page): Promise<void> {
  expect(await rowsShown(page), "the rows are shown").toEqual(OPEN);
  expect(await shown(page, "#place-open"), "the opener has gone").toBe(false);
  expect(await shown(page, "#place-close"), "the close control is visible").toBe(true);
  expect(await page.getAttribute("#place-open", "aria-expanded")).toBe("true");
}

describe("the fold on a road page, 375 px (#1190)", () => {
  it("the rows are hidden; tapping the opener shows them with the search focused; aria-controls names the rows' wrapper", async () => {
    const { ctx, page } = await open(`${BASE}${A7}`);
    await expectFolded(page);
    const controls = await page.getAttribute("#place-open", "aria-controls");
    expect(controls).toBe("place-rows");
    // the wrapper holds every row the opener reveals
    for (const r of ROWS) expect(await page.locator(`#place-rows ${r}`).count(), r).toBe(1);
    await page.tap("#place-open");
    await expectOpen(page);
    expect(await focused(page)).toBe("place-hq");
    await ctx.close();
  });

  for (const lang of ["de", "en"] as const) {
    it(`${lang}: the close control is visible while open, says its word, folds the rows and hands focus back`, async () => {
      const { ctx, page } = await open(`${BASE}/${lang}/autobahn/a7`);
      await page.tap("#place-open");
      expect((await page.locator("#place-close").innerText()).replace(/^×\s*/u, "")).toBe(t(lang, "place.bar.close"));
      const box = await page.locator("#place-close").boundingBox();
      expect(box?.height, "a touch target").toBeGreaterThanOrEqual(44);
      await page.tap("#place-close");
      await expectFolded(page);
      expect(await focused(page)).toBe("place-open");
      await ctx.close();
    });
  }

  it("the pill on its way to the search opens them, with the search focused", async () => {
    const { ctx, page } = await open(`${BASE}${A7}`);
    await page.tap("#place-pill");
    await expectOpen(page);
    expect(await focused(page)).toBe("place-hq");
    await ctx.close();
  });

  it("'Anderer Ort' on the IP guess's row opens them, with the search focused", async () => {
    const { ctx, page } = await open(`${IP_BASE}${A7}`, { ip: A7_IP });
    expect(await shown(page, "#place-confirm"), "the IP guess's row is offered").toBe(true);
    await expectFolded(page);
    await page.tap("#place-cother");
    await expectOpen(page);
    expect(await focused(page)).toBe("place-hq");
    expect(await shown(page, "#place-confirm")).toBe(false);
    await ctx.close();
  });

  it("Escape folds them and returns focus to the opener", async () => {
    const { ctx, page } = await open(`${BASE}${A7}`);
    await page.tap("#place-open");
    await page.keyboard.press("Escape");
    await expectFolded(page);
    expect(await focused(page)).toBe("place-open");
    // the opener is a button to the keyboard too: Space opens again
    await page.keyboard.press("Space");
    await expectOpen(page);
    await ctx.close();
  });

  it("without script the opener is a link to the search page, and no close control stands", async () => {
    for (const lang of ["de", "en"] as const) {
      const { ctx, page } = await open(`${BASE}/${lang}/autobahn/a7`, { js: false });
      expect(await rowsShown(page)).toEqual(FOLDED);
      expect(await shown(page, "#place-close")).toBe(false);
      await Promise.all([page.waitForURL(`${BASE}/${lang}/search`), page.click("#place-open")]);
      await ctx.close();
    }
  });

  // owner decision 2026-11-06 (#1180 compact header): from 1024 px the search stands in the header's second row and the
  // other rows wait behind the opener, as on the phone; opened, every row stands with its close control
  it("at 1280 px the search stands, the other rows wait behind the opener, and opened every row is visible", async () => {
    const { ctx, page } = await open(`${BASE}${A7}`, { width: 1280 });
    expect(await rowsShown(page)).toEqual(ROWS.map((r) => r === "#place-hq"));
    expect(await shown(page, "#place-open")).toBe(true);
    expect(await shown(page, "#place-close")).toBe(false);
    expect(await page.getAttribute("#place-open", "aria-expanded")).toBe("false");
    await page.click("#place-open");
    await expectOpen(page);
    await ctx.close();
  });

  // #1174: "Ganz Deutschland" is a row of the opened bar now; a scope switch there keeps the rows standing
  it("a scope switch to 'Ganz Deutschland' and the radio group's arrow keys leave the opened bar open", async () => {
    const stored = { at: "pt:52.55,9.45", label: "Musterstadt", how: "browser" };
    const { ctx, page } = await open(`${BASE}${A7}`, { stored });
    await page.waitForFunction(() => document.getElementById("place-scope-de")?.getAttribute("aria-checked") === "false");
    await page.tap("#place-open");
    await expectOpen(page);
    await page.tap("#place-scope-de");
    await page.waitForFunction(() => document.getElementById("place-scope-de")?.getAttribute("aria-checked") === "true");
    expect(await rowsShown(page), "the tap on the radio").toEqual(OPEN);
    await page.locator("#place-scope-de").focus();
    await page.keyboard.press("ArrowLeft");
    expect(await rowsShown(page), "the arrow to the place").toEqual(OPEN);
    await ctx.close();
  });

  it("#1174: while folded the pill opens the bar and writes nothing; open, it goes back to the place", async () => {
    const stored = { at: null, label: "", how: "germany", back: { at: "ags:05315000", how: "manual", label: "Köln" } };
    const { ctx, page } = await open(`http://127.0.0.1:${String(NO_AROUND_PORT)}${A7}`, { stored });
    await page.waitForFunction(() => document.getElementById("place-scope-de")?.getAttribute("aria-checked") === "true");
    await page.tap("#place-pill");
    await expectOpen(page);
    expect((JSON.parse((await page.evaluate(() => localStorage.getItem("viafrei.place"))) ?? "{}") as { how?: string }).how, "opening wrote nothing").toBe("germany");
    await page.tap("#place-pill");
    await page.waitForFunction(() => (JSON.parse(localStorage.getItem("viafrei.place") ?? "{}") as { at?: string }).at === "ags:05315000");
    expect(await rowsShown(page)).toEqual(OPEN);
    await ctx.close();
  });
});

describe("what the browser keeps stays visible in the fold (#1190, place.privacy.body)", () => {
  const stored = { at: null, label: "", how: "germany" };

  it("the line and 'Ort vergessen' are visible while folded, the privacy note is held back; forgetting leaves no empty row", async () => {
    const { ctx, page } = await open(`${BASE}${A7}`, { stored });
    await page.waitForSelector("#place-kept:not([hidden])");
    expect(await shown(page, "#place-kept"), "the line").toBe(true);
    expect(await shown(page, "#place-kept-forget"), "its control").toBe(true);
    await expectFolded(page);
    await page.tap("#place-kept-forget");
    expect(await shown(page, "#place-kept")).toBe(false);
    expect(await shown(page, ".site-place__foot"), "no empty foot in the fold").toBe(false);
    expect(await page.evaluate(() => localStorage.getItem("viafrei.place"))).toBeNull();
    await ctx.close();
  });

  it("with nothing kept the foot is not a row of the fold", async () => {
    const { ctx, page } = await open(`${BASE}${A7}`);
    expect(await shown(page, ".site-place__foot")).toBe(false);
    await ctx.close();
  });
});

describe("the first screen with each row the fold can hold (#1190 AC 3, 375×812)", () => {
  const measured: Record<string, unknown> = {};
  afterAll(() => {
    console.log(`first screen: ${JSON.stringify(measured)}`);
  });

  const STATES = [
    { name: "plain", base: BASE, o: {} },
    { name: "kept", base: BASE, o: { stored: { at: null, label: "", how: "germany" } } },
    { name: "ip", base: IP_BASE, o: { ip: A7_IP } },
  ] as const;
  // No "ip" on the index: the server never gives it that row (`MotorwaysPage.astro` has no place for it, and `headerPlaceFor`'s
  // header answers `ip: false`), so a case there would measure the plain state under another name.
  const CASES = [
    { path: "/de/autobahn", states: ["plain", "kept"] },
    { path: A7, states: ["plain", "kept", "ip"] },
    { path: "/en/autobahn", states: ["plain", "kept"] },
    { path: "/en/autobahn/a7", states: ["plain", "kept", "ip"] },
  ] as const;

  for (const { path, states } of CASES) {
    for (const s of STATES.filter((x) => (states as readonly string[]).includes(x.name))) {
      it(`${path}, ${s.name}: at least 108 px of the map and the whole summary, with exactly that row in the fold`, async () => {
        const { ctx, page } = await open(`${s.base}${path}`, s.o);
        await page.waitForLoadState("load");
        if (s.name === "kept") await page.waitForSelector("#place-kept:not([hidden])");
        const m = await firstScreen(page, path);
        const confirm = await shown(page, "#place-confirm");
        const kept = await shown(page, "#place-kept");
        measured[`${path} ${s.name}`] = { ...m, confirm, kept };
        expect(confirm, "the IP guess's row").toBe(s.name === "ip");
        expect(kept, "the line of what the browser keeps").toBe(s.name === "kept");
        expect(m.mapShown, "the map").toBeGreaterThanOrEqual(108);
        expect(m.summaryEnd, "the summary").toBeLessThanOrEqual(812);
        await ctx.close();
      });
    }
  }
});
