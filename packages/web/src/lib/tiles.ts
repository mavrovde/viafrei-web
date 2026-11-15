/**
 * The live tiles, fetched from the digest and embedded server-side (#375 A3,
 * #378 PR-04). This is the ONLY place the shell talks to anything: one GET per
 * tile per page render, over the compose network, with a deadline.
 *
 * Isolation is the contract: a tile that fails, is slow, or answers something
 * that is not a tile renders as THAT tile's `is-error` state and the rest of
 * the page is unaffected. The page never waits longer than the deadline for
 * any tile (`AbortController`), never throws past this module, and never
 * embeds a body it did not recognise as one of our fragments — the check is
 * cheap and the alternative is a page that prints whatever an upstream said.
 *
 * What the shell knows about a tile is its id, its page slot and which
 * language to ask for. Cadence, credit lines and states are the digest's
 * (`packages/digest/src/presentation/tiles.ts`): the fragment arrives with
 * them, and `Tile-Cadence-Seconds` is read for the My board later.
 */
import { agePill, esc, tileNote, tileShell, type MapPlatform } from "@viafrei/design";
import { t } from "../i18n/index.js";
import type { Lang } from "../site/pages.js";
import { tilePlaceholder } from "./fill.js";
import { logFragmentFailure } from "./log.js";
import { declareHomeSlots, keepHome, keptHome, type HomeSlot } from "./home-kept.js";
import { digestFetch } from "./agent-class.js";

/**
 * The ids the shell EMBEDS, in page order (#379 "Ihr Tag mit ViaFrei"): one
 * live tile per daily moment, then the moments' SECOND tiles. Fuel is back on
 * the home (#423, owner 2026-10-04) as the driving moment's second tile, in
 * the digest's narrow D5 shape — lowest and median observed, the sample and
 * its window, the MTS-K note in the credit element — and never in the hero
 * strip. A tile not on the page is not fetched, so its line cannot leak into
 * the sources list.
 * `jams` (#520, owner 2026-10-07: "traffic information inside the cities, the
 * most high priority feature now") is the jam moment's tile: the jams the
 * police report now in the ten largest cities, counted as `check_road_status`
 * counts them.
 * `station` (#519) is the station moment's SECOND tile: the last 30 minutes
 * at eight main stations, counted from the DELFI Trip Updates we already hold —
 * aggregates, never a train: the shell calls no provider, and the one stored
 * DB board (`db_station_boards`, #1269, the category 1-2 stations) is the
 * station page's, read through the digest, not a tile's.
 * `transit` (the scheduled bus and tram board) is defined in the digest's
 * registry and NOT live until #399, so it is not here: a tile with nothing to
 * show is not embedded rather than embedded empty.
 */
export const MOMENT_TILES = ["punctuality", "lifts", "reports", "jams", "lorry", "charging"] as const;
/** A moment's second tile, rendered under its first (`Moment.extra`). */
export const EXTRA_TILES = ["station", "fuel", "carparks"] as const;
export const EMBEDDED_TILES = [...MOMENT_TILES, ...EXTRA_TILES] as const;
export type EmbeddedTileId = (typeof EMBEDDED_TILES)[number];

/** The one-line FACTS of the "Heute" strip (`?view=fact` on the digest). */
export const FACTS = ["roads", "punctuality", "charging", "lorry"] as const;
export type FactId = (typeof FACTS)[number];

/**
 * Tiles the page has a SLOT for but no promise: `transit` is the scheduled
 * bus and tram board (#399). It is asked for on every render and shown only
 * when the digest answers it live (`is-ok` / `is-stale`); empty, error, slow
 * or absent means the slot is not rendered at all — never a placeholder that
 * reads like a feature.
 */
export const PENDING_TILES = ["transit"] as const;
export type PendingTileId = (typeof PENDING_TILES)[number];
type AnyId = EmbeddedTileId | `fact-${FactId}` | PendingTileId;

export type TileResult = {
  readonly id: AnyId;
  /**
   * `ok` means the digest answered a fragment (whatever state the fragment itself carries); `error` is the shell's own
   * placeholder; `deferred` (#564) means it missed the first render's panel deadline and is a loading placeholder the
   * page fills in the background (`lib/fill.ts`).
   */
  readonly fetched: "ok" | "error" | "deferred";
  readonly html: string;
  readonly cadenceSeconds: number | null;
  /**
   * The register ids this fragment credits, from its `Tile-Credits` header (#1190): empty when it credits nothing, null
   * when it does not say or says it unreadably. Absent on what the digest did not answer.
   */
  readonly credits?: readonly string[] | null;
  /** Why it is an error, for the log — never rendered. */
  readonly reason?: string;
  /** #772: the home's own last good answer stood in for one that did not arrive (`lib/home-kept.ts`). */
  readonly kept?: true;
};

export type FetchLike = (url: string, init: { readonly signal: AbortSignal; readonly headers: Record<string, string> }) => Promise<{
  readonly status: number;
  readonly headers: { get(name: string): string | null };
  text(): Promise<string>;
}>;

export type TileFetchOptions = {
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly fetchImpl?: FetchLike;
  /** #936 D: `DIGEST_FRAGMENT_URL`, read only by the place cards and the motorway pages (`lib/fragment-cache.ts`). */
  readonly fragmentUrl?: string | undefined;
  /**
   * #944: the visitor's platform for the map links (`locals.mapPlatform`, the middleware's reduction of the
   * User-Agent to android | ios | other). Sent as `map=` to the fragments that carry map links, so it is part
   * of every key that keeps one (the fragment cache's `$args`, the kept motorway fragments by URL).
   */
  readonly mapPlatform?: MapPlatform | undefined;
};

/** #944: the `&map=` of a fragment URL — nothing for `other` (the digest's default), so those URLs and keys are unchanged. */
export function mapQuery(o: { readonly mapPlatform?: MapPlatform | undefined }): string {
  return o.mapPlatform === "android" || o.mapPlatform === "ios" ? `&map=${o.mapPlatform}` : "";
}

type TitleKey = `tiles.${EmbeddedTileId}`;
const TITLE_KEY: Readonly<Record<EmbeddedTileId, TitleKey>> = {
  punctuality: "tiles.punctuality",
  lifts: "tiles.lifts",
  reports: "tiles.reports",
  jams: "tiles.jams",
  lorry: "tiles.lorry",
  carparks: "tiles.carparks",
  charging: "tiles.charging",
  station: "tiles.station",
  fuel: "tiles.fuel",
};

/**
 * The shell's own error tile: the state's word on the pill, the error note,
 * NO figure and NO credit line — a figure without its source may not be shown
 * (#377 R3), and the shell has no source to show. The frame is the one every
 * tile has (`@viafrei/design` `tileShell`, #922), the digest's included.
 */
export function errorTile(id: EmbeddedTileId, lang: Lang): string {
  return tileShell({
    id,
    state: "error",
    title: esc(t(lang, TITLE_KEY[id])),
    pill: agePill({ word: esc(t(lang, "tile.error")) }),
    figure: { value: null, unit: esc("") },
    note: tileNote(esc(t(lang, "tile.errorNote"))),
    credits: [],
  });
}

/** A body is a fragment of ours when it is exactly one tile section with a known state. */
export function isFragment(body: string, id: AnyId): boolean {
  const open = id.startsWith("fact-")
    ? new RegExp(`^<section class="tile tile--fact is-(ok|stale|empty|error)" id="${id}"`)
    : // #717 C-4: the fuel tile's root also carries the Clarity stop marker after its state
      new RegExp(`^<section class="tile is-(ok|stale|empty|error)(?: vf-noclarity)?" id="tile-${id}"`);
  return open.test(body) && body.trimEnd().endsWith("</section>") && !/<script|<style|javascript:/i.test(body);
}

/**
 * A fact that did not answer LIVE is simply not shown: the strip carries three
 * headlines or fewer, never a placeholder sentence without a number. A 200
 * whose fragment is `is-empty` or `is-error` ("— der Fahrten in — verspätet")
 * is a fact that did not answer, the same rule as `fetchPending`.
 */
export async function fetchFact(id: FactId, lang: Lang, o: TileFetchOptions): Promise<TileResult> {
  const key = `fact-${id}` as const;
  const r = await fetchOne(`${o.baseUrl}/internal/tiles/${id}?lang=${lang}&view=fact`, key, o, () => "");
  return r.fetched === "ok" && !isLive(r.html) ? { ...r, fetched: "error", html: "", reason: NOT_LIVE } : r;
}

/** Why a fact or the pending slot that answered is not shown: the digest said it has no figure. An answer, not a failure. */
const NOT_LIVE = "fact not live";

/** The reason a non-200 answer is recorded under — `statusOf` reads the status back out of it. */
const httpReason = (status: number): string => `HTTP ${String(status)}`;
/** A fragment's licence gate answers 404: an answer that stands, never a fault and never replaced by a kept one. */
const GATED = httpReason(404);

/** `is-ok` or `is-stale`: a fragment carrying a figure. */
function isLive(html: string): boolean {
  return /^<section class="tile (?:tile--fact )?is-(ok|stale)(?: vf-noclarity)?"/.test(html);
}

export async function fetchTile(id: EmbeddedTileId, lang: Lang, o: TileFetchOptions): Promise<TileResult> {
  return fetchOne(`${o.baseUrl}/internal/tiles/${id}?lang=${lang}`, id, o, () => errorTile(id, lang));
}

async function fetchOne(url: string, id: AnyId, o: TileFetchOptions, fallback: () => string): Promise<TileResult> {
  const t0 = Date.now();
  const r = await fetchOneRaw(url, id, o, fallback);
  // #741: a tile that did not arrive is a line; a 404 is the licence gate's answer, not a fault.
  if (r.fetched === "error" && r.reason !== GATED) logFragmentFailure(url, statusOf(r.reason), r.reason ?? "", Date.now() - t0);
  return r;
}

/** `HTTP 502` → 502; any other reason carries no status. */
const statusOf = (reason: string | undefined): number | null => {
  const m = /^HTTP (\d{3})$/.exec(reason ?? "");
  return m === null ? null : Number(m[1]);
};

/** The `Tile-Credits` header: `a,b`, or empty for a fragment crediting nothing. Missing or anything else is no statement. */
export function parseCredits(header: string | null): readonly string[] | null {
  if (header === null) return null;
  if (header === "") return [];
  return /^[a-z0-9_]{1,60}(?:,[a-z0-9_]{1,60})*$/u.test(header) ? header.split(",") : null;
}

async function fetchOneRaw(url: string, id: AnyId, o: TileFetchOptions, fallback: () => string): Promise<TileResult> {
  const fetchImpl: FetchLike = o.fetchImpl ?? ((url, init) => digestFetch(url, init));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), o.timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: controller.signal, headers: { accept: "text/html" } });
    if (res.status !== 200) return { id, fetched: "error", html: fallback(), cadenceSeconds: null, reason: httpReason(res.status) };
    const type = res.headers.get("content-type") ?? "";
    if (!type.startsWith("text/html")) return { id, fetched: "error", html: fallback(), cadenceSeconds: null, reason: `content-type ${type}` };
    const body = await res.text();
    if (!isFragment(body, id)) return { id, fetched: "error", html: fallback(), cadenceSeconds: null, reason: "not a tile fragment" };
    const cadence = Number(res.headers.get("tile-cadence-seconds") ?? "");
    return { id, fetched: "ok", html: body, cadenceSeconds: Number.isInteger(cadence) && cadence > 0 ? cadence : null, credits: parseCredits(res.headers.get("tile-credits")) };
  } catch (err) {
    let reason = String(err);
    if (err instanceof Error) reason = err.name === "AbortError" ? `timeout after ${o.timeoutMs} ms` : err.message;
    return { id, fetched: "error", html: fallback(), cadenceSeconds: null, reason };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The fuel page's tile (v1.8.18): the fuel tile WITH the per-Land station
 * board (`?view=board`), which left the home for a page of its own (owner
 * 2026-10-06). Same id, same isolation and the same error tile as the home's.
 */
export async function fetchFuelBoard(lang: Lang, o: TileFetchOptions): Promise<TileResult> {
  return fetchOne(`${o.baseUrl}/internal/tiles/fuel?lang=${lang}&view=board`, "fuel", o, () => errorTile("fuel", lang));
}

/** A pending tile's fragment when it is LIVE (ok or stale), otherwise null and the slot is not rendered. */
export async function fetchPending(id: PendingTileId, lang: Lang, o: TileFetchOptions): Promise<TileResult | null> {
  const r = await fetchPendingRaw(id, lang, o);
  return r.fetched === "ok" ? r : null;
}

/** The pending slot's answer: `ok` when live, `error` with `NOT_LIVE` when it answered without a figure, `error` when it did not answer. */
async function fetchPendingRaw(id: PendingTileId, lang: Lang, o: TileFetchOptions): Promise<TileResult> {
  const r = await fetchOne(`${o.baseUrl}/internal/tiles/${id}?lang=${lang}`, id, o, () => "");
  return r.fetched === "ok" && !isLive(r.html) ? { ...r, fetched: "error", html: "", reason: NOT_LIVE } : r;
}

/** A tile id the shell embeds — the one check `/fragment/tile` makes before it asks the digest anything. */
export const isEmbeddedTile = (v: unknown): v is EmbeddedTileId => typeof v === "string" && (EMBEDDED_TILES as readonly string[]).includes(v);

/** The same-origin path a deferred tile is filled from (`pages/fragment/tile.ts`). */
export const tileFillPath = (id: EmbeddedTileId, lang: Lang): string => `/fragment/tile?id=${id}&lang=${lang}`;

/**
 * A tile that missed the panel deadline (#564): its loading placeholder. Only a TIMEOUT defers — a digest that
 * answered with an error is the error tile, as before, because asking again in the browser would not change it.
 */
function deferred(r: TileResult, id: EmbeddedTileId, lang: Lang): TileResult {
  if (r.fetched !== "error" || !(r.reason ?? "").startsWith("timeout")) return r;
  return { id, fetched: "deferred", html: tilePlaceholder(id, t(lang, TITLE_KEY[id]), lang, tileFillPath(id, lang)), cadenceSeconds: null, reason: r.reason ?? "timeout" };
}

export type PageTiles = Readonly<Record<EmbeddedTileId, TileResult>> & {
  /** The facts that answered, in strip order; a fact that did not is left out. */
  readonly facts: readonly TileResult[];
  readonly pending: Readonly<Record<PendingTileId, TileResult | null>>;
};

/**
 * Every embedded tile, every fact and every pending slot, in parallel, each with its own deadline; the slowest bounds
 * the page at `timeoutMs` — or, with `deadlineMs` (#564, render-then-fill), at that: a tile past it is a loading
 * placeholder the page fills in the background, and a fact or the pending slot past it is simply not shown (their rule
 * for any answer that is not live).
 */
export async function fetchTiles(lang: Lang, o: TileFetchOptions & { readonly deadlineMs?: number }): Promise<PageTiles> {
  if (o.deadlineMs === undefined) {
    const [tiles, facts, transit] = await Promise.all([Promise.all(EMBEDDED_TILES.map((id) => fetchTile(id, lang, o))), Promise.all(FACTS.map((id) => fetchFact(id, lang, o))), fetchPending("transit", lang, o)]);
    return pageOf(tiles, facts, transit);
  }
  // The home's render-then-fill path (#564): every block under the panel deadline, and (#772) a block that did not
  // arrive answered from the home's own last good one before it becomes a placeholder or is left out.
  const first: TileFetchOptions = { ...o, timeoutMs: Math.min(o.timeoutMs, o.deadlineMs) };
  const [tiles, facts, transit] = await Promise.all([
    Promise.all(EMBEDDED_TILES.map(async (id) => deferred(withKept(await fetchTile(id, lang, first), `tile-${id}`, lang), id, lang))),
    Promise.all(FACTS.map(async (id) => withKept(await fetchFact(id, lang, first), `fact-${id}`, lang))),
    fetchPendingRaw("transit", lang, first).then((r) => withKept(r, "pending-transit", lang)),
  ]);
  return pageOf(tiles, facts, transit.fetched === "ok" ? transit : null);
}

function pageOf(tiles: readonly TileResult[], facts: readonly TileResult[], transit: TileResult | null): PageTiles {
  return {
    ...(Object.fromEntries(tiles.map((r) => [r.id, r])) as Record<EmbeddedTileId, TileResult>),
    facts: facts.filter((f) => f.fetched === "ok"),
    pending: { transit },
  };
}

/** Every home slot this module owns (#772): the kept store holds these and nothing else. */
export const HOME_TILE_SLOTS: readonly HomeSlot[] = [...EMBEDDED_TILES.map((id) => `tile-${id}` as const), ...FACTS.map((id) => `fact-${id}` as const), ...PENDING_TILES.map((id) => `pending-${id}` as const)];
declareHomeSlots(HOME_TILE_SLOTS);

/**
 * #772: a live answer is kept for its own cadence; one that did not ARRIVE (a timeout, a refused connection, a 5xx,
 * a body that is not ours) is answered from the kept one while it is young enough. A 404 (the licence gate) and an
 * answer that is not live are answers and stand.
 */
function withKept(r: TileResult, slot: HomeSlot, lang: Lang): TileResult {
  if (r.fetched === "ok") {
    if (r.cadenceSeconds !== null && isLive(r.html)) keepHome(slot, lang, r.html, r.cadenceSeconds, r.cadenceSeconds);
    return r;
  }
  if (r.reason === NOT_LIVE || r.reason === GATED) return r;
  const k = keptHome(slot, lang);
  return k === null ? r : { id: r.id, fetched: "ok", html: k.html, cadenceSeconds: k.cadenceSeconds, kept: true };
}
