import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { transform } from "lightningcss";
import { describe, expect, it } from "vitest";
import { ACTION_BAR_FROM_PX, ACTION_BAR_JS } from "../src/lib/action-bar.js";

const CSS_PATH = fileURLToPath(new URL("../src/styles/site.css", import.meta.url));

/** The stylesheet as the build ships it: the same minifier, so a rule it rewrites is judged as rewritten. */
const shipped = (code: string): string => transform({ filename: "site.css", code: Buffer.from(code), minify: true }).code.toString();

describe("#1174: the bottom bar's scroll timeline survives the minifier", () => {
  it("no shipped animation shorthand carries the timeline, and the timeline is declared on its own", () => {
    const css = shipped(readFileSync(CSS_PATH, "utf8"));
    // Chromium refuses `animation: linear both bar-in scroll(root)` as a whole: no animation, the bar hidden for ever
    expect(css).not.toMatch(/animation:[^;}]*scroll\(/);
    expect(css).toMatch(/\.actionbar\{[^}]*animation:[^;}]*bar-in/);
    expect(css).toMatch(/\.actionbar\{[^}]*animation-timeline:scroll\(root\)/);
    expect(css).toContain(`animation-range:${String(ACTION_BAR_FROM_PX)}px`);
  });

  it("the guard can say no: the shape that shipped before is folded into the shorthand", () => {
    const bad = shipped("@supports (animation-timeline: scroll()) { .actionbar { animation: bar-in linear both; animation-timeline: scroll(root); } }");
    expect(bad).toMatch(/animation:[^;}]*scroll\(/);
  });

  it("a person who asks for reduced motion is shown the bar from the stylesheet's start too", () => {
    const css = shipped(readFileSync(CSS_PATH, "utf8"));
    expect(css).toMatch(/@media \(prefers-reduced-motion:reduce\)\{html\[data-actionbar=on\] \.actionbar\{[^}]*opacity:1/);
  });
});

type Run = { readonly attr: string | null; readonly listened: boolean };

/** Runs the script against stubbed globals: reduced motion or not, timelines or not, a scroll position. */
function run(o: { readonly reduce: boolean; readonly timelines: boolean; readonly scrollY: number }): Run {
  let attr: string | null = null;
  let listened = false;
  const root = { scrollTop: 0, setAttribute: (_: string, v: string) => (attr = v), removeAttribute: () => (attr = null) };
  const win = { scrollY: o.scrollY, matchMedia: () => ({ matches: o.reduce }), CSS: { supports: () => o.timelines }, addEventListener: () => (listened = true) };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- the script is our own constant, run as the page runs it
  const script = new Function("window", "matchMedia", "CSS", "document", `(${ACTION_BAR_JS})();`) as (w: unknown, m: unknown, c: unknown, d: unknown) => void;
  script(win, win.matchMedia, win.CSS, { documentElement: root });
  return { attr, listened };
}

describe("#1174/#1177: the bar's script", () => {
  it("stands aside where the stylesheet's timeline does the work", () => {
    expect(run({ reduce: false, timelines: true, scrollY: 900 })).toEqual({ attr: null, listened: false });
  });
  it("shows the bar from the same 520 px where timelines are missing", () => {
    expect(run({ reduce: false, timelines: false, scrollY: ACTION_BAR_FROM_PX })).toEqual({ attr: "on", listened: true });
    expect(run({ reduce: false, timelines: false, scrollY: ACTION_BAR_FROM_PX - 1 })).toEqual({ attr: null, listened: true });
  });
  it("runs under reduced motion although the browser has timelines (the animation is taken away there)", () => {
    expect(run({ reduce: true, timelines: true, scrollY: 900 })).toEqual({ attr: "on", listened: true });
    expect(run({ reduce: true, timelines: true, scrollY: 0 })).toEqual({ attr: null, listened: true });
  });
});
