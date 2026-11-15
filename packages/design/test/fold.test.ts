import { describe, expect, it } from "vitest";
import { all, text } from "../src/testing/index.js";
import { foldTile, foldWhole, liftCredits } from "../src/fold.js";
import { creditNames, FOLD_RULED_LICENCES, FOLD_UNRULED_CREDITS, foldSourcesFromTexts, foldSourcesHtml, unruledText } from "../src/sources-names.js";

const A = '<p class="credit" lang="de">Daten: A — <a href="x">DL-DE BY 2.0</a></p>';
const B = '<p class="credit credit--note" lang="de">MTS-K: nur zur Information</p>';
const BODY = '<ul class="x"><li>1</li></ul>';

describe("#1176/#1177: liftCredits takes the named credit lines out of a fold's content, unchanged and in order", () => {
  it("every line by default; the rest keeps everything else", () => {
    const r = liftCredits(`${BODY}${A}<div class="p">${B}</div>`);
    expect(r).toEqual({ rest: `${BODY}<div class="p"></div>`, lifted: `${A}${B}` });
  });
  it("only the lines `keep` names (FS4: the lines a card keeps beside data in view)", () => {
    const r = liftCredits(`${A}${BODY}${B}`, (b) => b.includes("credit--"));
    expect(r).toEqual({ rest: `${A}${BODY}`, lifted: B });
  });
  it("nothing to lift: the content as it was", () => {
    expect(liftCredits(BODY)).toEqual({ rest: BODY, lifted: "" });
  });
  it("a class that merely starts with the word is not a credit line", () => {
    const x = '<p class="credits-list">x</p><p class="creditor">y</p>';
    expect(liftCredits(x)).toEqual({ rest: x, lifted: "" });
  });
});

const C = '<p class="credit" lang="de">Ladepunkte: Ladesäulenregister der Bundesnetzagentur, CC BY 4.0</p>';
const D = '<p class="credit" lang="de">Verkehrslage: Landesbetrieb Straßenbau und Verkehr Schleswig-Holstein, DL-DE BY 2.0</p>';

describe("FS-2026-11-06 FS3: the visible sources line names every publisher of the folded lines, each whole, no 'weitere'", () => {
  it("every credit line's publisher, once each, in order, uncut", () => {
    expect(creditNames(`${A}${BODY}${C}<div>${D}${A}</div>`)).toEqual(["A", "Ladesäulenregister der Bundesnetzagentur", "Landesbetrieb Straßenbau und Verkehr Schleswig-Holstein"]);
  });
  it("the line in the page's language, each name translate=no, never 'und N weitere'", () => {
    const many = Array.from({ length: 9 }, (_, i) => `<p class="credit">Daten: Herausgeber ${i}, CC BY 4.0</p>`).join("");
    const de = foldSourcesHtml("de", many);
    expect(de.startsWith('<span class="fold__sources">Quellen: <span translate="no">Herausgeber 0</span>')).toBe(true);
    expect(all(de, 'span[translate="no"]').map((e) => text(e))).toEqual(Array.from({ length: 9 }, (_, i) => `Herausgeber ${i}`));
    expect(de).not.toMatch(/weitere|more/u);
    expect(foldSourcesHtml("en", C)).toBe('<span class="fold__sources">Sources: <span translate="no">Ladesäulenregister der Bundesnetzagentur</span></span>');
  });
  it("nothing credited: no line", () => {
    expect(foldSourcesHtml("de", BODY)).toBe("");
  });
});

describe("FS-2026-11-06 FS1: a fold holds its data AND its credit lines; nothing of either stands outside it", () => {
  const S = '<section class="tile" id="t">';
  it("foldTile folds the section's whole body, credit lines included, and keeps the section", () => {
    const html = `${S}<h3>T</h3>${BODY}${A}<p class="x">after</p>${B}</section>`;
    const out = foldTile("de", html, "Zeigen", "now__fold")!;
    expect(out).toBe(`${S}<details class="fold now__fold"><summary class="fold__summary"><span class="fold__label">Zeigen</span><span class="fold__sources">Quellen: <span translate="no">A</span></span></summary><h3>T</h3>${BODY}${A}<p class="x">after</p>${B}</details></section>`);
    const inside = out.slice(out.indexOf("</summary>"), out.indexOf("</details>"));
    expect(inside).toContain(A);
    expect(inside).toContain(B);
  });
  it("a credit line moved out of the fold is caught: the details holds every line of the tile", () => {
    const html = `${S}<h3>T</h3>${BODY}${A}</section>`;
    const out = foldTile("de", html, "Zeigen", "now__fold")!;
    expect(out.split("</details>")[1]).toBe("</section>");
  });
  it("not one balanced section: null, and the caller folds it whole", () => {
    expect(foldTile("de", `<div>${A}</div>`, "Z", "c")).toBeNull();
    expect(foldTile("de", `<section><div></section>`, "Z", "c")).toBeNull();
    expect(foldWhole("de", `<div>${A}</div>`, "Z", "c")).toBe(`<details class="fold c"><summary class="fold__summary"><span class="fold__label">Z</span><span class="fold__sources">Quellen: <span translate="no">A</span></span></summary><div>${A}</div></details>`);
  });
});

describe("FS12 (2026-11-06): the two classes FS8 held back fold WITH their data, named uncut", () => {
  const AB = '<p class="credit" lang="de">Verkehrsdaten: Autobahn GmbH des Bundes</p>';
  const CP = '<p class="credit" lang="de">Ladepunkte und Verfügbarkeit: Chargepool Enerando Technologies GmbH via Mobilithek, lizenzfrei</p>';
  it("the Autobahn GmbH's and Chargepool's lines stay inside the fold, verbatim (C1 of #1021); the summary names both", () => {
    const out = foldWhole("de", `${BODY}${A}${AB}${CP}`, "Z", "c");
    expect(out).toBe(`<details class="fold c"><summary class="fold__summary"><span class="fold__label">Z</span><span class="fold__sources">Quellen: <span translate="no">A</span>, <span translate="no">Autobahn GmbH des Bundes</span>, <span translate="no">Chargepool Enerando Technologies GmbH</span></span></summary>${BODY}${A}${AB}${CP}</details>`);
  });
  it("FS8 continues: the list of unruled lines is empty, and a caller's keep still lifts a line right after the fold", () => {
    expect(FOLD_UNRULED_CREDITS).toEqual([]);
    expect(FOLD_RULED_LICENCES).toEqual(expect.arrayContaining(["open data (Autobahn GmbH)", "lizenzfrei (conditionForUse)"]));
    const out = foldTile("de", `<section class="tile">${BODY}${AB}</section>`, "Z", "c")!;
    expect(out.endsWith(`${AB}</details></section>`)).toBe(true);
    expect(foldWhole("de", `${BODY}${AB}`, "Z", "c", (b) => b === AB).endsWith(`</details>${AB}`)).toBe(true);
  });
});

describe("FS-2026-11-06 for register lines given as text (the shell's CreditItem folds)", () => {
  it("FS3: the same line from the lines' texts — every publisher once, whole, three and more", () => {
    const html = foldSourcesFromTexts("de", [
      "Bahnhofsdaten: Deutsche Bahn AG, DB API Marketplace, CC BY 4.0, bearbeitet",
      "Fahrplandaten: DELFI e.V., CC BY 4.0, bearbeitet",
      "Bahnhofsdaten: Deutsche Bahn AG, DB API Marketplace, CC BY 4.0, bearbeitet",
      "Ladesäulenregister: Bundesnetzagentur.de, CC BY 4.0",
    ]);
    expect(all(html, 'span[translate="no"]').map((e) => text(e))).toEqual(["Deutsche Bahn AG", "DELFI e.V.", "Bundesnetzagentur.de"]);
    expect(text(all(html, ".fold__sources")[0]!)).toBe("Quellen: Deutsche Bahn AG, DELFI e.V., Bundesnetzagentur.de");
    expect(foldSourcesFromTexts("de", [])).toBe("");
  });
  it("FS8: unruledText reads a register text as unruledCredit reads its line (no class is unruled since FS12)", () => {
    // FS12: neither class is held back any more
    expect(unruledText("Verkehrsdaten: Autobahn GmbH des Bundes")).toBe(false);
    expect(unruledText("Ladepunkte und Verfügbarkeit: Chargepool Enerando Technologies GmbH via Mobilithek, lizenzfrei")).toBe(false);
    expect(unruledText("Fahrplandaten: DELFI e.V., CC BY 4.0, bearbeitet")).toBe(false);
  });
});
