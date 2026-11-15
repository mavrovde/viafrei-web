/**
 * The beta notice (#471), checked at its sources; `e2e/site.e2e.ts` checks it
 * on every rendered page of the map in every language, and
 * `e2e/language.e2e.ts` judges its words on the translated pages (#449).
 *
 * Here: every language says it in its own words (no language prints another's
 * sentence — the #449 rule), the shared header renders it from the deck (#1153:
 * in <header>, never in <main>), and every page reaches that layout, so no page can be built without it.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { t, type MessageKey } from "../src/i18n/index.js";
import { LIVE_LANGS } from "../src/site/pages.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const read = (...p: string[]): string => readFileSync(join(SRC, ...p), "utf8");

function astroFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? astroFiles(join(dir, d.name)) : d.name.endsWith(".astro") ? [join(dir, d.name)] : []));
}

const OWN_WORDS: readonly MessageKey[] = ["beta.short", "beta.line", "beta.more", "beta.sign", "connectPage.betaHeading", "connectPage.beta1", "connectPage.beta2", "connectPage.beta3"];

describe("the beta notice in the copy deck (#471)", () => {
  it("covers every live language — not nothing", () => {
    expect(LIVE_LANGS.length).toBeGreaterThanOrEqual(22);
  });
  it("#1174: the line says what the owner's line says and is short enough to be one line on a phone", () => {
    expect(t("de", "beta.line")).toBe("Angaben bei der Quelle prüfen");
    for (const lang of LIVE_LANGS) expect(`${t(lang, "beta.label")} ${t(lang, "beta.line")} · ${t(lang, "beta.more")}`.length, lang).toBeLessThanOrEqual(56);
  });
  for (const key of OWN_WORDS) {
    it(`${key}: said in every live language, and no language repeats another's text`, () => {
      const seen = new Map<string, string>();
      for (const lang of LIVE_LANGS) {
        const s = t(lang, key);
        expect(s.trim(), `${lang}: ${key}`).not.toBe("");
        expect(seen.get(s), `${lang}: ${key} is ${seen.get(s)}'s text`).toBeUndefined();
        seen.set(s, lang);
      }
    });
  }
  it("the German text says what the owner's wording says: beta, change, AI can err, check the named source", () => {
    const de = [t("de", "beta.short"), t("de", "connectPage.beta1"), t("de", "connectPage.beta2"), t("de", "connectPage.beta3")].join(" ");
    for (const w of ["Beta", "Abdeckung", "ändern", "KI", "Fehler", "Quelle", "Stabilisierungsphase", "Datenquellen", "Sperrungen", "Abfahrten", "Preise"]) expect(de, w).toContain(w);
  });
});

describe("every page carries it (#471)", () => {
  const base = read("layouts", "Base.astro");
  const header = read("components", "Header.astro");

  it("#1153: the header renders the notice from the deck, inside <header>, linked to /<lang>/connect#beta — and <main> carries none", () => {
    const head = /<header class="site-head">([\s\S]*?)<\/header>/.exec(header)?.[1] ?? "";
    expect(head).toContain('id="beta-notice"');
    expect(head).toContain('t(lang, "beta.label")');
    // #1174: one line in the header, the full text behind the link
    expect(head).toContain('t(lang, "beta.line")');
    expect(head).not.toContain('t(lang, "beta.short")');
    expect(head).toContain('pathFor("connect", lang)}#beta');
    // under the brand row, before the place row
    expect(head.indexOf('id="beta-notice"')).toBeLessThan(head.indexOf("<PlaceBar"));
    const main = /<main id="main">([\s\S]*?)<\/main>/.exec(base)?.[1] ?? "";
    expect(main.trim().length).toBeGreaterThan(0);
    expect(main).not.toContain("beta-notice");
    // every layout renders the header, so no page can miss it
    expect(base).toMatch(/<Header\s/);
  });

  it("every other layout is built on that layout", () => {
    const layouts = readdirSync(join(SRC, "layouts")).filter((f) => f.endsWith(".astro") && f !== "Base.astro");
    expect(layouts.length).toBeGreaterThanOrEqual(6);
    for (const f of layouts) expect(read("layouts", f), f).toMatch(/<Base\s/);
  });

  it("every page renders through a layout, and none writes its own <html>", () => {
    const pages = astroFiles(join(SRC, "pages"));
    expect(pages.length).toBeGreaterThanOrEqual(10);
    for (const f of pages) {
      const text = readFileSync(f, "utf8");
      const name = relative(SRC, f);
      expect(text, name).toMatch(/import \w+ from "(\.\.\/)+layouts\/\w+\.astro";/);
      expect(text, name).not.toMatch(/<html[\s>]/);
    }
  });

  it("the connect page holds the fuller paragraph at #beta", () => {
    const connect = read("layouts", "ConnectPage.astro");
    expect(connect).toContain('id="beta"');
    for (const k of ["betaHeading", "beta1", "beta2", "beta3"]) expect(connect, k).toContain(`t(lang, "connectPage.${k}")`);
  });
});
