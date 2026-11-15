import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WEB_PINS } from "./lang-pins.js";
import { describe, expect, it } from "vitest";
import { MESSAGE_KEYS, catalogue, plurals, t, type MessageKey } from "../src/i18n/index.js";
import { TAGS } from "../src/lib/dates.js";
import { LOCALES, badgeOf, reviewedLocales } from "../src/i18n/locales.js";
import { LIVE_LANGS, type Lang } from "../src/site/pages.js";

// `WEB_I18N_DIR` is set by scripts/web-i18n-mutation.sh alone: it points this
// sweep at a mutated COPY of the catalogues, so the proof that the sweep can
// fail never edits the real files.
const I18N_DIR = process.env["WEB_I18N_DIR"] ?? join(dirname(fileURLToPath(import.meta.url)), "..", "src", "i18n");

function flatten(tree: unknown, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  if (typeof tree === "string") {
    out[prefix] = tree;
    return out;
  }
  if (tree === null || typeof tree !== "object" || Array.isArray(tree)) throw new Error(`'${prefix}' is not a string or object`);
  for (const [k, v] of Object.entries(tree)) flatten(v, prefix === "" ? k : `${prefix}.${k}`, out);
  return out;
}

/** Read every catalogue from disk, not through the module, so a file the module forgot is still judged. */
function catalogues(): Record<string, Record<string, string>> {
  const files = readdirSync(I18N_DIR).filter((f) => f.endsWith(".json")).sort();
  const out: Record<string, Record<string, string>> = {};
  for (const f of files) out[f.replace(/\.json$/, "")] = flatten(JSON.parse(readFileSync(join(I18N_DIR, f), "utf8")));
  return out;
}

describe("the copy deck (src/i18n/*.json)", () => {
  const cats = catalogues();
  const langs = Object.keys(cats);

  it("refuses to judge fewer than two catalogues — parity over one file is vacuous", () => {
    // The assertion IS the precondition: with one file the sweep below has
    // nothing to compare and would pass; this line turns that into red.
    expect(langs.length, `found ${langs.join(", ")}`).toBeGreaterThanOrEqual(2);
    expect(langs).toContain("de");
    expect(langs).toContain("en");
  });

  it("has exactly one catalogue per registered reviewed locale — a missing file is red, not a smaller sweep (#380)", () => {
    expect(langs.sort()).toEqual(reviewedLocales().map((l) => l.code).sort());
  });

  it("has identical key sets in every catalogue", () => {
    const reference = Object.keys(cats["de"] ?? {}).sort();
    expect(reference.length).toBeGreaterThan(50);
    for (const lang of langs) {
      const keys = Object.keys(cats[lang] ?? {}).sort();
      const missing = reference.filter((k) => !keys.includes(k));
      const extra = keys.filter((k) => !reference.includes(k));
      expect(missing, `${lang}.json is missing`).toEqual([]);
      expect(extra, `${lang}.json has extra`).toEqual([]);
    }
  });

  it("has no empty value and no value padded with whitespace", () => {
    for (const lang of langs) {
      for (const [k, v] of Object.entries(cats[lang] ?? {})) {
        expect(v.trim(), `${lang}:${k}`).not.toBe("");
        expect(v, `${lang}:${k}`).toBe(v.trim());
      }
    }
  });

  it("uses the same placeholders in every language", () => {
    // an ICU plural block `{n, plural, …}` (#753) is the placeholder {n}; the holes inside its branches count too
    const holes = (s: string) => [...new Set([...s.matchAll(/\{(\w+)(?:\}|,\s*plural,)/g)].map((m) => m[1]))].sort();
    for (const k of Object.keys(cats["de"] ?? {})) {
      const de = holes(cats["de"]?.[k] ?? "");
      for (const lang of langs) expect(holes(cats[lang]?.[k] ?? ""), `${lang}:${k}`).toEqual(de);
    }
  });

  it("leaves no value untranslated: none equals the German, and none but English's equals the English (#753)", () => {
    // Each key here may read the same in two languages, with its reason; every other equal value is a missed translation.
    const SAME: Readonly<Record<string, string>> = {
      "meta.siteName": "the brand",
      "nav.brand": "the brand",
      "beta.label": "the international word several languages write as English does",
      "sign.answerAfter": "punctuation only",
      "place.motorway.filter.sum": "placeholders and punctuation only (2.3.11)",
      "connect.clients.chatgpt": "a product name",
      "connectPage.claudeAi": "a product name and its host",
      "connectPage.claudeDesktop": "a product name",
      "connectPage.claudeCode": "a product name",
      "connectPage.chatgpt": "a product name",
      "connectPage.editors": "product names",
      "connectPage.chatgptFlow.s1": "the client's own English menu labels, quoted as the reader sees them (#1090)",
      "connectPage.chatgptFlow.d1": "the client's own English menu labels, in the diagram's first box (#1090)",
      "connectPage.shot.caption": "the loanword 'Screenshot' and the host name (#1090)",
      "devPage.npmHeading": "the registry's name",
      "quote.open": "a quotation mark several languages share",
      "quote.close": "a quotation mark several languages share",
    };
    // English writes these as German does: the same loanword or the same digits-and-word shape
    const EN_SAME: Readonly<Record<string, string>> = {
      "devPage.releaseLine": "'Version' is the same word",
      "devPage.promptsHeading": "'Prompts' is the same word",
      "devPage.statusHeading": "'Status' is the same word",
      "newsPage.released": "'Version' is the same word",
    };
    const de = cats["de"] ?? {};
    const en = cats["en"] ?? {};
    const found: string[] = [];
    for (const lang of langs.filter((l) => l !== "de")) {
      for (const [k, v] of Object.entries(cats[lang] ?? {})) {
        if (SAME[k] !== undefined || (lang === "en" && EN_SAME[k] !== undefined) || WEB_PINS[lang]?.same?.includes(k) === true || !/\p{L}{3}/u.test(v)) continue;
        if (v === de[k]) found.push(`${lang}:${k} is the German "${v.slice(0, 60)}"`);
        else if (lang !== "en" && v === en[k]) found.push(`${lang}:${k} is the English "${v.slice(0, 60)}"`);
      }
    }
    expect(found).toEqual([]);
    // every exemption is still needed by some language — a reason nothing uses is a hole, not a convenience
    for (const k of Object.keys(SAME)) expect(langs.some((l) => l !== "de" && (cats[l]?.[k] === de[k] || (l !== "en" && cats[l]?.[k] === en[k]))), k).toBe(true);
    // a language's own exemptions (#753, test/lang-pins.ts) are each still the German or the English word
    for (const lang of langs) for (const k of WEB_PINS[lang]?.same ?? []) expect(cats[lang]?.[k] === de[k] || cats[lang]?.[k] === en[k], `${lang}:${k} is exempt but translated`).toBe(true);
  });

  it("every ICU plural block names the category of 1, 2, 5, 12, 22, 25 and 101 in its language (#753)", () => {
    const blocks = /\{(\w+),\s*plural,((?:[^{}]|\{[^{}]*\})*)\}/g;
    let seen = 0;
    for (const lang of langs) {
      const rules = new Intl.PluralRules(TAGS[lang as Lang] ?? lang);
      for (const [k, v] of Object.entries(cats[lang] ?? {})) {
        for (const m of v.matchAll(blocks)) {
          seen++;
          const cats_ = new Set([...(m[2] ?? "").matchAll(/(zero|one|two|few|many|other)\s*\{/g)].map((x) => x[1]));
          expect(cats_.has("other"), `${lang}:${k} has an 'other' branch`).toBe(true);
          for (const n of [1, 2, 5, 12, 22, 25, 101]) expect(cats_.has(rules.select(n)), `${lang}:${k} for ${n} (${rules.select(n)})`).toBe(true);
          const vars: Record<string, number> = Object.fromEntries([...v.matchAll(/\{(\w+)/g)].map((x): [string, number] => [x[1] ?? "", 5]));
          expect(t(lang as Lang, k as MessageKey, vars), `${lang}:${k}`).not.toMatch(/plural|[{}#]/);
        }
      }
    }
    // the sweep read something once a language that needs it is live; with none it proves nothing and says so
    if (langs.some((l) => ["pl", "cs", "sk", "lt", "lv", "hr", "sr"].includes(l))) expect(seen, "ICU plural blocks found").toBeGreaterThan(0);
  });

  it("carries no HTML, no analytics id and no version string", () => {
    for (const lang of langs) {
      for (const [k, v] of Object.entries(cats[lang] ?? {})) {
        expect(v, `${lang}:${k}`).not.toMatch(/<[a-z!/]/i);
        expect(v, `${lang}:${k}`).not.toMatch(/G-[A-Z0-9]{8,12}/);
        expect(v, `${lang}:${k}`).not.toMatch(/\bv?\d+\.\d+\.\d+\b/);
      }
    }
  });

  it("exposes the German key set through the module and interpolates strictly", () => {
    expect([...MESSAGE_KEYS].sort()).toEqual(Object.keys(cats["de"] ?? {}).sort());
    expect(catalogue("en")["nav.cta"]).toBe("Connect to your AI");
    expect(t("de", "tools.showAll", { n: 20 })).toBe("Alle 20 Werkzeuge anzeigen");
    expect(() => t("de", "tools.showAll")).toThrow(/needs \{n\}/);
  });
});

describe("an ICU plural block picks its form by Intl.PluralRules (#753)", () => {
  const forms = "{n, plural, one {# narzędzie} few {# narzędzia} many {# narzędzi} other {# narzędzia}}";
  it("the LANGUAGE's rules decide: 1, 2, 5, 12, 22, 25, 101 under Russian's one/few/many and German's one/other", () => {
    const at = (lang: Lang) => [1, 2, 5, 12, 22, 25, 101].map((n) => plurals(lang, "x", forms, { n }));
    expect(at("ru")).toEqual(["1 narzędzie", "2 narzędzia", "5 narzędzi", "12 narzędzi", "22 narzędzia", "25 narzędzi", "101 narzędzie"]);
    expect(at("de")).toEqual(["1 narzędzie", "2 narzędzia", "5 narzędzia", "12 narzędzia", "22 narzędzia", "25 narzędzia", "101 narzędzia"]);
  });
  it("a missing count is an error, not a public '{n, plural'", () => {
    expect(() => plurals("de", "x", forms, {})).toThrow(/needs \{n\}/);
    expect(() => plurals("de", "x", "{n, plural, one {#}", { n: 1 })).toThrow(/unbalanced/);
  });
  it("a string without a block is returned unchanged", () => {
    expect(plurals("de", "x", "Alle {n} Werkzeuge", { n: 3 })).toBe("Alle {n} Werkzeuge");
  });
});

describe("the header's language badge", () => {
  it("is the ISO code upper-cased, except Ukrainian, which reads UA (owner 2026-10-04) — lang and URL stay uk", () => {
    expect(LIVE_LANGS.slice(0, 7).map((l) => badgeOf(l))).toEqual(["DE", "EN", "RU", "BG", "UA", "RO", "TR"]);
    // the fifteen of #753 read as their ISO code (CS, DA, EL — the EU's own convention), no second exception
    for (const l of LIVE_LANGS.slice(7)) expect(badgeOf(l), l).toBe(l.toUpperCase());
    expect(LOCALES.find((l) => l.badge === "UA")?.code).toBe("uk");
  });
});
