/**
 * The home's own last good fragments (#772).
 *
 * The home asks the digest for its live blocks — the tiles, the "Heute" facts,
 * the pending transit slot and the motorway panel — under the panel deadline
 * (`PANEL_DEADLINE_MS`). A block that missed it used to be dropped (a fact, the
 * transit slot, the motorway panel) or printed as a loading placeholder (a
 * tile), so two visitors a second apart could get two different pages, and
 * `the public smoke` saw exactly that fork between its two vantages after the
 * 2.1.19 deploy. The digest was holding a good render the whole time; the
 * shell had nothing of its own to answer with.
 *
 * So the shell keeps the last good answer of each home block per language,
 * and a block that does not arrive (a timeout, a refused connection, a 5xx) is
 * answered from it while it is young enough to be true:
 *  - a tile or a fact for at most its OWN cadence (`Tile-Cadence-Seconds`,
 *    the digest's statement of how often that figure changes): its age pill
 *    says "vor 4 min" relative to the round it was rendered from, so a kept
 *    copy may understate its age by at most one cadence — never by more;
 *  - the motorway panel for at most `MOTORWAY_TOP_KEPT_SECONDS`, the age the
 *    digest itself answers a held panel to (its `MOTORWAY_STALE_MAX_SECONDS`,
 *    two Autobahn sweeps, pinned equal by `test/home-kept.test.ts`): it carries
 *    an absolute Stand, so a kept copy states its own time.
 * A 404 (the licence gate's answer) and a fragment that is not live (the
 * digest said "no figure") are answers, never replaced by a kept copy.
 *
 * Never evicted, and bounded by construction: the keys are a closed set —
 * every home slot in every live language (`HOME_KEPT_SLOTS`), each a small
 * fragment — so nothing a visitor sends can add one, and a motorway page or a
 * place card can never push a home block out (the 16 MiB motorway LRU of
 * `lib/motorway.ts` drops the home's panel the moment a crawler walks the
 * motorway pages).
 */
import { LIVE_LANGS, type Lang } from "../site/pages.js";

/** The motorway panel's kept age, s: the digest's `MOTORWAY_STALE_MAX_SECONDS` (the shell imports no digest module; the test holds them equal). */
export const MOTORWAY_TOP_KEPT_SECONDS = 600;

/** A home slot: a tile, a fact, the pending slot, or the motorway panel. Type-only, so this module imports nothing of `tiles.ts`. */
export type HomeSlot = `tile-${string}` | `fact-${string}` | `pending-${string}` | "motorway-top" | "station-top";
export type HomeKey = `${HomeSlot}|${Lang}`;

type Kept = { readonly at: number; readonly html: string; readonly maxAgeMs: number; readonly cadenceSeconds: number | null };
const kept = new Map<HomeKey, Kept>();
/** The slots a key may name, set once by `declareHomeSlots` (tiles.ts declares its own); a key outside them is never kept. */
const declared = new Set<HomeSlot>(["motorway-top"]);

/** Declare home slots (each module that owns one does, at load). */
export function declareHomeSlots(slots: readonly HomeSlot[]): void {
  for (const s of slots) declared.add(s);
}

/** How many keys there can ever be: every declared slot in every live language. */
export function homeKeptCapacity(): number {
  return declared.size * LIVE_LANGS.length;
}

/** Keep a good answer of a home block, valid for `maxAgeSeconds`. A slot that was not declared, or a non-positive age, is not kept. */
export function keepHome(slot: HomeSlot, lang: Lang, html: string, maxAgeSeconds: number, cadenceSeconds: number | null = null, now: number = Date.now()): void {
  if (!declared.has(slot) || !(maxAgeSeconds > 0) || html === "") return;
  kept.set(`${slot}|${lang}`, { at: now, html, maxAgeMs: maxAgeSeconds * 1000, cadenceSeconds });
}

/** The kept answer of a home block while it is young enough, else null. */
export function keptHome(slot: HomeSlot, lang: Lang, now: number = Date.now()): { readonly html: string; readonly cadenceSeconds: number | null } | null {
  const k = kept.get(`${slot}|${lang}`);
  if (k === undefined || now - k.at >= k.maxAgeMs) return null;
  return { html: k.html, cadenceSeconds: k.cadenceSeconds };
}

/** Forget every kept block (tests). */
export function clearHomeKept(): void {
  kept.clear();
}

/** How many blocks are kept (tests). */
export function homeKeptSize(): number {
  return kept.size;
}
