/**
 * #1111: the site search in the shell — the fold and the score the shell's own kinds (pages, News) are matched by,
 * the digest's answer read back, the merge and its order, the box's route (`POST /fragment/search`) and the search
 * page's resolver. The digest's answer here is the digest's own renderer's (`renderSiteSearch`), so the shape the
 * shell parses cannot drift from the shape the digest writes.
 */
import { Script } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { all, first, text } from "@viafrei/design/testing";
import { renderSiteSearch } from "../../../.pinned/app/packages/digest/dist/src/presentation/site-search-html.js";
import { siteSearchRoute, suggestRoute } from "../src/lib/fragment-route.js";
import { resolveSearchPage } from "../src/lib/search-page.js";
import { DIGEST_KINDS, fold, pageHits, parseDigest, ranked, renderNone, renderResults, score, siteSearch, type Group, type Results } from "../src/lib/site-search.js";
import { SUGGEST_JS } from "../src/lib/suggest.js";
import type { FetchLike } from "../src/lib/tiles.js";
import { t } from "../src/i18n/index.js";
import { LIVE_LANGS, pathFor } from "../src/site/pages.js";

const hit = (name: string, href: string, score: number, alt?: string) => ({ kind: "place" as const, name, href, score, where: ["Kleve"], source: "bkg_gvisys", ...(alt === undefined ? {} : { alt }) });
const DIGEST = renderSiteSearch("de", {
  groups: new Map([
    ["motorway", { hits: [{ kind: "motorway" as const, name: "A7", href: "/de/autobahn/a7", score: 3, where: [] }], total: 1 }],
    ["place", { hits: [hit("Kevelaer", "/de/place/kevelaer", 2, "/de?at=ags:05154036")], total: 1 }],
  ] as never),
  partial: ["exit"],
});

function digest(asked: string[], body: string | null = DIGEST, status = 200): FetchLike {
  return (url) => {
    asked.push(url);
    if (body === null) return Promise.reject(new Error("down"));
    return Promise.resolve({ status, headers: { get: (n: string) => (n === "content-type" ? "text/html; charset=utf-8" : null) }, text: () => Promise.resolve(body) });
  };
}
const o = (asked: string[], body: string | null = DIGEST, status = 200) => ({ baseUrl: "http://digest", timeoutMs: 300, fetchImpl: digest(asked, body, status) });
const req = (body: unknown, method = "POST"): Request =>
  new Request("http://shell/fragment/search", method === "POST" ? { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : { method });

describe("#1111 the fold and the score", () => {
  it("folds case, umlauts both ways, ß, accents, hyphens and spaces alike", () => {
    for (const [a, b] of [["Köln", "Koeln"], ["KÖLN", "koeln"], ["Straße", "strasse"], ["Mühlheim-Kärlich", "muehlheim kaerlich"], ["Görlitz", "goerlitz"], ["Ébène", "ebene"]]) expect(fold(a!), `${a} ~ ${b}`).toBe(fold(b!));
    expect(fold("Köln")).not.toBe(fold("Koln a"));
  });
  it("scores whole 3, a prefix 2, a word or (four letters on) a contained part 1, else 0", () => {
    expect(score("Datenschutz", "datenschutz")).toBe(3);
    expect(score("Datenschutz", "Daten")).toBe(2);
    expect(score("Über ViaFrei", "viafrei")).toBe(1);
    expect(score("Datenschutz", "schutz")).toBe(1);
    expect(score("Datenschutz", "utz")).toBe(0);
    expect(score("Datenschutz", "")).toBe(0);
  });
});

describe("#1111 the site's pages: by the name in the visitor's language, in German, in English and by the address word", () => {
  it("Datenschutz and privacy find the privacy page in both languages; connect finds the connect page", () => {
    for (const lang of ["de", "en"] as const) {
      for (const q of ["Datenschutz", "privacy"]) expect(pageHits(lang, q)[0]?.href, `${lang} ${q}`).toBe(pathFor("datenschutz", lang));
      expect(pageHits(lang, "connect").map((h) => h.href), lang).toContain(pathFor("connect", lang));
    }
    expect(pageHits("de", "zzqx")).toEqual([]);
  });
  it("never the 404 or the start page", () => {
    for (const lang of LIVE_LANGS) for (const h of pageHits(lang, "ViaFrei")) expect([pathFor("404", lang), pathFor("start", lang)], lang).not.toContain(h.href);
  });
});

describe("#1111 the digest's answer read back", () => {
  it("its groups, their order, best and totals, the partial kinds and the credit lines", () => {
    const r = parseDigest(DIGEST)!;
    expect(r.groups.map((g) => [g.kind, g.best, g.total])).toEqual([["motorway", 3, 1], ["place", 2, 1]]);
    expect(r.partial).toEqual(["exit"]);
    expect(r.credits).toMatch(/class="credit"/);
    expect(r.credits).not.toMatch(/ss-group/);
    expect(parseDigest("<p>nope</p>")).toBeNull();
  });
  it("ranks best first, the kinds' order breaking a tie", () => {
    const g = (kind: Group["kind"], best: number): Group => ({ kind, best, total: 1, items: "" });
    expect(ranked([g("page", 2), g("station", 3), g("motorway", 2), g("place", 3)]).map((x) => x.kind)).toEqual(["place", "station", "motorway", "page"]);
  });
  it("renders the groups as plain links, labels the Gemeinde's second action, says what is missing", () => {
    const r = parseDigest(DIGEST)!;
    for (const lang of LIVE_LANGS) {
      const html = renderResults(lang, "Kev", r, { mode: "suggest" });
      const alt = all(html, 'a.ss-alt[href="/de?at=ags:05154036"]');
      expect(alt.length, lang).toBeGreaterThan(0);
      expect(alt.filter((a) => text(a).trim() === ""), lang).toEqual([]);
      expect(html, lang).toContain(t(lang, "search.partial"));
      expect(html, lang).toContain(`/${lang}/search?q=Kev`);
      expect(html, lang).not.toMatch(/<script|\sdata-/);
    }
    const none = renderResults("de", "Kev", { ...r, partial: [] }, { mode: "suggest" });
    expect(none).not.toContain(t("de", "search.partial"));
  });
  it("a kind's page: 20 a page, the pager's prev/next on the right pages", () => {
    const many: Results = { groups: [{ kind: "station", best: 2, total: 45, items: "" }], partial: [], credits: "" };
    const p1 = renderResults("en", "Köln", many, { mode: "page", kind: "station", page: 1 });
    expect(p1).not.toContain('rel="prev"');
    expect(p1).toContain('rel="next"');
    const p3 = renderResults("en", "Köln", many, { mode: "page", kind: "station", page: 3 });
    expect(p3).toContain('rel="prev"');
    expect(p3).not.toContain('rel="next"');
    expect(renderResults("en", "Köln", many, { mode: "page", kind: null, page: 1 })).toContain("kind=station");
  });
  it("the empty state in every language: said in words, the motorway index, the query escaped", () => {
    for (const lang of LIVE_LANGS) {
      const html = renderNone(lang, "<b>x", null);
      expect(html, lang).toContain(`href="${pathFor("motorways", lang)}"`);
      expect(html, lang).not.toContain("<b>x");
    }
  });
});

describe("#1111 the merge", () => {
  it("a digest that does not answer: the shell's own groups and every digest kind named as missing", async () => {
    for (const d of [o([], null), o([], DIGEST, 500), o([], "<p>other</p>")]) {
      const r = await siteSearch("de", "Datenschutz", d, { mode: "suggest" });
      expect(r?.groups.map((g) => g.kind)).toEqual(["page"]);
      expect(r?.partial).toEqual([...DIGEST_KINDS]);
    }
  });
  it("a kind of the shell's own asks the digest nothing", async () => {
    const asked: string[] = [];
    const r = await siteSearch("en", "privacy", o(asked), { mode: "page", kind: "page", page: 1 });
    expect(asked).toEqual([]);
    expect(r?.groups.map((g) => g.kind)).toEqual(["page"]);
  });
});

describe("#1111 POST /fragment/search", () => {
  it("answers the merged list, never stored; what was typed reaches the digest in the query and no log line", async () => {
    const lines: string[] = [];
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((k) => vi.spyOn(console, k).mockImplementation((...a: unknown[]) => void lines.push(JSON.stringify(a))));
    try {
      const asked: string[] = [];
      const res = await siteSearchRoute(req({ q: "Geheimstrasse 42", lang: "de" }), o(asked));
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(first(await res.text(), ".place-suggest.site-results")).not.toBeNull();
      expect(asked).toEqual(["http://digest/internal/search?q=Geheimstrasse+42&lang=de"]);
      expect(lines.join("\n")).not.toContain("Geheimstrasse");
    } finally {
      for (const s of spies) s.mockRestore();
    }
  });
  for (const method of ["GET", "HEAD"]) {
    it(`${method} is a 405`, async () => {
      const asked: string[] = [];
      expect((await siteSearchRoute(req(null, method), o(asked))).status).toBe(405);
      expect(asked).toEqual([]);
    });
  }
  for (const body of [{ q: "Köln", lang: "xx" }, { q: 42, lang: "de" }, { q: "K", lang: "de" }, { q: "x".repeat(61), lang: "de" }]) {
    it(`a 400 for ${JSON.stringify(body).slice(0, 40)}`, async () => {
      const asked: string[] = [];
      expect((await siteSearchRoute(req(body), o(asked))).status).toBe(400);
      expect(asked).toEqual([]);
    });
  }
});

describe("#1111 AC 8 (2.5.8): what was typed reaches no log line on the paths that degrade", () => {
  it("the header box with the places down and the search partial, and a results page answered by the nearest spelling", async () => {
    const lines: string[] = [];
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((k) => vi.spyOn(console, k).mockImplementation((...a: unknown[]) => void lines.push(JSON.stringify(a))));
    try {
      const asked: string[] = [];
      const partial = renderSiteSearch("de", { groups: new Map(), partial: ["place", "station"] });
      // the places' suggestions fail, the search answers with its place kind cut off at the deadline
      const degraded: FetchLike = (url, init) => (asked.push(url), url.includes("/internal/search") ? digest([], partial)(url, init) : Promise.reject(new Error("down")));
      const box = await suggestRoute(req({ q: "Geheimstrasse 42", lang: "de" }), { baseUrl: "http://digest", timeoutMs: 300, fetchImpl: degraded });
      expect(box.status).toBe(200);
      // the box's empty state names the query back to the one who typed it (`renderNone`): an answer, never a log
      expect(await box.text()).toContain("ss-none");
      const nearest = renderSiteSearch("de", { groups: new Map(), partial: [], nearest: hit("Kevelaer", "/de/place/kevelaer", 0, "/de?at=ags:05154036") as never });
      const page = (await resolveSearchPage("de", new URLSearchParams("q=Geheimstrasse+42&full=1"), o(asked, nearest))).html;
      expect(page).toContain("Kevelaer");
      // the paths ran with what was typed, and nothing of it was logged
      expect(asked.some((u) => u.includes("Geheimstrasse"))).toBe(true);
      expect(lines.join("\n")).not.toContain("Geheimstrasse");
    } finally {
      for (const s of spies) s.mockRestore();
    }
  });
});

describe("#1111 the search page's resolver", () => {
  it("no query: the box alone; a short one: the hint; a query: the groups; nothing found: the empty state", async () => {
    expect((await resolveSearchPage("de", new URLSearchParams(""), o([]))).html).toBe("");
    expect((await resolveSearchPage("de", new URLSearchParams("q=A"), o([]))).html).toContain(t("de", "search.hint"));
    expect((await resolveSearchPage("de", new URLSearchParams("q=A7"), o([]))).html).toContain('href="/de/autobahn/a7"');
    const empty = renderSiteSearch("de", { groups: new Map(), partial: [] });
    const asked: string[] = [];
    const none = (await resolveSearchPage("en", new URLSearchParams("q=zzqxw"), o(asked, empty))).html;
    expect(none).toContain("ss-none");
    expect(none).toContain(`href="${pathFor("motorways", "en")}"`);
    expect(none).not.toContain(t("en", "search.nearest"));
    // 2.5.8 (AC 4): the empty state asks the digest ONCE — no prefix re-asks
    expect(asked).toEqual(["http://digest/internal/search?q=zzqxw&lang=en&full=1&page=1"]);
  });
  it("2.5.8 (AC 4): the nearest spelling comes in the same answer — read back, shown in every language, the digest asked once", async () => {
    const near = { kind: "place" as const, name: "Kevelaer", href: "/de/place/kevelaer-05154036", alt: "/de?at=ags:05154036", score: 0 as const, where: ["Nordrhein-Westfalen"], source: "bkg_gvisys" };
    const answer = renderSiteSearch("de", { groups: new Map(), partial: ["poi"], nearest: near });
    const r = parseDigest(answer)!;
    expect(r.groups).toEqual([]);
    expect(r.partial).toEqual(["poi"]);
    expect(r.nearest?.item).toMatch(/^<li class="place-sug[\s\S]*Kevelaer[\s\S]*<\/li>$/);
    expect(r.nearest?.credits).toContain("https://www.bkg.bund.de");
    expect(r.credits).not.toContain("ss-nearest");
    expect(parseDigest(DIGEST)?.nearest).toBeNull();
    for (const lang of LIVE_LANGS) {
      const asked: string[] = [];
      const html = (await resolveSearchPage(lang, new URLSearchParams("q=Kevlaer"), o(asked, answer))).html;
      expect(asked, lang).toHaveLength(1);
      expect(html, lang).toContain("ss-none");
      expect(html, lang).toContain(t(lang, "search.nearest"));
      expect(html, lang).toContain('href="/de/place/kevelaer-05154036"');
      const alt = all(html, 'a.ss-alt[href="/de?at=ags:05154036"]');
      expect(alt.filter((a) => text(a).trim() !== "").length, lang).toBe(1);
      expect(html, lang).toContain(`href="${pathFor("motorways", lang)}"`);
      expect(html, lang).toContain("https://www.bkg.bund.de");
      expect(html, lang).toContain(t(lang, "search.partial"));
      expect(html, lang).not.toContain("ss-nearest");
    }
  });
  it("an unknown kind is read as none and a malformed page as the first", async () => {
    const asked: string[] = [];
    await resolveSearchPage("de", new URLSearchParams("q=A7&kind=nope&page=-3"), o(asked));
    expect(asked).toEqual(["http://digest/internal/search?q=A7&lang=de&full=1&page=1"]);
  });
});

describe("#1111 the box's script", () => {
  it("knows the site search, asks its route, debounced", () => {
    expect(SUGGEST_JS).toContain('classList.contains("site-search")');
    expect(SUGGEST_JS).toContain('"/fragment/search"');
  });

  // #1112: the position bar is a search form with a combobox too, and its list is the place island's — the shared
  // script answered it as a station field and its empty answer wiped the places (place-head-1088 e2e)
  it("leaves the position bar's field to the place island; the site, station and filter fields stay its own", () => {
    const src = /function kind\(t\) \{[\s\S]*?\n\}/u.exec(SUGGEST_JS)?.[0];
    expect(src).toBeDefined();
    const kind = new Script(`(${src!})`).runInNewContext({}) as (t: unknown) => string | null;
    const field = (classes: string[], role: string | null = "search") => ({
      getAttribute: (a: string) => (a === "role" ? "combobox" : a === "aria-controls" ? "list" : null),
      form: { classList: { contains: (c: string) => classes.includes(c) }, getAttribute: (a: string) => (a === "role" ? role : null) },
    });
    expect(kind(field(["placepos__search"]))).toBeNull();
    expect(kind(field(["site-search"]))).toBe("site");
    expect(kind(field(["stsearch"]))).toBe("stations");
    expect(kind(field(["stlive__filter"], null))).toBe("names");
  });
});
