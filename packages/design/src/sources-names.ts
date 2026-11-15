/**
 * The names of a fragment's publishers, read off its credit lines (#1120's short-name rule), and the one visible line a
 * folded card or tile carries in its summary: "Quellen: <Herausgeber>, …" (data-steward ruling FS-2026-11-06, FS3).
 * A projection of the register lines the fold carries, never typed by hand: every `<p class="credit …">` block of the
 * fragment is read, each publisher is named once and whole, and no "und N weitere" is ever written. The digest's
 * sources component (`sources-html.ts`) and the web shell's tiles both read this one implementation.
 */
import { PAGE_HEAD_COPY, type PageHeadLang } from "./page-head-copy.js";
import { creditBlocks, dropDelimited } from "./scan.js";

const ENTITIES: Readonly<Record<string, string>> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&#x27;": "'" };
/** A block's visible text: tags dropped, the five entities `safe` writes read back. */
export function textOf(html: string): string {
  // the tags dropped in one pass (`/<[^>]*>/g`, linear): the result is TEXT, entities read back, escaped by every caller
  return dropDelimited(html, "<", ">")
    .replace(/&(?:amp|lt|gt|quot|#39|#x27);/gu, (m) => ENTITIES[m] ?? m)
    .replace(/\s+/gu, " ")
    .trim();
}

/** Where a clause after the provider begins: a route, a licence, a dataset, a dash. */
const CLAUSES = [" · ", " via ", ", ", "; ", " (", " — ", " – ", " - "];

/**
 * Where a sentence ends: ". " after a plain word of four letters or more. "Deutscher Wetterdienst. Datenquelle: …" ends
 * at the institute; "DELFI e.V. via", "Ampeco Ltd. (EDRI)", "Road B.V. (…)", "Grid & Co. GmbH" do not end at the dot.
 */
function sentenceEnd(s: string): number {
  // `/(\S+)\. /g` matches only where a word begins, as the word less its final dot when a space follows: read word by
  // word (linear) rather than letting the expression restart inside every word (quadratic on a long one)
  for (const m of s.matchAll(/\S+/gu)) {
    const end = m.index + m[0].length - 1;
    if (m[0].length >= 2 && s[end] === "." && s[end + 1] === " " && /^\p{L}{4,}$/u.test(m[0].slice(0, -1))) return end;
  }
  return -1;
}

/**
 * A credit line's provider, short: the register's text after its topic ("Ladepunkte: ") up to the first licence,
 * dataset or route clause or the end of a sentence. A label before a second colon ("Datenquelle: dl-de/by-2-0:
 * Landeshauptstadt München – …") is passed over too. "Fahrplandaten: DELFI e.V., CC BY 4.0, bearbeitet" is "DELFI e.V.";
 * "Verwaltungseinheiten: © BKG (2026) dl-de/by-2-0, …" is "© BKG". The name is never shortened inside itself: a long
 * one ("Landesbetrieb Straßenbau und Verkehr Schleswig-Holstein") is shown whole.
 */
export function shortSource(text: string): string {
  const colon = text.indexOf(": ");
  let tail = colon >= 0 && colon < 80 ? text.slice(colon + 2) : text;
  let head = tail;
  for (let i = 0; i < 4; i++) {
    const cut = Math.min(...[...CLAUSES.map((c) => tail.indexOf(c)), sentenceEnd(tail)].filter((n) => n > 0), tail.length);
    head = tail.slice(0, cut).trim();
    const inner = head.indexOf(": ");
    if (inner < 0) break;
    tail = tail.slice(inner + 2);
  }
  // never cut: "Landesbetrieb Straßenbau und Verkehr…" names no Land, and a DL-DE BY / GeoNutzV provider must be named
  // in view (#1120 ruling) — a long name wraps on a phone instead
  return head;
}

/**
 * Every publisher of a fragment's credit lines, once each, in the order their lines stand. A `credit--note` line is a
 * condition sentence, not a publisher's line (its publisher is named on its own credit line), so it names no one.
 */
export function creditNames(html: string): readonly string[] {
  const lines = creditBlocks(html).filter((b) => !/^<p class="credit credit--note[ "]/u.test(b));
  return [...new Set(lines.map((b) => shortSource(textOf(b))).filter((n) => n !== ""))];
}

const escape = (s: string): string => s.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;").replace(/"/gu, "&quot;");

/**
 * FS3: the line a folded card or tile carries in its `<summary>` — so activating it opens the fold — naming every
 * publisher of the credit lines inside, each a proper name marked `translate="no"` (#1051). Empty when nothing inside
 * credits anyone.
 */
export function foldSourcesHtml(lang: PageHeadLang, foldedHtml: string): string {
  return sourcesLineHtml(lang, creditNames(foldedHtml));
}

/**
 * FS3 for a fold whose credits are the register's lines as `<li>` items (the web shell's `CreditItem`: the connect
 * page's examples, the home's moments) rather than `<p class="credit">` blocks: the same line, from the lines' texts.
 */
export function foldSourcesFromTexts(lang: PageHeadLang, texts: readonly string[]): string {
  return sourcesLineHtml(lang, [...new Set(texts.map((t) => shortSource(t.replace(/\s+/gu, " ").trim())).filter((n) => n !== ""))]);
}

function sourcesLineHtml(lang: PageHeadLang, names: readonly string[]): string {
  if (names.length === 0) return "";
  const list = names.map((n) => `<span translate="no">${escape(n)}</span>`).join(", ");
  return `<span class="fold__sources">${escape(PAGE_HEAD_COPY[lang].sources).replace("{list}", list)}</span>`;
}

/** One publisher a page's first block names (FS11a): its name, read off a register line, and where its credits stand. */
export type PageSource = { readonly name: string; readonly href: string };

/** The publishers of register lines (their texts), each linked to `href`: the names FS11a's line is built from. */
export function sourcesOfTexts(texts: readonly string[], href: string): readonly PageSource[] {
  return texts.map((t) => ({ name: shortSource(t.replace(/\s+/gu, " ").trim()), href })).filter((x) => x.name !== "");
}

/** The publishers of a fragment's credit lines ({@link creditNames}), each linked to `href`. */
export function sourcesOfHtml(html: string, href: string): readonly PageSource[] {
  return creditNames(html).map((name) => ({ name, href }));
}

/**
 * FS11a (data-steward ruling FS-2026-11-06, addendum): the line a page's first block (`#page-first`) carries under its
 * status line and top items — "Quellen: <Herausgeber>, …" — naming every publisher whose rows the block states, each
 * once, whole and `translate="no"`, linked to the credits of the card its data stands in (the first such card when two
 * hold it). Never "und N weitere"; "" when the block states nothing sourced (the error and stale sentences).
 */
export function pageSourcesHtml(lang: PageHeadLang, sources: readonly PageSource[]): string {
  const seen = new Map<string, string>();
  for (const s of sources) if (s.name !== "" && !seen.has(s.name)) seen.set(s.name, s.href);
  if (seen.size === 0) return "";
  const list = [...seen].map(([n, href]) => `<a class="pagefirst__src" href="${escape(href)}"><span translate="no">${escape(n)}</span></a>`).join(", ");
  return `<p class="pagefirst__sources">${escape(PAGE_HEAD_COPY[lang].sources).replace("{list}", list)}</p>`;
}

/**
 * FS11b: the full register lines of an `ALWAYS_SHOWN` source whose data the block's sentence or items state, verbatim
 * and once each, in the markup the place Ampel gives a reason's line (`<span class="ampel__src" lang="de">`, German like
 * every credit line); "" when there are none.
 */
export function pageLinesHtml(lines: readonly string[], o: { readonly desk?: boolean } = {}): string {
  const xs = [...new Set(lines.filter((t) => t.trim() !== ""))];
  // #1180: the lines of the rows a desktop alone shows (`TOP_ITEMS_DESK`) stand beside them there and nowhere else
  const cls = o.desk === true ? "pagefirst__lines pagefirst__lines--desk" : "pagefirst__lines";
  return xs.length === 0 ? "" : `<p class="${cls}">${xs.map((t) => `<span class="ampel__src" lang="de">${escape(t)}</span>`).join(" ")}</p>`;
}

/** A fold's whole summary: its "… anzeigen" label (already HTML), then its FS3 sources line. */
export function foldSummaryHtml(lang: PageHeadLang, labelHtml: string, foldedHtml: string): string {
  return `<span class="fold__label">${labelHtml}</span>${foldSourcesHtml(lang, foldedHtml)}`;
}

/**
 * FS8: the licence classes data-steward ruling FS-2026-11-06 read and allowed to fold WITH their data, as the register
 * (`packages/mcp/src/presentation/attribution.ts`) writes them. A class not on this list may not fold until the steward
 * adds it; its credit lines are named in {@link FOLD_UNRULED_CREDITS} so a fold can keep them in view, and the register
 * test (`fold-fs8.test.ts`) refuses a row whose class is neither ruled nor matched there.
 */
export const FOLD_RULED_LICENCES: readonly string[] = [
  "CC BY 4.0",
  "CC BY-SA 4.0",
  "CC BY",
  "CC BY-SA",
  "CC BY 3.0 DE",
  "dl-de/by-2-0",
  "Datenlizenz Deutschland – Namensnennung – Version 2.0",
  "GeoNutzV",
  "ODbL 1.0",
  "Nutzungsbedingungen Toll Collect SID 1.0",
  "CC0 1.0",
  "dl-de/zero-2-0",
  "LICENSE_FREE_USE_OPEN_DATA",
  // the ALD 14d and AkD rows ("no licence named" in the ruling's table)
  "LICENSE_RESTRICTED_USE_FREE_OF_CHARGE",
  "AFIR Art. 20, keine Lizenz angegeben",
  // FS12 (addendum of 2026-11-06): the two classes FS8 held back, Allowed (FS1–FS4) — the Autobahn GmbH publishes no
  // licence, terms or reuse sentence (FS12a; FS3 name "Autobahn GmbH des Bundes"), and the Chargepool AFIR offer's
  // "lizenzfrei" sets no placement (FS12b; its full line stands verbatim inside the fold, C1 of #1021)
  "open data (Autobahn GmbH)",
  "lizenzfrei (conditionForUse)",
  // ViaFrei's own words, crediting no provider
  "ViaFrei editorial content (informational, not legal advice)",
  "ViaFrei service metadata (no provider data)",
];

/**
 * FS8: the credit lines of register classes the ruling did not read. Such a line never folds: a fold that holds one keeps
 * it in view beside the fold. Empty since FS12 (2026-11-06) ruled the two it held (the Autobahn GmbH's, the Chargepool
 * AFIR offer's "lizenzfrei"); FS8 continues — a row of a new class is either added to {@link FOLD_RULED_LICENCES} by the
 * steward or named here, and the register test (`fold-fs8.test.ts`) refuses one that is neither.
 */
export const FOLD_UNRULED_CREDITS: readonly RegExp[] = [];

/** Whether a credit line belongs to a class the ruling did not read (FS8): it stays in view. */
export function unruledCredit(block: string): boolean {
  return unruledText(textOf(block));
}

/** {@link unruledCredit} for a register line's plain text (a `CreditItem`'s `c.text`). */
export function unruledText(text: string): boolean {
  return FOLD_UNRULED_CREDITS.some((re) => re.test(text));
}
