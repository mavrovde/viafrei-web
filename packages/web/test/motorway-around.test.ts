/**
 * #890: the shell half of "around you" — the POST route the island calls, the radius of the address, and the
 * constants held equal to the digest's (the site may not import the digest, so its source is read).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { all } from "@viafrei/design/testing";
import { AROUND_CHIPS_KM, AROUND_DEFAULT_KM, AROUND_MIN_MS, AROUND_MAX_KM, AROUND_MIN_KM, aroundFirstRender, aroundRadius, motorwayAroundOn, motorwayAroundRoute } from "../src/lib/motorway-around.js";
import { motorwayViewQuery } from "../src/lib/motorway.js";

const DIGEST = readFileSync(join(import.meta.dirname, "../../digest/src/analysis/motorway-around.ts"), "utf8");
const SECTION = '<section class="mwa" id="motorway-around" aria-labelledby="mwa-h"><h2>x</h2></section>';

function route(body: unknown, answer: { status?: number; html?: string } = {}): Promise<{ res: Response; asked: string[] }> {
  const asked: string[] = [];
  const fetchImpl = (url: string): Promise<Response> => {
    asked.push(url);
    return Promise.resolve(new Response(answer.html ?? SECTION, { status: answer.status ?? 200, headers: { "content-type": "text/html; charset=utf-8", "place-key": "pt:51.31,9.4875", "place-label": encodeURIComponent("A7 · Kassel") } }));
  };
  const req = new Request("http://shell/fragment/motorway-around", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return motorwayAroundRoute(req, { baseUrl: "http://digest", timeoutMs: 1000, fetchImpl: fetchImpl }, true).then((res) => ({ res, asked }));
}

describe("the radius constants are the digest's", () => {
  it("chips, default and bounds", () => {
    expect(DIGEST).toContain(`RADIUS_CHIPS_KM = [${AROUND_CHIPS_KM.join(", ")}] as const`);
    expect(DIGEST).toContain(`RADIUS_DEFAULT_KM = ${String(AROUND_DEFAULT_KM)};`);
    expect(DIGEST).toContain(`RADIUS_MIN_KM = ${String(AROUND_MIN_KM)};`);
    expect(DIGEST).toContain(`RADIUS_MAX_KM = ${String(AROUND_MAX_KM)};`);
  });
});

describe("the radius of the address (?r=)", () => {
  it("an integer 1–100, else 25; the raw value is passed on so the digest can say it fell back", () => {
    expect(aroundRadius(new URLSearchParams("r=5"))).toEqual({ km: 5, raw: "5" });
    expect(aroundRadius(new URLSearchParams(""))).toEqual({ km: 25, raw: null });
    expect(aroundRadius(new URLSearchParams("r=abc"))).toEqual({ km: 25, raw: "abc" });
    expect(aroundRadius(new URLSearchParams("r=500"))).toEqual({ km: 25, raw: "500" });
  });

  it("is a view option a redirect keeps (and the canonical drops: the page is a variant)", () => {
    expect(motorwayViewQuery(new URLSearchParams("r=10"))).toBe("r=10");
    expect(motorwayViewQuery(new URLSearchParams("f=1&layer=parking&r=10"))).toBe("f=1&layer=parking&r=10");
    expect(motorwayViewQuery(new URLSearchParams("r=x"))).toBe("");
  });
});

describe("POST /fragment/motorway-around", () => {
  it("forwards the cell, the radius and how it was found to the digest, and answers its block no-store", async () => {
    const { res, asked } = await route({ at: "pt:51.31,9.4875", road: "A7", r: 10, how: "browser", lang: "de" });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.text()).toBe(SECTION);
    expect(asked).toEqual(["http://digest/internal/motorway/A7/around?at=pt%3A51.31%2C9.4875&r=10&how=browser&lang=de"]);
  });

  it("passes the page's chosen stretch on (a path segment, never a direction or anything else)", async () => {
    expect((await route({ at: "pt:51.31,9.4875", road: "A7", r: 10, lang: "de", s: "nesselwang-to-kempten" })).asked[0]).toMatch(/&stretch=nesselwang-to-kempten$/);
    for (const s of ["towards-wuerzburg", "x&y", 5]) expect((await route({ at: "pt:51.31,9.4875", road: "A7", r: 10, lang: "de", s })).asked[0]).not.toContain("stretch=");
  });

  it("refuses a body that is not one: no lang, no road, a road spelt otherwise, no key", async () => {
    for (const b of [{ at: "pt:51.31,9.4875", road: "A7" }, { at: "pt:51.31,9.4875", lang: "de" }, { at: "pt:51.31,9.4875", road: "A 7", lang: "de" }, { road: "A7", lang: "de" }]) {
      const { res, asked } = await route(b);
      expect(res.status, JSON.stringify(b)).toBe(400);
      expect(asked).toEqual([]);
    }
  });

  it("a digest that refused or answered something else is a 404 with no body", async () => {
    expect((await route({ at: "pt:51.31,9.4875", road: "A7", lang: "de" }, { status: 400, html: "<p>no</p>" })).res.status).toBe(404);
    expect((await route({ at: "pt:51.31,9.4875", road: "A7", lang: "de" }, { html: "<div>other</div>" })).res.status).toBe(404);
  });
});

describe("2.3.8: the page's main block follows the radius (owner 2026-10-21)", () => {
  const MAIN = '<section class="motorway" id="motorway" data-title="A7 aktuell: x" data-description="A7 y" aria-labelledby="motorway-now-t"><p class="lead motorway__intro">Die A7 führt …</p><h2 class="motorway__h2" id="motorway-now-t">Jetzt</h2></section>';

  it("the digest's main block rides after the around block in an inert <template>, its head attributes and intro taken off (G5.4: the page keeps its own)", async () => {
    const { res } = await route({ at: "pt:51.31,9.4875", road: "A7", r: 10, how: "browser", lang: "de" }, { html: SECTION + MAIN });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.text();
    expect(body.startsWith(SECTION)).toBe(true);
    expect(all(body, 'template[id="mw-main-next"] section.motorway[id="motorway"][aria-labelledby="motorway-now-t"] h2').length).toBeGreaterThan(0);
    expect(body).not.toContain("data-title");
    expect(body).not.toContain("motorway__intro");
    expect(body.endsWith("</section></template>")).toBe(true);
  });

  it("no main block from the digest (a stretch in the address wins): the block alone, as before", async () => {
    expect(await (await route({ at: "pt:51.31,9.4875", road: "A7", lang: "de" })).res.text()).toBe(SECTION);
  });

  it("the address's layers travel with the ask (validated, never a free string); the first render asks for no main block", async () => {
    expect((await route({ at: "pt:51.31,9.4875", road: "A7", r: 10, lang: "de", l: ["parking", "charging"] })).asked[0]).toMatch(/&f=1&layer=parking&layer=charging$/);
    for (const l of [["x"], "parking", [1], ["parking", "parking", "parking", "parking", "parking", "parking"]]) expect((await route({ at: "pt:51.31,9.4875", road: "A7", lang: "de", l })).asked[0]).not.toContain("layer=");
    const { addressLayers, fetchMotorwayAround } = await import("../src/lib/motorway-around.js");
    expect(addressLayers(new URLSearchParams("f=1&layer=parking&layer=evil&layer=parking"))).toEqual(["parking"]);
    expect(addressLayers(new URLSearchParams("layer=parking"))).toBeNull();
    const asked: string[] = [];
    await fetchMotorwayAround("A7", "pt:51.31,9.4875", "25", "ip", "de", { baseUrl: "http://digest", timeoutMs: 100, fetchImpl: (u: string) => (asked.push(u), Promise.reject(new Error("x"))) }, null, null, false);
    expect(asked[0]).toMatch(/&main=0$/);
  });

  it("#1081 review 11: the charging filter is appended only when its forwarded value is not empty — never a bare '&'", async () => {
    const { fetchMotorwayAround } = await import("../src/lib/motorway-around.js");
    const ask = async (ev: string): Promise<string> => {
      const asked: string[] = [];
      await fetchMotorwayAround("A7", "pt:51.31,9.4875", "25", "ip", "de", { baseUrl: "http://digest", timeoutMs: 100, fetchImpl: (u: string) => (asked.push(u), Promise.reject(new Error("x"))) }, null, null, false, ev);
      return asked[0]!;
    };
    // a non-empty ev the forward empties: nothing of it is sent
    for (const ev of ["utm_source=x", "ev_op=", "ev_kw=%3Cx%3E"]) {
      const u = await ask(ev);
      expect(u, ev).toMatch(/&main=0$/);
      expect(u, ev).not.toMatch(/&&|&$|\?&/);
    }
    expect(await ask("ev_op=enbw&ev_free=1")).toMatch(/&main=0&ev_op=enbw&ev_free=1$/);
  });

  it("the page's scripts are run again when the main block is swapped (vf:main), so its buttons work", async () => {
    const { rebindOnMainSwap } = await import("../src/lib/motorway-around.js");
    let runs = 0;
    const listeners: (() => void)[] = [];
    const doc = { addEventListener: (k: string, f: () => void) => (k === "vf:main" ? listeners.push(f) : undefined) };
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- running the shipped wrapper is the point
    new Function("document", "hit", rebindOnMainSwap("hit();"))(doc, () => (runs += 1));
    expect(runs).toBe(1);
    listeners.forEach((f) => f());
    expect(runs).toBe(2);
    expect(rebindOnMainSwap("")).toBe("");
    const page = readFileSync(join(import.meta.dirname, "..", "src", "layouts", "MotorwayPage.astro"), "utf8");
    expect(page).toContain('id="motorway-main"');
    expect(page).toMatch(/set:html=\{rebindOnMainSwap\(/);
  });
});

describe("G5.1: the switch, off unless VF_MOTORWAY_AROUND=1 (#716 ruling, G5 as amended 2026-10-21; #890)", () => {
  it("the switch is off unless VF_MOTORWAY_AROUND=1: no position bar, and the route answers 404 without asking the digest", async () => {
    expect(motorwayAroundOn({})).toBe(false);
    expect(motorwayAroundOn({ VF_MOTORWAY_AROUND: "1" })).toBe(true);
    expect(await aroundFirstRender(new Headers(), "A7", "de", new URLSearchParams(), { baseUrl: "http://digest", timeoutMs: 1, geoipFile: undefined }, false)).toBeNull();
    const req = new Request("http://shell/fragment/motorway-around", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ at: "pt:51.31,9.4875", road: "A7", lang: "de" }) });
    const asked: string[] = [];
    const res = await motorwayAroundRoute(req, { baseUrl: "http://digest", timeoutMs: 1, fetchImpl: (u: string) => (asked.push(u), Promise.reject(new Error("no"))) }, false);
    expect(res.status).toBe(404);
    expect(asked).toEqual([]);
  });
});

describe("the view segments the around block is given (#890 § 4, #894)", () => {
  it("a stretch, a direction or both; anything else is dropped whole", async () => {
    const { viewSegments } = await import("../src/lib/motorway-around.js");
    expect(viewSegments("a-to-b")).toEqual({ stretch: "a-to-b", towards: null });
    expect(viewSegments("towards-kassel")).toEqual({ stretch: null, towards: "towards-kassel" });
    expect(viewSegments("a-to-b/towards-kassel")).toEqual({ stretch: "a-to-b", towards: "towards-kassel" });
    expect(viewSegments("a-to-b/../x")).toEqual({ stretch: null, towards: null });
    expect(viewSegments("A&b=1")).toEqual({ stretch: null, towards: null });
    expect(viewSegments(7)).toEqual({ stretch: null, towards: null });
  });
});

describe("the first render waits at most the tile deadline (review 2.3.6)", () => {
  it("MotorwayPage passes the 2 s tile deadline and the request's budget (#1166); the route reads under the same budget", () => {
    const page = readFileSync(join(import.meta.dirname, "..", "src", "layouts", "MotorwayPage.astro"), "utf8");
    const call = /const around = await aroundFirstRender\([^;]*\);/.exec(page)?.[0] ?? "";
    expect(call).toContain("timeoutMs: env.tileTimeoutMs");
    expect(call).not.toContain("placeTimeoutMs");
    expect(call).toContain("endsAt: Astro.locals.budgetEndsAt");
    expect(page).not.toContain("8 s");
    const route = readFileSync(join(import.meta.dirname, "..", "src", "pages", "[lang]", "autobahn", "[road]", "[...rest].astro"), "utf8");
    expect(/const a = await resolveMotorwayPage\([^;]*\);/.exec(route)?.[0] ?? "").toMatch(/withinBudget\(\{[^}]*timeoutMs: env\.placeTimeoutMs[^}]*\}, Astro\.locals\.budgetEndsAt\)/);
  });
  it("a digest slower than the deadline: the page gets no block, in about the deadline, and the bar is still offered", async () => {
    const { createServer } = await import("node:http");
    const server = createServer((_req, res) => void setTimeout(() => res.writeHead(200, { "content-type": "text/html" }).end('<section class="mwa" id="motorway-around"></section>'), 3_000));
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    const port = (server.address() as { port: number }).port;
    const { execFileSync } = await import("node:child_process");
    const { mkdtempSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const dir = mkdtempSync(join(tmpdir(), "vf-around-slow-"));
    const geoFile = join(dir, "geoip.vfgeo");
    execFileSync(process.execPath, [join(import.meta.dirname, "..", "..", "..", "scripts", "geoip-build.mjs"), "--release", "2026-10", "--out", geoFile, "--min-de-ranges", "1"], { input: readFileSync(join(import.meta.dirname, "fixtures", "geoip-fixture.csv")), encoding: "utf8" });
    const t0 = Date.now();
    try {
      const r = await aroundFirstRender(new Headers({ "x-forwarded-for": "192.0.2.10" }), "A7", "de", new URLSearchParams(), { baseUrl: `http://127.0.0.1:${String(port)}`, timeoutMs: 200, geoipFile: geoFile }, true);
      expect(r).not.toBeNull();
      // the IP rung found a cell, so the digest WAS asked — and the page did not wait for its answer
      expect(r!.ip.at).toMatch(/^pt:/);
      expect(r!.block).toBeNull();
      expect(Date.now() - t0).toBeLessThan(1_500);
    } finally {
      server.closeAllConnections();
      server.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("2.4.6: a place the ADDRESS names wins over the IP guess (owner, the A4 with ?at=ags:14612000)", () => {
  const answer = (asked: string[]) => (url: string): Promise<Response> => {
    asked.push(url);
    const at = decodeURIComponent(/[?&]at=([^&]+)/.exec(url)?.[1] ?? "");
    return Promise.resolve(new Response(SECTION, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "place-key": at, "place-label": encodeURIComponent(at === "ags:14612000" ? "Dresden" : "Kassel") } }));
  };
  const geoHeaders = new Headers({ "x-forwarded-for": "192.0.2.10" });
  it("?at=ags:… is the block's place, chosen, asked as the person's pick and never looked up by IP", async () => {
    const asked: string[] = [];
    const r = await aroundFirstRender(geoHeaders, "A4", "en", new URLSearchParams("at=ags:14612000"), { baseUrl: "http://digest", timeoutMs: 1_000, geoipFile: undefined, fetchImpl: answer(asked) }, true);
    expect(r?.ip).toEqual({ source: "chosen", at: "ags:14612000", usedGeoIp: false });
    expect(r?.block?.key).toBe("ags:14612000");
    expect(r?.block?.label).toBe("Dresden");
    expect(asked).toHaveLength(1);
    expect(asked[0]).toContain("at=ags%3A14612000");
    expect(asked[0]).toContain("how=manual");
    // the address's place has no radius of the person's own: the page keeps its own main block (main=0)
    expect(asked[0]).toContain("main=0");
  });
  it("a point never stands in a URL: ?at=pt:… is ignored and the page is what it was without it", async () => {
    const asked: string[] = [];
    const r = await aroundFirstRender(new Headers(), "A4", "en", new URLSearchParams("at=pt:51.31,9.4875"), { baseUrl: "http://digest", timeoutMs: 1_000, geoipFile: undefined, fetchImpl: answer(asked) }, true);
    expect(r?.ip.source).not.toBe("chosen");
    expect(asked.every((u) => !u.includes("pt%3A51.31"))).toBe(true);
  });
  it("?scope=de wins over ?at=: the whole road, nothing asked", async () => {
    const asked: string[] = [];
    const r = await aroundFirstRender(geoHeaders, "A4", "en", new URLSearchParams("scope=de&at=ags:14612000"), { baseUrl: "http://digest", timeoutMs: 1_000, geoipFile: undefined, fetchImpl: answer(asked) }, true);
    expect(r?.ip.source).toBe("germany");
    expect(r?.block).toBeNull();
    expect(asked).toEqual([]);
  });
  it("MotorwayPage hands the chosen source to the island, which treats it as fixed (no IP, no remembered place, no fix replaces it)", () => {
    const page = readFileSync(join(import.meta.dirname, "..", "src", "layouts", "MotorwayPage.astro"), "utf8");
    expect(page).toContain('around.ip.source === "chosen" ? "chosen" : "ip"');
    const island = readFileSync(join(import.meta.dirname, "..", "src", "location", "island.ts"), "utf8");
    // #1187 reads the server's source once (`SRC`); "chosen" is still one of the sources that fix the place
    expect(island).toMatch(/const SRC = cfg\.server\.source;/);
    expect(island).toMatch(/const fixed = [^;]*SRC === "chosen"/);
  });
});

describe("#1166: the around block gets only what is left of the request's two seconds", () => {
  afterEach(() => vi.useRealTimers());
  const geo = new Headers();
  /** A digest that never answers, and honours the abort as fetch does; `asked` records each read. */
  const hang = (asked: string[]) => (url: string, init: { signal: AbortSignal }): Promise<Response> => {
    asked.push(url);
    return new Promise((_, reject) =>
      init.signal.addEventListener("abort", () => {
        const e = new Error("aborted");
        e.name = "AbortError";
        reject(e);
      }),
    );
  };
  const settle = async <T>(p: Promise<T>, ms: number): Promise<{ done: boolean; value: T | undefined }> => {
    const out: { done: boolean; value: T | undefined } = { done: false, value: undefined };
    void p.then((v) => {
      out.done = true;
      out.value = v;
    });
    await vi.advanceTimersByTimeAsync(ms);
    return out;
  };
  it("the page's read took 1.5 s: the block's read is cut to the 0.5 s left, and the bar is still offered", async () => {
    vi.useFakeTimers();
    const asked: string[] = [];
    const endsAt = Date.now() + 500;
    const r = await settle(aroundFirstRender(geo, "A4", "de", new URLSearchParams("at=ags:14612000"), { baseUrl: "http://digest", timeoutMs: 2_000, geoipFile: undefined, fetchImpl: hang(asked), endsAt }, true), 500);
    expect(r.done).toBe(true);
    expect(r.value?.block).toBeNull();
    expect(asked).toHaveLength(1);
  });
  it("less than AROUND_MIN_MS left: the block is not asked at all — the chosen place's read nor the fallback after it", async () => {
    vi.useFakeTimers();
    const asked: string[] = [];
    const r = await settle(aroundFirstRender(geo, "A4", "de", new URLSearchParams("at=ags:14612000"), { baseUrl: "http://digest", timeoutMs: 2_000, geoipFile: undefined, fetchImpl: hang(asked), endsAt: Date.now() + AROUND_MIN_MS - 1 }, true), 0);
    expect(r.done).toBe(true);
    expect(r.value).not.toBeNull();
    expect(r.value?.block).toBeNull();
    expect(asked).toEqual([]);
  });
});
