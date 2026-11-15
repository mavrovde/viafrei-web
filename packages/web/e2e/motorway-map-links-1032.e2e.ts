/**
 * #1032, the map's shields as links — the component half, in EVERY site language (the page-level suite,
 * `motorway-related-1032.e2e.ts`, walks the German page end to end). The zoomed map the digest renders for a page with a
 * crossing, a spur and a bridged interruption is set into a bare document with the site's own two stylesheets
 * (`packages/design/tokens.css`, `packages/web/src/styles/site.css`) and judged in the browser:
 *  - every shield is an SVG link the accessibility tree names as a link, in this language, and its href is the one the
 *    crossings card links (`shieldLinksOf`, the cards' list);
 *  - Tab reaches each one in order, and the focused one is drawn with a wider ring than the others;
 *  - axe (WCAG 2.2 AA tags) finds no violation of any impact, in the light and the dark scheme.
 * No shell, no digest server, no network: the markup is the digest's renderer called here.
 */
import { readFileSync } from "node:fs";
import { AxeBuilder } from "@axe-core/playwright";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Crossing } from "../../digest/src/analysis/motorway-crossings.js";
import type { RelatedShown } from "../../digest/src/analysis/motorway-related.js";
import { aroundOf } from "../../digest/src/analysis/motorway-around.js";
import { AROUND_JUNCTIONS, NOW, page as supportPage } from "../../digest/src/analysis/motorway-around.test.support.js";
import { resetMotorwayPages, setMotorwayPages } from "../../digest/src/cards/shared/shield.js";
import { TILE_LANGS, type TileLang } from "../../digest/src/presentation/i18n.js";
import type { MapContext, Pt } from "../../digest/src/presentation/map-context.js";
import { renderMotorwayAround, shieldLinksOf, type AroundView } from "../../digest/src/presentation/motorway-around-html.js";
import { crossingHref } from "../../digest/src/presentation/motorway-crossings-html.js";
import { frameOf } from "../../digest/src/presentation/motorway-map.js";

const CSS = ["../../design/tokens.css", "../src/styles/site.css"].map((f) => readFileSync(new URL(f, import.meta.url), "utf8")).join("\n");

const P = supportPage();
const AK = AROUND_JUNCTIONS.findIndex((j) => j.type === "AK");
const CROSSING: Crossing = {
  j: AK,
  junction: AROUND_JUNCTIONS[AK]!,
  km: null,
  others: [{ road: "A44", at: { lcd: 44_010, no: "12", name: "Kreuz Mitte" }, segment: "exit-12-kreuz-mitte", lamp: { lamp: "red", asOf: NOW } }],
};
const SJ = 7;
const SPUR: RelatedShown = {
  kind: "spur",
  road: "A255",
  here: { lcd: AROUND_JUNCTIONS[SJ]!.lcd, type: "AS", no: AROUND_JUNCTIONS[SJ]!.no, name: AROUND_JUNCTIONS[SJ]!.name },
  there: { lcd: 255_001, type: "AS", no: "1", name: "Anfang" },
  gap: null,
  metres: 400,
  beyondCrossing: false,
  j: SJ,
  segment: "exit-1-anfang",
  lamp: { lamp: "green", asOf: NOW },
};
/** A bridged interruption at the support road's seventh junction (51.35° N, inside the frame), its lamp never read. */
const BJ = 6;
const BRIDGE: RelatedShown = {
  ...SPUR,
  kind: "bridge",
  road: "A3",
  here: { ...SPUR.here!, lcd: AROUND_JUNCTIONS[BJ]!.lcd, name: AROUND_JUNCTIONS[BJ]!.name },
  gap: [SPUR.here!, { ...SPUR.here!, lcd: 1, name: "Ort 5" }],
  j: BJ,
  segment: "exit-2-bruecke",
  lamp: { lamp: "grey", asOf: null },
};
const line = (lat0: number, lon0: number, dLat: number, dLon: number, n: number): Pt[] => Array.from({ length: n }, (_, i) => frameOf(lat0 + i * dLat, lon0 + i * dLon));
const CTX: MapContext = {
  towns: [],
  network: new Map<string, readonly (readonly Pt[])[]>([
    ["A44", [line(51.5, 9.2, 0, 0.02, 31)]],
    ["A99", [line(51.3, 9.3, 0.01, 0.01, 30)]],
  ]),
};
const AT = { lat: 51.5, lon: 9.5 };
const VIEW: AroundView = { how: "browser", at: AT, radius: { km: 25, fallback: false }, other: null, context: CTX, crossings: [CROSSING], related: [SPUR, BRIDGE] };

/** The digest's zoomed map of one language, alone in a document carrying the site's styles. */
function documentOf(lang: TileLang): { readonly html: string; readonly links: ReturnType<typeof shieldLinksOf> } {
  const around = renderMotorwayAround(lang, P, aroundOf({ page: P, at: AT, radiusKm: 25, charging: [] }), VIEW);
  const svg = /<svg class="motorway__svg mwa__svg"[\s\S]*?<\/svg>/u.exec(around)?.[0];
  if (svg === undefined) throw new Error(`${lang}: the around block drew no map`);
  return {
    html: `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${P.road}</title><style>${CSS}</style></head><body><main><h1>${P.road}</h1><div class="mwa">${svg}</div></main></body></html>`,
    links: shieldLinksOf(lang, P, VIEW),
  };
}

let browser: Browser;
beforeAll(async () => {
  setMotorwayPages(["A3", "A7", "A44", "A255", "A99"]);
  browser = await chromium.launch();
});
afterAll(async () => {
  resetMotorwayPages();
  await browser?.close();
});

async function opened(lang: TileLang, scheme: "light" | "dark"): Promise<{ readonly ctx: BrowserContext; readonly page: Page; readonly links: ReturnType<typeof shieldLinksOf> }> {
  const { html, links } = documentOf(lang);
  // a context of its own: axe injects into the context's pages
  const ctx = await browser.newContext({ colorScheme: scheme, viewport: { width: 1000, height: 900 } });
  const page = await ctx.newPage();
  await page.setContent(html, { waitUntil: "load" });
  return { ctx, page, links };
}

describe("#1032: the map's shields are links, in every language", () => {
  it("the planted world has a shield for the Kreuz, the spur and the bridge, each linking where the card links", () => {
    const ls = shieldLinksOf("de", P, VIEW);
    expect(ls.map((l) => l.href)).toEqual([crossingHref("de", "A44", "exit-12-kreuz-mitte"), crossingHref("de", "A255", "exit-1-anfang"), crossingHref("de", "A3", "exit-2-bruecke")]);
  });

  it.each(TILE_LANGS.map((l) => [l]))("%s: named links, the card's hrefs, Tab walks them with a visible ring, axe clean in both schemes", async (lang: TileLang) => {
    for (const scheme of ["light", "dark"] as const) {
      const { ctx, page, links } = await opened(lang, scheme);
      try {
        // the accessibility tree: one link per linked shield of the cards' list at a Kreuz or a related contact, named in
        // this language — the same name and href the digest gave it
        const tree = await page.$$eval("svg.mwa__svg .mwc-links a", (as) => as.map((a) => ({ href: a.getAttribute("href") ?? "", name: a.getAttribute("aria-label") ?? "" })));
        for (const l of links) expect(tree, `${lang} ${l.road}`).toContainEqual({ href: l.href, name: l.label });
        for (const l of links) await expect(page.getByRole("link", { name: l.label, exact: true }).count(), `${lang} ${l.road}`).resolves.toBe(1);
        for (const t of tree) expect(t.name.trim(), `${lang} ${t.href}`).not.toBe("");
        if (lang !== "de") expect(links.map((l) => l.label), lang).not.toEqual(shieldLinksOf("de", P, VIEW).map((l) => l.label));
        if (scheme === "light") {
          // Tab from the heading walks every shield in document order
          await page.locator("h1").focus();
          await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
          const reached: string[] = [];
          for (let i = 0; i < tree.length; i += 1) {
            await page.keyboard.press("Tab");
            reached.push(await page.evaluate(() => document.activeElement?.getAttribute("href") ?? "outside"));
          }
          expect(reached, lang).toEqual(tree.map((t) => t.href));
          const ring = await page.evaluate(() => {
            const a = document.activeElement?.querySelector("rect");
            const b = document.querySelector(".mwc-links a:not(:focus) rect");
            return a && b ? [parseFloat(getComputedStyle(a).strokeWidth), parseFloat(getComputedStyle(b).strokeWidth)] : null;
          });
          expect(ring, lang).not.toBeNull();
          expect(ring![0]!, lang).toBeGreaterThan(ring![1]!);
        }
        const r = await new AxeBuilder({ page }).include("svg.mwa__svg").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
        expect(r.passes.length, lang).toBeGreaterThan(0);
        expect(r.violations.map((v) => `${v.id} (${v.impact ?? "?"}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`), `${lang} ${scheme}`).toEqual([]);
      } finally {
        await ctx.close();
      }
    }
  });
});
