/**
 * #1182 AC 2: every page type opens the #1173 way — the H1 through `PageHead` (the object's name, then the first block
 * when the page holds live data, then the page's own slot) — and the legal pages carry the shared header, footer and
 * compact place bar only (`Base`). One assertion over the page map AND over every route under `src/pages/[lang]`, so
 * a page added to `pages.ts` or a route added beside them is judged without a second edit.
 *
 * The judge is a function so its mutants are plain inputs: a planted page id with no route, and a planted layout that
 * writes its own `<h1>` without `PageHead`, must each be a finding (both killed below).
 *
 * Exempt, each with its reason (and an exemption that matches no route is itself a finding, so it cannot go stale):
 *  - `Home.astro`: the home's head is the place bar and the place cards of #1176, its own first screen by design;
 *  - `NotFound.astro`: the 404 picks one of two headings by what was asked, and holds no live data.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PAGES } from "../src/site/pages.js";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));
const ROUTES = join(SRC, "pages", "[lang]");
const LAYOUTS = join(SRC, "layouts");

const EXEMPT: Readonly<Record<string, string>> = {
  "Home.astro": "the home's first screen is the place bar and its cards (#1176)",
  "NotFound.astro": "two alternative headings by what was asked, no live data",
};
/** The legal pages: header, footer and compact place bar only — Base, and no page head of their own (#1182). */
const LEGAL_LAYOUT = "Legal.astro";

type Source = { readonly name: string; readonly text: string };
type Route = { readonly file: string; readonly text: string };

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".astro") ? [p] : [];
  });

/** The layouts a route renders, by its imports (`…/layouts/X.astro`). */
const layoutsOf = (text: string): string[] => [...text.matchAll(/from "(?:\.\.\/)+layouts\/([A-Za-z]+\.astro)"/g)].map((m) => m[1]!);

/** One file's verdict: it opens with PageHead and writes no bare `<h1` of its own. */
function headFinding(where: string, text: string): string | null {
  const body = text.replace(/^---[\s\S]*?\n---/u, "").replace(/\{\/\*[\s\S]*?\*\/\}/gu, "");
  if (!body.includes("<PageHead")) return `${where}: no PageHead`;
  if (/<h1[\s>]/u.test(body)) return `${where}: an <h1> of its own beside PageHead`;
  return null;
}

/** Every finding over a page map, its routes and the layouts they render. */
export function pageTypeFindings(pages: readonly { readonly id: string; readonly slug: string; readonly legal: boolean }[], routes: readonly Route[], layouts: readonly Source[]): string[] {
  const out: string[] = [];
  const byName = new Map(layouts.map((l) => [l.name, l.text]));
  const used = new Set<string>();
  for (const p of pages) {
    const file = `${p.slug === "" ? "/index" : p.slug}.astro`.slice(1);
    const route = routes.find((r) => r.file === file);
    if (route === undefined) {
      out.push(`page ${p.id}: no route ${file}`);
      continue;
    }
    if (p.legal && !layoutsOf(route.text).includes(LEGAL_LAYOUT)) out.push(`page ${p.id}: a legal page not on ${LEGAL_LAYOUT}`);
  }
  for (const r of routes) {
    const ls = layoutsOf(r.text).filter((l) => l !== "Base.astro");
    if (ls.length === 0) {
      // a route rendering Base itself (the stop page) is judged as its own layout
      const f = headFinding(r.file, r.text);
      if (f !== null) out.push(f);
      continue;
    }
    for (const l of ls) {
      used.add(l);
      if (l === LEGAL_LAYOUT || EXEMPT[l] !== undefined) continue;
      const text = byName.get(l);
      if (text === undefined) {
        out.push(`${r.file}: layout ${l} not found`);
        continue;
      }
      const f = headFinding(l, text);
      if (f !== null) out.push(f);
    }
  }
  for (const e of Object.keys(EXEMPT)) if (!used.has(e)) out.push(`exemption ${e} matches no route`);
  return [...new Set(out)];
}

const routes: Route[] = walk(ROUTES).map((p) => ({ file: relative(ROUTES, p), text: readFileSync(p, "utf8") }));
const layouts: Source[] = readdirSync(LAYOUTS)
  .filter((n) => n.endsWith(".astro"))
  .map((n) => ({ name: n, text: readFileSync(join(LAYOUTS, n), "utf8") }));

describe("every page type opens with PageHead (#1182 AC 2)", () => {
  it("reads the tree it judges", () => {
    // the page map, every dynamic route (place, motorway and exit, road, state, station, stop, charging, fuel station)
    expect(routes.length).toBeGreaterThanOrEqual(20);
    expect(PAGES.length).toBeGreaterThanOrEqual(10);
    for (const f of ["state/[slug].astro", "states.astro", "road/[...rest].astro", "autobahn/[road]/[...rest].astro", "autobahn.astro", "station.astro", "station/[slug]/stop/[stop].astro", "fuel.astro", "business.astro", "developers.astro", "examples.astro", "impressum.astro"]) {
      expect(routes.map((r) => r.file), f).toContain(f);
    }
  });

  it("the page map and every route: no finding", () => {
    expect(pageTypeFindings(PAGES, routes, layouts)).toEqual([]);
  });

  it("mutant: a planted page type with no route is a finding", () => {
    const planted = [...PAGES, { id: "planted", slug: "/planted", legal: false }];
    expect(pageTypeFindings(planted, routes, layouts)).toEqual(["page planted: no route planted.astro"]);
  });

  it("mutant: a planted page type whose layout writes its own <h1> is a finding", () => {
    const plantedRoute: Route = { file: "planted.astro", text: '---\nimport Planted from "../layouts/Planted.astro";\n---\n<Planted />' };
    const plantedLayout: Source = { name: "Planted.astro", text: '---\nimport Base from "./Base.astro";\n---\n<Base><section class="wrap"><h1>Planted</h1></section></Base>' };
    const planted = [...PAGES, { id: "planted", slug: "/planted", legal: false }];
    expect(pageTypeFindings(planted, [...routes, plantedRoute], [...layouts, plantedLayout])).toEqual(["Planted.astro: no PageHead"]);
    const both: Source = { name: "Planted.astro", text: '---\n---\n<PageHead h1="x" /><h1>Again</h1>' };
    expect(pageTypeFindings(planted, [...routes, plantedRoute], [...layouts, both])).toEqual(["Planted.astro: an <h1> of its own beside PageHead"]);
  });

  it("mutant: a legal page moved off Legal, and an exemption matching nothing, are findings", () => {
    const moved = routes.map((r) => (r.file === "impressum.astro" ? { ...r, text: r.text.replace("layouts/Legal.astro", "layouts/ExamplesPage.astro") } : r));
    expect(pageTypeFindings(PAGES, moved, layouts)).toContain("page impressum: a legal page not on Legal.astro");
    const noHome = routes.filter((r) => r.file !== "index.astro");
    expect(pageTypeFindings(PAGES, noHome, layouts)).toContain("exemption Home.astro matches no route");
  });
});
