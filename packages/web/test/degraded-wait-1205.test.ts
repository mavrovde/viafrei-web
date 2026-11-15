/**
 * #1205 review N5: the degraded page's reload counter (`?vf_wait=N`) leaves the address once the reload succeeded —
 * the real page, rendered at that address, carries a script that takes it out with `history.replaceState` — and the
 * canonical never carries it. The real page components are compiled by Astro's Vite plugin over the e2e fixture's real
 * digest (loopback, no database, no network), as in `consent-settings-1185.test.ts`.
 */
import { runInNewContext } from "node:vm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { createServer, type ViteDevServer } from "vite";
import { getViteConfig } from "astro/config";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { startRealDigest } from "../e2e/real-digest.js";
import { pathFor } from "../src/site/pages.js";
import { placePath } from "../src/site/places.js";
import { DEGRADED_WAIT_PARAM, DROP_WAIT_SCRIPT } from "../src/lib/degraded.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ORIGIN = "https://viafrei.de";
let digest: Awaited<ReturnType<typeof startRealDigest>> | undefined;
let vite: ViteDevServer | undefined;
let container: AstroContainer;
const saved = process.env["DIGEST_URL"];

type Page = { readonly name: string; readonly file: string; readonly params: Record<string, string>; readonly path: string };
const PAGES: readonly Page[] = [
  { name: "place page", file: "/src/pages/[lang]/place/[slug].astro", params: { lang: "de", slug: "koeln" }, path: placePath("de", "koeln") },
  { name: "connect page", file: "/src/pages/[lang]/connect.astro", params: { lang: "en" }, path: pathFor("connect", "en") },
];

beforeAll(async () => {
  digest = await startRealDigest();
  process.env["DIGEST_URL"] = digest.url;
  const config = await (getViteConfig({}, { root: ROOT, logLevel: "error" }) as (e: { mode: string; command: "serve" | "build" }) => Promise<Record<string, unknown>>)({ mode: "test", command: "serve" });
  vite = await createServer({ ...config, configFile: false, root: ROOT, logLevel: "error", server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  container = await AstroContainer.create();
  const svelte = (await vite.ssrLoadModule("@astrojs/svelte/server.js")) as { default: Parameters<AstroContainer["addServerRenderer"]>[0] extends { renderer: infer R } ? R : never };
  container.addServerRenderer({ name: "@astrojs/svelte", renderer: svelte.default });
  container.addClientRenderer({ name: "@astrojs/svelte", entrypoint: "@astrojs/svelte/client.js" });
  for (const p of PAGES) await vite.ssrLoadModule(p.file);
});

afterAll(async () => {
  await vite?.close();
  await digest?.close();
  if (saved === undefined) delete process.env["DIGEST_URL"];
  else process.env["DIGEST_URL"] = saved;
});

async function render(p: Page, query: string): Promise<string> {
  if (vite === undefined) throw new Error("vite did not start");
  const mod = (await vite.ssrLoadModule(p.file)) as { default: Parameters<AstroContainer["renderToString"]>[0] };
  return container.renderToString(mod.default, {
    params: p.params,
    request: new Request(`${ORIGIN}${p.path}${query}`, { headers: { "accept-language": "de", "user-agent": "Mozilla/5.0" } }),
    locals: { nonce: "n", googleTag: undefined, clarityId: undefined, mapPlatform: "other" },
  });
}

const canonical = (html: string): string | undefined => /<link rel="canonical" href="([^"]*)"/u.exec(html)?.[1];

/** Run the script against a planted `location` and `history`; the address it leaves, or null when it changed nothing. */
function replaced(href: string): string | null {
  let to: string | null = null;
  runInNewContext(DROP_WAIT_SCRIPT, { URL, location: { href }, history: { state: { k: 1 }, replaceState: (_s: unknown, _t: string, u: string) => (to = u) } });
  return to;
}

describe("#1205 review N5: the reload counter leaves the address once the page renders", () => {
  for (const p of PAGES) {
    it(`${p.name}: at ?${DEGRADED_WAIT_PARAM}=3 the page carries the script and its canonical is the bare path; without it, no script`, async () => {
      const waited = await render(p, `?${DEGRADED_WAIT_PARAM}=3`);
      expect(canonical(waited), "the canonical never carries the counter").toBe(`${ORIGIN}${p.path}`);
      expect(waited).toContain(DROP_WAIT_SCRIPT);
      const plain = await render(p, "");
      expect(canonical(plain)).toBe(`${ORIGIN}${p.path}`);
      expect(plain.includes(DROP_WAIT_SCRIPT), "a page without the counter runs no extra script").toBe(false);
    });
  }

  it("the script takes out the counter alone and keeps every other part of the address", () => {
    expect(replaced("https://viafrei.de/de/place/koeln?vf_wait=4")).toBe("/de/place/koeln");
    expect(replaced("https://viafrei.de/de/place/koeln?r=a1&vf_wait=2#cards")).toBe("/de/place/koeln?r=a1#cards");
    expect(replaced("https://viafrei.de/de/place/koeln?r=a1"), "nothing to drop: the history is not touched").toBeNull();
  });
});
