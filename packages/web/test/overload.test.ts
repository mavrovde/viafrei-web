/**
 * #1184 phase 2: the overload challenge and the crawler check, against the data-steward ruling of 2026-11-04
 * (P1–P12). Fixtures only: the resolver and the range files are stubs, no DNS query and no provider call is made.
 */
import { createHash, webcrypto } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { all, first, text as textOf } from "@viafrei/design/testing";
import { challengePage, DB_PAGE, GUARD_S, overloadGate, PASS_ROUTE, passRoute, solvePass, type OverloadDeps } from "../src/overload/challenge.js";
import { CHALLENGE_COPY } from "../src/overload/copy.js";
import { claimedFamily, createCrawlerVerifier, CRAWLER_FAMILIES, UNKNOWN_TTL_MS, UNVERIFIED_TTL_MS, VERDICT_MAX, VERIFIED_TTL_MS, type RangeFetch, type Resolver } from "../src/overload/crawler-verify.js";
import { createPassBook, leadingZeroBits, PASS_COOKIE, PASS_COOKIE_ATTRIBUTES, PASS_MAX_AGE_S, PASS_MAX_USES, POW_BITS, PASS_KEY_HEX, passKeyFrom, passOf } from "../src/overload/pass.js";
import { createPressure } from "../src/overload/pressure.js";
import { createClientTrip, TRIP_LIMIT, TRIP_MAX_CLIENTS, TRIP_WINDOW_MS } from "../src/overload/trip.js";
import { clientIp } from "../src/location/client-ip.js";
import { LIVE_LANGS, pathFor } from "../src/site/pages.js";
import { DEGRADED_HEADER, DEGRADED_REFRESH_MAX_S, DEGRADED_WAIT_PARAM, degradedPage, degradedRefreshS, notAPerson, unavailableAnswer } from "../src/lib/degraded.js";
import { clearHeldSitemaps, sitemapAnswer } from "../src/lib/sitemap-held.js";
import { withAgentClass } from "../src/lib/agent-class.js";
import { requestAgentClass, VERIFIED_BOT_HEADER } from "../src/overload/verified-class.js";
import { pinnedPath } from "./pinned-source.js";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const read = (rel: string): string => readFileSync(join(REPO, pinnedPath(rel)), "utf8");
const walk = (dir: string, out: string[] = []): string[] => {
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e === "dist" || e === "build" || e === "generated" || e.startsWith(".")) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};

const BROWSER = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const GOOGLE_IP = "66.249.66.1";
const SPOOF_IP = "203.0.113.7";

/** The Google range fixture: one /27 holding GOOGLE_IP. */
const rangesFixture: RangeFetch = (url) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({ prefixes: url.includes("common-crawlers.json") ? [{ ipv4Prefix: "66.249.66.0/27" }] : [] }) });
const noRanges: RangeFetch = () => Promise.reject(new Error("no network in a test"));
/** A resolver stub that counts every lookup and knows nothing (ENOTFOUND). */
function countingResolver(answers: Record<string, string[]> = {}) {
  const calls: string[] = [];
  const nf = (): Error => Object.assign(new Error("not found"), { code: "ENOTFOUND" });
  const r: Resolver = {
    reverse: (ip) => (calls.push(`ptr ${ip}`), answers[ip] ? Promise.resolve(answers[ip]) : Promise.reject(nf())),
    lookup: (name) => (calls.push(`a ${name}`), answers[name] ? Promise.resolve(answers[name]) : Promise.reject(nf())),
  };
  return { r, calls };
}

/**
 * #1205: these cases are about the interim page and who is exempt from it, so every client here is already past its
 * share of the saturated pool (`limit: 0`); the share itself is `test/trip-1205.test.ts`'s.
 */
function deps(o: { saturated: boolean; resolver?: Resolver; ranges?: RangeFetch; now?: () => number }): OverloadDeps & { pressureAsks: number } {
  const s = { pressureAsks: 0 };
  return Object.assign(s, {
    pressure: { saturated: () => (s.pressureAsks++, Promise.resolve(o.saturated)) },
    passes: createPassBook(o.now ? { now: o.now } : {}),
    crawlers: createCrawlerVerifier({ resolver: o.resolver ?? countingResolver().r, fetchRanges: o.ranges ?? rangesFixture }),
    clientIp,
    trip: createClientTrip({ limit: 0 }),
  });
}
const page = (headers: Record<string, string>, path = "/de/place/koeln"): [Request, URL] => {
  const u = new URL(`http://shell${path}`);
  return [new Request(u, { headers }), u];
};

/** Solve a challenge the way the page's script does, in Node. */
function solve(c: string): number {
  for (let n = 0; ; n++) if (leadingZeroBits(createHash("sha256").update(`${c}.${n}`).digest(), POW_BITS)) return n;
}

/** A nonce that is verifiably NOT a proof for `c` — never assumed: n + 1 is a
 *  valid proof once in 2^POW_BITS (1 in 4096) challenges, and the case below
 *  then spent the challenge on it and went red (2.5.18 full round). */
function wrongNonce(c: string, from: number): number {
  for (let n = from; ; n++) if (!leadingZeroBits(createHash("sha256").update(`${c}.${n}`).digest(), POW_BITS)) return n;
}

describe("AC: the interim page under load, and never without it (P2)", () => {
  it("a script-less client asking a place page while the pool is saturated gets the interim page", async () => {
    const d = deps({ saturated: true });
    const res = await overloadGate(...page({ "user-agent": "curl/8.0" }), "N0nce", d);
    expect(res?.status).toBe(503);
    expect(res?.headers.get("cache-control")).toBe("no-store");
    expect(res?.headers.get("x-robots-tag")).toBe("noindex");
    expect(res?.headers.get("set-cookie")).toBeNull();
    expect(res?.headers.get("content-security-policy")).toContain("script-src 'nonce-N0nce'");
    const html = (await res?.text()) ?? "";
    expect(html).toContain(CHALLENGE_COPY.de.line);
    expect(all(html, "noscript p").map(textOf)).toEqual([CHALLENGE_COPY.de.noscript]);
    expect(html).toContain(`href="${pathFor("impressum", "de")}"`);
    expect(html).toContain(`href="${pathFor("datenschutz", "de")}"`);
    expect(html).not.toMatch(/googletagmanager|clarity|consent/i);
  });

  it("not saturated: nobody is challenged, nothing is read but the pressure (always-challenge mutant)", async () => {
    const { r, calls } = countingResolver();
    const d = deps({ saturated: false, resolver: r });
    for (const ua of ["curl/8.0", BROWSER, GOOGLEBOT]) expect(await overloadGate(...page({ "user-agent": ua, "x-forwarded-for": SPOOF_IP }), "n", d)).toBeNull();
    expect(calls).toEqual([]);
  });

  it("the pass route sets no cookie while the pool is not saturated, and one with exactly the ruled attributes while it is", async () => {
    const quiet = deps({ saturated: false });
    const c1 = quiet.passes.challenge();
    const r1 = await passRoute(new Request(`http://shell${PASS_ROUTE}`, { method: "POST", body: JSON.stringify({ c: c1, n: solve(c1) }) }), quiet);
    expect(r1.status).toBe(204);
    expect(r1.headers.get("set-cookie")).toBeNull();
    const busy = deps({ saturated: true });
    const c2 = busy.passes.challenge();
    const r2 = await passRoute(new Request(`http://shell${PASS_ROUTE}`, { method: "POST", headers: { "sec-fetch-site": "same-origin" }, body: JSON.stringify({ c: c2, n: solve(c2) }) }), busy);
    expect(r2.status).toBe(204);
    const sc = r2.headers.get("set-cookie") ?? "";
    expect(sc).toMatch(new RegExp(`^${PASS_COOKIE}=1\\.\\d+\\.[0-9a-f]{32}\\.[A-Za-z0-9_-]{43}; Secure; HttpOnly; SameSite=Lax; Path=/$`));
    expect(sc).not.toMatch(/Domain|Expires|Max-Age/i);
    // the pass carries the page
    const value = sc.split(";")[0]!.slice(PASS_COOKIE.length + 1);
    expect(await overloadGate(...page({ "user-agent": "curl/8.0", cookie: `vf_lang=de; ${PASS_COOKIE}=${value}` }), "n", busy)).toBeNull();
  });

  it("only database pages are gated, and only GET/HEAD", async () => {
    const d = deps({ saturated: true });
    for (const p of ["/de/datenschutz", "/en/impressum", "/de", "/sitemap.xml", "/robots.txt", "/fragment/place", "/de/autobahn"]) expect(await overloadGate(...page({}, p), "n", d)).toBeNull();
    for (const p of ["/de/place/koeln", "/en/station/koeln-hbf", "/de/autobahn/a3", "/fr/charging/x", "/de/state/bayern", "/de/fuel/koeln", "/de/road/x"]) expect(DB_PAGE.test(p)).toBe(true);
    const post = new Request("http://shell/de/place/koeln", { method: "POST" });
    expect(await overloadGate(post, new URL(post.url), "n", d)).toBeNull();
  });

  it("the page is in the page's language", async () => {
    const d = deps({ saturated: true });
    const html = await (await overloadGate(...page({}, "/en/place/koeln"), "n", d))!.text();
    expect(first(html, "html")?.attrs.lang).toBe("en");
    expect(html).toContain(CHALLENGE_COPY.en.line);
    expect(html).toContain(`href="${pathFor("impressum", "en")}"`);
  });
});

describe("crawlers by address, not by user agent (P7, P8, P9)", () => {
  it("a verified crawler fixture passes", async () => {
    const d = deps({ saturated: true });
    expect(await overloadGate(...page({ "user-agent": GOOGLEBOT, "x-forwarded-for": GOOGLE_IP }), "n", d)).toBeNull();
  });

  it("#1205 (P7): a claim whose lookup timed out is not verified — and, within its share, not refused for it", async () => {
    const slow: Resolver = { reverse: () => new Promise(() => undefined), lookup: () => new Promise(() => undefined) };
    const d = Object.assign(deps({ saturated: true, resolver: slow, ranges: noRanges }), { trip: createClientTrip() });
    const h = { "user-agent": GOOGLEBOT, "x-forwarded-for": SPOOF_IP, "x-vf-agent-class": "crawler" };
    expect(await overloadGate(...page(h), "n", d), "served within its share").toBeNull();
    // served as any client (counted against its share), not exempt as a verified one
    expect([d.trip.counters().served, d.trip.counters().exemptVerified]).toEqual([1, 0]);
  });

  it("a Googlebot user agent from an unlisted address is challenged", async () => {
    const d = deps({ saturated: true });
    const res = await overloadGate(...page({ "user-agent": GOOGLEBOT, "x-forwarded-for": SPOOF_IP }), "n", d);
    expect(res?.status).toBe(503);
  });

  it("1 000 browser requests cause zero lookups; a claimed Googlebot one (then cached)", async () => {
    const { r, calls } = countingResolver();
    const d = deps({ saturated: true, resolver: r, ranges: noRanges });
    for (let i = 0; i < 1_000; i++) await overloadGate(...page({ "user-agent": BROWSER, "x-forwarded-for": `198.51.100.${i % 250}` }), "n", d);
    expect(calls).toEqual([]);
    await overloadGate(...page({ "user-agent": GOOGLEBOT, "x-forwarded-for": SPOOF_IP }), "n", d);
    await overloadGate(...page({ "user-agent": GOOGLEBOT, "x-forwarded-for": SPOOF_IP }), "n", d);
    expect(calls).toEqual([`ptr ${SPOOF_IP}`]);
    // and the verifier itself, asked directly about a browser, looks nothing up and keeps nothing
    const direct = countingResolver();
    const v = createCrawlerVerifier({ resolver: direct.r, fetchRanges: noRanges });
    expect(await v.verify(SPOOF_IP, BROWSER)).toBeNull();
    expect(direct.calls).toEqual([]);
    expect(v.size()).toBe(0);
  });

  it("reverse DNS is believed only when the name is the operator's AND points back to the address", async () => {
    const good = countingResolver({ [GOOGLE_IP]: ["crawl-66-249-66-1.googlebot.com."], "crawl-66-249-66-1.googlebot.com": [GOOGLE_IP] });
    expect(await createCrawlerVerifier({ resolver: good.r, fetchRanges: noRanges }).verify(GOOGLE_IP, GOOGLEBOT)).toEqual({ verified: true, crawler: "google" });
    const liar = countingResolver({ [SPOOF_IP]: ["crawl.googlebot.com.evil.example"], "crawl.googlebot.com.evil.example": [SPOOF_IP] });
    expect((await createCrawlerVerifier({ resolver: liar.r, fetchRanges: noRanges }).verify(SPOOF_IP, GOOGLEBOT))?.verified).toBe(false);
    const noBack = countingResolver({ [SPOOF_IP]: ["x.googlebot.com"], "x.googlebot.com": [GOOGLE_IP] });
    expect((await createCrawlerVerifier({ resolver: noBack.r, fetchRanges: noRanges }).verify(SPOOF_IP, GOOGLEBOT))?.verified).toBe(false);
  });

  it("#1205 review: a Compute Engine VM's forward-confirmed *.bc.googleusercontent.com name is NOT Googlebot", async () => {
    const vm = "7.113.0.203.bc.googleusercontent.com";
    const gce = countingResolver({ [SPOOF_IP]: [`${vm}.`], [vm]: [SPOOF_IP] });
    expect((await createCrawlerVerifier({ resolver: gce.r, fetchRanges: noRanges }).verify(SPOOF_IP, GOOGLEBOT))?.verified).toBe(false);
    expect(CRAWLER_FAMILIES.find((f) => f.name === "google")?.dns).toEqual(["googlebot.com", "google.com"]);
  });

  it("#1205 review: a range list that moved is unreadable, never followed — the default fetch is asked with redirect: error", async () => {
    const seen: string[] = [];
    const spy: RangeFetch = (url, init) => (seen.push(`${url} ${init.redirect}`), rangesFixture(url, init));
    const r = countingResolver();
    expect(await createCrawlerVerifier({ resolver: r.r, fetchRanges: spy }).verify(GOOGLE_IP, GOOGLEBOT)).toEqual({ verified: true, crawler: "google" });
    expect(seen.length).toBe(2);
    for (const line of seen) expect(line).toMatch(/^https:\/\/developers\.google\.com\/static\/crawling\/ipranges\/[a-z-]+\.json error$/);
    // the real fetch, against a loopback answer that moved: a 301 to a list that WOULD verify the address
    const { createServer } = await import("node:http");
    const srv = createServer((req, res) => {
      if (req.url === "/moved.json") return void res.end(JSON.stringify({ prefixes: [{ ipv4Prefix: "66.249.66.0/27" }] }));
      res.writeHead(301, { location: "/moved.json" }).end();
    });
    await new Promise<void>((ok) => srv.listen(0, "127.0.0.1", ok));
    const port = (srv.address() as { port: number }).port;
    const real = globalThis.fetch;
    let asked = 0;
    globalThis.fetch = ((_u: string, init?: RequestInit) => (asked++, real(`http://127.0.0.1:${port}/list.json`, init))) as typeof fetch;
    try {
      const v = createCrawlerVerifier({ resolver: countingResolver().r });
      expect((await v.verify(GOOGLE_IP, GOOGLEBOT))?.verified, "the redirect was not followed").toBe(false);
      expect(asked).toBe(2);
    } finally {
      globalThis.fetch = real;
      await new Promise<void>((ok) => srv.close(() => ok()));
    }
  });

  it("a lookup that times out is not verified, held as unverified for UNKNOWN_TTL_MS only (#1205 review), bounded far under 2 s", async () => {
    let n = 0;
    let t = Date.now();
    const hang: Resolver = { reverse: () => (n++, new Promise(() => undefined)), lookup: () => new Promise(() => undefined) };
    const v = createCrawlerVerifier({ resolver: hang, fetchRanges: noRanges, now: () => t });
    const t0 = Date.now();
    expect((await v.verify(SPOOF_IP, GOOGLEBOT))?.verified).toBe(false);
    expect(Date.now() - t0).toBeLessThan(1_200);
    expect(n).toBe(1);
    // held: the next request inside the minute asks nobody (a slow resolver costs one lookup a minute, not one per request)
    t += UNKNOWN_TTL_MS - 1;
    expect((await v.verify(SPOOF_IP, GOOGLEBOT))?.verified).toBe(false);
    expect(n).toBe(1);
    // and only for that minute: never the hour a definite "no" is held
    expect(UNKNOWN_TTL_MS).toBeLessThan(UNVERIFIED_TTL_MS);
    t += 2;
    await v.verify(SPOOF_IP, GOOGLEBOT);
    expect(n).toBe(2);
  });

  it("verdicts: 24 h verified, 1 h unverified, at most 50 000, least recently used first", async () => {
    let t = 0;
    const { r, calls } = countingResolver({ [GOOGLE_IP]: ["a.googlebot.com"], "a.googlebot.com": [GOOGLE_IP] });
    const v = createCrawlerVerifier({ resolver: r, fetchRanges: noRanges, now: () => t });
    await v.verify(GOOGLE_IP, GOOGLEBOT);
    await v.verify(SPOOF_IP, GOOGLEBOT);
    const asked = calls.length;
    t += UNVERIFIED_TTL_MS - 1;
    await v.verify(GOOGLE_IP, GOOGLEBOT);
    await v.verify(SPOOF_IP, GOOGLEBOT);
    expect(calls.length).toBe(asked);
    t += 2;
    await v.verify(SPOOF_IP, GOOGLEBOT);
    expect(calls.length).toBe(asked + 1);
    t = VERIFIED_TTL_MS - 1;
    await v.verify(GOOGLE_IP, GOOGLEBOT);
    expect(calls.length).toBe(asked + 1);
    t = VERIFIED_TTL_MS + 1;
    await v.verify(GOOGLE_IP, GOOGLEBOT);
    expect(calls.length).toBeGreaterThan(asked + 1);
    expect(VERIFIED_TTL_MS).toBe(24 * 3_600_000);
    expect(UNVERIFIED_TTL_MS).toBe(3_600_000);
    // the bound
    const many = createCrawlerVerifier({ resolver: countingResolver().r, fetchRanges: noRanges });
    for (let i = 0; i < VERDICT_MAX + 10; i++) await many.verify(`10.${(i >> 16) & 255}.${(i >> 8) & 255}.${i & 255}`, GOOGLEBOT);
    expect(many.size()).toBe(VERDICT_MAX);
  });

  it("the verdicts are never persisted: the module imports nothing that could write them (mutant: a persisted map)", () => {
    const text = read("packages/web/src/overload/crawler-verify.ts");
    const imports = [...text.matchAll(/^import[^"]*"([^"]+)"/gm)].map((m) => m[1]);
    // `../site/crawlers.js` (#1290, the one list of the AI assistants) is constants with no import of its own
    expect(imports.sort()).toEqual(["../site/crawlers.js", "node:dns/promises", "node:net"]);
    expect([...read("packages/web/src/site/crawlers.ts").matchAll(/^import /gm)]).toEqual([]);
    expect(text).not.toMatch(/writeFile|appendFile|createWriteStream|logLine|console\.|pino/);
  });

  it("the closed list names the ten operators of the ruling in twelve families (OpenAI's search indexer apart, 2026-11-13, and GPTBot apart, #1306), each with a range file or a DNS method or flagged open", () => {
    expect(CRAWLER_FAMILIES.map((f) => f.name)).toEqual(["google", "bing", "yandex", "apple", "duckduckgo", "openai-search", "openai-gptbot", "openai", "anthropic", "amazon", "meta", "perplexity"]);
    expect(claimedFamily(BROWSER)).toBeNull();
    expect(claimedFamily(GOOGLEBOT)?.name).toBe("google");
    for (const f of CRAWLER_FAMILIES) for (const u of f.ranges) expect(u).toMatch(/^https:\/\//);
  });

  /** A public resolver or a setServers call: the shape P8 forbids. */
  const PUBLIC_RESOLVER = /setServers|(?<![\w.])(?:8\.8\.8\.8|8\.8\.4\.4|1\.1\.1\.1|1\.0\.0\.1|9\.9\.9\.9)(?![\w.])|dns\.google|cloudflare-dns|dns\.quad9/;
  it("P8: no public resolver and no setServers in web or digest", () => {
    const files = [...walk(join(REPO, "packages/web/src")), ...walk(join(REPO, ".pinned/app/packages/digest/dist/src"))];
    expect(files.length).toBeGreaterThan(100);
    expect(files.filter((f) => PUBLIC_RESOLVER.test(readFileSync(f, "utf8"))).map((f) => f.slice(REPO.length))).toEqual([]);
    expect(PUBLIC_RESOLVER.test("resolver.setServers(['1.1.1.1'])")).toBe(true);
  });
  // cross-repo(viafrei-infra): the deploy's files are viafrei-infra's
  it.skip("P8: no public resolver and no setServers in the deploy", () => {});
});

describe("the pass (P3, P5)", () => {
  it("the value is a version, the minute, 128 random bits and a MAC — nothing else", () => {
    const book = createPassBook({ now: () => Date.parse("2026-11-04T22:13:45Z") });
    const v = book.issue();
    const [ver, minute, nonce, mac] = v.split(".");
    expect(ver).toBe("1");
    expect(Number(minute)).toBe(Date.parse("2026-11-04T22:13:00Z") / 1000);
    expect(nonce).toMatch(/^[0-9a-f]{32}$/);
    expect(mac).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(v.split(".")).toHaveLength(4);
    expect(PASS_COOKIE_ATTRIBUTES).toBe("Secure; HttpOnly; SameSite=Lax; Path=/");
  });

  it("refused 12 h + 1 min after its issue time, accepted at 12 h; a forged MAC or another process's key is refused", () => {
    let t = Date.parse("2026-11-04T10:00:00Z");
    const book = createPassBook({ now: () => t });
    const v = book.issue();
    t += PASS_MAX_AGE_S * 1000;
    expect(book.valid(v)).toBe(true);
    t += 60_000;
    expect(book.valid(v)).toBe(false);
    expect(PASS_MAX_AGE_S).toBe(12 * 3_600);
    t = Date.parse("2026-11-04T10:00:00Z");
    expect(book.valid(`${v.slice(0, -1)}${v.endsWith("A") ? "B" : "A"}`)).toBe(false);
    expect(createPassBook({ now: () => t }).valid(v)).toBe(false);
  });

  it("one pass carries at most PASS_MAX_USES pages", () => {
    const book = createPassBook();
    const v = book.issue();
    for (let i = 0; i < PASS_MAX_USES; i++) expect(book.admit(v)).toBe(true);
    expect(book.admit(v)).toBe(false);
  });

  it("a challenge is solved once, unexpired, and a wrong answer is refused", () => {
    let t = Date.parse("2026-11-04T10:00:00Z");
    const book = createPassBook({ now: () => t });
    const c = book.challenge();
    const n = solve(c);
    expect(book.solve(c, wrongNonce(c, n + 1))).toBe(false);
    expect(book.solve(c, n)).toBe(true);
    expect(book.solve(c, n)).toBe(false);
    const late = book.challenge();
    t += 11 * 60_000;
    expect(book.solve(late, solve(late))).toBe(false);
  });

  it("passOf reads that one cookie name", () => {
    expect(passOf(`vf_lang=de; ${PASS_COOKIE}=abc; _ga=1`)).toBe("abc");
    expect(passOf("vf_pass=abc")).toBeNull();
    expect(passOf(null)).toBeNull();
  });
});

/** P4's forbidden device reads and writes. */
const DEVICE_READS = /\bnavigator\b|\bscreen\b|canvas|getContext|WebGL|AudioContext|OfflineAudioContext|document\.fonts|\bfonts\b|Intl\b|timeZone|getTimezoneOffset|plugins|mimeTypes|getBattery|localStorage|sessionStorage|indexedDB|document\.cookie|\.cookie\b|devicePixelRatio|matchMedia|hardwareConcurrency|deviceMemory/;

describe("#1205: one pass key for every replica", () => {
  const KEY = "ab".repeat(32);
  const T = Date.parse("2026-11-11T21:00:00Z");
  const shared = passKeyFrom({ WEB_PASS_KEY: KEY });
  if (shared === undefined) throw new Error("the shared key did not parse");
  const replica = () => createPassBook({ key: shared, now: () => T });

  it("a pass one instance issued is accepted by another holding the shared key; with per-process keys it was not", () => {
    expect(replica().admit(replica().issue())).toBe(true);
    // the defect: two processes with their own random keys refuse each other's pass
    expect(createPassBook({ now: () => T }).admit(createPassBook({ now: () => T }).issue())).toBe(false);
  });

  it("a challenge one instance issued is solved on another (the answer's POST may reach any replica)", () => {
    const c = replica().challenge();
    let n = 0;
    while (!leadingZeroBits(createHash("sha256").update(`${c}.${String(n)}`).digest(), POW_BITS)) n++;
    expect(replica().solve(c, n)).toBe(true);
  });

  it("the key: unset is a per-process key (one dev process); a short or non-hex key is refused, naming the variable and never the value", () => {
    expect(passKeyFrom({})).toBeUndefined();
    expect(passKeyFrom({ WEB_PASS_KEY: "  " })).toBeUndefined();
    expect(passKeyFrom({ WEB_PASS_KEY: KEY })?.length).toBe(32);
    // #1205 review N1: one rule, exactly 64 hex — a longer key (which the host would regenerate) is refused too
    for (const bad of ["ab".repeat(31), "zz".repeat(32), `${"ab".repeat(32)}a`, "ab".repeat(33), "ab".repeat(48)]) {
      let message = "";
      try {
        passKeyFrom({ WEB_PASS_KEY: bad });
      } catch (e) {
        message = String(e);
      }
      expect(message, `${String(bad.length)} characters`).toMatch(/WEB_PASS_KEY must be exactly 64 hex/);
      expect(message).not.toContain(bad);
    }
  });

  it("the web's key rule is exactly 64 hex characters (#1205 review N1)", () => {
    expect(PASS_KEY_HEX.source).toBe("^[0-9a-fA-F]{64}$");
  });
  // cross-repo(viafrei-infra): the host's key rule is in viafrei-infra's deploy
  it.skip("the web's key rule and the host's are the one rule (#1205 review N1)", () => {});

  it("the process-wide book reads the shared key", () => {
    const index = read("packages/web/src/overload/index.ts");
    expect(index).toContain("createPassBook(passBookDeps())");
    expect(index).toContain("passKeyFrom(process.env)");
  });
  // cross-repo(viafrei-infra): generating the key on the host is viafrei-infra's deploy
  it.skip("the host generates the shared key for every replica (compose and the k8s Secret alike)", () => {});
});

describe("the challenge script (P4)", () => {
  it("reads no device property and writes no storage", () => {
    const text = solvePass.toString();
    expect(text.length).toBeGreaterThan(200);
    expect(text).not.toMatch(DEVICE_READS);
    // the scan can say no: a planted read goes red
    expect(DEVICE_READS.test(text.replace("const d = w.document;", "const d = w.document; const ua = w.navigator.userAgent;"))).toBe(true);
    expect(DEVICE_READS.test("w.localStorage.setItem('x', 1)")).toBe(true);
  });

  it("a browser passes with no interaction: the script solves, posts, and the server's pass reloads the page", async () => {
    const d = deps({ saturated: true });
    const html = challengePage("de", d.passes.challenge(), "n");
    const c = /data-c="([^"]+)"/.exec(html)![1]!;
    let reloaded = 0;
    let cookie = "";
    const el = { getAttribute: (k: string) => (k === "data-c" ? c : k === "data-bits" ? String(POW_BITS) : null) };
    const note = { hidden: true };
    const w = {
      document: { getElementById: (id: string) => (id === "vf-pass" ? el : id === "vf-pass-note" ? note : null) },
      location: { hash: "", reload: () => void reloaded++ },
      crypto: webcrypto,
      TextEncoder,
      fetch: async (path: string, init: RequestInit) => {
        const res = await passRoute(new Request(`http://shell${path}`, { ...init, headers: { ...(init.headers as Record<string, string>), "sec-fetch-site": "same-origin" } }), d);
        cookie = res.headers.get("set-cookie") ?? "";
        return res;
      },
    };
    const t0 = Date.now();
    solvePass(w);
    for (let i = 0; i < 200 && reloaded === 0; i++) await new Promise((ok) => setTimeout(ok, 5));
    expect(Date.now() - t0).toBeLessThan(1_500);
    expect(reloaded).toBe(1);
    // #1205: the guard names the server's second of the challenge answered, never the device's clock
    expect(w.location.hash).toBe(`vf-pass=${/^c1\.(\d+)\./.exec(c)![1]!}`);
    expect(note.hidden).toBe(true);
    expect(cookie.startsWith(`${PASS_COOKIE}=`)).toBe(true);
    // the reloaded page is the page
    expect(await overloadGate(...page({ cookie: cookie.split(";")[0]! }), "n", d)).toBeNull();
  });

  /** A browser on the interim page for challenge `c`, at `hash`: what it posted, where it went, what it showed. */
  const onPage = (c: string, hash: string) => {
    const note = { hidden: true };
    const seen = { posted: 0, reloaded: 0, replaced: [] as string[] };
    const el = { getAttribute: (k: string) => (k === "data-c" ? c : k === "data-bits" ? String(POW_BITS) : k === "data-guard" ? String(GUARD_S) : null) };
    const w = {
      document: { getElementById: (id: string) => (id === "vf-pass" ? el : id === "vf-pass-note" ? note : null) },
      location: { hash, pathname: "/de/station/hamburg-hbf", search: "?platform=5", reload: () => void seen.reloaded++ },
      history: { replaceState: (_s: unknown, _t: string, to: string) => void seen.replaced.push(to) },
      crypto: webcrypto,
      TextEncoder,
      fetch: () => (seen.posted++, Promise.resolve({ status: 400 })),
    };
    return { w, note, seen };
  };
  const SECOND = 1_794_400_000;
  const challengeAt = (at: number): string => `c1.${String(at)}.0123456789abcdef.${"A".repeat(43)}`;

  it("a browser that keeps no cookie sees the sentence after the one reload right after its answer, never a loop", () => {
    for (const after of [2, GUARD_S]) {
      const { w, note, seen } = onPage(challengeAt(SECOND + after), `#vf-pass=${String(SECOND)}`);
      solvePass(w);
      expect(note.hidden, String(after)).toBe(false);
      expect(seen.posted, String(after)).toBe(0);
    }
  });

  it("#1205 review: the page hands its script the guard's span as GUARD_S (30 s), one number for page and test", () => {
    expect(GUARD_S).toBe(30);
    expect(challengePage("de", "c1.1.x.y", "n")).toContain(`data-guard="${String(GUARD_S)}"`);
  });

  it("#1205: the guard is dropped from the address at once, so a reload, a bookmark or a shared link tries again", () => {
    const { w, seen } = onPage(challengeAt(SECOND + 2), `#vf-pass=${String(SECOND)}`);
    solvePass(w);
    // the address without its fragment, path and query kept
    expect(seen.replaced).toEqual(["/de/station/hamburg-hbf?platform=5"]);
  });

  it("#1205: a guard that outlived its attempt (the page's challenge is newer than its 30 s) never stops the page", async () => {
    for (const hash of [`#vf-pass=${String(SECOND)}`, "#vf-pass"]) {
      // a bookmarked or reloaded address a minute later, and the bare guard of the script before #1205
      const { w, note, seen } = onPage(challengeAt(SECOND + GUARD_S + 1), hash);
      solvePass(w);
      for (let i = 0; i < 300 && seen.posted === 0; i++) await new Promise((ok) => setTimeout(ok, 5));
      expect(seen.posted, hash).toBe(1);
      expect(seen.replaced, hash).toEqual(["/de/station/hamburg-hbf?platform=5"]);
      // the server refused this answer (400): the sentence, once, and no reload
      await new Promise((ok) => setTimeout(ok, 5));
      expect(note.hidden, hash).toBe(false);
      expect(seen.reloaded, hash).toBe(0);
    }
  });

  it("#1205: a stopped attempt offers a 'try again' link to this address without the fragment, in the page's language", () => {
    const d = deps({ saturated: true });
    for (const lang of ["de", "en", "tr"] as const) {
      const html = challengePage(lang, d.passes.challenge(), "n", "/de/station/hamburg-hbf?platform=5&x=<1>");
      const a = /<p id="vf-pass-note" hidden>[^<]*<a id="vf-pass-retry" href="([^"]*)">([^<]*)<\/a><\/p>/.exec(html);
      expect(a, lang).not.toBeNull();
      expect(a![1]).toBe("/de/station/hamburg-hbf?platform=5&amp;x=&lt;1&gt;");
      expect(a![2]).toBe(CHALLENGE_COPY[lang].retry);
    }
    for (const l of LIVE_LANGS) expect(CHALLENGE_COPY[l].retry.length, l).toBeGreaterThan(0);
  });

  it("#1205: the gate's interim page links the address it answered, query included, never a fragment", async () => {
    const d = deps({ saturated: true });
    const req = new Request("http://shell/de/station/hamburg-hbf?platform=5", { headers: { "user-agent": BROWSER } });
    const res = await overloadGate(req, new URL(req.url), "n", d);
    expect(res?.status).toBe(503);
    expect(await res!.text()).toContain('id="vf-pass-retry" href="/de/station/hamburg-hbf?platform=5"');
  });
});

describe("one purpose, no record (P1, P5)", () => {
  /** A file outside the challenge that names the pass cookie. */
  const readers = (files: string[]): string[] => files.filter((f) => /vf_pass(?![a-z])/.test(readFileSync(f, "utf8")));
  it("no module outside src/overload reads the pass cookie's name", () => {
    const runtime = [...walk(join(REPO, "packages/web/src")), ...walk(join(REPO, ".pinned/app/packages/digest/dist/src")), ...walk(join(REPO, ".pinned/app/packages/status/dist/src")), ...walk(join(REPO, ".pinned/app/packages/ingest/dist")), ...walk(join(REPO, ".pinned/app/packages/mcp/dist/src"))];
    const allowed = new Set([join(REPO, "packages/web/src/overload/pass.ts"), join(REPO, "packages/web/src/components/LegalPrivacy.astro")]);
    expect(readers(runtime).filter((f) => !allowed.has(f)).map((f) => f.slice(REPO.length))).toEqual([]);
  });
  // cross-repo(viafrei-infra): the edge's configuration is viafrei-infra's
  it.skip("deploy: the edge forwards the pass cookie and nothing else there names it (#1245)", () => {});
  it("the scan can say no: a planted reader is found", () => {
    expect(/vf_pass(?![a-z])/.test('const p = cookies.get("__Host-vf_pass");')).toBe(true);
  });
  it("the overload modules log nothing — but the per-client trip's hourly class counts (#1205, P9), whose lines carry no address (test/trip-1205.test.ts)", () => {
    const TRIP = join(REPO, "packages/web/src/overload/trip.ts");
    const files = walk(join(REPO, "packages/web/src/overload"));
    expect(files).toContain(TRIP);
    for (const f of files.filter((x) => x !== TRIP)) expect(readFileSync(f, "utf8"), f).not.toMatch(/logLine|lib\/log\.js|console\.|pino/);
    const trip = readFileSync(TRIP, "utf8");
    expect(trip).not.toMatch(/console\.|pino/);
    // its one line is the hourly aggregate (P9), keyed by an outcome name or a label — never by `ip`, `ua` or a key;
    // no line is written per request (P5)
    const calls = [...trip.matchAll(/logLine\(([^\n]*)\);/g)].map((m) => m[1]!);
    expect(calls.length).toBe(1);
    expect(trip.match(/logLine\(/g)?.length).toBe(1);
    for (const c of calls) {
      expect(c).toMatch(/^30, \{ kind: "overload_trip", key: k, count: n \}/);
      expect(c).not.toMatch(/\b(?:ip|ua|keyOf|secret|headers)\b/);
    }
  });
});

describe("the pressure reading fails open", () => {
  it("is read at most once a second, and a digest that does not answer is 'ok'", async () => {
    let t = 0;
    let asks = 0;
    const p = createPressure({ baseUrl: "http://digest", now: () => t, fetchImpl: () => (asks++, Promise.resolve({ status: 200, text: () => Promise.resolve("saturated\n") })) });
    expect(await p.saturated()).toBe(true);
    t += 500;
    expect(await p.saturated()).toBe(true);
    expect(asks).toBe(1);
    t += 600;
    await p.saturated();
    expect(asks).toBe(2);
    const down = createPressure({ baseUrl: "http://digest", fetchImpl: () => Promise.reject(new Error("down")) });
    expect(await down.saturated()).toBe(false);
    const odd = createPressure({ baseUrl: "http://digest", fetchImpl: () => Promise.resolve({ status: 500, text: () => Promise.resolve("saturated") }) });
    expect(await odd.saturated()).toBe(false);
  });
});

describe("the copy and the Datenschutz text (P6, P12)", () => {
  it("German and English are the steward's sentences; every live language has both", () => {
    expect(CHALLENGE_COPY.de.line).toBe("Einen Moment – die Seite wird geladen.");
    expect(CHALLENGE_COPY.en.noscript).toBe("Our server is under heavy load right now. To load the page, your browser needs JavaScript for a short check; without JavaScript, please try again in a few minutes.");
    for (const l of LIVE_LANGS) expect(CHALLENGE_COPY[l].line.length * CHALLENGE_COPY[l].noscript.length).toBeGreaterThan(0);
  });

  const flat = (s: string): string => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
  const privacy = flat(read("packages/web/src/components/LegalPrivacy.astro"));
  it("the paragraph names the code's cookie, its 12 h and the verdicts' 24 h / 1 h", () => {
    expect(all(read("packages/web/src/components/LegalPrivacy.astro"), "h3#ueberlastschutz").map(textOf)).toEqual(["Schutz vor Überlastung"]);
    expect(privacy).toContain(`setzt unser Server ein Cookie (${PASS_COOKIE}),`);
    const hours: Record<number, string> = { 12: "zwölf", 1: "eine", 24: "24" };
    expect(privacy).toContain(`höchstens ${hours[PASS_MAX_AGE_S / 3600]!} Stunden nach seiner Ausstellung anerkannt`);
    expect(privacy).toContain(`ein bestätigtes höchstens ${hours[VERIFIED_TTL_MS / 3_600_000]!} Stunden, ein nicht bestätigtes höchstens ${hours[UNVERIFIED_TTL_MS / 3_600_000]!} Stunde`);
    expect(privacy).toContain("(§ 25 Abs. 2 Nr. 2 TDDDG), und erfordert daher keine Einwilligung.");
    expect(privacy).not.toContain("TTDSG");
    expect(privacy).toContain("Diese Seite setzt selbst kein Cookie außer den beiden unter „Sprachauswahl“ und „Schutz vor Überlastung“ beschriebenen");
    // in section 3, after the storage paragraph
    const src = read("packages/web/src/components/LegalPrivacy.astro");
    expect(src.indexOf('id="ueberlastschutz"')).toBeGreaterThan(src.indexOf('id="speicherdauer-website"'));
    expect(src.indexOf('id="ueberlastschutz"')).toBeLessThan(src.indexOf('<h2 id="besucherzaehlung">4.'));
    expect(src.indexOf('id="ueberlastschutz"')).toBeGreaterThan(src.indexOf("<h2>3. Server-Logfiles</h2>"));
  });

  it("#1205: the paragraph and the record state the trip's window, limit and bound, and that the address is held only as a keyed hash in memory", () => {
    const s = TRIP_WINDOW_MS / 1000;
    const bound = String(TRIP_MAX_CLIENTS).replace(/\B(?=(\d{3})+$)/g, " ");
    expect(Number.isInteger(s)).toBe(true);
    expect(privacy).toContain(`ein Anschluss in einem Zeitfenster von ${s} Sekunden abruft`);
    expect(privacy).toContain(`Wer in ${s} Sekunden nicht mehr als ${TRIP_LIMIT} solcher Seiten abruft, erhält sie wie immer.`);
    expect(privacy).toContain("mit einem geheimen Schlüssel einen Prüfwert (HMAC-SHA-256)");
    expect(privacy).toContain("Den Schlüssel erzeugt er bei jedem Start neu und speichert ihn nirgends. Die Adresse selbst hält er dafür nicht fest.");
    expect(privacy).toContain(`Prüfwert und Zähler liegen nur im Arbeitsspeicher, für höchstens ${bound} Anschlüsse zugleich.`);
    expect(privacy).toContain("Bestätigte Suchmaschinen und KI-Assistenten werden nicht gezählt");
    expect(privacy).toContain("Diese Summen enthalten keine IP-Adresse, keinen Prüfwert und keine Browserkennung");
    const record = read("packages/web/PRIVACY-overload.md").replace(/\n> ?/g, " ").replace(/\s+/g, " ");
    expect(record).toContain(`at most ${TRIP_LIMIT} database pages per client in a window of ${s} seconds`);
    expect(record).toContain(`the per-client counts, keyed by the hash only: at most ${bound} clients`);
    expect(record).toContain("reduced at once to an HMAC-SHA-256 under a 32-byte key the process draws at start");
    expect(record).toContain("The address itself is not kept.");
    expect(record).toContain(`requests in a window of ${s} seconds`);
    expect(record).toContain(`requests no more than ${TRIP_LIMIT} such pages in ${s} seconds`);
    expect(record).toContain(`for at most ${bound} connections at a time`);
  });
});

/** #1205 (owner 2026-11-11): a 503 budget of about 1 %; a person never gets a bare 503 from a database page. */
describe("#1205: a refused, late or failed fragment is a person's degraded 200, never their 503", () => {
  const req = (ua: string, extra: Record<string, string> = {}, path = "/en/station/hamburg-hbf"): Request =>
    new Request(`http://shell${path}`, { headers: { "user-agent": ua, ...extra } });

  it("a person (no class) gets a 200 in their language: noindex, no-store, refreshing itself, marked degraded", async () => {
    const res = withAgentClass(null, () => unavailableAnswer("en", req(BROWSER)));
    expect(res.status).toBe(200);
    expect(res.headers.get(DEGRADED_HEADER)).toBe("1");
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const html = await res.text();
    expect(first(html, "html")?.attrs.lang).toBe("en");
    expect(first(html, 'meta[name="robots"]')?.attrs.content).toBe("noindex");
    expect(first(html, 'meta[http-equiv="refresh"]')?.attrs.content).toBe("5;url=/en/station/hamburg-hbf?vf_wait=1");
    expect(html).not.toMatch(/<script/);
  });

  it("a crawler keeps the 503 with Retry-After (a loading sentence would be indexed in place of the page)", () => {
    for (const cls of ["search", "crawler", "seo"] as const) {
      const res = withAgentClass(cls, () => unavailableAnswer("de", req(BROWSER)));
      expect(res.status, cls).toBe(503);
      expect(res.headers.get("retry-after")).toBe("60");
      expect(res.headers.get(DEGRADED_HEADER)).toBe("1");
    }
  });

  it("#1205 review: a claimed crawler, a user-triggered AI fetcher or the edge's verified bot is not a person — the 503, never the loading 200", () => {
    const bots = [
      GOOGLEBOT,
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +Claude-User@anthropic.com)",
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot",
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)",
    ];
    for (const ua of bots) {
      const r = withAgentClass(null, () => unavailableAnswer("en", req(ua)));
      expect(r.status, ua).toBe(503);
      expect(r.headers.get("retry-after"), ua).toBe("60");
    }
    expect(withAgentClass(null, () => unavailableAnswer("en", req(BROWSER, { [VERIFIED_BOT_HEADER]: "1" }))).status).toBe(503);
    expect(withAgentClass(null, () => notAPerson(new Headers({ "user-agent": BROWSER })))).toBe(false);
  });

  it("#1205 review: the degraded page's reload waits 5, 10, 20, 40, then 60 s for good, counted in the address it reloads", () => {
    expect([0, 1, 2, 3, 4, 5, 9, 40].map((n) => degradedRefreshS(n))).toEqual([5, 10, 20, 40, 60, 60, 60, 60]);
    expect(degradedRefreshS(-1)).toBe(5);
    expect(degradedRefreshS(Number.NaN)).toBe(5);
    expect(DEGRADED_REFRESH_MAX_S).toBe(60);
    const at = (q: string): string => /content="(\d+;url=[^"]*)"/.exec(degradedPage("de", new URL(`http://shell/de/place/koeln${q}`)))?.[1] ?? "";
    expect(at("")).toBe(`5;url=/de/place/koeln?${DEGRADED_WAIT_PARAM}=1`);
    expect(at("?vf_wait=1")).toBe("10;url=/de/place/koeln?vf_wait=2");
    expect(at("?r=a1&vf_wait=3")).toBe("40;url=/de/place/koeln?r=a1&amp;vf_wait=4");
    expect(at("?vf_wait=99")).toBe("60;url=/de/place/koeln?vf_wait=9");
    expect(at("?vf_wait=x")).toBe("5;url=/de/place/koeln?vf_wait=1");
  });

  /** Every page file's refusal goes through `unavailableAnswer`, and none answers a 503 of its own. */
  const PAGES = [
    "autobahn.astro", "autobahn/[road]/[...rest].astro", "charging/[slug].astro", "fuel/[slug].astro", "place/[slug].astro",
    "road/[...rest].astro", "state/[slug].astro", "states.astro", "station.astro", "station/[slug].astro", "station/[slug]/stop/[stop].astro",
  ];
  const offences = (src: string): string[] => {
    const out: string[] = [];
    if (/status:\s*503/.test(src)) out.push("answers a 503 of its own");
    if (/kind === "unavailable"/.test(src) && !/kind === "unavailable"\) return unavailableAnswer\(lang, Astro\.request\);/.test(src)) out.push("its unavailable branch is not unavailableAnswer");
    if (!/from "[./]+lib\/degraded\.js"/.test(src)) out.push("does not import lib/degraded.js");
    return out;
  };

  it("one test per page kind: each of the eleven database pages answers its refusal through unavailableAnswer", () => {
    const dir = join(REPO, "packages/web/src/pages/[lang]");
    const found = walk(dir).filter((f) => f.endsWith(".astro") && readFileSync(f, "utf8").includes('"unavailable"')).map((f) => f.slice(dir.length + 1)).sort();
    expect(found, "the page list is the set of pages that can be unavailable").toEqual([...PAGES].sort());
    for (const p of PAGES) expect(offences(read(`packages/web/src/pages/[lang]/${p}`)), p).toEqual([]);
  });

  it("mutant: a page that answers its own 503 again is caught", () => {
    const src = read("packages/web/src/pages/[lang]/station/[slug].astro");
    const mutant = src.replace("return unavailableAnswer(lang, Astro.request);", 'return new Response(null, { status: 503, headers: { "retry-after": "60" } });');
    expect(mutant).not.toBe(src);
    expect(offences(mutant).length).toBeGreaterThan(0);
  });

  it("the middleware logs a degraded answer (page_degraded), so the refusal stays counted", () => {
    expect(read("packages/web/src/middleware.ts")).toMatch(/headers\.get\(DEGRADED_HEADER\) !== null\) logLine\(40, \{ kind: "page_degraded"/);
  });
});

describe("#1205: a sitemap the digest did not answer serves its last list, never an empty one", () => {
  it("built → held → served degraded on a miss; nothing held → the 503 with Retry-After", async () => {
    clearHeldSitemaps();
    expect(sitemapAnswer("sitemap-places-de", null, 300).status).toBe(503);
    const xml = '<?xml version="1.0"?><urlset><url><loc>https://viafrei.de/de/ort/koeln</loc></url></urlset>';
    const fresh = sitemapAnswer("sitemap-places-de", xml);
    expect(fresh.status).toBe(200);
    expect(fresh.headers.get(DEGRADED_HEADER)).toBeNull();
    const held = sitemapAnswer("sitemap-places-de", null);
    expect(held.status).toBe(200);
    expect(held.headers.get(DEGRADED_HEADER)).toBe("1");
    expect(await held.text()).toBe(xml);
    const other = sitemapAnswer("sitemap-places-en", null, 120);
    expect(other.status, "a list held for another address is not served").toBe(503);
    expect(other.headers.get("retry-after")).toBe("120");
    clearHeldSitemaps();
  });

  it("every sitemap route answers through sitemapAnswer and none answers its own 503", () => {
    const dir = join(REPO, "packages/web/src/pages");
    const files = readdirSync(dir).filter((f) => /^sitemap-\w+-\[lang\]\.xml\.ts$/.test(f));
    expect(files.length).toBe(6);
    for (const f of files) {
      const src = readFileSync(join(dir, f), "utf8");
      expect(src, f).toContain("return sitemapAnswer(");
      expect(src, f).not.toMatch(/status:\s*503/);
    }
    const energy = read("packages/web/src/lib/energy-sitemaps.ts");
    expect(energy).toContain("sitemapAnswer(");
    expect(energy).not.toMatch(/status:\s*503/);
  });
});

describe("#1205: a VERIFIED crawler reads on its own lane and is served under saturation", () => {
  const headers = (h: Record<string, string>): Headers => new Headers(h);

  it("verified Googlebot: never challenged while saturated, and its reads go to the digest's search lane", async () => {
    const d = deps({ saturated: true });
    const h = { "user-agent": GOOGLEBOT, "x-forwarded-for": GOOGLE_IP, "x-vf-agent-class": "crawler" };
    expect(await overloadGate(...page(h, "/de/station/hamburg-hbf"), "n", d)).toBeNull();
    expect(await requestAgentClass(headers(h), d)).toBe("search");
  });

  it("an unverified claim of Googlebot (nginx: crawler, outside Google's ranges) is challenged under saturation and does not get the lane", async () => {
    const d = deps({ saturated: true, ranges: noRanges });
    const h = { "user-agent": GOOGLEBOT, "x-forwarded-for": SPOOF_IP, "x-vf-agent-class": "crawler" };
    expect((await overloadGate(...page(h, "/de/station/hamburg-hbf"), "n", d))?.status).toBe(503);
    expect(await requestAgentClass(headers(h), d)).toBe("crawler");
  });

  it("#1205 review: nginx's search class without proof is not the search lane — SeznamBot from an address nobody can verify", async () => {
    const r = countingResolver();
    const d = deps({ saturated: true, resolver: r.r, ranges: noRanges });
    const seznam = { "user-agent": "SeznamBot/4.0", "x-forwarded-for": SPOOF_IP, "x-vf-agent-class": "search" };
    expect(await requestAgentClass(headers(seznam), d)).toBe("crawler");
    expect(await requestAgentClass(headers({ ...seznam, "user-agent": BROWSER }), d), "any UA nginx called search").toBe("crawler");
  });

  it("#1205 review: the edge's marker x-vf-verified-bot: 1 is the search lane and never challenged; any other value does nothing", async () => {
    const d = deps({ saturated: true, ranges: noRanges });
    const claude = "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)";
    const h = { "user-agent": claude, "x-forwarded-for": SPOOF_IP, "x-vf-agent-class": "crawler", [VERIFIED_BOT_HEADER]: "1" };
    expect(await requestAgentClass(headers(h), d)).toBe("search");
    expect(await overloadGate(...page(h, "/de/station/hamburg-hbf"), "n", d)).toBeNull();
    for (const v of ["true", "0", "", "yes", "11", "1,1"]) {
      const hv = { ...h, [VERIFIED_BOT_HEADER]: v };
      expect(await requestAgentClass(headers(hv), d), JSON.stringify(v)).not.toBe("search");
      expect((await overloadGate(...page(hv, "/de/station/hamburg-hbf"), "n", d))?.status, JSON.stringify(v)).toBe(503);
    }
  });

  it("a client claiming no crawler keeps nginx's class and costs no lookup", async () => {
    const r = countingResolver();
    const d = deps({ saturated: true, resolver: r.r });
    expect(await requestAgentClass(headers({ "user-agent": BROWSER, "x-forwarded-for": SPOOF_IP }), d)).toBeNull();
    expect(await requestAgentClass(headers({ "user-agent": "SemrushBot/7", "x-forwarded-for": SPOOF_IP, "x-vf-agent-class": "seo" }), d)).toBe("seo");
    expect(r.calls).toEqual([]);
  });

  it("#1205 review S1: not saturated, a fresh Googlebot address costs no lookup and no range fetch — a held verdict is read, none is made", async () => {
    const r = countingResolver({ [GOOGLE_IP]: ["crawl-66-249-66-1.googlebot.com"], "crawl-66-249-66-1.googlebot.com": [GOOGLE_IP] });
    let fetches = 0;
    const counted: RangeFetch = (url, init) => (fetches++, rangesFixture(url, init));
    const d = deps({ saturated: false, resolver: r.r, ranges: counted });
    // nginx's range check failed (crawler) or was never made (a Googlebot UA nginx did not range-check would be crawler too)
    const fresh = { "user-agent": GOOGLEBOT, "x-forwarded-for": GOOGLE_IP, "x-vf-agent-class": "crawler" };
    expect(await requestAgentClass(headers(fresh), d)).toBe("crawler");
    expect(await requestAgentClass(headers({ ...fresh, "user-agent": "Mozilla/5.0 (compatible; Applebot/0.1)" }), d)).toBe("crawler");
    expect(r.calls, "resolver calls").toEqual([]);
    expect(fetches, "range fetches").toBe(0);
    expect(d.pressureAsks, "the pressure is asked, nothing else").toBe(2);
    // nginx's own range check (`search` for a Google UA) is the lane without a lookup of ours
    expect(await requestAgentClass(headers({ ...fresh, "x-vf-agent-class": "search" }), d)).toBe("search");
    expect(r.calls).toEqual([]);
    // a verdict held from a saturated moment is read when it is quiet again
    const sat = deps({ saturated: true, resolver: r.r, ranges: counted });
    expect(await requestAgentClass(headers(fresh), sat)).toBe("search");
    const madeCalls = r.calls.length + fetches;
    expect(madeCalls, "the saturated read did look").toBeGreaterThan(0);
    const quiet = Object.assign(sat, { pressure: { saturated: () => Promise.resolve(false) } });
    expect(await requestAgentClass(headers(fresh), quiet)).toBe("search");
    expect(r.calls.length + fetches, "the quiet read looked nothing up").toBe(madeCalls);
  });

  // cross-repo(viafrei-infra): the edge's $vf_ua_verify map is viafrei-infra's configuration
  it.skip("#1205 review S1: nginx's range-checked claims are the same list as its $vf_ua_verify map", () => {});

  it("#1205 review N6: Google's user-triggered fetchers are no range that makes `search` in the web's verifier", () => {
    const google = CRAWLER_FAMILIES.find((f) => f.name === "google");
    expect(google?.ranges.length).toBe(2);
    expect(google?.ranges.join(" ")).not.toContain("user-triggered");
  });
  // cross-repo(viafrei-infra): the range generator and the edge's configuration are viafrei-infra's
  it.skip("#1205 review N6: nor in the generator or either conf", () => {});

  it("#1205 review S2: an SEO tool keeps nginx's seo class even when the edge vouches for it; a verified search engine or AI assistant is the lane, a verified training crawler is not (#1290)", async () => {
    const r = countingResolver();
    const d = deps({ saturated: true, resolver: r.r, ranges: noRanges });
    for (const ua of ["Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)", "Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)"]) {
      expect(await requestAgentClass(headers({ "user-agent": ua, "x-forwarded-for": SPOOF_IP, "x-vf-agent-class": "seo", [VERIFIED_BOT_HEADER]: "1" }), d), ua).toBe("seo");
    }
    const meta = "meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)";
    // #1290 (owner 2026-11-12): a training crawler is no AI assistant — the crawler lane, however verified
    expect(await requestAgentClass(headers({ "user-agent": meta, "x-forwarded-for": SPOOF_IP, "x-vf-agent-class": "crawler", [VERIFIED_BOT_HEADER]: "1" }), d)).toBe("crawler");
    const fetcher = "Mozilla/5.0 (compatible; meta-externalfetcher/1.1)";
    expect(await requestAgentClass(headers({ "user-agent": fetcher, "x-forwarded-for": SPOOF_IP, "x-vf-agent-class": "crawler", [VERIFIED_BOT_HEADER]: "1" }), d)).toBe("search");
    expect(await requestAgentClass(headers({ "user-agent": GOOGLEBOT, "x-forwarded-for": SPOOF_IP, "x-vf-agent-class": "crawler", [VERIFIED_BOT_HEADER]: "1" }), d)).toBe("search");
    expect(r.calls).toEqual([]);
  });

  // cross-repo(viafrei-infra): the edge's $vf_ua_claimed map is viafrei-infra's configuration
  it.skip("#1205 review S2: meta-externalagent is an AI crawler in nginx's map (the crawler class, which the edge's marker no longer lifts to the lane since #1290: a training crawler), no longer an SEO tool", () => {});

  it("the middleware runs the request under the address-checked class", () => {
    expect(read("packages/web/src/middleware.ts")).toMatch(/const cls = await requestAgentClass\(context\.request\.headers, overloadDeps\(\)\);\s*return withAgentClass\(cls,/);
  });

  it("#1205: the middleware hands the gate that same class, so a verified engine or assistant is never counted against a share", () => {
    const src = read("packages/web/src/middleware.ts");
    expect(src).toMatch(/const interim = await overloadGate\(context\.request, context\.url, nonce, overloadDeps\(\), currentAgentClass\(\)\);/);
    // and the gate runs inside the class's scope: handle() is called from withAgentClass's callback
    expect(src).toMatch(/return withAgentClass\(cls, async \(\): Promise<Response> => \{\s*const response = await handle\(context, next\);/);
  });
});
