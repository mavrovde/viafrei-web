import { describe, expect, it } from "vitest";
import { all, classesIn } from "@viafrei/design/testing";
import { EMBEDDED_TILES, errorTile, fetchTile, fetchTiles, isFragment, parseCredits, type FetchLike } from "../src/lib/tiles.js";
import { readEnv } from "../src/lib/env.js";

const fragment = (id: string, state = "ok"): string =>
  `<section class="tile is-${state}" id="tile-${id}" aria-labelledby="tile-${id}-title"><header class="tile__head"><h3 class="tile__title" id="tile-${id}-title">x</h3><p class="age"><span class="age__dot" aria-hidden="true"></span><span class="age__state">aktuell</span></p></header><footer class="tile__foot"><p class="credit" lang="de"><a href="https://verkehr.autobahn.de" rel="license noreferrer">Verkehrsdaten: Autobahn GmbH des Bundes</a></p></footer></section>`;

const answer = (status: number, body: string, type = "text/html; charset=utf-8", cadence = "60"): ReturnType<FetchLike> =>
  Promise.resolve({ status, headers: { get: (n: string) => (n === "content-type" ? type : n === "tile-cadence-seconds" ? cadence : null) }, text: () => Promise.resolve(body) });

describe("fetchTile — one GET, a deadline, and an error tile for everything else", () => {
  it("embeds a 200 text/html fragment and reads its cadence", async () => {
    const calls: string[] = [];
    const f: FetchLike = (url) => {
      calls.push(url);
      return answer(200, fragment("reports"));
    };
    const r = await fetchTile("reports", "en", { baseUrl: "http://digest:8791", timeoutMs: 2000, fetchImpl: f });
    expect(r.fetched).toBe("ok");
    expect(r.cadenceSeconds).toBe(60);
    expect(r.html).toBe(fragment("reports"));
    expect(calls).toEqual(["http://digest:8791/internal/tiles/reports?lang=en"]);
  });

  it("turns a 500, a 404, a non-HTML answer and a foreign body into the shell's error tile", async () => {
    const cases: [string, FetchLike][] = [
      ["500", () => answer(500, "<p>tile unavailable</p>")],
      ["404", () => answer(404, "<p>no permitted line</p>")],
      ["json", () => answer(200, '{"n":1}', "application/json")],
      ["foreign", () => answer(200, "<div>not a tile</div>")],
      ["script", () => answer(200, fragment("reports").replace("</section>", "<script>1</script></section>"))],
      ["throws", () => Promise.reject(new Error("ECONNREFUSED"))],
    ];
    for (const [name, f] of cases) {
      const r = await fetchTile("reports", "de", { baseUrl: "http://digest:8791", timeoutMs: 2000, fetchImpl: f });
      expect(r.fetched, name).toBe("error");
      expect(r.html, name).toBe(errorTile("reports", "de"));
      expect(r.reason, name).toBeDefined();
    }
  });

  it("gives up at the deadline: a hanging digest costs the timeout and not a second more", async () => {
    const hang: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          const e = new Error("aborted");
          e.name = "AbortError";
          reject(e);
        });
      });
    const t0 = performance.now();
    const r = await fetchTile("lifts", "de", { baseUrl: "http://digest:8791", timeoutMs: 150, fetchImpl: hang });
    const took = performance.now() - t0;
    expect(r.fetched).toBe("error");
    expect(r.reason).toMatch(/timeout after 150 ms/);
    expect(took).toBeGreaterThanOrEqual(140);
    expect(took).toBeLessThan(600);
  });

  it("fetches every embedded tile in parallel, so one slow tile bounds the page at one deadline", async () => {
    const slow: FetchLike = (url, init) =>
      url.includes("/lifts?")
        ? new Promise((_r, reject) => init.signal.addEventListener("abort", () => reject(Object.assign(new Error("x"), { name: "AbortError" }))))
        : answer(200, fragment(/tiles\/([a-z]+)\?/.exec(url)?.[1] ?? "reports"));
    const t0 = performance.now();
    const all = await fetchTiles("de", { baseUrl: "http://digest:8791", timeoutMs: 200, fetchImpl: slow });
    expect(performance.now() - t0).toBeLessThan(600);
    expect(all.lifts.fetched).toBe("error");
    for (const id of EMBEDDED_TILES) if (id !== "lifts") expect(all[id].fetched, id).toBe("ok");
  });

  it("recognises only our own fragment shape", () => {
    expect(isFragment(fragment("reports"), "reports")).toBe(true);
    expect(isFragment(fragment("reports"), "lifts")).toBe(false);
    // #717 C-4: the fuel tile's root carries the Clarity stop marker after its state, and is still ours
    expect(isFragment('<section class="tile is-ok vf-noclarity" id="tile-fuel"><p>1</p></section>', "fuel")).toBe(true);
    expect(isFragment('<section class="tile is-ok vf-other" id="tile-fuel"><p>1</p></section>', "fuel")).toBe(false);
    expect(isFragment(fragment("reports", "loading"), "reports")).toBe(false);
    expect(isFragment("<section class=\"tile is-ok\" id=\"tile-reports\">x", "reports")).toBe(false);
  });

  it("renders an error tile with no figure and no credit line", () => {
    const html = errorTile("charging", "en");
    expect(all(html, ".tile.is-error").length).toBeGreaterThan(0);
    expect(html).toContain("not readable right now");
    expect([...classesIn(html)].filter((c) => c.startsWith("credit"))).toEqual([]);
    expect(html).not.toMatch(/tile__num num">[0-9]/);
  });

  it("embeds the six moment tiles in page order (the city jams since #520), then the main stations as the station moment's second tile (#519) and fuel as the driving moment's (#423), and the city car parks as the parking moment's (#799) — never transit as a tile", () => {
    expect([...EMBEDDED_TILES]).toEqual(["punctuality", "lifts", "reports", "jams", "lorry", "charging", "station", "fuel", "carparks"]);
  });

  const fact = (id: string): string => `<section class="tile tile--fact is-ok" id="fact-${id}"><p class="fact__line">1</p></section>`;

  it("asks for four facts with ?view=fact and leaves out a fact that did not answer", async () => {
    const asked: string[] = [];
    const f: FetchLike = (url) => {
      asked.push(url);
      const m = /tiles\/([a-z]+)\?lang=de(&view=fact)?$/.exec(url);
      if (m?.[2] !== undefined) return m[1] === "punctuality" ? answer(500, "x") : answer(200, fact(m[1] ?? ""));
      if (m?.[1] === "transit") return answer(200, fragment("transit", "empty"));
      return answer(200, fragment(m?.[1] ?? ""));
    };
    const all = await fetchTiles("de", { baseUrl: "http://d", timeoutMs: 500, fetchImpl: f });
    expect(asked.filter((u) => u.endsWith("&view=fact")).sort()).toEqual(["http://d/internal/tiles/charging?lang=de&view=fact", "http://d/internal/tiles/lorry?lang=de&view=fact", "http://d/internal/tiles/punctuality?lang=de&view=fact", "http://d/internal/tiles/roads?lang=de&view=fact"]);
    expect(all.facts.map((x) => x.id)).toEqual(["fact-roads", "fact-charging", "fact-lorry"]);
    expect(all.facts.every((x) => x.html.startsWith('<section class="tile tile--fact'))).toBe(true);
    // the bus and tram board: asked for, EMPTY, so the slot is not rendered
    expect(all.pending.transit).toBeNull();
  });

  it("leaves a fact out of the strip when its fragment is empty or error, keeps it when stale", async () => {
    const factIn = (state: string): string => `<section class="tile tile--fact is-${state}" id="fact-roads"><p class="fact__line">x</p></section>`;
    for (const [state, shown] of [["ok", true], ["stale", true], ["empty", false], ["error", false]] as const) {
      const f: FetchLike = (url) =>
        url.endsWith("&view=fact") ? answer(200, url.includes("/roads?") ? factIn(state) : "<p>x</p>", "text/html", "60") : answer(200, fragment(/tiles\/([a-z]+)\?/.exec(url)?.[1] ?? ""));
      const all = await fetchTiles("de", { baseUrl: "http://d", timeoutMs: 500, fetchImpl: f });
      expect(all.facts.map((x) => x.id), state).toEqual(shown ? ["fact-roads"] : []);
    }
  });

  it("fills the bus and tram slot only when the transit tile is live (ok or stale)", async () => {
    for (const [state, shown] of [["ok", true], ["stale", true], ["empty", false], ["error", false]] as const) {
      const f: FetchLike = (url) => answer(200, url.includes("/transit?") ? fragment("transit", state) : fragment(/tiles\/([a-z]+)\?/.exec(url)?.[1] ?? ""));
      const all = await fetchTiles("en", { baseUrl: "http://d", timeoutMs: 500, fetchImpl: f });
      expect(all.pending.transit !== null, state).toBe(shown);
    }
    const dead: FetchLike = (url) => (url.includes("/transit?") ? Promise.reject(new Error("ECONNREFUSED")) : answer(200, fragment(/tiles\/([a-z]+)\?/.exec(url)?.[1] ?? "")));
    expect((await fetchTiles("en", { baseUrl: "http://d", timeoutMs: 500, fetchImpl: dead })).pending.transit).toBeNull();
  });
});

describe("readEnv — the shell's whole configuration", () => {
  it("defaults to loopback, 2 s and no tag; refuses a bad origin or deadline; knows no database variable", () => {
    expect(readEnv({})).toEqual({ digestUrl: "http://127.0.0.1:8791", tileTimeoutMs: 2000, placeTimeoutMs: 2000, googleTag: undefined });
    expect(readEnv({ DIGEST_URL: "http://digest:8791", WEB_TILE_TIMEOUT_MS: "500", GOOGLE_TAG: "G-0" })).toEqual({ digestUrl: "http://digest:8791", tileTimeoutMs: 500, placeTimeoutMs: 2000, googleTag: "G-0" });
    expect(() => readEnv({ DIGEST_URL: "digest:8791" })).toThrow(/DIGEST_URL/);
    expect(() => readEnv({ WEB_TILE_TIMEOUT_MS: "50" })).toThrow(/WEB_TILE_TIMEOUT_MS/);
    // #709: a page's deadline is its own and moves alone; #1166: never above the two-second ceiling.
    expect(readEnv({ WEB_PLACE_TIMEOUT_MS: "2000" })).toMatchObject({ tileTimeoutMs: 2000, placeTimeoutMs: 2000 });
    expect(readEnv({ WEB_PLACE_TIMEOUT_MS: "1500" })).toMatchObject({ tileTimeoutMs: 2000, placeTimeoutMs: 1500 });
    expect(readEnv({ WEB_TILE_TIMEOUT_MS: "900" })).toMatchObject({ tileTimeoutMs: 900, placeTimeoutMs: 2000 });
    for (const bad of ["50", "2001", "8000", "9000", "12000", "2.5", "soon"]) expect(() => readEnv({ WEB_PLACE_TIMEOUT_MS: bad })).toThrow(/WEB_PLACE_TIMEOUT_MS must be an integer between 100 and 2000/);
    // #1166: a tile's deadline under the same ceiling, refused at startup above it (it was 10 000)
    expect(readEnv({ WEB_TILE_TIMEOUT_MS: "2000" })).toMatchObject({ tileTimeoutMs: 2000 });
    for (const bad of ["2001", "4000", "10000"]) expect(() => readEnv({ WEB_TILE_TIMEOUT_MS: bad })).toThrow(/WEB_TILE_TIMEOUT_MS must be an integer between 100 and 2000/);
    // #744: the assistant answers' origin is its own variable, apart from the fuel refresh.
    expect(readEnv({ MCP_INTERNAL_URL: "http://mcp:8788" })).toMatchObject({ mcpInternalUrl: "http://mcp:8788" });
    expect(readEnv({ FUEL_REFRESH_URL: "http://mcp:8788" })).not.toHaveProperty("mcpInternalUrl");
    for (const bad of ["mcp:8788", "http://mcp:8788/internal", "ftp://mcp"]) expect(() => readEnv({ MCP_INTERNAL_URL: bad })).toThrow(/MCP_INTERNAL_URL/);
    const env = readEnv({ DATABASE_URL: "postgresql://x", DIGEST_DATABASE_URL: "postgresql://y" });
    expect(JSON.stringify(env)).not.toContain("postgres");
  });
});

describe("parseCredits (#1190): the digest's statement of what a fragment credits", () => {
  it("reads ids, reads empty as crediting nothing, and treats anything else as no statement", () => {
    expect(parseCredits("autobahn,dwd")).toEqual(["autobahn", "dwd"]);
    expect(parseCredits("dwd")).toEqual(["dwd"]);
    expect(parseCredits("")).toEqual([]);
    expect(parseCredits(null)).toBeNull();
    for (const bad of ["Autobahn GmbH", "dwd,", ",dwd", "dwd, autobahn", "DWD"]) expect(parseCredits(bad), bad).toBeNull();
  });
});
