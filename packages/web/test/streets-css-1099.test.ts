/**
 * #1099 (2.4.7, found on prod after the Hamburg load): the digest draws the streets as `<g class="mwc-streets">` of
 * `<path class="mwc-st mwc-st--N" stroke-width=…>` and sets no fill or stroke of its own. With no rule in the stylesheet
 * every page loads, SVG's defaults applied — fill black, stroke none — and each street became a black wedge. The rule
 * lives in `site.css` (through `Base.astro`) beside `.mwc-roads`, and the digest's caption no longer says "without the
 * street network", which is false wherever streets are drawn.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const STYLES = join(import.meta.dirname, "..", "src", "styles");
const site = readFileSync(join(STYLES, "site.css"), "utf8");
const base = readFileSync(join(import.meta.dirname, "..", "src", "layouts", "Base.astro"), "utf8");
const L10N = join(import.meta.dirname, "..", "..", "digest", "src", "presentation", "l10n");
const MAP = readFileSync(join(import.meta.dirname, "..", "..", "digest", "src", "presentation", "map-context.ts"), "utf8");

/** Each catalogue's map caption after #1099: the old "without the street network" phrase is false wherever streets are drawn. */
const CAPTIONS: Readonly<Record<string, string>> = {
  "bg": "Схематична карта – не за навигация.",
  "cs": "Schematická mapa – ne pro navigaci.",
  "da": "Skematisk kort – ikke til navigation.",
  "de": "Schematische Karte – keine Navigation.",
  "el": "Σχηματικός χάρτης – όχι για πλοήγηση.",
  "en": "Schematic map – not for navigation.",
  "es": "Mapa esquemático: no sirve para navegar.",
  "fr": "Carte schématique – pas pour la navigation.",
  "hr": "Shematska karta – nije za navigaciju.",
  "hu": "Vázlatos térkép – navigációra nem alkalmas.",
  "it": "Mappa schematica – non per la navigazione.",
  "lt": "Schematinis žemėlapis – ne navigacijai.",
  "lv": "Shematiska karte – nav paredzēta navigācijai.",
  "nl": "Schematische kaart – niet voor navigatie.",
  "pl": "Mapa schematyczna – nie do nawigacji.",
  "pt": "Mapa esquemático – não serve para navegação.",
  "ro": "Hartă schematică – nu pentru navigare.",
  "ru": "Схематическая карта — не для навигации.",
  "sk": "Schematická mapa – nie na navigáciu.",
  "sr": "Шематска карта – није за навигацију.",
  "tr": "Şematik harita – navigasyon için değildir.",
  "uk": "Схематична карта — не для навігації."
};

describe("#1099: the streets are stroked lines, never filled shapes", () => {
  it("the digest still writes the classes this rule styles", () => {
    expect(MAP).toContain('add("mwc-streets"');
    expect(MAP).toContain("mwc-st mwc-st--");
  });

  it("site.css (loaded by Base on every page) strokes the street paths and fills none", () => {
    expect(base).toMatch(/import "\.\.\/styles\/site\.css";/);
    const rule = /\.mwc-streets path \{([^}]*)\}/.exec(site)?.[1] ?? "";
    expect(rule).toMatch(/fill: none/);
    expect(rule).toMatch(/stroke: var\(--map-road\)/);
  });

  it("every catalogue's map caption is exactly its own schematic-map sentence, with no claim about streets", () => {
    const files = readdirSync(L10N).filter((f) => /^[a-z]{2}\.ts$/.test(f));
    expect(files.length).toBe(22);
    expect(Object.keys(CAPTIONS).sort()).toEqual(files.map((f) => f.slice(0, 2)).sort());
    for (const [lang, caption] of Object.entries(CAPTIONS)) {
      const text = readFileSync(join(L10N, `${lang}.ts`), "utf8");
      const found = /map: \{ title: "[^"]*", desc: "[^"]*", caption: "([^"]*)"/u.exec(text)?.[1];
      expect(found, lang).toBe(caption);
    }
  });

  it("the streets' legend key is a line in the streets' colour, spaced from its word", () => {
    const key = /\.mw-key--streets \{([^}]*)\}/.exec(site)?.[1] ?? "";
    expect(key).toMatch(/background: var\(--map-road\)/);
    expect(key).toMatch(/height: 0\.3em/);
    expect(/\.pam__key \{([^}]*)\}/.exec(site)?.[1] ?? "").toMatch(/gap: /);
  });
});
