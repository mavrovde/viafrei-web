/**
 * The licence CLASS of a register row (#992): what the business page's licence table counts, one class per credited
 * source, read from the row's own licence and flags in `packages/mcp/src/presentation/attribution.ts` — never typed per
 * source. The order of the checks is the order of precedence: a purpose limitation outranks the licence it rides on
 * (MTS-K data is CC BY 4.0 AND for consumer information only, so it is `consumerOnly`), share-alike outranks
 * attribution, and our own content is ours whatever its line says.
 *
 *   - `open`         — no condition beyond naming the source where we choose to (CC0, dl-de/zero);
 *   - `attribution`  — the credit line travels with the data (CC BY, dl-de/by, GeoNutzV);
 *   - `shareAlike`   — derived data carries the same licence (CC BY-SA), or the derived database is offered (ODbL);
 *   - `terms`        — not yet cleared for businesses (data-steward 2026-11-05, B10): the publisher publishes no terms of
 *                      use (the Autobahn GmbH), or its terms require a contract we do not offer yet (Toll Collect SID). Not
 *                      `consumerOnly`, which would attribute to them a restriction neither states. A new member must make
 *                      those words true or take another class;
 *   - `consumerOnly` — never part of a business offer: consumer information only by law (§ 47k GWB), a register ruling
 *                      or commitment that keeps a source in consumer answers (`consumerAnswersOnly`), or no licence to
 *                      rest a sale on at all — a Mobilithek rights class (`LICENSE_FREE_USE_OPEN_DATA`,
 *                      `LICENSE_RESTRICTED_USE_FREE_OF_CHARGE`: "a rights class is not a licence"), "lizenzfrei"
 *                      beside no licence text, or a statutory AFIR publication with no licence (eliso, E5: never sold);
 *   - `own`          — ViaFrei's own editorial and service text.
 *
 * data-steward ruling 2026-11-04 (#992): the table's column is "what a business may do", so a class is the register's
 * SELL verdict, never the licence string alone. The first cut classed fourteen Mobilithek rows "open" from their rights
 * bucket, the two eliso and two restricted-use rows "terms", and BW, Polizei Hamburg and Bremen "open"/"attribution",
 * although the register says no sale and no B2B for every one of them.
 *
 * A licence this list does not know THROWS, so a new source with a new licence cannot reach the table unclassed
 * (`test/licence-class.test.ts` runs every credited row through it).
 */
export const LICENCE_CLASSES = ["open", "attribution", "shareAlike", "terms", "consumerOnly", "own"] as const;
export type LicenceClass = (typeof LICENCE_CLASSES)[number];

type RowFlags = {
  readonly license: string;
  readonly shareAlike?: boolean;
  readonly shareAlikeDatabase?: boolean;
  readonly purpose?: string;
  readonly noRedistribution?: boolean;
  readonly consumerAnswersOnly?: true;
  readonly ownContent?: boolean;
};

const OPEN = [/^CC0 1\.0$/u, /^dl-de\/zero-2-0$/u];
const ATTRIBUTION = [/^CC BY(?: \d\.\d(?: DE)?)?$/u, /^dl-de\/by-2-0$/u, /^Datenlizenz Deutschland – Namensnennung – Version 2\.0$/u, /^GeoNutzV$/u];
const SHARE_ALIKE = [/^CC BY-SA(?: \d\.\d)?$/u, /^ODbL 1\.0$/u];
const TERMS = [/^Nutzungsbedingungen /u, /^open data \(Autobahn GmbH\)$/u];
/** No licence a sale could rest on (data-steward register: "a rights class is not a licence"; eliso E5). */
const NO_LICENCE = [/^LICENSE_FREE_USE_OPEN_DATA$/u, /^LICENSE_RESTRICTED_USE_FREE_OF_CHARGE$/u, /^lizenzfrei\b/u, /keine Lizenz angegeben/u];

export function licenceClassOf(row: RowFlags): LicenceClass {
  if (row.ownContent === true) return "own";
  if (row.purpose === "consumer-information-only" || row.noRedistribution === true || row.consumerAnswersOnly === true) return "consumerOnly";
  if (NO_LICENCE.some((r) => r.test(row.license))) return "consumerOnly";
  if (row.shareAlike === true || row.shareAlikeDatabase === true || SHARE_ALIKE.some((r) => r.test(row.license))) return "shareAlike";
  if (TERMS.some((r) => r.test(row.license))) return "terms";
  if (ATTRIBUTION.some((r) => r.test(row.license))) return "attribution";
  if (OPEN.some((r) => r.test(row.license))) return "open";
  throw new Error(`licence-class: "${row.license}" is in no class — add it to src/site/licence-classes.ts with the data-steward's reading`);
}
