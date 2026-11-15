/**
 * Microsoft Clarity behind the one consent (#717), at the unit layer: the
 * configuration (`CLARITY_PROJECT_ID`, the `CLARITY_ENABLED` switch, the
 * refusal that never prints the value), the call order over a fake of the
 * package's API (init only after accept, consent(false) only after init on a
 * withdrawal, never identify), the steward ruling's code conditions (C-4 the
 * click guard and its marker, C-5 no free text, C-6 the withdrawal, C-8 no
 * value in a verbatim attribute), the CSP origins (only with a tag, an id AND
 * the island), the cookie expiry, the consent text in 22 languages, the
 * Datenschutz subsection and the prod wiring (both compose files, the
 * template, the ops-only token in no service). The browser half is
 * `e2e/clarity-717.e2e.ts`.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CLARITY_GRANTED,
  CLARITY_STOP_CLASS,
  CLARITY_STOP_SELECTOR,
  carriesFreeText,
  clarityClickGuard,
  clarityConfigOf,
  clarityIdOf,
  clarityStarted,
  insideStopRegion,
  startClarity,
  withdrawClarity,
  type ClarityApi,
  type ClarityPage,
} from "../src/analytics/clarity.js";
import { CLARITY_COOKIE, expireClarityCookies } from "../src/analytics/ga-cookies.js";
import { readEnv } from "../src/lib/env.js";
import { CLARITY_ORIGINS, contentSecurityPolicy } from "../src/security/csp.js";
import { MOTORWAY_REGISTER, motorwayPath } from "../src/site/motorways.js";
import { ANALYTICS_PAGES, CLARITY_DYNAMIC_PAGES, LIVE_LANGS, measurementOf } from "../src/site/pages.js";

const WEB = new URL("../", import.meta.url).pathname;
const ROOT = join(WEB, "..", "..");
const read = (p: string): string => readFileSync(join(WEB, p), "utf8");
const readRoot = (p: string): string => readFileSync(join(ROOT, p), "utf8");
/** A fixture id: the right shape, never the real project's. */
const FIXTURE = "vfprobe717";
const NONCE = "abcdefghijklmnopqrstuv";

function fakeApi(): ClarityApi & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    init: (id: string) => calls.push(`init:${id}`),
    consentV2: (o) => calls.push(`consentV2:${JSON.stringify(o)}`),
    consent: (c) => calls.push(`consent:${String(c)}`),
  };
}

/** A page at an address, recording the listeners it is given and every `clarity(...)` call. */
function fakePage(href = "https://viafrei.de/de"): ClarityPage & { listeners: { type: string; capture: boolean; fn: (ev: { target: unknown }) => void }[]; stops: string[] } {
  const stops: string[] = [];
  const listeners: { type: string; capture: boolean; fn: (ev: { target: unknown }) => void }[] = [];
  return {
    location: { href },
    listeners,
    stops,
    addEventListener: (type, fn, o) => void listeners.push({ type, capture: o.capture, fn }),
    clarity: (m: string) => void stops.push(m),
  };
}

/** Source without its comments: a pin on code, never on the prose that explains it. */
const code = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
/** An element-like target: `closest` answers for the marker when the element sits inside a marked region. */
const target = (marked: boolean): { closest: (s: string) => object | null } => ({ closest: (s: string) => (marked && s === CLARITY_STOP_SELECTOR ? {} : null) });

describe("the configuration (clarityConfigOf, readEnv)", () => {
  it("empty or unset is off, and the switch is not needed for that", () => {
    expect(clarityConfigOf({})).toBeUndefined();
    expect(clarityConfigOf({ CLARITY_PROJECT_ID: "" })).toBeUndefined();
    expect(clarityConfigOf({ CLARITY_PROJECT_ID: "   " })).toBeUndefined();
    expect(clarityConfigOf({ CLARITY_PROJECT_ID: "", CLARITY_ENABLED: "true" })).toBeUndefined();
  });
  it("a well-formed id is on unless the switch says off; the switch keeps the id but turns it off", () => {
    expect(clarityConfigOf({ CLARITY_PROJECT_ID: FIXTURE })).toBe(FIXTURE);
    for (const on of ["", "true", "TRUE", "1", "yes"]) expect(clarityConfigOf({ CLARITY_PROJECT_ID: FIXTURE, CLARITY_ENABLED: on }), on).toBe(FIXTURE);
    for (const off of ["false", "False", "0", "no"]) expect(clarityConfigOf({ CLARITY_PROJECT_ID: FIXTURE, CLARITY_ENABLED: off }), off).toBeUndefined();
  });
  it("a malformed id is refused, naming the variable and never the value", () => {
    for (const bad of ["ABCDEFGHIJ", "abc", "abcdefghijklm", "abcd-efghi", "abcdefghi!", "abc defghi"]) {
      let msg = "";
      try {
        clarityConfigOf({ CLARITY_PROJECT_ID: bad });
      } catch (e) {
        msg = (e as Error).message;
      }
      expect(msg, bad).toContain("CLARITY_PROJECT_ID");
      expect(msg, bad).toContain("value not shown");
      expect(msg, bad).not.toContain(bad.trim());
    }
  });
  it("a switch that is neither on nor off is refused — a typo of 'false' must not mean on — without its value", () => {
    for (const bad of ["flase", "enabled", "2", "nein"]) {
      expect(() => clarityConfigOf({ CLARITY_PROJECT_ID: FIXTURE, CLARITY_ENABLED: bad }), bad).toThrow(/CLARITY_ENABLED/);
      try {
        clarityConfigOf({ CLARITY_PROJECT_ID: FIXTURE, CLARITY_ENABLED: bad });
      } catch (e) {
        expect((e as Error).message).not.toMatch(new RegExp(`\\b${bad}\\b`));
      }
    }
  });
  it("the id shape is 8 to 12 lower-case letters and digits", () => {
    expect(clarityIdOf("abcdefgh")).toBe("abcdefgh");
    expect(clarityIdOf("abcdefgh1234")).toBe("abcdefgh1234");
    expect(clarityIdOf("abcdefg")).toBeUndefined();
    expect(clarityIdOf("abcdefgh12345")).toBeUndefined();
    expect(clarityIdOf(undefined)).toBeUndefined();
  });
  it("readEnv carries the id only when it is on, and refuses a malformed one", () => {
    expect(readEnv({}).clarityProjectId).toBeUndefined();
    expect("clarityProjectId" in readEnv({})).toBe(false);
    expect(readEnv({ CLARITY_PROJECT_ID: FIXTURE }).clarityProjectId).toBe(FIXTURE);
    expect(readEnv({ CLARITY_PROJECT_ID: FIXTURE, CLARITY_ENABLED: "false" }).clarityProjectId).toBeUndefined();
    expect(() => readEnv({ CLARITY_PROJECT_ID: "NOT-AN-ID" })).toThrow(/CLARITY_PROJECT_ID/);
  });
  it("the middleware reads it once at load and ends the process on a refusal, with one line and no value", () => {
    const mw = read("src/middleware.ts");
    expect(mw).toMatch(/const CLARITY_ID = \(\(\): string \| undefined => \{\s*try \{\s*return clarityConfigOf\(process\.env\);/);
    expect(mw).toMatch(/catch \(err\) \{\s*logLine\(60, \{ kind: "config_refused", key: "clarity" \}[^;]*;\s*process\.exit\(78\);/);
    expect(mw).toContain("const CLARITY = STAGING ? undefined : CLARITY_ID;");
    expect(mw).toContain("context.locals.clarityId = CLARITY;");
  });
});

describe("the call order over the package's API (src/analytics/clarity.ts)", () => {
  it("startClarity: the click guard first, then init with the id, THEN the granted signal — analytics only, never ads", () => {
    const api = fakeApi();
    const page = fakePage();
    expect(startClarity(FIXTURE, api, page)).toBe(true);
    expect(api.calls).toEqual([`init:${FIXTURE}`, `consentV2:${JSON.stringify({ ad_Storage: "denied", analytics_Storage: "granted" })}`]);
    expect(CLARITY_GRANTED.ad_Storage).toBe("denied");
    expect(page.listeners.map((l) => `${l.type}:${String(l.capture)}`)).toEqual(["click:true", "contextmenu:true"]);
  });
  it("startClarity with a malformed or missing id calls nothing and installs nothing", () => {
    for (const bad of [undefined, "", "BAD", "abc"]) {
      const api = fakeApi();
      const page = fakePage();
      expect(startClarity(bad, api, page)).toBe(false);
      expect(api.calls).toEqual([]);
      expect(page.listeners).toEqual([]);
    }
  });
  it("withdrawClarity (C-6): nothing before init (the package would throw); after it consent(false), which erases and stops — never the ConsentV2 denied signal, never init", () => {
    const before = fakeApi();
    expect(clarityStarted({})).toBe(false);
    expect(withdrawClarity({}, before)).toBe(false);
    expect(before.calls).toEqual([]);
    const after = fakeApi();
    const win = { clarity: (): void => undefined };
    expect(clarityStarted(win)).toBe(true);
    expect(withdrawClarity(win, after)).toBe(true);
    expect(after.calls).toEqual(["consent:false"]);
  });
});

describe("C-5: no free text reaches Clarity", () => {
  it("an address with a non-empty find= or q= starts nothing — no tag, no listener", () => {
    for (const href of ["https://viafrei.de/de/autobahn/a7?find=Kassel", "https://viafrei.de/de/autobahn?q=7", "https://viafrei.de/de/autobahn/a7?r=25&find=x#mw-search", "https://viafrei.de/de?q=a&q=", "not a url"]) {
      const api = fakeApi();
      const page = fakePage(href);
      expect(carriesFreeText(href), href).toBe(true);
      expect(startClarity(FIXTURE, api, page), href).toBe(false);
      expect(api.calls, href).toEqual([]);
      expect(page.listeners, href).toEqual([]);
    }
  });
  it("the closed vocabularies and an empty find= or q= do not refuse", () => {
    for (const href of ["https://viafrei.de/de", "https://viafrei.de/de?topics=fuel,parking", "https://viafrei.de/de/autobahn/a7?show=parking&r=25", "https://viafrei.de/de/autobahn/a7?find=", "https://viafrei.de/de/autobahn?q="]) {
      expect(carriesFreeText(href), href).toBe(false);
      expect(startClarity(FIXTURE, fakeApi(), fakePage(href)), href).toBe(true);
    }
  });
  it("no script writes find= or q= into the address through the History API while Clarity runs", () => {
    const files = (dir: string): string[] =>
      readdirSync(join(WEB, dir), { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? files(join(dir, d.name)) : /\.(ts|svelte|astro|json)$/.test(d.name) && !d.name.endsWith(".d.ts") ? [join(dir, d.name)] : []));
    const writers = files("src").filter((f) => /\b(replaceState|pushState)\s*\(/.test(read(f)));
    expect(writers.length).toBeGreaterThanOrEqual(5);
    // a minified comparison ("&&q===") is no address: `=(?!=)` (#1198, the island's minifier named a variable q)
    const freeText = /searchParams\.(set|append)\(\s*\\?["'](find|q)\\?["']|[?&](find|q)=(?!=)/;
    const offenders = writers.filter((f) => freeText.test(code(read(f))));
    // the one script that writes find= (the motorway page's search as you type) does it only when no Clarity runs
    expect(offenders).toEqual(["src/lib/motorway-search.ts"]);
    const search = read("src/lib/motorway-search.ts");
    const writes = search.match(/[^`;]*history\.(replaceState|pushState)\([^`]*/g) ?? [];
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatch(/^if\(typeof w\.clarity!=="function"\)history\.replaceState\(/);
  });
});

describe("C-4: no click in a marked region reaches the tag", () => {
  it("the guard stops Clarity for a click or a context menu inside a marked region, and for nothing else", () => {
    const page = fakePage();
    const guard = clarityClickGuard(page);
    guard({ target: target(false) });
    guard({ target: null });
    guard({ target: "text" });
    expect(page.stops).toEqual([]);
    guard({ target: target(true) });
    guard({ target: target(true) });
    expect(page.stops).toEqual(["stop", "stop"]);
    expect(insideStopRegion(target(true))).toBe(true);
    expect(insideStopRegion({})).toBe(false);
    // before the tag is there, nothing is called and nothing throws
    expect(() => clarityClickGuard({})({ target: target(true) })).not.toThrow();
  });
  it("the listeners are capture listeners on the page object handed in — the window, which captures before document", () => {
    const page = fakePage();
    startClarity(FIXTURE, fakeApi(), page);
    for (const l of page.listeners) {
      l.fn({ target: target(true) });
      expect(l.capture).toBe(true);
    }
    expect(page.stops).toEqual(["stop", "stop"]);
    expect(code(read("src/components/Consent.svelte"))).toContain("startClarity(clarity, Clarity, window);");
  });
  it("the marker is one constant class token", () => {
    expect(CLARITY_STOP_CLASS).toBe("vf-noclarity");
    expect(CLARITY_STOP_SELECTOR).toBe(".vf-noclarity");
  });
  it("every region that renders a place-derived or fuel link on a Clarity page carries the marker", () => {
    // the home: the place bar's section holds the position bar (#1112, its search and chips) and the place cards' slot
    expect(read("src/components/PlaceBlock.astro")).toMatch(/<section class="placebar vf-noclarity" id="place"[^>]*>[\s\S]*<div class="place-slot" id="place-slot"[\s\S]*<\/section>/);
    // #1153: the header's place row (its search, its chips, the remembered place), on every page
    expect(read("src/components/PlaceBar.astro")).toMatch(/^<div class="site-place vf-noclarity" id="place-bar">/m);
    // the motorway page: the place bar, whose section holds the around block's slot
    expect(read("src/components/MotorwayPlace.astro")).toMatch(/<section class="placebar placebar--motorway vf-noclarity" id="place"[^>]*>[\s\S]*<div class="place-slot mwa-slot" id="place-slot">[\s\S]*<\/section>/);
    // the home's fuel tile (#717 review, finding 2): its station names and towns link place pages (commit 15d4bf5a4)
    // and its rows name MTS-K addresses, so the digest marks the tile's ROOT with the shell's own token, and the
    // shell's two shape checks still accept it (else the home would show the fuel tile as an error tile)
    const tiles = readRoot("packages/digest/src/presentation/tiles.ts");
    expect(tiles).toContain(`export const CLARITY_STOP_MARKER = "${CLARITY_STOP_CLASS}";`);
    const fuelTile = /function fuelTile\([\s\S]*?\n}\n/.exec(tiles)?.[0] ?? "";
    expect(fuelTile).toContain("stationHtml(lang, p.cheapest");
    expect(fuelTile).toContain("marker: CLARITY_STOP_MARKER,");
    expect(readRoot("packages/design/src/html.ts")).toContain('${t.marker === undefined ? "" : ` ${esc(t.marker)}`}" id="tile-${id}"');
    expect(read("src/lib/tiles.ts")).toContain("is-(ok|stale|empty|error)(?: vf-noclarity)?\" id=\"tile-${id}\"");
    expect(read("src/lib/fill.ts")).toContain("is-(?:ok|stale|empty|error)(?: vf-noclarity)?\"/");
    // and the kept-copy rule reads a marked fuel tile as live, so the home keeps its last good copy as before
    expect(read("src/lib/tiles.ts")).toContain('is-(ok|stale)(?: vf-noclarity)?"/.test(html)');
    expect(tiles).toContain('is-(ok|stale|empty|error)(?: vf-noclarity)?"/.exec(fragment)');
    // (the motorway pages run no Clarity since the C-4 fallback of 2026-10-27; their markers stay, harmless)
    // every motorway fuel fragment lands in the fuel card, which the digest marks
    expect(readRoot("packages/digest/src/presentation/motorway-layers-html.ts")).toContain('cls: "motorway__fuel vf-noclarity",');
    expect(read("src/lib/motorway-fuel.ts")).toContain('document.querySelector(".motorway__fuel")');
    // the place cards (and their fuel rows, ↻ and pager links) are swapped into #place-slot and nowhere else
    // — the one thing either appends to <body> is its polite live region, which carries announced text and no link
    for (const f of ["src/lib/card-refresh.ts", "src/lib/card-more.ts"]) {
      const appended = [...code(read(f)).matchAll(/document\.body\.(?:appendChild|append|prepend|insertAdjacentHTML)\(([^)]*)\)/g)].map((m) => m[1]);
      expect(appended, f).toEqual(["live"]);
    }
  });
});

// C-8 (the place card and the fuel row, no value in an attribute the tag sends verbatim) is held where those are
// rendered: packages/digest/src/presentation/clarity-c8.test.ts.

describe("the CSP (src/security/csp.ts) and who asks for it", () => {
  it("the origins are Microsoft's own list", () => {
    expect([...CLARITY_ORIGINS]).toEqual(["https://*.clarity.ms", "https://c.bing.com"]);
  });
  it("with a tag and the island: script, connect and img name Clarity; nothing else changes, no unsafe-inline", () => {
    const on = contentSecurityPolicy(NONCE, "G-0", false, false, true);
    const off = contentSecurityPolicy(NONCE, "G-0", false, false, false);
    for (const d of ["script-src", "connect-src", "img-src"]) {
      const dir = on.split("; ").find((x) => x.startsWith(d)) ?? "";
      for (const o of CLARITY_ORIGINS) expect(dir, d).toContain(o);
    }
    for (const d of ["default-src", "style-src", "form-action", "base-uri", "frame-ancestors"]) {
      expect(on.split("; ").find((x) => x.startsWith(d))).toBe(off.split("; ").find((x) => x.startsWith(d)));
    }
    expect(on).not.toContain("unsafe-inline");
    expect(on).toContain(`script-src 'nonce-${NONCE}' 'strict-dynamic'`);
  });
  it("without the island (clarity false) or without a tag, no Clarity origin at all", () => {
    expect(contentSecurityPolicy(NONCE, "G-0", false, false, false)).not.toMatch(/clarity|bing/);
    expect(contentSecurityPolicy(NONCE, "G-0", true, true, false)).not.toMatch(/clarity|bing/);
    expect(contentSecurityPolicy(NONCE, undefined, false, false, true)).not.toMatch(/clarity|bing/);
    expect(contentSecurityPolicy(NONCE, undefined, true, false, true)).not.toMatch(/clarity|bing/);
  });
  it("the middleware asks for them only with an id AND a page Base declared a Clarity page; Base declares it only where Clarity runs", () => {
    expect(read("src/middleware.ts")).toContain("const clarity = CLARITY !== undefined && context.locals.clarityPage === true;");
    const base = read("src/layouts/Base.astro");
    expect(base).toContain("const where = measurementOf(page, dynamic !== undefined, measure);");
    expect(base).toContain("const measured = tag !== undefined && where.ga;");
    expect(base).toContain("const clarity = measured && where.clarity ? Astro.locals.clarityId : undefined;");
    expect(base).toContain("if (clarity !== undefined) Astro.locals.clarityPage = true;");
    expect(base.match(/clarityPage = true/g)).toHaveLength(1);
    // the island hands Clarity its id through `clarity` and nothing else: no id, no startClarity (Consent.svelte)
    expect(base).toContain("{...(clarity !== undefined ? { clarity } : {})}");
    // the island is rendered on `measured` and only there
    expect(base).toMatch(/measured && tag !== undefined && \(\s*<Consent/);
    expect(base).toMatch(/<body data-clarity-mask=\{clarity !== undefined \? "true" : undefined\}>/);
    expect(base).toContain('body={t(lang, clarity !== undefined ? "consent.bodyClarity" : "consent.body")}');
  });
});

describe("the C-4 fallback (2026-10-27): no Clarity on any motorway page", () => {
  // The motorway pages' layout is the one place that renders a motorway route (the road's page and every stretch below it).
  const layout = read("src/layouts/MotorwayPage.astro");
  const base = /<Base lang=\{lang\} page="motorways" measure=\{true\} [^>]*dynamic=\{\{[^>]*>/.exec(layout)?.[0] ?? "";

  it("every motorway route renders through Base as a DYNAMIC 'motorways' page with the G1 flag (the precondition)", () => {
    expect(base, "MotorwayPage.astro hands Base page=motorways, measure and dynamic").not.toBe("");
    expect(layout.match(/<Base\b/g)).toHaveLength(1);
    const route = read("src/pages/[lang]/autobahn/[road]/[...rest].astro");
    expect(route).toContain("<MotorwayPage ");
    expect(route).not.toMatch(/<Base\b/);
  });

  it("measurementOf: GA on every motorway route, Clarity on none; Clarity on the map rows of the island and nowhere else", () => {
    expect([...CLARITY_DYNAMIC_PAGES]).toEqual([]);
    // what MotorwayPage hands Base, for every road and language and every stretch below it (one layout, one call)
    let routes = 0;
    for (const lang of LIVE_LANGS)
      for (const road of MOTORWAY_REGISTER) {
        for (const path of [motorwayPath(lang, road), `${motorwayPath(lang, road)}/x-to-y`]) {
          expect(path.startsWith(`/${lang}/autobahn/`), path).toBe(true);
          const m = measurementOf("motorways", true, true);
          expect(m.ga, path).toBe(true);
          expect(m.clarity, path).toBe(false);
          routes++;
        }
      }
    expect(routes).toBeGreaterThanOrEqual(LIVE_LANGS.length * 100);
    // the motorway INDEX is a row of the map: GA and Clarity
    expect(measurementOf("motorways", false, false)).toEqual({ ga: true, clarity: true });
    for (const p of ANALYTICS_PAGES) expect(measurementOf(p, false, false), p).toEqual({ ga: true, clarity: true });
    // a place or a station page (dynamic, no flag): neither
    expect(measurementOf("start", true, false)).toEqual({ ga: false, clarity: false });
    expect(measurementOf("stations", true, false)).toEqual({ ga: false, clarity: false });
    expect(measurementOf("fuel", false, false)).toEqual({ ga: false, clarity: false });
  });

  it("so a motorway route's CSP names no Clarity origin, its body carries no mask and its island no Clarity id", () => {
    // the middleware's rule over what Base declared for such a page
    const declared = measurementOf("motorways", true, true).clarity;
    const csp = contentSecurityPolicy(NONCE, "G-0", true, true, declared);
    expect(csp).toContain("googletagmanager");
    expect(csp).not.toMatch(/clarity|bing/);
    for (const o of CLARITY_ORIGINS) expect(csp).not.toContain(o);
  });
});

describe("cookies (#717)", () => {
  it("names exactly Clarity's two first-party cookies", () => {
    for (const n of ["_clck", "_clsk"]) expect(CLARITY_COOKIE.test(n), n).toBe(true);
    for (const n of ["_ga", "clck", "_clckx", "CLID", "MUID", "_cl"]) expect(CLARITY_COOKIE.test(n), n).toBe(false);
  });
  it("expires them on the host and every parent domain, leaving others", () => {
    const writes: string[] = [];
    const j = {
      get cookie(): string {
        return "_clck=a; _clsk=b; _ga=c; other=d";
      },
      set cookie(w: string) {
        writes.push(w);
      },
    };
    expect(expireClarityCookies(j, "www.viafrei.de")).toEqual(["_clck", "_clsk"]);
    expect(writes.filter((w) => w.startsWith("_clck=;"))).toHaveLength(3);
    expect(writes.every((w) => /max-age=0/.test(w))).toBe(true);
    expect(writes.some((w) => w.startsWith("_ga=") || w.startsWith("other="))).toBe(false);
  });
});

describe("the words (22 catalogues, the Datenschutz)", () => {
  const langs = readdirSync(join(WEB, "src/i18n")).filter((f) => f.endsWith(".json"));
  it("every catalogue has consent.bodyClarity naming both products by their own names", () => {
    expect(langs).toHaveLength(22);
    for (const f of langs) {
      const c = JSON.parse(read(`src/i18n/${f}`)) as { consent: Record<string, string> };
      expect(c.consent["bodyClarity"], f).toContain("Microsoft Clarity");
      expect(c.consent["bodyClarity"], f).toContain("Google Analytics");
      expect(c.consent["bodyClarity"], f).not.toBe(c.consent["body"]);
      // C-3: the bar says Microsoft uses the data for its own purposes, advertising included — a second "Microsoft"
      expect(c.consent["bodyClarity"]?.match(/Microsoft/g), f).toHaveLength(2);
    }
    const de = JSON.parse(read("src/i18n/de.json")) as { consent: Record<string, string> };
    expect(de.consent["bodyClarity"]).toContain("Microsoft nutzt diese Daten auch für eigene Zwecke, auch für Werbung.");
  });
  it("C-3: the home's privacy in three sentences names Clarity when Clarity is on, in every catalogue", () => {
    for (const f of langs) {
      const c = JSON.parse(read(`src/i18n/${f}`)) as { sources: { privacy: Record<string, string> } };
      const p = c.sources.privacy;
      expect(p["s2Clarity"], f).toContain("Microsoft Clarity");
      expect(p["s2Clarity"], f).not.toBe(p["s2"]);
      expect(p["s2"], f).not.toContain("Clarity");
    }
    const src = code(read("src/components/Sources.astro"));
    expect(src).toContain("const clarityOn = Astro.locals.googleTag !== undefined && Astro.locals.clarityId !== undefined;");
    expect(src).toContain('t(lang, clarityOn ? "sources.privacy.s2Clarity" : "sources.privacy.s2")');
  });
  it("the Datenschutz subsection is rendered only with a tag and a Clarity id, and says the controllership, Microsoft's own purposes, the basis, the retention and the withdrawal (data-steward ruling C-1/C-2/C-11)", () => {
    expect(read("src/layouts/Legal.astro")).toContain("const clarity = analytics && Astro.locals.clarityId !== undefined;");
    const priv = read("src/components/LegalPrivacy.astro");
    const sec = /\{\s*clarity && \(\s*<section id="clarity">([\s\S]*?)<\/section>/.exec(priv)?.[1] ?? "";
    const flat = sec.replace(/\s+/g, " ");
    // what a reader reads: the section without its tags (the emphasis is presentation; the words are the statement)
    const text = flat.replace(/<[^>]+>/g, "");
    expect(flat).toContain("Microsoft Ireland Operations Limited");
    // C-1: Clarity Terms of Use v5 § 4.4 c) i. — independent controllers, never our Art. 28 processor
    expect(text).toContain("nicht unser Auftragsverarbeiter");
    expect(flat).not.toMatch(/Art\. 28/);
    expect(flat).toContain("jeweils eigenständig für die Daten verantwortlich");
    // C-2: § 4.4 b) (Microsoft Advertising, the privacy statement link) and c) iii. (Microsoft's own purposes)
    expect(flat).toContain("um Microsoft Advertising bereitzustellen");
    expect(flat).toContain("Nutzerprofilen, auch für Werbung");
    expect(flat).toContain("https://privacy.microsoft.com/de-de/privacystatement");
    expect(flat).toContain("Art. 6 Abs. 1 lit. a DSGVO");
    expect(flat).toContain("§ 25 Abs. 1 TDDDG");
    expect(flat).toContain("Data Privacy Framework");
    // C-11: the Clarity FAQ (read 2026-10-27): recordings 30 days; favourites, a random sample and heatmaps up to 9 months — never "13 Monate"
    expect(flat).toContain("Sitzungsaufzeichnungen 30 Tage nach der Aufnahme");
    expect(flat).toContain("bis zu neun Monate");
    expect(flat).not.toContain("13 Monate");
    expect(text).toContain("_clck");
    expect(text).toContain("Widerruf:");
    // the C-4 fallback (2026-10-27): the pages Clarity runs on, and that the motorway pages are not among them
    expect(text).toContain("Auf der Startseite, den Seiten „Verbinden“, „Entwickler“ und „Unternehmen“ und der Übersicht der Autobahnen setzen wir mit derselben Einwilligung Microsoft Clarity ein");
    expect(text).toContain("auf den Seiten der einzelnen Autobahnen läuft Clarity nicht");
    expect(text).not.toContain("Auf denselben Seiten, auf denen wir Google Analytics verwenden");
    expect(text).not.toContain("auf einer Autobahnseite");
    expect(text).not.toContain("ein Abschnitt einer Autobahn");
    expect(flat).toContain("maskiert");
  });
});

describe("prod wiring (both compose files, the template)", () => {
  const prod = readRoot("the production compose file");
  const dev = readRoot("docker-compose.yml");
  const service = (yml: string, name: string): string => {
    const start = yml.indexOf(`\n  ${name}:\n`);
    const rest = yml.slice(start + 1);
    const end = rest.slice(1).search(/\n {2}[a-z][a-z0-9-]*:\n/);
    return end < 0 ? rest : rest.slice(0, end + 1);
  };
  it("the web service of both files is handed the id and the switch, empty by default", () => {
    for (const yml of [prod, dev]) {
      const web = service(yml, "web");
      expect(web).toContain("CLARITY_PROJECT_ID: ${CLARITY_PROJECT_ID:-}");
      expect(web).toContain("CLARITY_ENABLED: ${CLARITY_ENABLED:-}");
    }
  });
  it("no other service is handed them, and the ops token reaches no service at all", () => {
    for (const yml of [prod, dev]) {
      expect(yml.match(/CLARITY_PROJECT_ID: /g)).toHaveLength(1);
      expect(yml).not.toContain("CLARITY_API_TOKEN");
    }
  });
  it("the template lists all three, the token empty", () => {
    const tpl = readRoot("the production env template");
    expect(tpl).toMatch(/^CLARITY_PROJECT_ID=$/m);
    expect(tpl).toMatch(/^CLARITY_ENABLED=true$/m);
    expect(tpl).toMatch(/^CLARITY_API_TOKEN=$/m);
    expect(tpl).toContain("Clarity Data Export API, ops only, 10 calls/day");
  });
});
