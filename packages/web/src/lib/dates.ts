/**
 * Every time the site prints is Berlin wall time in the page's language
 * (CLAUDE.md: UTC stored, Europe/Berlin rendered; #380). One formatter per
 * call site shape, never `toLocaleString()` without a zone, which would print
 * the server's zone (UTC in the container) and be an hour or two wrong.
 */
import type { Lang } from "../site/pages.js";
import { dateTimeFormat } from "./intl-formats.js";

/**
 * The Intl tag of every site language — held equal to `@viafrei/ingest`'s
 * `SITE_INTL` by `test/lang-agreement.test.ts` (the shell may not import it):
 * European Portuguese and Cyrillic Serbian are the owner's choice (#764, #766).
 */
const ALL_TAGS = {
  de: "de-DE", en: "en-GB", ru: "ru-RU", bg: "bg-BG", uk: "uk-UA", ro: "ro-RO", tr: "tr-TR",
  fr: "fr-FR", es: "es-ES", nl: "nl-NL", pl: "pl-PL", it: "it-IT", lt: "lt-LT", cs: "cs-CZ", hu: "hu-HU", // el carries the 24-hour clock (-u-hc-h23)
  sk: "sk-SK", da: "da-DK", pt: "pt-PT", hr: "hr-HR", sr: "sr-Cyrl-RS", el: "el-GR-u-hc-h23", lv: "lv-LV",
} as const;
export const TAGS: Readonly<Record<Lang, string>> = ALL_TAGS;

export function berlinTime(at: Date, lang: Lang): string {
  return dateTimeFormat(TAGS[lang], { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hour12: false }).format(at);
}

export function berlinDateTime(at: Date, lang: Lang): string {
  return dateTimeFormat(TAGS[lang], {
    timeZone: "Europe/Berlin",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(at);
}

/** A calendar day (`YYYY-MM-DD`, a release date) in the page's language — no time, so no zone question. */
export function calendarDay(day: string, lang: Lang): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`calendarDay: '${day}' is not YYYY-MM-DD`);
  return dateTimeFormat(TAGS[lang], { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${day}T00:00:00Z`));
}
