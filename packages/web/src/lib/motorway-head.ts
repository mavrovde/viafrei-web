/**
 * What a motorway page is found by (#716, 2.1.17), read off the digest's
 * fragment: the shell reads no database (A2), so the per-motorway title, meta
 * description and factual intro are built where the rows are
 * (`packages/digest/src/presentation/motorway-seo.ts`) and carried here on the
 * fragment itself —
 *
 *   - the title and the description as `data-title` / `data-description` on
 *     the fragment's root element, which this module reads and STRIPS (they
 *     are head material, not page text);
 *   - the intro as the root's first element, `<p class="lead motorway__intro">`,
 *     which this module lifts out so the layout prints it under the `<h1>`.
 *
 * A fragment that carries none of them (an older digest, a page that holds no
 * fact) leaves the layout on its own catalogue: `motorwayMeta` and the
 * generic lead. A value that is not plausibly ours — empty, over the bound,
 * not naming the road — is ignored rather than printed.
 */

export type MotorwayHead = {
  /** The fragment without the head attributes and without the intro. */
  readonly html: string;
  readonly title: string | null;
  readonly description: string | null;
  /** #1173: the status block of the whole road, the digest's markup, lifted under the H1; null when the fragment holds none. */
  readonly first: string | null;
  /** The intro paragraph's inner HTML (the digest's escaped text and `translate="no"` names), or null. */
  readonly intro: string | null;
  /**
   * 2.5.17: the junctions with something reported now ("Betroffen: AS X, AK Y.", #1110 item 2), the note the digest
   * writes right under a road's course (#1173 AC 7, 7bbd2b7bd) — its inner HTML, lifted with the intro so the Ampel
   * stays the first thing after the head; null when the fragment holds none.
   */
  readonly note: string | null;
  /**
   * #1025: an exit page's robots, as the digest's exit rule decided it (`index, follow` or `noindex, follow`), or null
   * when the fragment carries none (any page that is not an exit page). Anything else is not the digest's and is null.
   */
  readonly robots: "index, follow" | "noindex, follow" | null;
  /** #1025: the junction an exit page is about — its name and its LCL point (null when the fragment names none). */
  readonly exit: { readonly name: string; readonly lat: number | null; readonly lon: number | null } | null;
  /**
   * #1110 item 1: an interchange page's ONE address — the exit page of the same Kreuz on the motorway first in the
   * register's order — in this page's language; null when the fragment names none, or names anything that is not an
   * exit page's path in that language.
   */
  readonly canonical: `/${string}` | null;
};

/** What a result page shows, with headroom: anything longer is not the digest's (`fitTitle` fits it to the page). #1110: 100, an interchange's two names. */
export const HEAD_TITLE_LIMIT = 100;
export const HEAD_DESCRIPTION_LIMIT = 200;

const ROOT = /^<section class="motorway" id="motorway"([^>]*)>/;
const FIRST = /^<div class="pagefirst" id="page-first">([\s\S]*?)<\/div><!--\/page-first-->/;
const INTRO = /^<p class="lead motorway__intro">((?:(?!<\/?p[\s>])[\s\S])*)<\/p>/;
/** The note under the intro, exactly this class (an Ampel's or a panel's note carries a second one). */
const NOTE = /^<p class="motorway__note">((?:(?!<\/?p[\s>])[\s\S])*)<\/p>/;

/** The five entities `safe()` writes, undone (the layout escapes again when it prints the value). */
export function unescapeAttr(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|#39);/g, (_, e: string) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" })[e] ?? "");
}

function attr(attrs: string, name: string): string | null {
  const m = new RegExp(` ${name}="([^"]*)"`).exec(attrs);
  return m === null ? null : unescapeAttr(m[1] ?? "");
}

/**
 * Plausibly the digest's: non-empty after trimming, within the bound, naming the road (or, #1110, the junction the page
 * is about: an interchange's title names the Kreuz alone), no markup and no placeholder left.
 */
function plausible(v: string | null, road: string, limit: number, about: string | null = null): string | null {
  if (v === null) return null;
  const t = v.trim();
  if (t === "" || t.length > limit || !(t.includes(road) || (about !== null && t.includes(about))) || /[<>{}]|\bundefined\b|\bnull\b/.test(t)) return null;
  return t;
}

/** #1110: an exit page's path in `lang` — `/<lang>/autobahn/<road>/exit-…` — or null. */
const EXIT_PATH = /^\/([a-z]{2})\/autobahn\/a\d{1,3}\/exit-[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A coordinate the digest wrote (five decimals, inside `lo`–`hi`), or null. */
function coord(v: string | null, lo: number, hi: number): number | null {
  if (v === null || !/^\d{1,2}\.\d{5}$/.test(v)) return null;
  const n = Number(v);
  return n >= lo && n <= hi ? n : null;
}

/** An exit's name as the digest wrote it: a short proper name, no markup, no slot. */
function exitNameOf(v: string | null): string | null {
  if (v === null) return null;
  const t = v.trim();
  return t === "" || t.length > 80 || /[<>{}]|\bundefined\b|\bnull\b/.test(t) ? null : t;
}

export function motorwayHeadOf(road: string, fragment: string, lang: string | null = null): MotorwayHead {
  const root = ROOT.exec(fragment);
  if (root === null) return { html: fragment, title: null, description: null, first: null, intro: null, note: null, robots: null, exit: null, canonical: null };
  const attrs = root[1] ?? "";
  const name = exitNameOf(attr(attrs, "data-exit"));
  const title = plausible(attr(attrs, "data-title"), road, HEAD_TITLE_LIMIT, name);
  const description = plausible(attr(attrs, "data-description"), road, HEAD_DESCRIPTION_LIMIT);
  const r = attr(attrs, "data-robots");
  const robots = r === "index, follow" || r === "noindex, follow" ? r : null;
  const exit = name === null ? null : { name, lat: coord(attr(attrs, "data-exit-lat"), 47, 56), lon: coord(attr(attrs, "data-exit-lon"), 5, 16) };
  const c = attr(attrs, "data-canonical");
  const cm = c === null ? null : EXIT_PATH.exec(c);
  const canonical = c !== null && cm !== null && exit !== null && (lang === null || cm[1] === lang) ? (c as `/${string}`) : null;
  const kept = attrs.replace(/ data-(?:title|description|robots|exit|exit-lat|exit-lon|canonical)="[^"]*"/g, "");
  let rest = fragment.slice(root[0].length);
  let intro: string | null = null;
  let note: string | null = null;
  const firstMatch = FIRST.exec(rest);
  const first = firstMatch === null ? null : (firstMatch[1] ?? "");
  if (firstMatch !== null) rest = rest.slice(firstMatch[0].length);
  const m = INTRO.exec(rest);
  if (m !== null && (m[1] ?? "").trim() !== "") {
    intro = m[1] ?? "";
    rest = rest.slice(m[0].length);
    // 2.5.17: left in the fragment, this note stood between the root and the Ampel, so `liftAmpel` (anchored) lifted
    // nothing and every road with a reported junction lost its first-screen lamp
    const n = NOTE.exec(rest);
    if (n !== null && (n[1] ?? "").trim() !== "") {
      note = n[1] ?? "";
      rest = rest.slice(n[0].length);
    }
  }
  return { html: `<section class="motorway" id="motorway"${kept}>${rest}`, title, description, first, intro, note, robots, exit, canonical };
}

const INDEX_ROOT = /^<section class="motorways" id="motorway-index"([^>]*)>/;

/**
 * #1028: the motorway index's description, read off the digest's index fragment (`data-description`, the national
 * sums in words) and STRIPPED; null when the fragment carries none (no current read) or one that is not plausibly
 * the digest's — the layout then keeps the catalogue's.
 */
export function motorwayIndexHeadOf(fragment: string): { readonly html: string; readonly description: string | null } {
  const root = INDEX_ROOT.exec(fragment);
  if (root === null) return { html: fragment, description: null };
  const attrs = root[1] ?? "";
  const v = attr(attrs, "data-description")?.trim() ?? null;
  const description = v === null || v === "" || v.length > HEAD_DESCRIPTION_LIMIT || /[<>{}]|\bundefined\b|\bnull\b/.test(v) ? null : v;
  const kept = attrs.replace(/ data-description="[^"]*"/g, "");
  return { html: `<section class="motorways" id="motorway-index"${kept}>${fragment.slice(root[0].length)}`, description };
}
