/**
 * #901 D3/D4/D8/D9/D10: the motorway page's type filter, the shell's half.
 *
 *   - D3: its kinds, map classes and anchor kinds ARE the digest's block registry — a kind added there and not here is
 *     red here; `site.css` hides every kind's card, around rows and map marks by one class each.
 *   - The bar is read off the digest's own card markup (`cardHtml`), so a change of that markup cannot silently leave
 *     the bar empty.
 *   - D4: the summary in the owner's words ("Parken und Laden im Umkreis von 50 km: 12 Einträge"), in seven languages.
 *   - D9: `?show=` takes the registry's kinds only and survives a redirect (`motorwayViewQuery`); the script stores
 *     nothing but on the "merken" click, sends nothing, and the bar is `hidden` until it runs.
 * The behaviour in a browser (no reload, the counts, the maps, the Ampel note, 1200/390 px, de/en) is
 * `e2e/motorway-filter.e2e.ts`.
 */
import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { all } from "@viafrei/design/testing";
import { AROUND_REF_KIND, MOTORWAY_ANCHOR_KIND as DIGEST_ANCHORS, MOTORWAY_KIND_MAP, MOTORWAY_KIND_META, MOTORWAY_KINDS, cardHtml, cardsGridHtml, renderMotorwayPage, type MotorwayKind } from "@viafrei/digest";
import {
  FILTER_JS,
  MOTORWAY_ANCHOR_KIND,
  MOTORWAY_FILTER_ICONS,
  MOTORWAY_FILTER_KINDS,
  MOTORWAY_FILTER_MAP,
  MOTORWAY_FILTER_STORE,
  filterCardsOf,
  motorwayFilterHtml,
  motorwayFilterScript,
  showOf,
  showQuery,
  summaryText,
  type FilterCard,
} from "../src/lib/motorway-filter.js";
import { motorwayViewQuery } from "../src/lib/motorway.js";
import { LIVE_LANGS } from "../src/site/pages.js";
import { t } from "../src/i18n/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "../src/styles/site.css"), "utf8");

describe("D3: the shell's kinds are the digest's block registry", () => {
  // pin-skew: the shell is 2.6.18 (the `speed` kind, #1304); the pinned digest is viafrei-app 2.6.17 and has no `speed` block. Green again when images.pin names a released viafrei-app >= 2.6.18 (viafrei-web#2, docs/moved-from-viafrei.md)
  it.skip("the kinds, in the registry's order", () => {
    expect([...MOTORWAY_FILTER_KINDS]).toEqual([...MOTORWAY_KINDS]);
  });
  // pin-skew: the shell is 2.6.18 (the `speed` kind, #1304); the pinned digest is viafrei-app 2.6.17 and has no `speed` block. Green again when images.pin names a released viafrei-app >= 2.6.18 (viafrei-web#2, docs/moved-from-viafrei.md)
  it.skip("each kind's map classes", () => {
    expect(MOTORWAY_FILTER_MAP).toEqual(MOTORWAY_KIND_MAP);
  });
  it("#987: each kind's icon is the digest's (one symbol id per kind, the card head's own)", () => {
    for (const k of MOTORWAY_KINDS) expect(MOTORWAY_FILTER_ICONS[k], k).toBe(MOTORWAY_KIND_META[k].icon);
  });
  it("the Ampel's anchors by kind", () => {
    expect(MOTORWAY_ANCHOR_KIND).toEqual(DIGEST_ANCHORS);
  });
  it("no stylesheet rule per kind (the home's 60 KB budget pays for every byte of site.css): the script hides by kind", () => {
    expect(css).not.toMatch(/mwf-off-/);
    for (const lang of LIVE_LANGS) {
      const js = motorwayFilterScript(lang);
      // the registry's map classes travel with the script, and each card is found by its own id
      expect(js).toContain(`"map":${JSON.stringify(MOTORWAY_FILTER_MAP)}`);
      expect(js).toContain('querySelectorAll("#mw-cards > .mwk, #mw-quiet > .mwk, #mw-ref > .mwk")');
      expect(js).toContain(".mwa__item");
      // #1064: the code's shape is read in its source (the page carries it minified, test/inline-scripts.test.ts)
      // while the page is parsed, each chunk is filtered before it is painted (a ?show= page does not shift)
      expect(FILTER_JS).toContain("new MutationObserver(function (rs) { if (rs.some(function (r) { return !bar.contains(r.target); })) apply(); })");
      // the summary is written only when it changes (a write is a mutation; the observer must not answer its own)
      expect(FILTER_JS).toContain("if (sum.textContent !== t) sum.textContent = t;");
    }
    // an around row of a kind the registry does not know would never be hidden
    for (const k of Object.values(AROUND_REF_KIND)) if (k !== null) expect(MOTORWAY_FILTER_KINDS as readonly string[]).toContain(k);
  });
});

/** Every kind's card as the digest renders it, kind k with k+1 rows (the fuel card is not a list). */
function grid(lang: (typeof LIVE_LANGS)[number]): string {
  const page = { line: [], junctions: [], at: new Date("2026-10-25T10:00:00Z"), live: { state: "error" } } as unknown as Parameters<typeof cardHtml>[1];
  return cardsGridHtml(MOTORWAY_KINDS.map((kind: MotorwayKind, i: number) => cardHtml(lang, page, { kind, rows: kind === "fuel" ? null : Array.from({ length: i + 1 }, (_, n) => ({ html: `row ${String(n)}` })) })));
}

describe("the bar is read off the digest's card markup", () => {
  for (const lang of LIVE_LANGS)
    it(`${lang}: every card found, in order, with its heading and its count`, () => {
      const cards = filterCardsOf(grid(lang));
      expect(cards.map((c) => c.kind)).toEqual([...MOTORWAY_KINDS]);
      cards.forEach((c, i) => {
        expect(c.title, c.kind).not.toBe("");
        expect(c.n, c.kind).toBe(c.kind === "fuel" ? null : i + 1);
      });
    });

  it("the bar: hidden, one real checkbox per card, checked as the address asks, a legend, a live summary", () => {
    const cards = filterCardsOf(grid("de"));
    const html = motorwayFilterHtml("de", cards, ["parking", "charging"]);
    expect(html).toMatch(/^<section class="wrap mwf" id="mwf" hidden aria-labelledby="mwf-l"><fieldset class="mwf__set"><legend class="mwf__legend" id="mwf-l">Anzeigen<\/legend>/);
    expect((html.match(/<input type="checkbox" name="show" value="[a-z]+"/g) ?? []).length).toBe(MOTORWAY_KINDS.length);
    expect((html.match(/ checked>/g) ?? []).length).toBe(2);
    expect(all(html, "input[type=\"checkbox\"][name=\"show\"][value=\"parking\"][checked]").length).toBeGreaterThan(0);
    expect(all(html, "p.mwf__sum[id=\"mwf-sum\"][aria-live=\"polite\"]").length).toBeGreaterThan(0);
    expect(html).not.toMatch(/ data-|<script|<form/);
    expect(motorwayFilterHtml("de", [], null)).toBe("");
  });

  it("#983: 'Keine anzeigen' beside 'Alle anzeigen', both named in full (the visible words inside), in every language", () => {
    for (const lang of LIVE_LANGS) {
      const html = motorwayFilterHtml(lang, filterCardsOf(grid(lang)), null);
      const allB = all(html, "button.mwf__all")[0]!;
      const noneB = all(html, "button.mwf__none")[0]!;
      expect(noneB, lang).toBeDefined();
      const c = { all: t(lang, "place.motorway.filter.all"), none: t(lang, "place.motorway.filter.none"), allLabel: t(lang, "place.motorway.filter.allLabel"), noneLabel: t(lang, "place.motorway.filter.noneLabel") };
      expect(allB.attrs["aria-label"], lang).toBe(c.allLabel);
      expect(noneB.attrs["aria-label"], lang).toBe(c.noneLabel);
      expect(c.allLabel.toLocaleLowerCase(lang)).toContain(c.all.toLocaleLowerCase(lang));
      expect(c.noneLabel.toLocaleLowerCase(lang)).toContain(c.none.toLocaleLowerCase(lang));
      if (lang !== "de") expect(c.none, lang).not.toBe(t("de", "place.motorway.filter.none"));
    }
    // the script unticks every box on it, as "Alle" ticks them (its source: the page carries it minified, #1064)
    expect(FILTER_JS).toContain('bar.querySelector(".mwf__none").addEventListener("click", function () { boxes.forEach(function (b) { b.checked = false; }); apply(); address(); });');
  });
});

describe("#1051: the quiet line's chips are read too", () => {
  const NOW = new Date("2026-10-21T08:00:00Z");
  // a quiet motorway: closures, jams and roadworks are chips of the "nothing reported" line, no card of the grid
  const quiet = { road: "A7", at: NOW, staticState: "ok" as const, junctions: [], lands: [], towns: [], live: { state: "quiet" as const, asOf: NOW }, attributions: [], line: [], layers: null };
  it("each chip is a box of the bar, in the page's order, with a count of 0", () => {
    for (const lang of LIVE_LANGS) {
      const html = renderMotorwayPage(lang, quiet);
      expect(all(html, "details.mwk.mwk-chip").length, lang).toBeGreaterThan(0);
      const cards = filterCardsOf(html);
      const chips = [...html.matchAll(/<details class="mwk mwk-chip[^"]*" id="mwk-([a-z]+)"/g)].map((m) => m[1]);
      expect(chips.length, lang).toBeGreaterThan(0);
      expect(cards.map((c) => c.kind), lang).toEqual(chips);
      for (const c of cards) {
        expect(c.n, `${lang} ${c.kind}`).toBe(0);
        expect(c.title, `${lang} ${c.kind}`).not.toBe("");
      }
    }
  });
});

describe("D4: the summary", () => {
  const cards: FilterCard[] = [
    { kind: "parking", title: "Parken", n: 7 },
    { kind: "charging", title: "Laden", n: 5 },
    { kind: "jams", title: "Staus", n: 1 },
  ];
  it("the owner's words: 'Parken und Laden im Umkreis von 50 km: 12 Einträge'", () => {
    expect(summaryText("de", cards, new Set(["parking", "charging"]), 50)).toBe("Parken und Laden im Umkreis von 50 km: 12 Einträge");
    expect(summaryText("de", cards, new Set(["parking", "charging"]))).toBe("Parken und Laden: 12 Einträge");
    expect(summaryText("de", cards, new Set(["jams"]))).toBe("Staus: 1 Eintrag");
    expect(summaryText("de", cards, new Set(["parking", "charging", "jams"]), 25)).toBe("Alle Daten im Umkreis von 25 km: 13 Einträge");
    expect(summaryText("de", cards, new Set())).toBe("Nichts ausgewählt – wählen Sie mindestens eine Art.");
  });
  it("English, and a plural rule with 'few' and 'many' (Russian)", () => {
    expect(summaryText("en", [{ kind: "parking", title: "Parking", n: 1 }, { kind: "charging", title: "Charging", n: 1 }, { kind: "jams", title: "Jams", n: 4 }], new Set(["parking", "charging"]), 10)).toBe("Parking and Charging within 10 km: 2 entries");
    expect(summaryText("ru", [{ kind: "parking", title: "Парковки", n: 5 }, cards[2]!], new Set(["parking"]))).toBe("Парковки: 5 записей");
    expect(summaryText("ru", [{ kind: "parking", title: "Парковки", n: 3 }, cards[2]!], new Set(["parking"]))).toBe("Парковки: 3 записи");
  });
  it("the page's Intl tag picks the form (#753): Latvian's zero category, European Portuguese's 0, Polish 'many'", () => {
    const one = (title: string, n: number) => [{ kind: "parking" as const, title, n }, cards[2]!];
    const form = (lang: (typeof LIVE_LANGS)[number], key: string) => t(lang, `place.motorway.filter.${key}` as never, { n: "{n}" });
    expect(summaryText("lv", one("Stāvvietas", 10), new Set(["parking"]))).toBe(`Stāvvietas: ${form("lv", "entriesZero").replace("{n}", "10")}`);
    expect(summaryText("lv", one("Stāvvietas", 5), new Set(["parking"]))).toBe(`Stāvvietas: ${form("lv", "entriesOther").replace("{n}", "5")}`);
    expect(form("lv", "entriesZero")).not.toBe(form("lv", "entriesOther"));
    // pt-PT says "0 registos" (other), where bare "pt" (Brazil) would pick "one"
    expect(summaryText("pt", one("Estacionamento", 0), new Set(["parking"]))).toBe(`Estacionamento: ${form("pt", "entriesOther").replace("{n}", "0")}`);
    expect(summaryText("pl", one("Parkingi", 5), new Set(["parking"]))).toBe(`Parkingi: ${form("pl", "entriesMany").replace("{n}", "5")}`);
  });
  for (const lang of LIVE_LANGS)
    it(`${lang}: every line of the copy is there and carries its placeholders`, () => {
      expect(summaryText(lang, cards, new Set(["parking"]), 5)).toMatch(/5/);
      expect(summaryText(lang, cards, new Set(["parking"]), 5)).toMatch(/7/);
      expect(summaryText(lang, cards, new Set(["parking"]))).not.toMatch(/\{|\}/);
    });
});

describe("D9: the address and the device", () => {
  it("?show= takes the registry's kinds only, in its order", () => {
    expect(showOf(new URLSearchParams("show=charging,parking,nonsense"))).toEqual(["parking", "charging"]);
    expect(showOf(new URLSearchParams(""))).toBeNull();
    expect(showOf(new URLSearchParams("show="))).toEqual([]);
  });
  // pin-skew: the shell is 2.6.18 (the `speed` kind, #1304); the pinned digest is viafrei-app 2.6.17 and has no `speed` block. Green again when images.pin names a released viafrei-app >= 2.6.18 (viafrei-web#2, docs/moved-from-viafrei.md)
  it.skip("a redirect keeps the choice, and every kind is no choice", () => {
    expect(showQuery(new URLSearchParams("show=parking"))).toBe("show=parking");
    expect(showQuery(new URLSearchParams(`show=${MOTORWAY_KINDS.join(",")}`))).toBe("");
    expect(motorwayViewQuery(new URLSearchParams("r=50&show=parking,charging"))).toBe("r=50&show=parking,charging");
    expect(motorwayViewQuery(new URLSearchParams("f=1&layer=events&show=jams"))).toBe("f=1&layer=events&show=jams");
    // no position ever: only the radius and the kinds are view options
    expect(motorwayViewQuery(new URLSearchParams("lat=51.1&lon=9.4&show=jams"))).toBe("show=jams");
  });
  it("the script: valid, sends nothing, stores only on the 'merken' click, never the position", () => {
    for (const lang of LIVE_LANGS) {
      const js = motorwayFilterScript(lang);
      expect(() => new Script(js)).not.toThrow();
      expect(js).not.toMatch(/fetch\(|sendBeacon|XMLHttpRequest|gtag|dataLayer|clarity|navigator\.geolocation/);
      // one write, inside the save button's handler
      expect(js.match(/localStorage\.setItem/g)?.length).toBe(1);
      expect(FILTER_JS).toMatch(/querySelector\("\.mwf__save"\)\.addEventListener\("click", function \(\) \{ try \{ window\.localStorage\.setItem\(C\.store,/);
      expect(js).toContain(JSON.stringify(MOTORWAY_FILTER_STORE));
      expect(js).not.toMatch(/searchParams\.set\("(lat|lon|at|pos)"/);
      expect(js).not.toContain("</script");
    }
  });
});

/**
 * #982/#983 review: the "Alle" / "Keine" links carry the address's radius (and, on "Keine", the bar's `show`) in their
 * HREF once they are parsed — a middle click fires `auxclick` and never `click`, and "open in new tab" from the
 * context menu fires neither, so a rewrite on `click` alone lost `r` there. Run in a node `vm` over a minimal document.
 */
describe("the layer links carry r without a click (middle button, new tab)", () => {
  type Link = { href: string; cls: string[]; getAttribute: (k: string) => string; setAttribute: (k: string, v: string) => void; classList: { contains: (c: string) => boolean } };
  const link = (href: string, cls: string): Link => {
    const a: Link = {
      href,
      cls: [cls],
      getAttribute: () => a.href,
      setAttribute: (_k, v) => void (a.href = v),
      classList: { contains: (c) => a.cls.includes(c) },
    };
    return a;
  };
  const run = (address: string, readyState: "loading" | "complete") => {
    const links = [link("/de/autobahn/a7/s/ort-1-ort-6", "motorway__layerall"), link("/de/autobahn/a7/s/ort-1-ort-6?f=1", "motorway__layernone")];
    const handlers = new Map<string, ((e: unknown) => void)[]>();
    const document = {
      readyState,
      querySelectorAll: () => links,
      getElementById: () => null,
      addEventListener: (ev: string, f: (e: unknown) => void) => void handlers.set(ev, [...(handlers.get(ev) ?? []), f]),
    };
    new Script(motorwayFilterScript("de")).runInNewContext({ document, window: { location: { href: address } }, URL, setTimeout: (f: () => void) => f(), setInterval: () => 0 });
    const fire = (ev: string): void => (handlers.get(ev) ?? []).forEach((f) => f({}));
    return { links, handlers, fire };
  };

  it("parsed already: the hrefs carry r at once, before any button reaches them; 'Keine' keeps the bar's show", () => {
    const { links } = run("http://x/de/autobahn/a7/s/ort-1-ort-6?r=50&show=closures", "complete");
    expect(links[0]!.href).toBe("/de/autobahn/a7/s/ort-1-ort-6?r=50");
    expect(links[1]!.href).toBe("/de/autobahn/a7/s/ort-1-ort-6?f=1&r=50&show=closures");
  });
  it("still parsing: rewritten at DOMContentLoaded, and again after a swap (vf:main)", () => {
    const { links, fire } = run("http://x/de/autobahn/a7?r=25", "loading");
    expect(links[0]!.href).toBe("/de/autobahn/a7/s/ort-1-ort-6");
    fire("DOMContentLoaded");
    expect(links[0]!.href).toBe("/de/autobahn/a7/s/ort-1-ort-6?r=25");
    links[0]!.href = "/de/autobahn/a7/s/ort-2-ort-7";
    fire("vf:main");
    expect(links[0]!.href).toBe("/de/autobahn/a7/s/ort-2-ort-7?r=25");
  });
  it("every way a link is followed rewrites it at that moment too: click, auxclick (middle button) and contextmenu", () => {
    const { handlers } = run("http://x/de/autobahn/a7", "complete");
    for (const ev of ["click", "auxclick", "contextmenu"]) expect(handlers.get(ev)?.length, ev).toBe(1);
  });
  it("no radius in the address: the links stay as the digest wrote them", () => {
    const { links } = run("http://x/de/autobahn/a7/s/ort-1-ort-6", "complete");
    expect(links.map((l) => l.href)).toEqual(["/de/autobahn/a7/s/ort-1-ort-6", "/de/autobahn/a7/s/ort-1-ort-6?f=1"]);
  });
});

describe("#986: the freshness signs' relative age, kept current by the page's island", () => {
  const T0 = Date.parse("2026-10-25T10:00:00Z");
  const run = (lang: "de" | "en", readyState: "loading" | "complete", datetime: string) => {
    let clock = T0 + 3 * 60_000;
    const age = { classList: { contains: (c: string) => c === "fresh__age" }, textContent: "" };
    const time = { getAttribute: (k: string) => (k === "datetime" ? datetime : null), nextElementSibling: age };
    const handlers = new Map<string, (() => void)[]>();
    const ticks: (() => void)[] = [];
    const document = {
      readyState,
      querySelectorAll: (sel: string) => (sel === ".fresh__t" ? [time] : []),
      getElementById: () => null,
      addEventListener: (ev: string, f: () => void) => void handlers.set(ev, [...(handlers.get(ev) ?? []), f]),
    };
    const FakeDate = { now: () => clock, parse: (s: string) => Date.parse(s) };
    new Script(motorwayFilterScript(lang)).runInNewContext({ document, window: { location: { href: "http://x/de/autobahn/a7" } }, URL, Intl, Date: FakeDate, setTimeout: (f: () => void) => f(), setInterval: (f: () => void, ms: number) => (ms === 30_000 ? ticks.push(f) : 0) });
    return { age, tick: (ms: number) => ((clock += ms), ticks.forEach((f) => f())), fire: (ev: string) => (handlers.get(ev) ?? []).forEach((f) => f()) };
  };
  // the page's own locale tag, as the script carries it (`C.lang`), never a second mapping here
  const tagOf = (lang: "de" | "en"): string => /"lang":"([^"]+)"/.exec(motorwayFilterScript(lang))![1]!;
  const rtf = (lang: "de" | "en", n: number, u: Intl.RelativeTimeFormatUnit): string => ` (${new Intl.RelativeTimeFormat(tagOf(lang), { numeric: "auto", style: "short" }).format(n, u)})`;

  it("parsed already: the age is written at once from the <time datetime>, in the page's language", () => {
    expect(run("de", "complete", new Date(T0).toISOString()).age.textContent).toBe(rtf("de", -3, "minute"));
    expect(run("en", "complete", new Date(T0).toISOString()).age.textContent).toBe(rtf("en", -3, "minute"));
  });
  it("advances with the clock every 30 s, into hours, and is never a future age", () => {
    const r = run("de", "complete", new Date(T0).toISOString());
    r.tick(2 * 3_600_000);
    expect(r.age.textContent).toBe(rtf("de", -2, "hour"));
    const f = run("de", "complete", new Date(T0 + 3_600_000).toISOString());
    expect(f.age.textContent).toBe(rtf("de", -0, "second"));
  });
  it("still parsing: written at DOMContentLoaded; an unreadable datetime is left empty", () => {
    const r = run("de", "loading", new Date(T0).toISOString());
    expect(r.age.textContent).toBe("");
    r.fire("DOMContentLoaded");
    expect(r.age.textContent).toBe(rtf("de", -3, "minute"));
    expect(run("de", "complete", "nonsense").age.textContent).toBe("");
  });
});
