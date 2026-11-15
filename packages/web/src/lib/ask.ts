/**
 * The site's live assistant answers, read by the shell (#743/#744).
 *
 * The MCP process asks its own tools the site's example questions and serves
 * language-neutral projections on its internal listener (`/internal/examples`,
 * compose network only, never a provider). This module fetches them once per
 * render under a deadline, refuses anything not exactly that shape, and
 * renders one sentence per answer in the page's language from the `ask.*`
 * templates of the copy deck.
 *
 * A missing, slow or malformed answer is no answer: the card then shows its
 * question without one. A sentence is never rendered with a hole in it —
 * `t()` throws on an unfilled placeholder, and that is caught here as "no
 * sentence", never a broken page.
 */
import { catalogue, t, type MessageKey } from "../i18n/index.js";
import type { Lang } from "../site/pages.js";
import { berlinTime } from "./dates.js";
import type { FetchLike } from "./tiles.js";
import { numberFormat } from "./intl-formats.js";

export const ASK_KEYS = ["roads", "lorryPark", "hydrogen", "weatherLand", "transit", "charging", "chargingNear", "parking", "roadsNear", "weather", "nearby", "poi"] as const;
export type AskKey = (typeof ASK_KEYS)[number];

export type AskProjection = {
  readonly variant: string;
  readonly values: Readonly<Record<string, number>>;
  readonly names: Readonly<Record<string, string>>;
  readonly asOf: string;
  readonly attribution: string;
  /** The register ids of the sources that answered; each is credited by its short catalogue line. */
  readonly sources: readonly string[];
  readonly notes?: readonly string[];
  /** The sentence summarises the sources' values: each is credited by its `altered` line (#744, data-steward C1). */
  readonly summarised?: true;
};
export type AskEntry = { readonly key: AskKey; readonly tool: string; readonly askedAt: string; readonly projection: AskProjection };
export type AskSet = ReadonlyMap<AskKey, AskEntry>;

export const EMPTY_ASKS: AskSet = new Map();

/** Path on the internal listener; the MCP side's `INTERNAL_EXAMPLES_ROUTE`. */
export const ASKS_PATH = "/internal/examples";

const obj = (v: unknown): Record<string, unknown> | null => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const isIso = (v: unknown): v is string => typeof v === "string" && v.length <= 40 && !Number.isNaN(Date.parse(v));
/** A name the data gives (a road, a station, an operator): short text, no markup-ish control characters. */
const isName = (v: unknown): v is string => typeof v === "string" && v.trim() !== "" && v.length <= 200 && !/[\u0000-\u001f<>]/u.test(v);

/** One entry, exactly as the MCP side serves it, or null. */
export function parseAsk(x: unknown): AskEntry | null {
  const e = obj(x);
  const p = obj(e?.["projection"]);
  if (e === null || p === null) return null;
  const key = e["key"];
  if (typeof key !== "string" || !(ASK_KEYS as readonly string[]).includes(key)) return null;
  const tool = e["tool"];
  if (typeof tool !== "string" || !/^[a-z][a-z_]{2,40}$/u.test(tool)) return null;
  if (!isIso(e["askedAt"]) || !isIso(p["asOf"])) return null;
  const variant = p["variant"];
  if (typeof variant !== "string" || !/^[A-Za-z]{1,30}$/u.test(variant)) return null;
  const values = obj(p["values"]);
  const names = obj(p["names"]);
  if (values === null || names === null) return null;
  if (!Object.values(values).every((v) => typeof v === "number" && Number.isFinite(v))) return null;
  if (!Object.values(names).every(isName)) return null;
  const attribution = p["attribution"];
  if (typeof attribution !== "string" || attribution.trim() === "" || attribution.length > 2_000) return null;
  const notes = p["notes"];
  if (notes !== undefined && !(Array.isArray(notes) && notes.every((n) => typeof n === "string" && n.trim() !== "" && n.length <= 2_000))) return null;
  const sources = p["sources"];
  if (!Array.isArray(sources) || sources.length === 0 || sources.length > 40 || !sources.every((s) => typeof s === "string" && /^[a-z0-9_]{1,60}$/u.test(s))) return null;
  // Only a person's own request may ask Tankerkönig (data-steward C5): an answer that carries it is not a site answer, here too.
  if (sources.some((s) => s === "tankerkoenig" || s === "tankerkoenig_hist")) return null;
  const summarised = p["summarised"];
  if (summarised !== undefined && summarised !== true) return null;
  return {
    key: key as AskKey,
    tool,
    askedAt: e["askedAt"],
    projection: {
      variant,
      values: values as Record<string, number>,
      names: names as Record<string, string>,
      asOf: p["asOf"],
      attribution,
      sources: sources as string[],
      ...(notes === undefined ? {} : { notes: notes as string[] }),
      ...(summarised === true ? { summarised: true as const } : {}),
    },
  };
}

/** The whole set, keyed; a duplicate key keeps the first, a bad entry is dropped. */
export function parseAsks(body: unknown): AskSet {
  const list = obj(body)?.["examples"];
  const out = new Map<AskKey, AskEntry>();
  if (!Array.isArray(list)) return out;
  for (const x of list) {
    const e = parseAsk(x);
    if (e !== null && !out.has(e.key)) out.set(e.key, e);
  }
  return out;
}

/** One GET under its deadline. No origin configured, a timeout, a non-200 or a body that is not JSON: the empty set. */
export async function fetchAsks(o: { readonly baseUrl: string | undefined; readonly timeoutMs: number; readonly fetchImpl?: FetchLike }): Promise<AskSet> {
  if (o.baseUrl === undefined) return EMPTY_ASKS;
  const f: FetchLike = o.fetchImpl ?? ((url, init) => fetch(url, init));
  try {
    const r = await f(`${o.baseUrl}${ASKS_PATH}`, { signal: AbortSignal.timeout(o.timeoutMs), headers: { accept: "application/json" } });
    if (r.status !== 200) return EMPTY_ASKS;
    return parseAsks(JSON.parse(await r.text()));
  } catch {
    return EMPTY_ASKS;
  }
}

/** A figure in the page's language: "0,3" in German, "0.3" in English. */
function figure(lang: Lang, n: number): string {
  return numberFormat(lang, { maximumFractionDigits: 1 }).format(n);
}

/** A run of the sentence: the deck's words, or a name the data gives (rendered `translate="no"`, #449). */
export type AnswerPart = { readonly text: string; readonly name: boolean };

const HOLE = "\u0000";

/**
 * The answer's sentence in the page's language, split so the data's names can
 * be marked untranslatable — or null when the deck has no template for this
 * variant or the template cannot be filled (`Answer.astro`'s hole technique).
 */
export function answerParts(lang: Lang, e: AskEntry): readonly AnswerPart[] | null {
  const key = `ask.${e.key}.${e.projection.variant}`;
  if (catalogue(lang)[key] === undefined) return null;
  const names = Object.keys(e.projection.names);
  const vars: Record<string, string> = Object.fromEntries(names.map((k, i) => [k, `${HOLE}${String(i)}${HOLE}`]));
  for (const [k, v] of Object.entries(e.projection.values)) vars[k] = figure(lang, v);
  let raw: string;
  try {
    raw = t(lang, key as MessageKey, vars);
  } catch {
    return null;
  }
  return raw
    .split(HOLE)
    .map((s, i) => (i % 2 === 0 ? { text: s, name: false } : { text: e.projection.names[names[Number(s)] ?? ""] ?? "", name: true }))
    .filter((p) => p.text !== "");
}

/** The same sentence as plain text, or null. */
export function answerText(lang: Lang, e: AskEntry): string | null {
  const parts = answerParts(lang, e);
  return parts === null ? null : parts.map((p) => p.text).join("");
}

/** When the data is from, in Berlin time ("14:05"). */
export function answerTime(lang: Lang, e: AskEntry): string {
  return berlinTime(new Date(e.projection.asOf), lang);
}

/**
 * How long an ASK stays fresh: one refresh cycle of the MCP's asks (15 min) and five minutes for a pass to settle.
 * The state is about the ask, not the data (2.1.18 deploy): measured from the data's own instant, which is already a
 * few minutes old when asked, every answer turned stale for the last minutes of every cycle and back on the next pass.
 * The data's time stays printed beside the dot.
 */
export const ANSWER_FRESH_MS = 20 * 60_000;

/** `is-ok` while the answer was asked within one refresh cycle, `is-stale` once a refresh has been missed. */
export function answerState(e: AskEntry, now: Date): "is-ok" | "is-stale" {
  return now.getTime() - Date.parse(e.askedAt) < ANSWER_FRESH_MS ? "is-ok" : "is-stale";
}

/** #992: the business and developers pages carry no example older than a day — a stale answer is left out there, not shown as stale. */
export const EXAMPLE_MAX_AGE_MS = 24 * 3_600_000;

/** The held answers young enough for those pages: asked AND about data no older than a day (the older of the two counts), none from the future. */
export function withinDay<K>(asks: ReadonlyMap<K, AskEntry>, now: Date): ReadonlyMap<K, AskEntry> {
  const young = (e: AskEntry): boolean =>
    [e.askedAt, e.projection.asOf].every((x) => {
      const age = now.getTime() - Date.parse(x);
      return age <= EXAMPLE_MAX_AGE_MS && age >= -5 * 60_000;
    });
  return new Map([...asks].filter(([, e]) => young(e)));
}
