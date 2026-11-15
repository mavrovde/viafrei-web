/**
 * #1111 (2.5.8): the `road` kind in the shell — the digest's kinds and the shell's are one list, the header's merged
 * suggestions list the road group, and its heading is said in every language. The digest's answer is the digest's own
 * renderer's over its own `roadHits`, so the shape the shell parses cannot drift from the one the digest writes.
 */
import { describe, expect, it } from "vitest";
import { roadHits, SEARCH_KINDS } from "../../../.pinned/app/packages/digest/dist/src/analysis/site-search.js";
import { landOf } from "../../../.pinned/app/packages/digest/dist/src/cards/shared/html.js";
import { renderSiteSearch } from "../../../.pinned/app/packages/digest/dist/src/presentation/site-search-html.js";
import { HEADER_SITE_KINDS, mergeSuggest } from "../src/lib/header-suggest.js";
import { DIGEST_KINDS, parseDigest, renderResults } from "../src/lib/site-search.js";
import { t } from "../src/i18n/index.js";
import { LIVE_LANGS } from "../src/site/pages.js";
import { all, text } from "@viafrei/design/testing";

const IDS = ["b51", "b510", "nw/l249", "by/l249"];
const answer = (lang: "de" | "en", q: string): string => {
  const hits = roadHits(lang, IDS, q, (a) => landOf(lang, a));
  return renderSiteSearch(lang, { groups: new Map([["road", { hits, total: hits.length }]]), partial: [] });
};

describe("#1111 the road kind in the shell", () => {
  it("the shell's digest kinds ARE the digest's, in its order", () => {
    expect([...DIGEST_KINDS]).toEqual([...SEARCH_KINDS]);
    expect(HEADER_SITE_KINDS).toContain("road");
  });

  it("'B51' in the header: the road group first, its page linked, its heading in the page's language", () => {
    for (const lang of ["de", "en"] as const) {
      const site = parseDigest(answer(lang, "B51"));
      expect(site?.groups.map((g) => [g.kind, g.best, g.total])).toEqual([["road", 3, 2]]);
      const html = mergeSuggest(lang, "B51", null, site);
      expect(all(html, "a.place-opt").map((a) => a.attrs.href)[0]).toBe(`/${lang}/road/b51`);
      expect(html).toContain(t(lang, "search.kind.road"));
    }
    expect(t("de", "search.kind.road")).toBe("Bundes- und Landesstraßen");
  });

  it("'L 249' on a results page: each Land's road with its Land, the heading said in every live language", () => {
    const site = parseDigest(answer("de", "L 249"));
    for (const lang of LIVE_LANGS) {
      const html = renderResults(lang, "L 249", site!, { mode: "page", kind: null, page: 1 });
      const head = all(html, ".ss-group__head").map((h) => text(h));
      expect(head[0], lang).toContain(t(lang, "search.kind.road"));
      expect(t(lang, "search.kind.road"), lang).not.toBe("search.kind.road");
    }
    const de = renderResults("de", "L 249", site!, { mode: "page", kind: null, page: 1 });
    expect(all(de, "a.place-opt").map((a) => a.attrs.href)).toEqual(["/de/road/by/l249", "/de/road/nw/l249"]);
    expect(de).toContain("Nordrhein-Westfalen");
  });
});
