/**
 * #992: the business and developers pages' search surface in every language — a description written to fit (at most
 * 160 characters, whole sentences, never cut with "…": `pageMeta` no longer fits it, so one that does not fit fails
 * HERE rather than reaching a result page shortened), a title within 60, unique per page and language, the hreflang
 * alternates, the Organization and SoftwareApplication structured data, and a sitemap `lastmod` that moves when the
 * page's words do.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { all, first, text } from "@viafrei/design/testing";
import { t } from "../src/i18n/index.js";
import { TITLE_FIT, WRITTEN_TO_FIT, pageMeta, rawPageMeta } from "../src/site/meta.js";
import { LIVE_LANGS, pathFor, type Lang } from "../src/site/pages.js";
import { structuredData } from "../src/site/structured-data.js";
import { META_KEYS, allHashes, diskReader, type Reader } from "../scripts/lastmod.js";
import { BUSINESS, DEVELOPERS, startPages, type Pages } from "./pages-992.js";

const PAGES = ["business", "developers"] as const;
const DESCRIPTION_MAX = 160;

/** The description rule, as one predicate a planted description can be run through. */
function descriptionFaults(d: string): string[] {
  const out: string[] = [];
  if (d.length > DESCRIPTION_MAX) out.push(`${String(d.length)} characters`);
  if (/…\s*$|\.\.\.\s*$/u.test(d)) out.push(`ends in "…"`);
  else if (!/[.!?。！？]$/u.test(d.trim())) out.push("not a whole sentence");
  if (d.trim().length < 70) out.push("shorter than 70");
  return out;
}

describe("descriptions and titles, every language (#992)", () => {
  it("the rule fails a description over 160, one ending in …, and a fragment", () => {
    expect(descriptionFaults(`${"Wort ".repeat(40)}.`)).toContain("201 characters");
    expect(descriptionFaults("Live-Verkehr, Ladesäulen und Parken in ganz Deutschland über eine einzige Schnittstelle mit Quelle…")).toContain(`ends in "…"`);
    expect(descriptionFaults("Live-Verkehr, Ladesäulen und Parken in ganz Deutschland über eine einzige Schnittstelle mit Quelle")).toContain("not a whole sentence");
    expect(descriptionFaults("Live-Verkehr, Ladesäulen und Parken in ganz Deutschland über eine einzige Schnittstelle mit Quelle.")).toEqual([]);
  });

  it("the fit no longer cuts these two pages: pageMeta's description IS the deck's", () => {
    expect([...WRITTEN_TO_FIT].sort()).toEqual([...PAGES].sort());
    for (const lang of LIVE_LANGS) for (const page of PAGES) expect(pageMeta(page, lang).description).toBe(t(lang, page === "business" ? "seo.businessDescription" : "seo.developersDescription"));
  });

  for (const lang of LIVE_LANGS) {
    it(`${lang}: each description ≤ 160, whole sentences, no "…"; each title ≤ ${String(TITLE_FIT)}; the two differ`, () => {
      for (const page of PAGES) {
        const m = pageMeta(page, lang);
        expect(descriptionFaults(m.description), `${lang} ${page}: "${m.description}"`).toEqual([]);
        expect(m.title.length, `${lang} ${page}: "${m.title}"`).toBeLessThanOrEqual(TITLE_FIT);
        expect(m.title).not.toMatch(/…/u);
        // the title the deck writes is the one shown: the fit at most drops the brand suffix
        expect(rawPageMeta(page, lang).title.startsWith(m.title.replace(/\s[—–]\sViaFrei$/u, ""))).toBe(true);
      }
      expect(pageMeta("business", lang).description).not.toBe(pageMeta("developers", lang).description);
      expect(pageMeta("business", lang).title).not.toBe(pageMeta("developers", lang).title);
    });
  }

  it("unique across languages: no language ships another's title or description (a missed translation)", () => {
    for (const page of PAGES) {
      for (const field of ["title", "description"] as const) {
        const seen = new Map<string, Lang>();
        for (const lang of LIVE_LANGS) {
          const v = pageMeta(page, lang)[field];
          expect(seen.get(v), `${page} ${field} of ${lang} equals ${String(seen.get(v))}'s`).toBeUndefined();
          seen.set(v, lang);
        }
      }
    }
  });

  it("structured data: Organization and SoftwareApplication on both pages, in the page's language", () => {
    for (const lang of LIVE_LANGS) {
      for (const page of PAGES) {
        const graph = JSON.stringify(structuredData(page, lang, "2.5.9"));
        expect(graph).toContain(`"@type":"Organization"`);
        expect(graph).toContain(`"@type":"SoftwareApplication"`);
      }
    }
  });
});

describe("the sitemap lastmod moves with the content (#992)", () => {
  const live = allHashes();
  const plant = (lang: Lang, edit: (deck: Record<string, Record<string, unknown>>) => void): Reader => (r) => {
    const text = diskReader(r);
    if (r !== `src/i18n/${lang}.json` || text === null) return text;
    const deck = JSON.parse(text) as Record<string, Record<string, unknown>>;
    edit(deck);
    return JSON.stringify(deck);
  };
  const moved = (read: Reader): string[] => {
    const after = allHashes(read);
    return Object.keys(live).filter((k) => after[k as keyof typeof after] !== live[k as keyof typeof live]);
  };
  it("the page's own title and description are part of its hash", () => {
    expect(META_KEYS.business).toEqual(["seo.businessTitle", "seo.businessDescription"]);
    expect(META_KEYS.developers).toEqual(["seo.developersTitle", "seo.developersDescription"]);
    expect(moved(plant("en", (d) => (d["seo"]!["businessDescription"] = "Planted.")))).toEqual(["business:en"]);
  });
  it("a body sentence moves its page and language only, including a tool's example question", () => {
    expect(moved(plant("fr", (d) => (d["bizPage"]!["how1"] = "Planted.")))).toEqual(["business:fr"]);
    expect(moved(plant("de", (d) => ((d["devPage"]!["ask"] as Record<string, string>)["find_place"] = "Planted?")))).toEqual(["developers:de"]);
  });
});

describe("the rendered head (#992)", () => {
  let pages: Pages;
  beforeAll(async () => {
    pages = await startPages();
  }, 20_000);
  afterAll(async () => {
    await pages.close();
  });
  for (const [page, file] of [["business", BUSINESS], ["developers", DEVELOPERS]] as const) {
    for (const lang of LIVE_LANGS) {
      it(`${page} ${lang}: its own title and description, and the hreflang alternates`, async () => {
        const html = await pages.render(file, lang);
        const m = pageMeta(page, lang);
        expect(text(first(html, "title")!)).toBe(m.title);
        expect(all(html, "meta").find((x) => x.attrs.name === "description")?.attrs.content).toBe(m.description);
        const alt = new Map(all(html, "link").filter((l) => l.attrs.rel === "alternate" && l.attrs.hreflang !== undefined).map((l) => [l.attrs.hreflang!, l.attrs.href!]));
        for (const l of LIVE_LANGS) expect(alt.get(l)?.endsWith(pathFor(page, l)), `${lang} → ${l}: ${String(alt.get(l))}`).toBe(true);
        expect(alt.has("x-default")).toBe(true);
      });
    }
  }
});
