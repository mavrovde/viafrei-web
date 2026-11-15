/**
 * "Alle · Keine" (#1158, owner 2026-11-03: "one 'show all' / 'none' component with one style on every page"): the ONE
 * way any surface offers to select every option of a choice, or none — the place cards' topic bar
 * (`packages/web/src/lib/topic-filter.ts`, and its "nothing chosen" line), the motorway page's type bar
 * (`packages/web/src/lib/motorway-filter.ts`) and the motorway layers' choice (`packages/digest/src/presentation/
 * motorway-layers-html.ts`). It used to be three markups and three styles: two links with a "·" between them, two
 * `.btn` buttons, and two links inside a span of their own. No second copy of its markup or its styling exists
 * (`test/all-none.test.ts` holds every surface to it).
 *
 * What it is, as markup:
 *   - a `<span class="all-none">` holding the "all" control and, when given, a "·" (hidden from a screen reader, which
 *     hears two controls) and the "none" control;
 *   - each control a link when it has a target (`href`: it works without a script, and a script may take its click),
 *     else a button (`type="button"`, for a surface that exists only with a script); named in full for a screen reader
 *     (`aria-label`, the visible word inside it), and styled once, by `.all-none__opt` (site.css) — at least 44 px tall;
 *   - each carries its surface's HOOK as well (`AllNoneHook`): the class that surface's script finds it by. A hook is
 *     never styled (the test refuses a rule that names one), so the style cannot drift apart again by surface.
 *
 * Pure: a function of its arguments; the words arrive as `Html` (escaped by the caller), the target as plain text,
 * escaped here.
 */
import { C } from "./classes.js";
import { esc, raw, type Html } from "./html.js";

/** The class each surface's own script finds its control by — never styled (`test/all-none.test.ts`). */
export const ALL_NONE_HOOKS = ["tpf__all", "tpf__none", "mwf__all", "mwf__none", "motorway__layerall", "motorway__layernone"] as const;
export type AllNoneHook = (typeof ALL_NONE_HOOKS)[number];

export type AllNoneOption = {
  /** The visible word ("Alle", "Keine"). */
  readonly text: Html;
  /** The full name a screen reader hears ("Alle anzeigen – alle Themen auswählen"). */
  readonly label: Html;
  readonly hook: AllNoneHook;
  /** The link's target; none: a button, for a surface that exists only with a script. */
  readonly href?: string;
};

function option(o: AllNoneOption): string {
  const cls = `${C.allNoneOpt} ${o.hook}`;
  return o.href === undefined ? `<button type="button" class="${cls}" aria-label="${o.label}">${o.text}</button>` : `<a class="${cls}" href="${esc(o.href)}" aria-label="${o.label}">${o.text}</a>`;
}

/** The control: "all", and "none" when given. */
export function allNone(c: { readonly all: AllNoneOption; readonly none?: AllNoneOption }): Html {
  const none = c.none === undefined ? "" : `<span class="${C.allNoneSep}" aria-hidden="true"> · </span>${option(c.none)}`;
  return raw(`<span class="${C.allNone}">${option(c.all)}${none}</span>`);
}
