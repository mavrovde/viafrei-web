/**
 * #1171: the shell's `POST /fragment/spot` — the island's one request with a precise position. It is a POST whose
 * position is in the body and in no URL (neither the island's nor the digest's), it passes on only a page of ours in
 * the visitor's language, every failure and a slow digest are 204 (the island then shows the cell's cards), and no
 * line of the shell's log — nor of the console — carries a coordinate, whatever happens.
 */
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setLogSink } from "../src/lib/log.js";
import { SPOT_TIMEOUT_MS, spotRoute, type SpotFetch } from "../src/lib/spot.js";
import { ALL, POST } from "../src/pages/fragment/spot.js";

const LAT = 50.951234;
const LON = 6.917891;
const HREF = "/de/fuel/aral-koeln-venloer-strasse-abcdefghij";

let lines: string[] = [];
let restore: () => void = () => undefined;
beforeEach(() => {
  lines = [];
  restore = setLogSink((l) => void lines.push(l));
  for (const m of ["log", "info", "warn", "error", "debug"] as const) vi.spyOn(console, m).mockImplementation((...a: unknown[]) => void lines.push(a.map(String).join(" ")));
});
afterEach(() => {
  restore();
  vi.restoreAllMocks();
});

/** A person's fetch from this origin's page: the headers a browser sends with the island's POST. */
const PERSON = { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36", "sec-fetch-site": "same-origin", "sec-fetch-dest": "empty", "sec-fetch-mode": "cors" } as const;
const req = (body: unknown, o: { method?: string; type?: string; url?: string; headers?: Record<string, string | null> } = {}): Request => {
  const h: Record<string, string> = { "content-type": o.type ?? "application/json" };
  for (const [k, v] of Object.entries({ ...PERSON, ...o.headers })) if (v !== null) h[k] = v;
  return new Request(o.url ?? "http://shell/fragment/spot", { method: o.method ?? "POST", headers: h, ...(o.method === "GET" ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }) });
};
const ASK = { lat: LAT, lon: LON, acc: 12, lang: "de" };
/** A digest stub: records each call and answers `status` with the given headers (or throws / never answers). */
function digest(answer: { status: number; headers?: Record<string, string> } | "throw" | "hang"): { fetch: SpotFetch; calls: { url: string; body: string; method: string }[] } {
  const calls: { url: string; body: string; method: string }[] = [];
  return {
    calls,
    fetch: (url, init) => {
      calls.push({ url, body: init.body, method: init.method });
      if (answer === "throw") return Promise.reject(new Error(`connect ECONNREFUSED near ${String(LAT)}`));
      if (answer === "hang")
        return new Promise((_ok, fail) => init.signal.addEventListener("abort", () => fail(Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" }))));
      const h = answer.headers ?? {};
      return Promise.resolve({ status: answer.status, headers: { get: (n: string) => h[n] ?? null } });
    },
  };
}
const noCoordinate = (): void => {
  const all = lines.join("\n");
  for (const n of [String(LAT), String(LON), "50.95", "6.917"]) expect(all, `a log line carries ${n}`).not.toContain(n);
};

describe("#1171 POST /fragment/spot", () => {
  it("a match: the page as one link, the path and label in the headers; the digest asked by POST with the position in the body alone", async () => {
    const d = digest({ status: 200, headers: { "spot-href": HREF, "spot-label": encodeURIComponent("Aral, Venloer Straße") } });
    const res = await spotRoute(req(ASK), { baseUrl: "http://digest:8791", fetch: d.fetch });
    expect(res.status).toBe(200);
    expect(res.headers.get("spot-href")).toBe(HREF);
    expect(decodeURIComponent(res.headers.get("spot-label") ?? "")).toBe("Aral, Venloer Straße");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(await res.text()).toBe(`<a class="vf-spot" href="${HREF}">Aral, Venloer Straße</a>`);
    expect(d.calls).toEqual([{ url: "http://digest:8791/internal/spot", method: "POST", body: JSON.stringify(ASK) }]);
    // the coordinates are in no URL: not the digest's, and the route reads none from its own
    expect(d.calls[0]?.url).not.toMatch(/\d{2}\.\d/);
    expect(lines).toEqual([]);
  });

  it("no object (204) and a position the digest does not look up (400): 204, and no failure logged", async () => {
    for (const status of [204, 400]) {
      const res = await spotRoute(req(ASK), { baseUrl: "http://digest:8791", fetch: digest({ status }).fetch });
      expect(res.status).toBe(204);
    }
    expect(lines).toEqual([]);
  });

  it("a digest that fails, is unreachable or answers something that is not a page of ours in this language: 204, logged by the path alone", async () => {
    const bad = ["https://example.org/de/fuel/x", "/de/place/koeln", "/en/fuel/x", "/de/fuel/X Y", "/de/fuel/a\nb"];
    const answers = [{ status: 503 }, "throw" as const, ...bad.map((h) => ({ status: 200, headers: { "spot-href": h, "spot-label": "x" } }))];
    for (const a of answers) {
      lines = [];
      const res = await spotRoute(req(ASK), { baseUrl: "http://digest:8791", fetch: digest(a).fetch });
      expect(res.status, JSON.stringify(a)).toBe(204);
      expect(await res.text()).toBe("");
      expect(lines.length, JSON.stringify(a)).toBe(1);
      const line = JSON.parse(lines[0] ?? "{}") as { kind: string; key: string };
      expect(line.key).toBe("/internal/spot");
      noCoordinate();
    }
  });

  it("a digest slower than the deadline: 204 within it, one timeout line by the path, no coordinate", async () => {
    expect(SPOT_TIMEOUT_MS).toBeLessThan(2_000);
    const t0 = Date.now();
    const res = await spotRoute(req(ASK), { baseUrl: "http://digest:8791", fetch: digest("hang").fetch, timeoutMs: 50 });
    expect(res.status).toBe(204);
    expect(Date.now() - t0).toBeLessThan(1_000);
    expect(lines.map((l) => (JSON.parse(l) as { kind: string }).kind)).toEqual(["fragment_timeout"]);
    noCoordinate();
  });

  it("is a POST with a JSON body of finite numbers and a live language — anything else asks the digest nothing", async () => {
    const d = digest({ status: 200, headers: { "spot-href": HREF } });
    const cases: [Request, number][] = [
      [req(null, { method: "GET", url: `http://shell/fragment/spot?lat=${String(LAT)}&lon=${String(LON)}` }), 405],
      [req(ASK, { type: "text/plain" }), 400],
      [req({ ...ASK, lat: "50.95" }), 400],
      [req({ ...ASK, acc: null }), 400],
      [req({ ...ASK, lang: "xx" }), 400],
      [req(`{"lat": ${String(LAT)},`), 400],
      [req({ ...ASK, pad: "x".repeat(600) }), 400],
    ];
    for (const [r, status] of cases) expect((await spotRoute(r, { baseUrl: "http://digest:8791", fetch: d.fetch })).status).toBe(status);
    expect(d.calls).toEqual([]);
    expect(lines).toEqual([]);
  });

  it("C3: a person's lookup only — a crawler, a request without a fetch's Sec-Fetch headers, a navigation, a prefetch or one nginx classed is 204 and the digest is never asked", async () => {
    const d = digest({ status: 200, headers: { "spot-href": HREF, "spot-label": "x" } });
    const cases: [string, Record<string, string | null>][] = [
      ["a crawler's user agent", { "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" }],
      ["no user agent", { "user-agent": null }],
      ["no Sec-Fetch headers", { "sec-fetch-site": null, "sec-fetch-dest": null, "sec-fetch-mode": null }],
      ["another site", { "sec-fetch-site": "cross-site" }],
      ["a navigation's shape", { "sec-fetch-dest": "document", "sec-fetch-mode": "navigate" }],
      ["a prefetch", { "sec-purpose": "prefetch" }],
      ["an agent class (search)", { "x-vf-agent-class": "search" }],
      ["an agent class (crawler)", { "x-vf-agent-class": "crawler" }],
      ["an agent class (seo)", { "x-vf-agent-class": "seo" }],
    ];
    for (const [name, headers] of cases) {
      const res = await spotRoute(req(ASK, { headers }), { baseUrl: "http://digest:8791", fetch: d.fetch });
      expect(res.status, name).toBe(204);
      expect(await res.text(), name).toBe("");
      expect(res.headers.get("cache-control"), name).toBe("no-store");
    }
    expect(d.calls).toEqual([]);
    expect(lines).toEqual([]);
    // and the same request with a person's headers is asked: the gate, not the body, refused them
    expect((await spotRoute(req(ASK), { baseUrl: "http://digest:8791", fetch: d.fetch })).status).toBe(200);
    expect(d.calls.length).toBe(1);
  });

  it("C3: the gate stands before the body is read — a refused request's body is never consumed", async () => {
    const r = req(ASK, { headers: { "x-vf-agent-class": "crawler" } });
    await spotRoute(r, { baseUrl: "http://digest:8791", fetch: digest({ status: 204 }).fetch });
    expect(r.bodyUsed).toBe(false);
  });

  it("the page answers POST only (every other method 405) and asks the digest itself, never the GET fragment cache", () => {
    const r = ALL({} as never) as Response;
    expect(r.status).toBe(405);
    expect(r.headers.get("allow")).toBe("POST");
    expect(typeof POST).toBe("function");
    const src = readFileSync(new URL("../src/pages/fragment/spot.ts", import.meta.url), "utf8");
    expect(src).toContain("baseUrl: readEnv().digestUrl");
    expect(src).not.toContain("fragmentUrl");
  });
});
