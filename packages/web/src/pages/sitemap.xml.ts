/**
 * `/sitemap.xml` (#380): every page of the map in each sitemap language (#49: de and en, `SITEMAP_LANGS` in
 * `site/sitemaps.ts`), each entry carrying its alternates in every REVIEWED locale. Unreviewed locales (#235) never
 * appear. Built from `pages.ts` and `locales.ts`, so a page or a language is
 * listed by adding it there and nowhere else. The 404 is not a page anyone
 * should be sent to and is left out.
 *
 * `lastmod` is the day that page's CONTENT last changed, per page and
 * language (`site/lastmod.ts`, from the committed `generated/lastmod.json`):
 * never the build's day, so a page whose content did not change keeps its date
 * across deploys. The News page takes its newest entry's date. A row the map
 * does not hold is left without the element rather than guessed.
 */
import type { APIRoute } from "astro";
import { PAGES, DEFAULT_LANG, pathFor, type Lang, type PageId } from "../site/pages.js";
import { reviewedLocales } from "../i18n/locales.js";
import { SITE_ORIGIN } from "../site/endpoints.js";
import { lastmodOf } from "../site/lastmod.js";
import { isSitemapLang } from "../site/sitemaps.js";

/** The sitemap; `lastmod` is per page and language, `lastmodOf` unless a test hands another. */
export function sitemapXml(lastmod: (page: PageId, lang: Lang) => string | null = lastmodOf): string {
  const langs = reviewedLocales().map((l) => l.code as Lang);
  // #49: a <loc> in a sitemap language only (de, en: `SITEMAP_LANGS`); each entry keeps its alternates in every language
  const urls = PAGES.filter((p) => p.id !== "404").flatMap((p) =>
    langs.filter(isSitemapLang).map((lang) => {
      const alts = langs
        .map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${SITE_ORIGIN}${pathFor(p.id, l)}"/>`)
        .concat(`<xhtml:link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}${pathFor(p.id, DEFAULT_LANG)}"/>`)
        .join("");
      const day = lastmod(p.id, lang);
      const mod = day === null ? "" : `<lastmod>${day}</lastmod>`;
      return `<url><loc>${SITE_ORIGIN}${pathFor(p.id, lang)}</loc>${mod}${alts}</url>`;
    }),
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.join("")}</urlset>\n`;
}

export const GET: APIRoute = () =>
  new Response(sitemapXml(), { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
