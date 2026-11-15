/**
 * 2.1.17 (#716 search): a motorway page's rendered head and intro, against the
 * BUILT shell and the REAL digest (`real-digest.ts`) — the A7 (production's
 * size, live), the A1 (a short live one), the A61 (its chain broken once,
 * nothing reported) and the A34 (no course in the LCL). Each in every
 * language: the per-motorway title and description in `<title>`, the meta
 * description and the social tags, inside the bounds; the intro under the
 * `<h1>`, quotable, built only from what the page holds; the head attributes
 * gone from the page; the JSON-LD still the catalogue's (steward M27: no LCL
 * name in a machine format).
 */
import type { ChildProcess } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DESCRIPTION_MAX, DESCRIPTION_MIN, TITLE_MAX, motorwayMeta } from "../src/site/meta.js";
import { motorwayPath } from "../src/site/motorways.js";
import { LIVE_LANGS, type Lang } from "../src/site/pages.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8817;
const BASE = `http://127.0.0.1:${PORT}`;
let shell: ChildProcess;
let digest: Awaited<ReturnType<typeof startRealDigest>>;

beforeAll(async () => {
  digest = await startRealDigest();
  shell = await startShell(PORT, { DIGEST_URL: digest.url, IMPRESSUM_NAME: "Site Probe", IMPRESSUM_STREET: "Probeweg 3", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "site@example.invalid" });
});
afterAll(async () => {
  shell?.kill();
  await digest?.close();
});

const decode = (s: string): string => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
// French keeps its no-break spaces before ":" and ";" (#753), so they are not folded into a plain space
const text = (html: string): string => decode(html.replace(/<[^>]+>/g, "")).replace(/[^\S  ]+/gu, " ").trim();
type Head = { title: string; description: string; og: string; twitter: string; intro: string | null; lead: string | null; body: string };
async function head(lang: Lang, road: string): Promise<Head> {
  const r = await fetch(`${BASE}${motorwayPath(lang, road)}`);
  expect(r.status, `${lang} ${road}`).toBe(200);
  const body = await r.text();
  const one = (re: RegExp): string => decode(re.exec(body)?.[1] ?? "");
  const intro = /<p class="lead motorway__intro">([\s\S]*?)<\/p>/.exec(body)?.[1] ?? null;
  const lead = /<section class="wrap motorway-page__head">[\s\S]*?<p class="lead">([\s\S]*?)<\/p>/.exec(body)?.[1] ?? null;
  return {
    title: one(/<title>([^<]*)<\/title>/),
    description: one(/<meta name="description" content="([^"]*)"/),
    og: one(/<meta property="og:description" content="([^"]*)"/),
    twitter: one(/<meta name="twitter:title" content="([^"]*)"/),
    intro: intro === null ? null : text(intro),
    lead,
    body,
  };
}

/** #1110: the floor the unit sweep holds a now-led description to (packages/web/test/seo-sweep.test.ts). */
const NOW_LED_DESCRIPTION_MIN = 50;
const HOLLOW = /\{\w+\}|\bundefined\b|\bnull\b|\bNaN\b|[^\S\u00a0\u202f][,;.:)]|\(\)|\s{2}/u;

describe("the head and the intro of four motorway pages (#716, 2.1.17)", () => {
  for (const road of ["A7", "A1", "A61", "A34"])
    for (const lang of LIVE_LANGS) {
      it(`${motorwayPath(lang, road)}: its own title and description, inside the bounds; the intro under the h1, nothing hollow`, async () => {
        const h = await head(lang, road);
        expect(h.title.length, h.title).toBeLessThanOrEqual(TITLE_MAX);
        expect(h.description.length, h.description).toBeLessThanOrEqual(DESCRIPTION_MAX);
        // #1110: a description led by what is reported now (the intro's own first sentence, with its Stand) may be short —
        // the unit sweep (seo-sweep.test.ts) holds it to 50; every other description keeps the site's floor
        // #1173: the status line is what leads now
        const nowLed = h.description.startsWith(`${road}: `);
        expect(h.description.length, h.description).toBeGreaterThanOrEqual(nowLed ? NOW_LED_DESCRIPTION_MIN : DESCRIPTION_MIN);
        expect(h.title).toContain(road);
        expect(h.description).toContain(road);
        expect(h.og).toBe(h.description);
        expect(h.twitter).toBe(h.title);
        for (const s of [h.title, h.description]) expect(s).not.toMatch(HOLLOW);
        // the head attributes are read and stripped: never on the page
        expect(h.body).not.toMatch(/data-title=|data-description=/);
        // the intro sits in the head section, straight under the h1, and the generic lead is gone
        expect(h.body).toMatch(/<h1>[^<]+<\/h1>\s*<div class="pagefirst" id="page-first">[\s\S]*?<\/div>\s*<p class="lead motorway__intro">/);
        expect(h.lead).toBeNull();
        expect(h.intro, road).not.toBeNull();
        expect(h.intro!, road).toContain(road);
        expect(h.intro!, road).not.toMatch(HOLLOW);
        // JSON-LD keeps the catalogue's name: no LCL junction in a machine format (M27)
        const ld = /<script type="application\/ld\+json"[^>]*>([^<]+)<\/script>/.exec(h.body)?.[1] ?? "";
        expect(ld).toContain(JSON.stringify(motorwayMeta(road, lang).title).slice(1, -1));
        expect(ld).not.toMatch(/Musterstadt|Beispielort/);
      });
    }

  it("the A7 in German: the route ends, the length, the Land, the junctions with the interchanges, the break, and the live counts with Stand", async () => {
    const h = await head("de", "A7");
    expect(h.title).toBe("A7: Sperrung heute – ViaFrei");
    // #1110: the description leads with today's counts and the Stand, then the active stretches by name, closures first
    expect(h.description).toMatch(/^A7: 6 Sperrungen, 8 Staus, 2 [^,]+, 40 Baustellen · Stand \d\d:\d\d\. Sperrung /);
    expect(h.description).not.toMatch(/Rastpl|Ladesäul|Autoh/);
    // #1173: the read stands in the status block; the paragraph is the course in one sentence
    expect(h.intro!).toMatch(/^Die A7 führt von A[SDK] Musterstadt-Nord 1 bis A[SDK] Musterstadt-\S+ \d+, schematisch etwa [\d.]+ km lang, durch Schleswig-Holstein, mit \d+ Anschlussstellen, Kreuzen und Dreiecken \(davon \d+ Kreuze und Dreiecke\); ihr Verlauf ist zwischen A[SDK] \S+ \d+ und A[SDK] \S+ \d+ unterbrochen\.$/);
    expect(h.intro!).not.toMatch(/gemeldet|Stand /);
  });
  it("the A7 in English and Russian: no German place in the description, the Land in the page's language", async () => {
    const en = await head("en", "A7");
    expect(en.title).toBe("A7: closure today – ViaFrei");
    expect(en.description).toMatch(/^A7: 6 closures, 8 jams, /);
    expect(en.description).not.toMatch(/Musterstadt/);
    expect(en.intro!).toMatch(/^The A7 runs from Musterstadt-Nord 1 (junction|interchange) to /);
    const ru = await head("ru", "A7");
    expect(ru.description).toMatch(/^A7: /);
    expect(ru.description).not.toMatch(/[A-Za-z]{4,}(?<!ViaFrei)/);
    expect(ru.intro!).toMatch(/^Маршрут автобана A7: /);
  });
  it("the A61 names its break and says nothing is reported, with Stand; the A34 promises no map and has no route sentence", async () => {
    const a61 = await head("de", "A61");
    expect(a61.intro!).toContain("ihr Verlauf ist zwischen AS Beispielort-");
    expect(a61.intro!).toMatch(/^Die A61 führt /);
    // nothing active: said so with its Stand in the snippet, never a list of facilities (#1020 round 2, #1110)
    expect(a61.description).toMatch(/^A61: Derzeit nichts gemeldet · Stand \d\d:\d\d\./);
    for (const lang of LIVE_LANGS) {
      const a34 = await head(lang, "A34");
      expect(a34.title, lang).not.toMatch(/Karte|\bmap\b|карт|hart|harita/iu);
      expect(a34.description, lang).not.toMatch(/Karte|\bmap\b|карт|hart|harita/iu);
      expect(a34.intro!, lang).not.toMatch(/Beispielort|km/);
    }
    expect((await head("de", "A34")).intro).toMatch(/^Auf der A34 ist derzeit nichts gemeldet \(Stand \d\d:\d\d\)\.$/);
  });
});
