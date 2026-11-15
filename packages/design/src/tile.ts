/**
 * THE TILE CONTRACT as code (#376 PR-02; prose in `design/components.md`),
 * shared by every package that draws a tile since #922 — the digest's
 * fragments, the web shell's error and loading tiles — instead of restated in a
 * comment where a package could not import the web shell.
 *
 * Four states rendered from DATA, as class names on the tile element:
 * `tile is-ok | is-stale | is-empty | is-error`. A fifth, `loading`, carries
 * no data at all: since 2.0 (#564, render-then-fill) it is the placeholder of
 * a tile that missed the first render's deadline, printed by ONE function
 * (the web shell's `lib/fill.ts` `tilePlaceholder`) and styled in `site.css`,
 * and it becomes one of the four — or the error state — when the background
 * fill answers. `RENDERED_STATES` is the list a DATA renderer may draw from.
 *
 * Colour is never the only signal: each state has a WORD (`tile.ok|stale|
 * empty|error`) and a SHAPE on the age pill (pulsing dot, square, dash,
 * triangle), so a monochrome print or a forced-colours mode still tells them
 * apart.
 */
export const TILE_STATES = ["ok", "stale", "empty", "error", "loading"] as const;
export type TileState = (typeof TILE_STATES)[number];

/** What a data renderer may emit. */
export const RENDERED_STATES = ["ok", "stale", "empty", "error"] as const satisfies readonly TileState[];
export type RenderedState = (typeof RENDERED_STATES)[number];

/** The state's class on the tile element; a state outside the rendered four is refused, never printed. */
export function stateClass(state: RenderedState): `is-${RenderedState}` {
  if (!(RENDERED_STATES as readonly string[]).includes(state)) throw new Error(`tile: '${String(state)}' is not a rendered state`);
  return `is-${state}`;
}
