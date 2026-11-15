/**
 * #1181 feature 5 ("Frag deine KI"): two or three prefilled questions per page subject in every language, each opening
 * in ChatGPT and in Claude with the question as the prompt, a copy script that sends no event and stores nothing, and
 * no question about a fuel price (the MTS-K data is not redistributed, not even as a question).
 */
import { Script } from "node:vm";
import { describe, expect, it } from "vitest";
import { AI_APPS, AI_QUESTIONS_MAX, aiHref, aiQuestions, askCopyScript } from "../src/lib/ask-ai.js";
import { askQuestion, type AskAbout } from "../src/lib/next-step.js";
import { LIVE_LANGS } from "../src/site/pages.js";

const SUBJECTS: readonly AskAbout[] = [
  { kind: "place", place: "Köln" },
  { kind: "road", road: "A3" },
  { kind: "exit", road: "A3", exit: "Köln-Ost" },
];
const FUEL = /sprit|benzin|diesel|tank|kraftstoff|fuel|petrol|gasoline|€|eur\b|preis|price|carbur|combustible|brandstof|paliw|benzina|degalų|palivo|üzemanyag|brændstof|combustív|gorivo|гориво|топлив|пальн|καύσιμ|degviel|yakıt|carburant/iu;

describe("Frag deine KI: the prefilled questions (#1181 feature 5)", () => {
  it("two or three per subject in every language, the connect page's first, every placeholder filled, the subject named", () => {
    for (const lang of LIVE_LANGS)
      for (const a of SUBJECTS) {
        const qs = aiQuestions(lang, a);
        expect(qs.length, `${lang} ${a.kind}`).toBeGreaterThanOrEqual(2);
        expect(qs.length).toBeLessThanOrEqual(AI_QUESTIONS_MAX);
        expect(qs[0]).toBe(askQuestion(lang, a));
        expect(new Set(qs).size, `${lang} ${a.kind}`).toBe(qs.length);
        for (const q of qs) {
          expect(q, lang).not.toMatch(/[{}]/u);
          expect(q, lang).toContain(a.kind === "place" ? "Köln" : "A3");
        }
      }
  });

  it("no question in any language is about fuel or a price", () => {
    for (const lang of LIVE_LANGS) for (const a of SUBJECTS) for (const q of aiQuestions(lang, a)) expect(q, `${lang}: ${q}`).not.toMatch(FUEL);
  });

  it("each opens in ChatGPT and in Claude with the question as the whole prompt", () => {
    expect(AI_APPS.map((x) => x.id)).toEqual(["chatgpt", "claude"]);
    const q = aiQuestions("de", { kind: "road", road: "A3" })[1]!;
    const [gpt, claude] = AI_APPS.map((x) => new URL(aiHref(x, q)));
    expect(gpt!.origin).toBe("https://chatgpt.com");
    expect(gpt!.searchParams.get("q")).toBe(q);
    expect(claude!.origin + claude!.pathname).toBe("https://claude.ai/new");
    expect(claude!.searchParams.get("q")).toBe(q);
  });

  it("the copy script copies the question only, fires no event and writes no storage", () => {
    const js = askCopyScript();
    expect(js).toContain("navigator.clipboard.writeText");
    expect(js).not.toMatch(/dispatchEvent|CustomEvent|localStorage|sessionStorage|fetch\(|sendBeacon|gtag|dataLayer/u);
    expect(() => new Script(js)).not.toThrow();
  });
});
