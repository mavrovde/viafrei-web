/**
 * Every page has its own title and description, in its own language, and the
 * social card names a static image that exists (launch audit F-20).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { all, text as nodeText } from "@viafrei/design/testing";
import { t } from "../src/i18n/index.js";
import { OG_IMAGE, OG_LOCALE, fitTitle, pageMeta, rawPageMeta } from "../src/site/meta.js";
import { LIVE_LANGS, PAGE_IDS } from "../src/site/pages.js";

const WEB = new URL("../", import.meta.url).pathname;

describe("per-page titles (F-20)", () => {
  for (const lang of LIVE_LANGS) {
    it(`${lang}: every page's title is its own, and only the home's is the site title`, () => {
      const titles = PAGE_IDS.map((p) => pageMeta(p, lang).title);
      expect(new Set(titles).size, titles.join(" | ")).toBe(PAGE_IDS.length);
      // #935: the home's is the brand line, "ViaFrei – <tagline>" (test/brand.test.ts)
      const home = `${t(lang, "meta.siteName")} – ${t(lang, "meta.tagline")}`;
      expect(pageMeta("start", lang).title).toBe(home);
      for (const p of PAGE_IDS.filter((x) => x !== "start")) {
        expect(pageMeta(p, lang).title, p).not.toBe(home);
        // the brand last (#715 wrote the search titles with an en dash, `– ViaFrei`; the older ones keep ` — ViaFrei`)
        // #1020: as the deck writes it; a title over 60 characters is shown fitted, which drops the brand first (`fitTitle`)
        expect(/ [—–] ViaFrei$/.test(rawPageMeta(p, lang).title) && rawPageMeta(p, lang).title.endsWith(t(lang, "meta.siteName")), p).toBe(true);
        expect(pageMeta(p, lang).title, p).toBe(fitTitle(rawPageMeta(p, lang).title));
      }
      expect(pageMeta("404", lang).title).toContain(t(lang, "notFound.title"));
      for (const p of PAGE_IDS) expect(pageMeta(p, lang).description.length, `${lang} ${p}`).toBeGreaterThan(20);
    });
  }

  it("every live language has an og:locale", () => {
    for (const lang of LIVE_LANGS) expect(OG_LOCALE[lang]).toMatch(/^[a-z]{2}_[A-Z]{2}$/);
  });

  it("Base.astro renders the page's meta, not the home's, and the full social card", () => {
    const base = readFileSync(join(WEB, "src/layouts/Base.astro"), "utf8");
    expect(base).toContain("<title>{meta.title}</title>");
    expect(all(base, "title").map(nodeText)).not.toContain("{t(lang, \"meta.title\")}");
    for (const p of ["og:title", "og:description", "og:image", "og:locale", "og:type", "og:site_name"]) expect(base).toContain(`property="${p}"`);
    // #935: og:site_name is the brand, the card's title and description the page's own (the home's: the tagline and the pitch)
    expect(base).toContain('<meta property="og:site_name" content={t(lang, "meta.siteName")} />');
    expect(base).toContain("const og = meta.og ?? { title: meta.title, description: meta.description };");
    for (const n of ["twitter:card", "twitter:title", "twitter:description", "twitter:image"]) expect(base).toContain(`name="${n}"`);
  });
});

/** Width and height from a PNG's IHDR. */
function pngSize(b: Buffer): { w: number; h: number } {
  expect(b.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(b.subarray(12, 16).toString("ascii")).toBe("IHDR");
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

describe("the static images (F-20, F-22)", () => {
  it("public/og.png is the 1200×630 PNG the card names, and small", () => {
    const png = readFileSync(join(WEB, "public/og.png"));
    expect(pngSize(png)).toEqual({ w: OG_IMAGE.width, h: OG_IMAGE.height });
    expect(png.length).toBeLessThan(100_000);
    expect(OG_IMAGE.url).toBe("https://viafrei.de/og.png");
  });

  it("public/favicon.ico is a one-image ICO carrying a 32×32 PNG", () => {
    const ico = readFileSync(join(WEB, "public/favicon.ico"));
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(1);
    expect([ico.readUInt8(6), ico.readUInt8(7)]).toEqual([32, 32]);
    const len = ico.readUInt32LE(14);
    const off = ico.readUInt32LE(18);
    expect(off + len).toBe(ico.length);
    expect(pngSize(ico.subarray(off))).toEqual({ w: 32, h: 32 });
  });
});
