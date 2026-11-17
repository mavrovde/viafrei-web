/**
 * The head of a page and its sections (#1173, owner: one pattern for every page type): `statusLine`, `topItems`,
 * `jumpLinks` and `sectionHead` are the ONE implementation of what a page says first, so a road page, a place page and
 * a station page read alike on a phone. Every package that draws one (the digest's fragments, the web shell's pages)
 * calls these; `packages/web/test/page-head-1173.test.ts` refuses a second copy of the markup.
 *
 * What the pattern holds:
 *   - **The status line**: a lamp, one counted sentence, the Stand. An unknown state is never drawn as a good one: its
 *     lamp is its own grey, and its sentence says that it is not known.
 *   - **The top items**: at most `TOP_ITEMS_MAX` on a phone and `TOP_ITEMS_DESK` from 1024 px (#1180), in
 *     `SEVERITY_ORDER`, each icon · what · where · since/until.
 *   - **The jump links**: one chip per NON-EMPTY section, with its count. An empty section gets no chip.
 *   - **A section's head**: an H2 with its count, so a collapsed section still says how much it holds.
 *
 * Pure, like the other builders: the words arrive escaped (`Html`), the targets as plain text, escaped here. The
 * sentences of the three states every page shares (nothing reported, stale, failed) are one key set in all languages
 * (`page-head-copy.ts`), so a state reads the same on every page type.
 */
import { esc, raw, type Html } from "./html.js";

/** What a lamp can say. `unknown` has its own colour: it is never the good one. */
export const STATUS_LAMPS = ["red", "amber", "green", "unknown"] as const;
export type StatusLamp = (typeof STATUS_LAMPS)[number];

/** The one order of what matters most (the owner's: closure > jam > disruption > roadworks > info). */
export const SEVERITY_ORDER = ["closure", "jam", "disruption", "roadworks", "info"] as const;
export type Severity = (typeof SEVERITY_ORDER)[number];

/** How many items stand on the first screen of a phone. */
export const TOP_ITEMS_MAX = 3;

/**
 * How many stand on the first screen of a desktop (#1180, from 1024 px). The rows after `TOP_ITEMS_MAX` are in the
 * markup with the class `topitems__extra` (its own class, so a row's modifier stays its severity), which the site's
 * stylesheet hides below 1024 px, so a phone reads the same three it read before and one render serves both. A caller that names the sources of the rows it shows counts
 * all `TOP_ITEMS_DESK` of them: a credit line never misses a row a desktop shows.
 */
export const TOP_ITEMS_DESK = 5;

/** How many rows a collapsed section shows. */
export const SECTION_ROWS = 3;

export type StatusLineInput = {
  readonly lamp: StatusLamp;
  /** The lamp's word for a screen reader ("Rot"); the sentence is what a person reads. */
  readonly lampWord: Html;
  /** The counted sentence ("6 Sperrungen, 1 Stau, 38 Baustellen"), or the shared state's. */
  readonly sentence: Html;
  /** "Stand 21:59", said by `standText` of the page's language; none when nothing was read. */
  readonly stand?: Html | null;
  /** The element's id, when a page has more than one and a test or a swap must tell them apart. */
  readonly id?: string;
};

/**
 * The lamp alone, the status line's own mark, for a row that carries one beside its own words (a town of a Land's
 * page, a Land of the index). With a word it is an image named by it; with none it is decoration, because the row
 * says the word in its text.
 */
export function statusLamp(lampWord: Html | null): Html {
  return raw(lampWord === null ? `<span class="statusline__lamp" aria-hidden="true"></span>` : `<span class="statusline__lamp" role="img" aria-label="${lampWord}"></span>`);
}

/** A lamp, one sentence, the Stand. */
export function statusLine(s: StatusLineInput): Html {
  const id = s.id === undefined ? "" : ` id="${esc(s.id)}"`;
  const stand = s.stand === undefined || s.stand === null ? "" : ` <span class="statusline__stand">· ${s.stand}</span>`;
  return raw(`<p class="statusline statusline--${s.lamp}"${id}>${statusLamp(s.lampWord)}<span class="statusline__text">${s.sentence}${stand}</span></p>`);
}

export type TopItem = {
  readonly severity: Severity;
  /** The word for what it is ("Sperrung"). */
  readonly what: Html;
  /** Where ("AS Köln-Ost – AS Köln-Mülheim"); may hold a link built from escaped text. */
  readonly where: Html;
  /**
   * Since or until, said in the page's language; none when not known. Several phrases ("seit … · bis …", #1312) are
   * each kept whole and the line may break between them, so a long pair cannot push a phone's page wide.
   */
  readonly when?: Html | readonly Html[] | null;
  /**
   * #1181 feature 3: the item's identity across visits ("jam|A3 | Köln-Ost - Leverkusen| Köln -> Frankfurt") and its
   * length (a jam's delay in minutes), written as `data-vf-key`/`data-vf-len` for the "since your last visit" marks of a
   * starred page; none: the row takes no mark.
   */
  readonly key?: string | null;
  readonly length?: number | null;
};

/** The order a page's items stand in: severity first; among equals the caller's order holds. */
export function bySeverity<T extends { readonly severity: Severity }>(items: readonly T[]): readonly T[] {
  return items.map((x, i) => ({ x, i })).sort((a, b) => SEVERITY_ORDER.indexOf(a.x.severity) - SEVERITY_ORDER.indexOf(b.x.severity) || a.i - b.i).map((e) => e.x);
}

/** The first `TOP_ITEMS_DESK` items by severity, as a list, the ones after `TOP_ITEMS_MAX` marked desktop-only; "" when there are none. */
export function topItems(items: readonly TopItem[], label: Html): Html {
  if (items.length === 0) return raw("");
  const rows = bySeverity(items)
    .slice(0, TOP_ITEMS_DESK)
    .map((x, i) => {
      const phrases: readonly Html[] = x.when === undefined || x.when === null ? [] : typeof x.when === "string" ? [x.when] : x.when;
      const when = phrases.map((w) => ` <span class="topitems__when">· ${w}</span>`).join("");
      const desk = i < TOP_ITEMS_MAX ? "" : " topitems__extra";
      const key = x.key === undefined || x.key === null ? "" : ` data-vf-key="${esc(x.key)}"${x.length === undefined || x.length === null ? "" : ` data-vf-len="${String(Math.round(x.length))}"`}`;
      return `<li class="topitems__row topitems__row--${x.severity}${desk}"${key}><span class="topitems__mark" aria-hidden="true"></span><span class="topitems__body"><strong class="topitems__what">${x.what}</strong> <span class="topitems__where">${x.where}</span>${when}</span></li>`;
    });
  return raw(`<ul class="topitems" aria-label="${label}">${rows.join("")}</ul>`);
}

export type JumpLink = {
  /** The section's id on this page. */
  readonly target: string;
  readonly label: Html;
  /** How many rows it holds. A section with none gets no chip; `null`: it holds something that is not counted. */
  readonly count: number | null;
};

/** One chip per non-empty section, with its count; "" when no section holds anything. */
/** One chip, for a section that stands in another fragment than the block's (a station's parking, #1175). */
export function jumpItem(l: JumpLink): string {
  return `<li><a class="jumps__chip" href="#${esc(l.target)}">${l.label}${l.count === null ? "" : ` <span class="jumps__n">${String(l.count)}</span>`}</a></li>`;
}

export function jumpLinks(links: readonly JumpLink[], label: Html): Html {
  const chips = links
    .filter((l) => l.count === null || l.count > 0)
    .map(jumpItem);
  return chips.length === 0 ? raw("") : raw(`<nav class="jumps" aria-label="${label}"><ul class="jumps__row">${chips.join("")}</ul></nav>`);
}

/** The head of a section: its H2 and how many rows it holds. */
export function sectionHead(s: { readonly id: string; readonly title: Html; readonly count?: number | null }): Html {
  const n = s.count === undefined || s.count === null ? "" : ` <span class="section__n">${String(s.count)}</span>`;
  return raw(`<h2 class="section__title" id="${esc(s.id)}">${s.title}${n}</h2>`);
}
