/**
 * #1051 — the root cause, held: `motorway-page.css` is inline in the page's head slot, and Astro appends the shared
 * site.css <link> AFTER that slot (`Base.astro` renders the slot, then `renderHead()`), so at equal specificity the shared
 * sheet wins. `.pcard` (site.css) beat `.mwk--fold` and `.mwk--compact`, and the quiet line's chips came out as framed
 * cards inside framed pills.
 *
 * The rule this test holds: every rule of `motorway-page.css` that sets a property a site.css single-class rule also
 * sets ON THE SAME ELEMENT out-specifies that shared rule (more than one class) — the page scopes such a rule under its
 * container (`.motorway-page`) to get there — so it wins whatever the order. "The same element" is read from the real digest's rendered motorway fragments (every class list an
 * element there carries), never from a hand-kept list; and no `!important` anywhere. A test that found no such pair
 * would prove nothing, so the pairs it judged are counted and asserted present.
 */
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startRealDigest } from "../e2e/real-digest.js";

const PAGE_CSS = new URL("../src/styles/motorway-page.css", import.meta.url);
const SITE_CSS = new URL("../src/styles/site.css", import.meta.url);

type Rule = { readonly selectors: readonly string[]; readonly props: ReadonlySet<string> };

/** The style rules of a sheet (comments stripped; an at-rule's header is not a selector). */
export function rulesOf(css: string): Rule[] {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map((m) => ({
      selectors: m[1]!.split(",").map((x) => x.trim()).filter((x) => x !== "" && !x.startsWith("@")),
      props: new Set(m[2]!.split(";").map((d) => d.split(":")[0]!.trim()).filter((p) => p !== "")),
    }))
    .filter((r) => r.selectors.length > 0);
}

/** The classes of a selector's subject (its last compound, pseudo-classes, attributes and pseudo-elements left out). */
export function subjectClasses(selector: string): string[] {
  const last = selector.split(/\s*[>+~]\s*|\s+/).filter((x) => x !== "").at(-1) ?? "";
  return [...last.replace(/\[[^\]]*\]/g, "").replace(/::?[a-z-]+(\([^)]*\))?/g, "").matchAll(/\.([A-Za-z0-9_-]+)/g)].map((m) => m[1]!);
}

/** The site.css properties set by a rule whose selector is that ONE class (`.pcard { … }`). */
function sharedSingleClass(css: string): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const r of rulesOf(css))
    for (const s of r.selectors) {
      const m = /^\.([A-Za-z0-9_-]+)$/.exec(s);
      if (m === null) continue;
      const had = out.get(m[1]!) ?? new Set<string>();
      for (const p of r.props) had.add(p);
      out.set(m[1]!, had);
    }
  return out;
}

/**
 * A selector's specificity as `[ids, classes, elements]` — classes counting attributes and pseudo-classes, the
 * functional `:has()`/`:not()`/`:is()` counted by their arguments and `:where()` by nothing (Selectors 4).
 */
export function specificity(selector: string): readonly [number, number, number] {
  const s = selector.replace(/:where\([^)]*\)/g, "").replace(/:(?:has|not|is)\(/g, "(");
  const ids = (s.match(/#[A-Za-z0-9_-]+/g) ?? []).length;
  const classes = (s.match(/\.[A-Za-z0-9_-]+/g) ?? []).length + (s.match(/\[[^\]]*\]/g) ?? []).length + (s.match(/(?<!:):[a-z-]+/g) ?? []).length;
  const elements = (s.replace(/\[[^\]]*\]/g, "").match(/(?:^|[\s>+~(])[a-z][a-z0-9-]*/g) ?? []).length + (s.match(/::[a-z-]+/g) ?? []).length;
  return [ids, classes, elements];
}
/** Whether a selector beats a single class (`.pcard`, 0-1-0) whatever the sheets' order. */
const beatsOneClass = (sel: string): boolean => {
  const [i, c] = specificity(sel);
  return i > 0 || c > 1;
};

/** Every class list an element of the fragments carries. */
const classLists = (html: string): string[][] => [...html.matchAll(/\sclass="([^"]+)"/g)].map((m) => m[1]!.split(/\s+/));

/**
 * The rules that override a shared single-class rule on the same element and do NOT out-specify it: `selector vs
 * .shared (properties both set)`. `pairs` counts every (rule, shared class) pair judged, winning or not.
 */
export function unscopedOverrides(pageCss: string, siteCss: string, html: string): { readonly bad: string[]; readonly pairs: number } {
  const shared = sharedSingleClass(siteCss);
  const lists = classLists(html);
  const bad: string[] = [];
  let pairs = 0;
  for (const r of rulesOf(pageCss))
    for (const sel of r.selectors) {
      const subject = subjectClasses(sel);
      if (subject.length === 0) continue;
      const others = new Set(lists.filter((l) => subject.every((c) => l.includes(c))).flatMap((l) => l.filter((c) => !subject.includes(c))));
      for (const o of others) {
        const both = [...(shared.get(o) ?? [])].filter((p) => r.props.has(p));
        if (both.length === 0) continue;
        pairs++;
        if (!beatsOneClass(sel)) bad.push(`${sel} vs .${o} (${both.join(", ")})`);
      }
    }
  return { bad, pairs };
}

let digest: Awaited<ReturnType<typeof startRealDigest>>;
let html = "";
beforeAll(async () => {
  digest = await startRealDigest();
  for (const path of ["/internal/motorway/A7?lang=de", "/internal/motorway/A9?lang=de", "/internal/motorway/A10?lang=de", "/internal/motorway/A61?lang=de", "/internal/motorway/A7?lang=en"]) html += await (await fetch(`${digest.url}${path}`)).text();
}, 60_000);
afterAll(async () => {
  await digest.close();
});

describe("#1051: the motorway page's rules win over the shared sheet by scope, not by order", () => {
  const pageCss = readFileSync(PAGE_CSS, "utf8");
  const siteCss = readFileSync(SITE_CSS, "utf8");

  it("the fragments were read, and carry the quiet line and the reference block (the A9's border crossing; the pairs this judges)", () => {
    expect(html).toContain('id="mw-quiet"');
    expect(html).toContain("mwk--compact");
  });

  it("every override of a shared rule on the same element out-specifies it — and pairs were judged", () => {
    const r = unscopedOverrides(pageCss, siteCss, html);
    expect(r.bad).toEqual([]);
    // at least the reference block (.mwk--compact on .pcard) and the panel head (.mwk__head on .pcard__head)
    expect(r.pairs).toBeGreaterThanOrEqual(2);
  });

  it("the judge says no: the reference block's frame unscoped is named", () => {
    const planted = pageCss.replace(".motorway-page .mwk--compact {", ".mwk--compact {");
    expect(planted).not.toBe(pageCss);
    expect(unscopedOverrides(planted, siteCss, html).bad.some((b) => b.startsWith(".mwk--compact vs .pcard"))).toBe(true);
  });

  it("a chip of the quiet line carries no .pcard (a chip, not a card), and nothing here is !important", () => {
    const chips = [...html.matchAll(/<details class="([^"]*mwk-chip[^"]*)"/g)].map((m) => m[1]!);
    expect(chips.length).toBeGreaterThan(0);
    for (const c of chips) expect(c.split(/\s+/)).not.toContain("pcard");
    // the one `!important` of the sheet is #901's (a filter chip re-showing the person's own row), not an override of site.css
    expect([...pageCss.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/[^;{}]*!important/g)].map((m) => m[0].trim())).toEqual(["display: list-item !important"]);
  });

  it("the header says why (Base.astro's head slot, then Astro's renderHead()), so the next rule is scoped too", () => {
    const head = pageCss.slice(0, pageCss.indexOf("*/"));
    expect(head).toContain("Base.astro");
    expect(head).toContain("renderHead()");
    expect(head).toContain(".motorway-page");
  });

  it("the parser reads the shapes it relies on", () => {
    expect(subjectClasses(".motorway-page .mwk-chip + .mwk-chip > summary::before")).toEqual([]);
    expect(subjectClasses(".motorway-page .mwk-chip[open]")).toEqual(["mwk-chip"]);
    expect(subjectClasses(".a .b.c:has(.d)")).toEqual(["b", "c"]);
    expect(specificity(".motorway-page .mwk--compact")).toEqual([0, 2, 0]);
    expect(specificity(".mwk[hidden]")).toEqual([0, 2, 0]);
    expect(specificity(".mwk--compact")).toEqual([0, 1, 0]);
    expect(specificity("#motorway-main summary::before")).toEqual([1, 0, 2]);
    expect(specificity(".a:has(.b) li")).toEqual([0, 2, 1]);
    expect(rulesOf("/* x { y } */ @media (min-width: 1px) { .a { color: red; } } .b, .c { margin: 0 }").map((r) => r.selectors)).toEqual([[".a"], [".b", ".c"]]);
  });
});
