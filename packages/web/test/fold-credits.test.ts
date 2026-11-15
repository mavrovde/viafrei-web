/**
 * Data-steward ruling FS-2026-11-06 on the shell's folds of examples (`src/lib/fold-credits.ts`): the connect page's
 * further questions and live cards, the home's moments. FS5 (fuel never folds), FS8 (a class the ruling did not read
 * never folds) and FS3 (the summary names every publisher inside, uncut).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { all, text } from "@viafrei/design/testing";
import { foldSourcesFor, mayFold, splitFold } from "../src/lib/fold-credits.js";
import { CONNECT_PROMPTS, answerFor } from "../src/site/connect-prompts.js";
import { connectExamples } from "../src/site/live-examples.js";
import { MOMENTS } from "../src/site/examples.js";

const names = (html: string): string[] => all(html, '.fold__sources span[translate="no"]').map((e) => text(e));

describe("FS-2026-11-06 for the shell's example folds", () => {
  it("FS5/FS8/FS12: fuel never folds; a ruled credit does, the Autobahn GmbH's and Chargepool's too", () => {
    expect(mayFold(["tankerkoenig"])).toBe(false);
    expect(mayFold(["db_stada", "tankerkoenig_hist"])).toBe(false);
    // FS12 (2026-11-06): the two classes FS8 held back fold with their data
    expect(mayFold(["autobahn"])).toBe(true);
    expect(mayFold(["mobilithek_afir_chargepool"])).toBe(true);
    expect(mayFold(["db_stada", "delfi_static"])).toBe(true);
    expect(mayFold([])).toBe(true);
  });

  it("splitFold: the first n stand open, so does every later one that may not fold, in its place; the rest fold in order", () => {
    const xs = [["db_stada"], ["db_stada"], ["tankerkoenig_hist"], ["delfi_static"], ["tankerkoenig"], ["autobahn"]];
    const { open, folded } = splitFold(xs, 1, (x) => x);
    expect(open).toEqual([["db_stada"], ["tankerkoenig_hist"], ["tankerkoenig"]]);
    expect(folded).toEqual([["db_stada"], ["delfi_static"], ["autobahn"]]);
  });

  it("FS3: the line names every publisher once, whole — three and more too, never 'weitere'", () => {
    const html = foldSourcesFor("de", ["db_stada", "delfi_static", "osm", "db_stada", "bnetza_lsr"]);
    expect(text(all(html, ".fold__sources")[0]!)).toMatch(/^Quellen: /u);
    expect(names(html)).toEqual(["Deutsche Bahn AG", "DELFI e.V.", "© OpenStreetMap-Mitwirkende", "Bundesnetzagentur.de"]);
    expect(html).not.toMatch(/weitere/u);
    expect(foldSourcesFor("en", ["db_stada"])).toContain("Sources: ");
    expect(foldSourcesFor("de", [])).toBe("");
    expect(foldSourcesFor("de", ["no_such_id"])).toBe("");
  });

  it("the connect page folds no fuel example, and its folds carry the sources line", () => {
    const cards = splitFold(connectExamples(new Date()), 3, (e) => e.credits);
    for (const e of cards.folded) expect(mayFold(e.credits), e.key).toBe(true);
    for (const k of ["fuelcity", "fuelroad"]) expect(cards.folded.map((e) => e.key)).not.toContain(k);
    const prompts = splitFold(CONNECT_PROMPTS, 3, (p) => answerFor(p, "de").credits);
    for (const p of prompts.folded) expect(mayFold(answerFor(p, "de").credits)).toBe(true);
    const connect = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "src", "layouts", "ConnectPage.astro"), "utf8");
    expect(connect.match(/<details class="fold connect-more">\s*<summary class="fold__summary"><span class="fold__label">[^\n]*<Fragment set:html=\{(?:promptSources|cardSources)\} \/><\/summary>/gu)?.length).toBe(2);
  });

  it("the home's moments: a folded one carries the sources line; the rule is applied to each", () => {
    const day = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "src", "components", "Day.astro"), "utf8");
    expect(day).toContain("const folded = n >= DAY_OPEN && mayFold(firstIds(m));");
    expect(day).toContain("<Fragment set:html={foldSourcesFor(lang, firstIds(m))} />");
    // FS12: a moment crediting the Autobahn GmbH folds like any other
    expect(MOMENTS.some((m) => m.answers[0].credits.includes("autobahn") && mayFold(m.answers[0].credits))).toBe(true);
  });
});
