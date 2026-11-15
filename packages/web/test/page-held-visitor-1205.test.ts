/**
 * #1205 review B1, rendered: the three renders that read the visitor — the station index's near-IP panel (with its
 * DB-IP credit), the motorway page's around block placed by the address, the fuel board (decided by the user agent,
 * with its here-panel from the address) — declare it (`locals.perVisitor`), so even a verified crawler's own render of
 * them is neither held nor replayed. Each has a control that reads no visitor and IS held, so the test can say yes.
 * The real page components are compiled by Astro's Vite plugin over the e2e fixture's real digest (loopback, no
 * database, no network), as in `in-page-anchors.test.ts`.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { createServer, type ViteDevServer } from "vite";
import { getViteConfig } from "astro/config";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { startRealDigest } from "../e2e/real-digest.js";
import { pathFor } from "../src/site/pages.js";
import { motorwayPath } from "../src/site/motorways.js";
import { DEGRADED_HEADER } from "../src/lib/degraded.js";
import { clearHeldPages, keepRendered, verifiedReplay } from "../src/lib/page-held.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ORIGIN = "https://viafrei.de";
const saved = { DIGEST_URL: process.env["DIGEST_URL"], VF_MOTORWAY_AROUND: process.env["VF_MOTORWAY_AROUND"] };
let digest: Awaited<ReturnType<typeof startRealDigest>> | undefined;
let vite: ViteDevServer | undefined;
let container: AstroContainer;

type Page = { readonly name: string; readonly file: string; readonly params: Record<string, string>; readonly path: string; readonly around?: boolean };
const STATION = "/src/pages/[lang]/station.astro";
const MOTORWAY = "/src/pages/[lang]/autobahn/[road]/[...rest].astro";
const FUEL = "/src/pages/[lang]/fuel.astro";
const station = `/de/station`;
const a7 = motorwayPath("de", "A7");

beforeAll(async () => {
  digest = await startRealDigest();
  process.env["DIGEST_URL"] = digest.url;
  const config = await (getViteConfig({}, { root: ROOT, logLevel: "error" }) as (e: { mode: string; command: "serve" | "build" }) => Promise<Record<string, unknown>>)({ mode: "test", command: "serve" });
  vite = await createServer({ ...config, configFile: false, root: ROOT, logLevel: "error", server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  container = await AstroContainer.create();
  const svelte = (await vite.ssrLoadModule("@astrojs/svelte/server.js")) as { default: Parameters<AstroContainer["addServerRenderer"]>[0] extends { renderer: infer R } ? R : never };
  container.addServerRenderer({ name: "@astrojs/svelte", renderer: svelte.default });
  container.addClientRenderer({ name: "@astrojs/svelte", entrypoint: "@astrojs/svelte/client.js" });
  for (const f of [STATION, MOTORWAY, FUEL]) await vite.ssrLoadModule(f);
});

afterAll(async () => {
  await vite?.close();
  await digest?.close();
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});
afterEach(() => clearHeldPages());

/** Render `p` as a verified crawler's request (Googlebot's user agent) and hand the result to the middleware's keep. */
async function renderAndKeep(p: Page): Promise<{ readonly html: string; readonly perVisitor: boolean; readonly kept: boolean }> {
  if (vite === undefined) throw new Error("vite did not start");
  if (p.around === true) process.env["VF_MOTORWAY_AROUND"] = "1";
  else delete process.env["VF_MOTORWAY_AROUND"];
  const mod = (await vite.ssrLoadModule(p.file)) as { default: Parameters<AstroContainer["renderToString"]>[0] };
  const locals: App.Locals = { nonce: "n", googleTag: undefined, clarityId: undefined, mapPlatform: "other" };
  const url = new URL(`${ORIGIN}${p.path}`);
  const html = await container.renderToString(mod.default, {
    params: p.params,
    request: new Request(url, { headers: { "accept-language": "de", "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", "x-forwarded-for": "66.249.66.1" } }),
    locals,
  });
  const perVisitor = locals.perVisitor === true;
  const kept = keepRendered({ method: "GET", url, mapPlatform: "other", cls: "search", perVisitor, status: 200, headers: new Headers({ "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }), cookie: false, raw: html, nonce: "n", flags: { hasScript: true, hasForm: false, clarityPage: false } });
  return { html, perVisitor, kept };
}
const replayed = (path: string): number => verifiedReplay({ method: "GET", url: new URL(`${ORIGIN}${path}`), mapPlatform: "other", cls: "search", response: new Response(null, { status: 503, headers: { [DEGRADED_HEADER]: "1" } }) }).response.status;

describe("#1205 review B1: a render that read the visitor is never held, even a verified crawler's own", () => {
  it("the station index with its near-IP panel: perVisitor, not held, not replayed; a search of it (no panel) is held", async () => {
    const r = await renderAndKeep({ name: "station index", file: STATION, params: { lang: "de" }, path: station });
    expect(r.html.length).toBeGreaterThan(1000);
    expect(r.perVisitor, "the near-IP rung ran").toBe(true);
    expect(r.kept).toBe(false);
    expect(replayed(station)).toBe(503);
    const q = await renderAndKeep({ name: "station search", file: STATION, params: { lang: "de" }, path: `${station}?q=koeln` });
    expect(q.perVisitor, "a search asks no near-IP panel").toBe(false);
    expect(q.kept).toBe(true);
    expect(replayed(`${station}?q=koeln`)).toBe(200);
  });

  it("the motorway page with its around block placed by the address: perVisitor, not held, not replayed; 'Ganz Deutschland' is held", async () => {
    const r = await renderAndKeep({ name: "motorway", file: MOTORWAY, params: { lang: "de", road: "a7" }, path: a7, around: true });
    expect(r.html.length).toBeGreaterThan(1000);
    expect(r.perVisitor, "the IP rung ran").toBe(true);
    expect(r.kept).toBe(false);
    expect(replayed(a7)).toBe(503);
    const de = await renderAndKeep({ name: "motorway, whole road", file: MOTORWAY, params: { lang: "de", road: "a7" }, path: `${a7}?scope=de`, around: true });
    expect(de.perVisitor, "the whole road looks nothing up").toBe(false);
    expect(de.kept).toBe(true);
  });

  it("the fuel board: perVisitor, and fuel is never held or replayed in any case", async () => {
    const path = pathFor("fuel", "de");
    const r = await renderAndKeep({ name: "fuel board", file: FUEL, params: { lang: "de" }, path });
    expect(r.html.length).toBeGreaterThan(1000);
    expect(r.perVisitor, "the board is decided by the user agent, the here-panel by the address").toBe(true);
    expect(r.kept).toBe(false);
    expect(replayed(path)).toBe(503);
  });
});
