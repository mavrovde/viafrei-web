/**
 * #1111: the search page and the header's box as rendered — Astro's container over the e2e fixture digest (loopback,
 * no database, no network), every live language: `noindex, follow`, one canonical to itself, what was typed in the
 * header's one field (#1153), the groups as plain links (the empty state is `site-search-1111.test.ts`'s: the fixture digest's place reader answers
 * every query); and the header's box (`role="search"`, a combobox) on a
 * page of the map.
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
import { LIVE_LANGS, pathFor, type Lang } from "../src/site/pages.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SEARCH = "/src/pages/[lang]/search.astro";
const CONNECT = "/src/pages/[lang]/connect.astro";
let digest: Awaited<ReturnType<typeof startRealDigest>> | undefined;
let vite: ViteDevServer | undefined;
let container: AstroContainer;
const saved = process.env["DIGEST_URL"];

beforeAll(async () => {
  digest = await startRealDigest();
  process.env["DIGEST_URL"] = digest.url;
  const config = await (getViteConfig({}, { root: ROOT, logLevel: "error" }) as (e: { mode: string; command: "serve" | "build" }) => Promise<Record<string, unknown>>)({ mode: "test", command: "serve" });
  vite = await createServer({ ...config, configFile: false, root: ROOT, logLevel: "error", server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  container = await AstroContainer.create();
  for (const f of [SEARCH, CONNECT]) await vite.ssrLoadModule(f);
}, 30_000);

afterAll(async () => {
  await vite?.close();
  await digest?.close();
  if (saved === undefined) delete process.env["DIGEST_URL"];
  else process.env["DIGEST_URL"] = saved;
});

async function render(file: string, lang: Lang, url: string): Promise<string> {
  const mod = (await vite!.ssrLoadModule(file)) as { default: Parameters<AstroContainer["renderToString"]>[0] };
  return container.renderToString(mod.default, {
    params: { lang },
    request: new Request(url, { headers: { "accept-language": lang, "user-agent": "Mozilla/5.0" } }),
    locals: { nonce: "n", googleTag: undefined, clarityId: undefined, mapPlatform: "other" },
  });
}

describe("#1111 the search page, every language", () => {
  for (const lang of LIVE_LANGS) {
    it(lang, async () => {
      const url = `${SITE_ORIGIN}/${lang}/search`;
      const found = await render(SEARCH, lang, `${url}?q=A7`);
      expect(all(found, 'meta[name="robots"]').map((e) => e.attrs.content), lang).toEqual(["noindex, follow"]);
      expect(all(found, 'link[rel="canonical"]').map((e) => e.attrs.href), lang).toEqual([url]);
      // #1153: what was typed stands in the header's ONE search field; the page carries no second form
      expect(all(found, "header input#place-hq").map((e) => e.attrs.value), lang).toEqual(["A7"]);
      expect(all(found, 'form[role="search"]').length, lang).toBe(1);
      expect(all(found, 'header form[role="search"]').length, lang).toBe(1);
      const links = all(found, ".search-page__results a").map((e) => String(e.attrs.href));
      expect(links, lang).toContain(`/${lang}/autobahn/a7`);
      expect(all(found, "h1").map(nodeText).join(" "), lang).toContain(t(lang, "search.title"));
      // no GA/Clarity on a dynamic, unmeasured page
      expect(found, lang).not.toMatch(/googletagmanager|clarity\.ms/);

      const bare = await render(SEARCH, lang, url);
      expect(all(bare, ".search-page__results *").length, lang).toBe(0);
    });
  }
});

describe("#1111 the header's box on a page of the map", () => {
  for (const lang of ["de", "en", "tr"] as const) {
    it(lang, async () => {
      const html = await render(CONNECT, lang, `${SITE_ORIGIN}${pathFor("connect", lang)}`);
      // #1153: the header's one search — the place bar's field, a GET form to the search page, no button
      const form = all(html, 'header form#place-head[role="search"]');
      expect(form.map((e) => [e.attrs.action, e.attrs.method]), lang).toEqual([[`/${lang}/search`, "get"]]);
      const input = all(html, 'header input#place-hq[role="combobox"]');
      expect(input.map((e) => [e.attrs.name, e.attrs["aria-controls"], e.attrs.minlength, e.attrs.maxlength]), lang).toEqual([["q", "place-hresults", "2", "60"]]);
      expect(all(html, "#place-hresults").length, lang).toBe(1);
      expect(all(html, "header form#place-head button").length, lang).toBe(0);
    });
  }
});
