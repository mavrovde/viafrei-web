/**
 * 2.4.5 review S1 (and the class 9c94e2472 fixed for the header): every in-page link a page renders — `href="#x"` — has
 * its `id="x"` on the SAME page. Below the browser suites: the real page components are compiled by Astro's own Vite
 * plugin and rendered with Astro's container, over the real digest of the e2e fixture (`e2e/real-digest.ts`, loopback,
 * no database, no network), so the shell's own anchors (the header's place echo, the home's block anchors) and every
 * fragment it embeds (the place cards' chips, the station page's area cards) are judged together, as a visitor gets them.
 *
 * The pages: the home with a place, a place page, a motorway page with and without its "around" block, a station page
 * and the connect page — the hosts of the place echo (`placeEcho`) and of the place chips. Each in de and en.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { createServer, type ViteDevServer } from "vite";
import { getViteConfig } from "astro/config";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { all } from "@viafrei/design/testing";
import { startRealDigest } from "../e2e/real-digest.js";
import { pathFor, type Lang } from "../src/site/pages.js";
import { placePath } from "../src/site/places.js";
import { stationPath } from "../src/site/stations.js";
import { motorwayPath } from "../src/site/motorways.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ORIGIN = "https://viafrei.de";
let digest: Awaited<ReturnType<typeof startRealDigest>> | undefined;
let vite: ViteDevServer | undefined;
let container: AstroContainer;
const saved = { DIGEST_URL: process.env["DIGEST_URL"], VF_MOTORWAY_AROUND: process.env["VF_MOTORWAY_AROUND"] };

beforeAll(async () => {
  digest = await startRealDigest();
  process.env["DIGEST_URL"] = digest.url;
  const config = await (getViteConfig({}, { root: ROOT, logLevel: "error" }) as (e: { mode: string; command: "serve" | "build" }) => Promise<Record<string, unknown>>)({ mode: "test", command: "serve" });
  vite = await createServer({ ...config, configFile: false, root: ROOT, logLevel: "error", server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  container = await AstroContainer.create();
  // compile the page graph once here, so each test only renders (the first render used to pay the compile, 2.4 s cold)
  for (const file of new Set(pages("de").map((p) => p.file))) await vite.ssrLoadModule(file);
});

afterAll(async () => {
  await vite?.close();
  await digest?.close();
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

type Page = { readonly name: string; readonly file: string; readonly params: Record<string, string>; readonly path: string; readonly around?: boolean };

/** Render one page as the server would answer it to a visitor (no middleware: its locals are set here, as it sets them). */
async function render(p: Page): Promise<string> {
  if (vite === undefined) throw new Error("vite did not start");
  if (p.around === true) process.env["VF_MOTORWAY_AROUND"] = "1";
  else delete process.env["VF_MOTORWAY_AROUND"];
  const mod = (await vite.ssrLoadModule(p.file)) as { default: Parameters<AstroContainer["renderToString"]>[0] };
  const html = await container.renderToString(mod.default, {
    params: p.params,
    request: new Request(`${ORIGIN}${p.path}`, { headers: { "accept-language": "de", "user-agent": "Mozilla/5.0" } }),
    locals: { nonce: "n", googleTag: undefined, clarityId: undefined, mapPlatform: "other" },
  });
  return html;
}

/** Every `href="#x"` of the HTML whose `id="x"` is not on it. */
function deadAnchors(html: string): readonly string[] {
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!));
  const targets = [...html.matchAll(/\shref="#([^"]*)"/g)].map((m) => m[1]!);
  return [...new Set(targets.filter((x) => x !== "" && !ids.has(x)))];
}

const pages = (lang: Lang): readonly Page[] => {
  const station = stationPath(lang, "koeln-hbf");
  const motorway = motorwayPath(lang, "A7");
  return [
    { name: "home with a place", file: "/src/pages/[lang]/index.astro", params: { lang }, path: `${pathFor("start", lang)}?at=ags:05315000` },
    { name: "place page", file: "/src/pages/[lang]/place/[slug].astro", params: { lang, slug: "koeln" }, path: placePath(lang, "koeln") },
    { name: "motorway page", file: "/src/pages/[lang]/autobahn/[road]/[...rest].astro", params: { lang, road: "a7" }, path: motorway },
    { name: "motorway page with its around block", file: "/src/pages/[lang]/autobahn/[road]/[...rest].astro", params: { lang, road: "a7" }, path: `${motorway}?scope=de`, around: true },
    { name: "station page", file: "/src/pages/[lang]/station/[slug].astro", params: { lang, slug: station.split("/").pop()! }, path: station },
    { name: "connect page", file: "/src/pages/[lang]/connect.astro", params: { lang }, path: pathFor("connect", lang) },
    // 2.4.6: a place the address names (`?at=`) is the block's, rendered by the server with the page
    { name: "motorway page with a place in its address", file: "/src/pages/[lang]/autobahn/[road]/[...rest].astro", params: { lang, road: "a7" }, path: `${motorway}?at=ags:06611000`, around: true },
  ];
};

describe("every in-page link has its target on the page (2.4.5 review S1, #1088 placeEcho)", () => {
  for (const lang of ["de", "en"] as const) {
    for (const p of pages(lang)) {
      it(`${lang}: ${p.name}`, async () => {
        const html = await render(p);
        // the page rendered as a page, not a 404 or an error: the judge read something
        expect(all(html, ".site-head").length, p.path).toBeGreaterThan(0);
        expect(html.length, p.path).toBeGreaterThan(5_000);
        expect(deadAnchors(html), p.path).toEqual([]);
      });
    }
  }

  it("the pages that must carry them do: the header's place pill on every page (#1153), the chips on the home, place and station pages", async () => {
    const de = pages("de");
    const [home, place, aroundOff, aroundOn, station, connect] = [await render(de[0]!), await render(de[1]!), await render(de[2]!), await render(de[3]!), await render(de[4]!), await render(de[5]!)];
    const n = (html: string, sel: string): number => all(html, sel).length;
    // #1153: the place echo is gone; the header's place pill ("Live für <Ort>") is on every page, once
    for (const html of [home, place, aroundOff, aroundOn, station, connect]) expect(n(html, "header #place-pill")).toBe(1);
    expect(n(home, ".pcard__at")).toBeGreaterThan(0);
    expect(n(place, ".pcard__at")).toBeGreaterThan(0);
    expect(n(station, ".pcard__at")).toBeGreaterThan(0);
    // the station page's chips name the Gemeinde's page — it carries no place headline to link to
    const stationChips = all(station, "a.pcard__at").map((a) => a.attrs.href);
    expect(stationChips.length).toBeGreaterThan(0);
    expect(new Set(stationChips)).toEqual(new Set([placePath("de", "koeln")]));
    // …and the home keeps its in-page header anchors: the onHome rule moves them only where the target is absent
    const homeHrefs = all(home, "a").map((a) => a.attrs.href);
    expect(homeHrefs).toContain("#day");
    expect(homeHrefs).toContain("#tools");
    // the place page keeps "#start" in-page (its own Start block) and sends the home-only anchors home
    const placeHrefs = all(place, "a").map((a) => a.attrs.href);
    expect(placeHrefs).toContain("#start");
    expect(placeHrefs).not.toContain("#day");
  });

  /**
   * 2.4.6 (prod 2.4.5, the A4 near Aachen: 102 dead in-page links): the page as a visitor with a POSITION gets it — the
   * first HTML, then the island's ask (`/fragment/motorway-around`, the real route over the real digest) for a browser
   * cell on the fixture's A7, its block in the slot and its main block swapped in, exactly as `swapMain` does. The
   * description's own links (`a.mw-in`) stay above the swapped block and are the island's `relink` to judge: they are
   * named here so that no other link can hide among them.
   */
  for (const lang of ["de", "en"] as const) {
    it(`${lang}: motorway page in around mode WITH a position (the island's swap applied)`, async () => {
      const motorway = motorwayPath(lang, "A7");
      const html = await render({ name: "around", file: "/src/pages/[lang]/autobahn/[road]/[...rest].astro", params: { lang, road: "a7" }, path: `${motorway}?scope=de`, around: true });
      const { motorwayAroundRoute } = await import("../src/lib/motorway-around.js");
      for (const r of [5, 25, 100]) {
        const req = new Request("http://shell/fragment/motorway-around", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ at: "pt:51.31,9.4875", lang, how: "browser", road: "a7", r }) });
        const res = await motorwayAroundRoute(req, { baseUrl: digest!.url, timeoutMs: 1_900 }, true);
        expect(res.status, `r=${String(r)}`).toBe(200);
        const answer = await res.text();
        const t = answer.indexOf('<template id="mw-main-next">');
        expect(t, "the answer carries the radius's main block").toBeGreaterThan(0);
        const block = answer.slice(0, t);
        const main = answer.slice(t + '<template id="mw-main-next">'.length, answer.lastIndexOf("</template>"));
        // the swap: the block into the slot, the main block's inner HTML replaced
        const open = /<div class="wrap motorway-page" id="motorway-main">/.exec(html);
        expect(open).not.toBeNull();
        const start = open!.index + open![0].length;
        const end = html.indexOf("<script", start);
        const slot = /<div[^>]*id="place-slot"[^>]*>/.exec(html);
        expect(slot).not.toBeNull();
        let page = `${html.slice(0, start)}${main}</div>${html.slice(html.lastIndexOf("</div>", end) + "</div>".length)}`;
        page = page.replace(slot![0], `${slot![0]}${block}`);
        // the Ampel swap (lib/motorway-ampel.ts): the top shows the block's own Ampel (moved there, the same anchors), and
        // a <template> is inert — no link in it is one a visitor can follow
        page = page.replace(/(<div class="wrap ampel-slot" id="ampel-slot">)[^]*?(<\/div>\s*<template id="ampel-whole">)/, "$1$2").replace(/<template[^>]*>[^]*?<\/template>/g, "");
        expect(all(page, "#motorway-around").length, `r=${String(r)}`).toBe(1);
        const ids = new Set([...page.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!));
        const relinked = new Set(all(page, "a.mw-in").map((a) => (a.attrs.href ?? "").slice(1)));
        const dead = [...page.matchAll(/<a\s[^>]*href="#([^"]+)"[^>]*>/g)].map((m) => ({ id: m[1]!, mwIn: /class="mw-in"/.test(m[0]) })).filter((x) => x.id !== "" && !ids.has(x.id));
        // only the description's links may point at a row the radius block does not list — `relink` unlinks those
        expect(dead.filter((x) => !x.mwIn).map((x) => x.id), `${lang} r=${String(r)}`).toEqual([]);
        for (const x of dead) expect(relinked.has(x.id)).toBe(true);
      }
    });
  }

  it("the judge says no: a link to an id the page has not got is named", () => {
    expect(deadAnchors('<a href="#place">x</a><a href="#top">y</a><p id="top"></p>')).toEqual(["place"]);
    expect(deadAnchors('<a href="#place">x</a><section id="place"></section>')).toEqual([]);
  });
});
