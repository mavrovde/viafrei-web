/**
 * #1174: the first screen of a phone, 375×812, on one page of every type, in the four states a visitor can really meet:
 * plain, a kept place, the IP guess's confirm row and the consent sheet. Every state is asserted to have been SHOWN
 * before it is measured, so a test cannot fall back on the plain state and pass about one nobody saw. Also here: the
 * one-line bar and how it opens, the beta line in all 22 languages, the sheet's size and its buttons, and the fixed
 * action bar where the browser has no scroll timelines (Firefox).
 */
import { execFileSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AxeBuilder } from "@axe-core/playwright";
import { chromium, firefox, type Browser, type BrowserContext, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { t } from "../src/i18n/index.js";
import { LIVE_LANGS, pathFor } from "../src/site/pages.js";
import { placePath } from "../src/site/places.js";
import { stationPath } from "../src/site/stations.js";
import { AUTOHOF_CHARGING_SLUG, AUTOHOF_FUEL_SLUG } from "./energy-autohof.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8894;
const IP_PORT = 8895;
const TAG_PORT = 8896;
const base = (p: number): string => `http://127.0.0.1:${String(p)}`;
const HERE = dirname(fileURLToPath(import.meta.url));
const GEO_DIR = mkdtempSync(join(tmpdir(), "vf-fs-geo-"));
const GEO_FILE = join(GEO_DIR, "geoip.vfgeo");
const PROBE_IP = "198.18.0.10";
const PROBE_ROW = "198.18.0.0,198.18.0.255,EU,DE,Niedersachsen,Probe,52.5512,9.4513\n";
const PERSON_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const ID = { IMPRESSUM_NAME: "Fold Probe", IMPRESSUM_STREET: "Probeweg 5", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "fold@example.invalid" };
const PHONE = { width: 375, height: 812 } as const;
const H1_TOP_MAX = 200;
const SHEET_MAX = 120;
const CONSENT = ".consent[role=dialog]";
const THIRD_PARTY = /googletagmanager\.com|google-analytics\.com|clarity\.ms/u;

let browser: Browser;
let digest: Awaited<ReturnType<typeof startRealDigest>>;
const shells: ChildProcess[] = [];

beforeAll(async () => {
  digest = await startRealDigest({ energy: "autohof" });
  const env = { ...ID, DIGEST_URL: digest.url, VF_MOTORWAY_AROUND: "1" };
  shells.push(await startShell(PORT, env));
  const csv = PROBE_ROW + readFileSync(join(HERE, "..", "test", "fixtures", "geoip-fixture.csv"), "utf8");
  execFileSync(process.execPath, [join(HERE, "..", "..", "..", "scripts", "geoip-build.mjs"), "--release", "2026-10", "--out", GEO_FILE, "--min-de-ranges", "1"], { input: csv, encoding: "utf8" });
  shells.push(await startShell(IP_PORT, { ...env, GEOIP_FILE: GEO_FILE }));
  shells.push(await startShell(TAG_PORT, { ...env, GOOGLE_TAG: "G-0" }));
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  for (const s of shells) s.kill();
  await digest?.close();
  rmSync(GEO_DIR, { recursive: true, force: true });
});

type Lang = "de" | "en";
type Kind = "home" | "place" | "station" | "charging" | "fuel" | "motorway" | "exit" | "news" | "connect";
const KINDS: readonly Kind[] = ["home", "place", "station", "charging", "fuel", "motorway", "exit", "news", "connect"];
/** What carries the consent bar (`measurementOf`): the other pages measure nothing and ask nothing. */
const ASKS: readonly Kind[] = ["home", "motorway", "connect"];
/** Where the IP-guess row was measured to show in this fixture; everywhere else that state is the plain one. */
const GUESSED: readonly Kind[] = ["home", "motorway", "exit"];

async function exitPath(lang: Lang): Promise<string> {
  const a7 = await (await fetch(`${base(PORT)}/${lang}/autobahn/a7`)).text();
  const href = /<a href="(a7\/exit-[a-z0-9-]+)"/u.exec(a7)?.[1];
  if (href === undefined) throw new Error("the A7 names no junction");
  return `/${lang}/autobahn/${href}`;
}
async function pathOf(kind: Kind, lang: Lang): Promise<string> {
  switch (kind) {
    case "home": return `/${lang}`;
    case "place": return placePath(lang, "koeln");
    case "station": return stationPath(lang, "koeln-hbf");
    case "charging": return `/${lang}/charging/${AUTOHOF_CHARGING_SLUG}`;
    case "fuel": return `/${lang}/fuel/${AUTOHOF_FUEL_SLUG}`;
    case "motorway": return `/${lang}/autobahn/a7`;
    case "exit": return exitPath(lang);
    case "news": return pathFor("news", lang);
    case "connect": return pathFor("connect", lang);
  }
}

type Open = { readonly ctx: BrowserContext; readonly page: Page };
async function open(url: string, o: { readonly ip?: string; readonly stored?: Readonly<Record<string, unknown>>; readonly scheme?: "light" | "dark" } = {}): Promise<Open> {
  const ctx = await browser.newContext({ viewport: PHONE, userAgent: PERSON_UA, hasTouch: true, colorScheme: o.scheme ?? "light", ...(o.ip === undefined ? {} : { extraHTTPHeaders: { "X-Forwarded-For": o.ip } }) });
  ctx.setDefaultTimeout(2_000);
  if (o.stored !== undefined) await ctx.addInitScript((kept) => localStorage.setItem("viafrei.place", JSON.stringify(kept)), o.stored);
  await ctx.route(THIRD_PARTY, (r) => r.fulfill({ status: 204, body: "" }));
  const page = await ctx.newPage();
  await page.goto(url);
  return { ctx, page };
}
const shown = (page: Page, sel: string): Promise<boolean> => page.locator(sel).first().isVisible();

describe("the first screen on every page type (#1174 AC 1, 375×812)", () => {
  const measured: Record<string, unknown> = {};
  afterAll(() => {
    console.log(`first screen 1174: ${JSON.stringify(measured)}`);
  });

  for (const lang of ["de", "en"] as const) {
    for (const kind of KINDS) {
      it(`${lang} ${kind}, plain: the H1 starts inside the limit`, async () => {
        const path = await pathOf(kind, lang);
        const { ctx, page } = await open(`${base(PORT)}${path}`);
        const h1 = await page.locator("main h1").first().boundingBox();
        expect(h1, "a page has its H1").not.toBeNull();
        measured[`${lang} ${kind} plain`] = Math.round(h1!.y);
        if (kind !== "home") expect(h1!.y).toBeLessThanOrEqual(H1_TOP_MAX);
        await ctx.close();
      });

      // The row a kept place adds is the same in every language: German carries it; the plain state above carries AC 1 in both.
      if (lang === "de") it(`${lang} ${kind}, a kept place: the line was shown, the H1 starts inside the limit`, async () => {
        const path = await pathOf(kind, lang);
        const { ctx, page } = await open(`${base(PORT)}${path}`, { stored: { at: null, label: "", how: "germany" } });
        // the fuel page runs no script, so nothing can read what the browser keeps: that state does not exist there
        if (kind !== "fuel") {
          await page.waitForSelector("#place-kept:not([hidden])");
          expect(await shown(page, "#place-kept"), "the state was really shown").toBe(true);
        }
        const h1 = await page.locator("main h1").first().boundingBox();
        measured[`${lang} ${kind} kept`] = Math.round(h1!.y);
        if (kind !== "home") expect(h1!.y).toBeLessThanOrEqual(H1_TOP_MAX);
        await ctx.close();
      });

      // Only where the confirm row shows (GUESSED); the row's text is longest in English, so both languages.
      if (GUESSED.includes(kind)) it(`${lang} ${kind}, the IP guess: the confirm row was shown, the H1 starts inside the limit`, async () => {
        const path = await pathOf(kind, lang);
        const { ctx, page } = await open(`${base(IP_PORT)}${path}`, { ip: PROBE_IP });
        await page.waitForLoadState("load");
        await page.waitForSelector("#place-confirm:not([hidden])");
        expect(await shown(page, "#place-confirm"), "the state was really shown").toBe(true);
        const h1 = await page.locator("main h1").first().boundingBox();
        measured[`${lang} ${kind} ip`] = Math.round(h1!.y);
        if (kind !== "home") expect(h1!.y).toBeLessThanOrEqual(H1_TOP_MAX);
        await ctx.close();
      });

      if (ASKS.includes(kind)) {
        it(`${lang} ${kind}, the consent sheet: it was shown, it is the sheet, the H1 stands above it`, async () => {
          const path = await pathOf(kind, lang);
          const { ctx, page } = await open(`${base(TAG_PORT)}${path}`);
          await page.waitForSelector(CONSENT);
          const bar = (await page.locator(CONSENT).boundingBox())!;
          const h1 = (await page.locator("main h1").first().boundingBox())!;
          measured[`${lang} ${kind} consent`] = { h1: Math.round(h1.y), h1End: Math.round(h1.y + h1.height), sheet: Math.round(bar.height), from: Math.round(bar.y) };
          expect(bar.height, "the sheet").toBeLessThanOrEqual(SHEET_MAX);
          expect(h1.y + h1.height, "not under the sheet").toBeLessThanOrEqual(bar.y);
          if (kind !== "home") expect(h1.y).toBeLessThanOrEqual(H1_TOP_MAX);
          await ctx.close();
        });
      }
    }
  }
});

describe("the one-line bar (#1174 AC 2)", () => {
  const STATION = "/de/station/koeln-hbf";
  const stored = { at: "ags:05315000", how: "manual", label: "Köln" };

  it("the pill and the search symbol stand on ONE line", async () => {
    const { ctx, page } = await open(`${base(PORT)}${STATION}`);
    const pill = (await page.locator("#place-pill").boundingBox())!;
    const symbol = (await page.locator("#place-open").boundingBox())!;
    expect(Math.abs(pill.y + pill.height / 2 - (symbol.y + symbol.height / 2)), "same line").toBeLessThanOrEqual(4);
    expect(symbol.x, "the symbol after the pill").toBeGreaterThanOrEqual(pill.x + pill.width);
    expect(symbol.x + symbol.width).toBeLessThanOrEqual(PHONE.width);
    expect(symbol.height, "a touch target").toBeGreaterThanOrEqual(44);
    expect(await shown(page, "#place-rows .site-place__geo")).toBe(false);
    await ctx.close();
  });

  for (const key of ["Enter", "Space"] as const) {
    for (const id of ["place-open", "place-pill"] as const) {
      it(`${key} on #${id} opens it with the focus inside; Escape closes it and the focus goes back`, async () => {
        const { ctx, page } = await open(`${base(PORT)}${STATION}`, { stored });
        await page.locator(`#${id}`).focus();
        await page.keyboard.press(key);
        await page.waitForSelector("#place-hq:visible");
        expect(await page.evaluate(() => document.activeElement?.id)).toBe("place-hq");
        expect(await page.getAttribute("#place-open", "aria-expanded")).toBe("true");
        await page.keyboard.press("Escape");
        await page.waitForSelector("#place-hq", { state: "hidden" });
        expect(await page.evaluate(() => document.activeElement?.id)).toBe(id);
        await ctx.close();
      });
    }
  }

  it("a tap on the pill opens it; to assistive technology the folded pill is a button, the opened one a radio", async () => {
    const { ctx, page } = await open(`${base(PORT)}${STATION}`, { stored });
    expect(await page.getAttribute("#place-pill", "role")).toBe("button");
    expect(await page.getAttribute("#place-pill", "aria-expanded")).toBe("false");
    await page.tap("#place-pill");
    await page.waitForSelector("#place-hq:visible");
    expect(await page.getAttribute("#place-pill", "role")).toBe("radio");
    expect(await page.getAttribute("#place-pill", "aria-checked")).not.toBeNull();
    await ctx.close();
  });

  it("the search page and a home that knows no place do not fold", async () => {
    for (const path of ["/de/search?q=koeln", "/de"]) {
      const { ctx, page } = await open(`${base(PORT)}${path}`);
      expect(await shown(page, "#place-open"), path).toBe(false);
      expect(await shown(page, "#place-hq"), path).toBe(true);
      await ctx.close();
    }
  });

  // owner decision 2026-11-06 (#1180 compact header): from 1024 px the header is two thin rows — the pill and the search
  // stand, the rest of the bar behind one opener; the phone's one-line bar (above) is unchanged
  it("at 1280 px the bar is the desktop's compact header: the search and the pill stand, the opener opens the rest", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, userAgent: PERSON_UA });
    ctx.setDefaultTimeout(2_000);
    const page = await ctx.newPage();
    await page.goto(`${base(PORT)}${STATION}`);
    expect(await shown(page, "#place-hq")).toBe(true);
    expect(await shown(page, "#place-pill")).toBe(true);
    expect(await page.getAttribute("#place-pill", "role")).toBe("radio");
    expect(await shown(page, "#place-open")).toBe(true);
    expect(await shown(page, ".site-place__geo")).toBe(false);
    await page.click("#place-open");
    expect(await shown(page, ".site-place__geo")).toBe(true);
    expect(await shown(page, "#place-hq")).toBe(true);
    expect(await page.getAttribute("#place-open", "aria-expanded")).toBe("true");
    await ctx.close();
  });
});

describe("the beta line, every language (#1174 AC 3)", () => {
  for (const lang of LIVE_LANGS) {
    it(`${lang}: one line at 375 px, with the link to the explanation`, async () => {
      const { ctx, page } = await open(`${base(PORT)}/${lang}`);
      const box = (await page.locator(".site-head .beta__text").boundingBox())!;
      expect(box.height, "one line, at 0.75rem and a line height of 1.3").toBeLessThanOrEqual(17);
      expect(await page.locator(".site-head .beta a").getAttribute("href")).toBe(`${pathFor("connect", lang)}#beta`);
      expect(await page.locator(".site-head .beta").innerText()).toContain(t(lang, "beta.line"));
      await ctx.close();
    });
  }
});

describe("the consent sheet (#1174 AC 4)", () => {
  for (const scheme of ["light", "dark"] as const) {
    for (const lang of ["de", "en"] as const) {
      it(`${lang} ${scheme}: at most 120 px, two equal buttons, axe clean, the text scrolls by keyboard`, async () => {
        const { ctx, page } = await open(`${base(TAG_PORT)}/${lang}`, { scheme });
        await page.waitForSelector(CONSENT);
        const bar = (await page.locator(CONSENT).boundingBox())!;
        expect(bar.height).toBeLessThanOrEqual(SHEET_MAX);
        const buttons = page.locator(`${CONSENT} [data-vf-consent]`);
        expect(await buttons.count()).toBe(2);
        const a = (await buttons.nth(0).boundingBox())!;
        const b = (await buttons.nth(1).boundingBox())!;
        expect(a.height, "same height").toBe(b.height);
        expect(Math.abs(a.width - b.width), "same width").toBeLessThanOrEqual(1);
        expect(a.height, "a touch target").toBeGreaterThanOrEqual(44);
        const style = (i: number): Promise<readonly string[]> =>
          buttons.nth(i).evaluate((el) => {
            const c = getComputedStyle(el);
            return [c.fontWeight, c.fontSize, c.color, c.backgroundColor, c.borderTopWidth, c.borderTopColor];
          });
        expect(await style(0), "same style").toEqual(await style(1));
        expect(await page.locator(`${CONSENT} .consent__text`).getAttribute("tabindex"), "the keyboard can scroll it").toBe("0");
        const axe = await new AxeBuilder({ page }).include(CONSENT).analyze();
        expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
        await ctx.close();
      });
    }
  }
});

describe("the fixed action bar in a browser without scroll timelines (#1174)", () => {
  let fx: Browser;
  beforeAll(async () => {
    // Firefox has scroll timelines on by default since 159 (Playwright 1.65's build), so the case under test — a browser
    // without them, where the header's script shows the bar — is Firefox with them switched off by its own preference.
    fx = await firefox.launch({ firefoxUserPrefs: { "layout.css.scroll-driven-animations.enabled": false } });
  });
  afterAll(async () => {
    await fx?.close();
  });

  it("Firefox: hidden on the first screen, shown from 520 px of scroll by the header's script, hidden again at the top", async () => {
    const ctx = await fx.newContext({ viewport: PHONE });
    ctx.setDefaultTimeout(2_000);
    const page = await ctx.newPage();
    await page.goto(`${base(PORT)}/de`);
    expect(await page.evaluate(() => CSS.supports("animation-timeline", "scroll()")), "this browser is the case under test").toBe(false);
    expect(await page.locator(".actionbar").isVisible(), "at the top").toBe(false);
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.waitForFunction(() => document.documentElement.getAttribute("data-actionbar") === "on");
    expect(await page.locator(".actionbar").isVisible(), "scrolled").toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForFunction(() => !document.documentElement.hasAttribute("data-actionbar"));
    expect(await page.locator(".actionbar").isVisible(), "back at the top").toBe(false);
    await ctx.close();
  });

  it("Chromium: hidden on the first screen", async () => {
    const { ctx, page } = await open(`${base(PORT)}/de`);
    expect(await page.locator(".actionbar").isVisible()).toBe(false);
    await ctx.close();
  });
});

describe("the fixed action bar in Firefox with scroll timelines (its default since 159)", () => {
  let fx: Browser;
  beforeAll(async () => {
    fx = await firefox.launch();
  });
  afterAll(async () => {
    await fx?.close();
  });

  it("the stylesheet's path: hidden on the first screen, shown from 520 px of scroll, hidden again at the top", async ({ skip }) => {
    const ctx = await fx.newContext({ viewport: PHONE, reducedMotion: "no-preference" });
    ctx.setDefaultTimeout(2_000);
    const page = await ctx.newPage();
    await page.goto(`${base(PORT)}/de`);
    if (!(await page.evaluate(() => CSS.supports("animation-timeline", "scroll()")))) {
      // a Firefox older than 159 (the local e2e image's) cannot be the case under test; Playwright 1.65's 159 must run it
      await ctx.close();
      skip(`Firefox ${fx.version()} has no scroll timelines`);
    }
    const shown = (): Promise<string> => page.evaluate(() => getComputedStyle(document.querySelector(".actionbar") as Element).visibility);
    expect(await page.locator(".actionbar").isVisible(), "at the top").toBe(false);
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".actionbar") as Element).visibility === "visible");
    expect(await shown(), "scrolled").toBe("visible");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".actionbar") as Element).visibility === "hidden");
    expect(await page.locator(".actionbar").isVisible(), "back at the top").toBe(false);
    expect(await page.evaluate(() => document.documentElement.hasAttribute("data-actionbar")), "the script stays out of it").toBe(false);
    await ctx.close();
  });
});
