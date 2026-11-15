/**
 * #1184 phase 2 against the REAL built shell (data-steward ruling 2026-11-04, P2, P4, P6): while the digest says its
 * person pool is saturated, a place page is the interim page — a 503 with `no-store`, `X-Robots-Tag: noindex`, the
 * Impressum and Datenschutz links and no analytics — and a real browser passes it with NO interaction: the page's
 * script solves the challenge, the shell sets `__Host-vf_pass`, and the reload lands on the place page itself. A
 * client that runs no script reads the 503. With the pool NOT saturated, the same request is the page as always and
 * no `Set-Cookie` of the pass is sent.
 *
 * Since #1205 the challenge trips PER CLIENT (`overload/trip.ts`): while the pool is saturated a client is served its
 * first `TRIP_LIMIT` database pages of a window and only the next one is the interim page. Each case is therefore one
 * client of its own — a documentation address (RFC 5737) in `X-Forwarded-For`, the one header the shell reads it from
 * — that first spends its share (`spend`, each of those pages asserted 200) and is then asked the question.
 *
 * The digest is the stand-in of `stub-digest.ts` behind a small front that answers `/internal/pressure` (`saturated`
 * on one shell, `ok` on the other) and forwards everything else. Loopback only; no wait above 2 s.
 *
 * NOTE (not run on macOS, owner rule): `__Host-` needs `Secure`; Chromium treats http://127.0.0.1 as a potentially
 * trustworthy origin and keeps a Secure cookie there. Should a Chromium build ever stop doing so, this suite goes red
 * on the cookie assertion, not green on nothing.
 */
import type { ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startShell } from "./server.js";
import { startStubDigest } from "./stub-digest.js";
import { POPULAR_PLACES, popularSlug } from "../src/site/places.js";
import { pathFor } from "../src/site/pages.js";
import { PASS_COOKIE } from "../src/overload/pass.js";
import { CHALLENGE_COPY } from "../src/overload/copy.js";
import { TRIP_LIMIT } from "../src/overload/trip.js";

const ID = { IMPRESSUM_NAME: "Overload Probe", IMPRESSUM_STREET: "Probeweg 3", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "overload@example.invalid" };
const SATURATED = 8975;
const CALM = 8976;
const SLUG = popularSlug(POPULAR_PLACES[0]!);
const PLACE = `/de/place/${SLUG}`;
const url = (port: number, path: string): string => `http://127.0.0.1:${String(port)}${path}`;

let stub: Awaited<ReturnType<typeof startStubDigest>>;
const fronts: Server[] = [];
const shells: ChildProcess[] = [];
let browser: Browser;

/** One client per case (#1205: the trip counts per client); RFC 5737 documentation addresses. */
const CLIENT = { curl: "192.0.2.41", googlebot: "192.0.2.42", browser: "192.0.2.43", nojs: "192.0.2.44", within: "192.0.2.45", other: "192.0.2.46" } as const;
const xff = (ip: string): Record<string, string> => ({ "x-forwarded-for": ip });

/** Spend `ip`'s share of the saturated pool (#1205): its first `TRIP_LIMIT` database pages are served as always. */
async function spend(ip: string, ua = "curl/8.0"): Promise<void> {
  for (let i = 0; i < TRIP_LIMIT; i += 1) {
    const r = await fetch(url(SATURATED, PLACE), { headers: { "user-agent": ua, ...xff(ip) }, redirect: "manual" });
    expect(r.status).toBe(200);
    await r.arrayBuffer();
  }
}

/** Headers a forwarding front must not copy: the body is re-sent whole and decoded. */
const HOP = new Set(["connection", "keep-alive", "transfer-encoding", "content-length", "content-encoding"]);

/** A front for the stub digest that answers the pressure route with `answer` and forwards the rest. */
async function front(answer: "saturated" | "ok"): Promise<string> {
  const s = createServer((req, res) => {
    if ((req.url ?? "").split("?")[0] === "/internal/pressure") {
      res.writeHead(200, { "content-type": "text/plain" }).end(`${answer}\n`);
      return;
    }
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string" && k !== "host" && k !== "content-length") headers[k] = v;
      fetch(`${stub.url}${req.url ?? "/"}`, { method: req.method ?? "GET", headers, ...(chunks.length > 0 ? { body: Buffer.concat(chunks) } : {}), signal: AbortSignal.timeout(1_500) })
        .then(async (r) => {
          const body = Buffer.from(await r.arrayBuffer());
          // the digest's answer headers too (`place-key`, `place-label`, …): without them the shell cannot read the
          // cards, defers them, and a place page whose name no index gives is a 503 — on the CALM shell as well
          const out: Record<string, string> = {};
          r.headers.forEach((v, k) => {
            if (!HOP.has(k)) out[k] = v;
          });
          res.writeHead(r.status, out).end(body);
        })
        .catch(() => res.writeHead(502).end());
    });
  });
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", () => r()));
  fronts.push(s);
  return `http://127.0.0.1:${String((s.address() as AddressInfo).port)}`;
}

beforeAll(async () => {
  stub = await startStubDigest({}, 1_500, { fullCards: true });
  shells.push(await startShell(SATURATED, { ...ID, DIGEST_URL: await front("saturated"), GOOGLE_TAG: "G-0" }));
  shells.push(await startShell(CALM, { ...ID, DIGEST_URL: await front("ok"), GOOGLE_TAG: "G-0" }));
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser.close();
  for (const s of shells) s.kill();
  for (const f of fronts) await new Promise<void>((r) => f.close(() => r()));
  await stub.close();
});

describe("#1184 phase 2: the overload check in the built shell", () => {
  it("a client within its share of the saturated pool is served the page, and another client's share is its own (#1205)", async () => {
    await spend(CLIENT.within);
    const r = await fetch(url(SATURATED, PLACE), { headers: { "user-agent": "curl/8.0", ...xff(CLIENT.within) } });
    expect(r.status).toBe(503);
    await r.arrayBuffer();
    const o = await fetch(url(SATURATED, PLACE), { headers: { "user-agent": "curl/8.0", ...xff(CLIENT.other) } });
    expect(o.status).toBe(200);
    expect(o.headers.get("set-cookie") ?? "").not.toContain(PASS_COOKIE);
    expect(await o.text()).not.toContain('id="vf-pass"');
  });

  it("a client that runs no script reads the interim page: 503, no-store, noindex, the legal links, no analytics (P6)", async () => {
    await spend(CLIENT.curl);
    const r = await fetch(url(SATURATED, PLACE), { headers: { "user-agent": "curl/8.0", ...xff(CLIENT.curl) }, redirect: "manual" });
    expect(r.status).toBe(503);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("x-robots-tag")).toBe("noindex");
    expect(r.headers.get("retry-after")).toBe("60");
    expect(r.headers.get("set-cookie") ?? "").not.toContain(PASS_COOKIE);
    const html = await r.text();
    expect(html).toContain(CHALLENGE_COPY.de.line);
    expect(html).toContain(`href="${pathFor("impressum", "de")}"`);
    expect(html).toContain(`href="${pathFor("datenschutz", "de")}"`);
    // no analytics, no consent bar, even with a tag set
    expect(html).not.toMatch(/googletagmanager|gtag\(|clarity|consent/i);
  });

  it("a spoofed Googlebot from loopback is challenged like any client (P7)", async () => {
    const ua = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
    await spend(CLIENT.googlebot, ua);
    const r = await fetch(url(SATURATED, PLACE), { headers: { "user-agent": ua, ...xff(CLIENT.googlebot) } });
    expect(r.status).toBe(503);
  });

  it("a browser passes with no interaction: the cookie is set and the reload is the place page (P2, P4)", async () => {
    await spend(CLIENT.browser);
    const ctx = await browser.newContext({ extraHTTPHeaders: xff(CLIENT.browser) });
    // nothing leaves loopback (the offline rule): the tag's script, were the page to ask for it, is aborted here
    await ctx.route(/^(?!http:\/\/127\.0\.0\.1[:/])/, (r) => r.abort());
    const page = await ctx.newPage();
    const statuses: number[] = [];
    page.on("response", (res) => {
      if (new URL(res.url()).pathname === PLACE) statuses.push(res.status());
    });
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.goto(url(SATURATED, PLACE));
    await page.waitForFunction(() => document.getElementById("vf-pass") === null, undefined, { timeout: 2_000 });
    expect(statuses[0]).toBe(503);
    expect(statuses.at(-1)).toBe(200);
    const pass = (await ctx.cookies()).find((c) => c.name === PASS_COOKIE);
    expect(pass).toBeDefined();
    expect(pass?.httpOnly).toBe(true);
    expect(pass?.secure).toBe(true);
    expect(pass?.sameSite).toBe("Lax");
    expect(pass?.path).toBe("/");
    expect(pass?.expires).toBe(-1); // a browser-session cookie (P3)
    expect(pass?.value).toMatch(/^1\.\d+\.[0-9a-f]{32}\.[A-Za-z0-9_-]{43}$/);
    // the script wrote no storage and read no cookie it could see (P4)
    expect(await page.evaluate(() => [localStorage.length, sessionStorage.length, document.cookie.includes("vf_pass")])).toEqual([0, 0, false]);
    expect(errors.filter((e) => /Content Security Policy/i.test(e))).toEqual([]);
    await ctx.close();
  });

  it("the interim page in a browser shows both legal links (P6)", async () => {
    await spend(CLIENT.nojs);
    const ctx = await browser.newContext({ javaScriptEnabled: false, extraHTTPHeaders: xff(CLIENT.nojs) });
    const page = await ctx.newPage();
    const res = await page.goto(url(SATURATED, PLACE));
    expect(res?.status()).toBe(503);
    expect(await page.locator(`footer a[href="${pathFor("impressum", "de")}"]`).count()).toBe(1);
    expect(await page.locator(`footer a[href="${pathFor("datenschutz", "de")}"]`).count()).toBe(1);
    expect(await page.locator("noscript").count()).toBe(1);
    await ctx.close();
  });

  it("with the pool NOT saturated there is no challenge and no pass cookie (P2)", async () => {
    const r = await fetch(url(CALM, PLACE), { headers: { "user-agent": "curl/8.0" } });
    expect(r.status).toBe(200);
    expect(r.headers.get("set-cookie") ?? "").not.toContain(PASS_COOKIE);
    expect(await r.text()).not.toContain('id="vf-pass"');
    const post = await fetch(url(CALM, "/_vf/pass"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ c: "x", n: 0 }) });
    expect(post.status).toBe(400);
    expect(post.headers.get("set-cookie")).toBeNull();
  });
});
