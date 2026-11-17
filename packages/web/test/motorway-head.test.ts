/**
 * 2.1.17 (#716 search): the shell reads a motorway page's title, description
 * and intro off the digest's fragment (`lib/motorway-head.ts`) — over the
 * WHOLE register in seven languages, through the digest's own builders, so
 * what the digest writes is what the shell prints, inside the bounds the
 * shell's `<head>` is held to. And the shell's own catalogue — the fallback
 * for a fragment that carries none — is the digest's no-course wording, so the
 * two cannot promise different pages.
 */
import { MOTORWAY_SEO_COPY, motorwayDescriptionOf, motorwayHeadAttrs, motorwayTitleOf, type MotorwayFacts } from "@viafrei/digest";
import { webPinned } from "./lang-pins.js";
const COURSE = webPinned((p) => p.course);
import { describe, expect, it } from "vitest";
import { all, text as nodeText } from "@viafrei/design/testing";
import { pageDescription } from "@viafrei/design";
import { t } from "../src/i18n/index.js";
import { HEAD_TITLE_LIMIT, motorwayHeadOf, unescapeAttr } from "../src/lib/motorway-head.js";
import { liftAmpel } from "../src/lib/motorway-ampel.js";
import { DESCRIPTION_MAX, DESCRIPTION_MIN, TITLE_MAX, motorwayMeta } from "../src/site/meta.js";
import { MOTORWAY_REGISTER } from "../src/site/motorways.js";
import { LIVE_LANGS } from "../src/site/pages.js";

const fragment = (attrs: string, intro = '<p class="lead motorway__intro">Die <span translate="no">A7</span> führt von <span translate="no">AS Füssen</span> bis <span translate="no">AS Flensburg/Harrislee</span>.</p>'): string =>
  `<section class="motorway" id="motorway"${attrs} aria-labelledby="motorway-now-t">${intro}<h2 class="motorway__h2" id="motorway-now-t">Jetzt gemeldet</h2><p>x</p></section>`;

describe("reading the head off a motorway fragment", () => {
  it("takes the title, the description and the intro, and strips all three from the fragment it embeds", () => {
    const h = motorwayHeadOf("A7", fragment(' data-title="A7 Stau aktuell: Baustellen, Sperrung, Karte – ViaFrei" data-description="A7 Stau aktuell von Füssen bis Flensburg/Harrislee: Sperrungen &amp; Baustellen."'));
    expect(h.title).toBe("A7 Stau aktuell: Baustellen, Sperrung, Karte – ViaFrei");
    expect(h.description).toBe("A7 Stau aktuell von Füssen bis Flensburg/Harrislee: Sperrungen & Baustellen.");
    expect(all(h.intro ?? "", "span[translate=\"no\"]").map(nodeText)).toContain("AS Füssen");
    expect(h.html).toBe('<section class="motorway" id="motorway" aria-labelledby="motorway-now-t"><h2 class="motorway__h2" id="motorway-now-t">Jetzt gemeldet</h2><p>x</p></section>');
  });
  it("a fragment with none of them (an older digest) is embedded unchanged, and the layout keeps its catalogue", () => {
    const f = fragment("", "");
    expect(motorwayHeadOf("A7", f)).toEqual({ html: f, title: null, description: null, first: null, intro: null, note: null, robots: null, exit: null, canonical: null });
    const other = '<section class="motorways" id="motorway-index"><p>x</p></section>';
    expect(motorwayHeadOf("A7", other).html).toBe(other);
  });
  it("a value that is not plausibly the digest's is ignored: empty, over the bound, not naming the road, a slot or a missing value left in it", () => {
    expect(motorwayHeadOf("A7", fragment(` data-title="A7 ${"x".repeat(HEAD_TITLE_LIMIT - 2)}"`)).title).toBeNull();
    for (const bad of ["", "   ", "B7 Stau aktuell", "A7 {lands}", "A7 undefined", "A7 null", "A7 &lt;b&gt;"]) {
      const h = motorwayHeadOf("A7", fragment(` data-title="${bad}" data-description="${bad}"`));
      expect([h.title, h.description], bad).toEqual([null, null]);
    }
    expect(motorwayHeadOf("A7", fragment(` data-description="A7 ${"y".repeat(200)}"`)).description).toBeNull();
  });
  it("2.5.17: the junctions' note under the course is lifted with the intro, so the Ampel leads the rest; a note with a second class, or one without an intro, stays", () => {
    const amp = '<section class="pcard pcard--attention ampel ampel--red" id="motorway-ampel" aria-labelledby="ampel-h"><p>a</p></section>';
    const note = 'Betroffen: <a href="a7/exit-128-memmingen" translate="no">AK Memmingen</a>.';
    const root = '<section class="motorway" id="motorway" aria-labelledby="motorway-now-t">';
    const h = motorwayHeadOf("A7", `${root}<p class="lead motorway__intro">Die A7 f\u00fchrt von A nach B.</p><p class="motorway__note">${note}</p>${amp}</section>`);
    expect(h.note).toBe(note);
    expect(h.html).toBe(`${root}${amp}</section>`);
    expect(liftAmpel(h.html).ampel).toBe(amp);
    const other = `${root}<p class="lead motorway__intro">x</p><p class="motorway__note ampel__more">y</p>${amp}</section>`;
    expect(motorwayHeadOf("A7", other).note).toBeNull();
    const noIntro = `${root}<p class="motorway__note">${note}</p>${amp}</section>`;
    expect(motorwayHeadOf("A7", noIntro)).toMatchObject({ note: null, html: noIntro });
  });
  it("an intro that is empty is no intro", () => {
    expect(motorwayHeadOf("A7", fragment("", '<p class="lead motorway__intro"> </p>')).intro).toBeNull();
  });
  it("#1110: an interchange page's one address (data-canonical) is read only as an exit path in the page's language, and stripped", () => {
    const ix = ' data-title="Kreuz Weinsberg (Weinsberger Kreuz): Stau – ViaFrei" data-exit="Kreuz Weinsberg (Weinsberger Kreuz)"';
    const h = motorwayHeadOf("A81", fragment(`${ix} data-canonical="/de/autobahn/a6/exit-38-weinsberg"`), "de");
    expect(h.canonical).toBe("/de/autobahn/a6/exit-38-weinsberg");
    // the title names the Kreuz, not the road: plausible because it names the junction the page is about
    expect(h.title).toBe("Kreuz Weinsberg (Weinsberger Kreuz): Stau – ViaFrei");
    expect(h.html).not.toContain("data-canonical");
    for (const bad of ["/en/autobahn/a6/exit-38-weinsberg", "/de/ort/koeln", "https://example.org/de/autobahn/a6/exit-38-weinsberg", "/de/autobahn/a6", "/de/autobahn/a6/exit-38-weinsberg?x=1", "/de/autobahn/a6/exit-38-weinsberg/../x"])
      expect(motorwayHeadOf("A81", fragment(`${ix} data-canonical="${bad}"`), "de").canonical, bad).toBeNull();
    // no junction named: no canonical, and a title naming neither the road nor a junction is not the digest's
    const none = motorwayHeadOf("A81", fragment(' data-title="Kreuz Weinsberg: Stau" data-canonical="/de/autobahn/a6/exit-38-weinsberg"'), "de");
    expect([none.canonical, none.title]).toEqual([null, null]);
  });
  it("undoes exactly the five entities the digest writes", () => {
    expect(unescapeAttr("&amp;&lt;&gt;&quot;&#39;&amp;amp;&nbsp;")).toBe(`&<>"'&amp;&nbsp;`);
  });
});

const LONG: Omit<MotorwayFacts, "road"> = { course: true, ends: { a: { type: "AS", name: "Grenzübergang Flensburg-Harrislee/Ellund-Süd" }, b: { type: "AK", name: "Kreuz Mönchengladbach-Holz/Wanlo" } }, km: 928, lands: ["09", "08", "06", "03", "02", "01"], junctions: 141, interchanges: 20, gaps: [] };

describe("the whole register through the shell's reader (#716, 2.1.17)", () => {
  it(`every one of the ${String(MOTORWAY_REGISTER.length)} motorways in seven languages: what the digest writes is what the head prints, inside the shell's bounds`, () => {
    let n = 0;
    for (const road of MOTORWAY_REGISTER)
      for (const lang of LIVE_LANGS)
        for (const f of [{ road, ...LONG }, { road, ...LONG, ends: null, lands: [] }, { road, course: false, ends: null, km: null, lands: [], junctions: null, interchanges: null, gaps: [] }] as MotorwayFacts[]) {
          const h = motorwayHeadOf(road, fragment(motorwayHeadAttrs(lang, f)));
          expect(h.title, `${road} ${lang}`).toBe(motorwayTitleOf(lang, f));
          expect(h.description, `${road} ${lang}`).toBe(motorwayDescriptionOf(lang, f));
          expect(h.title!.length, h.title!).toBeLessThanOrEqual(TITLE_MAX);
          expect(h.description!.length, h.description!).toBeLessThanOrEqual(DESCRIPTION_MAX);
          expect(h.description!.length, h.description!).toBeGreaterThanOrEqual(DESCRIPTION_MIN);
          n += 1;
        }
    expect(n).toBe(MOTORWAY_REGISTER.length * LIVE_LANGS.length * 3);
  });
  it("the shell's own title (the fallback) is the digest's no-course wording, its description the evergreen builder's (#1310 B2), in every language", () => {
    for (const lang of LIVE_LANGS) {
      const c = MOTORWAY_SEO_COPY[lang];
      expect(motorwayMeta("A7", lang), lang).toEqual({ title: c.titleNoCourse.replace("{road}", "A7"), description: pageDescription(lang, { kind: "motorway", name: "A7" }) });
      // the fallback lead promises no course either: it is the lead of a page that may hold none
      const own = (COURSE as Readonly<Record<string, string>>)[lang];
      expect(t(lang, "seo.motorwayLead", { road: "A7" }).toLowerCase(), lang).not.toMatch(own === undefined ? /Verlauf|route|маршрут|traseu|güzergâh/iu : new RegExp(own.toLowerCase(), "u"));
    }
  });
});
