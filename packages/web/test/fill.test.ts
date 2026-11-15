/**
 * Render, then fill (#564, owner 2026-10-12): a panel that makes the first
 * render's deadline is in the first HTML; one that misses it is a placeholder
 * of the same shape, filled by the page's one script in the background — the
 * very text the page carries, run here against a fake window — or turned into
 * its error state with its sentence, never left blank.
 */
import { describe, expect, it } from "vitest";
import { all } from "@viafrei/design/testing";
import { fillScript, PANEL_DEADLINE_MS, placeFill, TILE_SHOW_BY_MS, tilePlaceholder, withDeadline } from "../src/lib/fill.js";
import { errorTile, fetchTiles, type FetchLike } from "../src/lib/tiles.js";
import { tileRoute } from "../src/lib/fragment-route.js";
import { FUEL_FILL_MAX_MS, FUEL_FILL_MIN_MS, FUEL_FILL_RETRY_MS } from "../src/lib/fuel-refresh.js";
import { RETRY_WAITS_MS } from "../src/lib/fragment-retry.js";

// ---------------------------------------------------------------------------
// The server half
// ---------------------------------------------------------------------------

/** A digest whose tiles answer after `slow[id]` ms (default at once). */
function digest(slow: Record<string, number> = {}): FetchLike {
  return (url, init) =>
    new Promise((resolve, reject) => {
      const id = /\/internal\/tiles\/([a-z]+)/.exec(url)?.[1] ?? "";
      const fact = url.includes("view=fact");
      const t = setTimeout(() => {
        resolve({
          status: 200,
          headers: { get: (n: string) => ({ "content-type": "text/html; charset=utf-8", "tile-cadence-seconds": "60" })[n] ?? null },
          text: () => Promise.resolve(fact ? `<section class="tile tile--fact is-ok" id="fact-${id}"><p>1</p></section>` : `<section class="tile is-ok" id="tile-${id}"><p>42</p></section>`),
        });
      }, slow[id] ?? 0);
      init.signal.addEventListener("abort", () => {
        clearTimeout(t);
        const e = new Error("aborted");
        e.name = "AbortError";
        reject(e);
      });
    });
}

describe("the first render", () => {
  it("a fast panel is in the first HTML; a slow one is a loading placeholder carrying its same-origin path — and the page does not wait for it", async () => {
    const t0 = Date.now();
    const tiles = await fetchTiles("de", { baseUrl: "http://digest", timeoutMs: 2_000, deadlineMs: 120, fetchImpl: digest({ fuel: 1_500, jams: 1_500 }) });
    expect(Date.now() - t0).toBeLessThan(600);
    expect(tiles.lifts).toMatchObject({ fetched: "ok", html: '<section class="tile is-ok" id="tile-lifts"><p>42</p></section>' });
    expect(tiles.fuel.fetched).toBe("deferred");
    expect(tiles.fuel.html).toMatch(/^<section class="tile is-loading" id="tile-fuel" aria-labelledby="tile-fuel-title" aria-busy="true" data-vf-fill="\/fragment\/tile\?id=fuel&amp;lang=de" data-vf-shape="tile" data-vf-id="tile-fuel">/);
    expect(tiles.jams.fetched).toBe("deferred");
  });

  it("no layout jump: the placeholder is the error tile's box — the same elements, classes and order, only the state and the words differ", () => {
    const shape = (h: string): string => h.replace(/>[^<]*</g, "><").replace(/ (aria-busy|data-vf-[a-z]+)="[^"]*"/g, "").replace(/is-(loading|error)/, "is-X");
    expect(shape(tilePlaceholder("fuel", "Tanken", "de", "/fragment/tile?id=fuel&lang=de"))).toBe(shape(errorTile("fuel", "de")));
  });

  it("a digest that ANSWERS with an error is the error tile at once — only a timeout is deferred, because asking again would not change an error", async () => {
    const failing: FetchLike = () => Promise.resolve({ status: 500, headers: { get: () => null }, text: () => Promise.resolve("") });
    const tiles = await fetchTiles("de", { baseUrl: "http://digest", timeoutMs: 2_000, deadlineMs: 100, fetchImpl: failing });
    expect(tiles.fuel.fetched).toBe("error");
    expect(all(tiles.fuel.html, ".tile.is-error").length).toBeGreaterThan(0);
  });

  it("without a deadline (every other page) nothing changes: the 2 s tile deadline and the error tile", async () => {
    const tiles = await fetchTiles("de", { baseUrl: "http://digest", timeoutMs: 150, fetchImpl: digest({ fuel: 1_000 }) });
    expect(tiles.fuel.fetched).toBe("error");
  });

  it("GET /fragment/tile answers one embedded tile, and refuses anything else", async () => {
    const o = { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: digest() };
    const ok = await tileRoute(new Request("http://shell/fragment/tile?id=fuel&lang=de"), o);
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe('<section class="tile is-ok" id="tile-fuel"><p>42</p></section>');
    for (const q of ["id=nope&lang=de", "id=fuel&lang=ja", "id=fuel", "lang=de"]) expect((await tileRoute(new Request(`http://shell/fragment/tile?${q}`), o)).status, q).toBe(400);
    expect((await tileRoute(new Request("http://shell/fragment/tile?id=fuel&lang=de", { method: "POST" }), o)).status).toBe(405);
    const down: FetchLike = () => Promise.resolve({ status: 500, headers: { get: () => null }, text: () => Promise.resolve("") });
    expect((await tileRoute(new Request("http://shell/fragment/tile?id=fuel&lang=de"), { ...o, fetchImpl: down })).status).toBe(502);
  });

  it("the deadline is half a second, and withDeadline gives the fallback, never a rejection", async () => {
    expect(PANEL_DEADLINE_MS).toBe(500);
    expect(await withDeadline(new Promise(() => undefined), 10, "late")).toBe("late");
    expect(await withDeadline(Promise.resolve(1), 1_000, "late")).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// The browser half: the filler as shipped
// ---------------------------------------------------------------------------

type Node = {
  attrs: Record<string, string>;
  textContent: string;
  classes: Set<string>;
  classList: { add(c: string): void; remove(c: string): void; contains(c: string): boolean };
  children: Node[];
  isConnected: boolean;
  outer: string | null;
  getAttribute(n: string): string | null;
  removeAttribute(n: string): void;
  setAttribute(n: string, v: string): void;
  querySelectorAll(sel: string): Node[];
};

function node(attrs: Record<string, string>, classes: string[] = [], children: Node[] = [], text = ""): Node {
  const n: Node = {
    attrs,
    textContent: text,
    classes: new Set(classes),
    classList: { add: (c) => void n.classes.add(c), remove: (c) => void n.classes.delete(c), contains: (c) => n.classes.has(c) },
    children,
    isConnected: true,
    outer: null,
    getAttribute: (k) => n.attrs[k] ?? null,
    removeAttribute: (k) => void delete n.attrs[k],
    setAttribute: (k, v) => void (n.attrs[k] = v),
    querySelectorAll: (sel) => {
      const all: Node[] = [];
      const walk = (x: Node): void => {
        for (const c of x.children) {
          all.push(c);
          walk(c);
        }
      };
      walk(n);
      if (sel === "[data-vf-failtext]") return all.filter((c) => c.attrs["data-vf-failtext"] !== undefined);
      if (sel.startsWith(".")) return all.filter((c) => c.classes.has(sel.slice(1)));
      return [];
    },
  };
  Object.defineProperty(n, "outerHTML", { set: (v: string) => { n.outer = v; n.isConnected = false; }, get: () => n.outer ?? "" });
  return n;
}

type Answer = { status: number; body: string; headers?: Record<string, string>; delayMs?: number } | "throw";

/** An answer, or (#1224) the answers of the asks in order, the last one repeated. */
function page(panels: Node[], answers: Record<string, Answer | Answer[]>, reduce = false) {
  const fetched: { url: string; init: { method?: string; body?: string; credentials?: string } }[] = [];
  const arrived: Record<string, Node> = {};
  const events: { type: string; detail: unknown }[] = [];
  const listeners: Record<string, (() => void)[]> = {};
  const doc = {
    querySelectorAll: (sel: string) => (sel === "[data-vf-fill]" ? panels.filter((p) => p.isConnected) : []),
    getElementById: (id: string) => (arrived[id] ??= node({ id })),
    addEventListener: (t: string, f: () => void) => void (listeners[t] ??= []).push(f),
    dispatchEvent: (e: { type: string; detail: unknown }) => void events.push({ type: e.type, detail: e.detail }),
  };
  const timers: number[] = [];
  const win = {
    document: doc,
    matchMedia: () => ({ matches: reduce }),
    // Recorded, and run at once: the test asserts the wait asked for, not the clock.
    setTimeout: (f: () => void, ms: number) => {
      timers.push(ms);
      f();
      return 0;
    },
    clearTimeout: () => undefined,
    CustomEvent: class {
      constructor(public type: string, public init?: { detail: unknown }) {}
      get detail(): unknown {
        return this.init?.detail;
      }
    },
    fetch: (url: string, init: { method?: string; body?: string; credentials?: string }) => {
      fetched.push({ url, init });
      const given = answers[url];
      const a = Array.isArray(given) ? (given.length > 1 ? given.shift() : given[0]) : given;
      if (a === undefined || a === "throw") return Promise.reject(new Error("network"));
      return new Promise((r) => setTimeout(() => r({ status: a.status, headers: { get: (n: string) => a.headers?.[n] ?? null }, text: () => Promise.resolve(a.body) }), a.delayMs ?? 0));
    },
  };
  return { win, fetched, arrived, events, listeners, timers };
}

const run = async (w: unknown): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- running the shipped script is the point
  new Function("window", fillScript())(w);
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
};

const tilePanel = (id: string): Node =>
  node({ "data-vf-fill": `/fragment/tile?id=${id}&lang=de`, "data-vf-shape": "tile", "data-vf-id": `tile-${id}`, "aria-busy": "true" }, ["tile", "is-loading"], [
    node({ "data-vf-failtext": "gerade nicht lesbar" }, ["age__state"], [], "wird geladen …"),
    node({ "data-vf-failtext": "Diese Quelle antwortet gerade nicht." }, ["tile__note"], [], "Diese Zahl kommt gleich."),
  ]);

describe("the filler, as shipped (src/lib/fill.ts → the page's inline script)", () => {
  it("is one self-contained expression with no import and nothing the bundler would rename", () => {
    const s = fillScript();
    expect(s).not.toMatch(/\bimport\b|\brequire\(|(^|[^\w-])__name\(|__vite/);
    expect(s).not.toContain("</script");
    expect(s.length).toBeLessThan(6_000);
  });

  it("#712: its literal bounds are the fill rule's own (it runs alone in the page, so it cannot import them)", () => {
    const s = fillScript();
    const read = (name: string): number => Number((new RegExp(`${name}\\s*=\\s*([0-9_.e]+)`).exec(s)?.[1] ?? "NaN").replace(/_/g, ""));
    expect(read("MIN_DELAY_MS")).toBe(FUEL_FILL_MIN_MS);
    expect(read("MAX_DELAY_MS")).toBe(FUEL_FILL_MAX_MS);
    expect(read("RETRY_MS")).toBe(FUEL_FILL_RETRY_MS);
  });

  it("fills a slow tile from this origin and fades it in", async () => {
    const p = tilePanel("fuel");
    const pg = page([p], { "/fragment/tile?id=fuel&lang=de": { status: 200, body: '<section class="tile is-ok" id="tile-fuel"><p>1,799</p></section>' } });
    await run(pg.win);
    expect(pg.fetched).toEqual([{ url: "/fragment/tile?id=fuel&lang=de", init: { headers: { accept: "text/html" }, credentials: "omit" } }]);
    expect(p.outer).toBe('<section class="tile is-ok" id="tile-fuel"><p>1,799</p></section>');
    expect(pg.arrived["tile-fuel"]?.classes.has("is-new")).toBe(true);
  });

  it("#717 C-4: fills the fuel tile whose root carries the Clarity stop marker (the digest's real shape)", async () => {
    const p = tilePanel("fuel");
    const body = '<section class="tile is-ok vf-noclarity" id="tile-fuel"><p>1,799</p></section>';
    const pg = page([p], { "/fragment/tile?id=fuel&lang=de": { status: 200, body } });
    await run(pg.win);
    expect(p.outer).toBe(body);
  });

  it("respects reduced motion: swapped, not faded", async () => {
    const p = tilePanel("fuel");
    const pg = page([p], { "/fragment/tile?id=fuel&lang=de": { status: 200, body: '<section class="tile is-ok" id="tile-fuel"></section>' } }, true);
    await run(pg.win);
    expect(p.outer).not.toBeNull();
    expect(pg.arrived["tile-fuel"]?.classes.has("is-new")).toBe(false);
  });

  it("a background fetch that fails — a 502, a network error, an answer that is not ours — shows the error state with its sentence, never a blank card", async () => {
    for (const a of [{ status: 502, body: "" }, "throw", { status: 200, body: "<p>not a tile</p>" }, { status: 200, body: '<section class="tile is-ok"><script>x</script></section>' }] as const) {
      const p = tilePanel("jams");
      await run(page([p], { "/fragment/tile?id=jams&lang=de": a }).win);
      expect(p.outer, JSON.stringify(a)).toBeNull();
      expect(p.classes.has("is-error")).toBe(true);
      expect(p.classes.has("is-loading")).toBe(false);
      expect(p.attrs["aria-busy"]).toBeUndefined();
      expect(p.children.map((c) => c.textContent)).toEqual(["gerade nicht lesbar", "Diese Quelle antwortet gerade nicht."]);
    }
  });

  it("never fetches outside this origin's fragment routes", async () => {
    for (const path of ["https://evil.example/x", "//evil.example/x", "/api/x", "/fragment/../x"]) {
      const p = node({ "data-vf-fill": path, "data-vf-shape": "tile" }, ["is-loading"]);
      const pg = page([p], {});
      await run(pg.win);
      expect(pg.fetched, path).toEqual([]);
      expect(p.classes.has("is-error")).toBe(true);
    }
  });

  it("the place cards: a POST with the placeholder's body, the place named back to the island — and the fuel card's pending sentence corrected when it fails", async () => {
    const ok = node({ "data-vf-fill": "/fragment/place", "data-vf-body": '{"at":"pt:50.875,6.1725","lang":"de","how":"fill","snap":true}', "data-vf-shape": "place", "data-vf-id": "place-cards" });
    const pg = page([ok], { "/fragment/place": { status: 200, body: '<section class="place" id="place-cards"><p>fresh</p></section>', headers: { "place-label": encodeURIComponent("Alsdorf"), "place-key": "ags:05334002", "place-slug": "alsdorf" } } });
    await run(pg.win);
    expect(pg.fetched[0]?.init).toMatchObject({ method: "POST", body: '{"at":"pt:50.875,6.1725","lang":"de","how":"fill","snap":true}', credentials: "omit" });
    expect(ok.outer).toBe('<section class="place" id="place-cards"><p>fresh</p></section>');
    expect(pg.events).toContainEqual({ type: "vf:filled", detail: { id: "place-cards", label: "Alsdorf", key: "ags:05334002", slug: "alsdorf" } });

    const pendingNote = node({}, ["pcard__fresh", "pcard__fresh--pending"], [], "Die aktuellen Preise werden gerade abgefragt.");
    const bad = node({ "data-vf-fill": "/fragment/place", "data-vf-body": "{}", "data-vf-shape": "place", "data-vf-failsel": ".pcard__fresh--pending", "data-vf-failtext": "Die Preise konnten gerade nicht neu abgefragt werden." }, ["place-fill"], [node({}, ["place"], [pendingNote])]);
    await run(page([bad], { "/fragment/place": { status: 404, body: "" } }).win);
    expect(pendingNote.textContent).toBe("Die Preise konnten gerade nicht neu abgefragt werden.");
  });

  it("#712: a queued card's re-read waits about the queue's ETA, then asks; a wrapped answer (still queued) wakes the scan for it", async () => {
    const body = '{"at":"ags:05913000","lang":"de","how":"fill","polls":1}';
    const retry = node({ "data-vf-fill": "/fragment/place", "data-vf-body": body, "data-vf-shape": "place", "data-vf-id": "place-cards", "data-vf-delay": "49000" });
    const pg = page([retry], { "/fragment/place": { status: 200, body: '<section class="place" id="place-cards"><p>fresh</p></section>' } });
    await run(pg.win);
    expect(pg.timers).toEqual([49_000]);
    expect(pg.fetched).toHaveLength(1);
    expect(pg.fetched[0]?.init.body).toBe(body);
    expect(retry.outer).toBe('<section class="place" id="place-cards"><p>fresh</p></section>');
    // No delay attribute: no wait, as before.
    const plain = node({ "data-vf-fill": "/fragment/place", "data-vf-body": "{}", "data-vf-shape": "place", "data-vf-id": "place-cards" });
    const pg2 = page([plain], { "/fragment/place": { status: 200, body: '<section class="place" id="place-cards"></section>' } });
    await run(pg2.win);
    expect(pg2.timers).toEqual([]);
    // A fill whose answer is the cards wrapped for the retry: accepted as ours, and the scan is woken for it.
    const fill = node({ "data-vf-fill": "/fragment/place", "data-vf-body": "{}", "data-vf-shape": "place", "data-vf-id": "place-cards" });
    const wrapped = '<div class="place-fill" data-vf-fill="/fragment/place" data-vf-delay="21000"><section class="place" id="place-cards"></section></div>';
    const pg3 = page([fill], { "/fragment/place": { status: 200, body: wrapped } });
    await run(pg3.win);
    expect(fill.outer).toBe(wrapped);
    expect(pg3.events.map((e) => e.type)).toEqual(["vf:filled", "vf:fill"]);
    // #712: a wait longer than five minutes is cut to five: a long queue is re-read every five minutes.
    const long = node({ "data-vf-fill": "/fragment/place", "data-vf-body": "{}", "data-vf-shape": "place", "data-vf-id": "place-cards", "data-vf-delay": "999999" });
    const pg4 = page([long], { "/fragment/place": { status: 200, body: '<section class="place" id="place-cards"></section>' } });
    await run(pg4.win);
    expect(pg4.timers).toEqual([300_000]);
  });

  it("a placeholder another rung replaced meanwhile is not filled over the person's choice", async () => {
    const p = tilePanel("fuel");
    const pg = page([p], { "/fragment/tile?id=fuel&lang=de": { status: 200, body: '<section class="tile is-ok" id="tile-fuel"></section>', delayMs: 250 } });
    await run(pg.win);
    // (the fetch is still running — 250 ms leaves room for a loaded full-suite run, which
    // took longer than the old 20 ms to get here) — the island swaps the slot: the placeholder is detached
    p.isConnected = false;
    await new Promise((r) => setTimeout(r, 400));
    expect(p.outer).toBeNull();
  });

  it("the island's `vf:fill` wakes it again for cards it put in the slot, and nothing is fetched twice", async () => {
    const first = tilePanel("fuel");
    const panels = [first];
    const pg = page(panels, { "/fragment/tile?id=fuel&lang=de": { status: 200, body: '<section class="tile is-ok" id="tile-fuel"></section>' }, "/fragment/place": { status: 200, body: '<section class="place" id="place-cards"></section>' } });
    await run(pg.win);
    panels.push(node({ "data-vf-fill": "/fragment/place", "data-vf-body": "{}", "data-vf-shape": "place", "data-vf-id": "place-cards" }));
    for (const l of pg.listeners["vf:fill"] ?? []) l();
    for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
    expect(pg.fetched.map((f) => f.url)).toEqual(["/fragment/tile?id=fuel&lang=de", "/fragment/place"]);
  });

  it("the place placeholder (cards not arrived) says it is loading, and fails to the place's own sentence", () => {
    const h = placeFill(null, { at: "pt:50.875,6.1725", lang: "de", how: "fill", snap: true }, "x", "de");
    expect(h).toMatch(/^<div class="place-fill place-fill--loading is-loading" aria-busy="true" data-vf-fill="\/fragment\/place"/);
    expect(h).toContain('data-vf-failtext="Dieser Ort ließ sich gerade nicht laden.">Die Karten für diesen Ort werden geladen …</p>');
  });
});

describe("#1224: the filler asks a part the digest did not answer again, the placeholder loading meanwhile, as shipped", () => {
  const cards = '<section class="place" id="place-cards"><p>fresh</p></section>';
  const placeholder = (): Node => node({ "data-vf-fill": "/fragment/place", "data-vf-body": '{"at":"ags:05111000","lang":"de","how":"fill"}', "data-vf-shape": "place", "data-vf-id": "place-cards", "aria-busy": "true", "data-vf-failtext": "Dieser Ort konnte gerade nicht geladen werden." }, ["place-fill", "is-loading"]);

  it("a first 503 then the cards: filled, never the error state, after the first wait", async () => {
    const el = placeholder();
    const pg = page([el], { "/fragment/place": [{ status: 503, body: "" }, { status: 200, body: cards }] });
    await run(pg.win);
    expect(pg.fetched).toHaveLength(2);
    expect(pg.timers).toEqual([RETRY_WAITS_MS[0]]);
    expect(el.outer).toBe(cards);
    expect(el.classes.has("is-error")).toBe(false);
  });

  it("no answer at all (a network error) is asked again the same way", async () => {
    const el = placeholder();
    const pg = page([el], { "/fragment/place": ["throw", "throw", { status: 200, body: cards }] });
    await run(pg.win);
    expect(pg.fetched).toHaveLength(3);
    expect(pg.timers).toEqual([RETRY_WAITS_MS[0], RETRY_WAITS_MS[1]]);
    expect(el.outer).toBe(cards);
  });

  it("the error state only once every wait is spent: 1 + RETRY_WAITS_MS.length asks", async () => {
    const el = placeholder();
    const pg = page([el], { "/fragment/place": { status: 503, body: "" } });
    await run(pg.win);
    expect(pg.fetched).toHaveLength(1 + RETRY_WAITS_MS.length);
    expect(pg.timers).toEqual([...RETRY_WAITS_MS]);
    expect(el.classes.has("is-error")).toBe(true);
    expect(el.classes.has("is-loading")).toBe(false);
  });

  it("2.5.22: the shell's LOADING placeholder (a cold read) is ours: put in place still loading, the scan woken, filled after its delay — never the error state", async () => {
    const loading = '<div class="place-fill place-fill--loading is-loading" aria-busy="true" data-vf-fill="/fragment/place" data-vf-body="{}" data-vf-shape="place" data-vf-id="place-cards" data-vf-delay="2000"><p class="place-fill__note">…</p></div>';
    const el = placeholder();
    const panels = [el];
    const pg = page(panels, { "/fragment/place": [{ status: 200, body: loading }, { status: 200, body: cards }] });
    await run(pg.win);
    expect(el.classes.has("is-error")).toBe(false);
    expect(el.outer).toBe(loading);
    expect(pg.events.map((e) => e.type)).toEqual(["vf:filled", "vf:fill"]);
    // the placeholder that arrived, as the page now carries it: filled after its own delay
    const next = node({ "data-vf-fill": "/fragment/place", "data-vf-body": "{}", "data-vf-shape": "place", "data-vf-id": "place-cards", "data-vf-delay": "2000" }, ["place-fill", "place-fill--loading", "is-loading"]);
    panels.push(next);
    for (const l of pg.listeners["vf:fill"] ?? []) l();
    for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
    expect(pg.timers).toEqual([2_000]);
    expect(pg.fetched).toHaveLength(2);
    expect(next.outer).toBe(cards);
    expect(next.classes.has("is-error")).toBe(false);
  });

  it("#1239: a place placeholder is NOT said as failed at the tile's show-by mark — it keeps loading through its asks", async () => {
    const el = placeholder();
    const pg = page([el], { "/fragment/place": [{ status: 503, body: "" }, { status: 200, body: cards }] });
    await run(pg.win);
    expect(pg.timers).not.toContain(TILE_SHOW_BY_MS);
    expect(el.outer).toBe(cards);
  });

  it("a 404 (no such place) is final: asked once, no wait, the error state", async () => {
    const el = placeholder();
    const pg = page([el], { "/fragment/place": { status: 404, body: "" } });
    await run(pg.win);
    expect(pg.fetched).toHaveLength(1);
    expect(pg.timers).toEqual([]);
    expect(el.classes.has("is-error")).toBe(true);
  });
});

describe("#1239: a tile the digest does not answer stops making the visitor wait at TILE_SHOW_BY_MS, and is asked on behind it", () => {
  /** A window with a clock the test moves, and fetches the test answers one by one. */
  function clocked(panel: Node) {
    let now = 0;
    const timers: { at: number; f: () => void }[] = [];
    const pending: ((a: { status: number; body: string }) => void)[] = [];
    const win = {
      document: {
        querySelectorAll: (sel: string) => (sel === "[data-vf-fill]" && panel.isConnected ? [panel] : []),
        getElementById: () => node({}),
        addEventListener: () => undefined,
        dispatchEvent: () => undefined,
      },
      matchMedia: () => ({ matches: true }),
      setTimeout: (f: () => void, ms: number) => {
        const t = { at: now + ms, f };
        timers.push(t);
        return t;
      },
      clearTimeout: (t: unknown) => {
        const i = timers.indexOf(t as (typeof timers)[number]);
        if (i >= 0) timers.splice(i, 1);
      },
      CustomEvent: class {
        constructor(public type: string) {}
      },
      fetch: () =>
        new Promise((r) => {
          pending.push((a) => r({ status: a.status, headers: { get: () => null }, text: () => Promise.resolve(a.body) }));
        }),
    };
    const settle = async (): Promise<void> => {
      for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
    };
    const advance = async (ms: number): Promise<void> => {
      now += ms;
      for (;;) {
        const due = timers.filter((t) => t.at <= now).sort((a, b) => a.at - b.at)[0];
        if (due === undefined) break;
        timers.splice(timers.indexOf(due), 1);
        due.f();
        await settle();
      }
    };
    const answer = async (a: { status: number; body: string }): Promise<void> => {
      pending.shift()?.(a);
      await settle();
    };
    return { win, advance, answer, asks: () => pending.length, timers: () => timers.length };
  }

  it("is inside the owner's two-second ceiling, and shipped in the page's script", () => {
    expect(TILE_SHOW_BY_MS).toBeLessThanOrEqual(2_000);
    expect(fillScript().endsWith(`, ${String(TILE_SHOW_BY_MS)});`)).toBe(true);
  });

  it("a hanging ask: still loading just before the mark, the error state with its sentence AT the mark, the ask still out", async () => {
    const p = tilePanel("lifts");
    const c = clocked(p);
    await run(c.win);
    expect(c.asks()).toBe(1);
    await c.advance(TILE_SHOW_BY_MS - 1);
    expect(p.classes.has("is-loading")).toBe(true);
    await c.advance(1);
    expect(p.classes.has("is-error")).toBe(true);
    expect(p.classes.has("is-loading")).toBe(false);
    expect(p.children.map((n) => n.textContent)).toEqual(["gerade nicht lesbar", "Diese Quelle antwortet gerade nicht."]);
    expect(c.asks()).toBe(1);
  });

  it("asked on behind the error: a later answer replaces the error tile, without a reload", async () => {
    const p = tilePanel("lifts");
    const c = clocked(p);
    await run(c.win);
    await c.advance(TILE_SHOW_BY_MS);
    expect(p.classes.has("is-error")).toBe(true);
    await c.answer({ status: 502, body: "" }); // the shell's tile deadline
    await c.advance(RETRY_WAITS_MS[0] ?? 0);
    expect(c.asks()).toBe(1);
    await c.answer({ status: 200, body: '<section class="tile is-ok" id="tile-lifts"><p>12</p></section>' });
    expect(p.outer).toBe('<section class="tile is-ok" id="tile-lifts"><p>12</p></section>');
  });

  it("a slow but live tile that answers before the mark is filled and never shown as an error", async () => {
    const p = tilePanel("reports");
    const c = clocked(p);
    await run(c.win);
    await c.advance(1_000);
    expect(c.timers()).toBe(1); // the show-by mark, pending
    await c.answer({ status: 200, body: '<section class="tile is-ok" id="tile-reports"><p>3</p></section>' });
    expect(p.outer).toBe('<section class="tile is-ok" id="tile-reports"><p>3</p></section>');
    expect(c.timers()).toBe(0); // and cleared by the answer, not left to fire into a filled tile
    await c.advance(TILE_SHOW_BY_MS);
    expect(p.classes.has("is-error")).toBe(false);
  });

  it("every ask spent: the error state stays, and no more asks than 1 + RETRY_WAITS_MS.length", async () => {
    const p = tilePanel("lifts");
    const c = clocked(p);
    await run(c.win);
    for (const w of [0, ...RETRY_WAITS_MS]) {
      await c.advance(w);
      expect(c.asks()).toBe(1);
      await c.answer({ status: 502, body: "" });
    }
    await c.advance(60_000);
    expect(c.asks()).toBe(0);
    expect(p.classes.has("is-error")).toBe(true);
  });
});
