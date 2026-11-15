import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LICENCE_CATALOGUE, MTSK_CONSUMER_NOTE } from "@viafrei/ingest";
import { ATTRIBUTION } from "@viafrei/mcp";
import { describe, expect, it } from "vitest";

const I18N_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "i18n");

/**
 * #375 A7: legal strings — credit lines, the MTS-K note — are in NEITHER
 * catalogue. They come from the register and are rendered verbatim in German
 * whatever the page language, because a translated attribution is a licence
 * breach and not a typo. This test reads the register itself (`ATTRIBUTION`,
 * `LICENCE_CATALOGUE`), never a copy, and sweeps every catalogue value.
 */
function legalStrings(): string[] {
  const out = new Set<string>();
  for (const row of Object.values(ATTRIBUTION)) {
    out.add(row.text);
    const altered = (row as { altered?: string }).altered;
    if (altered) out.add(altered);
  }
  for (const facts of Object.values(LICENCE_CATALOGUE)) if (facts.attribution) out.add(facts.attribution);
  out.add(MTSK_CONSUMER_NOTE);
  return [...out];
}

function values(tree: unknown, out: string[] = []): string[] {
  if (typeof tree === "string") out.push(tree);
  else if (tree && typeof tree === "object") for (const v of Object.values(tree)) values(v, out);
  return out;
}

describe("legal strings stay out of the copy deck (A7)", () => {
  const legal = legalStrings();
  const files = readdirSync(I18N_DIR).filter((f) => f.endsWith(".json")).sort();

  it("read a register worth sweeping with — not an empty list", () => {
    expect(legal.length).toBeGreaterThanOrEqual(10);
    expect(legal).toContain("Verkehrsdaten: Autobahn GmbH des Bundes");
    expect(legal).toContain(MTSK_CONSUMER_NOTE);
    expect(files.length).toBeGreaterThanOrEqual(2);
  });

  it("finds no register string inside any catalogue value", () => {
    // The findings are collected and asserted once: one expect() per value and
    // register string was millions of calls over 22 catalogues (#753) and ran
    // past the timeout, without being a stronger test.
    const found: string[] = [];
    let read = 0;
    for (const f of files) {
      const vals = values(JSON.parse(readFileSync(join(I18N_DIR, f), "utf8")));
      expect(vals.length, f).toBeGreaterThan(50);
      read += vals.length;
      for (const v of vals) for (const s of legal) if (v.includes(s)) found.push(`${f}: a value contains the register string «${s.slice(0, 40)}…»`);
    }
    expect(read).toBeGreaterThan(50 * files.length);
    expect(found).toEqual([]);
  });

  it("finds no attribution-shaped sentence either — a retyped line is still a legal string", () => {
    // The register's lines all have the shape "<what>: <who>, <licence>" with
    // a licence token. A catalogue value that NAMES a licence beside a publisher
    // is a hand-written credit line, which D4 rule 1 forbids.
    const licenceToken = /\b(CC BY(-SA)?( 4\.0)?|CC0 1\.0|GeoNutzV|Datenlizenz Deutschland)\b/;
    const found: string[] = [];
    for (const f of files) {
      for (const v of values(JSON.parse(readFileSync(join(I18N_DIR, f), "utf8")))) if (licenceToken.test(v)) found.push(`${f}: «${v.slice(0, 60)}» names a licence`);
    }
    expect(found).toEqual([]);
  });
});
