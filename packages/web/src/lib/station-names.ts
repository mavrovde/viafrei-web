/**
 * 2.4.6: the station list this shell holds — every station page's slug and name, from the digest's
 * `/internal/station/list` (the sitemap's source), re-asked at most every `STATION_NAMES_TTL_MS` and never on a
 * page's request path (the ask is started by a request and answered to the next one). A station page whose static
 * fragment is slow is named from it and rendered in its loading state rather than answered 503; a slug the list does
 * not hold is not a station page this shell can vouch for, so that answer stays the digest's to give.
 */
import { STATION_LIST_TIMEOUT_MS, fetchStationList, type StationFetchOptions } from "./station.js";

export const STATION_NAMES_TTL_MS = 10 * 60_000;

let held: ReadonlyMap<string, string> | null = null;
let at = 0;
let asking: Promise<void> | null = null;
let tried = Number.NEGATIVE_INFINITY;

/** A failed ask is repeated after this long, not on every page. */
export const STATION_NAMES_RETRY_MS = 60_000;

/** The held name of a station page, null for a slug the held list does not name, undefined while no list is held. */
export function heldStationName(slug: string): string | null | undefined {
  if (held === null) return undefined;
  return held.get(slug) ?? null;
}

/** Starts one ask of the list when none is held or it is older than the TTL; never awaited by a page. */
export function primeStationNames(o: Pick<StationFetchOptions, "baseUrl" | "fetchImpl">, now: number = Date.now()): Promise<void> {
  if (asking !== null) return asking;
  if (held !== null && now - at < STATION_NAMES_TTL_MS) return Promise.resolve();
  if (now - tried < STATION_NAMES_RETRY_MS) return Promise.resolve();
  asking = fetchStationList({ ...o, timeoutMs: STATION_LIST_TIMEOUT_MS })
    .then((list) => {
      // a failed ask keeps the list held before it, and is not repeated for a minute
      if (list === null || list.length === 0) {
        tried = now;
        return;
      }
      held = new Map(list.flatMap((e) => (e.name === undefined ? [] : [[e.slug, e.name] as const])));
      at = now;
    })
    .catch(() => undefined)
    .finally(() => {
      asking = null;
    });
  return asking;
}

/** Forget the held list (tests). */
export function clearStationNames(): void {
  held = null;
  at = 0;
  asking = null;
  tried = Number.NEGATIVE_INFINITY;
}

let keeping: ReturnType<typeof setInterval> | null = null;

/**
 * #1205 (Cloudflare 2026-11-11 19:21–20:21 UTC, 37 % 503s, the hot Hbf pages first): the list asked from this
 * process's FIRST request of any kind, and re-asked on a timer, never only by a station page. Before, a fresh web
 * replica (ten of them on k3s, each scaled or restarted) held no list until a station page had asked once and the
 * answer had come back; until then every station page whose static fragment missed its deadline was a 503 — the hot
 * stations first, because they were asked first. Idempotent; the timer keeps no process alive.
 */
export function keepStationNames(o: Pick<StationFetchOptions, "baseUrl" | "fetchImpl">): void {
  if (keeping !== null) return;
  void primeStationNames(o);
  keeping = setInterval(() => void primeStationNames(o), STATION_NAMES_RETRY_MS);
  keeping.unref();
}

/** Stop the timer of `keepStationNames` (tests). */
export function stopKeepingStationNames(): void {
  if (keeping !== null) clearInterval(keeping);
  keeping = null;
}
