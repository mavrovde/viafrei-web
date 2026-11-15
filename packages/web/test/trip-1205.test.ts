/**
 * #1205: the overload challenge trips PER CLIENT (`src/overload/trip.ts`). While the digest's person pool is
 * saturated, the client past its share is the one answered the interim page; a second client and a verified search
 * engine or AI assistant are served. Each refusal is counted by class and written in the hourly aggregate (#1184 P5,
 * P9: no line per request), and no line carries an address, a key or a User-Agent. Fixtures only: no DNS query, no range fetch, no provider call.
 */
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { overloadGate, type OverloadDeps } from "../src/overload/challenge.js";
import { createCrawlerVerifier, type RangeFetch, type Resolver } from "../src/overload/crawler-verify.js";
import { createPassBook } from "../src/overload/pass.js";
import { clientPart, createClientTrip, NO_ADDRESS, refusalLabel, TRIP_FLUSH_MS, TRIP_LIMIT, TRIP_WINDOW_MS, type ClientTrip, type Every } from "../src/overload/trip.js";
import { clientIp } from "../src/location/client-ip.js";
import { setLogSink } from "../src/lib/log.js";
import { VERIFIED_BOT_HEADER } from "../src/overload/verified-class.js";

const BROWSER = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const CLAUDEBOT = "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)";
const SEMRUSH = "Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)";
const EXA = "Mozilla/5.0 (compatible; ExaSearchBot/1.0)";
const IP_A = "198.51.100.23";
const IP_B = "198.51.100.77";
const IP_V6 = "2001:db8::4f2a";

const nf = (): Error => Object.assign(new Error("not found"), { code: "ENOTFOUND" });
const nobody: Resolver = { reverse: () => Promise.reject(nf()), lookup: () => Promise.reject(nf()) };
const noRanges: RangeFetch = () => Promise.reject(new Error("no network in a test"));

function deps(o: { saturated?: { v: boolean }; trip?: ClientTrip } = {}): OverloadDeps & { trip: ClientTrip } {
  const sat = o.saturated ?? { v: true };
  return {
    pressure: { saturated: () => Promise.resolve(sat.v) },
    passes: createPassBook(),
    crawlers: createCrawlerVerifier({ resolver: nobody, fetchRanges: noRanges }),
    clientIp,
    trip: o.trip ?? createClientTrip(),
  };
}
const ask = (d: OverloadDeps, h: Record<string, string>, path = "/de/place/koeln"): Promise<Response | null> => {
  const u = new URL(`http://shell${path}`);
  return overloadGate(new Request(u, { headers: h }), u, "n", d);
};
/** A timer the test fires itself: `fire()` is the hour ending; `ms` is what the trip asked for. */
function hourly(): { every: Every; fire: () => void; ms: () => number } {
  let fn = (): void => undefined;
  let ms = 0;
  return { every: (f, m) => ((fn = f), (ms = m)), fire: () => fn(), ms: () => ms };
}
const status = async (d: OverloadDeps, h: Record<string, string>, path?: string): Promise<number> => (await ask(d, h, path))?.status ?? 200;

/** Every line the gate writes while `fn` runs. */
async function captured(fn: () => Promise<void>): Promise<string[]> {
  const lines: string[] = [];
  const restore = setLogSink((l) => lines.push(l));
  try {
    await fn();
  } finally {
    restore();
  }
  return lines;
}

describe("#1205: a saturating client is the one refused", () => {
  it("client A past its share is challenged; client B and a verified engine and assistant are served", async () => {
    const d = deps();
    const a = { "user-agent": BROWSER, "x-forwarded-for": IP_A };
    for (let i = 0; i < TRIP_LIMIT; i++) expect(await status(d, a), `A's page ${i + 1}`).toBe(200);
    expect(await status(d, a), "A past its share").toBe(503);
    expect(await status(d, a, "/en/station/koeln-hbf")).toBe(503);
    // a second client with the SAME User-Agent (the key is the address, not the agent)
    expect(await status(d, { "user-agent": BROWSER, "x-forwarded-for": IP_B }), "client B").toBe(200);
    // a verified Google crawler (nginx's range check) and a verified AI assistant (the edge's marker), each from A's
    // address and far past the share: never refused
    for (let i = 0; i < 3 * TRIP_LIMIT; i++) {
      expect(await status(d, { "user-agent": GOOGLEBOT, "x-forwarded-for": IP_A, "x-vf-agent-class": "search" }), "verified Googlebot").toBe(200);
      expect(await status(d, { "user-agent": CLAUDEBOT, "x-forwarded-for": IP_A, "x-vf-agent-class": "crawler", [VERIFIED_BOT_HEADER]: "1" }), "verified ClaudeBot").toBe(200);
    }
    // and the class the middleware decided is honoured as given
    for (let i = 0; i < 3 * TRIP_LIMIT; i++) {
      const u = new URL("http://shell/de/place/koeln");
      expect(await overloadGate(new Request(u, { headers: a }), u, "n", d, "search"), "class search").toBeNull();
    }
    expect(await status(d, a), "A is still past its share").toBe(503);
  });

  it("an unproven engine or assistant claim is counted like anybody — the exemption is the proof, not the name", async () => {
    const d = deps();
    const spoofG = { "user-agent": GOOGLEBOT, "x-forwarded-for": IP_A, "x-vf-agent-class": "crawler" };
    for (let i = 0; i < TRIP_LIMIT; i++) expect(await status(d, spoofG)).toBe(200);
    expect(await status(d, spoofG), "a Googlebot claim outside Google's ranges").toBe(503);
    const spoofC = { "user-agent": CLAUDEBOT, "x-forwarded-for": IP_B, "x-vf-agent-class": "crawler", [VERIFIED_BOT_HEADER]: "0" };
    for (let i = 0; i < TRIP_LIMIT; i++) expect(await status(d, spoofC)).toBe(200);
    expect(await status(d, spoofC), "a ClaudeBot claim without the marker").toBe(503);
  });

  it("an SEO tool the edge vouches for is no search engine: past its share it is refused", async () => {
    const d = deps();
    const semrush = { "user-agent": SEMRUSH, "x-forwarded-for": IP_A, "x-vf-agent-class": "seo", [VERIFIED_BOT_HEADER]: "1" };
    for (let i = 0; i < TRIP_LIMIT; i++) expect(await status(d, semrush)).toBe(200);
    expect(await status(d, semrush)).toBe(503);
  });

  it("the share runs in a window: after it, the client starts again", async () => {
    let t = 1_000_000;
    const d = deps({ trip: createClientTrip({ now: () => t }) });
    const a = { "user-agent": BROWSER, "x-forwarded-for": IP_A };
    for (let i = 0; i < TRIP_LIMIT; i++) await ask(d, a);
    expect(await status(d, a)).toBe(503);
    t += TRIP_WINDOW_MS - 1;
    expect(await status(d, a), "inside the window").toBe(503);
    t += 1;
    expect(await status(d, a), "a new window").toBe(200);
  });

  it("not saturated: nothing is counted, and the first quiet request forgets every client (P2)", async () => {
    const sat = { v: true };
    const trip = createClientTrip();
    const d = deps({ saturated: sat, trip });
    const a = { "user-agent": BROWSER, "x-forwarded-for": IP_A };
    for (let i = 0; i <= TRIP_LIMIT; i++) await ask(d, a);
    expect(await status(d, a)).toBe(503);
    expect(trip.counters().clients).toBe(1);
    sat.v = false;
    for (let i = 0; i < 3 * TRIP_LIMIT; i++) expect(await status(d, a)).toBe(200);
    expect(trip.counters().clients, "no key survives the overload").toBe(0);
    sat.v = true;
    expect(await status(d, a), "a new overload starts the count again").toBe(200);
  });

  it("the clients counted are bounded; the oldest count is dropped first", () => {
    const trip = createClientTrip({ maxClients: 3, limit: 1 });
    expect(trip.over("192.0.2.1")).toBe(false);
    expect(trip.over("192.0.2.1")).toBe(true);
    for (const ip of ["192.0.2.2", "192.0.2.3", "192.0.2.4"]) trip.over(ip);
    expect(trip.counters().clients).toBe(3);
    expect(trip.over("192.0.2.1"), "the oldest was dropped and starts again").toBe(false);
  });

  it("eviction stops at the first live count: expired ones go, live ones keep theirs", () => {
    let t = 0;
    const trip = createClientTrip({ maxClients: 3, limit: 1, now: () => t });
    trip.over("192.0.2.1");
    t += TRIP_WINDOW_MS;
    trip.over("192.0.2.2");
    expect(trip.over("192.0.2.2")).toBe(true);
    trip.over("192.0.2.3");
    // full: .1 expired and is dropped; .2 and .3 are live and keep their counts
    trip.over("192.0.2.4");
    expect(trip.counters().clients).toBe(3);
    expect(trip.over("192.0.2.2"), ".2 kept its count").toBe(true);
    expect(trip.over("192.0.2.3"), ".3 kept its count").toBe(true);
  });

  it("steward T4: an expired count is not held until the map fills — any other client's next window sweeps it", () => {
    let t = 0;
    const trip = createClientTrip({ now: () => t });
    trip.over("192.0.2.1");
    trip.over("192.0.2.2");
    expect(trip.counters().clients).toBe(2);
    t += TRIP_WINDOW_MS;
    trip.over("192.0.2.3");
    expect(trip.counters().clients, "only the new client is held").toBe(1);
  });

  it("steward T4: a process that goes quiet after an overload drops its expired counts on the hourly timer", () => {
    let t = 0;
    const h = hourly();
    const trip = createClientTrip({ now: () => t, every: h.every });
    trip.over("192.0.2.1");
    h.fire();
    expect(trip.counters().clients, "a live count is kept").toBe(1);
    t += TRIP_WINDOW_MS;
    h.fire();
    expect(trip.counters().clients, "the expired one is gone with no request").toBe(0);
  });

  it("a request with no readable address shares one key; IPv6 is keyed by its /64, IPv4-mapped by its IPv4", () => {
    const trip = createClientTrip({ limit: 1 });
    expect(trip.over(null)).toBe(false);
    expect(trip.over(null)).toBe(true);
    expect(trip.over(IP_V6)).toBe(false);
    expect(trip.over("2001:db8:0:0:ffff::1"), "the same /64").toBe(true);
    expect(trip.over("2001:db8:0:1::1"), "another /64").toBe(false);
    expect(trip.over("::ffff:192.0.2.9")).toBe(false);
    expect(trip.over("192.0.2.9"), "the mapped address is the IPv4 client").toBe(true);
    expect(NO_ADDRESS).toBe("-");
    expect(clientPart("2001:0db8:0000:0000:0001:0002:0003:0004")).toBe("2001:db8:0:0::/64");
    expect(clientPart("2001:db8::4f2a")).toBe("2001:db8:0:0::/64");
    expect(clientPart("::1")).toBe("0:0:0:0::/64");
    expect(clientPart("fe80::")).toBe("fe80:0:0:0::/64");
    expect(clientPart(IP_A)).toBe(IP_A);
  });
});

describe("#1205: every refusal is counted by class and written hourly, never by address", () => {
  it("the counters move: served, refused by label, exempt, pass and the trips", async () => {
    const d = deps();
    const a = { "user-agent": BROWSER, "x-forwarded-for": IP_A };
    for (let i = 0; i < TRIP_LIMIT + 2; i++) await ask(d, a);
    const exa = { "user-agent": EXA, "x-forwarded-for": IP_B, "x-vf-agent-class": "crawler" };
    for (let i = 0; i < TRIP_LIMIT + 1; i++) await ask(d, exa);
    const meta = { "user-agent": "meta-externalagent/1.1", "x-forwarded-for": "198.51.100.90", "x-vf-agent-class": "crawler" };
    for (let i = 0; i < TRIP_LIMIT + 1; i++) await ask(d, meta);
    await ask(d, { "user-agent": GOOGLEBOT, "x-forwarded-for": IP_A, "x-vf-agent-class": "search" });
    const c = d.trip.counters();
    expect(c.served).toBe(3 * TRIP_LIMIT);
    expect(Object.fromEntries(c.refused)).toEqual({ person: 2, crawler: 1, "crawler:meta": 1 });
    expect(c.exemptVerified).toBe(1);
    expect(c.tripped).toBe(3);
    expect(c.pass).toBe(0);
  });

  it("no line per request; once an hour the counts are info lines, and an hour with nothing writes nothing", async () => {
    const h = hourly();
    const d = deps({ trip: createClientTrip({ every: h.every }) });
    expect(h.ms()).toBe(TRIP_FLUSH_MS);
    expect(TRIP_FLUSH_MS).toBe(3_600_000);
    const semrush = { "user-agent": SEMRUSH, "x-forwarded-for": IP_A, "x-vf-agent-class": "seo" };
    const during = await captured(async () => {
      for (let i = 0; i < TRIP_LIMIT + 2; i++) await ask(d, semrush);
      await ask(d, { "user-agent": GOOGLEBOT, "x-forwarded-for": IP_B, "x-vf-agent-class": "search" });
    });
    expect(during, "P5: nothing is written per request").toEqual([]);
    const lines = await captured(() => Promise.resolve(h.fire()));
    const parsed = lines.map((l) => JSON.parse(l) as { level: number; kind: string; key: string; count?: number });
    expect(parsed.every((p) => p.level === 30 && p.kind === "overload_trip")).toBe(true);
    expect(Object.fromEntries(parsed.map((p) => [p.key, p.count]))).toEqual({ served: TRIP_LIMIT, tripped: 1, exempt_verified: 1, "refused:seo:semrushbot": 2 });
    // the counts start again, and an hour with nothing counted writes nothing
    expect(d.trip.counters().served).toBe(0);
    expect(await captured(() => Promise.resolve(h.fire()))).toEqual([]);
  });

  it("no line carries an address, the client's key or its User-Agent", async () => {
    const secret = Buffer.alloc(32, 7);
    const h = hourly();
    const d = deps({ trip: createClientTrip({ secret, every: h.every }) });
    const lines = await captured(async () => {
      for (const ip of [IP_A, IP_V6, `${IP_B}, 10.0.0.1`]) {
        for (const ua of [BROWSER, EXA, SEMRUSH, "curl/8.0"]) {
          for (let i = 0; i < TRIP_LIMIT + 2; i++) await ask(d, { "user-agent": ua, "x-forwarded-for": ip, "x-vf-agent-class": ua === SEMRUSH ? "seo" : "crawler" });
          h.fire();
        }
      }
    });
    expect(lines.length).toBeGreaterThan(10);
    const text = lines.join("");
    const keyOf = (ip: string): string => createHmac("sha256", secret).update(clientPart(ip)).digest("base64url").slice(0, 22);
    const needles = [IP_A, IP_B, IP_V6, "2001:db8", "198.51.100", "10.0.0.1", "Mozilla", "ExaSearchBot", "curl/8.0", "SemrushBot/7", secret.toString("hex"), secret.toString("base64url"), keyOf(IP_A), keyOf(IP_B), keyOf(IP_V6)];
    for (const needle of needles) expect(text, needle).not.toContain(needle);
    for (const l of lines) for (const k of Object.keys(JSON.parse(l) as object)) expect(["level", "time", "kind", "key", "count", "msg"]).toContain(k);
  });

  it("the label is the class and, from our closed lists only, the family", () => {
    expect(refusalLabel(null, BROWSER)).toBe("person");
    expect(refusalLabel(null, "Mozilla/5.0 (compatible; Googlebot/2.1)"), "a person by its class, whatever it writes").toBe("person");
    expect(refusalLabel("crawler", EXA)).toBe("crawler");
    expect(refusalLabel("crawler", "meta-externalagent/1.1")).toBe("crawler:meta");
    expect(refusalLabel("crawler", GOOGLEBOT)).toBe("crawler:google");
    // #1306: GPTBot is a family of its own, proved by gptbot.json alone
    expect(refusalLabel("crawler", "Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)")).toBe("crawler:openai-gptbot");
    expect(refusalLabel("seo", SEMRUSH)).toBe("seo:semrushbot");
    expect(refusalLabel("crawler", null)).toBe("crawler");
  });
});
