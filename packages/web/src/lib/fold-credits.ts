/**
 * Data-steward ruling FS-2026-11-06 for the shell's own folds of EXAMPLES — the connect page's further questions and live
 * cards, the home's moments — whose credits are the register's lines as `CreditItem` `<li>`s, named by register id, not
 * the digest's `<p class="credit">` blocks (`@viafrei/design`'s `foldWhole` reads those).
 *
 * - FS5: an example crediting Tankerkönig never folds (#423: a price stands with its credit, in view).
 * - FS8: an example crediting a line of a licence class the ruling did not read (`unruledText`) never folds either — a
 *   `CreditItem` line cannot be lifted out of its answer. None is unruled since FS12 (the Autobahn GmbH's and the
 *   Chargepool AFIR offer's classes are ruled); the check stays for the next new class.
 * - FS3: a fold's summary names every publisher of the examples inside (`foldSourcesFor`).
 */
import catalogue from "../generated/catalogue.json" with { type: "json" };
import { foldSourcesFromTexts, unruledText } from "@viafrei/design";
import type { Lang } from "../site/pages.js";

const FUEL = new Set(["tankerkoenig", "tankerkoenig_hist"]);
const TEXT = new Map(catalogue.credits.map((c) => [c.id, c.text] as const));

/** Whether an example credited to these register ids may stand inside a fold (FS5, FS8). */
export function mayFold(ids: readonly string[]): boolean {
  return ids.every((id) => !FUEL.has(id) && !unruledText(TEXT.get(id) ?? ""));
}

/** FS3: the summary's "Quellen: …" line for the examples credited to these ids, each publisher once, whole. */
export function foldSourcesFor(lang: Lang, ids: readonly string[]): string {
  return foldSourcesFromTexts(
    lang,
    [...new Set(ids)].flatMap((id) => {
      const t = TEXT.get(id);
      return t === undefined ? [] : [t];
    }),
  );
}

/** #1179, #1182: how many examples of one list stand before its fold (the connect page's two lists, each domain of the examples page). */
export const EXAMPLES_OPEN = 3;
/**
 * The first `n` examples stand open, and so does every later one that may not fold (FS5, FS8), in its place; the rest
 * fold, in their order.
 */
export function splitFold<T>(items: readonly T[], n: number, idsOf: (x: T) => readonly string[]): { readonly open: readonly T[]; readonly folded: readonly T[] } {
  const open: T[] = [];
  const folded: T[] = [];
  items.forEach((x, i) => (i < n || !mayFold(idsOf(x)) ? open : folded).push(x));
  return { open, folded };
}
