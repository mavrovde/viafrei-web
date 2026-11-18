/**
 * #1310 D1: the page-experience budget's judge, its reading of Lighthouse's audits and its two planted faults. The
 * browser run itself is `scripts/lighthouse-budget.ts` in the web leg (Linux image only).
 */
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { all, type El } from "@viafrei/design/testing";
import { describe, expect, it } from "vitest";
import { AUDITS, breakdownOf, BUDGET, BUDGET_PAGES, collectRuns, EXIT, firstLine, forwardedHeaders, forwardPath, judgeBudget, metricsOf, onlyOf, pageOf, plantAsset, plantInto, plantOf, startPlantFront, SUBSTITUTE, upstreamUrl, type Metrics, type RunOnce } from "../scripts/lighthouse-budget.js";
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

describe("the run's pieces", () => {
  it("measures the exit page in its slot and the substitute in the missing road's", () => {
    expect(pageOf(EXIT, "a7/exit-1-x")).toBe("/de/autobahn/a7/exit-1-x");
    expect(pageOf(SUBSTITUTE.from, "a7/exit-1-x")).toBe(SUBSTITUTE.to);
    expect(pageOf("/de", "a7/exit-1-x")).toBe("/de");
  });
  it("says the substitute on its first line, and the plant when there is one", () => {
    expect(firstLine(null)).toContain(`its slot is measured on ${SUBSTITUTE.to})`);
    expect(firstLine(null)).not.toContain("PLANTED");
    expect(firstLine("blocking-font")).toMatch(/PLANTED: blocking-font$/u);
  });
  it("collects RUNS complete runs, with two spare attempts for an incomplete one", async () => {
    let n = 0;
    const flaky: RunOnce = () => Promise.resolve({ metrics: n++ % 2 === 0 ? null : ok, audits: undefined });
    const r = await collectRuns("http://x/de", "/de", flaky);
    expect([r.runs.length, r.attempts]).toEqual([2, RUNS + 2]);
    const steady = await collectRuns("http://x/de", "/de", () => Promise.resolve({ metrics: { ...ok, tbtMs: 900 }, audits: undefined }));
    expect([steady.runs.length, steady.attempts]).toEqual([RUNS, RUNS]);
  });
});

describe("the plant front", () => {
  it("serves each planted asset with its type, and 404 for any other /_plant/ path", () => {
    expect(plantAsset("/_plant/hero.svg")).toMatchObject({ status: 200, type: "image/svg+xml" });
    expect(plantAsset("/_plant/font.css")).toMatchObject({ status: 200, type: "text/css" });
    expect(plantAsset("/_plant/plant.woff2")).toMatchObject({ status: 200, type: "font/woff2" });
    expect(plantAsset("/_plant/x")).toMatchObject({ status: 404, body: "" });
  });
  it("passes on only the listed headers: never a location, never a policy", () => {
    const out = forwardedHeaders({ "content-type": "text/html", location: "https://elsewhere.example/", "content-security-policy": "default-src 'self'", "set-cookie": ["a=b"], vary: "accept-language" }, 12);
    expect(out).toEqual({ "content-type": "text/html", vary: "accept-language", "content-length": "12" });
  });
  it("forwards a path to the shell only, never to another host", () => {
    expect(upstreamUrl("/de?x=1", 4000)?.toString()).toBe("http://127.0.0.1:4000/de?x=1");
    expect(upstreamUrl(undefined, 4000)?.pathname).toBe("/");
    expect(upstreamUrl("//elsewhere.example/x", 4000)).toBeNull();
    expect(upstreamUrl("http://elsewhere.example/x", 4000)).toBeNull();
    expect(upstreamUrl("http://127.0.0.1:4001/x", 4000)).toBeNull();
    expect(upstreamUrl("https://127.0.0.1:4000/x", 4000)).toBeNull();
  });
  it("forwards a path and query only as URL characters, and refuses any other", () => {
    expect(forwardPath(new URL("http://127.0.0.1:4000/de/autobahn/a46?x=1&y=%C3%BC"))).toBe("/de/autobahn/a46?x=1&y=%C3%BC");
    expect(forwardPath(new URL("http://127.0.0.1:4000/"))).toBe("/");
    expect(forwardPath({ pathname: "/a b", search: "" })).toBeNull();
    expect(forwardPath({ pathname: "/a", search: "?x=<y>" })).toBeNull();
    expect(forwardPath({ pathname: "/a\nb", search: "" })).toBeNull();
  });
  it("plants every HTML answer of the shell, passes other answers through, serves its assets, and answers 502 without a shell", async () => {
    const shell = createServer((req, res) => {
      if (req.url === "/de") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8", location: "https://elsewhere.example/" });
        res.end("<html><head></head><body><main><h1>x</h1></main></body></html>");
      } else {
        res.writeHead(200, { "content-type": "text/css" });
        res.end("a{}");
      }
    });
    await new Promise<void>((done) => shell.listen(0, "127.0.0.1", done));
    const shellPort = (shell.address() as AddressInfo).port;
    const front = await startPlantFront(0, shellPort, "unsized-image", 0);
    const base = `http://127.0.0.1:${String((front.address() as AddressInfo).port)}`;
    try {
      const page = await fetch(`${base}/de`);
      expect(page.headers.get("location")).toBeNull();
      const first = firstChildOf(await page.text(), "main");
      expect([first.tag, first.attrs.src]).toEqual(["img", "/_plant/hero.svg"]);
      expect(await (await fetch(`${base}/_a/x.css`)).text()).toBe("a{}");
      const hero = await fetch(`${base}/_plant/hero.svg`);
      expect([hero.status, hero.headers.get("content-type")]).toEqual([200, "image/svg+xml"]);
      expect((await fetch(`${base}/_plant/none`)).status).toBe(404);
    } finally {
      await new Promise<void>((done) => front.close(() => done()));
      await new Promise<void>((done) => shell.close(() => done()));
    }
    const dead = await startPlantFront(0, shellPort, "blocking-font", 0);
    try {
      expect((await fetch(`http://127.0.0.1:${String((dead.address() as AddressInfo).port)}/de`)).status).toBe(502);
    } finally {
      await new Promise<void>((done) => dead.close(() => done()));
    }
  });
});
