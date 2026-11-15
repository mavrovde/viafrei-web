/**
 * The stored consent decision (#1185, data-steward ruling 2026-11-04, R1/R2) — pure, so the intervals are tested with a
 * frozen clock and the islands share one reading of the key.
 *
 *   * Key `viafrei.consent.analytics`, `localStorage` only, never a cookie, never sent anywhere (R2). It is written by
 *     a button of the bar or of the settings dialog, or by Escape — `encode` is what they write, and nothing else.
 *   * A new write is `granted|YYYY-MM-DD` or `denied|YYYY-MM-DD`: the decision and the UTC DAY, no finer time (R2).
 *   * The form written before #1185, `granted|<epoch ms>`, is read and honoured until it expires; it is never rewritten
 *     without a decision.
 *   * A refusal stands for `REFUSAL_DAYS` (180) whole days: no bar on days 0–179, the bar from day 180 on. A consent
 *     stands for `CONSENT_DAYS` (365), never re-asked while it stands (R1). The legacy form is judged by the same two
 *     intervals, by its decision.
 *   * A day is a UTC calendar day. A decision dated in the future (a clock set back) still stands: a refusal is never
 *     re-asked early because a clock moved.
 */
import { dateTimeFormat } from "../lib/intl-formats.js";

export const CONSENT_KEY = "viafrei.consent.analytics";
/** R3: section 5's storage paragraph in `LegalPrivacy.astro`; the footer link of a page without script points here. */
export const PRIVACY_SETTINGS_ANCHOR = "datenschutz-einstellungen";
/** R1: a refusal stands this many days; the bar opens again on day 180. */
export const REFUSAL_DAYS = 180;
/** R1: a consent stands this many days. */
export const CONSENT_DAYS = 365;
/** R2: the only shape a new write has. */
export const STORED_FORM = /^(granted|denied)\|\d{4}-\d{2}-\d{2}$/u;

export type Decision = "granted" | "denied";
/**
 * #1174 and data-steward FS10f (FS-2026-11-06): the bar is the narrow phone sheet only for the Google-only text opened by
 * itself — never with Clarity on the page (its Microsoft-purposes sentence must be read before an answer, so it is not put
 * behind a scroll) and never when the dialog says the current state (the settings dialog, R3).
 */
export const isConsentSheet = (o: { readonly clarity: string | undefined; readonly stateText: string | undefined }): boolean =>
  o.clarity === undefined && o.stateText === undefined;
export type StoredDecision = { readonly decision: Decision; /** The UTC day the decision was made, `YYYY-MM-DD`. */ readonly day: string };

const DAY_MS = 86_400_000;
const utcDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
const dayStartMs = (day: string): number => Date.parse(`${day}T00:00:00.000Z`);

/** The stored value as a decision and its day, or null for anything else (absent, malformed, an unknown decision). */
export function parseStored(raw: string | null): StoredDecision | null {
  if (raw === null) return null;
  const cut = raw.indexOf("|");
  if (cut < 0) return null;
  const v = raw.slice(0, cut);
  if (v !== "granted" && v !== "denied") return null;
  const rest = raw.slice(cut + 1);
  if (/^\d{4}-\d{2}-\d{2}$/u.test(rest)) return Number.isNaN(dayStartMs(rest)) || utcDay(dayStartMs(rest)) !== rest ? null : { decision: v, day: rest };
  // the pre-#1185 form: epoch milliseconds
  if (/^\d{1,16}$/u.test(rest)) {
    const at = Number(rest);
    return at > 0 ? { decision: v, day: utcDay(at) } : null;
  }
  return null;
}

/** Whole UTC days from the decision's day to `nowMs`'s day (0 on the day itself). */
export function ageDays(s: StoredDecision, nowMs: number): number {
  return Math.round((dayStartMs(utcDay(nowMs)) - dayStartMs(s.day)) / DAY_MS);
}

/** How many days this decision stands (R1). */
export const standsFor = (d: Decision): number => (d === "denied" ? REFUSAL_DAYS : CONSENT_DAYS);

/** The decision that stands at `nowMs`, or null: nothing stored, or the decision ran out and the bar asks again. */
export function standing(raw: string | null, nowMs: number): StoredDecision | null {
  const s = parseStored(raw);
  if (s === null) return null;
  return ageDays(s, nowMs) < standsFor(s.decision) ? s : null;
}

/** What a decision made at `nowMs` writes (R2). */
export function encode(d: Decision, nowMs: number): string {
  return `${d}|${utcDay(nowMs)}`;
}

/** The settings dialog's state sentence (R3): which one, and the day to put in it. */
export function stateOf(raw: string | null, nowMs: number): { readonly key: "none" | Decision; readonly day: string | null } {
  const s = standing(raw, nowMs);
  return s === null ? { key: "none", day: null } : { key: s.decision, day: s.day };
}

/** The day as the page's language writes a date, at UTC so it is the day stored and never the one before. */
export function formatDay(day: string, htmlLang: string): string {
  try {
    return dateTimeFormat(htmlLang, { dateStyle: "long", timeZone: "UTC" }).format(new Date(dayStartMs(day) + DAY_MS / 2));
  } catch {
    return day;
  }
}

/** The one place the islands read the key; a blocked storage reads as nothing stored. */
export function readStored(storage: Pick<Storage, "getItem"> | undefined): string | null {
  try {
    return storage?.getItem(CONSENT_KEY) ?? null;
  } catch {
    return null;
  }
}

/** The one place the islands write the key; a blocked storage keeps the decision for this page only. */
export function writeStored(storage: Pick<Storage, "setItem"> | undefined, d: Decision, nowMs: number): void {
  try {
    storage?.setItem(CONSENT_KEY, encode(d, nowMs));
  } catch {
    /* private mode: this visit only */
  }
}
