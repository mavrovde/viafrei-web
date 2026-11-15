/**
 * Accessibility of every page of the map in every live language (#381 item 6),
 * against the BUILT shell with tiles from the stub digest:
 *   - axe-core (WCAG 2.0/2.1/2.2 A and AA) reports zero `serious` or `critical`
 *     violations, in light AND dark colour scheme;
 *   - the keyboard path reaches the skip link, the header and the language list,
 *     and every focused element shows a visible focus indicator;
 *   - every interactive control is at least 44 × 44 px (the design token
 *     `--target`), inline text links excepted (WCAG 2.5.8 exception).
 * A run that audited no page is a failure, not a pass (§5b).
 */
import type { ChildProcess } from "node:child_process";
import { AxeBuilder } from "@axe-core/playwright";
import type { NodeResult, Result } from "axe-core";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HOME_REFRESH_CONTENT, LIVE_LANGS, PAGES, pathFor } from "../src/site/pages.js";
import { searchPath } from "../src/site/search.js";
import { startShell } from "./server.js";
import { startStubDigest } from "./stub-digest.js";

const PORT = 8801;
let shell: ChildProcess;
let stub: Awaited<ReturnType<typeof startStubDigest>>;
let browser: Browser;
const audited: string[] = [];
const paths = PAGES.flatMap((p) => LIVE_LANGS.map((l) => pathFor(p.id, l)));

beforeAll(async () => {
  stub = await startStubDigest({});
  shell = await startShell(PORT, {
    DIGEST_URL: stub.url,
    IMPRESSUM_NAME: "A11y Probe",
    IMPRESSUM_STREET: "Probeweg 4",
    IMPRESSUM_CITY: "00000 Probe",
    IMPRESSUM_EMAIL: "a11y@example.invalid",
  });
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await stub?.close();
});

describe("axe: zero serious or critical violations (#381)", () => {
  for (const scheme of ["light", "dark"] as const) {
    for (const path of paths) {
      it(`${path} (${scheme})`, async () => {
        const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, colorScheme: scheme });
        const page = await ctx.newPage();
        await page.goto(`http://127.0.0.1:${PORT}${path}`, { waitUntil: "networkidle" });
        const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
        // The ONE exception, owner decision 2026-10-03 (D3 amended): the home
        // reloads every HOME_REFRESH_S seconds. It is excepted on the home only
        // and only while the page's refresh is exactly that value.
        const home = LIVE_LANGS.some((l) => path === pathFor("start", l));
        // `$` and not `getAttribute(selector)`: the latter WAITS up to 30 s for an
        // element that is absent on every page but the home (measured: 98 × 30 s).
        const refresh = (await (await page.$('meta[http-equiv="refresh"]'))?.getAttribute("content")) ?? null;
        if (home) expect(refresh, `${path}: the excepted refresh drifted`).toBe(HOME_REFRESH_CONTENT);
        const bad = r.violations
          .filter((v: Result) => v.impact === "serious" || v.impact === "critical")
          .filter((v: Result) => !(home && v.id === "meta-refresh" && refresh === HOME_REFRESH_CONTENT))
          .map((v: Result) => `${v.id} (${v.impact}): ${v.nodes.map((n: NodeResult) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
        expect(bad, path).toEqual([]);
        audited.push(`${path}:${scheme}`);
        await ctx.close();
      });
    }
  }
  it("audited every page in both schemes — not nothing", () => {
    expect(audited).toHaveLength(paths.length * 2);
    expect(audited.length).toBeGreaterThanOrEqual(28);
  });
});

describe("keyboard and targets", () => {
  for (const path of ["/de", "/en/connect", "/impressum"]) {
    it(`${path}: Tab reaches the skip link first, then the header and the language menu, focus always visible`, async () => {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.goto(`http://127.0.0.1:${PORT}${path}`);
      const seen: string[] = [];
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press("Tab");
        const f = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el) return null;
          const cs = getComputedStyle(el);
          const ring = (cs.outlineStyle !== "none" && Number.parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== "none";
          return { cls: el.className, text: (el.textContent ?? "").trim().slice(0, 30), lang: el.getAttribute("hreflang"), ring };
        });
        if (!f) continue;
        expect(f.ring, `${path} focus #${i + 1} (${f.text}) has no visible focus`).toBe(true);
        seen.push(f.lang ? `lang:${f.lang}` : f.cls || f.text);
      }
      expect(seen[0]).toBe("skip");
      expect(seen.some((s) => s.startsWith("brand"))).toBe(true);
      // the header carries the language MENU (#235: seven names do not fit); its summary is in the tab path
      expect(seen.some((s) => s.startsWith("langmenu__summary"))).toBe(true);
      await page.close();
    });
  }

  // one test per page: one loop over every page under a single budget outgrew it as the page map grew (2.5.2 night round)
  // the search page is no page of the map, and its own submit button was the 36 px one the map could not see
  const targets = [...paths, searchPath("de")];
  const measured: string[] = [];
  for (const path of targets) {
    it(`${path}: every button and every link styled as a control is at least 44 × 44 px`, async () => {
      const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
      await page.goto(`http://127.0.0.1:${PORT}${path}`);
      const found = await page.$$eval(".btn:not(.btn--sm), button, summary, .langs a", (els) =>
        els
          .filter((e) => (e as HTMLElement).offsetParent !== null)
          .map((e) => ({ t: (e.textContent ?? "").trim().slice(0, 24), r: e.getBoundingClientRect() }))
          .filter((x) => x.r.height < 44 - 0.5)
          .map((x) => `${x.t} ${Math.round(x.r.width)}×${Math.round(x.r.height)}`),
      );
      await page.close();
      expect(found, path).toEqual([]);
      measured.push(path);
    });
  }
  it("measured the targets of every page — not nothing", () => {
    expect(measured).toHaveLength(targets.length);
    expect(measured.length).toBeGreaterThanOrEqual(14);
  });
});
