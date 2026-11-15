/**
 * Every example question the site prints carries its OWN answer (owner
 * 2026-10-05: "All example requests must have the right response! Not only
 * first."). Over the page DATA: the home's moments, the fuel requests under
 * the fuel tile and the connect page's five questions — each question has an answer, the answer is production's reply to THAT
 * question (its figures and names appear in its words in every language, and
 * it is no neighbour's reply reused), it is dated and it carries credit lines the register knows. And
 * over the TEMPLATES: every question element is followed directly by an
 * `<Answer>`, so the count of questions and of answers is the same. The
 * rendered pages are held to the same rule by `e2e/answers.e2e.ts`.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import catalogue from "../src/generated/catalogue.json" with { type: "json" };
import { t, type MessageKey } from "../src/i18n/index.js";
import { CONNECT_PROMPTS, answerFor } from "../src/site/connect-prompts.js";
import { FUEL_ASKS, MOMENTS, type MomentAnswer } from "../src/site/examples.js";
import { LIVE_LANGS } from "../src/site/pages.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const LIVE_CREDITS = new Set(catalogue.credits.map((c) => c.id));

/** The words a page in `lang` prints for one answer, names filled in. */
const words = (lang: (typeof LIVE_LANGS)[number], msg: MessageKey, a: MomentAnswer): string => t(lang, msg, { ...a.values, ...a.names });

const dated = (a: MomentAnswer, what: string): void => {
  expect(a.values.asOf, what).toMatch(/^(?:(?:05|16)\.10|02\.11)\.2026, \d\d:\d\d$/);
  expect(a.credits.length, what).toBeGreaterThan(0);
  for (const id of a.credits) expect(LIVE_CREDITS.has(id), `${what}: ${id}`).toBe(true);
};

describe("the page data: one answer per question (owner 2026-10-05)", () => {
  it("counts: questions and answers are equal and above zero on every page", () => {
    // a question per tool (v1.8.18: one or two per moment)
    const homeQ = MOMENTS.reduce((n, m) => n + m.tools.length, 0) + FUEL_ASKS.length;
    const homeA = MOMENTS.reduce((n, m) => n + m.answers.length, 0) + FUEL_ASKS.filter((f) => f.answer !== undefined).length;
    expect(homeQ).toBeGreaterThan(0);
    expect(homeA).toBe(homeQ);
    for (const lang of LIVE_LANGS) {
      const connectA = CONNECT_PROMPTS.filter((p) => answerFor(p, lang) !== undefined).length;
      expect(CONNECT_PROMPTS.length).toBeGreaterThan(0);
      expect(connectA, lang).toBe(CONNECT_PROMPTS.length);
    }
  });

  for (const p of CONNECT_PROMPTS) {
    it(`connect ${p.tool}: the answer to the question each language asks`, () => {
      const seen = new Map<string, string>();
      for (const lang of LIVE_LANGS) {
        const a = answerFor(p, lang);
        dated(a, `${lang}: ${p.tool}`);
        const text = words(lang, p.answerKey, a);
        expect(text, `${lang}: ${p.tool} is the question again`).not.toBe(t(lang, p.key));
        for (const [k, v] of Object.entries(a.values)) if (k !== "asOf") expect(text, `${lang}: ${p.tool} drops ${v}`).toContain(v);
        for (const n of Object.values(a.names)) expect(text, `${lang}: ${p.tool} drops ${n}`).toContain(n);
        expect(seen.get(text), `${lang}: ${p.tool} is ${seen.get(text)}'s text`).toBeUndefined();
        seen.set(text, lang);
      }
    });
  }

  it("connect: every language but English asks the German questions, so its question and answer name the German data's road (#753)", () => {
    // The first French and Spanish drafts followed the English places (A9, Hannover, Freiburg) and would have printed
    // the German answers — the Cologne car parks, the A3 — under a question about another place.
    for (const lang of LIVE_LANGS.filter((l) => l !== "en")) {
      expect(t(lang, "connectPage.asks.road"), lang).toContain("A3");
      expect(t(lang, "connectPage.askAnswers.road", { closures: "1", works: "2" }), lang).toContain("A3");
      expect(t(lang, "connectPage.asks.road"), lang).not.toContain("A9");
      expect(t(lang, "connectPage.askAnswers.parking", { p1: "P", f1: "1", t1: "2", p2: "Q", f2: "3", t2: "4" }), lang).not.toMatch(/10 km/u);
    }
  });

  it("connect: English asks its own golden prompts, so it carries its own answers — the place it names is the place answered", () => {
    const place = (p: (typeof CONNECT_PROMPTS)[number]): string => Object.values(p.answerEn.names).join(" ");
    const [train, parking, charging, road, weather] = CONNECT_PROMPTS;
    expect(t("en", train!.key)).toContain("Cologne");
    expect(place(train!)).toContain("Köln");
    expect(t("en", parking!.key)).toContain("Freiburg");
    expect(t("en", charging!.key)).toContain("Hannover");
    expect(place(charging!)).toContain("Hannover");
    expect(t("en", road!.key)).toContain("A9");
    expect(words("en", road!.answerKey, road!.answerEn)).toContain("A9");
    expect(t("en", weather!.key)).toContain("Hamburg");
    expect(place(weather!)).toBe("Hamburg");
    expect(t("de", weather!.key)).toContain("Dresden");
    expect(place({ ...weather!, answerEn: weather!.answer })).toBe("Dresden");
  });

  for (const f of FUEL_ASKS) {
    it(`fuel request ${f.key}: an answer for the place and fuel it names, marked "Preise heute anders"`, () => {
      dated(f.answer, f.key);
      expect(f.answer.credits).toContain("tankerkoenig");
      const seen = new Map<string, string>();
      for (const lang of LIVE_LANGS) {
        const text = words(lang, `day.fuelAsks.${f.key}.a` as MessageKey, f.answer);
        const why = t(lang, `day.fuelAsks.${f.key}.why` as MessageKey, f.answer.values);
        const head = t(lang, "connectPage.live.fuelExample", f.answer.values);
        const all = `${why} ${head} ${text}`;
        for (const [k, v] of Object.entries(f.answer.values)) if (k !== "asOf") expect(all, `${lang}: ${f.key} drops ${k}=${v}`).toContain(v);
        for (const n of Object.values(f.answer.names)) expect(text, `${lang}: ${f.key} drops ${n}`).toContain(n);
        expect(seen.get(text), `${lang}: ${f.key} is ${seen.get(text)}'s text`).toBeUndefined();
        seen.set(text, lang);
      }
    });
  }

  it("no answer is a neighbour's answer reused: every answer's figures and names differ from every other's", () => {
    const all: [string, MomentAnswer][] = [
      ...MOMENTS.flatMap((m) => m.answers.map((a, i): [string, MomentAnswer] => [`${m.key}.a${String(i + 1)}`, a])),
      ...FUEL_ASKS.map((f): [string, MomentAnswer] => [`fuel.${f.key}`, f.answer]),
      ...CONNECT_PROMPTS.flatMap((p): [string, MomentAnswer][] => [
        [`connect.${p.tool}`, p.answer],
        [`connect.${p.tool}.en`, p.answerEn],
      ]),
    ];
    const seen = new Map<string, string>();
    for (const [k, a] of all) {
      const fp = JSON.stringify([a.values, a.names]);
      expect(seen.get(fp), `${k} repeats ${seen.get(fp)}`).toBeUndefined();
      seen.set(fp, k);
    }
    expect(all.length).toBe(MOMENTS.reduce((n, m) => n + m.answers.length, 0) + FUEL_ASKS.length + CONNECT_PROMPTS.length * 2);
  });
});

describe("the templates: every question element is followed directly by its answer", () => {
  /** Every `<blockquote class="ask">` / `<div class="ask">` closes and the next element is an `<Answer`. */
  const pairs = (src: string): { asks: number; answered: number } => {
    let asks = 0;
    let answered = 0;
    const open = /<(blockquote|div) class="ask">/g;
    for (let m = open.exec(src); m !== null; m = open.exec(src)) {
      asks += 1;
      const close = src.indexOf(`</${m[1]!}>`, m.index);
      const next = src.slice(close + m[1]!.length + 3).trimStart();
      // the connect page closes the `.ask` inside its `.qa` pair, then a comment, then the Answer
      const after = next.replace(/^\{\/\*[\s\S]*?\*\/\}\s*/, "");
      if (after.startsWith("<Answer ")) answered += 1;
    }
    return { asks, answered };
  };

  it("the home (Day.astro): three moment questions and the fuel requests, each with its Answer", () => {
    const { asks, answered } = pairs(readFileSync(join(SRC, "components", "Day.astro"), "utf8"));
    expect(asks).toBeGreaterThan(0);
    expect(answered).toBe(asks);
  });

  it("the business page (#992): no typed question — every case asks through LiveAsk, whose question and answer are one live call", () => {
    // The six typed questions and their dated answers (business-asks.ts) are gone: a case's example is the
    // live ask the MCP server recorded, so it cannot age past a day. The rendered page is held by e2e/answers.e2e.ts.
    const src = readFileSync(join(SRC, "layouts", "BusinessPage.astro"), "utf8");
    expect(pairs(src).asks).toBe(0);
    expect(src.match(/<LiveAsk\b/gu)?.length ?? 0).toBeGreaterThan(0);
  });

  it("the connect page: each question with its Answer", () => {
    const { asks, answered } = pairs(readFileSync(join(SRC, "layouts", "ConnectPage.astro"), "utf8"));
    expect(asks).toBeGreaterThan(0);
    expect(answered).toBe(asks);
  });
});
