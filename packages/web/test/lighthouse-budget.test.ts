/**
 * #1310 D1: the page-experience budget's judge, its reading of Lighthouse's audits and its two planted faults. The
 * browser run itself is `scripts/lighthouse-budget.ts` in the web leg (Linux image only).
 */
import { all, type El } from "@viafrei/design/testing";
import { describe, expect, it } from "vitest";
import { AUDITS, breakdownOf, BUDGET, BUDGET_PAGES, EXIT, judgeBudget, metricsOf, onlyOf, plantInto, plantOf, SUBSTITUTE, type Metrics } from "../scripts/lighthouse-budget.js";
import { RUNS } from "../scripts/lighthouse.js";

const ok: Metrics = { lcpMs: 1_800, cls: 0.02, tbtMs: 90 };
const three = (m: Metrics): Metrics[] => Array.from({ length: RUNS }, () => m);
const page = (runs: Metrics[], status = 200) => ({ status, runs });

describe("the budget (#1310 D1)", () => {
  it("is the issue's: LCP 2.5 s, CLS 0.1, TBT 200 ms, on the issue's six pages", () => {
    expect(BUDGET).toEqual({ lcpMs: 2_500, cls: 0.1, tbtMs: 200 });
    expect(BUDGET_PAGES).toEqual(["/de", "/de/autobahn", "/de/autobahn/a7", "/de/autobahn/a24", "/de/place/hamburg", EXIT]);
    expect(SUBSTITUTE.from).toBe("/de/autobahn/a24");
  });
  it("passes when every median is within, at the edge included", () => {
    const v = judgeBudget(new Map([["/de", page(three(ok))], ["/de/autobahn", page(three({ lcpMs: 2_500, cls: 0.1, tbtMs: 200 }))]]));
    expect(v.code).toBe(0);
    expect(v.lines.at(-1)).toMatch(/^✓ page budget: 2 page\(s\)/u);
  });
  for (const [m, over] of [["lcpMs", 2_501], ["cls", 0.101], ["tbtMs", 201]] as const) {
    it(`is red on a ${m} median one step over, naming the page and the audit`, () => {
      const v = judgeBudget(new Map([["/de", page(three(ok))], ["/de/autobahn/a7", page(three({ ...ok, [m]: over }))]]));
      expect(v.code).toBe(1);
      expect(v.lines.find((l) => l.includes("/de/autobahn/a7"))).toContain(`✗ ${AUDITS[m]}`);
      expect(v.lines.find((l) => l.trim().startsWith("/de "))).not.toContain("✗");
    });
  }
  it("judges the median, not the worst run", () => {
    expect(judgeBudget(new Map([["/de", page([ok, { ...ok, cls: 0.4 }, ok])]])).code).toBe(0);
    expect(judgeBudget(new Map([["/de", page([ok, { ...ok, cls: 0.4 }, { ...ok, cls: 0.3 }])]])).code).toBe(1);
  });
  it("could not check: nothing measured, a page not 200, fewer runs than asked", () => {
    expect(judgeBudget(new Map()).code).toBe(2);
    const notServed = judgeBudget(new Map([["/de/autobahn/a24", page([], 404)]]));
    expect(notServed.code).toBe(2);
    expect(notServed.lines[0]).toContain("answered 404");
    expect(judgeBudget(new Map([["/de", page([ok, ok])]])).code).toBe(2);
  });
});

describe("the audits it reads", () => {
  const audits = { "largest-contentful-paint": { numericValue: 1_234 }, "cumulative-layout-shift": { numericValue: 0.05 }, "total-blocking-time": { numericValue: 12 } };
  it("reads the three numeric values", () => {
    expect(metricsOf(audits)).toEqual({ lcpMs: 1_234, cls: 0.05, tbtMs: 12 });
  });
  it("a run missing one, or carrying no number, is no run", () => {
    expect(metricsOf(undefined)).toBeNull();
    expect(metricsOf({ ...audits, "total-blocking-time": undefined })).toBeNull();
    expect(metricsOf({ ...audits, "cumulative-layout-shift": {} })).toBeNull();
    expect(metricsOf({ ...audits, "largest-contentful-paint": { numericValue: Number.NaN } })).toBeNull();
  });
});

/** The first element child of the one element the selector names. */
function firstChildOf(html: string, selector: string): El {
  const [el] = all(html, selector);
  const first = el?.children.find((n): n is El => "tag" in n);
  if (first === undefined) throw new Error(`${selector} has no element child`);
  return first;
}

describe("the planted faults", () => {
  const html = '<!doctype html><html><head><meta charset="utf-8"></head><body><main id="main" class="x"><h1>A7</h1></main></body></html>';
  it("an unsized image at the top of main: no width, no height", () => {
    const first = firstChildOf(plantInto(html, "unsized-image"), "main#main");
    expect([first.tag, first.attrs.src]).toEqual(["img", "/_plant/hero.svg"]);
    expect(Object.keys(first.attrs).filter((k) => k === "width" || k === "height")).toEqual([]);
  });
  it("a render-blocking font stylesheet first in head", () => {
    const first = firstChildOf(plantInto(html, "blocking-font"), "head");
    expect([first.tag, first.attrs.rel, first.attrs.href]).toEqual(["link", "stylesheet", "/_plant/font.css"]);
  });
  it("--plant takes a known name only", () => {
    expect(plantOf([])).toBeNull();
    expect(plantOf(["--plant", "blocking-font"])).toBe("blocking-font");
    expect(() => plantOf(["--plant", "slow"])).toThrow(/--plant takes one of/u);
    expect(() => plantOf(["--plant"])).toThrow();
  });
});

describe("the diagnostics and the focused re-run", () => {
  it("names the main thread's three largest groups and the two heaviest scripts, without the origin", () => {
    const audits = {
      "mainthread-work-breakdown": { details: { items: [{ group: "styleLayout", groupLabel: "Style & Layout", duration: 788.4 }, { group: "other", duration: 416 }, { groupLabel: "Script Evaluation", duration: 316 }, { groupLabel: "Paint", duration: 9 }] } },
      "bootup-time": { details: { items: [{ url: "http://127.0.0.1:18970/de/autobahn/a7", scripting: 300.2 }, { url: "Unattributable", total: 6 }, { url: "x", total: 1 }] } },
    };
    expect(breakdownOf(audits)).toBe("main thread: Style & Layout 788 ms, other 416 ms, Script Evaluation 316 ms; scripts: /de/autobahn/a7 300 ms, Unattributable 6 ms");
    expect(breakdownOf(undefined)).toBe("main thread: no breakdown; scripts: none");
  });
  it("--only collects every path it is given, and nothing without it", () => {
    expect(onlyOf([])).toEqual([]);
    expect(onlyOf(["--only", "/de", "--plant", "blocking-font", "--only", "/de/place/hamburg"])).toEqual(["/de", "/de/place/hamburg"]);
  });
});
