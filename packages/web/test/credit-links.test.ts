/**
 * The BKG line's prescribed links on the site's own credit lists (data-steward
 * ruling 2026-10-07; GN250's terms: "BKG" → https://www.bkg.bund.de,
 * "dl-de/by-2-0" → https://www.govdata.de/dl-de/by-2-0). The catalogue carries
 * the line split at those words; `CreditItem.astro` renders the parts and no
 * second "Lizenztext" link. The text stays the register's, byte for byte.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import catalogue from "../src/generated/catalogue.json" with { type: "json" };

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

describe("the BKG line on the site's credit lists", () => {
  it("is split at exactly the two prescribed words, its text unchanged", () => {
    const bkg = catalogue.credits.find((c) => c.id === "bkg_gvisys");
    expect(bkg?.parts?.filter((p) => p.href !== null)).toEqual([
      { text: "BKG", href: "https://www.bkg.bund.de" },
      { text: "dl-de/by-2-0", href: "https://www.govdata.de/dl-de/by-2-0" },
    ]);
    expect(bkg?.parts?.map((p) => p.text).join("")).toBe(bkg?.text);
    // every other line keeps the generic form
    expect(catalogue.credits.filter((c) => c.parts !== null).map((c) => c.id)).toEqual(["bkg_gvisys"]);
  });

  it("is rendered by the one component every credit list uses, with no second licence link", () => {
    const item = readFileSync(join(SRC, "components", "CreditItem.astro"), "utf8");
    expect(item).toMatch(/c\.parts !== null \? c\.parts\.map/u);
    // 2.6.19 (#746): an example answer's lines go through CreditList, which renders each one with CreditItem.
    expect(readFileSync(join(SRC, "components", "Answer.astro"), "utf8")).toContain("<CreditList lang={lang} credits={full}");
    for (const f of [join(SRC, "components", "CreditList.astro"), join(SRC, "layouts", "ConnectPage.astro")]) {
      const src = readFileSync(f, "utf8");
      expect(src, f).toContain("<CreditItem c={c} lang={lang} />");
      expect(src, f).not.toContain('<li lang="de"><a href={c.url}');
    }
  });
});
