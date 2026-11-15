/**
 * `src/generated/catalogue.json` — what the MCP server actually serves, read
 * at BUILD time from the server itself (#379 work item 2, #143): the tool
 * names and titles, the prompts, the resources, and the release this build
 * belongs to (version from the root package.json, its date and CHANGELOG
 * anchor from that version's own block), and the MCP Server Card the server
 * serves on mcp.viafrei.de (#534) — the document viafrei.de serves on
 * `/.well-known/mcp/server-card.json`, so the two hosts cannot describe the
 * server two ways. Never typed: `test/pages-content.test.ts`
 * fails when this copy and the booted server disagree.
 *
 * It boots the server in memory against a database stub, exactly as
 * `npm run mcp:contract` does, so no database and no provider are touched.
 * An empty listing is a refusal (exit 2) and never an empty page section.
 *
 *   npx tsx packages/web/scripts/generate-catalogue.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { conditionAsRegistered, creditParts } from "@viafrei/ingest";
import { ATTRIBUTION, holdsNoData, licenceTextOf } from "../../../.pinned/app/packages/mcp/dist/src/presentation/attribution.js";
import { RATE_LIMITED_CODE, SESSION_NOT_FOUND } from "../../../.pinned/app/packages/mcp/dist/src/server/app.js";
import { serverCard, type ServerCard } from "../../../.pinned/app/packages/mcp/dist/src/server/server-card.js";
import { licenceClassOf, type LicenceClass } from "../src/site/licence-classes.js";
import { connectInMemory } from "../../../.pinned/app/packages/mcp/dist/src/server/testing.js";
import { berlinDay } from "../src/site/lastmod-map.js";

export type Catalogue = {
  readonly release: { readonly version: string; readonly date: string; readonly anchor: string };
  /** `description`: the first sentence of the tool's own description — the one line `/llms-full.txt` prints (#531). */
  readonly tools: readonly { readonly name: string; readonly title: string; readonly description: string }[];
  readonly prompts: readonly { readonly name: string; readonly description: string }[];
  readonly resources: readonly { readonly uri: string; readonly name: string }[];
  /** `viafrei://coverage` → `notCovered`: what the server says it does NOT answer (static part only; the feed table needs the database). */
  readonly notCovered: readonly string[];
  /** Every source the server answers from today (#142 item 5): the register's credit line, verbatim, German. `planned` and `discontinued` rows are left out — no data, no credit. */
  /** The SEP-2127 card, exactly as `packages/mcp/src/server/server-card.ts` builds it for this tree (#534): name, version, remotes, `_meta` — nothing re-typed here. */
  readonly serverCard: ServerCard;
  readonly credits: readonly { readonly id: string; readonly text: string; readonly url: string; readonly licence: { readonly name: string; readonly url: string } | null; readonly condition: string | null; readonly altered: string | null; readonly verbatim: boolean; readonly parts: readonly { readonly text: string; readonly href: string | null }[] | null }[];
};

/**
 * `src/generated/contract.json` (#992): what the business and developers pages need beyond the catalogue, in a file
 * of its own so that a schema edit moves the `lastmod` of those two pages only, never of every page that lists the
 * tool names. Written by the same run, from the same booted server; `test/contract-992.test.ts` is its drift test.
 *
 *   - `tools`: each tool's arguments (name, JSON type, required, the enum when the schema closes the value; `language`
 *     left out because every tool takes it) and its whole input schema, verbatim, for the page's `<details>`;
 *   - `contractReleases`: the newest releases whose CHANGELOG block names a tool, at most `CONTRACT_RELEASES` — the
 *     version, its date and the tools it names, never the block's English prose;
 *   - `errors`: the JSON-RPC codes a client meets, from the server's own constants;
 *   - `licenceClasses`: each credited source's licence class (`src/site/licence-classes.ts`).
 */
export type Contract = {
  readonly tools: readonly { readonly name: string; readonly args: readonly ToolArg[]; readonly schema: Readonly<Record<string, unknown>> }[];
  readonly contractReleases: readonly { readonly version: string; readonly date: string; readonly tools: readonly string[] }[];
  readonly errors: { readonly rateLimited: number; readonly sessionNotFound: number };
  readonly licenceClasses: Readonly<Record<string, LicenceClass>>;
};

export type ToolArg = { readonly name: string; readonly type: string; readonly required: boolean; readonly enum?: readonly string[] };

/** How many releases "What's new" lists (#992: "the last three releases that touched the tool contract"). */
export const CONTRACT_RELEASES = 3;

/** A tool's arguments as its input schema declares them, `language` left out. */
export function argsOf(schema: { readonly properties?: unknown; readonly required?: unknown }): ToolArg[] {
  const props = (typeof schema.properties === "object" && schema.properties !== null ? schema.properties : {}) as Record<string, Record<string, unknown>>;
  const required = new Set(Array.isArray(schema.required) ? (schema.required as string[]) : []);
  return Object.entries(props)
    .filter(([name]) => name !== "language")
    .map(([name, p]) => {
      const items = (typeof p["items"] === "object" && p["items"] !== null ? p["items"] : {}) as Record<string, unknown>;
      const type = typeof p["type"] === "string" ? (p["type"] === "array" && typeof items["type"] === "string" ? `${items["type"]}[]` : p["type"]) : Array.isArray(p["anyOf"]) ? "union" : "any";
      const en = Array.isArray(p["enum"]) ? p["enum"] : Array.isArray(items["enum"]) ? items["enum"] : null;
      const arg: ToolArg = { name, type, required: required.has(name) };
      return en !== null && en.length <= 12 && en.every((v) => typeof v === "string") ? { ...arg, enum: en } : arg;
    });
}

/**
 * The newest CHANGELOG blocks that name a catalogue tool in backticks, at most `max` (#992). A block is
 * `## [X.Y.Z] — YYYY-MM-DD` up to the next `## [`; `[Unreleased]` is never a release.
 */
export function contractReleasesOf(changelog: string, toolNames: readonly string[], max: number = CONTRACT_RELEASES): { version: string; date: string; tools: string[] }[] {
  const out: { version: string; date: string; tools: string[] }[] = [];
  const heads = [...changelog.matchAll(/^## \[(\d+\.\d+\.\d+)\] — (\d{4}-\d{2}-\d{2})$/gm)];
  for (let i = 0; i < heads.length && out.length < max; i += 1) {
    const h = heads[i]!;
    const end = changelog.indexOf("\n## [", h.index + 1);
    const body = changelog.slice(h.index, end === -1 ? undefined : end);
    const tools = toolNames.filter((n) => body.includes(`\`${n}\``));
    if (tools.length > 0) out.push({ version: h[1]!, date: h[2]!, tools });
  }
  return out;
}

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..", "..");

function firstSentence(s: string | undefined): string {
  const t = (s ?? "").trim().replace(/\s+/g, " ");
  const m = /^(.+?[.!?])(\s|$)/.exec(t);
  return (m?.[1] ?? t).slice(0, 200);
}

/**
 * One line about a tool for `/llms-full.txt` (#531): its description's first
 * sentence — a full stop counts only before a capital and outside brackets, so
 * "(nextbike incl. KVB)" does not end it — cut at a word and marked "…" when
 * it runs past 240 characters.
 */
export function oneLine(s: string | undefined): string {
  const t = (s ?? "").trim().replace(/\s+/g, " ");
  const open = (x: string): boolean => (x.match(/\(/g) ?? []).length > (x.match(/\)/g) ?? []).length;
  let first = t;
  for (const m of t.matchAll(/[.!?](?=\s+[A-ZÄÖÜ(]|$)/g)) {
    const head = t.slice(0, m.index + 1);
    if (!open(head)) {
      first = head;
      break;
    }
  }
  if (first.length <= 240) return first;
  return `${first.slice(0, 240).replace(/\s+\S*$/, "")}…`;
}

/**
 * The release's day: its CHANGELOG heading's date; else the date this version's
 * catalogue was FIRST regenerated with (the committed `catalogue.json` when it is
 * for the same version); else the Berlin day of this regeneration. A patch of a
 * line carries no CHANGELOG block until the milestone closes (owner 2026-10-26),
 * and the regeneration runs in the release commit, so that first day IS the
 * release day — the rule the lastmod map applies to a moved page. Kept, not
 * recomputed: a date taken from the clock on every build made the drift test
 * (`pages-content.test.ts`) pass only on the day of the cut (2.4.1 review B1).
 * Never null: `site/lastmod.ts` falls back to it for a build without APP_BUILT_AT.
 */
export function releaseDateOf(changelog: string, version: string, now: Date, committed?: { readonly version?: unknown; readonly date?: unknown } | null): string {
  const m = new RegExp(`^## \\[${version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\] — (\\d{4}-\\d{2}-\\d{2})`, "m").exec(changelog);
  if (m !== null) return m[1]!;
  if (committed?.version === version && typeof committed.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(committed.date)) return committed.date;
  return berlinDay(now);
}

/** The committed catalogue's release block, or null when there is none to read. */
function committedRelease(): { version?: unknown; date?: unknown } | null {
  try {
    return (JSON.parse(readFileSync(join(here, "..", "src", "generated", "catalogue.json"), "utf8")) as { release?: { version?: unknown; date?: unknown } }).release ?? null;
  } catch {
    return null;
  }
}

export async function buildCatalogue(): Promise<Catalogue> {
  const stubDb = { query: () => Promise.reject(new Error("catalogue: no DB")) };
  const client = await connectInMemory({ db: stubDb as never });
  const [{ tools }, { prompts }, { resources }] = await Promise.all([client.listTools(), client.listPrompts(), client.listResources()]);
  const cov = await client.readResource({ uri: "viafrei://coverage" });
  const covText = (cov.contents[0] as { text?: string } | undefined)?.text ?? "{}";
  // The last line is about house numbers and depends on the database; without one it says "could not be determined".
  const notCovered = ((JSON.parse(covText) as { notCovered?: string[] }).notCovered ?? []).filter((x) => !/could not be determined/.test(x));
  const version = (JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version: string }).version;
  const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");
  return {
    release: { version, date: releaseDateOf(changelog, version, new Date(), committedRelease()), anchor: version.replace(/\./g, "") },
    tools: tools.map((t) => ({ name: t.name, title: t.title ?? t.annotations?.title ?? firstSentence(t.description), description: oneLine(t.description) })),
    prompts: prompts.map((p) => ({ name: p.name, description: firstSentence(p.description) })),
    resources: resources.map((r) => ({ uri: r.uri, name: r.name })),
    notCovered,
    serverCard: serverCard(),
    credits: Object.entries(ATTRIBUTION)
      .filter(([, row]) => !holdsNoData(row))
      // `licence`: the licence text the row's licence obliges a link to (CC BY 4.0 § 3(a)(1)(C), owner 2026-10-05), from the one map in @viafrei/ingest.
      // `condition`: a publisher's condition of use beyond the licence (#454, the RVWD line of the
      // Landesmeldestelle Baden-Württemberg), German like the line it stands under — the tools state it
      // on every answer the row's feed gave, and the site prints it under that credit.
      // `altered`: the line a source prescribes for OUR summary of its values instead of `text` (the DWD's
      // "Datenbasis: …, zusammengefasst", which carries no "Quelle:"); the site's summarised live answers use it (#744 C1).
      // `verbatim`: the publisher binds the WORDING of what is shown — the RVWD's "ungekürzt und nur aktuell"
      // (`currentAndUnabridged`, #454 C1). Not every condition does: KVB's no-warranty sentence (#487) is a
      // condition and binds no message text, so the site's verbatim rule reads this flag, never `condition`.
      // `parts`: the line split at the words its licensor prescribes as links (GN250: "BKG" and
      // "dl-de/by-2-0", data-steward ruling 2026-10-07), or null for the generic form.
      .map(([id, row]) => ({ id, text: row.text, url: row.url, licence: licenceTextOf(row), condition: row.conditionNote === undefined ? null : conditionAsRegistered(row.conditionNote.de, "de"), altered: row.altered ?? null, verbatim: row.currentAndUnabridged === true, parts: creditParts(id, row.text) })),
  };
}

export async function buildContract(): Promise<Contract> {
  const stubDb = { query: () => Promise.reject(new Error("contract: no DB")) };
  const client = await connectInMemory({ db: stubDb as never });
  const { tools } = await client.listTools();
  const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");
  return {
    tools: tools.map((t) => ({ name: t.name, args: argsOf(t.inputSchema), schema: t.inputSchema })),
    contractReleases: contractReleasesOf(changelog, tools.map((t) => t.name)),
    errors: { rateLimited: RATE_LIMITED_CODE, sessionNotFound: SESSION_NOT_FOUND.error.code },
    licenceClasses: Object.fromEntries(Object.entries(ATTRIBUTION).filter(([, row]) => !holdsNoData(row)).map(([id, row]) => [id, licenceClassOf(row)])),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const cat = await buildCatalogue();
  if (cat.tools.length === 0 || cat.prompts.length === 0 || cat.resources.length === 0 || cat.notCovered.length === 0 || cat.credits.length === 0) {
    console.error(`✗ the server listed ${cat.tools.length} tools, ${cat.prompts.length} prompts, ${cat.resources.length} resources, ${cat.notCovered.length} not-covered lines, ${cat.credits.length} credit lines — refusing to write an empty catalogue`);
    process.exit(2);
  }
  writeFileSync(join(here, "..", "src", "generated", "catalogue.json"), `${JSON.stringify(cat, null, 2)}\n`);
  const contract = await buildContract();
  writeFileSync(join(here, "..", "src", "generated", "contract.json"), `${JSON.stringify(contract, null, 2)}\n`);
  console.log(`✓ catalogue.json: ${cat.tools.length} tools, ${cat.prompts.length} prompts, ${cat.resources.length} resources, release ${cat.release.version}`);
  process.exit(0);
}
