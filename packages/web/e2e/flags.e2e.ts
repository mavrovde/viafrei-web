/**
 * The language menu's country flags (#989), against the BUILT shell:
 *   - the menus' HTML with the flags taken out is, byte for byte after
 *     whitespace, the HTML of the menus before #989 (`test/__golden__/langmenu-before-989.json`,
 *     captured from the build of c50385e91): names, `lang`, `hreflang`, links and
 *     the current marker are unchanged, and the only additions are the flag and
 *     (2.4.4) the `?setlang=1` choice marker on each link;
 *   - one sprite per page, outside every `<details>`, and every flag's `<use>`
 *     points at a `<symbol>` of it; English carries two flags, GB then US, every
 *     other language one, in the header AND the footer menu;
 *   - the flags PAINT, in the header and in the footer (whose `<use>` reaches the
 *     sprite the header drew): the German flag's three bands are sampled;
 *   - the flags are `aria-hidden`, each link's accessible name is its language's
 *     name alone, and axe finds nothing in the OPEN menu, light and dark;
 *   - every flag box is exactly its fixed size, and the home shifts no layout.
 */
import type { ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AxeBuilder } from "@axe-core/playwright";
import { chromium, type Browser, type Page } from "playwright";
import { PNG } from "pngjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { all } from "@viafrei/design/testing";
import { FLAG_HEIGHT, FLAG_WIDTH } from "../src/i18n/flags.js";
import { flagsOf, labelOf, reviewedLocales } from "../src/i18n/locales.js";
import type { Lang } from "../src/site/pages.js";
import { startShell } from "./server.js";
import { gotoSettled } from "./settle.js";
import { startStubDigest } from "./stub-digest.js";

const PORT = 8889;
const BASE = `http://127.0.0.1:${String(PORT)}`;
const GOLDEN = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "test", "__golden__", "langmenu-before-989.json"), "utf8")) as Record<string, string[]>;
let shell: ChildProcess;
let stub: Awaited<ReturnType<typeof startStubDigest>>;
let browser: Browser;

beforeAll(async () => {
  stub = await startStubDigest({});
  shell = await startShell(PORT, {
    DIGEST_URL: stub.url,
    IMPRESSUM_NAME: "Flag Probe",
    IMPRESSUM_STREET: "Probeweg 4",
    IMPRESSUM_CITY: "00000 Probe",
    IMPRESSUM_EMAIL: "flags@example.invalid",
  });
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await stub?.close();
});

const squash = (s: string): string => s.replace(/\s+/g, " ").replace(/> </g, "><").trim();
const menus = (html: string): string[] => [...html.matchAll(/<details class="langmenu"[\s\S]*?<\/details>/g)].map((m) => m[0]);
// 2.4.4: every menu link also carries the language-choice marker (`?setlang=1`, `i18n/lang-redirect.ts`) and rel="nofollow"; and the
// summary's name begins with its visible badge, "DE – " (WCAG 2.5.3, axe-core 4.14's label-content-name-mismatch) — the three other
// changes since #989, taken out here like the flags so the rest is still judged against the frozen golden.
const withoutFlags = (menu: string): string =>
  menu
    .replace(/<span class="langs__flags" aria-hidden="true">[\s\S]*?<\/span>/g, "")
    .replace(/\?setlang=1"/g, '"')
    .replace(/ rel="nofollow"/g, "")
    .replace(/(<summary class="langmenu__summary" aria-label=")([^"]*?) – ([^"]*">\s*<span aria-hidden="true">)\2</, "$1$3$2<");

describe("the flags are the only change to the menus (#989)", () => {
  it("has a golden for three pages, two menus each", () => {
    expect(Object.keys(GOLDEN).sort()).toEqual(["/de", "/en", "/uk"]);
    for (const k of Object.keys(GOLDEN)) expect(GOLDEN[k], k).toHaveLength(2);
  });
  for (const path of Object.keys(GOLDEN)) {
    it(`${path}: header and footer menus minus the flags equal the menus before #989`, async () => {
      const html = await (await fetch(`${BASE}${path}`)).text();
      const now = menus(html);
      expect(now, path).toHaveLength(2);
      for (const [i, m] of now.entries()) {
        expect(all(m, ".langs__flags").length, `${path} menu ${String(i)} carries flags`).toBeGreaterThan(0);
        expect(squash(withoutFlags(m)), `${path} menu ${String(i)}`).toBe(squash(GOLDEN[path]?.[i] ?? ""));
      }
    });
  }
});

describe("the sprite and the flags in the page (#989)", () => {
  for (const path of ["/de", "/en", "/uk", "/de/connect"]) {
    it(`${path}: one sprite outside every <details>, every <use> resolves, English two flags (GB, US), every other one`, async () => {
      const page = await browser.newPage();
      await gotoSettled(page, `${BASE}${path}`);
      const r = await page.evaluate(() => {
        const sprites = [...document.querySelectorAll("svg.flag-sprite")];
        const ids = new Set([...document.querySelectorAll("svg.flag-sprite symbol")].map((s) => s.id));
        const uses = [...document.querySelectorAll(".langs__flags use")].map((u) => u.getAttribute("href") ?? "");
        const perLink = [...document.querySelectorAll(".langmenu .langs a")].map((a) => ({
          hreflang: a.getAttribute("hreflang"),
          flags: [...a.querySelectorAll(".langs__flags use")].map((u) => u.getAttribute("href")),
          first: a.firstElementChild?.className,
        }));
        return {
          sprites: sprites.length,
          inDetails: sprites.filter((s) => s.closest("details") !== null).length,
          hidden: sprites.every((s) => s.getAttribute("aria-hidden") === "true"),
          unresolved: uses.filter((h) => !h.startsWith("#") || !ids.has(h.slice(1))),
          uses: uses.length,
          perLink,
        };
      });
      expect(r.sprites).toBe(1);
      expect(r.inDetails).toBe(0);
      expect(r.hidden).toBe(true);
      expect(r.unresolved).toEqual([]);
      const langs = reviewedLocales().map((l) => l.code as Lang);
      // two menus, every language once in each, English twice over
      expect(r.uses).toBe(2 * (langs.length + 1));
      expect(r.perLink).toHaveLength(2 * langs.length);
      for (const x of r.perLink) {
        const want = flagsOf(x.hreflang as Lang).map((c) => `#flag-${c}`);
        expect(x.flags, String(x.hreflang)).toEqual(want);
        expect(x.flags, String(x.hreflang)).toHaveLength(x.hreflang === "en" ? 2 : 1);
        expect(x.first, `${String(x.hreflang)}: the flag comes before the name`).toBe("langs__flags");
      }
      expect(r.perLink.find((x) => x.hreflang === "en")?.flags).toEqual(["#flag-gb", "#flag-us"]);
      await page.close();
    });
  }
});

/** The colours of three points down the middle of the German flag in `sel`, as rgb triples. */
async function germanBands(page: Page, sel: string): Promise<number[][]> {
  const el = page.locator(`${sel} a[hreflang="de"] svg.flag`);
  const box = await el.boundingBox();
  expect(box, sel).not.toBeNull();
  const png = PNG.sync.read(await el.screenshot({ animations: "disabled" }));
  const at = (fy: number): number[] => {
    const x = Math.floor(png.width / 2);
    const y = Math.floor(png.height * fy);
    const i = (png.width * y + x) * 4;
    return [png.data[i] ?? -1, png.data[i + 1] ?? -1, png.data[i + 2] ?? -1];
  };
  return [at(0.2), at(0.5), at(0.8)];
}

describe("the flags paint, in both menus and both themes (#989)", () => {
  for (const scheme of ["light", "dark"] as const) {
    for (const where of [".site-head", ".site-foot"]) {
      it(`${where} (${scheme}): the German flag is black, red, gold — the <use> reached the sprite`, async () => {
        const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme });
        const page = await ctx.newPage();
        await gotoSettled(page, `${BASE}/en`);
        await page.click(`${where} .langmenu__summary`);
        const [black, red, gold] = await germanBands(page, `${where} .langmenu__panel`);
        const near = (c: number[] | undefined, want: number[]): boolean => (c ?? []).every((v, i) => Math.abs(v - (want[i] ?? 0)) <= 24);
        expect(near(black, [0, 0, 0]), `black ${JSON.stringify(black)}`).toBe(true);
        expect(near(red, [0xdd, 0, 0]), `red ${JSON.stringify(red)}`).toBe(true);
        expect(near(gold, [0xff, 0xce, 0]), `gold ${JSON.stringify(gold)}`).toBe(true);
        await ctx.close();
      });
    }
  }
});

describe("accessibility of the open menu (#989)", () => {
  for (const scheme of ["light", "dark"] as const) {
    for (const lang of ["de", "uk"] as const) {
      it(`/${lang} (${scheme}): flags aria-hidden, accessible names unchanged, axe clean in the open menu`, async () => {
        const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, colorScheme: scheme });
        const page = await ctx.newPage();
        await gotoSettled(page, `${BASE}/${lang}`);
        await page.click(".site-head .langmenu__summary");
        const panel = page.locator(".site-head .langmenu__panel");
        expect(await panel.locator(".langs__flags:not([aria-hidden='true'])").count()).toBe(0);
        for (const l of reviewedLocales().map((x) => x.code as Lang)) {
          expect(await panel.getByRole("link", { name: labelOf(l), exact: true }).count(), l).toBe(1);
        }
        expect(await panel.getByRole("img").count()).toBe(0);
        const r = await new AxeBuilder({ page }).include(".site-head .langmenu").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
        expect(r.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
        await ctx.close();
      });
    }
  }
});

describe("no layout shift (#989)", () => {
  it(`every flag box is exactly ${String(FLAG_WIDTH)} × ${String(FLAG_HEIGHT)} plus its 1 px border`, async () => {
    const page = await browser.newPage();
    await gotoSettled(page, `${BASE}/de`);
    await page.click(".site-head .langmenu__summary");
    const sizes = await page.$$eval(".site-head .langmenu svg.flag", (s) => s.map((e) => [e.getBoundingClientRect().width, e.getBoundingClientRect().height, e.getAttribute("width"), e.getAttribute("height")]));
    expect(sizes.length).toBe(reviewedLocales().length + 1);
    for (const s of sizes) expect(s).toEqual([FLAG_WIDTH + 2, FLAG_HEIGHT + 2, String(FLAG_WIDTH), String(FLAG_HEIGHT)]);
    await page.close();
  });

  for (const lang of ["de", "en"] as const) {
    it(`/${lang}: the home shifts no layout over its first two seconds`, async () => {
      const page = await browser.newPage();
      await page.goto(`${BASE}/${lang}`, { waitUntil: "load" });
      const cls = await page.evaluate(
        () =>
          new Promise<number>((res) => {
            let v = 0;
            new PerformanceObserver((l) => {
              for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) v += e.value;
            }).observe({ type: "layout-shift", buffered: true });
            setTimeout(() => res(v), 2000);
          }),
      );
      expect(cls).toBeLessThan(0.01);
      await page.close();
    });
  }
});
