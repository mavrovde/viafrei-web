/**
 * #1182 (the Land page's item 10, with #1181 features 3 and 5): a Land page carries the star and, at its end, "Frag
 * deine KI" with three Land questions — the connect page's own, the Land's weather warnings, and its most affected
 * motorways (the figure its page counts) — in every language, never a fuel question. The Land travels to the connect
 * page as a place (`about=<name>`), so the connect page's own check is unchanged.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { aiQuestions } from "../src/lib/ask-ai.js";
import { askAboutOf, askLink, askQuestion, type AskAbout } from "../src/lib/next-step.js";
import { t } from "../src/i18n/index.js";
import { LIVE_LANGS } from "../src/site/pages.js";

const BY: AskAbout = { kind: "land", place: "Bayern" };
const FUEL = /sprit|benzin|diesel|tank|kraftstoff|fuel|petrol|€|preis|price|carbur|combustible|brandstof|paliw|benzina|degalų|palivo|üzemanyag|brændstof|combustív|gorivo|гориво|топлив|пальн|καύσιμ|degviel|yakıt/iu;

describe("a Land page's questions (#1182 item 10)", () => {
  it("three in every language: the connect page's first, the warnings, the motorways — each naming the Land", () => {
    for (const lang of LIVE_LANGS) {
      const qs = aiQuestions(lang, BY);
      expect(qs, lang).toEqual([askQuestion(lang, BY), t(lang, "ai.placeWarn", { place: "Bayern" }), t(lang, "ai.landRoads", { place: "Bayern" })]);
      expect(new Set(qs).size, lang).toBe(3);
      for (const q of qs) {
        expect(q, lang).toContain("Bayern");
        expect(q, lang).not.toMatch(/[{}]/u);
        expect(q, `${lang}: ${q}`).not.toMatch(FUEL);
      }
      // a place keeps its own third question: the Land's is not the place's
      expect(qs[2]).not.toBe(aiQuestions(lang, { kind: "place", place: "Bayern" })[2]);
    }
  });

  it("the box's link is the connect page about the Land, which its own check reads back as that name", () => {
    const a = askLink("de", BY);
    expect(a.href).toBe("/de/connect?about=Bayern");
    expect(askAboutOf(new URLSearchParams("about=Bayern"))).toEqual({ kind: "place", place: "Bayern" });
    expect(askLink("en", { kind: "land", place: "Baden-Württemberg" }).href).toBe(`/en/connect?about=${encodeURIComponent("Baden-Württemberg").replace(/%20/g, "+")}`);
  });

  it("the Land page renders the star after its head and the box after its blocks", () => {
    const src = readFileSync(new URL("../src/layouts/StatePage.astro", import.meta.url), "utf8");
    const body = src.replace(/^---[\s\S]*?\n---/u, "");
    const at = (s: string): number => body.indexOf(s);
    expect(at("<PageHead")).toBeGreaterThan(-1);
    expect(at("<Star ")).toBeGreaterThan(at("<PageHead"));
    expect(at('set:html={lifted.html}')).toBeGreaterThan(at("<Star "));
    expect(at('<AskBox lang={lang} about={{ kind: "land"')).toBeGreaterThan(at("set:html={lifted.html}"));
  });
});
