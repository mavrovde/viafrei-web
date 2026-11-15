/**
 * #1027 on the RENDERED page, in every live language, through Astro's container: a Bundesstraße's page and a
 * Landesstraße's page carry their title and h1, a self-canonical on the English route word with the language token,
 * an alternate per language, the register line of every entry verbatim, where / when / a map link, the "Weiter" row of
 * #1110 item 3 (a road link and the AI link with a prefilled question), and no robots directive while something is in
 * force. A road with nothing in force and nothing ended this week is `noindex, follow`.
 *
 * The digest is a loopback stub (no database, no network) answering `/internal/road/<id>` with the digest's OWN
 * renderer over the digest's own analysis — the same bytes the route sends (`packages/digest/src/server/app.ts`) — so
 * the shared browser fixture `e2e/real-digest.ts` is not touched.
 */
import { createServer as createHttpServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { getViteConfig } from "astro/config";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { all, text as nodeText } from "@viafrei/design/testing";
import { roadRefOfId, type RoadRef } from "../../../.pinned/app/packages/ingest/dist/domain/roads/road-ref.js";
import { renderRoadPage } from "../../../.pinned/app/packages/digest/dist/src/presentation/road-page-html.js";
import { roadPageOf, roadPageSources } from "../../../.pinned/app/packages/digest/dist/src/analysis/road-page.js";
import { ROAD_AT, roadRow } from "./digest-support/road-service.test.support.js";
import { SITE_ORIGIN } from "../src/site/endpoints.js";
import { LIVE_LANGS, type Lang } from "../src/site/pages.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const FILE = "/src/pages/[lang]/road/[...rest].astro";
const CONNECT = "/src/pages/[lang]/connect.astro";
const SOURCES = roadPageSources();
const B51 = roadRefOfId("b51") as RoadRef;
const L249 = roadRefOfId("nw/l249") as RoadRef;
const L249_ROW = roadRow({ road_number: "L 249", publication_id: "pub-l249", place_text: "Ortsdurchfahrt Telgte", detail_text: "Kanalbau" });

/** The page each id answers: the B 51 with two sources on one entry, the L 249, and a quiet B 52. */
function pageFor(id: string, lang: Lang): string | null {
  if (id === "b51") return renderRoadPage(lang, roadPageOf(B51, [roadRow(), roadRow({ feed_key: "traffic_bw" })], SOURCES, ROAD_AT, 40));
  if (id === "nw/l249") return renderRoadPage(lang, roadPageOf(L249, [L249_ROW], SOURCES, ROAD_AT, 40));
  if (id === "b52") return renderRoadPage(lang, roadPageOf(roadRefOfId("b52") as RoadRef, [], SOURCES, ROAD_AT, 40));
  return null;
}

let digest: Server | undefined;
let vite: ViteDevServer | undefined;
let container: AstroContainer;
const saved = process.env["DIGEST_URL"];

beforeAll(async () => {
  digest = createHttpServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://x");
    const id = u.pathname.replace(/^\/internal\/road\//u, "");
    const html = u.pathname.startsWith("/internal/road/") ? pageFor(id, (u.searchParams.get("lang") ?? "de") as Lang) : null;
    if (html === null) {
      res.writeHead(404, { "content-type": "text/html; charset=utf-8" }).end("<p>no</p>");
      return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(html);
  });
  await new Promise<void>((r) => digest!.listen(0, "127.0.0.1", () => r()));
  process.env["DIGEST_URL"] = `http://127.0.0.1:${String((digest.address() as AddressInfo).port)}`;
  const config = await (getViteConfig({}, { root: ROOT, logLevel: "error" }) as (e: { mode: string; command: "serve" | "build" }) => Promise<Record<string, unknown>>)({ mode: "test", command: "serve" });
  vite = await createServer({ ...config, configFile: false, root: ROOT, logLevel: "error", server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  container = await AstroContainer.create();
  await vite.ssrLoadModule(FILE);
  await vite.ssrLoadModule(CONNECT);
}, 30_000);

afterAll(async () => {
  await vite?.close();
  await new Promise<void>((r) => (digest === undefined ? r() : digest.close(() => r())));
  if (saved === undefined) delete process.env["DIGEST_URL"];
  else process.env["DIGEST_URL"] = saved;
});

const render = async (file: string, params: Record<string, string>, url: string, lang: Lang): Promise<string> => {
  const mod = (await vite!.ssrLoadModule(file)) as { default: Parameters<AstroContainer["renderToString"]>[0] };
  return container.renderToString(mod.default, {
    params,
    request: new Request(url, { headers: { "accept-language": lang, "user-agent": "Mozilla/5.0" } }),
    locals: { nonce: "n", googleTag: undefined, clarityId: undefined, mapPlatform: "other" },
  });
};
const amp = (s: string): string => s.replaceAll("&amp;", "&");
const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

describe("#1027: a road page, rendered, in every language", () => {
  for (const lang of LIVE_LANGS) {
    it(`${lang}: the B 51 and the L 249 in NRW`, async () => {
      for (const [id, label] of [["b51", "B 51"], ["nw/l249", "L 249"]] as const) {
        const path = `/${lang}/road/${id}`;
        const html = await render(FILE, { lang, rest: id }, `${SITE_ORIGIN}${path}`, lang);
        const what = `${lang} ${id}`;
        // the head: its own title naming the road, one self-canonical, an alternate per language, no robots directive
        const title = all(html, "title").map(nodeText).join("");
        expect(title, what).toContain(label);
        expect(all(html, "h1").map(nodeText).join(""), what).toContain(label);
        expect(all(html, `link[rel="canonical"][href="${SITE_ORIGIN}${path}"]`).length, what).toBe(1);
        for (const l of LIVE_LANGS) expect(all(html, `link[rel="alternate"][hreflang="${l}"][href="${SITE_ORIGIN}/${l}/road/${id}"]`).length, `${what} → ${l}`).toBe(1);
        expect(all(html, 'meta[name="robots"]').length, what).toBe(0);
        // the shell stripped the digest's head attributes
        expect(html, what).not.toMatch(/<section class="roadpage"[^>]*\sdata-/u);
        // every entry: where (a place link in this language), a map link, and its register line verbatim
        const items = all(html, "li.roadpage__item");
        expect(items.length, what).toBe(1);
        expect(html, what).toContain(`href="/${lang}/place/`);
        const page = id === "b51" ? roadPageOf(B51, [roadRow(), roadRow({ feed_key: "traffic_bw" })], SOURCES, ROAD_AT, 40) : roadPageOf(L249, [L249_ROW], SOURCES, ROAD_AT, 40);
        expect(page.items[0]!.attributions.length, what).toBeGreaterThanOrEqual(1);
        for (const a of page.items[0]!.attributions) expect(html, `${what}: ${a.text}`).toContain(esc(a.text));
        // the publisher's own words are on the German page only
        if (lang === "de") expect(html, what).toContain(id === "b51" ? "Fahrbahnerneuerung" : "Kanalbau");
        else expect(html, what).not.toContain(id === "b51" ? "Fahrbahnerneuerung" : "Kanalbau");
        // #1110 item 3: the Weiter row — at least one road link and the AI link, whose connect page prefills a question
        expect(all(html, "nav.next-step").length, what).toBe(1);
        const links = all(html, "nav.next-step a").map((e) => amp(String(e.attrs.href)));
        expect(links.filter((h) => h.startsWith(`/${lang}/autobahn`)).length, `${what}: a road link`).toBeGreaterThanOrEqual(1);
        const ask = links.find((h) => h.startsWith(`/${lang}/connect?`));
        expect(ask, `${what}: the AI link`).toBeDefined();
        const connect = await render(CONNECT, { lang }, `${SITE_ORIGIN}${ask!}`, lang);
        expect(all(connect, ".connect-about .ask__text").map(nodeText).join(" "), what).toContain("Münster");
      }
    }, 20_000);
  }

  it("a road with nothing in force and nothing ended this week is noindex, follow; the page still renders", async () => {
    const html = await render(FILE, { lang: "de", rest: "b52" }, `${SITE_ORIGIN}/de/road/b52`, "de");
    expect(all(html, 'meta[name="robots"][content="noindex, follow"]').length).toBe(1);
    expect(all(html, "h1").map(nodeText).join("")).toContain("B 52");
  });
});
