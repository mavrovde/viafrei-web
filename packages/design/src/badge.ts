/**
 * The motorway number badge (#945): the small "A4" road shield, drawn by one
 * renderer wherever a motorway number is shown. With a page to go to it is a
 * link to that page, named for a screen reader ("A4 – Autobahnseite", the
 * caller's words in the page's language); without one — a B or L road, a
 * number the register does not hold, or the motorway whose own page this is —
 * it is the plain badge it always was. The look is the badge's own (`.shield`);
 * a link differs only on hover and focus (site.css).
 */
import { C } from "./classes.js";
import { esc, raw, type Html } from "./html.js";

export type MotorwayBadge = {
  /** The page of this motorway, or null for a plain badge. */
  readonly href: string | null;
  /** The link's accessible name; it must contain the number as shown (WCAG 2.5.3). Ignored without `href`. */
  readonly label?: string;
  /** A modifier class after `shield` (the hero sign's `shield--route`). */
  readonly modifier?: string;
};

/** The badge of `road` (already escaped, as `Html`). */
export function motorwayBadge(road: Html, o: MotorwayBadge): Html {
  const cls = o.modifier === undefined ? C.shield : `${C.shield} ${esc(o.modifier)}`;
  if (o.href === null) return raw(`<span class="${cls}">${road}</span>`);
  const label = o.label === undefined ? "" : ` aria-label="${esc(o.label)}"`;
  return raw(`<a class="${cls}" href="${esc(o.href)}"${label} translate="no">${road}</a>`);
}
