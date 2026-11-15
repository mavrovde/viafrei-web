/**
 * "Redirect once" (owner 2026-10-27, 2.4.4): a visitor ENTERING on a German page is sent once to the same page in
 * their language; a click in the language menu keeps the choice in `vf_lang`. Every condition of
 * `src/i18n/lang-redirect.ts` is judged here in both directions, then the Response the middleware returns.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  LANG_COOKIE_MAX_AGE_S,
  decideLanguage,
  hasLangChoice,
  langOfPath,
  languageResponse,
  mayRedirect,
  twinPath,
  withPickMarker,
  type LangDecision,
} from "../src/i18n/lang-redirect.js";
import { LIVE_LANGS, PAGES, pathFor } from "../src/site/pages.js";
import { CSP_NO_SCRIPT, SECURITY_HEADERS, securedRedirect } from "../src/security/csp.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string): string => readFileSync(join(ROOT, p), "utf8");

const CHROME = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
/** A first page view from a search engine, as a current browser sends it. */
const ENTRY: Readonly<Record<string, string>> = { "user-agent": CHROME, "accept-language": "bg-BG,bg;q=0.9", "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate", host: "viafrei.de", referer: "https://www.google.com/" };

function decide(path: string, over: Readonly<Record<string, string | null>> = {}, method = "GET"): LangDecision {
  const h = new Headers();
  for (const [k, v] of Object.entries({ ...ENTRY, ...over })) if (v !== null) h.set(k, v);
  return decideLanguage(method, new URL(`http://viafrei.de${path}`), h);
}
const to = (d: LangDecision): string | null => (d.kind === "redirect" ? d.location : null);

describe("the decision table (2.4.4)", () => {
  it("a Bulgarian browser entering on a German page goes to the same page in Bulgarian", () => {
    expect(to(decide("/de/connect"))).toBe("/bg/connect");
    expect(to(decide("/de"))).toBe("/bg");
    expect(decide("/de/connect")).toMatchObject({ kind: "redirect", lang: "bg" });
  });

  it("German, no header, `*` and an unsupported language stay German", () => {
    expect(to(decide("/de/connect", { "accept-language": "de-DE,de;q=0.9" }))).toBeNull();
    expect(decide("/de/connect", { "accept-language": null })).toMatchObject({ kind: "none", why: "no Accept-Language" });
    expect(decide("/de/connect", { "accept-language": "" })).toMatchObject({ kind: "none", why: "no Accept-Language" });
    expect(to(decide("/de/connect", { "accept-language": "*" }))).toBeNull();
    expect(to(decide("/de/connect", { "accept-language": "ja-JP" }))).toBeNull();
    expect(to(decide("/de/connect", { "accept-language": "ar,zh;q=0.5" }))).toBeNull();
  });

  it("a region tag matches its base when that base is live: fr-CA → fr (French is live since #753)", () => {
    expect((LIVE_LANGS as readonly string[]).includes("fr")).toBe(true);
    expect(to(decide("/de/business", { "accept-language": "fr-CA" }))).toBe("/fr/business");
  });

  it("the visitor's own order and q-values: en-US,de;q=0.9 → en; de first → none", () => {
    expect(to(decide("/de/developers", { "accept-language": "en-US,de;q=0.9" }))).toBe("/en/developers");
    expect(to(decide("/de/developers", { "accept-language": "de;q=1,en-US;q=0.9" }))).toBeNull();
    expect(to(decide("/de/developers", { "accept-language": "en;q=0.1,de;q=0.9" }))).toBeNull();
  });

  it("same-origin navigation is never redirected: Sec-Fetch-Site same-origin, or a Referer on our host", () => {
    expect(decide("/de/connect", { "sec-fetch-site": "same-origin", referer: null })).toMatchObject({ kind: "none", why: "same-origin navigation" });
    expect(decide("/de/connect", { "sec-fetch-site": null, referer: "https://viafrei.de/bg" })).toMatchObject({ kind: "none", why: "same-origin navigation" });
    expect(decide("/de/connect", { "sec-fetch-site": null, referer: "not a url" })).toMatchObject({ kind: "none" });
  });

  it("…while a first entry is: a foreign Referer, no Referer, a typed address (none), another site of ours (same-site)", () => {
    expect(to(decide("/de/connect", { referer: "https://duckduckgo.com/" }))).toBe("/bg/connect");
    expect(to(decide("/de/connect", { referer: null }))).toBe("/bg/connect");
    expect(to(decide("/de/connect", { referer: null, "sec-fetch-site": "none" }))).toBe("/bg/connect");
    expect(to(decide("/de/connect", { referer: null, "sec-fetch-site": null }))).toBe("/bg/connect");
    expect(to(decide("/de/connect", { referer: "https://status.viafrei.de/", "sec-fetch-site": "same-site" }))).toBe("/bg/connect");
  });

  it("a fetch or a prefetch is not a page entry", () => {
    expect(decide("/de/connect", { "sec-fetch-mode": "cors" })).toMatchObject({ kind: "none", why: "not a navigation" });
    expect(decide("/de/connect", { "sec-fetch-mode": "no-cors" })).toMatchObject({ kind: "none" });
  });

  it("owner rule 2026-10-27: a visitor who chose a language before is never switched again — bg or de, whatever the browser says", () => {
    expect(decide("/de/connect", { cookie: "vf_lang=bg" })).toMatchObject({ kind: "none", why: "chose a language before" });
    expect(decide("/de/connect", { cookie: "vf_lang=de" })).toMatchObject({ kind: "none", why: "chose a language before" });
    expect(decide("/de/connect", { cookie: "_ga=GA1.1.1; vf_lang=de", "accept-language": "en-US" })).toMatchObject({ kind: "none", why: "chose a language before" });
    expect(decide("/de/place/koeln", { cookie: "vf_lang=bg", "accept-language": "en-US" })).toMatchObject({ kind: "none" });
    expect(hasLangChoice("vf_lang=xx")).toBe(true);
  });

  it("…an empty or differently named cookie is no choice, and the header decides", () => {
    expect(to(decide("/de/connect", { cookie: "vf_lang=", "accept-language": "en" }))).toBe("/en/connect");
    expect(to(decide("/de/connect", { cookie: "vf_langx=bg", "accept-language": "en" }))).toBe("/en/connect");
    expect(to(decide("/de/connect", { cookie: "_ga=GA1.1.1", "accept-language": "en" }))).toBe("/en/connect");
  });

  it("robots are never redirected — the person gate's list, headless browsers and Lighthouse included", () => {
    for (const ua of ["Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0)", "GPTBot/1.1", "meta-externalagent/1.1", "Mozilla/5.0 HeadlessChrome/141.0.0.0", "Chrome-Lighthouse"]) {
      expect(decide("/de/connect", { "user-agent": ua }), ua).toMatchObject({ kind: "none", why: "a robot" });
    }
  });

  it("the query string is kept", () => {
    expect(to(decide("/de/place/koeln?topics=roads,fuel"))).toBe("/bg/place/koeln?topics=roads,fuel");
    expect(to(decide("/de?r=auto"))).toBe("/bg?r=auto");
  });

  it("HEAD, POST and every other method pass untouched", () => {
    for (const m of ["HEAD", "POST", "PUT", "OPTIONS"]) expect(decide("/de/connect", {}, m), m).toMatchObject({ kind: "none", why: "not a GET" });
  });

  it("places, stations and motorway addresses go to their twin; the route words are the same in every language", () => {
    expect(to(decide("/de/place/muenchen"))).toBe("/bg/place/muenchen");
    expect(to(decide("/de/station/koeln-hbf"))).toBe("/bg/station/koeln-hbf");
    expect(to(decide("/de/station"))).toBe("/bg/station");
    expect(to(decide("/de/autobahn"))).toBe("/bg/autobahn");
    expect(to(decide("/de/autobahn/a7"))).toBe("/bg/autobahn/a7");
    expect(to(decide("/de/autobahn/a7/nesselwang-to-kempten/towards-wuerzburg"))).toBe("/bg/autobahn/a7/nesselwang-to-kempten/towards-wuerzburg");
    expect(to(decide("/de/autobahn/a7/exit-138-nesselwang"))).toBe("/bg/autobahn/a7/exit-138-nesselwang");
    expect(to(decide("/de/news"))).toBe("/bg/news");
    expect(to(decide("/de/fuel"))).toBe("/bg/fuel");
  });

  it("a page with no twin in the target language is never a redirect", () => {
    for (const p of [
      "/", "/impressum", "/datenschutz", "/terms", "/de/impressum", "/de/404", "/de/", "/de/news.xml", "/de/nope",
      "/de/neuigkeiten", "/de/place/K%C3%B6ln", "/de/place/05315000", "/de/station/index", "/de/autobahn/A7", "/de/autobahn/a%203",
      "/de/autobahn/a7/", "/de/autobahn/x7", "/de/place/koeln/extra",
      "/en/connect", "/bg", "/sitemap.xml", "/sitemap-places-de.xml", "/robots.txt", "/llms.txt", "/llms-full.txt", "/_a/site.css",
      "/fragment/tile", "/api/x", "/healthz", "/deutsch",
    ]) {
      expect(mayRedirect(p), p).toBe(false);
      expect(to(decide(p)), p).toBeNull();
    }
  });

  it("every German page of the map but the legal ones and the 404 has a twin in every live language, and it is pathFor's", () => {
    for (const page of PAGES) {
      for (const l of LIVE_LANGS) {
        const want = page.legal || page.id === "404" ? null : pathFor(page.id, l);
        expect(twinPath(pathFor(page.id, "de"), l), `${page.id} ${l}`).toBe(want);
      }
    }
  });
});

describe("the language menu's choice (vf_lang)", () => {
  it("the marker is stripped by a 302 to the clean address, and a same-origin click stores the page's language", () => {
    expect(decide("/de/connect?setlang=1", { "sec-fetch-site": "same-origin" })).toEqual({ kind: "pick", location: "/de/connect", cookie: "de" });
    expect(decide("/bg/connect?setlang=1", { "sec-fetch-site": "same-origin" })).toEqual({ kind: "pick", location: "/bg/connect", cookie: "bg" });
    expect(decide("/datenschutz?setlang=1", { "sec-fetch-site": "same-origin" })).toEqual({ kind: "pick", location: "/datenschutz", cookie: "de" });
    expect(decide("/de/autobahn/a7?towards=x&setlang=1", { "sec-fetch-site": "same-origin" })).toEqual({ kind: "pick", location: "/de/autobahn/a7?towards=x", cookie: "de" });
  });

  it("an old browser (no Sec-Fetch-Site) clicking on our page is a click of ours, with our page as Referer (same-origin, #1110) or none", () => {
    expect(SECURITY_HEADERS["Referrer-Policy"]).toBe("same-origin");
    expect(decide("/de/connect?setlang=1", { "sec-fetch-site": null, referer: null })).toMatchObject({ kind: "pick", cookie: "de" });
    expect(decide("/de/connect?setlang=1", { "sec-fetch-site": null, referer: "https://viafrei.de/bg/connect" })).toMatchObject({ kind: "pick", cookie: "de" });
  });

  it("a marker from another site, or typed, is dropped but stores nothing", () => {
    expect(decide("/de/connect?setlang=1", { "sec-fetch-site": "cross-site" })).toEqual({ kind: "pick", location: "/de/connect", cookie: null });
    expect(decide("/de/connect?setlang=1", { "sec-fetch-site": "none" })).toMatchObject({ cookie: null });
    expect(decide("/de/connect?setlang=1", { "sec-fetch-site": null, referer: "https://evil.example/" })).toMatchObject({ cookie: null });
  });

  it("a marker on an address in no language, or on a POST, does nothing", () => {
    expect(decide("/?setlang=1", { "sec-fetch-site": "same-origin" })).toMatchObject({ kind: "none" });
    expect(decide("/de/connect?setlang=1", { "sec-fetch-site": "same-origin" }, "POST")).toMatchObject({ kind: "none" });
  });

  it("withPickMarker adds the marker before a fragment and after an existing query", () => {
    expect(withPickMarker("/de/connect")).toBe("/de/connect?setlang=1");
    expect(withPickMarker("/de/connect#beta")).toBe("/de/connect?setlang=1#beta");
    expect(withPickMarker("/de/autobahn/a7?towards=x")).toBe("/de/autobahn/a7?towards=x&setlang=1");
  });

  it("hasLangChoice and langOfPath", () => {
    expect(hasLangChoice(null)).toBe(false);
    expect(hasLangChoice("a=1; vf_lang=uk; b=2")).toBe(true);
    expect(hasLangChoice("a=1")).toBe(false);
    expect(langOfPath("/ru/place/koeln")).toBe("ru");
    expect(langOfPath("/impressum")).toBe("de");
    expect(langOfPath("/")).toBeNull();
  });
});

describe("the responses", () => {
  it("a redirect is a 302 to the twin, private and no-store, varying with the language headers, and sets no cookie", () => {
    const r = languageResponse(decide("/de/connect?x=1"));
    expect(r?.status).toBe(302);
    expect(r?.headers.get("location")).toBe("/bg/connect?x=1");
    expect(r?.headers.get("cache-control")).toBe("private, no-store");
    expect(r?.headers.get("vary")).toBe("Accept-Language, Cookie");
    expect(r?.headers.get("set-cookie")).toBeNull();
  });

  it("a menu click is a 302 to the clean address carrying the first-party cookie: Path=/, a year, Lax, Secure, HttpOnly", () => {
    const r = languageResponse(decide("/de/connect?setlang=1", { "sec-fetch-site": "same-origin" }));
    expect(r?.status).toBe(302);
    expect(r?.headers.get("location")).toBe("/de/connect");
    expect(r?.headers.get("cache-control")).toBe("private, no-store");
    expect(r?.headers.get("set-cookie")).toBe(`vf_lang=de; Path=/; Max-Age=${String(LANG_COOKIE_MAX_AGE_S)}; SameSite=Lax; Secure; HttpOnly`);
    expect(LANG_COOKIE_MAX_AGE_S).toBe(31_536_000);
  });

  it("nothing to do is no response at all", () => {
    expect(languageResponse(decide("/de/connect", { "accept-language": "de" }))).toBeNull();
  });
});

describe("a redirect carries the page's security headers (2.4.4 review N1)", () => {
  it("the language 302 with its cookie and the legacy 301 keep their own headers and gain the CSP and SECURITY_HEADERS", () => {
    const pick = securedRedirect(languageResponse(decide("/de/connect?setlang=1", { "sec-fetch-site": "same-origin" }))!);
    const legacy = securedRedirect(new Response(null, { status: 301, headers: { location: "/de/place/koeln", "cache-control": "public, max-age=86400" } }));
    for (const r of [pick, legacy]) {
      expect(r.headers.get("content-security-policy")).toBe(CSP_NO_SCRIPT);
      for (const [k, v] of Object.entries(SECURITY_HEADERS)) expect(r.headers.get(k), k).toBe(v);
      expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    }
    expect(pick.status).toBe(302);
    expect(pick.headers.get("location")).toBe("/de/connect");
    expect(pick.headers.get("cache-control")).toBe("private, no-store");
    expect(pick.headers.get("vary")).toBe("Accept-Language, Cookie");
    expect(pick.headers.get("set-cookie")).toMatch(/^vf_lang=de; /);
    expect(legacy.status).toBe(301);
    expect(legacy.headers.get("location")).toBe("/de/place/koeln");
    expect(legacy.headers.get("cache-control")).toBe("public, max-age=86400");
  });

  it("the middleware returns both redirects through securedRedirect, never bare", () => {
    const mw = read("src/middleware.ts");
    expect(mw).toContain("if (legacy !== null) return securedRedirect(legacy);");
    expect(mw).toContain("if (switched !== null) return securedRedirect(switched);");
    expect(mw).not.toMatch(/return (?:legacy|switched);/);
  });
});

describe("wired once, in the middleware, before the page renders; the menu carries the marker", () => {
  it("the middleware returns the decision's response before next(), and marks a German page that may redirect", () => {
    const mw = read("src/middleware.ts");
    const at = mw.indexOf("languageResponse(decideLanguage(context.request.method, context.url, context.request.headers))");
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeLessThan(mw.indexOf("response = await next()"));
    expect(mw).toContain("mayRedirect(context.url.pathname)");
    expect(mw).toContain('headers.set("Cache-Control", "private, no-cache")');
  });

  it("every link of the language list goes through withPickMarker", () => {
    const list = read("src/components/LanguageList.astro");
    expect(list).toContain("href: withPickMarker(hrefs?.[l] ?? pathFor(page, l))");
  });
});

describe("the Datenschutz page names the cookie (German, so on every language's page)", () => {
  it("a 'Sprachauswahl' section names vf_lang, the click, the year, § 25 Abs. 2 Nr. 2 TDDDG; the no-tag § 5 no longer says 'keine Cookies'", () => {
    const src = read("src/components/LegalPrivacy.astro").replace(/\s+/g, " ");
    // structure, not literal markup (#922 B2): the section's anchor, its heading word and the cookie's name
    expect(src).toMatch(/id="sprache"[^>]*>\s*Sprachauswahl/);
    expect(src).toMatch(/>\s*vf_lang\s*</);
    expect(src).toContain("Es wird nur durch diesen Klick gesetzt");
    expect(src).toContain("läuft nach einem Jahr ab");
    expect(src).toContain("§ 25 Abs. 2 Nr. 2 TDDDG) und erfordert daher keine Einwilligung");
    expect(src).toContain("Solange es besteht, leiten wir Sie nie mehr automatisch weiter");
    expect(src).not.toContain("Diese Seite setzt keine Cookies");
    // 2.4.4 review N5: before consent no cookie of GOOGLE's (or Microsoft's) is set — vf_lang may exist, so never "kein Cookie" bare
    expect(src).toContain("es entsteht keine Verbindung zu Google und es wird kein Cookie von Google gesetzt (Google Consent Mode v2 im Basic-Modus)");
    expect(src).toContain("bis dahin entsteht keine Verbindung zu Microsoft und es wird kein Cookie von Microsoft gesetzt.");
    expect(src).not.toMatch(/es wird kein Cookie gesetzt/);
  });
});

describe("the menu's marker links are not crawled", () => {
  it("every language link of the menu is rel=nofollow (the head's hreflang names the languages; a crawler following ?setlang=1 would spend a redirect per link)", () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "src", "components", "LanguageList.astro"), "utf8");
    const links = src.match(/<a href=\{x\.href\}[^>]*>/g) ?? [];
    expect(links.length).toBeGreaterThanOrEqual(2);
    for (const a of links) expect(a).toContain('rel="nofollow"');
  });
});
