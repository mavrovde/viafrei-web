/**
 * What the business page shows (#992, #1190), and the one gate it passes (data-steward ruling 2026-11-05, B6-B8): the hero's
 * question and the five the cases open onto, six different answers, the tile under each case and the proof band's facts.
 *
 * A tile, a fact or an answer shows only if every source it credits is classed `open`, `attribution`, `shareAlike` or `own`
 * in the generated contract. So `consumerOnly` (never part of a business offer) and `terms` ("not yet cleared for
 * businesses": neither member has a Sell yes) are refused, each read from the contract and never from a list of names here,
 * and so is an id the contract does not class, which cannot be read as allowed.
 *
 * It is judged on the credits of THAT render, because they are known only then: `TileSpec.sources` is not the complete list,
 * the motorway asks credit the short-term roadworks (`mobilithek_roadworks_akd`) on every road measured on 2026-11-05 (A2,
 * A8, A9, A10, A81), and a charger's credits move with the sites nearest the place. A fragment that does not say what it
 * credits is refused too. A refused tile or fact is omitted and never the error state, because "cannot be read" would be
 * false (B7); no label cures one (B8). A drop is logged once per process, per item and source, so it is seen and does not
 * repeat on every render.
 *
 * This page only: the home, the place pages and the news keep their tiles. Case 4's tile is `station`, because `jams` credits
 * BW and SH by design and has no gated form. `test/business-992.test.ts` holds the recorded fixture and the page to the rule.
 */
import contract from "../generated/contract.json" with { type: "json" };
import type { AskEntry, AskKey } from "../lib/ask.js";
import { logLine } from "../lib/log.js";
import type { EmbeddedTileId, TileResult } from "../lib/tiles.js";
import type { SignKind } from "./signs.js";

export type BusinessCase = { readonly n: 1 | 2 | 3 | 4 | 5 | 6; readonly tile: EmbeddedTileId; readonly ask: AskKey | null; readonly sign: SignKind };

/** The hero's steps: an answer no case opens onto, so the page's six are six different ones. */
export const BUSINESS_HERO_ASK: AskKey = "hydrogen";

/** The six cases: what each shows live, one digest tile and the assistant's own answer where one is asked. */
export const BUSINESS_CASES: readonly BusinessCase[] = [
  { n: 1, tile: "lorry", ask: "lorryPark", sign: "lorry" },
  { n: 2, tile: "charging", ask: "charging", sign: "charging" },
  { n: 3, tile: "carparks", ask: "parking", sign: "parking" },
  { n: 4, tile: "station", ask: null, sign: "autobahn" },
  { n: 5, tile: "reports", ask: "weatherLand", sign: "warning" },
  { n: 6, tile: "punctuality", ask: "transit", sign: "train" },
];

/** Every ask the page shows. */
export const BUSINESS_ASK_KEYS: readonly AskKey[] = [BUSINESS_HERO_ASK, ...BUSINESS_CASES.flatMap((c) => (c.ask === null ? [] : [c.ask]))];

const CLASSES: Readonly<Record<string, string>> = contract.licenceClasses;

/** The classes this page may credit (B6): whatever else the contract holds, or comes to hold, is refused. */
const CREDITABLE: ReadonlySet<string> = new Set(["open", "attribution", "shareAlike", "own"]);

/** Whether the register classes this source id, and in a class this page may credit. */
export const creditableToBusiness = (source: string): boolean => Object.hasOwn(CLASSES, source) && CREDITABLE.has(CLASSES[source]!);

const logged = new Set<string>();

/** Whether everything named here may be credited; each refusal is logged once, as `<what>:<refused id>`. */
function creditable(what: string, sources: readonly string[]): boolean {
  const refused = sources.filter((s) => !creditableToBusiness(s));
  for (const id of refused) drop(`${what}:${id}`);
  return refused.length === 0;
}

function drop(key: string): void {
  if (logged.has(key)) return;
  logged.add(key);
  logLine(40, { kind: "business_page_dropped", key }, "the business page left out something crediting a source it may not credit");
}

/** The answers the page may show. */
export function businessAnswers<K>(asks: ReadonlyMap<K, AskEntry>): ReadonlyMap<K, AskEntry> {
  return new Map([...asks].filter(([, e]) => creditable(`answer:${e.key}`, e.projection.sources)));
}

/**
 * Whether a tile or fact stands on the page. One the digest did not answer carries no credits field, so it stays this
 * page's error state; one it answered — live or not: a 200 without a figure is `error` with its credits kept — is
 * judged on what it says it credits, and not saying (`null`, or no field on a live answer) is a refusal (B6/B7).
 */
export function shownOnBusinessPage(r: TileResult): boolean {
  if (r.credits === undefined && r.fetched !== "ok") return true;
  const credits = r.credits ?? null;
  if (credits === null) {
    drop(`${r.id}:no_credit_statement`);
    return false;
  }
  return creditable(r.id, credits);
}
