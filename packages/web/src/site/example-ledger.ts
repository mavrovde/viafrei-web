/**
 * Every example key the site has ever carried (#747), append-only: a key is
 * added in the change that adds its example and is never removed, and
 * `test/example-ledger.test.ts` fails when one is not on the examples page
 * (`site/example-archive.ts`). An example that leaves the home or the connect
 * page therefore stays reachable here, with its recorded answer and its date
 * (owner 2026-10-15: "archived, never deleted").
 *
 * Keys: `moment:<moment>:q<n>` (the "Your day" questions, `day.moments.*`),
 * `fuel:<key>` (the requests under the home's fuel tile, `day.fuelAsks.*`),
 * `card:<key>` (the connect page's answer cards, `connectPage.live.*`),
 * `business:u<n>` (the business page's six typed questions, `bizPage.u<n>q`,
 * off that page since #992 and missed by the ledger until 2.5.15).
 *
 * Seeded on 2026-10-16 with the 63 examples #746 restored and re-asked (the
 * cards rotated off in v1.8.16 and v1.8.18 came back under their old keys, so
 * they are listed). An example replaced before #746 whose copy was rewritten
 * in place keeps its key and is not listed twice. The BW police card is not
 * here: it stays off for its RVWD condition (#454 C1).
 */
export const EXAMPLE_LEDGER: readonly string[] = [
  // transit
  "moment:commute:q1", "moment:commute:q2", "moment:commute:q3",
  "moment:bus:q1", "moment:bus:q2", "moment:bus:q3",
  "moment:station:q1", "moment:station:q2", "moment:station:q3",
  "card:stadtbahn", "card:bikes", "card:lift", "card:alert", "card:platform", "card:train", "card:region",
  // roads
  "moment:driving:q1", "moment:driving:q2", "moment:driving:q3",
  "moment:jam:q1", "moment:jam:q2", "moment:jam:q3",
  "card:hhworks", "card:motorway", "card:citywork", "card:landroad", "card:saxony", "card:bwroad", "card:roadworks",
  "card:kiel", "card:tomorrow", "card:closure", "card:weather",
  // parking
  "moment:parking:q1", "moment:parking:q2", "moment:parking:q3",
  "card:hamburg", "card:muenster", "card:carpark", "card:truckstop", "card:lorry", "card:parkride",
  // charging
  "moment:charging:q1", "moment:charging:q2", "moment:charging:q3",
  "card:enbw", "card:ecomove", "card:ocpdb", "card:lsr", "card:charger",
  // fuel
  "fuel:goerlitz", "fuel:muenchen", "fuel:leipzig", "fuel:nuernberg",
  "card:fuelcity", "card:fuelroad", "card:fuelland",
  // more
  "moment:places:q1", "moment:places:q2", "moment:places:q3",
  "moment:watch:q1", "moment:watch:q2", "moment:watch:q3",
  // the business page's former questions
  "business:u1", "business:u2", "business:u3", "business:u4", "business:u5", "business:u6",
];

/**
 * The Tankerkönig examples the site no longer renders anywhere, each with its dated reason (data-steward
 * Verdict 2 of 2026-10-05, condition 7: an example is "re-captured or removed"). Condition 1 allows at most
 * THREE dated fuel examples, at three different places with one answer each (condition 4), and the examples
 * page is not a surface the verdict covers — so the home keeps the Görlitz request, the connect page the
 * Köln and Würzburg cards, and every other one stays in source and in this ledger, off every page.
 * `test/example-ledger.test.ts` holds each key here to a fuel example that no page renders.
 */
export const RETIRED_FUEL: Readonly<Record<string, string>> = {
  "fuel:muenchen": "2026-10-17: Verdict 2 cap of three",
  "fuel:leipzig": "2026-10-17: Verdict 2 cap of three",
  "fuel:nuernberg": "2026-10-17: Verdict 2 cap of three",
  "card:fuelland": "2026-10-17: Verdict 2 cap of three",
};

/** Whether a ledger key is held off every page by `RETIRED_FUEL`. */
export const isRetired = (key: string): boolean => Object.hasOwn(RETIRED_FUEL, key);
