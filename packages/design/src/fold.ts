/**
 * #1176/#1177 (owner 2026-11-05, decision 1) under data-steward ruling FS-2026-11-06: a fold may hide a card's or tile's
 * data and, WITH it, the credit lines of that data — never a credit away from data in view. A folded fragment therefore
 * folds whole: its data and its full credit lines sit in the SAME native `<details>` (FS1), opened in print, its state
 * stored nowhere, and its `<summary>` carries the "… anzeigen" label and the FS3 line naming every publisher inside
 * (`foldSummaryHtml`). A credit line is a `<p class="credit …">` block (`creditLine`); a paragraph never nests, so a block
 * ends at its first `</p>`.
 *
 * `liftCredits` is FS4's tool: when a card keeps some data in view outside its fold (a lamp, a badge), the lines the
 * sources component keeps in view (`mustShow`, #1120) are taken out, in their order and unchanged, and printed beside
 * that data instead of inside the fold.
 */
import type { PageHeadLang } from "./page-head-copy.js";
import { foldSummaryHtml, unruledCredit } from "./sources-names.js";

const CREDIT_BLOCK = /<p class="credit[ "][^>]*>[\s\S]*?<\/p>/gu;

export type LiftedCredits = { readonly rest: string; readonly lifted: string };

export function liftCredits(html: string, keep: (block: string) => boolean = () => true): LiftedCredits {
  const lifted: string[] = [];
  const rest = html.replace(CREDIT_BLOCK, (b) => {
    if (!keep(b)) return b;
    lifted.push(b);
    return "";
  });
  return { rest, lifted: lifted.join("") };
}

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr", "path", "circle", "rect", "line", "polyline", "polygon", "use"]);

/** True when `html` opens and closes the same elements (a fold may start and end inside one parent, never across). */
function balanced(html: string): boolean {
  const stack: string[] = [];
  for (const m of html.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?(\/?)>/gu)) {
    const [, close, tag = "", self] = m;
    const t = tag.toLowerCase();
    if (self === "/" || VOID.has(t)) continue;
    if (close === "/") {
      if (stack.pop() !== t) return false;
    } else stack.push(t);
  }
  return stack.length === 0;
}

/**
 * A fragment folded whole: data and credit lines in one `<details>`, the summary its label and the FS3 line naming every
 * publisher of the fragment. `keep` names the credit lines that may not fold even with their data — always those of a
 * class the ruling did not read (FS8, `unruledCredit`), and the caller's own (FS4: the lines beside data it keeps in
 * view); they are lifted out unchanged, in order, and printed right after the fold.
 */
export function foldWhole(lang: PageHeadLang, html: string, labelHtml: string, cls: string, keep: (block: string) => boolean = () => false): string {
  const { rest, lifted } = liftCredits(html, (b) => unruledCredit(b) || keep(b));
  return `<details class="fold ${cls}"><summary class="fold__summary">${foldSummaryHtml(lang, labelHtml, html)}</summary>${rest}</details>${lifted}`;
}

/**
 * #1177: a home tile folded inside its own `<section>`: the section's whole body — head, figures and every credit line —
 * goes into one fold (FS1), so nothing of the tile's data stands outside it (FS4) and the tile keeps its own box. Null
 * when the fragment is not one balanced section (the caller folds it whole with `foldWhole`).
 */
export function foldTile(lang: PageHeadLang, html: string, labelHtml: string, cls: string): string | null {
  const m = /^(<section\b[^>]*>)([\s\S]*)<\/section>\s*$/u.exec(html);
  if (m === null) return null;
  const [, open = "", body = ""] = m;
  if (!balanced(body)) return null;
  return `${open}${foldWhole(lang, body, labelHtml, cls)}</section>`;
}
