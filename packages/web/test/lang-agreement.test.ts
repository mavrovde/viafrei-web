/**
 * One language list, four copies (#753): the shell's `LIVE_LANGS` (it may not
 * import a database-holding workspace at run time, `check_web_boundary.sh`),
 * `@viafrei/ingest`'s `SITE_LANGS` (the words the ingest renders for the
 * cards), the digest's tile languages and the status page's. They must agree
 * in order and in their `Intl` tags, or a page would be listed whose fragments
 * answer 400, or formatted with another locale than its text.
 */
import { describe, expect, it } from "vitest";
import { SITE_INTL, SITE_LANGS } from "@viafrei/ingest";
import { EXTRA_LANGS } from "@viafrei/digest";
import { PUBLIC_LANGS, SITE_LANGS as CORE_LANGS } from "@viafrei/status";
import { LIVE_LANGS } from "../src/site/pages.js";
import { TAGS } from "../src/lib/dates.js";
import { LOCALES, reviewedLocales } from "../src/i18n/locales.js";

describe("the site's languages agree across the packages (#753)", () => {
  it("the shell, the digest and the status page list the same languages in the same order", () => {
    expect(["de", "en", ...EXTRA_LANGS]).toEqual([...LIVE_LANGS]);
    expect([...PUBLIC_LANGS]).toEqual([...LIVE_LANGS]);
  });
  it("every live language is a site language of the ingest, in the ingest's order", () => {
    expect(SITE_LANGS.filter((l) => (LIVE_LANGS as readonly string[]).includes(l))).toEqual([...LIVE_LANGS]);
  });
  it("the registry knows every site language, and a language is live exactly when it is reviewed", () => {
    expect(LOCALES.map((l) => l.code)).toEqual([...SITE_LANGS]);
    expect(reviewedLocales().map((l) => l.code)).toEqual([...LIVE_LANGS]);
  });
  it("#921 C7: the l10n core's SITE_LANGS is the shell's locale registry, status's PUBLIC_LANGS and the digest's tile languages", () => {
    expect([...CORE_LANGS]).toEqual(LOCALES.map((l) => l.code));
    expect([...CORE_LANGS]).toEqual([...PUBLIC_LANGS]);
    expect([...CORE_LANGS]).toEqual(["de", "en", ...EXTRA_LANGS]);
    // one list, not a copy: the core re-exports the ingest's, so a language added to a copy cannot pass here
    expect(CORE_LANGS).toBe(SITE_LANGS);
  });
  it("each live language formats with the ingest's Intl tag (pt-PT, sr-Cyrl-RS)", () => {
    for (const l of LIVE_LANGS) expect(TAGS[l], l).toBe(SITE_INTL[l]);
  });
});
