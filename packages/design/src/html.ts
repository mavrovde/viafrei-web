/**
 * The building blocks of a tile as pure string builders (#922): the frame a
 * card sits in, not the card. Every package that draws a tile — the digest's
 * fragments, the web shell's error and loading tiles — calls these, so a
 * design change to the pill, the head or the credit line is one edit here.
 *
 * **Escaped by construction.** Content goes in as `Html`, a branded string
 * that only `esc()` (this module's escape) or `raw()` (markup a caller has
 * already escaped with its own helper — the digest's `safe()`, which also
 * masks) can make. `esc` refuses an `Html` at compile time, so a value is
 * escaped once and never twice. The builders interpolate `Html` and attribute
 * values through `esc`, and nothing else.
 *
 * **No direction is assumed.** The builders write no `dir`: a tile inherits
 * the page's, and a caller that must set one passes it (`dir`).
 */
import { C, HOOK } from "./classes.js";
import type { TileState } from "./tile.js";

declare const HTML: unique symbol;
/** Markup: escaped text, or elements built from escaped text. */
export type Html = string & { readonly [HTML]: true };
/** A string that is not already `Html` (`esc(esc(x))` is a type error). */
export type NotHtml<S extends string> = S extends { readonly [HTML]: true } ? never : S;

/** `&`, `<`, `>` and `"` as entities: safe in text and in a double-quoted attribute. */
export function esc<S extends string>(s: NotHtml<S>): Html {
  return (s as string).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;") as Html;
}

/** Markup the caller vouches for: escaped already by its own helper, or built from `Html`. */
export function raw(s: string): Html {
  return s as Html;
}

/** Extra attributes, in insertion order, each value escaped: ` name="value"`. */
export type Attrs = Readonly<Record<string, string>>;
const attrs = (a: Attrs | undefined): string =>
  a === undefined
    ? ""
    : Object.entries(a)
        .map(([k, v]) => ` ${k}="${esc(v)}"`)
        .join("");

/** The age pill: a dot the stylesheet shapes by state, the state's WORD, and the age when there is one. */
export function agePill(o: { readonly word: Html; readonly time?: Html; readonly wordAttrs?: Attrs }): Html {
  const time = o.time === undefined ? "" : `<span class="${HOOK.ageTime}">· ${o.time}</span>`;
  return raw(`<p class="${C.age}"><span class="${C.ageDot}" aria-hidden="true"></span><span class="${HOOK.ageState}"${attrs(o.wordAttrs)}>${o.word}</span>${time}</p>`);
}

/** The head: the title the tile is labelled by, then the pill. */
export function tileHead(titleId: string, title: Html, pill: Html): Html {
  return raw(`<header class="${C.tileHead}"><h3 class="${C.tileTitle}" id="${esc(titleId)}">${title}</h3>${pill}</header>`);
}

/** The figure, or the dash where there is none. */
export function tileFigure(value: Html | null, unit: Html): Html {
  return raw(`<p class="${C.tileFigure}"><span class="${C.tileNum} ${C.num}">${value ?? "—"}</span><span class="${C.tileUnit}">${unit}</span></p>`);
}

/** The tile's one sentence under the figure. */
export function tileNote(text: Html, a?: Attrs): Html {
  return raw(`<p class="${C.tileNote}"${attrs(a)}>${text}</p>`);
}

/** The frame of one credit line: German by rule (#377 R1), the body and anything after it the caller's. */
export function creditLine(o: { readonly body: Html; readonly after?: Html; readonly modifier?: string }): Html {
  return raw(`<p class="${C.credit}${o.modifier === undefined ? "" : ` ${esc(o.modifier)}`}" lang="de">${o.body}${o.after ?? ""}</p>`);
}

export type TileShell = {
  /** The tile id; the element is `tile-<id>` and is labelled by `tile-<id>-title`. */
  readonly id: string;
  readonly state: TileState;
  readonly title: Html;
  readonly pill: Html;
  /** The figure; its value is suppressed (the dash) when the tile has no credit line (#377 R3: no figure without its source). */
  readonly figure?: { readonly value: Html | null; readonly unit: Html };
  readonly note?: Html;
  readonly body?: Html;
  /** One credit line per source; none renders no foot at all. */
  readonly credits: readonly Html[];
  /** Attributes after `aria-labelledby` (the loading tile's fill hooks). */
  readonly attrs?: Attrs;
  /** Only when a caller must override the page's direction. */
  readonly dir?: "ltr" | "rtl" | "auto";
  /** Extra class tokens on the root, after the state (#717 C-4: the fuel tile's `vf-noclarity` region marker). */
  readonly marker?: string;
};

/** The one shape every tile has: head with the pill, the figure, the note, a body, the credit foot. */
export function tileShell(t: TileShell): Html {
  const id = esc(t.id);
  const titleId = `tile-${t.id}-title`;
  const credits = t.credits.join("");
  const figure = t.figure === undefined ? "" : tileFigure(credits === "" ? null : t.figure.value, t.figure.unit);
  return raw(
    `<section class="${C.tile} is-${t.state}${t.marker === undefined ? "" : ` ${esc(t.marker)}`}" id="tile-${id}" aria-labelledby="${esc(titleId)}"${attrs(t.attrs)}${t.dir === undefined ? "" : ` dir="${t.dir}"`}>` +
      tileHead(titleId, t.title, t.pill) +
      figure +
      (t.note ?? "") +
      (t.body === undefined || t.body === "" ? "" : `<div class="${C.tileBody}">${t.body}</div>`) +
      (credits === "" ? "" : `<footer class="${C.tileFoot}">${credits}</footer>`) +
      `</section>`,
  );
}
