/**
 * #1085 AC 1 and 2 (2.4.8): the topic filter and the place Ampel. The bar carries the motorway page's D8 sentence in
 * every live language, and the stylesheet shows it while a card the Ampel took a reason from is hidden, and hides that
 * card's marks on the place map. The digest tags each reason and mark with its card; the rules here name exactly the
 * cards the digest tags with. The browser half is `e2e/place-ampel-filter-1085.e2e.ts`.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { all, text } from "@viafrei/design/testing";
import { describe, expect, it } from "vitest";
import { topicBarHtml, topicCardsOf } from "../src/lib/topic-filter.js";
import { filterCopy } from "../src/lib/motorway-filter.js";
import { LIVE_LANGS } from "../src/site/pages.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(HERE, "..", "src", "styles", "site.css"), "utf8");
const renderer = readFileSync(join(HERE, "..", "..", "..", ".pinned", "app", "packages", "digest", "dist", "src", "presentation", "place-ampel-html.js"), "utf8");
const analysis = readFileSync(join(HERE, "..", "..", "..", ".pinned", "app", "packages", "digest", "dist", "src", "analysis", "place-ampel.js"), "utf8");
const FRAG = `<section class="place"><div class="place__cards"><article class="pcard pcard--info" id="pcard-roads"><header><h3 class="pcard__title" id="pcard-roads-t">Straßen</h3></header></article></div></section>`;

describe("the bar's D8 sentence", () => {
  it("is the motorway page's sentence, in every live language, never empty, with no `hidden` attribute (the stylesheet decides)", () => {
    for (const lang of LIVE_LANGS) {
      const bar = topicBarHtml(lang, topicCardsOf(FRAG), null, `/${lang}/place/kehl`);
      const p = all(bar, "p#tpf-ampel.tpf__ampel");
      expect(p, lang).toHaveLength(1);
      expect(text(p[0]!), lang).toBe(filterCopy(lang).ampel);
      expect(text(p[0]!).length, lang).toBeGreaterThan(10);
      expect(bar, lang).not.toMatch(/id="tpf-ampel"[^>]*hidden/u);
    }
  });
});

describe("the stylesheet", () => {
  const cards = ["roads", "motorways", "warnings"] as const;
  it("the note is hidden by default and shown for each card the digest tags a reason with, while that card is hidden", () => {
    expect(css).toMatch(/\.tpf__ampel \{ display: none;/u);
    for (const c of cards) expect(css, c).toContain(`body:has(#pcard-${c}[hidden]):has(.place-ampel .ampel__reason--in-${c}) .tpf__ampel`);
  });
  it("a hidden card's marks are hidden, for each card the digest tags a mark with", () => {
    for (const c of ["roads", "motorways"] as const) expect(css, c).toMatch(new RegExp(`body:has\\(#pcard-${c}\\[hidden\\]\\) \\.pam-mark--in-${c}[,\\s{]`, "u"));
  });
  // cross-repo(viafrei): asserts TypeScript source text (a type, a `readonly`/`as const` declaration) that the released viafrei-app ships compiled, so it cannot be decided here (viafrei-web#2, docs/moved-from-viafrei.md)
  it.skip("the cards the rules name are the cards the digest can tag with — no tag without a rule", () => {
    expect(analysis).toMatch(/card: "roads" \| "motorways"/u);
    expect(renderer).toContain("ampel__reason--in-${card}");
    expect(renderer).toContain("pam-mark--in-${m.card}");
    expect(renderer).toMatch(/r\.signal\.ref\.kind === "road" \? r\.signal\.ref\.card : "warnings"/u);
  });
});
