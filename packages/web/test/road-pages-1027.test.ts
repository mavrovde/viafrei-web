/**
 * #1027: the road pages in the shell — the id grammar is the digest's (held equal over the same samples), another
 * spelling of an id is a 301 to it, anything else the 404 page, a digest that does not answer a 503; the head the
 * digest writes on its fragment is read, bounded and stripped; the sitemap's list is refused whole when one line is
 * not ours; and the page's own graph carries no live figure. Every fetch here is a stub.
 */
import { describe, expect, it } from "vitest";
import { roadRefOfId, parseRoadRef, roadPageId, type RoadRef } from "../../ingest/src/domain/roads/road-ref.js";
import { renderRoadPage } from "../../digest/src/presentation/road-page-html.js";
import { roadPageOf, roadPageSources } from "../../digest/src/analysis/road-page.js";
import { ROAD_AT, roadRow } from "../../digest/src/server/road-service.test.support.js";
import { fetchRoadList, fetchRoadPage, resolveRoadPage, roadHeadOf, ROAD_HEAD_DESCRIPTION_LIMIT, ROAD_HEAD_TITLE_LIMIT } from "../src/lib/road-page.js";
import { ROAD_LAND_SLUGS, isRoadId, roadAddress, roadLabelOfId, roadPath } from "../src/site/roads.js";
import { roadJsonLd } from "../src/site/structured-data.js";
import { LIVE_LANGS } from "../src/site/pages.js";
import type { FetchLike } from "../src/lib/tiles.js";

const SOURCES = roadPageSources();
const B51 = roadRefOfId("b51") as RoadRef;
const fragment = (lang: (typeof LIVE_LANGS)[number] = "de", rows = [roadRow()]): string => renderRoadPage(lang, roadPageOf(B51, rows, SOURCES, ROAD_AT, 40));

type Answer = { status: number; type?: string; body?: string; headers?: Record<string, string> };
function stub(answers: Record<string, Answer>): FetchLike & { calls: string[] } {
  const calls: string[] = [];
  const f = ((url: string) => {
    calls.push(url);
    const path = url.replace(/^http:\/\/digest:8791/, "").replace(/\?.*$/, "");
    const a = answers[path] ?? { status: 404, type: "text/html", body: "<p>no</p>" };
    const headers: Record<string, string> = { "content-type": a.type ?? "text/html; charset=utf-8", ...(a.headers ?? {}) };
    return Promise.resolve({ status: a.status, headers: { get: (n: string) => headers[n.toLowerCase()] ?? null }, text: () => Promise.resolve(a.body ?? "") });
  }) as unknown as FetchLike & { calls: string[] };
  f.calls = calls;
  return f;
}
const o = (f: FetchLike) => ({ baseUrl: "http://digest:8791", timeoutMs: 1000, fetchImpl: f });

describe("the id grammar is the digest's", () => {
  it("accepts exactly the ids the digest names and answers, over the same samples", () => {
    const samples = ["b51", "b96n", "b1", "b9999", "b0", "b051", "B51", "a1", "k12", "l249", "s84", "nw/l249", "sn/s84", "by/s2345", "nw/b51", "nw/k12", "xx/l249", "NW/l249", "nw/L249", "b51/x", "", "nw/", "/l249"];
    for (const s of samples) expect(isRoadId(s), s).toBe(roadRefOfId(s) !== null);
    // every Land's code is a slug of both, and an id the digest builds is one the shell accepts
    expect(ROAD_LAND_SLUGS).toHaveLength(16);
    for (const land of ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16"]) {
      const id = roadPageId(parseRoadRef("L 12", land) as RoadRef);
      expect(isRoadId(id), id).toBe(true);
    }
  });

  it("paths and labels: English route words, the language prefix the only language marker", () => {
    for (const l of LIVE_LANGS) expect(roadPath(l, "nw/l249")).toBe(`/${l}/road/nw/l249`);
    expect(roadLabelOfId("b96n")).toBe("B 96n");
    expect(roadLabelOfId("nw/l249")).toBe("L 249");
  });

  it("another spelling is a respell to the canonical id; a K road, an A road and a bare Land's road are none", () => {
    expect(roadAddress("b51")).toEqual({ kind: "id", id: "b51" });
    for (const raw of ["B51", "B%2051", "b051", "B-51", "b%20051"]) expect(roadAddress(raw), raw).toEqual({ kind: "respell", id: "b51" });
    expect(roadAddress("NW/L249")).toEqual({ kind: "respell", id: "nw/l249" });
    for (const raw of ["k12", "a7", "l249", "nw/b51", "%E0%A4%A", "b".repeat(40)]) expect(roadAddress(raw).kind, raw).toBe("none");
  });
});

describe("roadHeadOf over the digest's own fragment", () => {
  it("reads title, description, robots, lastmod and the main place, and strips them", () => {
    const h = roadHeadOf(fragment("de"), "de");
    expect(h.title).toBe("B 51 Münster: Sperrung, Baustelle aktuell – ViaFrei");
    expect(h.description).toContain("B 51");
    expect(h.robots).toBe("index, follow");
    expect(h.road).toBe("B 51");
    expect(h.lastmod).toBe("2026-11-01");
    expect(h.place).toEqual({ name: "Münster", path: "/de/place/muenster" });
    expect(h.html.startsWith('<section class="roadpage" id="roadpage">')).toBe(true);
    expect(h.html).not.toMatch(/\sdata-[a-z-]+=/);
  });

  it("every language's head fits the bounds; a place path in another language is not this page's", () => {
    for (const l of LIVE_LANGS) {
      const h = roadHeadOf(fragment(l), l);
      expect(h.title, l).not.toBeNull();
      expect(h.title!.length, l).toBeLessThanOrEqual(ROAD_HEAD_TITLE_LIMIT);
      expect(h.description, l).not.toBeNull();
      expect(h.description!.length, l).toBeLessThanOrEqual(ROAD_HEAD_DESCRIPTION_LIMIT);
    }
    expect(roadHeadOf(fragment("de"), "en").place).toBeNull();
  });

  it("a value that is not plausibly the digest's is ignored", () => {
    const f = fragment("de");
    const long = f.replace(/data-title="[^"]*"/, `data-title="B 51 ${"x".repeat(120)}"`);
    expect(roadHeadOf(long, "de").title).toBeNull();
    const other = f.replace(/data-title="[^"]*"/, 'data-title="A 7: Stau"');
    expect(roadHeadOf(other, "de").title).toBeNull();
    const slot = f.replace(/data-description="[^"]*"/, 'data-description="B 51 {counts}"');
    expect(roadHeadOf(slot, "de").description).toBeNull();
    const robots = f.replace('data-robots="index, follow"', 'data-robots="index, archive"');
    expect(roadHeadOf(robots, "de").robots).toBeNull();
    expect(roadHeadOf("<p>no</p>", "de").title).toBeNull();
  });

  it("a page with nothing in force and nothing ended this week says noindex", () => {
    expect(roadHeadOf(fragment("de", []), "de").robots).toBe("noindex, follow");
  });
});

describe("resolveRoadPage", () => {
  it("the page, a 301 for another spelling, the 404 page for an unknown road, a 503 for a digest that does not answer", async () => {
    const ok = stub({ "/internal/road/b51": { status: 200, body: fragment("de") } });
    const page = await resolveRoadPage("de", "b51", o(ok));
    expect(page.kind).toBe("page");
    expect(ok.calls).toEqual(["http://digest:8791/internal/road/b51?lang=de"]);
    const respell = stub({});
    expect(await resolveRoadPage("de", "B51", o(respell))).toEqual({ kind: "redirect", to: "/de/road/b51" });
    expect(respell.calls).toEqual([]);
    expect(await resolveRoadPage("de", "b52", o(stub({})))).toEqual({ kind: "missing" });
    expect(await resolveRoadPage("de", "k12", o(stub({})))).toEqual({ kind: "missing" });
    expect(await resolveRoadPage("de", "b51", o(stub({ "/internal/road/b51": { status: 500 } })))).toEqual({ kind: "unavailable" });
    // an answer that is not a road fragment is no answer
    expect(await resolveRoadPage("de", "b51", o(stub({ "/internal/road/b51": { status: 200, body: "<section class=\"motorway\"></section>" } })))).toEqual({ kind: "unavailable" });
    expect((await fetchRoadPage("b51", "de", o(stub({ "/internal/road/b51": { status: 200, body: `${fragment("de").slice(0, -10)}<script>x</script></section>` } })))).kind).toBe("failed");
  });
});

describe("fetchRoadList", () => {
  it("reads id and day a line, and refuses the whole list when a line or the count is not ours", async () => {
    const good = stub({ "/internal/road/list": { status: 200, type: "text/plain; charset=utf-8", body: "b51\t2026-11-01\nnw/l249\t2026-11-02\n", headers: { "road-pages": "2" } } });
    expect(await fetchRoadList(o(good))).toEqual([{ id: "b51", day: "2026-11-01" }, { id: "nw/l249", day: "2026-11-02" }]);
    const bad = stub({ "/internal/road/list": { status: 200, type: "text/plain", body: "b51\t2026-11-01\nk12\t2026-11-01\n" } });
    expect(await fetchRoadList(o(bad))).toBeNull();
    const short = stub({ "/internal/road/list": { status: 200, type: "text/plain", body: "b51\t2026-11-01\n", headers: { "road-pages": "2" } } });
    expect(await fetchRoadList(o(short))).toBeNull();
    expect(await fetchRoadList(o(stub({})))).toBeNull();
  });
});

describe("roadJsonLd", () => {
  it("names the road and the page, and carries no live figure", () => {
    const h = roadHeadOf(fragment("de"), "de");
    const ld = roadJsonLd("de", "B 51", h.title!, "/de/road/b51");
    expect(ld).toContain('"name":"B 51"');
    expect(ld).toContain("https://viafrei.de/de/road/b51");
    expect(ld).not.toContain(h.description!.replace(/"/g, ""));
    expect(ld).not.toMatch(/Baustellen: \d/);
  });
});
