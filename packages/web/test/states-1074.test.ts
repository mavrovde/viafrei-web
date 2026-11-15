/**
 * #1074: the Land pages in the shell — the table is the ingest's (held equal, slug, ISO code and English name, in AGS
 * order), another spelling of a Land is a 301 to its slug and costs no fetch, anything else the 404 page, a digest that
 * does not answer a 503; the head the digest writes on its fragment is read, bounded, checked against the Land asked
 * for and stripped; the sitemap's list is refused whole unless it is exactly the sixteen; each Land file entry carries
 * its alternates; and the page's own graph carries no fuel and no figure (data-steward MF1). Every fetch is a stub.
 *
 * Mutants (2026-11-03, each alone, this file run, restored, `cmp` clean):
 *  - `stateHeadOf` taking any Land's fragment (`const mine = true`) → "a fragment about another Land gives no head" red;
 * *  - `fetchStateList` taking a long list (`out.length !== 16 ||` removed: seventeen lines, one Land twice) → "the list is refused whole" red;
 *  - a respelling fetched as the page (`a.kind === "respell"` branch removed) → "another spelling is a 301" red;
 *  - the Land files without alternates (`urlEntry` → `plainEntry` in `statesLangXml`) → "sixteen entries, each with its
 *    alternates" red;
 *  - a Land's English name altered in `site/states.ts` → "the table is the ingest's" red.
 */
import { describe, expect, it } from "vitest";
import { LAENDER, LAND_SLUGS, landBySlug, landIndexPath, landPagePath, type Land } from "../../../.pinned/app/packages/ingest/dist/domain/places/laender.js";
import { statePageOf, stateIndexOf, stateListOf, type StateRead } from "../../../.pinned/app/packages/digest/dist/src/analysis/state-page.js";
import { renderStateIndex, renderStatePage, stateListText } from "../../../.pinned/app/packages/digest/dist/src/presentation/state-page-html.js";
import { fetchStateList, resolveStateIndex, resolveStatePage, stateHeadOf, STATE_HEAD_DESCRIPTION_LIMIT, STATE_HEAD_TITLE_LIMIT } from "../src/lib/state-page.js";
import { STATES, isStateSlug, stateAddress, statePath } from "../src/site/states.js";
import { statesLangXml } from "../src/site/sitemaps.js";
import { stateJsonLd } from "../src/site/structured-data.js";
import { LIVE_LANGS, pathFor, type Lang } from "../src/site/pages.js";
import type { FetchLike } from "../src/lib/tiles.js";

const AT = new Date("2026-11-03T10:00:00Z");
const TICK = new Date(AT.getTime() - 120_000);
const land = (slug: string): Land => {
  const l = landBySlug(slug);
  if (l === null) throw new Error(slug);
  return l;
};
const READ: StateRead = {
  at: AT,
  tick: TICK,
  rows: [{ source: "autobahn", road: "A9", kind: "closure", ext_id: "c1", title: "A9 | AS München-Nord", subtitle: "Nürnberg -> München", abnormal_traffic_type: null, delay_s: null, site_extents: null, starts_at: null, lat: 48.2, lon: 11.6, land: "09" }],
  cities: [{ ags: "09162000", name: "München" }],
};
const fragment = (lang: Lang, slug = "bayern"): string => renderStatePage(lang, statePageOf(land(slug), READ));

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

describe("the table is the ingest's", () => {
  it("the table is the ingest's: slug, ISO code and English name, in AGS order", () => {
    expect(STATES.map((s) => [s.slug, s.iso, s.nameEn])).toEqual(LAENDER.map((l) => [l.slug, l.iso, l.nameEn]));
    expect(STATES.map((s) => s.slug)).toEqual([...LAND_SLUGS]);
  });
  it("the addresses are the ingest's: one page per Land and the index, in every language", () => {
    for (const l of LIVE_LANGS) {
      for (const s of LAND_SLUGS) expect(statePath(l, s)).toBe(landPagePath(l, s));
      expect(pathFor("states", l)).toBe(landIndexPath(l));
    }
  });
});

describe("what an address names", () => {
  it("the slug is the page; another spelling is a 301 to it; anything else no Land", () => {
    for (const s of LAND_SLUGS) expect(stateAddress(s)).toEqual({ kind: "slug", slug: s });
    const respell: Record<string, string> = {
      Bayern: "bayern",
      BY: "bayern",
      by: "bayern",
      "de-by": "bayern",
      bavaria: "bayern",
      "Th%C3%BCringen": "thueringen",
      thuringen: "thueringen",
      "baden-wurttemberg": "baden-wuerttemberg",
      "Baden-W%C3%BCrttemberg": "baden-wuerttemberg",
      "north-rhine-westphalia": "nordrhein-westfalen",
      nw: "nordrhein-westfalen",
      "lower-saxony": "niedersachsen",
      Hamburg: "hamburg",
    };
    for (const [raw, slug] of Object.entries(respell)) expect(stateAddress(raw), raw).toEqual({ kind: "respell", slug });
    for (const raw of ["", "nrw", "deutschland", "bayern-nord", "%E0%A4%A", "a".repeat(61), "constructor", "__proto__", "09"]) expect(stateAddress(raw), raw).toEqual({ kind: "none" });
    expect(isStateSlug("Bayern")).toBe(false);
  });

  it("another spelling is a 301 and costs no fetch; no Land is the 404 and costs none either", async () => {
    const f = stub({});
    expect(await resolveStatePage("de", "Bayern", o(f))).toEqual({ kind: "redirect", to: "/de/state/bayern" });
    expect(await resolveStatePage("en", "bavaria", o(f))).toEqual({ kind: "redirect", to: "/en/state/bayern" });
    expect(await resolveStatePage("de", "nrw", o(f))).toEqual({ kind: "missing" });
    expect(f.calls).toEqual([]);
  });

  it("the page is the digest's fragment, its head read and stripped; the digest's 404 is ours, anything else a 503", async () => {
    const ok = stub({ "/internal/state/bayern": { status: 200, body: fragment("de") } });
    const a = await resolveStatePage("de", "bayern", o(ok));
    expect(ok.calls).toEqual(["http://digest:8791/internal/state/bayern?lang=de"]);
    expect(a.kind).toBe("page");
    if (a.kind !== "page") return;
    expect(a.path).toBe("/de/state/bayern");
    expect(a.head.name).toBe("Bayern");
    expect(a.head.title).toContain("Bayern");
    expect(a.head.description).toContain("Bayern");
    expect(a.head.lastmod).toBe("2026-11-03");
    expect(a.head.html).toMatch(/^<section class="statepage" id="statepage">/);
    expect(a.head.html).not.toMatch(/ data-(?:title|description|robots|land|land-name|lastmod)=/);
    expect(await resolveStatePage("de", "bayern", o(stub({})))).toEqual({ kind: "missing" });
    for (const bad of [{ status: 500 }, { status: 200, type: "application/json", body: fragment("de") }, { status: 200, body: "<section class=\"roadpage\"></section>" }, { status: 200, body: `${fragment("de").slice(0, -10)}<script>x</script></section>` }]) {
      expect(await resolveStatePage("de", "bayern", o(stub({ "/internal/state/bayern": bad }))), JSON.stringify(bad).slice(0, 60)).toEqual({ kind: "unavailable" });
    }
  });

  it("a digest that does not answer within the deadline is a 503", async () => {
    const hang = ((_u: string, init: { signal: AbortSignal }) =>
      new Promise((_r, reject) => init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))))) as unknown as FetchLike;
    const t0 = Date.now();
    expect(await resolveStatePage("de", "bayern", { baseUrl: "http://digest:8791", timeoutMs: 50, fetchImpl: hang })).toEqual({ kind: "unavailable" });
    expect(Date.now() - t0).toBeLessThan(1000);
  });
});

describe("the head on the fragment", () => {
  it("is read in every language, naming the Land", () => {
    for (const l of LIVE_LANGS) {
      const h = stateHeadOf(fragment(l, "nordrhein-westfalen"), "nordrhein-westfalen");
      expect(h.name, l).not.toBeNull();
      expect(h.title, l).toContain(h.name!);
      expect(h.title!.length, l).toBeLessThanOrEqual(STATE_HEAD_TITLE_LIMIT);
      expect(h.description!.length, l).toBeLessThanOrEqual(STATE_HEAD_DESCRIPTION_LIMIT);
    }
    expect(stateHeadOf(fragment("en"), "bayern").name).toBe("Bavaria");
  });
  it("a fragment about another Land gives no head", () => {
    const h = stateHeadOf(fragment("de", "hessen"), "bayern");
    expect([h.name, h.title, h.description]).toEqual([null, null, null]);
  });
  it("a value that is not plausibly the digest's is ignored, never shown", () => {
    const base = fragment("de");
    const swap = (re: RegExp, v: string) => stateHeadOf(base.replace(re, v), "bayern");
    expect(swap(/ data-title="[^"]*"/, ' data-title="Hessen – ViaFrei"').title).toBeNull();
    expect(swap(/ data-title="[^"]*"/, ` data-title="Bayern ${"x".repeat(STATE_HEAD_TITLE_LIMIT)}"`).title).toBeNull();
    expect(swap(/ data-description="[^"]*"/, ' data-description="Bayern {count}"').description).toBeNull();
    expect(swap(/ data-description="[^"]*"/, ' data-description="Bayern undefined"').description).toBeNull();
    expect(swap(/ data-lastmod="[^"]*"/, ' data-lastmod="gestern"').lastmod).toBeNull();
    expect(swap(/ data-land-name="[^"]*"/, ' data-land-name=""').title).toBeNull();
    expect(stateHeadOf("<p>not a Land</p>", "bayern")).toEqual({ html: "<p>not a Land</p>", title: null, description: null, name: null, lastmod: null });
  });
});

describe("the index", () => {
  it("is the digest's index fragment without its head", async () => {
    const idx = renderStateIndex("de", stateIndexOf(READ), AT, TICK);
    const a = await resolveStateIndex("de", o(stub({ "/internal/state/index": { status: 200, body: idx } })));
    expect(a.kind).toBe("page");
    if (a.kind !== "page") return;
    expect(a.html).toMatch(/^<section class="stateindex" id="stateindex">/);
    expect(a.html).not.toMatch(/ data-/);
    for (const s of LAND_SLUGS) expect(a.html).toContain(`href="/de/state/${s}"`);
    expect(await resolveStateIndex("de", o(stub({ "/internal/state/index": { status: 502 } })))).toEqual({ kind: "unavailable" });
  });
});

describe("the sitemap's list", () => {
  const LIST = stateListText(stateListOf(READ));
  const answer = (body: string, headers: Record<string, string> = { "state-pages": "16" }, type = "text/plain; charset=utf-8") => o(stub({ "/internal/state/list": { status: 200, type, body, headers } }));
  it("is the digest's sixteen lines", async () => {
    const l = await fetchStateList(answer(LIST));
    expect(l?.map((e) => e.slug)).toEqual([...LAND_SLUGS]);
    expect(l?.every((e) => e.day === "2026-11-03")).toBe(true);
  });
  it("the list is refused whole unless it is exactly the sixteen", async () => {
    const lines = LIST.trimEnd().split("\n");
    expect(await fetchStateList(answer(`${lines.slice(1).join("\n")}\n`, {}))).toBeNull();
    expect(await fetchStateList(answer(`${[...lines.slice(1), lines[1]!].join("\n")}\n`, {}))).toBeNull();
    // all sixteen and one of them twice: sixteen distinct slugs, seventeen lines — still not the list
    expect(await fetchStateList(answer(`${[...lines, lines[8]!].join("\n")}\n`, {}))).toBeNull();
    expect(await fetchStateList(answer(`${[...lines.slice(1), "atlantis\t2026-11-03"].join("\n")}\n`, {}))).toBeNull();
    expect(await fetchStateList(answer(`${[...lines.slice(1), "bayern 2026-11-03"].join("\n")}\n`, {}))).toBeNull();
    expect(await fetchStateList(answer(LIST, { "state-pages": "17" }))).toBeNull();
    expect(await fetchStateList(answer(LIST, {}, "text/html"))).toBeNull();
    expect(await fetchStateList(o(stub({ "/internal/state/list": { status: 500, type: "text/plain", body: LIST } })))).toBeNull();
  });
  it("sixteen entries, each with its alternates in every language and x-default", () => {
    const xml = statesLangXml("fr", stateListOf(READ).map((e) => ({ slug: e.slug, day: "2026-11-03" })));
    const urls = xml.split("<url>").slice(1);
    expect(urls).toHaveLength(16);
    urls.forEach((u, i) => {
      expect(u.match(/<loc>([^<]*)<\/loc>/)?.[1]).toBe(`https://viafrei.de/fr/state/${LAND_SLUGS[i]!}`);
      expect(u.match(/<lastmod>([^<]*)<\/lastmod>/)?.[1]).toBe("2026-11-03");
      expect([...u.matchAll(/hreflang="/g)]).toHaveLength(LIVE_LANGS.length + 1);
      for (const l of LIVE_LANGS) expect(u).toContain(`hreflang="${l}" href="https://viafrei.de/${l}/state/${LAND_SLUGS[i]!}"`);
    });
  });
});

describe("the page's graph (MF1)", () => {
  it("an AdministrativeArea in Germany with the Land's ISO code, and no fuel, no price, no figure", () => {
    for (const l of LIVE_LANGS) {
      const h = stateHeadOf(fragment(l), "bayern");
      const txt = stateJsonLd(l, h.name!, "BY", h.title!, h.description!, statePath(l, "bayern"));
      const g = (JSON.parse(txt) as { "@graph": { "@type": string; identifier?: unknown; name?: unknown; containedInPlace?: { identifier?: unknown } }[] })["@graph"];
      const area = g.find((n) => n["@type"] === "AdministrativeArea");
      expect(area?.identifier, l).toBe("DE-BY");
      expect(area?.name, l).toBe(h.name);
      expect(area?.containedInPlace?.identifier).toBe("DE");
      // the site's own nodes (Organization, WebSite) describe the whole site, fuel included, on every page; the page's are judged
      // — the graph opens with those two (`siteNodes`), and everything after them is the page's
      expect(g.slice(0, 2).map((n) => n["@type"]).sort(), l).toEqual(["Organization", "WebSite"]);
      const own = JSON.stringify(g.slice(2));
      expect(g.length, l).toBeGreaterThanOrEqual(5);
      // whole words: "superficie" (fr/es/it: area) is a fact the page states, "Super" the grade it does not
      expect(own, l).not.toMatch(/\b(?:fuel|kraftstoff\w*|diesel|e10|e5|super|eur|price\w*|offers?|tankstellen?)\b|€/i);
      expect(g.some((n) => /Offer|Product|GasStation/.test(n["@type"]))).toBe(false);
    }
  });
});
