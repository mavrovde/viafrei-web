/**
 * The digest's fragments, byte for byte (#921 A2, #922 A1): every fragment
 * route the shell embeds — each tile, the four facts, the fuel board, the
 * News page's closures, the motorway index, every motorway's page, its fuel
 * block (both answers) and its around block, the place cards of the popular
 * places, a point and Nürnberg, the suggestions, the border towns, the place
 * index and the motorway register — in every site language, from the REAL
 * digest (`e2e/real-digest.ts`: `createApp` over the fixture database, a fixed
 * clock). Recorded before the localisation (#921) and the building blocks
 * (#922) were moved; one line per route family and language, the SHA-256 of
 * the family's answers in a fixed order, so a refactor that moves one byte of
 * one fragment fails here, naming the family and the language.
 *
 * It lives in the shell's suite because the fixture does: the digest may not
 * import this package, and the shell is what reads these fragments.
 */
import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { startRealDigest } from "../e2e/real-digest.js";
import { POPULAR_PLACES } from "../src/site/places.js";
import { LIVE_LANGS } from "../src/site/pages.js";

const TILES = ["reports", "roads", "charging", "lorry", "carparks", "lifts", "fuel", "transit", "punctuality", "jams", "station"];
const FACTS = ["roads", "punctuality", "charging", "lorry"];
const ROADS = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A34", "A57", "A61"];

/** Every route family's URLs in one language, in a fixed order. */
function families(l: string): [string, string[]][] {
  return [
    ["tiles", TILES.map((t) => `/internal/tiles/${t}?lang=${l}`)],
    ["facts", FACTS.map((f) => `/internal/tiles/${f}?lang=${l}&view=fact`)],
    ["fuel board", [`/internal/tiles/fuel?lang=${l}&view=board`]],
    ["news traffic", [`/internal/news/traffic?lang=${l}`]],
    ["motorway index", [`/internal/motorway/index?lang=${l}`]],
    ["motorway pages", ROADS.map((r) => `/internal/motorway/${r}?lang=${l}`)],
    ["motorway fuel", ROADS.flatMap((r) => [`/internal/motorway/${r}/fuel?lang=${l}`, `/internal/motorway/${r}/fuel?lang=${l}&refused=1`])],
    ["motorway around", ROADS.map((r) => `/internal/motorway/${r}/around?lang=${l}&at=ags%3A05315000&r=25`)],
    ["place cards", [...POPULAR_PLACES.slice(0, 6).map((p) => `ags%3A${p.ags}`), "ags%3A09564000", "pt%3A50.94%2C6.96"].map((at) => `/internal/place/cards?at=${at}&lang=${l}`)],
    // 2.4.2 review A 9: the border-towns route is retired (no caller), so the family is the suggestions alone
    ["place suggest", [`/internal/place/suggest?q=K%C3%B6&lang=${l}`]],
  ];
}

let digest: Awaited<ReturnType<typeof startRealDigest>>;
beforeAll(async () => {
  digest = await startRealDigest();
  // #1158: the suggest route loads the station index, which every later fragment links stations by; load it once
  // here so each family renders as production does with the index held, whatever order the families run in
  await (await fetch(`${digest.url}/internal/place/suggest?q=K%C3%B6&lang=de`)).text();
  // a credit line names the year of retrieval at render (#804): the golden is one day's
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-23T10:00:00Z") });
}, 60_000);
afterAll(async () => {
  vi.useRealTimers();
  await digest.close();
});

async function family(urls: readonly string[]): Promise<string> {
  const h = createHash("sha256");
  let bytes = 0;
  for (const u of urls) {
    const res = await fetch(digest.url + u);
    const body = await res.text();
    if (res.status !== 200) throw new Error(`${u} answered ${String(res.status)}`);
    bytes += body.length;
    h.update(`\0${u}\0${body}`);
  }
  return `${String(urls.length)}\t${String(bytes)}\t${h.digest("hex")}`;
}

describe("the digest's fragments in every language, byte for byte (#921, #922)", () => {
  it("every route family in every language is the recorded one", async () => {
    const lines: string[] = [];
    for (const [name, urls] of [["place index", ["/internal/place/index"]], ["motorway list", ["/internal/motorway/list"]]] as const) lines.push(`${name}\t${await family(urls)}`);
    for (const l of LIVE_LANGS) for (const [name, urls] of families(l)) lines.push(`${l} ${name}\t${await family(urls)}`);
    expect(lines).toHaveLength(2 + 10 * LIVE_LANGS.length);
    await expect(`${lines.join("\n")}\n`).toMatchFileSnapshot("./__golden__/digest-fragments.tsv");
  }, 120_000);
});
