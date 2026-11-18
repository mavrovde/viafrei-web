/**
 * TEMPORARY — the legacy redirects of #892 (`src/lib/legacy-redirects.ts`),
 * removed with that module by #898 (v2.9.0).
 *
 * Every pre-#892 address answers ONE 301 to the exact new address — never a
 * chain, never a loop — each hit is counted by its rule's name alone (no
 * address, no query value, no client), and a lookup the digest cannot answer
 * passes the request on rather than guessing.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LEGACY_FIXED, LEGACY_RULES, legacyDecision, legacyRedirect } from "../src/lib/legacy-redirects.js";
import { setLogSink } from "../src/lib/log.js";
import { resetPlaceNameIndex } from "../src/lib/place-page.js";
import { LIVE_LANGS, PAGES, pageAt, pathFor } from "../src/site/pages.js";
import { isPlaceSlug } from "../src/site/places.js";
import type { FetchLike } from "../src/lib/tiles.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "src");
const html = { get: (n: string) => (n === "content-type" ? "text/html; charset=utf-8" : null) };

/** The digest: `?ags=` names the stored slug (Köln, Neustadt an der Weinstraße); a motorway answers the path its choice has. */
function digest(asked: string[], o: { status?: number; throws?: boolean } = {}): FetchLike {
  return (url) => {
    asked.push(url);
    if (o.throws === true) return Promise.reject(new Error("ECONNREFUSED"));
    const st = o.status ?? 200;
    const ags = /\/internal\/place\/key\?ags=(\d{8})$/.exec(url)?.[1];
    if (ags !== undefined) {
      const slug = ({ "05315000": "koeln", "07316000": "neustadt-an-der-weinstrasse" } as Record<string, string>)[ags];
      const s = st !== 200 ? st : slug === undefined ? 404 : 200;
      return Promise.resolve({ status: s, headers: html, text: () => Promise.resolve(s === 200 ? `<p class="place-slug">${slug!}</p>` : "") });
    }
    if (url.endsWith("/internal/place/index")) {
      const items = [["koeln", "Köln"], ["frankfurt-am-main", "Frankfurt am Main"], ["frankfurt-oder", "Frankfurt (Oder)"]];
      const body = `<ul class="place-index">${items.map(([s, n]) => `<li><a href="/de/place/${s!}">${n!}</a></li>`).join("")}</ul>`;
      return Promise.resolve({ status: st, headers: html, text: () => Promise.resolve(st === 200 ? body : "") });
    }
    const mw = /\/internal\/motorway\/(A\d+)\?lang=([a-z]{2})(.*)$/.exec(url);
    if (mw !== null) {
      const known = /from=20010/.test(mw[3]!) && /to=20040/.test(mw[3]!);
      const towards = /dir=pos/.test(mw[3]!) ? "/towards-wuerzburg" : "";
      const path = `/${mw[2]!}/autobahn/${mw[1]!.toLowerCase()}${known ? "/nesselwang-to-kempten" : ""}${towards}`;
      const headers = { get: (n: string) => (n === "content-type" ? "text/html; charset=utf-8" : n === "motorway-path" ? path : null) };
      return Promise.resolve({ status: st, headers, text: () => Promise.resolve(st === 200 ? '<section class="motorway" id="motorway"><h1>A7</h1></section>' : "") });
    }
    return Promise.resolve({ status: 404, headers: html, text: () => Promise.resolve("") });
  };
}
const opts = (asked: string[] = [], o: { status?: number; throws?: boolean } = {}) => ({ baseUrl: "http://digest", timeoutMs: 500, fetchImpl: digest(asked, o) });
const u = (p: string): URL => new URL(`https://viafrei.de${p}`);

let lines: string[] = [];
let restore: () => void = () => undefined;
beforeEach(() => {
  resetPlaceNameIndex();
  lines = [];
  restore = setLogSink((l) => void lines.push(l));
});
afterEach(() => restore());

/** The 301's target, asserting the status and that exactly one hit was counted under `rule`. */
async function hop(path: string, rule: (typeof LEGACY_RULES)[number], asked: string[] = []): Promise<string> {
  const before = lines.length;
  const r = await legacyRedirect(u(path), opts(asked));
  expect(r, path).not.toBeNull();
  expect(r!.status, path).toBe(301);
  const counted = lines.slice(before).map((l) => JSON.parse(l) as Record<string, unknown>);
  expect(counted, path).toHaveLength(1);
  expect(counted[0]).toMatchObject({ level: 30, kind: "legacy_redirect", key: rule, status: 301 });
  return r!.headers.get("location") ?? "";
}

/** Whether a target is itself a legacy address — a chain (pure: no digest asked). */
const isLegacy = (to: string): boolean => legacyDecision(u(to)) !== null;

describe("the fixed legacy addresses: the pre-#892 page words, in every language", () => {
  it("four per language, each to the page's English path", () => {
    expect(LEGACY_FIXED).toHaveLength(4 * LIVE_LANGS.length);
    for (const l of LIVE_LANGS) {
      expect(LEGACY_FIXED).toContainEqual({ from: `/${l}/neuigkeiten`, to: `/${l}/news` });
      expect(LEGACY_FIXED).toContainEqual({ from: `/${l}/beispiele`, to: `/${l}/examples` });
      expect(LEGACY_FIXED).toContainEqual({ from: `/${l}/neuigkeiten.xml`, to: `/${l}/news.xml` });
      expect(LEGACY_FIXED).toContainEqual({ from: `/${l}/motorway`, to: `/${l}/autobahn` });
    }
  });
  it("each answers one 301 to a page of the map (or its feed), never a legacy address again", async () => {
    for (const f of LEGACY_FIXED) {
      const to = await hop(f.from, f.from.endsWith("/motorway") ? "motorway" : "page-word");
      expect(to).toBe(f.to);
      expect(isLegacy(to), to).toBe(false);
      if (!to.endsWith(".xml")) expect(pageAt(to), to).not.toBeNull();
    }
  });
  it("no live page is a legacy address (no loop)", () => {
    for (const p of PAGES) for (const l of LIVE_LANGS) expect(legacyDecision(u(pathFor(p.id, l))), pathFor(p.id, l)).toBeNull();
  });
});

describe("the motorway word: /<lang>/motorway/* → /<lang>/autobahn/*", () => {
  it("a road, by any spelling, goes to its canonical page in one hop", async () => {
    expect(await hop("/en/motorway/a7", "motorway")).toBe("/en/autobahn/a7");
    expect(await hop("/de/motorway/A07", "motorway")).toBe("/de/autobahn/a7");
    expect(await hop("/ru/motorway/bab-7", "motorway")).toBe("/ru/autobahn/a7");
  });
  it("the layer choice in the query is kept; an address naming no motorway goes to the index, not via a second 301", async () => {
    expect(await hop("/en/motorway/a7?f=1&layer=events", "motorway")).toBe("/en/autobahn/a7?f=1&layer=events");
    expect(await hop("/en/motorway/koeln", "motorway")).toBe("/en/autobahn");
  });
  it("the new address is no legacy address", () => {
    for (const p of ["/de/autobahn/a7", "/en/autobahn/a7/nesselwang-to-kempten/towards-wuerzburg", "/en/autobahn"]) expect(legacyDecision(u(p)), p).toBeNull();
  });
});

describe("the place pages: /de/ort/* and the AGS addresses → /<lang>/place/<stored slug>", () => {
  it("/de/ort/<name> → /de/place/<name> (a name-only guess of #739 keeps being one)", async () => {
    expect(await hop("/de/ort/koeln", "place-ort")).toBe("/de/place/koeln");
    expect(await hop("/en/ort/muenchen", "place-ort")).toBe("/en/place/muenchen");
  });
  it("a TYPED name (review 2.3.4) is resolved to its page's slug in the same one hop; several or none, the page route's lookup", async () => {
    const to = await hop("/de/ort/K%C3%B6ln", "place-ort");
    expect(to).toBe("/de/place/koeln");
    expect(isLegacy(to)).toBe(false);
    expect(await hop("/en/ort/Frankfurt%20am%20Main", "place-ort")).toBe("/en/place/frankfurt-am-main");
    // a name two pages carry: the page route offers the choice (a 200 page, not a second redirect)
    expect(await hop("/de/ort/Frankfurt", "place-ort")).toBe("/de/place/Frankfurt");
    // an index the digest does not give: the same fallback, still one counted 301
    resetPlaceNameIndex();
    const hits = (): number => lines.filter((l) => l.includes('"legacy_redirect"')).length;
    const before = hits();
    const r = await legacyRedirect(u("/de/ort/K%C3%B6ln"), opts([], { status: 500 }));
    expect([r?.status, r?.headers.get("location")]).toEqual([301, "/de/place/K%C3%B6ln"]);
    expect(hits()).toBe(before + 1);
  });
  it("an AGS address, with or without its old name, asks the digest for the STORED slug — one hop, the namesake's qualifier included", async () => {
    const asked: string[] = [];
    expect(await hop("/de/ort/05315000-koeln", "place-ags", asked)).toBe("/de/place/koeln");
    expect(await hop("/en/place/05315000-cologne", "place-ags", asked)).toBe("/en/place/koeln");
    expect(await hop("/tr/place/07316000", "place-ags", asked)).toBe("/tr/place/neustadt-an-der-weinstrasse");
    expect(asked).toEqual(["05315000", "05315000", "07316000"].map((a) => `http://digest/internal/place/key?ags=${a}`));
    for (const to of ["/de/place/koeln", "/tr/place/neustadt-an-der-weinstrasse"]) {
      expect(isLegacy(to), to).toBe(false);
      expect(isPlaceSlug(to.split("/").at(-1)!)).toBe(true);
    }
  });
  it("a Gemeinde the digest does not know, or a digest that does not answer, passes the request on — nothing counted", async () => {
    for (const o of [{}, { status: 500 }, { throws: true }] as const) {
      const before = lines.filter((l) => l.includes("legacy_redirect")).length;
      expect(await legacyRedirect(u("/de/ort/09999999-x"), opts([], o))).toBeNull();
      if (o !== undefined && Object.keys(o).length > 0) expect(await legacyRedirect(u("/de/ort/05315000-koeln"), opts([], o))).toBeNull();
      expect(lines.filter((l) => l.includes("legacy_redirect")).length).toBe(before);
    }
  });
  it("a new place address is no legacy address", () => {
    for (const p of ["/de/place/koeln", "/en/place/frankfurt-am-main", "/de/place/neustadt-an-der-weinstrasse", "/de/place/K%C3%B6ln"]) expect(legacyDecision(u(p)), p).toBeNull();
  });
});

describe("the stretch: ?from=<code>&to=<code>&dir=… → the stretch's path", () => {
  it("the digest names the path the codes' stretch has now; the layers stay the query; one hop from either word", async () => {
    expect(await hop("/de/autobahn/a7?from=20010&to=20040&dir=pos", "stretch-lcl")).toBe("/de/autobahn/a7/nesselwang-to-kempten/towards-wuerzburg");
    expect(await hop("/en/motorway/a7?from=20010&to=20040&f=1&layer=events&layer=bogus", "stretch-lcl")).toBe("/en/autobahn/a7/nesselwang-to-kempten?f=1&layer=events");
    // codes the digest no longer knows: the road's page, never a 404 for a link that used to work
    expect(await hop("/de/autobahn/a7?from=1&to=2", "stretch-lcl")).toBe("/de/autobahn/a7");
    expect(isLegacy("/de/autobahn/a7/nesselwang-to-kempten/towards-wuerzburg")).toBe(false);
  });
  it("the form's junction slugs are not legacy (the page answers its 303); a digest that does not answer passes on", async () => {
    expect(legacyDecision(u("/de/autobahn/a7?from=nesselwang&to=kempten&dir=pos"))).toBeNull();
    // the form always sends both ends, blank or not: a form submission is never a legacy direction link
    expect(legacyDecision(u("/de/autobahn/a7?from=&to=&dir=pos"))).toBeNull();
    expect(await legacyRedirect(u("/de/autobahn/a7?from=20010&to=20040"), opts([], { status: 500 }))).toBeNull();
  });
  it("review 2.3.4: a bare ?dir= is a pre-#892 direction link — one counted 301 from either word, never two hops", async () => {
    expect(await hop("/de/autobahn/a7?dir=pos", "stretch-lcl")).toBe("/de/autobahn/a7/towards-wuerzburg");
    expect(await hop("/en/motorway/a7?dir=pos&f=1&layer=events", "stretch-lcl")).toBe("/en/autobahn/a7/towards-wuerzburg?f=1&layer=events");
    expect(legacyDecision(u("/de/autobahn/a7?dir=up"))).toBeNull();
  });
  it("review 2.3.4: a /motorway/ address the digest cannot answer still leaves the old word in one hop, counted as `motorway`", async () => {
    for (const o of [{ status: 500 }, { throws: true }] as const) {
      const before = lines.length;
      const r = await legacyRedirect(u("/en/motorway/a7?from=20010&to=20040"), opts([], o));
      expect([r?.status, r?.headers.get("location")]).toEqual([301, "/en/autobahn/a7?from=20010&to=20040"]);
      const counted = lines.slice(before).map((l) => JSON.parse(l) as Record<string, unknown>).filter((c) => c["kind"] === "legacy_redirect");
      expect(counted.map((c) => c["key"])).toEqual(["motorway"]);
    }
  });
});

describe("the count (#898's evidence)", () => {
  it("one line per hit carrying the rule's name and nothing else — no address, no query value, no client", async () => {
    await hop("/de/ort/05315000-koeln?utm_source=secret-value", "place-ags");
    await hop("/de/autobahn/a7?from=20010&to=20040&dir=pos", "stretch-lcl");
    for (const l of lines) {
      const o = JSON.parse(l) as Record<string, unknown>;
      expect(Object.keys(o).sort()).toEqual(["key", "kind", "level", "msg", "status", "time"]);
      expect(LEGACY_RULES).toContain(o["key"]);
      expect(l).not.toMatch(/koeln|05315000|secret|20010|nesselwang|\/de\/|\d+\.\d+\.\d+\.\d+/);
    }
  });
  it("every rule is reachable and named in the module's header", () => {
    const src = readFileSync(join(SRC, "lib", "legacy-redirects.ts"), "utf8");
    expect(src.split("\n")[1]).toContain("TEMPORARY");
    expect(src).toContain("#898");
    for (const r of LEGACY_RULES) expect(src, r).toMatch(new RegExp(`^ \\*   ${r} `, "m"));
  });
});

describe("wired at ONE place (#892 owner ruling): no legacy handling outside the module and the middleware", () => {
  it("only the middleware imports the module, and no route file names a pre-#892 word", () => {
    const files: string[] = [];
    const walk = (d: string): void => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|astro)$/.test(n)) files.push(p);
      }
    };
    walk(SRC);
    const importers = files.filter((f) => /from "[^"]*legacy-redirects\.js"/.test(readFileSync(f, "utf8"))).map((f) => f.slice(SRC.length + 1));
    expect(importers).toEqual(["middleware.ts"]);
    const pages = files.filter((f) => f.includes(`${join("src", "pages")}`));
    // code, not the comments that say where the old address went
    const code = (f: string): string => readFileSync(f, "utf8").split("\n").filter((l) => !/^\s*(\/\*\*|\*|\/\/)/.test(l)).join("\n");
    for (const f of pages) expect(code(f), f).not.toMatch(/neuigkeiten|beispiele|\/ort\/|"ort"/);
    expect(pages.some((f) => /[/\\](ort|motorway)[/\\]/.test(f) || /(neuigkeiten|beispiele|motorway)\.(astro|xml\.ts)$/.test(f))).toBe(false);
  });
});

describe("#1166: the lookup and the page after it share the request's two seconds", () => {
  afterEach(() => vi.useRealTimers());
  /** A digest that never answers, and honours the abort as fetch does. */
  const hang: FetchLike = (_url, init) =>
    new Promise<never>((_, reject) =>
      init.signal.addEventListener("abort", () => {
        const e = new Error("aborted");
        e.name = "AbortError";
        reject(e);
      }),
    );
  for (const [rule, path] of [["place-ags", "/de/ort/05315000-koeln"], ["place-ort", "/de/ort/K%C3%B6ln"], ["stretch-lcl", "/de/autobahn/a7?from=20010&to=20040"]] as const) {
    it(`${rule}: a lookup gets only what is left of the request's budget, not a fresh 2 s`, async () => {
      vi.useFakeTimers();
      let done = false;
      void legacyRedirect(u(path), { baseUrl: "http://digest", timeoutMs: 2_000, fetchImpl: hang }, Date.now() + 300).then(() => (done = true));
      await vi.advanceTimersByTimeAsync(300);
      expect(done).toBe(true);
    });
  }
  it("the middleware opens the budget first and hands the lookup that one, and the place route reads under it too", () => {
    const mw = readFileSync(join(SRC, "middleware.ts"), "utf8");
    expect(mw).toMatch(/context\.locals\.budgetEndsAt = budgetFrom\(Date\.now\(\), currentAgentClass\(\)\);[\s\S]*legacyRedirect\(context\.url, \{[^}]*\}, context\.locals\.budgetEndsAt\)/);
    const place = readFileSync(join(SRC, "pages", "[lang]", "place", "[slug].astro"), "utf8");
    expect(place).toContain("endsAt: Astro.locals.budgetEndsAt");
  });
});
