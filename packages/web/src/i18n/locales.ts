/**
 * The locale registry (#380): every language the site knows, with its own
 * label in its own script and whether a native reviewer has signed its
 * catalogue. Everything that lists, links or negotiates a language reads THIS
 * list — the language list, `hreflang`, the sitemap, `/` negotiation — so the
 * five languages of #235 are added here one by one, `reviewed: false` until
 * signed, and stay invisible until then (D6).
 */
import { LIVE_LANGS, type Lang } from "../site/pages.js";
import type { FlagCode } from "./flags.js";

export type Locale = {
  readonly code: string;
  /** The language's own name, in its own script. */
  readonly label: string;
  /**
   * The short badge the header's language menu shows, when it is not the ISO
   * code upper-cased: Ukrainian reads "UA" (owner 2026-10-04) — the country
   * code readers recognise — while `lang`, `hreflang` and the URL stay `uk`,
   * the ISO 639-1 language code browsers, crawlers and screen readers need.
   */
  readonly badge?: string;
  /**
   * The page's `lang` attribute when it is not the code: the variant or script
   * the owner chose (2026-10-15) — European Portuguese (`pt-PT`, #764) and
   * Serbian in Cyrillic (`sr-Cyrl`, #766). The URL and `hreflang` stay the
   * bare code, so a `pt-BR` or `sr-Latn` reader is still offered the page.
   */
  readonly htmlLang?: string;
  /**
   * The country flags the language menu shows before the name (#989), in
   * order: the ISO 3166 codes of the country or countries a reader of this
   * language looks for. One for every language but English, which shows the
   * United Kingdom's and then the United States' (owner 2026-10-24). This
   * field is the ONLY place a language is tied to a flag; `flags.ts` draws the
   * countries and knows no language. The flags are decoration: the name stays
   * the link's accessible name.
   */
  readonly flag: readonly FlagCode[];
  /** Signed by a native reviewer — only reviewed locales are ever shown, linked or negotiated. */
  readonly reviewed: boolean;
};

export const LOCALES: readonly Locale[] = [
  { code: "de", label: "Deutsch", flag: ["de"], reviewed: true },
  { code: "en", label: "English", flag: ["gb", "us"], reviewed: true },
  // #235: shipped on the owner's decision of 2026-10-03 — the lead's
  // translations, corrected later by ordinary patches if a reader finds a fault.
  { code: "ru", label: "Русский", flag: ["ru"], reviewed: true },
  { code: "bg", label: "Български", flag: ["bg"], reviewed: true },
  { code: "uk", label: "Українська", flag: ["ua"], badge: "UA", reviewed: true },
  { code: "ro", label: "Română", flag: ["ro"], reviewed: true },
  { code: "tr", label: "Türkçe", flag: ["tr"], reviewed: true },
  // #753 (2.3.12): fifteen more, machine-translated and live without a native
  // reviewer (owner 2026-10-15, "We trust auto translation", replacing D6 for
  // these). `reviewed` is the switch that makes a language live, and it is
  // turned on in the same commit as its catalogue.
  { code: "fr", label: "Français", flag: ["fr"], reviewed: true },
  { code: "es", label: "Español", flag: ["es"], reviewed: true },
  { code: "nl", label: "Nederlands", flag: ["nl"], reviewed: true },
  { code: "pl", label: "Polski", flag: ["pl"], reviewed: true },
  { code: "it", label: "Italiano", flag: ["it"], reviewed: true },
  { code: "lt", label: "Lietuvių", flag: ["lt"], reviewed: true },
  { code: "cs", label: "Čeština", flag: ["cz"], reviewed: true },
  { code: "hu", label: "Magyar", flag: ["hu"], reviewed: true },
  { code: "sk", label: "Slovenčina", flag: ["sk"], reviewed: true },
  { code: "da", label: "Dansk", flag: ["dk"], reviewed: true },
  { code: "pt", label: "Português", flag: ["pt"], htmlLang: "pt-PT", reviewed: true },
  { code: "hr", label: "Hrvatski", flag: ["hr"], reviewed: true },
  { code: "sr", label: "Српски", flag: ["rs"], htmlLang: "sr-Cyrl", reviewed: true },
  { code: "el", label: "Ελληνικά", flag: ["gr"], reviewed: true },
  { code: "lv", label: "Latviešu", flag: ["lv"], reviewed: true },
];

/** The locales a visitor can reach: reviewed ones only. */
export function reviewedLocales(list: readonly Locale[] = LOCALES): readonly Locale[] {
  return list.filter((l) => l.reviewed);
}

/** A reviewed locale must also be a live language of the page map, or no page exists for it. */
export function assertRegistryMatchesPages(list: readonly Locale[] = LOCALES): void {
  const reviewed = reviewedLocales(list).map((l) => l.code);
  const live = [...LIVE_LANGS] as string[];
  if (reviewed.join(",") !== live.join(",")) {
    throw new Error(`locales.ts reviewed [${reviewed.join(",")}] != pages.ts LIVE_LANGS [${live.join(",")}]`);
  }
}

export function labelOf(code: Lang): string {
  const l = LOCALES.find((x) => x.code === code);
  if (!l) throw new Error(`locales.ts: no locale '${code}'`);
  return l.label;
}

/** The header menu's short badge: the locale's own `badge`, else its code upper-cased in "en" (never a Turkish dotted İ). */
export function badgeOf(code: Lang): string {
  const l = LOCALES.find((x) => x.code === code);
  if (!l) throw new Error(`locales.ts: no locale '${code}'`);
  return l.badge ?? l.code.toLocaleUpperCase("en");
}

/** The flags shown before a language's name, in order (#989); a locale with none is refused, never shown bare. */
export function flagsOf(code: Lang, list: readonly Locale[] = LOCALES): readonly FlagCode[] {
  const l = list.find((x) => x.code === code);
  if (!l) throw new Error(`locales.ts: no locale '${code}'`);
  if (l.flag.length === 0) throw new Error(`locales.ts: locale '${code}' has no flag`);
  return l.flag;
}

/** The `lang` attribute of a page in `code`: the locale's `htmlLang` (pt-PT, sr-Cyrl), else the code. */
export function htmlLangOf(code: Lang): string {
  const l = LOCALES.find((x) => x.code === code);
  if (!l) throw new Error(`locales.ts: no locale '${code}'`);
  return l.htmlLang ?? l.code;
}

/** Latin, then Greek, then Cyrillic: the order the root collation gives the scripts. */
const SCRIPT_OF = (label: string): number => (/\p{Script=Cyrillic}/u.test(label) ? 2 : /\p{Script=Greek}/u.test(label) ? 1 : 0);
const COLLATOR = new Intl.Collator("und", { sensitivity: "base" });

/**
 * The language menu's groups (#753): the languages by their own names in the
 * root collation, one group per script — Latin A–Z ("Čeština" under C), then
 * Greek, then Cyrillic — so a reader finds their language where their alphabet
 * puts it, on a page in any language. Empty groups are left out.
 */
export function menuGroups(codes: readonly Lang[]): readonly (readonly Lang[])[] {
  const sorted = [...codes].sort((a, b) => COLLATOR.compare(labelOf(a), labelOf(b)));
  return [0, 1, 2].map((s) => sorted.filter((c) => SCRIPT_OF(labelOf(c)) === s)).filter((g) => g.length > 0);
}
