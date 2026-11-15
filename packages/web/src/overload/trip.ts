/**
 * #1205: the overload challenge trips PER CLIENT. Until 2.6.15 the challenge was global: while the digest said its
 * person pool was saturated, EVERY database page asked without a pass got the interim page (a 503), so four parallel
 * reads of one client (measured 2026-11-12: 1 303 of 1 327 answers) put the challenge in front of every visitor at
 * once, and nothing logged it.
 *
 * Now, while the pool is saturated, each client's database pages are counted in a short window (`TRIP_WINDOW_MS`),
 * and only a client past `TRIP_LIMIT` of them is challenged; every other client is served as always. A verified search
 * engine or AI assistant (the request's class `search`, `verified-class.ts`) is never counted and never refused (owner
 * 2026-11-12). A client that holds a pass is served too, as before.
 *
 * The client's key is its address as the edge handed it on (`location/client-ip.ts`) — an IPv6 address by its /64,
 * the unit a single subscriber is handed, so rotating within it buys no new share — reduced at once to a keyed hash
 * under a key this process draws at start and never writes anywhere: the address itself is not kept, and neither the
 * key nor a hash leaves memory. A request that carries no readable address shares one key (`NO_ADDRESS`). Nothing is
 * counted while the pool is not saturated (P2), and the first request after the overload forgets every key (`idle`).
 * The count is per web process: with N replicas a client is served about N × `TRIP_LIMIT` pages a window.
 *
 * Refusals are counted by CLASS — `person`, `crawler` or `seo`, with the crawler's family where the User-Agent names
 * one of our closed lists (`refusalLabel`) — never by address, key or User-Agent, and no line is written per request
 * (#1184 P5: no per-request verdict in any log). Once an hour, on a timer of its own, the counts are one info line
 * each (`overload_trip`, P9's hourly aggregate), which the hourly check reads; an hour with nothing counted writes
 * nothing.
 */
import { createHmac, randomBytes } from "node:crypto";
import { isIP } from "node:net";
import type { AgentClass } from "../lib/agent-class.js";
import { logLine } from "../lib/log.js";
import { ROBOTS_CRAWLERS } from "../site/crawlers.js";
import { claimedFamily } from "./crawler-verify.js";

/** How long one client's count runs. */
export const TRIP_WINDOW_MS = 10_000;
/**
 * The database pages one client is served in a window while the pool is saturated; the next one is challenged. A
 * person reading a page every few seconds stays under it; the crawlers nginx paces (20 detail pages a minute) too.
 * Per web process: N replicas serve a client about N times this.
 */
export const TRIP_LIMIT = 4;
/** The most clients counted at once; past it the oldest count is dropped. */
export const TRIP_MAX_CLIENTS = 20_000;
/** The one key of every request without a readable address. */
export const NO_ADDRESS = "-";
/** How often the counts are written: hourly aggregates only (#1184 P9). */
export const TRIP_FLUSH_MS = 3_600_000;

/** What the gate did with a database page while the pool was saturated. */
export type TripOutcome = "exempt_verified" | "pass" | "served" | "refused";

export type TripCounters = {
  readonly exemptVerified: number;
  readonly pass: number;
  readonly served: number;
  readonly refused: ReadonlyMap<string, number>;
  readonly tripped: number;
  readonly clients: number;
};

export type ClientTrip = {
  /** Count one database page of this client; true when it is past the limit and must be challenged. */
  readonly over: (ip: string | null) => boolean;
  /** The overload is over: forget every key. */
  readonly idle: () => void;
  /** Count one outcome (a refusal under its label). */
  readonly count: (outcome: TripOutcome, label?: string) => void;
  readonly counters: () => TripCounters;
};

/** The class and family of a refused request — the only thing a refusal's log line carries. */
export function refusalLabel(cls: AgentClass | null, ua: string | null): string {
  const base = cls ?? "person";
  if (cls === null || ua === null) return base;
  const fam = claimedFamily(ua)?.name ?? ROBOTS_CRAWLERS.find((t) => ua.toLowerCase().includes(t.toLowerCase()))?.toLowerCase();
  return fam === undefined ? base : `${base}:${fam}`;
}

/**
 * The part of an address that names one client: an IPv4 address whole (an IPv4-mapped IPv6 one too), an IPv6 one by
 * its first 64 bits. Anything else is returned as it came (the caller's `clientIp` admits addresses only).
 */
export function clientPart(ip: string): string {
  if (isIP(ip) !== 6) return ip;
  const mapped = /^(?:0{0,4}:){0,5}(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/i.exec(ip.replace(/^::/, ""));
  if (mapped !== null && isIP(mapped[1]!) === 4) return mapped[1]!;
  const [head = "", tail = ""] = ip.toLowerCase().split("::");
  const h = head === "" ? [] : head.split(":");
  const t = ip.includes("::") ? (tail === "" ? [] : tail.split(":")) : [];
  const groups = ip.includes("::") ? [...h, ...Array<string>(8 - h.length - t.length).fill("0"), ...t] : h;
  return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, "")).join(":")}::/64`;
}

export type Every = (fn: () => void, ms: number) => void;
/** The hourly writer's timer: unref'd, so it never holds the process open. */
const EVERY: Every = (fn, ms) => {
  setInterval(fn, ms).unref();
};

export function createClientTrip(
  o: { readonly now?: () => number; readonly limit?: number; readonly windowMs?: number; readonly maxClients?: number; readonly secret?: Buffer; readonly every?: Every } = {},
): ClientTrip {
  const now = o.now ?? (() => Date.now());
  const limit = o.limit ?? TRIP_LIMIT;
  const windowMs = o.windowMs ?? TRIP_WINDOW_MS;
  const maxClients = o.maxClients ?? TRIP_MAX_CLIENTS;
  const secret = o.secret ?? randomBytes(32);
  const seen = new Map<string, { from: number; n: number }>();
  let exemptVerified = 0;
  let pass = 0;
  let served = 0;
  let tripped = 0;
  const refused = new Map<string, number>();

  const keyOf = (ip: string | null): string => (ip === null ? NO_ADDRESS : createHmac("sha256", secret).update(clientPart(ip)).digest("base64url").slice(0, 22));

  // steward T4 (P10): no expired count is held — swept on every new window and on the hourly timer, not only when the
  // map is full. The map is in window-start order (a renewed count is re-inserted), so the expired ones lead it and
  // the sweep stops at the first live one
  const sweep = (t: number): void => {
    for (const [ok, v] of seen) {
      if (t - v.from < windowMs) break;
      seen.delete(ok);
    }
  };

  const flush = (): void => {
    sweep(now());
    const lines: [string, number][] = [["exempt_verified", exemptVerified], ["pass", pass], ["served", served], ["tripped", tripped], ...[...refused].map(([k, n]): [string, number] => [`refused:${k}`, n])];
    for (const [k, n] of lines) if (n > 0) logLine(30, { kind: "overload_trip", key: k, count: n }, "overload challenge outcomes over the last hour");
    exemptVerified = pass = served = tripped = 0;
    refused.clear();
  };
  (o.every ?? EVERY)(flush, TRIP_FLUSH_MS);

  return {
    over: (ip) => {
      const k = keyOf(ip);
      const t = now();
      let e = seen.get(k);
      if (e === undefined || t - e.from >= windowMs) {
        if (e !== undefined) seen.delete(k);
        sweep(t);
        if (seen.size >= maxClients) seen.delete(seen.keys().next().value as string);
        e = { from: t, n: 0 };
        seen.set(k, e);
      }
      e.n += 1;
      if (e.n === limit + 1) tripped += 1;
      return e.n > limit;
    },
    idle: () => {
      if (seen.size > 0) seen.clear();
    },
    count: (outcome, label) => {
      if (outcome === "exempt_verified") exemptVerified += 1;
      else if (outcome === "pass") pass += 1;
      else if (outcome === "served") served += 1;
      else {
        const l = label ?? "person";
        refused.set(l, (refused.get(l) ?? 0) + 1);
      }
    },
    counters: () => ({ exemptVerified, pass, served, refused: new Map(refused), tripped, clients: seen.size }),
  };
}
