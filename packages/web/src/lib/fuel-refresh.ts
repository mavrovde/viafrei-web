/**
 * The fuel card's on-demand refresh, from the shell's side (#564).
 *
 * The owner's rulings, 2026-10-12: "we have precached values, but if we have
 * clear request from the user from the specific location - we must use this
 * location and ask the tankerkonig, this is completely legal", widened the
 * same day to "use any known user position, browser location, IP, provided
 * address but the data must be actual and close to this location!" — so a
 * PERSON opening the home (its IP rung included) or a place page, or the
 * island loading a place they chose, saved or were located at, is the user
 * action: Tankerkönig's own API page names it "Requests on Demand – auf
 * Useraktion".
 *
 * #981 C1 (data-steward ruling 2026-10-24): the ask is made by a FRAGMENT
 * request only — the island's or the page filler's POST `/fragment/place`.
 * A document render (a place page, the home's IP rung) asks nothing: a client
 * forging a browser's navigation headers walked the place pages and turned
 * every GET into a discovery. `personAsks(…, "document")` now decides only
 * whether the rendered page carries the FILL MARKER whose POST will ask.
 *
 * This file decides only that a PERSON is asking. It never decides how much:
 * the refresh runs in the MCP process (`packages/mcp/src/server/internal.ts`)
 * under every guard of the one Tankerkönig port — at most ten stations per
 * call, none priced inside the 30-minute cache window (#712), the same-place window, the
 * one queue and the key-wide 60 s spacing (the only rate bound since #781) — and
 * nothing the request says can widen them.
 *
 * Never for a crawler (every hit would be a provider call and the key would be
 * banned), a prefetch or prerender, a HEAD, a request with no user agent, or a
 * fragment request without the island's `how` field — and never for a request
 * a PERSON did not make (review of #564, the provider's terms: "Regelmäßige,
 * nicht explizit vom User initiierte Requests sind zu vermeiden"):
 *   - a page render carries the fill marker only for a top-level NAVIGATION,
 *     which a browser announces with `Sec-Fetch-Mode: navigate` and
 *     `Sec-Fetch-Dest: document` (Chrome 80+, Firefox 90+, Safari 16.4+). curl,
 *     a smoke test, an uptime check, our own prod round send neither and get no
 *     marker; a browser too old to send them sees the held prices with their
 *     time, never a wrong answer — and even with the marker, nothing is asked
 *     until the page's own script POSTs it (#981 C1);
 *   - the home's own automatic reload (`<meta http-equiv="refresh">`, every 20
 *     minutes) is a navigation too, so it goes to a MARKED address
 *     (`?r=auto`, `AUTO_RELOAD_URL`) and a marked render asks nothing — nor
 *     does the island on that page until the person touches the place bar (it
 *     sends `how: "held"`, the one `how` that never asks);
 *   - a fragment request asks only when the browser says it came from THIS
 *     origin's page (`Sec-Fetch-Site: same-origin`): a script run elsewhere, a
 *     curl POST, a replayed request carry no such header. What leaves this process:
 * the AREA KEY, to our own MCP process on the compose network — never the
 * address, never a header of the visitor's. What reaches Tankerkönig: station
 * ids for a price ask; and, only where we hold fewer than three stations within
 * 5 km of the place, ONE `list.php` about the centroid of the nearest Gemeinde
 * with a 5 km radius (a public place, the same for everyone in it — never the
 * ~500 m cell or the IP point), per area at most once in five minutes. Nothing
 * about the person, ever (data-steward ruling 2026-10-12, Datenschutz
 * `#ort-tanken`).
 */
import { CRAWLER } from "../location/server.js";
import { HOME_REFRESH_URL } from "../site/pages.js";
import { isAutomationAgent } from "../site/crawlers.js";

/**
 * How the island says it got the place (`how` in the POST body); `fill` is the
 * background re-read of a pending refresh. A `fill` asks the refresh again, so
 * a request the MCP process lost (a restart empties its queue, #712) is
 * submitted again by the next fill rather than waited for for ever.
 */
export const HOWS = ["ip", "page", "manual", "browser", "saved", "auto", "fill"] as const;
/**
 * The `how` that shows the held prices and asks nothing: the island on a page
 * the meta refresh reloaded, and a placeholder of a first render that did not
 * ask. Deliberately NOT in `HOWS`.
 */
export const HELD = "held" as const;
/** The query parameter the home's automatic reload carries (`r=auto`): a marked render asks nothing. */
export const AUTO_RELOAD_PARAM = "r";
/** The meta refresh's target: the same page, marked. Relative, so it keeps the path (`site/pages.ts`, pinned equal by a test). */
export const AUTO_RELOAD_URL = HOME_REFRESH_URL;
/** Whether a URL is the home's automatic reload. */
export function isAutoReload(url: string | URL | undefined): boolean {
  if (url === undefined) return false;
  try {
    return new URL(url, "http://x").searchParams.get(AUTO_RELOAD_PARAM) === "auto";
  } catch {
    return false;
  }
}
export type How = (typeof HOWS)[number];
export const isHow = (v: unknown): v is How => typeof v === "string" && (HOWS as readonly string[]).includes(v);

/** How long a background request (the island's POST) waits for it: just over the MCP side's own 1 200 ms. */
export const FUEL_REFRESH_BG_MS = 1_500;

/** A POST-capable fetch, injected by the tests (never a provider: our own MCP process, stubbed). */
export type PostLike = (url: string, init: { readonly method: "POST"; readonly signal: AbortSignal; readonly headers: Record<string, string>; readonly body: string }) => Promise<{ readonly status: number; json(): Promise<unknown> }>;

/**
 * The card's note: what the refresh did, and when its request settled (epoch
 * ms). `queue` (#712): on a `pending`, where the person's request stands in the
 * MCP process's queue — `position` 1 is next, `etaMs` about how long until it
 * is sent. The card shows it, and the page's background fill re-reads the card
 * about then, until the request settles.
 */
/** `paused` (#1221): the site door's request budget is spent; no request was made and the card is the newest prices held, said so. */
export type FuelNote = { readonly state: "refreshed" | "pending" | "paused" | "unavailable"; readonly at: number | null; readonly queue?: { readonly position: number; readonly etaMs: number }; readonly retry?: true };

/** The queue place of an answer, or undefined when it carries none we can trust. */
function queueOf(v: unknown): FuelNote["queue"] {
  if (typeof v !== "object" || v === null) return undefined;
  const { position, etaMs } = v as { position?: unknown; etaMs?: unknown };
  // The queue is uncapped (owner 2026-10-15, "No limit"): any place a page can print, any ETA under ten days.
  if (typeof position !== "number" || !Number.isInteger(position) || position < 1 || position > 99_999) return undefined;
  if (typeof etaMs !== "number" || !Number.isFinite(etaMs) || etaMs < 0 || etaMs > 864_000_000) return undefined;
  return { position, etaMs: Math.round(etaMs) };
}

/**
 * No lost requests, info as soon as possible (#712, owner 2026-10-15): a
 * pending card is re-read for as long as the page is open — there is NO
 * poll-count cap and no time limit. Each re-read is scheduled at the queue's
 * reported ETA plus the request's own time (`FUEL_FILL_MARGIN_MS`), at least
 * `FUEL_FILL_MIN_MS` and at most `FUEL_FILL_MAX_MS` apart, so a long queue
 * costs few requests (an hour's queue: about a dozen re-reads) and the head
 * is on the card about two seconds after it settles. At the head (position 1,
 * an ETA of 0, or a request running with no place) the re-read backs off
 * 2 → 4 → 8 s … up to `FUEL_FILL_HEAD_MAX_MS`, or the ETA when that is later.
 * The filler (`lib/fill.ts`) carries the same bounds as literals (its text runs
 * alone in the page; `test/fill.test.ts` holds them equal), and the motorway
 * layer's script has them interpolated from these names.
 */
export const FUEL_FILL_MIN_MS = 2_000;
/** The longest wait between two re-reads of a pending card, ms. */
export const FUEL_FILL_MAX_MS = 300_000;
/** The head's back-off ceiling: one key spacing, within which the head's own request is sent. */
export const FUEL_FILL_HEAD_MAX_MS = 60_000;
/** Our own process unreachable or answering 5xx (a restart): the re-read waits this long. */
export const FUEL_FILL_RETRY_MS = 30_000;
/**
 * `polls` only counts (a page's re-reads so far); it saturates here and limits
 * nothing. It is also the bound a request's `polls` is read inside: a larger
 * one is not a count this shell wrote, and is read as 0.
 */
export const FUEL_FILL_POLLS_SEEN = 1_000;
/**
 * The head's back-off steps (`head`): the delay is `FUEL_FILL_MIN_MS × 2^head`
 * up to `FUEL_FILL_HEAD_MAX_MS`, which it reaches at
 * `ceil(log2(60 000 / 2 000))` = 5 steps; a larger step changes no delay, so
 * `head` saturates here, and a request's `head` above it is not one this shell
 * wrote and is read as 0.
 */
export const FUEL_FILL_HEAD_STEPS = Math.ceil(Math.log2(FUEL_FILL_HEAD_MAX_MS / FUEL_FILL_MIN_MS));
/** Added to the queue's ETA: the request's own time to be sent and stored. */
export const FUEL_FILL_MARGIN_MS = 1_500;

/** A request that announces itself as a prefetch or prerender — never a person's action. */
function isPrefetch(h: { get(n: string): string | null }): boolean {
  const purpose = `${h.get("sec-purpose") ?? ""} ${h.get("purpose") ?? ""} ${h.get("x-purpose") ?? ""} ${h.get("x-moz") ?? ""}`;
  return /prefetch|prerender|preview/i.test(purpose);
}

/** The modes a page script's `fetch` is sent in (#981 review B1); never `navigate`, `no-cors` or `websocket`. */
const FETCH_MODES: ReadonlySet<string> = new Set(["cors", "same-origin"]);

export type AskingRequest = { readonly method: string; readonly headers: { get(n: string): string | null }; readonly url?: string };

/**
 * A person's own request, not a robot, a prefetch, a HEAD, a script or an
 * automatic reload. `document`: a page render (a top-level navigation, not
 * the marked reload) — since #981 C1 it decides only whether the page carries
 * the fill marker, and the render itself asks nothing; `fragment`: the
 * island's or the filler's POST from this origin's page, the one request that
 * asks. Not a security boundary — the MCP side's guards are (#981 C2's cap).
 */
export function personAsks(req: AskingRequest, kind: "document" | "fragment"): boolean {
  const h = req.headers;
  if (req.method !== "GET" && req.method !== "POST") return false;
  const ua = h.get("user-agent") ?? "";
  // #1221: a client that declares automation (Lightpanda, HeadlessChrome, …) never starts a provider request
  if (ua.trim() === "" || CRAWLER.test(ua) || isAutomationAgent(ua)) return false;
  if (isPrefetch(h)) return false;
  // #981 review B1: a fragment is a script's fetch from this origin's page — same-origin AND the shape of a fetch
  // (`Sec-Fetch-Dest: empty`, a cors or same-origin mode), so a walk replaying a navigation's headers asks nothing.
  if (kind === "fragment") return h.get("sec-fetch-site") === "same-origin" && h.get("sec-fetch-dest") === "empty" && FETCH_MODES.has(h.get("sec-fetch-mode") ?? "");
  if (h.get("sec-fetch-mode") !== "navigate" || h.get("sec-fetch-dest") !== "document") return false;
  return !isAutoReload(req.url);
}

/** The island's fragment request: a person on this origin's page AND one of the known ways a place was obtained (never `held`). */
export function fragmentAsks(req: AskingRequest, how: unknown): boolean {
  return isHow(how) && personAsks(req, "fragment");
}

/**
 * Ask the MCP process to refresh the prices around `at`. Null when no refresh
 * is configured (no FUEL_REFRESH_URL — a laptop), when the key is not one, or
 * when the answer is not recognisably ours. A deadline that passes is
 * `pending`: the request runs on in the MCP process and stores its rows.
 */
export async function askRefresh(at: string, o: { readonly url: string | undefined; readonly timeoutMs: number; readonly fetchImpl?: PostLike; readonly snap?: boolean; readonly anchor?: boolean }): Promise<FuelNote | null> {
  if (o.url === undefined) return null;
  const fetchImpl: PostLike = o.fetchImpl ?? ((u, init) => fetch(u, init));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), o.timeoutMs);
  try {
    const res = await fetchImpl(`${o.url}/internal/fuel/refresh`, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", accept: "application/json" },
      // `snap`: the page answers this point as its Gemeinde, so the refresh is asked around the same centroid (#564 review).
      // `anchor` (#775 W3): the point is a motorway page's public anchor, and a wide refresh is sent about it as it is.
      body: JSON.stringify(o.snap === true ? { at, snap: true } : o.anchor === true ? { at, anchor: true } : { at }),
    });
    // #712, no lost requests: our own process answering with an error (a restart, a failed read) is NOT the
    // provider's verdict — the card stays pending and the next re-read asks again. 400: not a key at all.
    if (res.status !== 200) return res.status === 400 ? null : { state: "pending", at: null, retry: true };
    const v = (await res.json()) as { state?: unknown; settledAt?: unknown; queue?: unknown };
    const at2 = typeof v.settledAt === "number" && Number.isFinite(v.settledAt) ? Math.round(v.settledAt) : null;
    switch (v.state) {
      case "refreshed":
        return { state: "refreshed", at: at2 };
      case "pending": {
        const q = queueOf(v.queue);
        return q === undefined ? { state: "pending", at: null } : { state: "pending", at: null, queue: q };
      }
      case "none_due":
        // Every nearby price is inside the cache window (#712, 30 min): nothing to say, nothing to re-read.
        return null;
      case "refused":
        // No key or an off switch, answered to a (re-)submit the queue did not already hold, the area not covered:
        // final. Since #712 the key's spacing never refuses (it queues).
        return { state: "unavailable", at: null };
      case "failed":
        // The provider's error after the queue's one retry at the head: final.
        return { state: "unavailable", at: null };
      case "paused":
        // #1221 (owner 2026-11-08: "if the limit is over we must show the last available data"): the door's request
        // budget is spent, no request was made; final — the card is the held prices with their times, said so.
        return { state: "paused", at: null };
      default:
        return null;
    }
  } catch (err) {
    // A deadline that passed, or our MCP process unreachable (a restart): still pending, never "unavailable" —
    // the next re-read submits again (#712, no lost requests).
    return err instanceof Error && err.name === "AbortError" ? { state: "pending", at: null } : { state: "pending", at: null, retry: true };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * A request's `polls` or `head` counter, read inside its bound (`max`): a whole
 * number from 0 to `max`, anything else 0 — not a count this shell wrote.
 */
export function fillCounter(v: unknown, max: number): number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max ? v : 0;
}

/**
 * THE FILL RULE (#712, the queue): what the cards are wrapped to be filled
 * with next, or null when nothing will fill them again.
 *
 * A pending refresh — the request runs, or waits its turn in the MCP queue —
 * is re-read by `fill` about when the queue said it is sent (its ETA and a
 * margin, clamped to `FUEL_FILL_MIN_MS`…`FUEL_FILL_MAX_MS`), and again for as
 * long as it is still pending — for as long as the page is open, with no cap
 * (owner 2026-10-15: no lost requests). Only the MCP process's own verdict
 * ends it: `refreshed`, or `failed`/`refused` (said "unavailable"). Every
 * `fill` asks the refresh again: an entry the MCP process still holds is
 * joined (its waiters, no second request), and one a restart lost is
 * submitted again.
 */
export function fillOf(fuel: FuelNote | null, how: unknown, polls = 0, head = 0): { readonly how: "fill"; readonly delayMs?: number; readonly polls: number; readonly head: number } | null {
  if (fuel === null || fuel.state !== "pending") return null;
  const next = how === "fill" ? Math.min(polls + 1, FUEL_FILL_POLLS_SEEN) : 1;
  // Our own process did not answer: no ETA to go by, a slow retry (the next fill submits again).
  if (fuel.retry === true) return { how: "fill", delayMs: FUEL_FILL_RETRY_MS, polls: next, head: 0 };
  const eta = fuel.queue?.etaMs;
  // The first fill of a render with no queue place re-reads at once (the request runs; the filler waits on it).
  if (eta === undefined && how !== "fill") return { how: "fill", polls: next, head: 1 };
  const atEta = (eta ?? 0) + FUEL_FILL_MARGIN_MS;
  const atHead = fuel.queue === undefined || fuel.queue.position <= 1 || (eta ?? 0) <= 0;
  if (!atHead) return { how: "fill", delayMs: Math.min(FUEL_FILL_MAX_MS, Math.max(FUEL_FILL_MIN_MS, atEta)), polls: next, head: 0 };
  // The head: 2 → 4 → 8 s … while it is still pending, never before its ETA.
  const h = how === "fill" ? Math.min(Math.max(0, head), FUEL_FILL_HEAD_STEPS) : 0;
  const backoff = Math.min(FUEL_FILL_HEAD_MAX_MS, FUEL_FILL_MIN_MS * 2 ** h);
  return { how: "fill", delayMs: Math.min(FUEL_FILL_MAX_MS, Math.max(FUEL_FILL_MIN_MS, atEta, backoff)), polls: next, head: Math.min(h + 1, FUEL_FILL_HEAD_STEPS) };
}

/** The digest's query parameters for a note: `&fuel=…` and, after a stored refresh, `&fuelAt=…`. */
export function fuelQuery(n: FuelNote | null): string {
  if (n === null) return "";
  const q = n.state === "pending" && n.queue !== undefined ? `&fuelPos=${String(n.queue.position)}&fuelEta=${String(Math.ceil(n.queue.etaMs / 1000))}` : "";
  return `&fuel=${n.state}${n.state === "refreshed" && n.at !== null ? `&fuelAt=${String(n.at)}` : ""}${q}`;
}
