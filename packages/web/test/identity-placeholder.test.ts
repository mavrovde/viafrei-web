/**
 * A placeholder is not a § 5 DDG identity (launch audit F-9).
 *
 * The presence check accepted "[Straße folgt]" as a street, and production
 * carries exactly that shape. `readIdentity` now treats a placeholder as no
 * value: the name and the e-mail are then MISSING (the 500 a missing one always
 * was), an optional key falls back or disappears, and the street or the city
 * makes the pages say "Anschrift wird ergänzt" — the placeholder itself is never
 * rendered.
 *
 * The rule exists twice, in TypeScript here and as an ERE in the deploy
 * (`IDENTITY_PLACEHOLDER_ERE`), because the deploy judges the host's
 * environment in bash. The deploy is viafrei-infra's, so the case that runs ONE
 * table of cases through both is skipped here and held by viafrei-infra; the
 * table itself is judged against the TypeScript rule below.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ADDRESS_PENDING_NOTE, MissingIdentity, identityOrError, looksLikePlaceholder, readIdentity } from "../src/lib/identity.js";

const ROOT = new URL("../../../", import.meta.url).pathname;
const full = { IMPRESSUM_NAME: "Erika Mustermann", IMPRESSUM_STREET: "Musterstraße 1", IMPRESSUM_CITY: "12345 Musterstadt", IMPRESSUM_EMAIL: "e@example.invalid" };

const PLACEHOLDERS = ["[Straße folgt]", "<PLZ Ort>", "{city}", "Anschrift folgt", "TODO", "tbd", "XXX", "Platzhalter", "placeholder@example.org", "[x]"];
const REAL = ["Musterstraße 1", "12345 Musterstadt", "Erika Mustermann", "kontakt@example.org", "Folgenweg 3", "Toddstraße 2", "Max 10", "Am Tbach 1"];

describe("the placeholder rule (F-9)", () => {
  it("recognises the shapes a stub takes and passes real values", () => {
    for (const v of PLACEHOLDERS) expect(looksLikePlaceholder(v), v).toBe(true);
    for (const v of REAL) expect(looksLikePlaceholder(v), v).toBe(false);
  });

  // cross-repo(viafrei-infra): the deploy's ERE is viafrei-infra's
  it.skip("is the SAME rule as the deploy's, case for case", () => {
    const sh = readFileSync(join(ROOT, "the deploy"), "utf8");
    const ere = /^IDENTITY_PLACEHOLDER_ERE='(.*)'$/m.exec(sh)?.[1];
    expect(ere, "IDENTITY_PLACEHOLDER_ERE is no longer one quoted line in the deploy (#931)").toBeDefined();
    const shell = (v: string): boolean => {
      try {
        execFileSync("grep", ["-qiE", ere!], { input: v, env: { ...process.env, LC_ALL: "C" } });
        return true;
      } catch {
        return false;
      }
    };
    for (const v of [...PLACEHOLDERS, ...REAL]) expect(shell(v), `the deploy and identity.ts disagree about "${v}"`).toBe(looksLikePlaceholder(v));
  });
});

describe("readIdentity never hands a placeholder to a page (F-9)", () => {
  it("a placeholder street or city makes the address PENDING, and empty", () => {
    for (const k of ["IMPRESSUM_STREET", "IMPRESSUM_CITY"]) {
      const id = readIdentity({ ...full, [k]: "[folgt]" });
      expect(id.addressPending, k).toBe(true);
      expect(id.street).toBe("");
      expect(id.city).toBe("");
    }
    expect(readIdentity(full).addressPending).toBe(false);
    expect(ADDRESS_PENDING_NOTE).toBe("Anschrift wird ergänzt");
  });

  for (const k of ["IMPRESSUM_NAME", "IMPRESSUM_EMAIL"]) {
    it(`a placeholder ${k} is a missing one — the 500, never a page`, () => {
      const env = { ...full, [k]: "TODO" };
      expect(() => readIdentity(env)).toThrow(MissingIdentity);
      expect((identityOrError(env) as Response).status).toBe(500);
    });
  }

  it("a placeholder optional value is absent: no phone line, the authority falls back, the contact is the § 5 address", () => {
    const id = readIdentity({ ...full, IMPRESSUM_PHONE: "xxx", IMPRESSUM_VAT_ID: "[USt-IdNr]", IMPRESSUM_AUTHORITY: "tbd", CONTACT_EMAIL: "<contact>" });
    expect(id.phone).toBeUndefined();
    expect(id.vatId).toBeUndefined();
    expect(id.authority).toBe("die Landesdatenschutzbehörde am Sitz des Verantwortlichen");
    expect(id.contactEmail).toBe("e@example.invalid");
  });
});

describe("the legal components print the note, never the placeholder (F-9)", () => {
  for (const f of ["LegalImpressum.astro", "LegalPrivacy.astro"]) {
    it(`${f} branches on addressPending and prints ADDRESS_PENDING_NOTE`, () => {
      const src = readFileSync(join(ROOT, "packages/web/src/components", f), "utf8");
      expect(src).toMatch(/id\.addressPending \?/);
      expect(src).toContain("{ADDRESS_PENDING_NOTE}");
    });
  }
});
