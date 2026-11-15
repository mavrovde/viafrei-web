/**
 * The Datenschutzerklärung's "Nutzungsstatistik" paragraph (#532) is pinned to
 * the ledger it describes: the hourly window it names is the fold's constant,
 * and every field the ledger never stores is named as not stored. Read as text
 * (tests may read the register; the web runtime imports nothing from the
 * database-holding workspaces — check_web_boundary.sh).
 *
 * Its recipient sentence depends on the `analytics` flag (#536, the
 * data-steward's ruling of 2026-10-11, condition d): WITH a tag the daily
 * totals go to GA4 and the page must say so; WITHOUT one the export is off
 * (`offReason` in packages/ingest/src/cli/usage-analytics.ts) and the old
 * "an niemanden weitergegeben" is the true sentence. Both branches of the
 * conditional are sliced out of the source and pinned apart, so a sentence
 * moved into the wrong branch, or out of the conditional altogether, fails.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pinnedPath } from "./pinned-source.js";

const REPO = new URL("../../../", import.meta.url);
const read = (rel: string): string => readFileSync(new URL(pinnedPath(rel), REPO), "utf8");

const privacy = read("packages/web/src/components/LegalPrivacy.astro");
const start = privacy.indexOf('<p id="nutzungsstatistik">');
const paragraph = privacy.slice(start, privacy.indexOf("</p>", start)).replace(/\s+/gu, " ");

/** The paragraph's `analytics ? (…) : (…)` conditional, split into its two branches. */
const flat = (s: string): string => s.replace(/<[^>]*>/gu, "").replace(/\s+/gu, " ").trim();
const rawParagraph = privacy.slice(start, privacy.indexOf("</p>", start));
const condAt = rawParagraph.indexOf("analytics ? (");
const elseAt = rawParagraph.indexOf(") : (", condAt);
const endAt = rawParagraph.indexOf("}", elseAt);
const withTag = flat(rawParagraph.slice(condAt + "analytics ? (".length, elseAt));
const withoutTag = flat(rawParagraph.slice(elseAt + ") : (".length, endAt).replace(/\)\s*$/u, ""));
/** What every render shows: the paragraph with the conditional cut out. */
const common = flat(rawParagraph.slice(0, rawParagraph.lastIndexOf("{", condAt)) + rawParagraph.slice(endAt + 1));

describe("the usage-ledger paragraph of the privacy notice (#532)", () => {
  it("exists, inside the MCP endpoint's section", () => {
    expect(start).toBeGreaterThan(privacy.indexOf("MCP-Endpunkt mcp.viafrei.de"));
    expect(start).toBeLessThan(privacy.indexOf('<h3 id="live-abfragen">'));
  });

  it("names the fold window the retention job actually uses", () => {
    const m = /export const MCP_USAGE_HOURLY_DAYS = (\d+);/u.exec(read("packages/ingest/src/platform/mcp-usage.ts"));
    expect(m, "MCP_USAGE_HOURLY_DAYS not found").not.toBeNull();
    expect(paragraph).toContain(`nach ${m?.[1] ?? "?"} Tagen zu Tageswerten`);
  });

  it("says what is never stored, and that the counts are not combined with other data", () => {
    for (const never of ["keine IP-Adressen", "keine Sitzungskennungen", "keine Werkzeugargumente", "keine Fragetexte", "keine Ortsangaben", "User-Agent"]) {
      expect(paragraph, never).toContain(never);
    }
    expect(paragraph).toContain("nicht mit anderen Daten zusammengeführt");
  });

  it("describes the client name as an ALLOW-LIST, the way the code does it", () => {
    expect(read("packages/ingest/src/platform/mcp-usage.ts")).toContain("export const MCP_USAGE_CLIENTS");
    expect(paragraph).toContain("nur ein Name aus einer festen Liste bekannter Programme");
    expect(paragraph).toContain("als „other“ gezählt");
    expect(paragraph).toContain("als „unknown“");
    // The absolute claim the review struck: the page must not promise more than
    // the ledger can prove.
    expect(paragraph).not.toMatch(/Bezug zu einzelnen Personen/u);
  });
});

describe("the recipient sentence, per render (#536, steward condition d)", () => {
  const GA4 = [
    "Einmal täglich übermitteln wir von unserem Server aus die Tagessummen eines Kalendertags (nach koordinierter Weltzeit, UTC) an Google Analytics 4 (Google Ireland Limited, Punkt 5)",
    "Übermittelt werden ausschließlich Zahlen unter festen Namen",
    "unsere eigenen Testabrufe werden nur getrennt davon als eine Zahl übermittelt.",
    "Die Übermittlung trägt eine feste, für jeden Tag gleiche Kennung des Übermittlungsvorgangs und keine IP-Adresse, keinen Standort, keine Sitzungskennung und keine sonstige Angabe zu einer Person",
    "Google erhält damit keine personenbezogenen Daten.",
    "verarbeitet Google sie als unser Auftragsverarbeiter zu den unter Punkt 5 genannten Bedingungen",
    "Aus der Besucherzählung der Website (Punkt 4) wird nichts übermittelt",
  ];
  const NO_TAG = "Die Auswertung ist nur uns zugänglich und wird an niemanden weitergegeben.";

  it("finds the conditional and both of its branches", () => {
    expect(condAt, "no `analytics ? (` in the paragraph").toBeGreaterThan(0);
    expect(elseAt).toBeGreaterThan(condAt);
    expect(endAt).toBeGreaterThan(elseAt);
    expect(withTag.length).toBeGreaterThan(200);
    expect(withoutTag.length).toBeGreaterThan(20);
  });

  it("WITH a tag: the GA4 paragraph, and not the no-recipient sentence", () => {
    for (const sentence of GA4) expect(withTag, sentence).toContain(sentence);
    expect(withTag).not.toContain("an niemanden weitergegeben");
  });

  it("WITHOUT a tag: the no-recipient sentence, and nothing of the GA4 paragraph", () => {
    expect(withoutTag).toBe(NO_TAG);
    for (const sentence of GA4) expect(withoutTag, sentence).not.toContain(sentence);
    expect(withoutTag).not.toMatch(/Google|übermittel/u);
  });

  it("outside the conditional, neither sentence: every render shows exactly one of them", () => {
    expect(common).not.toMatch(/Google|an niemanden weitergegeben/u);
    expect(common).toContain("Soweit dabei überhaupt personenbezogene Daten verarbeitet werden");
  });

  // cross-repo(viafrei): asserts TypeScript source text (a type, a `readonly`/`as const` declaration) that the released viafrei-app ships compiled, so it cannot be decided here (viafrei-web#2, docs/moved-from-viafrei.md)
  it.skip("the no-tag sentence is true because the export is off without GOOGLE_TAG", () => {
    expect(read("packages/ingest/src/cli/usage-analytics.ts")).toMatch(/c\.measurementId === undefined \|\| c\.measurementId\.trim\(\) === ""\) return "GOOGLE_TAG is unset/u);
  });
});
