import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { catalogue } from "../src/i18n/index.js";
import { ANSWER_FRESH_MS, answerParts, answerState, answerText, ASK_KEYS, fetchAsks, parseAsk, parseAsks, type AskEntry } from "../src/lib/ask.js";
import type { FetchLike } from "../src/lib/tiles.js";
import { LIVE_LANGS } from "../src/site/pages.js";

/** What production's internal route served for the four national questions (recorded 2026-10-14 and 2026-11-05, `test/fixtures/asks.json`). */
const FIXTURE = JSON.parse(readFileSync(new URL("./fixtures/asks.json", import.meta.url), "utf8")) as { examples: unknown[] };
const ROADS = FIXTURE.examples.find((e) => (e as { key: string }).key === "roads");

const reply = (status: number, body: string): FetchLike => () => Promise.resolve({ status, headers: { get: () => null }, text: () => Promise.resolve(body) });

describe("parseAsk — the shell takes exactly the internal route's shape", () => {
  it("reads production's seven national answers", () => {
    const set = parseAsks(FIXTURE);
    expect([...set.keys()].sort()).toEqual(["charging", "hydrogen", "lorryPark", "parking", "roads", "transit", "weatherLand"]);
  });

  it("refuses an unknown key, a bad tool name, markup in a name, a non-finite figure, an empty attribution", () => {
    const base = ROADS as { projection: Record<string, unknown> } & Record<string, unknown>;
    const bad: unknown[] = [
      { ...base, key: "fuel" },
      { ...base, tool: "Check Traffic" },
      { ...base, projection: { ...base.projection, names: { road: "<script>A8" } } },
      { ...base, projection: { ...base.projection, values: { jams: Number.NaN } } },
      { ...base, projection: { ...base.projection, values: { jams: "2" } } },
      { ...base, projection: { ...base.projection, attribution: " " } },
      { ...base, projection: { ...base.projection, asOf: "yesterday" } },
      { ...base, projection: { ...base.projection, notes: [""] } },
      { ...base, projection: { ...base.projection, sources: [] } },
      { ...base, projection: { ...base.projection, sources: ["Autobahn GmbH"] } },
      { ...base, projection: { ...base.projection, sources: undefined } },
      { ...base, projection: { ...base.projection, variant: "clear now" } },
      { ...base, projection: undefined },
      "roads",
    ];
    for (const b of bad) expect(parseAsk(b), JSON.stringify(b)).toBeNull();
    expect(parseAsk(base)).not.toBeNull();
  });

  it("a body without an examples list is the empty set, a bad entry is dropped, a duplicate keeps the first", () => {
    expect(parseAsks({}).size).toBe(0);
    expect(parseAsks({ examples: "x" }).size).toBe(0);
    const second = { ...(ROADS as object), tool: "check_road_status" };
    const set = parseAsks({ examples: [ROADS, { key: "nope" }, second] });
    expect(set.size).toBe(1);
    expect(set.get("roads")?.tool).toBe("check_autobahn_traffic");
  });
});

describe("fetchAsks — none is simply no answer, never a broken page", () => {
  it("no origin configured asks nothing", async () => {
    let asked = 0;
    const f: FetchLike = () => {
      asked += 1;
      return Promise.reject(new Error("no"));
    };
    expect((await fetchAsks({ baseUrl: undefined, timeoutMs: 100, fetchImpl: f })).size).toBe(0);
    expect(asked).toBe(0);
  });

  it("asks the internal route of the given origin, and reads its answers", async () => {
    let url = "";
    const f: FetchLike = (u) => {
      url = u;
      return Promise.resolve({ status: 200, headers: { get: () => null }, text: () => Promise.resolve(JSON.stringify(FIXTURE)) });
    };
    expect((await fetchAsks({ baseUrl: "http://mcp:8788", timeoutMs: 100, fetchImpl: f })).size).toBe(7);
    expect(url).toBe("http://mcp:8788/internal/examples");
  });

  it("a 503, a body that is not JSON, a throw and a timeout are each the empty set", async () => {
    for (const f of [reply(503, JSON.stringify(FIXTURE)), reply(200, "<html>"), (() => Promise.reject(new Error("refused"))) as FetchLike]) {
      expect((await fetchAsks({ baseUrl: "http://mcp:8788", timeoutMs: 100, fetchImpl: f })).size).toBe(0);
    }
    const slow: FetchLike = (_u, init) => new Promise((_r, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted"))));
    expect((await fetchAsks({ baseUrl: "http://mcp:8788", timeoutMs: 20, fetchImpl: slow })).size).toBe(0);
  });
});

describe("answerParts — one sentence per language, names untranslatable", () => {
  const set = parseAsks(FIXTURE);

  it("renders every recorded answer in every language with no placeholder left", () => {
    for (const lang of LIVE_LANGS) {
      for (const e of set.values()) {
        const text = answerText(lang, e);
        expect(text, `${lang} ${e.key}`).toBeTypeOf("string");
        expect(text).not.toMatch(/[{}\u0000]/u);
      }
    }
  });

  it("marks the data's names translate=no and formats figures in the page's language", () => {
    const parking = set.get("parking")!;
    const de = answerParts("de", parking)!;
    expect(de.filter((p) => p.name).map((p) => p.text)).toEqual(["Parkhaus Bahnhofstraße"]);
    expect(answerText("de", parking)).toContain("0,2 km");
    expect(answerText("en", parking)).toContain("0.2 km");
  });

  it("a variant the deck has no sentence for, or a sentence the values cannot fill, is no answer", () => {
    const roads = set.get("roads")!;
    const unknown: AskEntry = { ...roads, projection: { ...roads.projection, variant: "somethingNew" } };
    expect(answerParts("de", unknown)).toBeNull();
    const holed: AskEntry = { ...roads, projection: { ...roads.projection, values: { jams: 0 } } };
    expect(answerParts("de", holed)).toBeNull();
  });

  it("every ask key has a question in every language, and every language has the German deck's variants", () => {
    const de = catalogue("de");
    for (const key of ASK_KEYS) expect(de[`ask.${key}.question`], key).toBeTypeOf("string");
    const variants = Object.keys(de).filter((k) => k.startsWith("ask."));
    for (const lang of LIVE_LANGS) for (const k of variants) expect(catalogue(lang)[k], `${lang} ${k}`).toBeTypeOf("string");
  });
});

describe("answerState", () => {
  // The 2.1.18 deploy: two vantages minutes apart saw one answer is-ok and is-stale, because the state was read off the
  // DATA's instant, a few minutes old when asked; every cycle ended stale. The state is about the ask.
  it("is fresh through a whole refresh cycle however old the data was when asked, and stale once a refresh is missed", () => {
    const base = parseAsks(FIXTURE).get("roads")!;
    const asked = Date.parse(base.askedAt);
    const e: AskEntry = { ...base, projection: { ...base.projection, asOf: new Date(asked - 14 * 60_000).toISOString() } };
    expect(answerState(e, new Date(asked + 15 * 60_000 + 30_000))).toBe("is-ok");
    expect(answerState(e, new Date(asked + ANSWER_FRESH_MS - 1))).toBe("is-ok");
    expect(answerState(e, new Date(asked + ANSWER_FRESH_MS))).toBe("is-stale");
    expect(answerState(e, new Date(asked + 2 * ANSWER_FRESH_MS))).toBe("is-stale");
  });
});

describe("counts read right for any number", () => {
  // The deck has no plural forms, and a live count is often 1 ("1 amtliche Warnungen", Fulda's fog, 2026-10-15):
  // in German and English a count is written "label: n", never in front of a plural noun.
  it("no German or English ask sentence puts a count before a noun", () => {
    const counts = ["jams", "closures", "works", "closed", "restricted", "count", "trips", "charging", "parking", "stations"];
    const before = new RegExp(`\\{(${counts.join("|")})\\} \\p{L}`, "u");
    for (const lang of ["de", "en"] as const) {
      for (const [k, v] of Object.entries(catalogue(lang)).filter(([k]) => k.startsWith("ask."))) expect(v, `${lang} ${k}`).not.toMatch(before);
    }
  });
});
