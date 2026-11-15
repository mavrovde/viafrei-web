/**
 * #1114 (2.5.8, AC 6): no map weighs more than `MAP_GZIP_MAX` on the wire — each `<figure>` that draws a map, gzipped,
 * on the largest page of each type the real digest answers at production's size: the A7 (the longest motorway at a
 * heavy hour), its busiest exit page, München's place cards and Köln Hbf's station area. A planted map over the limit
 * is red, so the measure can say no. The figures are printed, so a release reads its margin off the run.
 */
import { gzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MAP_GZIP_MAX } from "@viafrei/digest";
import { startRealDigest } from "../e2e/real-digest.js";

/** Every `<figure>` of a fragment that draws a map (holds an `<svg`), cut at its own closing tag. */
function mapFigures(html: string): readonly string[] {
  const out: string[] = [];
  const tag = /<figure[\s>]|<\/figure>/gu;
  let start = -1;
  let depth = 0;
  for (let m = tag.exec(html); m !== null; m = tag.exec(html)) {
    if (m[0] === "</figure>") {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        const fig = html.slice(start, m.index + m[0].length);
        if (fig.includes("<svg")) out.push(fig);
        start = -1;
      }
    } else {
      if (depth === 0) start = m.index;
      depth += 1;
    }
  }
  return out;
}
/** The heaviest map of a fragment, in gzip bytes (0: none drawn). */
const heaviest = (html: string): number => Math.max(0, ...mapFigures(html).map((f) => gzipSync(f).length));

let digest: Awaited<ReturnType<typeof startRealDigest>>;
const measured: Record<string, number> = {};
const get = async (path: string): Promise<string> => {
  const r = await fetch(`${digest.url}${path}`);
  expect(r.status, path).toBe(200);
  return r.text();
};

beforeAll(async () => {
  digest = await startRealDigest({ scale: "production" });
  const a7 = await get("/internal/motorway/A7?lang=de");
  measured["A7"] = heaviest(a7);
  // the whole A7 fragment beside it, for the last lane's re-measure against the page budget (700 KB raw / 200 KB gzip)
  console.log(`#1114 A7 fragment: ${String(Buffer.byteLength(a7))} B raw, ${String(gzipSync(a7).length)} B gzip`);
  // the busiest exit: every exit page of the A7, the heaviest map of them
  const exits = [...new Set([...a7.matchAll(/href="[^"]*?\ba7\/(exit-[a-z0-9-]+)"/gu)].map((m) => m[1]!))];
  expect(exits.length).toBeGreaterThan(0);
  let exit = 0;
  for (const s of exits) exit = Math.max(exit, heaviest(await get(`/internal/motorway/A7?lang=de&stretch=${s}`)));
  measured["A7 exit"] = exit;
  measured["München"] = heaviest(await get("/internal/place/cards?at=ags%3A09162000&lang=de"));
  measured["Köln Hbf"] = heaviest(await get("/internal/station/koeln-hbf/area?lang=de"));
  console.log(`#1114 map budget (gzip bytes, max ${String(MAP_GZIP_MAX)}): ${Object.entries(measured).map(([k, v]) => `${k} ${String(v)}`).join(", ")}`);
}, 60_000);
afterAll(async () => {
  await digest.close();
});

describe("#1114 AC 6: every map within its wire budget", () => {
  // mutant M-B3: the measure skipping a page's first map (every page's heaviest unmeasured)
  for (const page of ["A7", "A7 exit", "München", "Köln Hbf"]) {
    it(`${page}: its heaviest map is drawn and within ${String(MAP_GZIP_MAX)} B gzip`, () => {
      expect(measured[page], page).toBeGreaterThan(0);
      expect(measured[page], page).toBeLessThanOrEqual(MAP_GZIP_MAX);
    });
  }
  // mutant M-B1: the limit raised tenfold; mutant M-B2: a figure without a map measured as one
  it("a planted map over the limit is red: the measure can say no", () => {
    // incompressible path data: 61 KB that gzip cannot fold
    let seed = 1;
    const noise = Array.from({ length: 12_000 }, () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return `L${String(seed % 99_991)} ${String((seed >> 7) % 99_989)}`;
    }).join("");
    const planted = `<figure class="pam"><svg viewBox="0 0 1 1"><path d="M0 0${noise}"/></svg></figure>`;
    expect(heaviest(`<p>x</p>${planted}<figure class="credit"><p>no map</p></figure>`)).toBeGreaterThan(MAP_GZIP_MAX);
    // a figure without a map is not measured
    expect(heaviest(`<figure class="credit"><p>no map</p></figure>`)).toBe(0);
  });
});
