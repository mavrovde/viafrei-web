/**
 * Today's timeline (#1181 feature 2): one strip of the day's hours, each a bar whose level is how much was reported
 * then, and for each hour with something reported a panel saying what — shown by `:target`, so tapping an hour works
 * with no script (the pages' CSP runs none here). One implementation for every page type that draws a day (a road page
 * today; a place or a station page draws the same strip from its own hours).
 *
 * Pure, like the other builders: the words arrive escaped (`Html`), the ids as plain text, escaped here. A gap (an hour
 * not observed) and a later hour have their own modifiers: neither is ever drawn as a quiet hour.
 */
import { esc, raw, type Html } from "./html.js";

export const TIMELINE_LEVELS = [0, 1, 2, 3] as const;
export type TimelineLevel = (typeof TIMELINE_LEVELS)[number];

export type TimelineBar =
  | { readonly kind: "later" | "gap"; readonly label: string; readonly aria: Html }
  /** `panel`: what was reported then, or null when nothing was (the bar then links nowhere). */
  | { readonly kind: "seen"; readonly label: string; readonly level: TimelineLevel; readonly aria: Html; readonly panel: Html | null };

export type TimelineInput = {
  /** The element's id; each hour's panel is `<id>-<label>`. */
  readonly id: string;
  readonly head: Html;
  /** The day's one sentence when nothing was reported in any observed hour ("heute bisher nichts gemeldet"); null otherwise. */
  readonly quiet: Html | null;
  readonly bars: readonly TimelineBar[];
};

function barHtml(id: string, b: TimelineBar): string {
  const label = esc(b.label);
  if (b.kind !== "seen") return `<li class="timeline__bar timeline__bar--${b.kind}" aria-label="${b.aria}"><span>${label}</span></li>`;
  const cls = `timeline__bar timeline__bar--l${String(b.level)}`;
  if (b.panel === null) return `<li class="${cls}" aria-label="${b.aria}"><span>${label}</span></li>`;
  return `<li class="${cls}"><a href="#${esc(`${id}-${b.label}`)}" aria-label="${b.aria}">${label}</a></li>`;
}

/** The strip, then the panels of the hours with something reported. */
export function dayTimelineHtml(t: TimelineInput): Html {
  const bars = t.bars.map((b) => barHtml(t.id, b)).join("");
  const panels = t.bars
    .flatMap((b) => (b.kind === "seen" && b.panel !== null ? [`<div class="timeline__panel" id="${esc(`${t.id}-${b.label}`)}" tabindex="-1">${b.panel}</div>`] : []))
    .join("");
  const quiet = t.quiet === null ? "" : `<p class="timeline__quiet">${t.quiet}</p>`;
  return raw(`<section class="timeline" id="${esc(t.id)}" aria-labelledby="${esc(`${t.id}-h`)}"><h3 class="timeline__head" id="${esc(`${t.id}-h`)}">${t.head}</h3><ol class="timeline__bars">${bars}</ol>${quiet}${panels}</section>`);
}
