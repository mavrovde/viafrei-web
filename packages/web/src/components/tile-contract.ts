/**
 * The site shell's tile arithmetic (#376 PR-02; prose in `design/components.md`).
 * The contract itself — the states, `RENDERED_STATES`, `stateClass` and the
 * tile frame — is `@viafrei/design` since #922, shared with the digest, which
 * could not import this file; what stays here is how the shell judges an age
 * and writes a number.
 */
import { numberFormat } from "../lib/intl-formats.js";

/**
 * The freshness rule: a figure is `ok` while its age is within the tile's
 * cadence times three (one missed cycle is not stale; three is), `stale`
 * after that, and the figure STAYS on the tile — only the pill changes.
 * `empty` and `error` are states of the SOURCE, decided by the digest and
 * never by age.
 */
export function freshness(ageSeconds: number | null, cadenceSeconds: number): "ok" | "stale" | "empty" {
  if (ageSeconds === null) return "empty";
  return ageSeconds <= cadenceSeconds * 3 ? "ok" : "stale";
}

/** A duration in words, rounded the way a person says it. German decimal comma is the renderer's job. */
export function agoWords(ageSeconds: number, lang: "de" | "en"): string {
  if (ageSeconds < 45) return lang === "de" ? "gerade eben" : "just now";
  const min = Math.round(ageSeconds / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  if (h < 24) return m === 0 ? `${h} h` : `${h} h ${m} min`;
  const d = Math.round(h / 24);
  return lang === "de" ? `${d} ${d === 1 ? "Tag" : "Tagen"}` : `${d} ${d === 1 ? "day" : "days"}`;
}

/** Thousands with the language's separator; never a cap, never a rounding (#377 "5000 reports"). */
export function figure(n: number, lang: "de" | "en"): string {
  return numberFormat(lang === "de" ? "de-DE" : "en-GB", { maximumFractionDigits: 0 }).format(n);
}

/** A €/l price with three decimals, the way the MTS-K publishes it. */
export function price(eurPerLitre: number, lang: "de" | "en"): string {
  return numberFormat(lang === "de" ? "de-DE" : "en-GB", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(eurPerLitre);
}
