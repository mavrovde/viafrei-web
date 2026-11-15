/**
 * One live answer as HTML (#744, #745): the `.qa-answer` card the moments use —
 * a head with "live", the data's time in an age pill and the tool; the
 * sentence, with the data's names `translate="no"`; a register credit line per
 * answering source; the result's legal notes verbatim, in German; the ODbL
 * offer when an ODbL database answered.
 *
 * A string, not a component, because the place cards are a digest fragment the
 * shell splices answers into (`lib/place-asks.ts`); the home's `LiveAsk` and the
 * sign use the same functions, so a live answer is credited the same wherever
 * it stands. The credit line is `CreditItem.astro`'s markup, and
 * `test/answer-html.test.ts` holds the two to the same output.
 */
import type { ConnectSource } from "@viafrei/design";
import catalogue from "../generated/catalogue.json" with { type: "json" };
import { datedCredit } from "../site/attribution-year.js";
import { t } from "../i18n/index.js";
import { pathFor, type Lang } from "../site/pages.js";
import { answerParts, answerState, answerTime, type AskEntry } from "./ask.js";
import { connectNoteHtml } from "./connect-note.js";

type Credit = (typeof catalogue.credits)[number];

const ESC: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s: string): string => s.replace(/[&<>"']/gu, (c) => ESC[c] ?? c);

/**
 * `CreditItem.astro`, as a string. `summarised`: the sentence is our summary of the source's values, so a source that
 * prescribes a line for that case (`altered`, the DWD's "Datenbasis: …, zusammengefasst") is credited by it, never by its
 * "Quelle:" line (data-steward 2026-10-15, C1); its licence link stays.
 */
export function creditHtml(c: Credit, lang: Lang, summarised = false, now: Date = new Date()): string {
  // #804: a line naming the year of retrieval says the reader's Berlin year, by this request's clock.
  const own = summarised && c.altered !== null ? datedCredit(c.altered, now) : null;
  const body =
    c.parts !== null && own === null
      ? c.parts.map((p) => (p.href === null ? esc(p.text) : `<a href="${esc(p.href)}" rel="license noopener noreferrer">${esc(p.text)}</a>`)).join("")
      : `<a href="${esc(c.url)}" rel="noopener noreferrer">${esc(own ?? datedCredit(c.text, now))}</a>` +
        (c.licence !== null ? ` · <a class="credit__licence" href="${esc(c.licence.url)}" rel="license noopener noreferrer" lang="${lang}">${esc(t(lang, "sources.licenceText"))}</a>` : "");
  const condition = c.condition !== null ? `<br><span class="credit__condition">${esc(c.condition)}</span>` : "";
  return `<li lang="de">${body}${condition}</li>`;
}

/** The ODbL databases an answer may come from, and the name its § 4.6 offer gives each (the digest's, on the place cards). */
export const ODBL_OSM = "osm";
export const ODBL_DATABASES: Readonly<Record<string, string>> = { mobilithek_park_trucklounge: "Trucklounge Ecopark", mobilithek_park_trucklounge_occ: "Trucklounge Ecopark" };

const HOLE = "\u0000";
/** A deck sentence with markup in its holes: the words escaped, each `{name}` replaced by its HTML. */
function fillHtml(lang: Lang, key: "ask.offerOsm" | "ask.offerDb", holes: Readonly<Record<string, string>>): string {
  const names = Object.keys(holes);
  const text = t(lang, key, Object.fromEntries(names.map((k, i) => [k, `${HOLE}${String(i)}${HOLE}`])));
  return text
    .split(HOLE)
    .map((part, i) => (i % 2 === 1 ? (holes[names[Number(part)] ?? ""] ?? "") : esc(part)))
    .join("");
}

/**
 * The ODbL § 4.6 offer for every ODbL database the answer came from (data-steward C2), in the page's language and
 * linking the Impressum: the sentence the place cards print beside the same rows. The § 4.3 notice is the credit line.
 */
export function offerHtml(lang: Lang, sources: readonly string[]): string {
  const link = `<a href="${esc(pathFor("impressum", lang))}">${esc(t(lang, "ask.offerLink"))}</a>`;
  const out: string[] = [];
  if (sources.includes(ODBL_OSM)) out.push(fillHtml(lang, "ask.offerOsm", { link }));
  const dbs = [...new Set(sources.map((id) => ODBL_DATABASES[id]).filter((d): d is string => d !== undefined))];
  for (const db of dbs) out.push(fillHtml(lang, "ask.offerDb", { db: `<span translate="no">${esc(db)}</span>`, link }));
  return out.map((o) => `<p class="qa-answer__note qa-answer__offer">${o}</p>`).join("");
}

/**
 * What stands under every live answer, wherever it is shown (the cards, the place cards, the sign — C3): a register
 * credit line per answering source with its licence link and condition, the result's legal notes verbatim in German,
 * and the ODbL offer. A source the shell's catalogue does not know is never left uncredited: then the tool's own
 * attribution is shown whole.
 */
export function answerCreditsHtml(lang: Lang, e: AskEntry): string {
  const credits = e.projection.sources.map((id) => catalogue.credits.find((c) => c.id === id));
  const known = credits.every((c): c is Credit => c !== undefined) ? credits : null;
  const creditBlock =
    known !== null
      ? `<ul class="credits qa-answer__credits">${known.map((c) => creditHtml(c, lang, e.projection.summarised === true)).join("")}</ul>`
      : `<p class="qa-answer__credits live-ask__credit" lang="de">${esc(e.projection.attribution)}</p>`;
  // A legal note the register already prints under its credit line (the condition) is not printed twice.
  const notes = (e.projection.notes ?? []).filter((n) => !(known ?? []).some((c) => c.condition === n));
  return creditBlock + notes.map((n) => `<p class="qa-answer__note" lang="de">${esc(n)}</p>`).join("") + offerHtml(lang, e.projection.sources);
}

/**
 * The answer's card and, under it, the "works only with ViaFrei connected" note of the surface it stands on (#1001),
 * or null when it cannot be said in this language (then nothing is shown).
 */
export function answerHtml(lang: Lang, e: AskEntry, now: Date, source: ConnectSource): string | null {
  const parts = answerParts(lang, e);
  if (parts === null) return null;
  // Fresh while the ask is younger than one refresh cycle (`answerState`); the pill's shape differs as well as its colour.
  const state = answerState(e, now);
  return (
    `<div class="qa-answer live-ask__answer ${state}" data-ask="${e.key}">` +
    `<p class="qa-answer__head"><strong>${esc(t(lang, "ask.live"))}</strong> ` +
    `<span class="age"><span class="age__dot" aria-hidden="true"></span><time datetime="${esc(e.projection.asOf)}">${esc(t(lang, "ask.asOf", { time: answerTime(lang, e) }))}</time></span> ` +
    `<span><span class="visually-hidden">${esc(t(lang, "ask.tool"))}: </span><code translate="no">${esc(e.tool)}</code></span></p>` +
    `<p class="qa-answer__text">${parts.map((p) => (p.name ? `<span translate="no">${esc(p.text)}</span>` : esc(p.text))).join("")}</p>` +
    answerCreditsHtml(lang, e) +
    `</div>` +
    connectNoteHtml(lang, source)
  );
}
