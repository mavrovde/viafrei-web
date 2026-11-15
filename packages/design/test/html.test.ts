/**
 * #922: the building blocks, read through the parsed-DOM helpers — the
 * states (C1), escaping once and never twice (C2), no credit and no figure
 * without one (C3), an accessible name with no figure (C4), no hard-coded
 * direction (C5) — and the helpers themselves, which must be able to say no.
 */
import { describe, expect, it } from "vitest";
import { RENDERED_STATES, TILE_STATES, agePill, creditLine, esc, raw, stateClass, tileShell, type Html } from "../src/index.js";
import { all, classesIn, first, parse, text, tile, wellFormed } from "../src/testing/index.js";

const shell = (over: Partial<Parameters<typeof tileShell>[0]> = {}): string =>
  tileShell({ id: "lifts", state: "ok", title: esc("Aufzüge"), pill: agePill({ word: esc("aktuell"), time: esc("vor 4 min") }), figure: { value: esc("97 %"), unit: esc("in Betrieb") }, credits: [creditLine({ body: esc("DB InfraGO AG") })], ...over });

describe("tileShell", () => {
  it("C1: every state of the contract, the loading one included, is its class on the tile", () => {
    for (const s of TILE_STATES) {
      const t = tile(shell({ state: s }));
      expect(t.state, s).toBe(s);
      expect(classesIn(shell({ state: s })).has(`is-${s}`), s).toBe(true);
    }
    for (const s of RENDERED_STATES) expect(stateClass(s)).toBe(`is-${s}`);
    expect(() => stateClass("loading" as never)).toThrow(/not a rendered state/);
  });

  it("reads as a tile: labelled by its title, the pill's word and age, the figure, one credit per source", () => {
    const t = tile(shell());
    expect(t).toMatchObject({ id: "tile-lifts", state: "ok", title: "Aufzüge", accessibleName: "Aufzüge", pill: { word: "aktuell", time: "vor 4 min" }, figure: "97 %", credits: ["DB InfraGO AG"] });
    expect(wellFormed(shell())).toEqual([]);
  });

  it("C2: a title, credit or figure with <, &, a quote or a newline is escaped once", () => {
    const evil = 'A<b> & "c"\nd';
    const html = shell({ title: esc(evil), figure: { value: esc(evil), unit: esc("") }, credits: [creditLine({ body: esc(evil) })] });
    const t = tile(html);
    expect(t.title).toBe(evil);
    expect(t.figure).toBe(evil);
    expect(t.credits).toEqual([evil]);
    expect(html).not.toContain("<b>");
    expect(html).not.toContain("&amp;amp;");
    // @ts-expect-error -- Html is branded: escaping it again does not compile
    esc(esc(evil));
    const h: Html = esc("x");
    expect(h).toBe("x");
  });

  it("C3: no credit line renders no foot, and suppresses the figure's value (#377 R3)", () => {
    const html = shell({ credits: [] });
    expect(first(html, "footer")).toBeNull();
    expect(all(html, "p.credit")).toEqual([]);
    expect(tile(html).figure).toBe("—");
    // a figure with its source keeps its value
    expect(tile(shell()).figure).toBe("97 %");
  });

  it("C4: an empty tile with no figure still has an accessible name", () => {
    const t = tile(shell({ state: "empty", figure: undefined as never, credits: [] }));
    expect(t.figure).toBeNull();
    expect(t.accessibleName).toBe("Aufzüge");
  });

  it("C5: no direction is written unless the caller passes one", () => {
    expect(shell()).not.toMatch(/\bdir=/);
    expect(first(shell({ dir: "rtl" }), "section.tile")?.attrs.dir).toBe("rtl");
  });

  it("extra attributes are escaped and kept in order", () => {
    const html = shell({ attrs: { "aria-busy": "true", "data-vf-fill": '/x?a=1&b="2"' } });
    expect(first(html, "section.tile")?.attrs).toMatchObject({ "aria-busy": "true", "data-vf-fill": '/x?a=1&b="2"' });
    expect(html).toContain('data-vf-fill="/x?a=1&amp;b=&quot;2&quot;"');
  });
});

describe("agePill and creditLine", () => {
  it("the pill has no age when none is given", () => {
    expect(first(agePill({ word: esc("leer") }), ".age__time")).toBeNull();
  });
  it("a credit line is German and carries its modifier", () => {
    const c = first(creditLine({ body: raw("<a href=\"https://x\">X</a>"), modifier: "credit--fuel" }), "p");
    expect(c?.attrs).toMatchObject({ class: "credit credit--fuel", lang: "de" });
  });
});

describe("the parsed-DOM helpers can say no", () => {
  it("a tile that is not one, an unclosed element and a stray close are reported", () => {
    expect(() => tile("<p>no tile</p>")).toThrow(/no section.tile/);
    expect(wellFormed("<section><p>a</section>")).toEqual(["<p> closed by </section> at 13"]);
    expect(wellFormed("<p>a</p></div>")).toEqual(["a stray </div> at 8"]);
    expect(wellFormed("<p>a")).toEqual(["<p> never closed"]);
  });
  it("a label pointing at nothing is no accessible name", () => {
    expect(tile('<section class="tile is-ok" aria-labelledby="gone"></section>').accessibleName).toBeNull();
  });
  it("selectors: compound, descendant, attribute", () => {
    const html = '<div class="a"><p class="b c" lang="de">x &amp; y</p></div><p class="b">z</p>';
    expect(all(html, "p.b").length).toBe(2);
    expect(all(html, ".a p.b.c").length).toBe(1);
    expect(all(html, 'p[lang="de"]').map((e) => text(e))).toEqual(["x & y"]);
    expect(all(html, "p[lang]").length).toBe(1);
    expect(parse("<br><img src=x>").problems).toEqual([]);
  });

  it("selectors: a dot or a hash inside an attribute value is neither a class nor an id", () => {
    const html = '<a href="https://www.bkg.bund.de" rel="license noopener">BKG</a><a href="#ort">Ort</a>';
    expect(all(html, 'a[href="https://www.bkg.bund.de"][rel="license noopener"]').map((e) => text(e))).toEqual(["BKG"]);
    expect(all(html, 'a[href="#ort"]').map((e) => text(e))).toEqual(["Ort"]);
  });
});
