/**
 * #1112: the position bar as rendered — Astro's container over the e2e fixture digest (loopback, no database, no
 * network), on the three page types that carry it (the home, a place page, a motorway page), in every live language:
 * no `<dialog>` anywhere in the location flow, and the bar server-side with its search box (a GET form to the site
 * search, #1111), "use my location" (hidden until the island runs), the chip row ("Beliebt" with the popular places
 * as ordinary links, so it works without JavaScript), "Ganz Deutschland" as a chip with its no-script link, and the
 * privacy note. The island's behaviour on these ids is `location.test.ts`'s.
 */
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { getViteConfig } from "astro/config";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { all, text as nodeText } from "@viafrei/design/testing";
import { startRealDigest } from "../e2e/real-digest.js";
import { t } from "../src/i18n/index.js";
import { SITE_ORIGIN } from "../src/site/endpoints.js";
import { LIVE_LANGS, type Lang } from "../src/site/pages.js";
import { POPULAR_PLACES, placePath, popularSlug } from "../src/site/places.js";
import { searchPath } from "../src/site/search.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const FILES = {
  home: "/src/pages/[lang]/index.astro",
  place: "/src/pages/[lang]/place/[slug].astro",
  motorway: "/src/pages/[lang]/autobahn/[road]/[...rest].astro",
} as const;
let digest: Awaited<ReturnType<typeof startRealDigest>> | undefined;
let vite: ViteDevServer | undefined;
let container: AstroContainer;
const saved = process.env["DIGEST_URL"];
// the motorway page carries the bar while its "around you" switch is on (#890, `motorwayAroundOn`)
const savedAround = process.env["VF_MOTORWAY_AROUND"];

beforeAll(async () => {
  digest = await startRealDigest();
  process.env["DIGEST_URL"] = digest.url;
  process.env["VF_MOTORWAY_AROUND"] = "1";
  const config = await (getViteConfig({}, { root: ROOT, logLevel: "error" }) as (e: { mode: string; command: "serve" | "build" }) => Promise<Record<string, unknown>>)({ mode: "test", command: "serve" });
  vite = await createServer({ ...config, configFile: false, root: ROOT, logLevel: "error", server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  container = await AstroContainer.create();
  for (const f of Object.values(FILES)) await vite.ssrLoadModule(f);
}, 30_000);

afterAll(async () => {
  await vite?.close();
  await digest?.close();
  if (saved === undefined) delete process.env["DIGEST_URL"];
  else process.env["DIGEST_URL"] = saved;
  if (savedAround === undefined) delete process.env["VF_MOTORWAY_AROUND"];
  else process.env["VF_MOTORWAY_AROUND"] = savedAround;
});

async function render(file: string, params: Record<string, string>, url: string, lang: Lang): Promise<string> {
  const mod = (await vite!.ssrLoadModule(file)) as { default: Parameters<AstroContainer["renderToString"]>[0] };
  return container.renderToString(mod.default, {
    params,
    request: new Request(url, { headers: { "accept-language": lang, "user-agent": "Mozilla/5.0" } }),
    locals: { nonce: "n", googleTag: undefined, clarityId: undefined, mapPlatform: "other" },
  });
}

const pages = (lang: Lang): { kind: string; file: string; params: Record<string, string>; path: string }[] => [
  { kind: "home", file: FILES.home, params: { lang }, path: `/${lang}` },
  { kind: "place", file: FILES.place, params: { lang, slug: "koeln" }, path: placePath(lang, "koeln") },
  { kind: "motorway", file: FILES.motorway, params: { lang, road: "a7" }, path: `/${lang}/autobahn/a7` },
];

describe("#1112 the position bar, server-side, on the home, a place page and a motorway page, every language", () => {
  for (const lang of LIVE_LANGS) {
    it(lang, async () => {
      for (const p of pages(lang)) {
        const html = await render(p.file, p.params, `${SITE_ORIGIN}${p.path}`, lang);
        const at = `${lang} ${p.kind}`;
        // no dialog, and no script that would open one
        expect(html, at).not.toMatch(/<dialog|showModal|id="place-sheet"/);
        expect(all(html, "#place-bar").length, at).toBe(1);
        // #1153: the bar is the header's, on these pages as on every other
        expect(all(html, "header #place-bar").length, at).toBe(1);
        // the box: a GET search form, a combobox whose list is announced
        const form = all(html, '#place-bar form#place-head[role="search"][method="get"]');
        expect(form.map((e) => e.attrs.action), at).toEqual([searchPath(lang)]);
        expect(all(html, '#place-head input#place-hq[name="q"][role="combobox"][aria-controls="place-hresults"]').length, at).toBe(1);
        expect(all(html, '#place-hq').map((e) => e.attrs.placeholder), at).toEqual([t(lang, "place.bar.hint")]);
        // #1112: the suggestion list is no live region — its count has its own status line, empty until the island
        // fills it, and the place's announcement (`place-live`) is a different element that holds no suggestion
        expect(all(html, "#place-hresults").map((e) => [e.attrs["aria-live"], e.attrs.role]), at).toEqual([[undefined, undefined]]);
        expect(all(html, '#place-head p#place-hstatus.visually-hidden[role="status"]').map(nodeText), at).toEqual([""]);
        expect(all(html, "#place-live").map((e) => e.attrs["aria-live"]), at).toEqual(["polite"]);
        expect(all(html, "#place-hresults #place-live, #place-live #place-hresults, #place-live #place-hstatus").length, at).toBe(0);
        expect(t(lang, "place.bar.found", { n: "{n}" }), at).toContain("{n}");
        // "use my location": the bar's own, hidden until the island shows it
        const geo = all(html, "#place-bar button#place-geo");
        expect(geo.map((e) => [e.attrs.type, "hidden" in e.attrs]), at).toEqual([["button", true]]);
        expect(geo.map(nodeText).join(""), at).toContain(t(lang, "place.sheet.useLocation"));
        // #1139: a way of its own, never the search's button — outside the search form; #1158 (owner 2026-11-03): on its
        // own row ABOVE the search ("live for", "use my location", the search, the recent places, the foot line)
        expect(all(html, "#place-head #place-geo").length, at).toBe(0);
        expect(all(html, "header #place-bar .site-place__geo #place-geo").length, at).toBe(1);
        const order = ['id="place-scope"', 'id="place-upd"', 'id="place-geo"', 'id="place-mine"', 'id="place-head"', 'id="place-recent"', 'id="place-kept"', 'class="placepos__privacy"'].map((m) => html.indexOf(m, html.indexOf('id="place-bar"')));
        expect(order.every((n) => n > 0), at).toBe(true);
        expect([...order].sort((x, y) => x - y), at).toEqual(order);
        // the status is ONE line: "aktualisiert für X" inside the source line; the kept line and the lock share the foot
        expect(all(html, "#place-bar p.placehead__src span#place-upd").length, at).toBe(1);
        expect([all(html, "#place-bar .site-place__foot #place-kept").length, all(html, "#place-bar .site-place__foot details.placepos__privacy").length], at).toEqual([1, 1]);
        // the chip row: "Beliebt" with the popular places as ordinary links (works without JavaScript)
        expect(all(html, "#place-chips-l").map(nodeText), at).toEqual([t(lang, "place.bar.popular")]);
        const chips = all(html, "#place-recent a.chip.place-opt");
        expect(chips.map((e) => e.attrs.href), at).toEqual(POPULAR_PLACES.map((pp) => placePath(lang, popularSlug(pp))));
        // a link may not carry aria-pressed (axe aria-allowed-attr, Lighthouse a11y): the shown chip is aria-current
        expect(chips.every((e) => (e.attrs["aria-current"] === "true" || e.attrs["aria-current"] === "false") && e.attrs["aria-pressed"] === undefined), at).toBe(true);
        // #1138: "Ganz Deutschland" is ONE control, the headline's radio with its no-script target — never a chip in the bar
        expect([...all(html, "#place-bar #place-germany"), ...all(html, "#place-bar .placepos__de")].length, at).toBe(0);
        expect([...all(html, "a"), ...all(html, "button")].filter((e) => nodeText(e).replace("🇩🇪", "").trim() === t(lang, "place.germany")).map((e) => `${String(e.attrs.id)}.${String(e.attrs.class)}`), at).toEqual(["place-scope-de.placehead__opt"]);
        const de = all(html, "#place-scope-de");
        expect(de.length, at).toBe(1);
        expect(String(de[0]?.attrs.href), at).toMatch(/[?&]scope=de$/);
        expect(nodeText(de[0]!), at).toContain(t(lang, "place.germany"));
        // the privacy note, one click away, linking the Datenschutz section
        expect(all(html, "#place-bar details.placepos__privacy a").map((e) => String(e.attrs.href)).some((h) => h.endsWith("#ort")), at).toBe(true);
      }
    });
  }
});

describe("#1112 the chip of the place shown is pressed; with no place, the headline's 'Ganz Deutschland' radio is (#1138)", () => {
  it("a place page of a popular place marks its chip; the motorway page without a position marks Germany", async () => {
    expect(POPULAR_PLACES.map(popularSlug)).toContain("koeln");
    const place = await render(FILES.place, { lang: "de", slug: "koeln" }, `${SITE_ORIGIN}${placePath("de", "koeln")}`, "de");
    expect(all(place, '#place-recent a[aria-current="true"]').map((e) => e.attrs.href)).toEqual([placePath("de", "koeln")]);
    expect(all(place, "#place-scope-de").map((e) => e.attrs["aria-checked"])).toEqual(["false"]);
    const road = await render(FILES.motorway, { lang: "de", road: "a7" }, `${SITE_ORIGIN}/de/autobahn/a7`, "de");
    expect(all(road, "#place-scope-de").map((e) => e.attrs["aria-checked"])).toEqual(["true"]);
    expect(all(road, '#place-recent a[aria-current="true"]').length).toBe(0);
  });
});
