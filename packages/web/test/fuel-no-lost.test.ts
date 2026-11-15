/**
 * No lost requests (#712, owner 2026-10-15): a person whose fuel request waits
 * in the MCP queue never sees "unavailable" because of a clock or a count.
 * The place card's filler and the motorway layer's script — the very texts the
 * pages carry — run here against a fake browser whose fetch IS the shell's
 * route, over a stubbed MCP queue and a stubbed digest, under a fake clock:
 * they re-read at the queue's ETA (30 s to 5 min apart) until the entry
 * settles, pause while the page is hidden, and resume when it is shown.
 * Nothing here reaches a provider: the MCP process is a stub.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fillScript } from "../src/lib/fill.js";
import { placeRoute } from "../src/lib/fragment-route.js";
import { FUEL_FILL_MAX_MS, FUEL_FILL_MIN_MS, FUEL_FILL_RETRY_MS, type PostLike } from "../src/lib/fuel-refresh.js";
import { motorwayFuelRoute, motorwayFuelScript, MOTORWAY_FUEL_PATH } from "../src/lib/motorway-fuel.js";
import type { FetchLike } from "../src/lib/tiles.js";
import { RETRY_WAITS_MS } from "../src/lib/fragment-retry.js";

const BROWSER = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const FETCH = { "user-agent": BROWSER, "sec-fetch-mode": "cors", "sec-fetch-dest": "empty", "sec-fetch-site": "same-origin" };
const SPACING = 60_000;
const T0 = 1_760_500_000_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => {
  vi.useRealTimers();
});

/**
 * The MCP queue, stubbed by the clock: the entry stands at `start` and moves up
 * one place per key spacing; at 0 it has been sent and is `refreshed`. Until
 * `knownFrom` (an MCP restart) it answers as unreachable. Every ask is recorded.
 */
function queue(o: { start: number; restartUntil?: number; noPlaceUntil?: number }) {
  const asked: number[] = [];
  const f: PostLike = () => {
    const t = Date.now() - T0;
    asked.push(t);
    if (o.restartUntil !== undefined && t < o.restartUntil) return Promise.reject(new Error("ECONNREFUSED"));
    const position = o.start - Math.floor(t / SPACING);
    const answer =
      position <= 0
        ? { state: "refreshed", settledAt: Date.now(), reused: true }
        : o.noPlaceUntil !== undefined && t < o.noPlaceUntil
          ? { state: "pending", settledAt: null, reused: true }
          : { state: "pending", settledAt: null, reused: true, queue: { position, etaMs: position * SPACING - (t % SPACING) } };
    return Promise.resolve({ status: 200, json: () => Promise.resolve(answer) });
  };
  return { asked, f };
}

/** Every HTML the shell answered, so a single "unavailable" anywhere is seen. */
function seen() {
  const bodies: string[] = [];
  return { bodies, unavailable: () => bodies.filter((b) => b.includes("unavailable")) };
}

const unescape = (v: string): string => v.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const attrsOf = (html: string): Record<string, string> => {
  const tag = /^<[a-z]+([^>]*)>/.exec(html)?.[1] ?? "";
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-z-]+)="([^"]*)"/g)) out[m[1]!] = unescape(m[2]!);
  return out;
};

// ---------------------------------------------------------------------------
// The place card: the shipped filler over the shipped place route
// ---------------------------------------------------------------------------

type El = { attrs: Record<string, string>; html: string; isConnected: boolean; classList: { add(): void; remove(): void }; getAttribute(n: string): string | null; setAttribute(n: string, v: string): void; removeAttribute(n: string): void; querySelectorAll(sel: string): unknown[] };

function placePage(mcp: ReturnType<typeof queue>, log: ReturnType<typeof seen>) {
  const panels: El[] = [];
  const listeners: Record<string, (() => void)[]> = {};
  const el = (html: string): El => {
    const e: El = {
      attrs: attrsOf(html),
      html,
      isConnected: true,
      classList: { add: () => undefined, remove: () => undefined },
      getAttribute: (n) => e.attrs[n] ?? null,
      setAttribute: (n, v) => void (e.attrs[n] = v),
      removeAttribute: (n) => void delete e.attrs[n],
      querySelectorAll: (sel) => (sel === ".pcard__fresh--pending" && e.html.includes("pcard__fresh--pending") ? [{}] : []),
    };
    Object.defineProperty(e, "outerHTML", {
      set: (v: string) => {
        e.isConnected = false;
        const next = el(v);
        if (next.attrs["data-vf-fill"] === undefined) next.isConnected = true;
        last.html = v;
        panels.push(next);
      },
    });
    return e;
  };
  const last = { html: "" };
  const doc = {
    hidden: false as boolean,
    querySelectorAll: (sel: string) => (sel === "[data-vf-fill]" ? panels.filter((p) => p.isConnected && p.attrs["data-vf-fill"] !== undefined) : []),
    getElementById: () => ({ classList: { add: () => undefined } }),
    addEventListener: (t: string, f: () => void) => void (listeners[t] ??= []).push(f),
    removeEventListener: (t: string, f: () => void) => void (listeners[t] = (listeners[t] ?? []).filter((x) => x !== f)),
    // a browser's dispatchEvent calls the listeners
    dispatchEvent: (e: { type: string }) => void [...(listeners[e.type] ?? [])].forEach((l) => l()),
  };
  const digest: FetchLike = (url) => {
    const fuel = /[?&]fuel=([a-z]+)/.exec(url)?.[1] ?? "none";
    return Promise.resolve({ status: 200, headers: { get: (n: string) => ({ "content-type": "text/html; charset=utf-8", "place-key": "ags:05913000", "place-label": "Dortmund", "place-point": "0" })[n] ?? null }, text: () => Promise.resolve(`<section class="place" id="place-cards"><p class="pcard__fresh pcard__fresh--${fuel}">${fuel}</p></section>`) });
  };
  const o = { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: digest, refreshUrl: "http://mcp:8788", refreshFetch: mcp.f };
  const reads: number[] = [];
  const timers: number[] = [];
  const shell = { down: false, status: 200 };
  const win = {
    document: doc,
    matchMedia: () => ({ matches: true }),
    setTimeout: (f: () => void, ms: number) => {
      timers.push(ms);
      return setTimeout(f, ms);
    },
    CustomEvent: class {
      constructor(public type: string, public init?: { detail: unknown }) {}
      get detail(): unknown {
        return this.init?.detail;
      }
    },
    fetch: async (url: string, init: { method?: string; body?: string }) => {
      reads.push(Date.now() - T0);
      if (shell.down) throw new Error("network");
      if (shell.status !== 200) return { status: shell.status, headers: new Headers(), text: () => Promise.resolve("") };
      const res = await placeRoute(new Request(`http://shell${url}`, { method: init.method ?? "GET", headers: { ...FETCH, "content-type": "application/json" }, ...(init.body === undefined ? {} : { body: init.body }) }), o);
      const body = await res.text();
      log.bodies.push(body);
      return { status: res.status, headers: res.headers, text: () => Promise.resolve(body) };
    },
  };
  return {
    doc,
    shell,
    reads,
    timers,
    last,
    listeners,
    /** The person chose a place: the first answer, put in the slot, then the filler runs. */
    start: async () => {
      const res = await placeRoute(new Request("http://shell/fragment/place", { method: "POST", headers: { ...FETCH, "content-type": "application/json" }, body: JSON.stringify({ at: "ags:05913000", lang: "de", how: "browser" }) }), o);
      const first = await res.text();
      log.bodies.push(first);
      panels.push(el(first));
      // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- running the shipped script is the point
      new Function("window", fillScript())(win);
    },
  };
}

/** A head entry: position 1, sent at once, its rows stored `settleMs` after the ask. */
function head(settleMs: number) {
  const asked: number[] = [];
  const f: PostLike = () => {
    const t = Date.now() - T0;
    asked.push(t);
    const answer = t >= settleMs ? { state: "refreshed", settledAt: Date.now(), reused: true } : { state: "pending", settledAt: null, reused: true, queue: { position: 1, etaMs: 0 } };
    return Promise.resolve({ status: 200, json: () => Promise.resolve(answer) });
  };
  return { asked, f };
}

describe("info as soon as possible (owner 2026-10-15): a head entry is on the card about two seconds after it settles", () => {
  it("the place card: settled 1 s after the ask, on the card within 3 s", async () => {
    const log = seen();
    const pg = placePage(head(1_000), log);
    await pg.start();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(pg.last.html).toContain("pcard__fresh--refreshed");
    expect(pg.reads).toEqual([FUEL_FILL_MIN_MS]);
  });

  it("the motorway layer: settled 1 s after the view, filled within 3 s", async () => {
    const pg = motorwayPage(head(1_000), seen());
    await pg.view();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(pg.out.html).toContain("ARAL 1,689");
    expect(pg.reads).toEqual([0, FUEL_FILL_MIN_MS]);
  });

  it("a head still pending backs off 2 → 4 → 8 → 16 s", async () => {
    const log = seen();
    const pg = placePage(head(25_000), log);
    await pg.start();
    await vi.advanceTimersByTimeAsync(40_000);
    expect(pg.reads).toEqual([2_000, 6_000, 14_000, 30_000]);
    expect(pg.last.html).toContain("pcard__fresh--refreshed");
  });
});

describe("the place card keeps reading until the entry settles — no count, no clock (#712, owner 2026-10-15)", () => {
  it("an entry at position 60: re-read at the ETA, 30 s to 5 min apart, filled in when it settles, never 'unavailable'", async () => {
    const mcp = queue({ start: 60 });
    const log = seen();
    const pg = placePage(mcp, log);
    await pg.start();
    await vi.advanceTimersByTimeAsync(2 * 3_600_000);
    expect(log.unavailable()).toEqual([]);
    expect(pg.last.html).toContain("pcard__fresh--refreshed");
    // the filler stopped once it settled: nothing more is wrapped to be read
    expect(pg.last.html).not.toContain("data-vf-fill");
    const settledAt = pg.reads.at(-1)!;
    expect(settledAt).toBeGreaterThanOrEqual(60 * SPACING);
    expect(settledAt).toBeLessThan(60 * SPACING + FUEL_FILL_MIN_MS + 5_000);
    // spaced by the ETA, inside 30 s … 5 min; an hour's queue cost about a dozen re-reads, not sixty
    const gaps = pg.reads.slice(1).map((t, i) => t - pg.reads[i]!);
    for (const g of gaps) {
      expect(g).toBeGreaterThanOrEqual(FUEL_FILL_MIN_MS);
      expect(g).toBeLessThanOrEqual(FUEL_FILL_MAX_MS + 100);
    }
    expect(pg.reads[0]).toBe(FUEL_FILL_MAX_MS);
    // each gap is the ETA the previous read was told, plus the request's own 1.5 s, inside 2 s … 5 min
    for (let i = 1; i < pg.reads.length; i++) {
      const t = pg.reads[i - 1]!;
      const position = 60 - Math.floor(t / SPACING);
      if (position < 2) continue; // the head backs off instead
      const eta = position * SPACING - (t % SPACING);
      expect(pg.reads[i]! - t, `after ${String(t)}`).toBe(Math.min(FUEL_FILL_MAX_MS, Math.max(FUEL_FILL_MIN_MS, eta + 1_500)));
    }
    expect(pg.reads.length).toBeGreaterThan(10);
    expect(pg.reads.length).toBeLessThan(25);
    // every re-read submitted again (a restart's lost entry would be asked again)
    expect(mcp.asked.length).toBe(pg.reads.length + 1);
  });

  it("long past thirty re-reads (the queue answers no place for 40 min, then an MCP restart): still reading, still pending, then filled", async () => {
    const mcp = queue({ start: 45, noPlaceUntil: 40 * SPACING, restartUntil: 5 * SPACING });
    const log = seen();
    const pg = placePage(mcp, log);
    await pg.start();
    await vi.advanceTimersByTimeAsync(2 * 3_600_000);
    expect(pg.reads.length).toBeGreaterThan(30);
    expect(log.unavailable()).toEqual([]);
    expect(pg.last.html).toContain("pcard__fresh--refreshed");
  });

  it("hidden, the page asks nothing; shown again, it reads at once and goes on", async () => {
    const mcp = queue({ start: 60 });
    const log = seen();
    const pg = placePage(mcp, log);
    await pg.start();
    await vi.advanceTimersByTimeAsync(FUEL_FILL_MAX_MS + 1_000);
    expect(pg.reads).toHaveLength(1);
    pg.doc.hidden = true;
    await vi.advanceTimersByTimeAsync(30 * 60_000);
    expect(pg.reads).toHaveLength(1);
    pg.doc.hidden = false;
    pg.doc.dispatchEvent({ type: "visibilitychange" });
    await vi.advanceTimersByTimeAsync(0);
    expect(pg.reads).toHaveLength(2);
    expect(pg.reads[1]).toBe(FUEL_FILL_MAX_MS + 1_000 + 30 * 60_000);
    await vi.advanceTimersByTimeAsync(2 * 3_600_000);
    expect(log.unavailable()).toEqual([]);
    expect(pg.last.html).toContain("pcard__fresh--refreshed");
    expect(pg.listeners["visibilitychange"] ?? []).toEqual([]);
  });

  it("the shell itself unreachable or answering 502 for a while: the pending card is read again, never said 'unavailable'", async () => {
    const mcp = queue({ start: 20 });
    const log = seen();
    const pg = placePage(mcp, log);
    await pg.start();
    pg.shell.down = true;
    await vi.advanceTimersByTimeAsync(10 * SPACING);
    pg.shell.down = false;
    pg.shell.status = 502;
    await vi.advanceTimersByTimeAsync(5 * SPACING);
    expect(pg.reads.length).toBeGreaterThan(2);
    pg.shell.status = 200;
    await vi.advanceTimersByTimeAsync(2 * 3_600_000);
    expect(log.unavailable()).toEqual([]);
    expect(pg.last.html).toContain("pcard__fresh--refreshed");
    // Never at once. While the shell did not answer (down, then 502: reads before 15 spacings), a read is one round of
    // #1224's ask-again — the ask, then exactly RETRY_WAITS_MS after it — and a spent round is tried again after the
    // 30 s retry; once the shell answers, a re-read waits the minimum at least.
    const failing = 15 * SPACING;
    let k = 0;
    for (let i = 1; i < pg.reads.length; i++) {
      const gap = pg.reads[i]! - pg.reads[i - 1]!;
      if (pg.reads[i - 1]! >= failing) {
        expect(gap).toBeGreaterThanOrEqual(FUEL_FILL_MIN_MS);
      } else if (k < RETRY_WAITS_MS.length) {
        expect(gap, `ask ${k + 2} of a round`).toBe(RETRY_WAITS_MS[k]);
        k += 1;
      } else {
        expect(gap, "a spent round is tried again after the retry").toBeGreaterThanOrEqual(FUEL_FILL_RETRY_MS);
        k = 0;
      }
    }
    // and there were rounds to judge: the shell failed for 15 spacings, so more than one round was spent
    expect(pg.reads.filter((t) => t < failing).length).toBeGreaterThan(2 * (1 + RETRY_WAITS_MS.length));
  });

  it("only the MCP process's verdict says 'unavailable': a failed entry ends the reading with it", async () => {
    let failed = false;
    const base = queue({ start: 10 });
    const mcp = { asked: base.asked, f: ((u, i) => (failed ? Promise.resolve({ status: 200, json: () => Promise.resolve({ state: "failed", settledAt: null, reused: true }) }) : base.f(u, i))) as PostLike };
    const log = seen();
    const pg = placePage(mcp, log);
    await pg.start();
    await vi.advanceTimersByTimeAsync(4 * SPACING);
    expect(log.unavailable()).toEqual([]);
    failed = true;
    await vi.advanceTimersByTimeAsync(FUEL_FILL_MAX_MS);
    expect(pg.last.html).toContain("pcard__fresh--unavailable");
    expect(pg.last.html).not.toContain("data-vf-fill");
  });
});

// ---------------------------------------------------------------------------
// The motorway layer: the shipped view script over the shipped route
// ---------------------------------------------------------------------------

function motorwayPage(mcp: ReturnType<typeof queue>, log: ReturnType<typeof seen>) {
  const listeners: Record<string, (() => void)[]> = {};
  const node = (): { hidden: boolean; style: { visibility: string }; disabled: boolean; handlers: Record<string, () => Promise<void>>; addEventListener(t: string, f: () => Promise<void>): void } => {
    const n = { hidden: true, style: { visibility: "" }, disabled: false, handlers: {} as Record<string, () => Promise<void>>, addEventListener: (t: string, f: () => Promise<void>) => void (n.handlers[t] = f) };
    return n;
  };
  const l = node();
  const f = node();
  const n = node();
  const out = {
    isConnected: true,
    html: "",
    /** #1061 review B7: whether a pager fold inside the output is open (a person reading page 2). */
    foldOpen: false,
    querySelector: (sel: string): unknown => (sel === ".pager[open]" && out.foldOpen ? {} : null),
    firstElementChild: null as null | { getAttribute(a: string): string | null },
    set innerHTML(v: string) {
      out.html = v;
      const a = attrsOf(v);
      out.firstElementChild = { getAttribute: (k: string) => a[k] ?? null };
    },
  };
  const section = { querySelector: (sel: string) => ({ ".motorway__fuelout": out, ".motorway__fuelloading": l, ".motorway__fuelfailed": f, ".motorway__nojs": n })[sel] ?? null };
  const doc = {
    hidden: false as boolean,
    querySelector: (sel: string) => (sel === ".motorway__fuel" ? section : null),
    addEventListener: (t: string, g: () => void) => void (listeners[t] ??= []).push(g),
    removeEventListener: (t: string, g: () => void) => void (listeners[t] = (listeners[t] ?? []).filter((x) => x !== g)),
  };
  // the digest: an empty stretch naming its one point, until the entry settled; then the stations
  const digest: FetchLike = (url) => {
    const note = /[?&]fuel=([a-z]+)/.exec(url)?.[1] ?? null;
    const priced = note === "refreshed";
    return Promise.resolve({
      status: 200,
      headers: { get: (h: string) => (h === "fuel-ask" && !priced ? "pt:51.5123,7.4567" : null) },
      text: () => Promise.resolve(priced ? '<div class="motorway-fuel"><ul><li>ARAL 1,689</li></ul></div>' : `<div class="motorway-fuel">${note === null ? "" : `<p class="pcard__fresh pcard__fresh--${note}">${note}</p>`}</div>`),
    });
  };
  const reads: number[] = [];
  const fetchImpl = async (url: string) => {
    reads.push(Date.now() - T0);
    const res = await motorwayFuelRoute(new Request(`https://viafrei.de${url}`, { headers: FETCH }), { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: digest, refreshUrl: "http://mcp:8788", refreshFetch: mcp.f });
    const body = await res.text();
    log.bodies.push(body);
    return { ok: res.status === 200, text: () => Promise.resolve(body) };
  };
  // The card coming into view (owner 2026-10-26, PF2 on the motorway layer): the script runs, and with no
  // IntersectionObserver in this harness it reads at once — so "nothing before the view" is nothing before `view`.
  const view = async (): Promise<void> => {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- running the shipped script is the point
    new Function("document", "location", "fetch", "setTimeout", motorwayFuelScript())(doc, { pathname: "/de/autobahn/a4", search: "" }, fetchImpl, setTimeout);
    await vi.advanceTimersByTimeAsync(0);
  };
  return { doc, reads, out, failed: f, listeners, view };
}

describe("the motorway layer keeps reading until the entry settles (#712, owner 2026-10-15)", () => {
  it("an empty stretch in view, position 60: re-read at the ETA (30 s … 5 min), filled when it settles, never 'unavailable'", async () => {
    const mcp = queue({ start: 60 });
    const log = seen();
    const pg = motorwayPage(mcp, log);
    expect(pg.reads).toEqual([]); // nothing before the view
    await pg.view();
    expect(pg.out.html).toMatch(/^<div class="motorway-fuel" data-vf-refill="300000" data-vf-polls="1" data-vf-head="0"><p class="pcard__fresh pcard__fresh--pending">/);
    await vi.advanceTimersByTimeAsync(2 * 3_600_000);
    expect(log.unavailable()).toEqual([]);
    expect(pg.out.html).toContain("ARAL 1,689");
    expect(pg.failed.hidden).toBe(true);
    const gaps = pg.reads.slice(1).map((t, i) => t - pg.reads[i]!);
    expect(gaps.length).toBeGreaterThan(10);
    for (const g of gaps) {
      expect(g).toBeGreaterThanOrEqual(FUEL_FILL_MIN_MS);
      expect(g).toBeLessThanOrEqual(FUEL_FILL_MAX_MS + 100);
    }
    expect(mcp.asked.length).toBe(pg.reads.length);
    expect(MOTORWAY_FUEL_PATH).toBe("/fragment/motorway-fuel");
  });

  it("past thirty re-reads (no place for 40 min, an MCP restart first): still pending, then filled", async () => {
    const mcp = queue({ start: 45, noPlaceUntil: 40 * SPACING, restartUntil: 5 * SPACING });
    const log = seen();
    const pg = motorwayPage(mcp, log);
    await pg.view();
    await vi.advanceTimersByTimeAsync(2 * 3_600_000);
    expect(pg.reads.length).toBeGreaterThan(30);
    expect(log.unavailable()).toEqual([]);
    expect(pg.out.html).toContain("ARAL 1,689");
  });

  it("review B7: an open pager fold is never closed by a re-read — the re-read waits until the fold is closed", async () => {
    const mcp = queue({ start: 60 });
    const pg = motorwayPage(mcp, seen());
    await pg.view();
    expect(pg.reads).toHaveLength(1);
    const shown = pg.out.html;
    pg.out.foldOpen = true;
    await vi.advanceTimersByTimeAsync(40 * 60_000);
    expect(pg.reads).toHaveLength(1);
    expect(pg.out.html).toBe(shown);
    pg.out.foldOpen = false;
    await vi.advanceTimersByTimeAsync(FUEL_FILL_MAX_MS + 100);
    expect(pg.reads.length).toBeGreaterThan(1);
  });

  it("hidden, the layer asks nothing; shown again, it reads at once", async () => {
    const mcp = queue({ start: 60 });
    const pg = motorwayPage(mcp, seen());
    await pg.view();
    pg.doc.hidden = true;
    await vi.advanceTimersByTimeAsync(40 * 60_000);
    expect(pg.reads).toHaveLength(1);
    pg.doc.hidden = false;
    for (const g of [...(pg.listeners["visibilitychange"] ?? [])]) g();
    await vi.advanceTimersByTimeAsync(0);
    expect(pg.reads).toHaveLength(2);
    expect(pg.reads[1]).toBe(40 * 60_000);
    expect(pg.listeners["visibilitychange"] ?? []).toEqual([]);
  });
});
