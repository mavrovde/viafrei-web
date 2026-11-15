import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DISCOVERY_ROUTES, LIVE_PAGES, siteMap } from "../scripts/site-map.js";
import { LIVE_LANGS, pathFor } from "../src/site/pages.js";
import { LEGACY_FIXED } from "../src/lib/legacy-redirects.js";
import { hasInternalId } from "../src/site/slug.js";

const FILE = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "scripts", "site-pages.txt");

describe("scripts/site-pages.txt is the projection of pages.ts (#381 item 9)", () => {
  it("the committed file equals the projection — regenerate with `npx tsx packages/web/scripts/site-map.ts > scripts/site-pages.txt`", () => {
    expect(readFileSync(FILE, "utf8")).toBe(siteMap());
  });
  it("carries every page in both languages, the sitemap and every redirect — not a short list", () => {
    const rows = siteMap().split("\n").filter((l) => l !== "" && !l.startsWith("#"));
    // eight pages of the map without the 404 (the fuel page joined in v1.8.18, the News page in 2.0.0, #588),
    // every language, the sitemap and robots.txt, the four discovery files of #531, and the redirects
    // since 2.1.13 (#715) the motorway index is a ninth page, and the sitemap index a third file beside sitemap.xml and robots.txt;
    // since 2.1.24 (#747) the examples page is a tenth
    // since 2.3.4 (#892) the TEMPORARY legacy 301s of the pre-#892 page words, four per language (removed by #898)
    // since 2.4.2 (#1041) the station catalogue is an eleventh
    // since 2.5.2 (#1111) the search page, every language — probed, in no sitemap
    // since 2.5.8 (#1074) the index of the sixteen Länder is a twelfth
    // #734: two more discovery files, /.well-known/mcp.json and /.well-known/security.txt — six
    expect(rows).toHaveLength(1 + 13 * LIVE_LANGS.length + LIVE_LANGS.length + 3 + 6 + 3 + LIVE_LANGS.length + LEGACY_FIXED.length);
    expect(LEGACY_FIXED).toHaveLength(4 * LIVE_LANGS.length);
    expect(rows[0]!.split(/\s+/)[0]).toBe("/");
    const redirects = rows.filter((r) => /redirect=/.test(r));
    expect(redirects.filter((r) => !/,legacy$/.test(r)).map((r) => r.split(/\s+/)[0])).toEqual(["/home", "/connect", "/en/home", ...LIVE_LANGS.map((l) => `/${l}/`)]);
    expect(redirects.filter((r) => /,legacy$/.test(r)).map((r) => r.split(/\s+/)[0])).toEqual(LEGACY_FIXED.map((f) => f.from));
    // every target of a legacy row is a page of this map: one hop, never a chain
    const pages = new Set(rows.filter((r) => !/redirect=/.test(r)).map((r) => r.split(/\s+/)[0]));
    for (const f of LEGACY_FIXED) expect(pages.has(f.to) || f.to.endsWith(".xml"), f.from).toBe(true);
    // #892: no address of the map carries an internal id (an AGS, a BASt code — five digits or more), and every
    // page word is English: no German word outside the legacy rows and the two legal pages (§ 5 DDG, Art. 13 DSGVO)
    for (const r of rows) expect(hasInternalId(r.split(/\s+/)[0]!), r).toBe(false);
    for (const r of rows.filter((x) => !/,legacy$/.test(x))) expect(r.split(/\s+/)[0], r).not.toMatch(/\/(ort|neuigkeiten|beispiele|motorway)(\/|\.|$)/);
  });
  it("flags exactly the motorway index, in every language, as live — in a fifth column the four-column readers never see (#1052)", () => {
    expect([...LIVE_PAGES]).toEqual(["motorways"]);
    const rows = siteMap().split("\n").filter((l) => l !== "" && !l.startsWith("#")).map((r) => r.split(/\s+/));
    const live = rows.filter((c) => c[4] === "live").map((c) => c[0]);
    expect(live).toEqual(LIVE_LANGS.map((l) => pathFor("motorways", l)));
    // a live row is still a `page` row for the deploy, landing-conf.test.sh, the sitemap sweep and the visit count
    for (const c of rows.filter((x) => x[4] === "live")) expect(c[3]).toBe("page");
    // nothing but `live` ever stands in the fifth column, and no row has a sixth
    for (const c of rows) {
      expect(c.length, c.join(" ")).toBeLessThanOrEqual(5);
      if (c.length === 5) expect(c[4]).toBe("live");
    }
  });
  it("carries the four discovery files of #531 as 200 routes, so the deploy probes them and the public smoke compares them", () => {
    expect([...DISCOVERY_ROUTES]).toEqual(["/llms.txt", "/llms-full.txt", "/.well-known/mcp/server-card.json", "/.well-known/mcp-registry-auth", "/.well-known/mcp.json", "/.well-known/security.txt"]);
    const rows = siteMap().split("\n").filter((l) => l !== "" && !l.startsWith("#"));
    for (const r of DISCOVERY_ROUTES) expect(rows.find((x) => x.split(/\s+/)[0] === r)?.split(/\s+/)[3], r).toBe("page");
  });
});
