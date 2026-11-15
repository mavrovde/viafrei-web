/**
 * The footer's "Diese Seite lädt sich alle 20 Minuten neu" is said exactly where
 * the page reloads (#564). Place pages share the home's page id (`start`) and
 * set no reload — the cards fill on their own — yet the footer printed the
 * sentence on them, because it keyed the claim on the page id instead of on the
 * reload. Read from the layouts the bundle is built from (the convention of
 * `beta-notice.test.ts`); a layout that is missing is a failure, not a pass.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LIVE_LANGS } from "../src/site/pages.js";
import { t } from "../src/i18n/index.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const read = (...p: string[]): string => readFileSync(join(SRC, ...p), "utf8");
const code = (s: string): string => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*\*[\s\S]*?\*\//g, "");

describe("the footer's reload sentence follows the reload, not the page id (#564)", () => {
  const footer = code(read("components", "Footer.astro"));
  const base = code(read("layouts", "Base.astro"));

  it("the footer prints the sentence only when told the page reloads, with no default from the page id", () => {
    expect(footer).toMatch(/\{refreshes \? ` \$\{t\(lang, "footer\.refresh"\)\}` : ""\}/);
    expect(footer).not.toMatch(/refreshes\s*=\s*page/);
    expect(footer).toMatch(/refreshes: boolean;/);
  });

  it("Base tells the footer exactly what it told the browser: the same `refresh` drives the meta reload and the sentence", () => {
    expect(base).toMatch(/\{refresh !== undefined && <meta http-equiv="refresh"/);
    const tags = [...base.matchAll(/<Footer\b[^>]*\/>/g)].map((m) => m[0]);
    expect(tags).toHaveLength(1);
    expect(tags[0]).toContain("refreshes={refresh !== undefined}");
  });

  it("the home sets the reload; a place page does not", () => {
    expect(code(read("layouts", "Home.astro"))).toMatch(/<Base[^>]*\brefresh=\{HOME_REFRESH_S\}/);
    const place = code(read("layouts", "PlacePage.astro"));
    const tag = /<Base\b[\s\S]*?>/.exec(place)?.[0] ?? "";
    expect(tag).toContain('page="start"');
    expect(tag).not.toMatch(/\brefresh=/);
  });

  it("the sentence exists in every live language, so the home still says it", () => {
    for (const lang of LIVE_LANGS) expect(t(lang, "footer.refresh").length, lang).toBeGreaterThan(10);
  });
});
