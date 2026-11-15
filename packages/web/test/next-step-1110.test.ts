/**
 * #1110 item 3, the pure half (`lib/next-step.ts`): the row's roads from a fragment's shields, the subject's three
 * closed shapes through the connect page's query, and the prefilled question in every language. The rendered pages are
 * `main-urls.test.ts` "#1110 item 3".
 */
import { describe, expect, it } from "vitest";
import { all, text } from "@viafrei/design/testing";
import { NEXT_ROADS_MAX, askAboutOf, askHref, askLabel, askLabelHtml, askLink, askQuestion, asksAbout, nextRoads } from "../src/lib/next-step.js";
import { LIVE_LANGS } from "../src/site/pages.js";

const shield = (r: string): string => `<span class="shield shield--a">${r}</span>`;
const q = (s: string): URLSearchParams => new URLSearchParams(s);

describe("#1110 item 3: the row's road links", () => {
  it("the register motorways the fragment shows, each once, at most three, in the fragment's order", () => {
    const html = [shield("A3"), shield("B9"), shield("A3"), shield("A4"), shield("A999"), shield("A1"), shield("A7")].join("");
    expect(nextRoads("de", html).map((r) => r.label)).toEqual(["A3", "A4", "A1"]);
    expect(NEXT_ROADS_MAX).toBe(3);
    expect(nextRoads("en", shield("A3"))).toEqual([{ label: "A3", href: "/en/autobahn/a3" }]);
  });
  it("an exit page leads with its own road; a road page leaves itself out", () => {
    expect(nextRoads("de", shield("A6") + shield("A81"), { first: "A81" }).map((r) => r.label)).toEqual(["A81", "A6"]);
    expect(nextRoads("de", shield("A6") + shield("A81"), { except: "A81" }).map((r) => r.label)).toEqual(["A6"]);
  });
  it("no motorway at all: the motorway index stands in, in every language", () => {
    for (const lang of LIVE_LANGS) {
      const r = nextRoads(lang, shield("B9"), { except: "A7" });
      expect(r, lang).toHaveLength(1);
      expect(r[0]!.href, lang).toBe(`/${lang}/autobahn`);
      expect(r[0]!.label.length, lang).toBeGreaterThan(2);
    }
  });
});

describe("#1110 item 3: the subject travels as one of three closed shapes", () => {
  it("place, road and exit round-trip through the connect address", () => {
    for (const a of [{ kind: "place", place: "Halle (Saale)" }, { kind: "road", road: "A7" }, { kind: "exit", road: "A81", exit: "Weinsberg" }] as const) {
      const href = askHref("de", a);
      expect(href.startsWith("/de/connect?"), href).toBe(true);
      expect(askAboutOf(q(href.slice(href.indexOf("?") + 1)))).toEqual(a);
    }
  });
  it("the road is read as the register's canonical number; an unknown motorway or junk is refused", () => {
    expect(askAboutOf(q("road=a%2007"))).toEqual({ kind: "road", road: "A7" });
    expect(askAboutOf(q("road=A999"))).toBeNull();
    expect(askAboutOf(q("road=B9"))).toBeNull();
    expect(askAboutOf(q("road=A999&about=Weinsberg"))).toBeNull();
  });
  it("a name is 1–60 letters, digits and name punctuation; markup, a URL, an overlong or empty name is refused", () => {
    expect(askAboutOf(q("about=%20%20Frankfurt%20%20am%20Main%20"))).toEqual({ kind: "place", place: "Frankfurt am Main" });
    expect(askAboutOf(q(`about=${"a".repeat(60)}`))).not.toBeNull();
    for (const bad of [`about=${"a".repeat(61)}`, "about=%3Cscript%3E", "about=https%3A%2F%2Fevil.example", "about=", "about=-Köln", "road=A7&about=%3Cb%3E"]) expect(askAboutOf(q(bad)), bad).toBeNull();
    expect(askAboutOf(q(""))).toBeNull();
  });
  it("any subject parameter makes the view noindex, valid or not", () => {
    expect(asksAbout(q("about=K%C3%B6ln"))).toBe(true);
    expect(asksAbout(q("road=junk"))).toBe(true);
    expect(asksAbout(q("lang=de"))).toBe(false);
  });
  it("the row's link falls back: an exit name the check refuses asks about the road; a refused place is the bare page", () => {
    expect(askLink("de", { kind: "exit", road: "A7", exit: "<x>" })).toEqual({
      href: "/de/connect?road=A7",
      label: askLabel("de", { kind: "road", road: "A7" }),
      html: askLabelHtml("de", { kind: "road", road: "A7" }),
    });
    expect(askLink("de", { kind: "place", place: "<x>" }).href).toBe("/de/connect");
    expect(askLink("de", { kind: "place", place: "Köln" }).href).toBe("/de/connect?about=K%C3%B6ln");
  });
});

describe("#1110 item 3: the question and the link's words, in every language", () => {
  it("each names its subject, and no two languages share a sentence", () => {
    const seen = new Map<string, string>();
    for (const lang of LIVE_LANGS) {
      const place = askQuestion(lang, { kind: "place", place: "Köln" });
      const road = askQuestion(lang, { kind: "road", road: "A7" });
      const exit = askQuestion(lang, { kind: "exit", road: "A81", exit: "Weinsberg" });
      expect(place, lang).toContain("Köln");
      expect(road, lang).toContain("A7");
      expect(exit, lang).toContain("A81");
      expect(exit, lang).toContain("Weinsberg");
      expect(askLabel(lang, { kind: "place", place: "Köln" }), lang).toContain("Köln");
      expect(askLabel(lang, { kind: "exit", road: "A81", exit: "Weinsberg" }), lang).toContain("A81 Weinsberg");
      for (const s of [place, road, exit]) {
        expect(s, lang).not.toMatch(/\{\w+\}/u);
        if (lang !== "de" && lang !== "en") expect(seen.get(s), `${lang} repeats ${String(seen.get(s))}`).toBeUndefined();
        seen.set(s, lang);
      }
    }
    // the French typography: a no-break space before the question mark
    expect(askQuestion("fr", { kind: "road", road: "A7" }).endsWith(" ?")).toBe(true);
    expect(askQuestion("el", { kind: "road", road: "A7" }).endsWith(";")).toBe(true);
  });
});

describe("#1110 item 3 (2.5.2): the subject in the link is a name, marked translate=\"no\" (#449)", () => {
  it("in every language the link's text is the label, and the subject is the one name in it", () => {
    for (const lang of LIVE_LANGS) {
      const html = askLabelHtml(lang, { kind: "place", place: "Köln" });
      expect(all(html, 'span[translate="no"]').map(text), lang).toEqual(["Köln"]);
      expect(html.replace(/<[^>]+>/gu, ""), lang).toBe(askLabel(lang, { kind: "place", place: "Köln" }));
      expect(askLink(lang, { kind: "place", place: "Köln" }).html, lang).toBe(html);
    }
  });
  it("the subject is escaped", () => {
    const html = askLabelHtml("en", { kind: "exit", road: "A7", exit: "<b>&" });
    // an unescaped subject would parse as a b element; escaped, it is the span's text
    expect(all(html, "b")).toEqual([]);
    expect(all(html, 'span[translate="no"]').map(text)).toEqual(["A7 <b>&"]);
  });
});
