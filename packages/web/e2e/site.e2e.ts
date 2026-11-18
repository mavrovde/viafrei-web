/**
 * The page map, rendered (#379 routes/links, #380 hreflang) — every check
 * reads `pages.ts` and `locales.ts`, never a second list:
 *   - every page answers in both languages with the right status and `<html lang>`;
 *   - its alternates are exactly the reviewed locales plus x-default, pointing
 *     at the paths `pages.ts` names, and every alternate answers;
 *   - every internal link and `#fragment` on every page resolves;
 *   - Impressum and Datenschutz are one click from every page;
 *   - every page carries the beta notice in its own language (#471), and
 *     /connect the fuller paragraph and the two real answers (#472);
 *   - an unreviewed locale never appears (fixture: the registry is checked
 *     by `test/negotiation.test.ts`; here, no `hreflang` outside it).
 */
import type { ChildProcess } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { all, text as nodeText } from "@viafrei/design/testing";
import { MTSK_CONSUMER_NOTE, conditionAsRegistered, creditParts, datedAttribution, licenceTextFor } from "@viafrei/ingest";
import { ATTRIBUTION } from "@viafrei/mcp";
import { t } from "../src/i18n/index.js";
import { htmlLangOf, reviewedLocales } from "../src/i18n/locales.js";
import { CONNECT_PROMPTS } from "../src/site/connect-prompts.js";
import { CONNECT_EXAMPLES, LIVE_EXAMPLES, connectExamples, namesOf } from "../src/site/live-examples.js";
import { FUEL_ASKS } from "../src/site/examples.js";
import { RETIRED_FUEL } from "../src/site/example-ledger.js";
import { anchorFor } from "../src/site/example-archive.js";
import { EXAMPLE_LEDGER } from "../src/site/example-ledger.js";
import { SITE_ORIGIN } from "../src/site/endpoints.js";
import { OG_IMAGE, pageMeta } from "../src/site/meta.js";
import { DEFAULT_LANG, LIVE_LANGS, PAGES, pathFor } from "../src/site/pages.js";
import { DISCOVERY_ROUTES } from "../scripts/site-map.js";
import { MCP_REGISTRY_AUTH, llmsFullTxt, llmsTxt, robotsTxt, securityTxt, serverCard } from "../src/site/discovery.js";
import { FAQ_PAGES, NO_JSON_LD, deployedVersion, structuredData } from "../src/site/structured-data.js";
import { startShell } from "./server.js";
import { startStubDigest } from "./stub-digest.js";

/**
 * One credit line as the connect page prints it: the register's line, verbatim,
 * linked to its offer — and, where the row's licence owes it (CC BY 4.0
 * § 3(a)(1)(C) and its siblings, owner 2026-10-05), the link to the licence
 * TEXT from the one map in `@viafrei/ingest`, its words in the page language.
 */
const creditLi = (l: (typeof LIVE_LANGS)[number], r: { readonly text: string; readonly url: string; readonly license: string; readonly conditionNote?: { readonly de: string } }, id: string): string => {
  // GN250's prescribed links (data-steward ruling 2026-10-07): exactly "BKG" and "dl-de/by-2-0", no other link
  const parts = creditParts(id, r.text);
  if (parts !== null) return `<li lang="de">${parts.map((p) => (p.href === null ? p.text : `<a href="${p.href}" rel="license noopener noreferrer">${p.text}</a>`)).join("")}</li>`;
  const lt = licenceTextFor(r.license);
  const link = lt === null ? "" : ` · <a class="credit__licence" href="${lt.url}" rel="license noopener noreferrer" lang="${l}">${t(l, "sources.licenceText")}</a>`;
  // A publisher's condition of use (#454, the RVWD line) stands under its credit, German like the line.
  // A dated condition (the VMZ Bremen lines, #641) names the date as the one every answer carries, never {date}.
  const condition = r.conditionNote === undefined ? "" : `<br><span class="credit__condition">${conditionAsRegistered(r.conditionNote.de, "de")}</span>`;
  // A register line naming the year of retrieval ({Jahr}, #804; the GeoNutzV lines since 2.2.10) is printed with the
  // render's Berlin year, so it is compared as printed, never as stored.
  return `<li lang="de"><a href="${r.url}" rel="noopener noreferrer">${datedAttribution(r.text, new Date())}</a>${link}${condition}</li>`;
};

const PORT = 8800;
let shell: ChildProcess;
let stub: Awaited<ReturnType<typeof startStubDigest>>;
const html = new Map<string, string>();
const fetches = new Map<string, number>();

async function get(path: string): Promise<{ status: number; body: string }> {
  fetches.set(path, (fetches.get(path) ?? 0) + 1);
  const r = await fetch(`http://127.0.0.1:${PORT}${path}`, { redirect: "manual" });
  return { status: r.status, body: await r.text() };
}

beforeAll(async () => {
  stub = await startStubDigest({});
  shell = await startShell(PORT, {
    DIGEST_URL: stub.url,
    IMPRESSUM_NAME: "Site Probe",
    IMPRESSUM_STREET: "Probeweg 3",
    IMPRESSUM_CITY: "00000 Probe",
    IMPRESSUM_EMAIL: "site@example.invalid",
  });
  for (const p of PAGES) for (const l of LIVE_LANGS) html.set(pathFor(p.id, l), (await get(pathFor(p.id, l))).body);
});

afterAll(async () => {
  shell?.kill();
  await stub?.close();
});

describe("routes (#379)", () => {
  it("measured every page of the map in every live language — not nothing", () => {
    expect(html.size).toBe(PAGES.length * LIVE_LANGS.length);
    expect(html.size).toBeGreaterThanOrEqual(14);
  });
  for (const p of PAGES) {
    for (const l of LIVE_LANGS) {
      const path = pathFor(p.id, l);
      // the html lang is the variant the owner chose where one had to be: pt-PT, sr-Cyrl (#764, #766)
      const html = htmlLangOf(l);
      it(`${path} answers ${p.id === "404" ? 404 : 200} with <html lang="${html}">`, async () => {
        const r = await get(path);
        expect(r.status).toBe(p.id === "404" ? 404 : 200);
        expect(all(r.body, `html[lang="${html}"]`).length).toBeGreaterThan(0);
      });
    }
  }
});

describe("JSON-LD in the head of every page, rendered (#531)", () => {
  for (const p of PAGES) {
    for (const l of LIVE_LANGS) {
      const path = pathFor(p.id, l);
      it(`${path}: ${NO_JSON_LD.includes(p.id) ? "no JSON-LD (the fuel board's page)" : `one data block in <head>, nonce'd, parsing to this page's graph in ${l}`}`, () => {
        const body = html.get(path)!;
        const blocks = [...body.matchAll(/<script type="application\/ld\+json" nonce="([^"]+)">([\s\S]*?)<\/script>/g)];
        if (NO_JSON_LD.includes(p.id)) {
          expect(body, path).not.toContain("application/ld+json");
          return;
        }
        expect(blocks, path).toHaveLength(1);
        expect(body.indexOf(blocks[0]![0])).toBeLessThan(body.indexOf("</head>"));
        expect(blocks[0]![1]!.length).toBeGreaterThanOrEqual(16);
        expect(JSON.parse(blocks[0]![2]!)).toEqual(JSON.parse(JSON.stringify(structuredData(p.id, l, deployedVersion()))));
      });
    }
  }
  it("no page carries FAQPage (data-steward fallback, #531)", () => {
    expect(FAQ_PAGES).toEqual([]);
    for (const [path, body] of html) expect(body, path).not.toContain('"FAQPage"');
  });
});

describe("the discovery routes (#531)", () => {
  it("each answers 200 with the text its function builds and the right type", async () => {
    const want: Record<string, { type: string; body: string }> = {
      "/llms.txt": { type: "text/plain; charset=utf-8", body: llmsTxt() },
      "/llms-full.txt": { type: "text/plain; charset=utf-8", body: llmsFullTxt() },
      "/.well-known/mcp/server-card.json": { type: "application/json; charset=utf-8", body: `${JSON.stringify(serverCard(), null, 2)}\n` },
      "/.well-known/mcp-registry-auth": { type: "text/plain; charset=utf-8", body: MCP_REGISTRY_AUTH },
      "/.well-known/mcp.json": { type: "application/json; charset=utf-8", body: `${JSON.stringify(serverCard(), null, 2)}\n` },
      "/.well-known/security.txt": { type: "text/plain; charset=utf-8", body: securityTxt() },
      "/robots.txt": { type: "text/plain; charset=utf-8", body: robotsTxt() },
    };
    expect(Object.keys(want).filter((k) => k !== "/robots.txt")).toEqual([...DISCOVERY_ROUTES]);
    for (const [path, w] of Object.entries(want)) {
      const r = await fetch(`http://127.0.0.1:${PORT}${path}`, { redirect: "manual" });
      expect(r.status, path).toBe(200);
      expect(r.headers.get("content-type"), path).toBe(w.type);
      expect(await r.text(), path).toBe(w.body);
    }
  });
  it("the sitemap's every url carries a lastmod", async () => {
    const xml = (await get("/sitemap.xml")).body;
    const n = xml.match(/<url>/g)?.length ?? 0;
    expect(n).toBeGreaterThan(40);
    expect(xml.match(/<\/loc><lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g)?.length).toBe(n);
  });
});

describe("per-page title and social card (F-20, F-22)", () => {
  const esc = (x: string): string => x.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const attr = (body: string, key: string, name: string): string | undefined => new RegExp(`<meta ${key}="${name}" content="([^"]*)"`).exec(body)?.[1];
  for (const p of PAGES) {
    for (const l of LIVE_LANGS) {
      const path = pathFor(p.id, l);
      it(`${path}: its own <title>, description and card`, () => {
        const body = html.get(path)!;
        const m = pageMeta(p.id, l);
        const title = /<title>([^<]*)<\/title>/.exec(body)?.[1];
        // Astro escapes text and attributes alike; compare the unescaped form.
        const plain = (x: string | undefined): string => (x ?? "").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
        expect(plain(title)).toBe(m.title);
        expect(plain(attr(body, "name", "description"))).toBe(m.description);
        // #935: the home's card is the tagline and the whole pitch; every other page's is its title and description
        expect(plain(attr(body, "property", "og:title"))).toBe(m.og?.title ?? m.title);
        expect(plain(attr(body, "property", "og:description"))).toBe(m.og?.description ?? m.description);
        expect(attr(body, "property", "og:site_name")).toBe("ViaFrei");
        expect(attr(body, "property", "og:image")).toBe(OG_IMAGE.url);
        // the English brand line is on the English pages only (one language per page)
        if (l !== "en") expect(plain(body), "the English tagline").not.toContain(t("en", "meta.tagline"));
        if (p.id === "start") expect(plain(/<h1[^>]*>([^<]*)<\/h1>/.exec(body)?.[1])).toBe(t(l, "meta.tagline"));
        expect(attr(body, "name", "twitter:card")).toBe("summary_large_image");
        expect(attr(body, "property", "og:url")).toBe(p.id === "404" ? undefined : esc(`${SITE_ORIGIN}${path}`));
      });
    }
  }
  it("the home and the business page have different titles in every language (they used to share one)", () => {
    for (const l of LIVE_LANGS) expect(/<title>([^<]*)</.exec(html.get(pathFor("business", l))!)?.[1]).not.toBe(/<title>([^<]*)</.exec(html.get(pathFor("start", l))!)?.[1]);
  });
  it("/favicon.ico and /og.png are served as images", async () => {
    for (const [path, type] of [["/favicon.ico", "image/"], ["/og.png", "image/png"]] as const) {
      const r = await fetch(`http://127.0.0.1:${PORT}${path}`);
      expect(r.status, path).toBe(200);
      expect(r.headers.get("content-type") ?? "", path).toContain(type);
      expect((await r.arrayBuffer()).byteLength, path).toBeGreaterThan(100);
    }
  });
});

describe("hreflang (#380)", () => {
  const codes = reviewedLocales().map((x) => x.code);
  for (const p of PAGES.filter((x) => x.id !== "404")) {
    for (const l of LIVE_LANGS) {
      const path = pathFor(p.id, l);
      it(`${path}: alternates are exactly the reviewed locales + x-default, and each answers 200`, async () => {
        const body = html.get(path)!;
        const alts = [...body.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1]!, m[2]!] as const);
        const expected = [...codes.map((c) => [c, `${SITE_ORIGIN}${pathFor(p.id, c as "de" | "en")}`] as const), ["x-default", `${SITE_ORIGIN}${pathFor(p.id, DEFAULT_LANG)}`] as const];
        expect(alts).toEqual(expected);
        expect(all(body, `link[rel="canonical"][href="${SITE_ORIGIN}${path}"]`).length).toBeGreaterThan(0);
        for (const [, href] of alts) expect((await get(href.slice(SITE_ORIGIN.length))).status, href).toBe(200);
      });
    }
  }
});

describe("the SEO sweep, rendered (#1020)", () => {
  const plain = (x: string | undefined): string => (x ?? "").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  const meta = (body: string, key: string, name: string): string => plain(new RegExp(`<meta ${key}="${name}" content="([^"]*)"`).exec(body)?.[1]);
  const altsOf = (body: string): string[] => [...body.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => `${m[1]!} ${m[2]!}`);
  const listed = PAGES.filter((x) => x.id !== "404");
  it("read every listed page in every live language — not nothing", () => {
    expect(listed.length * LIVE_LANGS.length).toBeGreaterThanOrEqual(10 * 22);
  });
  for (const l of LIVE_LANGS) {
    it(`${l}: every page's head — a unique title ≤ 60 (the home: the brand line), a unique description of 70–160, the card, a canonical — and hreflang reciprocal`, () => {
      const titles = new Set<string>();
      const descriptions = new Set<string>();
      for (const p of listed) {
        const path = pathFor(p.id, l);
        const body = html.get(path)!;
        const title = plain(/<title>([^<]*)<\/title>/.exec(body)?.[1]);
        const description = meta(body, "name", "description");
        expect(title.trim(), path).not.toBe("");
        if (p.id !== "start") expect(title.length, `${path}: ${title}`).toBeLessThanOrEqual(60);
        expect(description.length, `${path}: ${description}`).toBeGreaterThanOrEqual(70);
        expect(description.length, `${path}: ${description}`).toBeLessThanOrEqual(160);
        expect(titles.has(title), `${path}: title used twice`).toBe(false);
        expect(descriptions.has(description), `${path}: description used twice`).toBe(false);
        titles.add(title);
        descriptions.add(description);
        for (const [k, n] of [["property", "og:title"], ["property", "og:description"], ["property", "og:url"], ["property", "og:image"], ["name", "twitter:card"], ["name", "twitter:title"], ["name", "twitter:description"], ["name", "twitter:image"]] as const) {
          expect(meta(body, k, n), `${path}: ${n}`).not.toBe("");
        }
        // #1020 round 2: the motorway pages are /autobahn in every language; no link, canonical or alternate names the 301 word
        expect(body, `${path}: a /motorway address`).not.toMatch(/href="(?:https:\/\/viafrei\.de)?\/[a-z]{2}\/motorway(?:\/|")/);
        expect(all(body, 'link[rel="canonical"]').length, path).toBe(1);
        expect(all(body, `link[rel="canonical"][href="${SITE_ORIGIN}${path}"]`).length, path).toBe(1);
        // reciprocal: every alternate of this page lists the same set — and so names this page back
        const mine = altsOf(body);
        expect(mine).toContain(`${l} ${SITE_ORIGIN}${path}`);
        for (const a of mine) {
          const href = a.split(" ")[1]!.slice(SITE_ORIGIN.length);
          expect(altsOf(html.get(href) ?? ""), `${href} names ${path} back`).toEqual(mine);
        }
      }
    });
  }
});

describe("links (#379, the #138 rule on the built site)", () => {
  it("every internal link and fragment on every page resolves", async () => {
    let checked = 0;
    let markers = 0;
    // 2.6.19: an address that is not one of the pages read above is fetched ONCE and its answer kept for every link to it.
    // Each link fetched it twice (its body, then its status): 6 116 requests, the same addresses again and again (the
    // manifest 616 times, each place page 34), 98 % of the test's 81 s, past its 60 s limit on a loaded laptop.
    const others = new Map<string, Promise<{ status: number; body: string }>>();
    const other = (path: string): Promise<{ status: number; body: string }> => {
      const known = others.get(path);
      if (known !== undefined) return known;
      const got = get(path);
      others.set(path, got);
      return got;
    };
    for (const [page, body] of html) {
      for (const m of body.matchAll(/href="(\/[^"]*|#[^"]*)"/g)) {
        const href = m[1]!;
        if (href.startsWith("/_a/") || href === "/favicon.svg") continue;
        const [marked, frag] = href.startsWith("#") ? [page, href.slice(1)] : (href.split("#") as [string, string | undefined]);
        // 2.4.4: a language-menu link carries the choice marker, which the shell answers with a 302 to the address
        // without it (`i18n/lang-redirect.ts`); the link resolves when that address does
        const path = marked.replace(/[?&]setlang=1$/, "");
        if (path !== marked) markers++;
        const read = path === page || html.has(path) ? null : await other(path);
        const target = path === page ? body : (html.get(path) ?? read!.body);
        if (read !== null) expect(read.status, `${page} → ${href}`).toBe(200);
        if (frag) expect(target, `${page} → ${href}`).toContain(`id="${frag}"`);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(80);
    expect(markers, "the language menus' links were read").toBeGreaterThan(80);
    const r = await fetch(`http://127.0.0.1:${PORT}/de/connect?setlang=1`, { redirect: "manual" });
    expect([r.status, r.headers.get("location")]).toEqual([302, "/de/connect"]);
  });
  it("Impressum and Datenschutz are one click from every page", () => {
    for (const [page, body] of html) {
      expect(body, page).toMatch(/href="\/([a-z]{2}\/)?impressum"/);
      expect(body, page).toMatch(/href="\/([a-z]{2}\/)?datenschutz"/);
    }
  });
  it("no page links the status page: it is allow-listed to the operator (owner 2026-10-13)", () => {
    expect(html.size).toBeGreaterThan(20);
    for (const [page, body] of html) expect(body, page).not.toContain('href="https://status.viafrei.de');
  });
  it("no page links /home (D1: one front door)", () => {
    for (const [page, body] of html) expect(body, page).not.toMatch(/href="\/home"/);
  });
});

describe("connect page questions, rendered (#449)", () => {
  const unescape = (x: string): string => x.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  const asked = (body: string): string[] => [...body.matchAll(/<span class="ask__text"[^>]*>([^<]*)<\/span>/g)].map((m) => unescape(m[1]!));
  for (const l of LIVE_LANGS) {
    it(`${pathFor("connect", l)} asks the five in ${l}, never another page's text`, () => {
      const qs = asked(html.get(pathFor("connect", l))!);
      expect(qs).toEqual(CONNECT_PROMPTS.map((p) => t(l, p.key)));
      for (const other of LIVE_LANGS.filter((o) => o !== l)) {
        for (const q of asked(html.get(pathFor("connect", other))!)) expect(qs, `${l} prints ${other}'s "${q}"`).not.toContain(q);
      }
    });
  }
});

describe("the beta notice on every page (#471)", () => {
  const unescape = (x: string): string => x.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  const notice = (body: string): string | null => /<div class="beta" role="note" id="beta-notice">([\s\S]*?)<\/div>/.exec(body)?.[1] ?? null;
  it("read every page of the map in every live language — not nothing", () => {
    expect(html.size).toBe(PAGES.length * LIVE_LANGS.length);
  });
  for (const p of PAGES) {
    for (const l of LIVE_LANGS) {
      const path = pathFor(p.id, l);
      it(`${path} says it in ${l}, once, with the link to /${l}/connect#beta`, () => {
        const body = html.get(path)!;
        const n = notice(body);
        expect(n, `${path}: no beta notice`).not.toBeNull();
        expect(body.match(/id="beta-notice"/g) ?? [], path).toHaveLength(1);
        const text = unescape(n!);
        expect(text).toContain(t(l, "beta.label"));
        expect(text).toContain(t(l, "beta.line"));
        expect(text).toContain(`href="${pathFor("connect", l)}#beta"`);
        expect(text, `${path}: the notice is marked with another language`).not.toMatch(/\slang="/);
        for (const other of LIVE_LANGS.filter((o) => o !== l)) expect(text, `${path} prints ${other}'s notice`).not.toContain(t(other, "beta.line"));
      });
    }
  }
  for (const l of LIVE_LANGS) {
    it(`${pathFor("connect", l)} carries the fuller paragraph at #beta in ${l}`, () => {
      const body = unescape(html.get(pathFor("connect", l))!);
      expect(body).toContain('id="beta"');
      for (const k of ["connectPage.betaHeading", "connectPage.beta1", "connectPage.beta2", "connectPage.beta3"] as const) expect(body, `${l}: ${k}`).toContain(t(l, k));
    });
  }
});

describe("real answers on the connect page (#472, v1.8.1)", () => {
  const unescape = (x: string): string => x.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  for (const l of LIVE_LANGS) {
    it(`${pathFor("connect", l)}: every answer, its tool, its note, its names untranslated and its credit lines`, () => {
      const body = unescape(html.get(pathFor("connect", l))!);
      expect(body).toContain('id="answers"');
      for (const e of connectExamples(new Date())) {
        expect(all(body, "code").map(nodeText), `${l}: ${e.key}`).toContain(`${e.tool}`);
        expect(body, `${l}: ${e.key}`).toContain(t(l, `connectPage.live.${e.key}.note`));
        for (const name of Object.values(namesOf(e))) expect(all(body, "span[translate=\"no\"]").map(nodeText), `${l}: ${e.key} names ${name}`).toContain(`${name}`);
        for (const id of e.credits) {
          const r = Object.entries(ATTRIBUTION).find(([k]) => k === id)?.[1];
          expect(r, id).toBeDefined();
          expect(body, `${l}: ${id}`).toContain(creditLi(l, r!, id));
        }
      }
      // every example of the file is rendered (#746: no cap, no rotation) but a retired fuel card (Verdict 2)
      // …but a card whose stated end has passed (#473), judged with the request's clock as the page is
      expect(body.match(/<article class="card answer"/g)?.length, `${l}: cards rendered`).toBe(connectExamples(new Date()).length);
      expect(CONNECT_EXAMPLES.length).toBe(LIVE_EXAMPLES.length - 1);
      expect(body, `${l}: the retired card`).not.toContain('aria-labelledby="ans-fuelland"');
      // #486/#487 (data steward): the two v1.8.16 cards carry the Köln transport company's short mark in no text a
      // reader meets — attributes (the publisher's own URL) are not text — and the Stadtbahn card names it in full
      for (const k of ["stadtbahn", "bikes"]) {
        const card = new RegExp(`<article class="card answer" aria-labelledby="ans-${k}">([\\s\\S]*?)</article>`).exec(body)?.[1];
        expect(card, `${l}: ${k} rendered`).toBeDefined();
        const text = card!.replace(/<[^>]*>/g, " ");
        expect(text, `${l}: ${k}`).not.toMatch(/kvb/i);
        if (k === "stadtbahn") expect(text, l).toContain("Kölner Verkehrs-Betriebe AG");
      }
      // No example quotes the Baden-Württemberg police (#454 C1); its credit, in the page's source list, still carries the RVWD line.
      expect(all(body, "span.credit__condition").map(nodeText), `${l}: the RVWD line`).toContain(`${ATTRIBUTION.mobilithek_traffic_bw.conditionNote!.de}`);
    });
  }
});

describe("every CC BY-type credit on the site links its licence text (owner 2026-10-05)", () => {
  // MUTANT (run 2026-10-05): the `{c.licence !== null && …}` clause removed from
  // both credit lists of ConnectPage.astro — every connect page goes red here
  // and in the two byte pins above.
  it("no credit line whose licence owes the link renders without it, on any page in any language", () => {
    const owing = Object.values(ATTRIBUTION).filter((r) => licenceTextFor(r.license) !== null);
    expect(owing.length, "register rows owing a licence link").toBeGreaterThanOrEqual(15);
    let checked = 0;
    for (const [path, raw] of html) {
      const body = raw.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      for (const m of body.matchAll(/<(li|p)(?: class="credit[^"]*")? lang="de">([\s\S]*?)<\/\1>/g)) {
        const inner = m[2] ?? "";
        const r = owing.find((x) => inner.includes(`>${x.text}</a>`));
        if (r === undefined) continue;
        checked++;
        expect(inner, `${path}: «${r.text}» without its licence text`).toContain(`class="credit__licence" href="${licenceTextFor(r.license)!.url}"`);
      }
    }
    // the sweep found credit lines to judge, or it proved nothing
    expect(checked).toBeGreaterThanOrEqual(LIVE_LANGS.length * 15);
  });
});

describe("credit lines on the connect page (#142 item 5, #377 D4)", () => {
  const unescape = (x: string): string => x.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  for (const l of LIVE_LANGS) {
    it(`${pathFor("connect", l)}: every live register row, byte for byte, lang="de", and the MTS-K note`, () => {
      const body = unescape(html.get(pathFor("connect", l))!);
      // planned AND discontinued rows hold no data and are withheld (holdsNoData in the register; #704 made DB BahnPark discontinued)
      const live = Object.entries(ATTRIBUTION).filter(([, r]) => (r as { planned?: boolean }).planned !== true && (r as { discontinued?: unknown }).discontinued === undefined);
      expect(live.length).toBeGreaterThanOrEqual(15);
      for (const [id, r] of live) expect(body).toContain(creditLi(l, r, id));
      expect(all(body, "p.muted[lang=\"de\"]").map(nodeText)).toContain(`${MTSK_CONSUMER_NOTE}`);
    });
  }
});

describe("the examples page (#747)", () => {
  for (const l of LIVE_LANGS) {
    it(`${pathFor("examples", l)}: every ledger key but the Tankerkönig ones under its anchor, no fuel example, reached from the home and the connect page`, () => {
      const body = html.get(pathFor("examples", l))!;
      const fuelKeys = new Set([...FUEL_ASKS.map((f) => `fuel:${f.key}`), ...LIVE_EXAMPLES.filter((e) => e.credits.includes("tankerkoenig")).map((e) => `card:${e.key}`)]);
      const missing = EXAMPLE_LEDGER.filter((k) => !fuelKeys.has(k) && !body.includes(`id="${anchorFor(k)}"`));
      expect(missing, `${l}: not on the examples page`).toEqual([]);
      expect(EXAMPLE_LEDGER.length).toBeGreaterThan(50);
      // data-steward Verdict 2: the examples page is not a surface the fuel examples may be shown on
      for (const k of fuelKeys) expect(body, `${l}: ${k}`).not.toContain(`id="${anchorFor(k)}"`);
      expect(body.includes("Tankerkönig"), `${l}: a Tankerkönig credit on the examples page`).toBe(false);
      expect(body, l).not.toContain("fuelasks");
      // the fuel section is one sentence with its two links instead
      const note = /<p class="examples__fuelnote">([\s\S]*?)<\/p>/.exec(body)?.[1] ?? "";
      expect(note, `${l}: the fuel sentence`).toContain(`href="${pathFor("start", l)}#fuel-asks"`);
      expect(note, `${l}: the fuel sentence`).toContain(`href="${pathFor("connect", l)}#answers"`);
      expect(html.get(pathFor("start", l)), `${l}: the anchor the sentence links`).toContain('id="fuel-asks"');
      expect(body).not.toMatch(/<meta name="robots"/);
      for (const from of [pathFor("start", l), pathFor("connect", l)]) expect(html.get(from), `${from} links the examples page`).toContain(`href="${pathFor("examples", l)}"`);
    });
  }
});

describe("at most three Tankerkönig examples on the whole site (data-steward Verdict 2, 2026-10-05)", () => {
  const unescape = (x: string): string => x.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  const asked = [...FUEL_ASKS.map((f) => f.answer.values), ...LIVE_EXAMPLES.filter((e) => e.credits.includes("tankerkoenig")).map((e) => e.values)];
  const addressOf = (k: string): string | undefined =>
    k.startsWith("fuel:") ? FUEL_ASKS.find((f) => `fuel:${f.key}` === k)?.answer.names?.["address"] : LIVE_EXAMPLES.find((e) => `card:${e.key}` === k)?.names?.["address"];
  const kept = ["fuel:goerlitz", "card:fuelcity", "card:fuelroad"].map(addressOf);
  const retired = Object.keys(RETIRED_FUEL).map(addressOf);
  for (const l of LIVE_LANGS) {
    it(`${l}: three dated fuel examples across every page, at three places, and no retired one anywhere`, () => {
      const heads = [...new Set(asked.map((v) => t(l, "connectPage.live.fuelExample", v)))];
      let examples = 0;
      const where: string[] = [];
      for (const path of new Set(PAGES.map((p) => pathFor(p.id, l)))) {
        const body = unescape(html.get(path)!);
        const n = heads.reduce((sum, h) => sum + body.split(h).length - 1, 0);
        if (n > 0) where.push(`${path}: ${n}`);
        examples += n;
        for (const a of retired) expect(body.includes(a!), `${path}: names the retired ${a}`).toBe(false);
      }
      expect(examples, where.join("; ")).toBe(3);
      expect(where.sort(), l).toEqual([`${pathFor("connect", l)}: 2`, `${pathFor("start", l)}: 1`].sort());
      const home = unescape(html.get(pathFor("start", l))!);
      const connect = unescape(html.get(pathFor("connect", l))!);
      expect(home.split(kept[0]!).length - 1, `${l}: Görlitz once`).toBe(1);
      // the home's fuel requests hold every Tankerkönig answer of the home (the fuel tile beside it is the digest's, not an
      // example), open on every width: FS5 puts no recorded price behind a fold
      expect(home, `${l}: the fuel requests in a fold`).not.toMatch(/<details[^>]*id="fuel-asks"/u);
      const box = /<section class="fuelasks" id="fuel-asks"[\s\S]*?<\/section>/.exec(home)?.[0] ?? "";
      expect(box.length, `${l}: no fuel requests on the home`).toBeGreaterThan(500);
      for (const h of heads) expect(home.replace(box, "").includes(h), `${l}: a fuel example outside the fuel requests`).toBe(false);
      expect(heads.some((h) => box.includes(h)), `${l}: the fuel requests hold an example`).toBe(true);
      for (const a of kept.slice(1)) expect(connect.split(a!).length - 1, `${l}: ${a} once`).toBe(1);
      expect(new Set(kept).size).toBe(3);
    });
  }
});
