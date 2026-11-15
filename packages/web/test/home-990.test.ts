/**
 * #990, the source half (the rendered half is `e2e/home-990.e2e.ts`): the home is composed in HOME_BLOCKS order with
 * the h1's block first; the national figures are rendered by ONE component, "Deutschland jetzt", and the moments take
 * no tile; PanelFill and the "Heute" strip are gone, while the render-then-fill script stays on both pages that defer.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { t } from "../src/i18n/index.js";
import { LIVE_LANGS } from "../src/site/pages.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const read = (...p: string[]): string => readFileSync(join(SRC, ...p), "utf8");

describe("#990: the home's composition", () => {
  const home = read("layouts", "Home.astro");
  it("the blocks in order: Hero (the h1) first, the place, the national band, connecting (#1177), the moments, the news, the tools, the sources", () => {
    const order = ["<Hero ", "<PlaceBlock ", "<NationalBand ", "<Start ", "<Day ", "<NewsTeaser ", "<Tools ", "<Audience ", "<Sources "].map((tag) => home.indexOf(tag));
    for (const [i, at] of order.entries()) {
      expect(at, String(i)).toBeGreaterThan(0);
      if (i > 0) expect(at).toBeGreaterThan(order[i - 1] ?? 0);
    }
  });
  it("only the national band takes the tiles' figures; the moments take none; the motorway panel and the road links are in the band", () => {
    expect(home).toContain("<NationalBand lang={lang} tiles={tiles} motorwayTop=");
    expect(home).toContain("<Day lang={lang} asks={asks} />");
    expect(home).not.toMatch(/<RoadLinks|motorway-page"/);
    const band = read("components", "NationalBand.astro");
    expect(band).toContain("<RoadLinks lang={lang} />");
    // the panel stands in the band, folded whole with its credit lines (FS-2026-11-06)
    // #1183 part 5: with the home's live map slot inside the same fold, so the map folds with the panel on a phone
    expect(band).toMatch(/set:html=\{folded\(`<div class="motorway-page now__wide">\$\{motorwayTop\}<div class="lmap-slot" id="\$\{HOME_LIVE_MAP_SLOT\}" hidden><\/div><\/div>`/u);
    const day = read("components", "Day.astro");
    expect(day).not.toMatch(/tiles\[|moment__tile|tiles: PageTiles/);
  });
  it("PanelFill and the Heute strip are gone; the fill script is inline on the home and the place page", () => {
    expect(existsSync(join(SRC, "components", "PanelFill.astro"))).toBe(false);
    expect(existsSync(join(SRC, "components", "Today.astro"))).toBe(false);
    for (const f of ["Home.astro", "PlacePage.astro"]) expect(read("layouts", f), f).toContain("<script is:inline set:html={fillScript()} />");
  });
  it("the band's heading and lead in every language, one language per page (no German left in a translation)", () => {
    for (const lang of LIVE_LANGS) {
      expect(t(lang, "now.heading"), lang).not.toBe("");
      expect(t(lang, "now.lead"), lang).not.toBe("");
      if (lang !== "de") expect(t(lang, "now.heading"), lang).not.toBe(t("de", "now.heading"));
    }
  });
});
