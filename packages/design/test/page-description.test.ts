/**
 * #1310 B2: the one description builder of the object pages — evergreen, 120–160 characters in every language for every
 * page type and every subject length, never a clock time, a live count or "no guarantee", and unique per subject.
 */
import { describe, expect, it } from "vitest";
import { LAND_KEYS, landNameOf } from "../src/land-names.js";
import { PAGE_HEAD_LANGS } from "../src/page-head-copy.js";
import { DESCRIPTION_MAX, DESCRIPTION_MIN, PAGE_DESCRIPTION_COPY, pageDescription, type DescribedKind, type DescribedSubject } from "../src/page-description.js";

const KINDS: readonly DescribedKind[] = ["place", "station", "motorway", "exit", "road", "state"];

/** Every shape a subject can take for one kind: with the longest Land name of the language, and without one. */
function shapes(kind: DescribedKind, name: string, land: string): DescribedSubject[] {
  if (kind === "motorway") return [{ kind, name, lands: [land, land] }, { kind, name, lands: [land] }, { kind, name }];
  if (kind === "exit") return [{ kind, name, road: "A100", land }, { kind, name, road: "A1" }];
  return [{ kind, name, land }, { kind, name, land: null }];
}

const longestLand = (lang: (typeof PAGE_HEAD_LANGS)[number]): string =>
  LAND_KEYS.map((k) => landNameOf(lang, k) ?? "").reduce((a, b) => (b.length > a.length ? b : a), "");

/** A clock time, "no guarantee" (#1310 § 1.7) in the languages the old snippets said it in, or a digit. */
const LIVE = /\d{1,2}[:.]\d{2}|no guarantee|ohne Gewähr|Stand \d/iu;

describe("#1310 B2: the evergreen description", () => {
  for (const lang of PAGE_HEAD_LANGS) {
    it(`${lang}: every page type, every subject of 2 to 100 characters, with and without its Land, is ${DESCRIPTION_MIN}–${DESCRIPTION_MAX} characters`, () => {
      const land = longestLand(lang);
      for (const kind of KINDS) {
        for (let n = 2; n <= 100; n++) {
          for (const s of shapes(kind, "ü".repeat(n), land)) {
            const d = pageDescription(lang, s);
            expect(d.length, `${kind} ${String(n)}: ${d}`).toBeGreaterThanOrEqual(DESCRIPTION_MIN);
            expect(d.length, `${kind} ${String(n)}: ${d}`).toBeLessThanOrEqual(DESCRIPTION_MAX);
          }
        }
      }
    });

    it(`${lang}: no clock time, no count, no "no guarantee" — the copy holds no digit at all`, () => {
      const c = PAGE_DESCRIPTION_COPY[lang];
      for (const v of Object.values(c)) {
        expect(v).not.toMatch(/\d/u);
        expect(v).not.toMatch(LIVE);
      }
      // the road's number is a name, not a count: the rest of the description holds no digit
      for (const kind of KINDS) expect(pageDescription(lang, shapes(kind, "Köln", "Bayern")[0]!).replace(/A100/u, "")).not.toMatch(/\d/u);
    });

    it(`${lang}: every Land has a name`, () => {
      for (const k of LAND_KEYS) expect(landNameOf(lang, k)?.trim()).toBeTruthy();
      expect(landNameOf(lang, "09162000")).toBe(landNameOf(lang, "09"));
      expect(landNameOf(lang, "17")).toBeNull();
      expect(landNameOf(lang, "ab")).toBeNull();
      expect(landNameOf(lang, null)).toBeNull();
    });
  }

  it("the three shapes of #1310 § 1.7 — Berlin, Aachen Hbf, Ahrensburg West — are evergreen and full in de, en and fr", () => {
    for (const lang of ["de", "en", "fr"] as const) {
      const berlin = pageDescription(lang, { kind: "place", name: "Berlin", land: landNameOf(lang, "11") });
      const aachen = pageDescription(lang, { kind: "station", name: "Aachen Hbf", land: landNameOf(lang, "05") });
      const ahrensburg = pageDescription(lang, { kind: "station", name: "Ahrensburg West (Ahrensburg)", land: landNameOf(lang, "01") });
      for (const d of [berlin, aachen, ahrensburg]) {
        expect(d.length).toBeGreaterThanOrEqual(DESCRIPTION_MIN);
        expect(d).not.toMatch(LIVE);
      }
      // a city-state's place names its Land once; French sets a no-break space before the colon, as its titles do
      expect(berlin.startsWith(lang === "fr" ? "Berlin\u00a0: " : "Berlin: ")).toBe(true);
      expect(aachen).toContain("Aachen Hbf");
      expect(ahrensburg).toContain("Ahrensburg West (Ahrensburg)");
    }
    expect(pageDescription("de", { kind: "station", name: "Aachen Hbf", land: "Nordrhein-Westfalen" })).toBe(
      "Aachen Hbf (Nordrhein-Westfalen): die nächsten Abfahrten mit Gleis, Aufzüge und Fahrtreppen, Bahnsteige, Ausstattung und Umgebung.",
    );
  });

  it("unique across a catalogue: different subjects, and the same name on different page types, never share a description", () => {
    for (const lang of PAGE_HEAD_LANGS) {
      const seen = new Map<string, string>();
      for (const kind of KINDS)
        for (const name of ["Berlin", "Hamburg", "Bremen", "Hamburg Hbf", "A7", "A70", "B 96", "AS Hamburg-Stellingen", "Neustadt (Holstein)", "Neustadt (Hessen)"]) {
          const d = pageDescription(lang, shapes(kind, name, "Berlin")[0]!);
          expect(seen.get(d), `${lang}: ${kind} ${name} = ${seen.get(d) ?? ""}`).toBeUndefined();
          seen.set(d, `${kind} ${name}`);
        }
    }
  });

  it("a subject too long for any whole form keeps its name and is cut at a word", () => {
    const long = "Sehr Langer Name ".repeat(12).trim();
    const d = pageDescription("de", { kind: "place", name: long });
    expect(d.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    expect(d.endsWith("…")).toBe(true);
    const mid = pageDescription("de", { kind: "exit", name: "AK Wort ".repeat(9).trim(), road: "A1" });
    expect(mid).toMatch(/^AK Wort .*\(A1\): .*…$/u);
  });

  it("the motorway names its Länder in road order; a Land page and a city-state place never repeat the name", () => {
    expect(pageDescription("de", { kind: "motorway", name: "A7", lands: ["Bayern", "Hessen"] }).startsWith("A7 (Bayern, Hessen): ")).toBe(true);
    expect(pageDescription("de", { kind: "state", name: "Bayern", land: "Bayern" }).startsWith("Bayern: ")).toBe(true);
    expect(pageDescription("de", { kind: "exit", name: "AS Wü", road: "A7", land: "Bayern" }).startsWith("AS Wü (A7, Bayern): ")).toBe(true);
  });
});
