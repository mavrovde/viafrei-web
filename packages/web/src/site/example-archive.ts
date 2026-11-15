/**
 * The examples page (#747): every example question the site has carried — the
 * nine "Your day" moments with their three questions each, the fuel requests
 * under the home's fuel tile, the connect page's answer cards and the business
 * page's six former questions (`business-asks.ts`) — in one
 * list, grouped by domain. The page renders exactly `archiveEntries()`, each
 * under its `id` as an anchor, and `src/site/example-ledger.ts` holds every key
 * ever added, so an example that leaves the home or the connect page is still
 * here (owner 2026-10-15: archived, never deleted).
 *
 * An entry is live where the MCP engine asks the same question itself
 * (`Moment.live`, the three moments of #746): the page shows that answer when
 * it holds one and the recorded answer, dated, when it does not.
 */
import { BUSINESS_ASKS, type BusinessAsk } from "./business-asks.js";
import { FUEL_ASKS, MOMENTS, type FuelAsk, type Moment, type MomentKey } from "./examples.js";
import { LIVE_EXAMPLES, type Domain, type LiveExample } from "./live-examples.js";

/** The page's sections, in order: the five domains of the connect page, then the moments that are none of them. */
export const ARCHIVE_DOMAINS = ["transit", "roads", "parking", "charging", "fuel", "more"] as const;
export type ArchiveDomain = (typeof ARCHIVE_DOMAINS)[number];

/** Each moment's domain: the place questions and the watches answer across every domain, so they are "more". */
export const MOMENT_DOMAIN: Readonly<Record<MomentKey, ArchiveDomain>> = {
  commute: "transit",
  bus: "transit",
  station: "transit",
  driving: "roads",
  jam: "roads",
  parking: "parking",
  charging: "charging",
  places: "more",
  watch: "more",
};

/** Each former business question's domain: the weather warnings a guest or a public body asks for are none of the five. */
export const BUSINESS_DOMAIN: Readonly<Record<BusinessAsk["n"], ArchiveDomain>> = { 1: "roads", 2: "charging", 3: "more", 4: "roads", 5: "roads", 6: "more" };

export type ArchiveEntry =
  | { readonly kind: "moment"; readonly id: `ex-moment-${string}`; readonly domain: ArchiveDomain; readonly moment: Moment; readonly n: 1 | 2 | 3 }
  | { readonly kind: "fuel"; readonly id: `ex-fuel-${string}`; readonly domain: "fuel"; readonly ask: FuelAsk }
  | { readonly kind: "card"; readonly id: `ex-card-${string}`; readonly domain: Domain; readonly card: LiveExample }
  | { readonly kind: "business"; readonly id: `ex-business-u${number}`; readonly domain: ArchiveDomain; readonly ask: BusinessAsk };

/** Every example the site holds, in page order: by domain, and inside one the moments, then the fuel requests, then the cards, then the former business questions. */
export function allEntries(): readonly ArchiveEntry[] {
  const all: ArchiveEntry[] = [
    ...MOMENTS.flatMap((m) =>
      ([1, 2, 3] as const).filter((n) => m.answers.length >= n).map((n): ArchiveEntry => ({ kind: "moment", id: `ex-moment-${m.key}-q${n}`, domain: MOMENT_DOMAIN[m.key], moment: m, n })),
    ),
    ...FUEL_ASKS.map((a): ArchiveEntry => ({ kind: "fuel", id: `ex-fuel-${a.key}`, domain: "fuel", ask: a })),
    ...LIVE_EXAMPLES.map((e): ArchiveEntry => ({ kind: "card", id: `ex-card-${e.key}`, domain: e.domain, card: e })),
    ...BUSINESS_ASKS.map((a): ArchiveEntry => ({ kind: "business", id: `ex-business-u${a.n}`, domain: BUSINESS_DOMAIN[a.n], ask: a })),
  ];
  return ARCHIVE_DOMAINS.flatMap((d) => all.filter((e) => e.domain === d));
}

/** The credits of an entry's recorded answer. */
export const creditsOf = (e: ArchiveEntry): readonly string[] =>
  e.kind === "moment" ? (e.moment.answers[e.n - 1]?.credits ?? []) : e.kind === "fuel" || e.kind === "business" ? e.ask.answer.credits : e.card.credits;

/**
 * Whether an entry carries a Tankerkönig/MTS-K price or station. Data-steward Verdict 2 (2026-10-05) allows
 * at most three dated fuel examples, on /connect and the home only — so none is on the examples page, which
 * is a third surface the verdict does not cover.
 */
export const isTankerkoenig = (e: ArchiveEntry): boolean => creditsOf(e).includes("tankerkoenig");

/** The examples page's entries: every example but the Tankerkönig ones, which the fuel section points to instead. */
export function archiveEntries(): readonly ArchiveEntry[] {
  return allEntries().filter((e) => !isTankerkoenig(e));
}

/** The ledger key of an entry: `moment:<key>:q<n>`, `fuel:<key>`, `card:<key>`, `business:u<n>`. */
export function ledgerKey(e: ArchiveEntry): string {
  if (e.kind === "moment") return `moment:${e.moment.key}:q${e.n}`;
  if (e.kind === "fuel") return `fuel:${e.ask.key}`;
  if (e.kind === "business") return `business:u${e.ask.n}`;
  return `card:${e.card.key}`;
}

/** The anchor id the page renders a ledger key under. */
export const anchorFor = (key: string): string => `ex-${key.replace(/:/g, "-")}`;
