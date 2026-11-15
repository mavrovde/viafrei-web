/**
 * #1158 item 4: "one 'show all' / 'none' component with one style on every page", and a test that refuses a second
 * markup or style. Three halves:
 *  - the component itself: a link per option when it has a target, a button when not, the separator hidden from a
 *    screen reader, the hook beside the shared class;
 *  - no runtime file of the digest or the site shell writes a hook class in markup of its own (`class="… tpf__all"`),
 *    so every surface's all/none comes out of `allNone`;
 *  - no stylesheet names a hook class or the old wrappers, and exactly one stylesheet styles `.all-none__opt`.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ALL_NONE_HOOKS, allNone, raw } from "../src/index.js";
import { all } from "../src/testing/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function tracked(globs: readonly string[]): string[] {
  const out = execFileSync("git", ["-c", "color.ui=false", "ls-files", "--cached", "--others", "--exclude-standard", "--", ...globs], { cwd: ROOT, encoding: "utf8" });
  return out.split("\n").filter((f) => f.length > 0);
}

describe("#1158 allNone: the one all/none control", () => {
  it("links with a target, buttons without, the separator hidden, the hook beside the shared class", () => {
    const html = String(allNone({ all: { text: raw("Alle"), label: raw("Alle anzeigen"), hook: "tpf__all", href: "/de?a=1&b=2" }, none: { text: raw("Keine"), label: raw("Keine anzeigen"), hook: "tpf__none", href: "/de?f=1" } }));
    const opts = all(html, ".all-none__opt");
    expect(opts.map((o) => o.tag)).toEqual(["a", "a"]);
    expect(opts.map((o) => o.attrs["class"])).toEqual(["all-none__opt tpf__all", "all-none__opt tpf__none"]);
    expect(opts[0]?.attrs["href"]).toBe("/de?a=1&b=2");
    expect(html).toContain('href="/de?a=1&amp;b=2"');
    expect(opts.map((o) => o.attrs["aria-label"])).toEqual(["Alle anzeigen", "Keine anzeigen"]);
    const sep = all(html, ".all-none__sep");
    expect(sep).toHaveLength(1);
    expect(sep[0]?.attrs["aria-hidden"]).toBe("true");
    const btn = all(String(allNone({ all: { text: raw("Alle"), label: raw("Alle"), hook: "mwf__all" } })), ".all-none__opt");
    expect(btn.map((o) => [o.tag, o.attrs["type"]])).toEqual([["button", "button"]]);
    expect(all(String(allNone({ all: { text: raw("Alle"), label: raw("Alle"), hook: "mwf__all" } })), ".all-none__sep")).toHaveLength(0);
  });

  it("no runtime file writes an all/none hook in markup of its own — every surface goes through allNone", () => {
    const files = tracked(["packages/digest/src/**/*.ts", "packages/web/src/**/*.ts", "packages/web/src/**/*.astro", "packages/web/src/**/*.svelte", "packages/status/src/**/*.ts"]).filter((f) => !/\.test\.ts$|\/generated\//.test(f));
    expect(files.length).toBeGreaterThan(50);
    const hooks = new RegExp(`class="[^"]*\\b(?:${ALL_NONE_HOOKS.join("|")}|motorway__layeracts)\\b`);
    const found = files.filter((f) => hooks.test(readFileSync(join(ROOT, f), "utf8")));
    expect(found).toEqual([]);
    // and each surface does call it
    for (const f of ["packages/web/src/lib/topic-filter.ts", "packages/web/src/lib/motorway-filter.ts", "packages/digest/src/presentation/motorway-layers-html.ts"]) expect(readFileSync(join(ROOT, f), "utf8"), f).toMatch(/\ballNone\(/);
  });

  it("no stylesheet styles a hook, and exactly one rule set styles the shared control", () => {
    const css = tracked(["packages/*/src/**/*.css", "packages/design/*.css", "packages/*/public/**/*.css"]);
    expect(css.length).toBeGreaterThan(1);
    const hook = new RegExp(`\\.(?:${ALL_NONE_HOOKS.join("|")}|motorway__layeracts)\\b`);
    const styled: string[] = [];
    const owners: string[] = [];
    for (const f of css) {
      const text = readFileSync(join(ROOT, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      if (hook.test(text)) styled.push(f);
      if (/\.all-none__opt\s*[{,:]/.test(text)) owners.push(f);
      // the old surface-scoped styling of the links/buttons inside the bars
      if (/\.(?:tpf__acts|mwf__acts)\s+(?:a|button)\b/.test(text)) styled.push(`${f} (bar-scoped option rule)`);
    }
    expect(styled).toEqual([]);
    expect(owners).toEqual(["packages/web/src/styles/site.css"]);
  });
});
