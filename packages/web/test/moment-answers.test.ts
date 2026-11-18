/**
 * The real answers on the home's daily moments (owner 2026-10-05, v1.8.2 PR 3:
 * "add there also responses, generate them", then "All example requests must
 * have the right response! Not only first."), checked at their sources: every
 * question of every moment carries what production answered to IT — a
 * response excerpt in every language, the answer's own figures
 * and names, a date, and the credit lines of the sources it quotes — and every
 * moment carries a German traffic sign from the closed list.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { all } from "@viafrei/design/testing";
import catalogue from "../src/generated/catalogue.json" with { type: "json" };
import { t, type MessageKey } from "../src/i18n/index.js";
import { FUEL_ASKS, MOMENTS, TOOL_GROUPS, TOOL_GROUP_SIGNS, answerKey } from "../src/site/examples.js";
import { LIVE_EXAMPLES } from "../src/site/live-examples.js";
import { LIVE_LANGS } from "../src/site/pages.js";
import { SIGN_KINDS } from "../src/site/signs.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

describe("the home's moments answer EVERY question (owner 2026-10-05: \"Not only first.\")", () => {
  it("every moment carries three questions again, one answer and one tool per question (#746: every removed example restored)", () => {
    for (const m of MOMENTS) {
      expect(m.answers.length, m.key).toBe(3);
      expect(m.tools.length, m.key).toBe(m.answers.length);
    }
  });

  it("no fourth question: the deck carries exactly q1-q3 and a1-a3 for every moment, no dead copy", () => {
    for (const m of MOMENTS) {
      for (const lang of LIVE_LANGS) {
        for (const i of [1, 2, 3]) expect(() => t(lang, `day.moments.${m.key}.q${String(i)}` as MessageKey), `${lang}: ${m.key}.q${String(i)}`).not.toThrow();
        expect(() => t(lang, `day.moments.${m.key}.q4` as MessageKey), `${lang}: ${m.key}.q4`).toThrow();
        expect(() => t(lang, `day.moments.${m.key}.a4` as MessageKey), `${lang}: ${m.key}.a4`).toThrow();
      }
    }
  });

  it("a Tankerkönig figure stands only in the fuel fold, never in a moment (#746)", () => {
    for (const m of MOMENTS) {
      expect(m.tools, m.key).not.toContain("find_cheapest_fuel");
      for (const a of m.answers) expect(a.credits, m.key).not.toContain("tankerkoenig");
    }
    expect(FUEL_ASKS.map((f) => f.key)).toEqual(["goerlitz", "muenchen", "leipzig", "nuernberg"]);
  });

  it("the live first questions are the engine's own: the same tool, never fuel or a watch (#746)", () => {
    const live = MOMENTS.filter((m) => m.live !== undefined).map((m) => [m.key, m.live, m.tools[0]]);
    expect(live).toEqual([
      // #990: the punctuality question moved from the former "Heute" strip to its moment — one topic, one place
      ["commute", "transit", "check_transit_disruption"],
      ["driving", "roads", "check_autobahn_traffic"],
      ["parking", "parking", "find_parking"],
      ["charging", "charging", "find_charging_station"],
    ]);
    const day = readFileSync(join(SRC, "components", "Day.astro"), "utf8");
    expect(day).toContain("<LiveAsk lang={lang} key={m.live} entry={live}");
  });

  for (const m of MOMENTS) {
    for (const [idx, a] of m.answers.entries()) {
      const i = (idx + 1) as 1 | 2 | 3;
      it(`${m.key} a${String(i)}: a response excerpt in every language, with its figures, names, date and credits`, () => {
        // asked of production on 2026-11-02 (re-asked, #746); test/example-freshness.test.ts holds every date to 14 days
        expect(a.values.asOf, m.key).toMatch(/^(?:02|18)\.11\.2026, \d\d:\d\d$/);
        expect(a.credits.length).toBeGreaterThan(0);
        const live = new Set(catalogue.credits.map((c) => c.id));
        for (const id of a.credits) expect(live.has(id), `${m.key}: ${id}`).toBe(true);
        const figures = Object.entries(a.values).filter(([k]) => k !== "asOf").map(([, v]) => v);
        const seen = new Map<string, string>();
        for (const lang of LIVE_LANGS) {
          const short = t(lang, answerKey(m, i), { ...a.values, ...a.names });
          const text = a.more === true ? `${short} ${t(lang, `day.moments.${m.key}.a1more` as MessageKey, a.values)}` : short;
          // the glance stays a glance: the first answer folds its second half (owner 2026-10-05, "no wall of text")
          if (i === 1) expect(short.length, `${lang}: ${m.key} shows ${short.length} characters at a glance`).toBeLessThanOrEqual(160);
          expect(text.length, `${lang}: ${m.key}`).toBeGreaterThan(20);
          expect(text, `${lang}: ${m.key} a${String(i)} is the question again`).not.toBe(t(lang, `day.moments.${m.key}.q${String(i)}` as MessageKey));
          for (const f of figures) expect(text, `${lang}: ${m.key} a${String(i)} drops ${f}`).toContain(f);
          for (const n of Object.values(a.names)) expect(text, `${lang}: ${m.key} a${String(i)} drops the name ${n}`).toContain(n);
          // no language prints another's sentence (#449)
          expect(seen.get(text), `${lang}: ${m.key} a${String(i)} is ${seen.get(text)}'s text`).toBeUndefined();
          seen.set(text, lang);
          expect(() => t(lang, "day.answer.asOf", a.values)).not.toThrow();
          // no licence named in an answer (#377 D4 rule 1): the credit line does
          expect(text).not.toMatch(/CC BY|CC0|ODbL|dl-de/);
        }
      });
    }
  }

  it("the answered question leads: parking asks for a car park at Köln Hbf, places asks for a coordinate", () => {
    expect(t("de", "day.moments.parking.q1")).toContain("Kölner Hauptbahnhof");
    expect(t("de", "day.moments.places.q1")).toContain("50.1109, 8.6821");
    expect(MOMENTS.find((m) => m.key === "places")?.tools[0]).toBe("describe_location");
  });

  it("the component renders every answer from the deck, its names untranslated and its credits verbatim", () => {
    const day = readFileSync(join(SRC, "components", "Day.astro"), "utf8");
    const ans = readFileSync(join(SRC, "components", "Answer.astro"), "utf8");
    expect(day).toContain("msg={answerKey(m, 1)} answer={m.answers[0]}");
    expect(day).toContain("msg={answerKey(m, i)} answer={m.answers[i - 1]}");
    expect(ans).toContain('translate="no"');
    // every credit line through the one CreditItem component (data-steward ruling 2026-10-07: the BKG line's prescribed links)
    expect(ans).toContain("<CreditItem c={c} lang={lang} />");
    expect(all(readFileSync(join(SRC, "components", "CreditItem.astro"), "utf8"), "li[lang=\"de\"]").length).toBeGreaterThan(0);
    expect(ans).toContain('t(lang, "day.answer.asOf", answer.values)');
    // the first is shown open, outside the fold
    expect(day.indexOf("answerKey(m, 1)")).toBeLessThan(day.indexOf('<details class="fold moment__more">', day.indexOf("MOMENTS.map((m, n)")));
  });
});

describe("the tools block lists the catalogue the server serves (2.4.5: it said 20 while the server served 22)", () => {
  it("every served tool is in exactly one group, and no group names a tool the server does not serve", () => {
    const served = (JSON.parse(readFileSync(join(SRC, "generated", "catalogue.json"), "utf8")) as { tools: { name: string }[] }).tools.map((t) => t.name);
    const listed = Object.values(TOOL_GROUPS).flat();
    expect(served.length).toBeGreaterThan(0);
    expect(new Set(listed).size, "a tool listed twice").toBe(listed.length);
    expect([...listed].sort()).toEqual([...served].sort());
  });
});

describe("every panel carries a German traffic sign (owner 2026-10-05)", () => {
  it("each moment, each answer card and each tool group names a sign from the closed list", () => {
    const kinds = new Set<string>(SIGN_KINDS);
    for (const m of MOMENTS) expect(kinds.has(m.sign), m.key).toBe(true);
    for (const e of LIVE_EXAMPLES) expect(kinds.has(e.sign), e.key).toBe(true);
    for (const g of Object.keys(TOOL_GROUPS) as (keyof typeof TOOL_GROUPS)[]) {
      expect(TOOL_GROUP_SIGNS[g].length, g).toBeGreaterThan(0);
      for (const k of TOOL_GROUP_SIGNS[g]) expect(kinds.has(k), g).toBe(true);
    }
  });

  it("the sign component draws every kind, with no SVG text and no literal colour", () => {
    const svg = readFileSync(join(SRC, "components", "RoadSign.astro"), "utf8");
    for (const k of SIGN_KINDS) expect(svg, k).toContain(`kind === "${k}"`);
    expect(svg).not.toMatch(/<text[\s>]/);
    expect(svg).not.toMatch(/(fill|stroke)="#/);
  });
});
