/**
 * viafrei-web PR #15 (CodeQL js/polynomial-redos, js/redos): the fragment scans that were regular expressions are
 * single passes now, and each must be the SAME match as the expression it replaced — every input, not only ours. The
 * old expressions are kept here as the oracle and compared over planted edge cases and seeded random inputs drawn
 * from the delimiters' own alphabet (where the two could differ), and each pass is timed on the input that made its
 * expression quadratic.
 */
import { describe, expect, it } from "vitest";
import { splitEndpoint } from "../src/endpoint-chip.js";
import { liftCredits } from "../src/fold.js";
import { creditBlockSpans, creditBlocks, dropDelimited, replaceCreditBlocks } from "../src/scan.js";
import { shortSource, textOf } from "../src/sources-names.js";
import { descendantParts } from "../src/testing/index.js";

const OLD_CREDIT_BLOCK = /<p class="credit[ "][^>]*>[\s\S]*?<\/p>/gu;
const oldSplitEndpoint = (url: string): { scheme: string; host: string; path: string } => {
  const m = /^([a-z][a-z0-9+.-]*:\/\/)([^/]*)(.*)$/iu.exec(url);
  if (m === null) return { scheme: "", host: url, path: "" };
  return { scheme: m[1] ?? "", host: m[2] ?? "", path: m[3] ?? "" };
};
const oldSentenceCut = (s: string): number => {
  for (const m of s.matchAll(/(\S+)\. /gu)) if (/^\p{L}{4,}$/u.test(m[1]!)) return m.index + m[1]!.length;
  return -1;
};
/** `shortSource` as it stood, with the expression's sentence end: the oracle for the word-by-word read. */
const OLD_CLAUSES = [" · ", " via ", ", ", "; ", " (", " — ", " – ", " - "];
const oldShortSource = (text: string): string => {
  const colon = text.indexOf(": ");
  let tail = colon >= 0 && colon < 80 ? text.slice(colon + 2) : text;
  let head = tail;
  for (let i = 0; i < 4; i++) {
    const cut = Math.min(...[...OLD_CLAUSES.map((c) => tail.indexOf(c)), oldSentenceCut(tail)].filter((n) => n > 0), tail.length);
    head = tail.slice(0, cut).trim();
    const inner = head.indexOf(": ");
    if (inner < 0) break;
    tail = tail.slice(inner + 2);
  }
  return head;
};

/** A seeded generator (mulberry32), so a failure names an input that can be replayed. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const randomOf = (r: () => number, pieces: readonly string[], n: number): string => Array.from({ length: n }, () => pieces[Math.floor(r() * pieces.length)]!).join("");
const samples = (pieces: readonly string[], count = 3000, max = 14): readonly string[] => {
  const r = rng(1515);
  return Array.from({ length: count }, () => randomOf(r, pieces, Math.floor(r() * max)));
};

const quick = (fn: () => unknown): number => {
  const t0 = performance.now();
  fn();
  return performance.now() - t0;
};
const N = 200_000;

describe("PR #15: dropDelimited is `replace(/O[^C]*C/g, \"\")`", () => {
  const cases = ["", "a", "<", ">", "<>", "<<b>", "a<b>c<d", "<a>b</a>", "x<y", "<<<", ">>><", "a<b<c>d>e"];
  it.each(cases)("tags: %j", (s) => expect(dropDelimited(s, "<", ">")).toBe(s.replace(/<[^>]*>/g, "")));
  it("tags and brackets, over random inputs of the delimiters' alphabet", () => {
    for (const s of samples(["<", ">", "a", " ", "<p>", "</p>"])) expect(dropDelimited(s, "<", ">"), JSON.stringify(s)).toBe(s.replace(/<[^>]*>/g, ""));
    for (const s of samples(["[", "]", "a", ".", '"', " "])) expect(dropDelimited(s, "[", "]"), JSON.stringify(s)).toBe(s.replace(/\[[^\]]*\]/g, ""));
  });
  it("linear on many opens with no close", () => {
    expect(quick(() => dropDelimited("<".repeat(N), "<", ">"))).toBeLessThan(500);
    expect(quick(() => dropDelimited("[".repeat(N), "[", "]"))).toBeLessThan(500);
  });
});

describe("PR #15: the credit blocks are `/<p class=\"credit[ \"][^>]*>[\\s\\S]*?<\\/p>/g`'s matches", () => {
  const spans = (html: string): (readonly [number, number])[] => [...html.matchAll(OLD_CREDIT_BLOCK)].map((m) => [m.index, m.index + m[0].length] as const);
  const pieces = ['<p class="credit', '<p class="credit ', '<p class="credit"', '<p class="creditx', ">", "</p>", "<p>", "a", " ", '"', "lang=de"];
  it("the same spans over planted and random inputs", () => {
    const planted = ['<p class="credit">A</p>', '<p class="credit credit--note">B</p><p class="credit" lang="de">C</p>', '<p class="creditx">no</p>', '<p class="credit "', '<p class="credit ">', '<p class="credit "></p>'];
    for (const s of [...planted, ...samples(pieces)]) {
      expect(creditBlockSpans(s), JSON.stringify(s)).toEqual(spans(s));
      expect(creditBlocks(s)).toEqual(s.match(OLD_CREDIT_BLOCK) ?? []);
      expect(replaceCreditBlocks(s, (b) => `[${b.length}]`)).toBe(s.replace(OLD_CREDIT_BLOCK, (b) => `[${b.length}]`));
    }
  });
  it("liftCredits keeps its answer", () => {
    for (const s of samples(pieces, 500)) {
      const lifted: string[] = [];
      const rest = s.replace(OLD_CREDIT_BLOCK, (b) => (b.length % 2 === 0 ? (lifted.push(b), "") : b));
      expect(liftCredits(s, (b) => b.length % 2 === 0)).toEqual({ rest, lifted: lifted.join("") });
    }
  });
  it("linear on many openings with no `</p>`", () => {
    expect(quick(() => creditBlockSpans('<p class="credit ">'.repeat(N / 10)))).toBeLessThan(500);
  });
});

describe("PR #15: textOf and shortSource answer as before", () => {
  it("a sentence ends where `/(\\S+)\\. /g` said it did", () => {
    const planted = ["Wetter: Deutscher Wetterdienst. Datenquelle: x", "DELFI e.V. via y", "Ampeco Ltd. (EDRI)", "Grid & Co. GmbH", "Wort.. Satz", ". . .", "abcd.  x", "Straße. x"];
    for (const s of [...planted, ...samples(["abcd", "e", ".", " ", ". ", "!", "Ä", ": ", ", "])]) {
      expect(shortSource(s), JSON.stringify(s)).toBe(oldShortSource(s));
    }
  });
  it("textOf reads text as the expression did", () => {
    const old = (h: string): string => h.replace(/<[^>]*>/gu, "").replace(/&(?:amp|lt|gt|quot|#39|#x27);/gu, (m) => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&#x27;": "'" })[m] ?? m).replace(/\s+/gu, " ").trim();
    for (const s of samples(["<", ">", "&lt;", "&amp;", "a", " ", "<b>"])) expect(textOf(s), JSON.stringify(s)).toBe(old(s));
  });
  it("linear on a long word and on many `<`", () => {
    expect(quick(() => shortSource("!".repeat(N)))).toBeLessThan(500);
    expect(quick(() => textOf("<".repeat(N)))).toBeLessThan(500);
  });
});

describe("PR #15: splitEndpoint is the anchored expression's split", () => {
  it("the same parts over planted and random inputs", () => {
    const planted = ["https://mcp.viafrei.de/mcp", "https://mcp.viafrei.de", "mcp.viafrei.de/mcp", "a://", "a://b/c\nd", "a://b\n/c", "A+b://x/y/z", "1a://x", "http:/x", "a://b/\u2028"];
    for (const s of [...planted, ...samples(["a", "://", "/", ".", ":", "\n", "\u2029", "x"])]) expect(splitEndpoint(s), JSON.stringify(s)).toEqual(oldSplitEndpoint(s));
  });
  it("linear on a long address", () => {
    expect(quick(() => splitEndpoint(`a://${".".repeat(N)}/\n`))).toBeLessThan(500);
  });
});

describe("PR #15: the test helper's selector split is `split(/\\s+(?![^[]*\\])/)`", () => {
  it("the same parts over planted and random inputs", () => {
    const planted = ["a", "p.credit", 'p.credit [lang="de"]', 'a[title="x y"] b', "a  b", "] a [", "a [ b"];
    for (const s of [...planted, ...samples(["a", " ", "[", "]", '"', "\t"])].map((x) => x.trim())) expect(descendantParts(s), JSON.stringify(s)).toEqual(s.split(/\s+(?![^[]*\])/));
  });
  it("linear on many spaces", () => {
    expect(quick(() => descendantParts(`a${" ".repeat(N)}b`))).toBeLessThan(500);
  });
});
