/**
 * The fragment scans that used to be regular expressions, as single passes (CodeQL js/polynomial-redos, viafrei-web
 * PR #15). Each regex here could restart at every position of an input with no closing delimiter and rescan to its
 * end — quadratic in the input — and a fragment carries provider text. Each function below is the SAME match as the
 * expression it names (the same spans, the same output on every input, `scan.test.ts` compares them over planted and
 * random inputs), found with `indexOf` from strictly advancing positions, so it is linear by construction.
 */

/**
 * `s.replace(/O[^C]*C/g, "")` for the single characters `open` and `close` (`<`/`>`: a tag; `[`/`]`: a selector's
 * attribute part): each `open` up to the first `close` after it is dropped, and an `open` with no `close` after it is
 * kept with everything after it.
 */
export function dropDelimited(s: string, open: string, close: string): string {
  let out = "";
  let i = 0;
  for (;;) {
    const a = s.indexOf(open, i);
    const b = a < 0 ? -1 : s.indexOf(close, a + 1);
    if (b < 0) return out + s.slice(i);
    out += s.slice(i, a);
    i = b + 1;
  }
}

const CREDIT_OPEN = '<p class="credit';

/**
 * The `[start, end)` spans of `/<p class="credit[ "][^>]*>[\s\S]*?<\/p>/g`'s matches, in order: a credit line's block
 * (`<p class="credit …">`) up to its first `</p>` — a paragraph never nests.
 */
export function creditBlockSpans(html: string): readonly (readonly [number, number])[] {
  const out: (readonly [number, number])[] = [];
  let i = 0;
  for (;;) {
    const a = html.indexOf(CREDIT_OPEN, i);
    if (a < 0) return out;
    const after = html[a + CREDIT_OPEN.length];
    if (after !== " " && after !== '"') {
      i = a + 1;
      continue;
    }
    // no `>` (or no `</p>`) after this start: none after any later start either
    const gt = html.indexOf(">", a + CREDIT_OPEN.length + 1);
    const end = gt < 0 ? -1 : html.indexOf("</p>", gt + 1);
    if (end < 0) return out;
    out.push([a, end + 4]);
    i = end + 4;
  }
}

/** Every credit block of `html` ({@link creditBlockSpans}), as text. */
export const creditBlocks = (html: string): readonly string[] => creditBlockSpans(html).map(([a, b]) => html.slice(a, b));

/** `html.replace(CREDIT_BLOCK, fn)` over {@link creditBlockSpans}. */
export function replaceCreditBlocks(html: string, fn: (block: string) => string): string {
  let out = "";
  let i = 0;
  for (const [a, b] of creditBlockSpans(html)) {
    out += html.slice(i, a) + fn(html.slice(a, b));
    i = b;
  }
  return out + html.slice(i);
}
