/**
 * The road pages of #1027 against the BUILT shell and the REAL digest (`real-digest.ts`, whose road rows are read by the
 * digest's own `createRoadService` and rendered by its own `renderRoadPage`): the two examples llms.txt names answer
 * 200 in every language with the road's own title; the per-language roads sitemap lists exactly the indexable roads;
 * another spelling is a 301 and a road with no page the 404 page; and the two states the shell answers 503 for — the
 * digest holding no road, and the digest not answering — are each a 503 with a Retry-After, never an empty urlset.
 */
import type { ChildProcess } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { all, text as nodeText } from "@viafrei/design/testing";
import { LIVE_LANGS } from "../src/site/pages.js";
import { roadPath } from "../src/site/roads.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8927;
const BASE = `http://127.0.0.1:${String(PORT)}`;
const ENV = { IMPRESSUM_NAME: "Road Probe", IMPRESSUM_STREET: "Probeweg 9", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "road@example.invalid" };
let shell: ChildProcess;
let digest: Awaited<ReturnType<typeof startRealDigest>>;

beforeAll(async () => {
  digest = await startRealDigest();
  shell = await startShell(PORT, { DIGEST_URL: digest.url, ...ENV });
});
afterAll(async () => {
  shell?.kill();
  await digest?.close();
});

/** The road ids a roads sitemap lists in its language (`<loc>https://viafrei.de/<lang>/road/<id></loc>`). */
const sitemapIds = (xml: string, lang: string): string[] =>
  [...xml.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((m) => m[1]!).filter((u) => u.startsWith(`https://viafrei.de/${lang}/road/`)).map((u) => u.slice(`https://viafrei.de/${lang}/road/`.length));
const get = async (
  base: string,
  path: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; location: string | null; retry: string | null; degraded: string | null; cache: string | null; body: string }> => {
  const r = await fetch(`${base}${path}`, { redirect: "manual", headers });
  return { status: r.status, location: r.headers.get("location"), retry: r.headers.get("retry-after"), degraded: r.headers.get("x-vf-degraded"), cache: r.headers.get("cache-control"), body: await r.text() };
};

describe("a road page (#1027)", () => {
  for (const lang of LIVE_LANGS) {
    it(`${roadPath(lang, "b51")} and ${roadPath(lang, "nw/l249")}: 200, the road in the h1, indexable, the digest's fragment`, async () => {
      for (const [id, label] of [["b51", "B 51"], ["nw/l249", "L 249"]] as const) {
        const r = await get(BASE, roadPath(lang, id));
        expect(r.status, `${lang} ${id}`).toBe(200);
        const h1 = all(r.body, "h1").map(nodeText);
        expect(h1, `${lang} ${id}`).toHaveLength(1);
        expect(h1[0], `${lang} ${id}`).toContain(label);
        expect(all(r.body, "section.roadpage").length, `${lang} ${id}`).toBe(1);
        expect(r.body, `${lang} ${id}`).not.toMatch(/<meta name="robots" content="noindex/u);
        expect(all(r.body, `link[rel="canonical"][href="https://viafrei.de${roadPath(lang, id)}"]`).length, `${lang} ${id}`).toBe(1);
      }
    });
  }
  it("another spelling is a 301 to the canonical address; a K road and an unknown Land are the 404 page", async () => {
    expect(await get(BASE, "/de/road/B51").then((r) => [r.status, r.location])).toEqual([301, "/de/road/b51"]);
    expect(await get(BASE, "/en/road/NW/L249").then((r) => [r.status, r.location])).toEqual([301, "/en/road/nw/l249"]);
    for (const p of ["/de/road/k12", "/de/road/xx/l249", "/en/road/l249"]) expect((await get(BASE, p)).status, p).toBe(404);
  });
});

describe("the roads sitemaps (#1027)", () => {
  it("each language's file lists exactly the fixture's indexable roads, each with its lastmod", async () => {
    for (const lang of LIVE_LANGS) {
      const r = await get(BASE, `/sitemap-roads-${lang}.xml`);
      expect(r.status, lang).toBe(200);
      expect(sitemapIds(r.body, lang), lang).toEqual(["b51", "nw/l249"]);
      expect(r.body.match(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/gu)?.length, lang).toBe(2);
    }
    expect((await get(BASE, "/sitemap-roads-xx.xml")).status).toBe(404);
  });

  for (const state of ["empty", "down"] as const) {
    it(`a digest whose road read is ${state}: the sitemaps answer 503 with a Retry-After, never an empty urlset`, async () => {
      const d = await startRealDigest({ roads: state });
      const port = PORT + (state === "empty" ? 1 : 2);
      const s = await startShell(port, { DIGEST_URL: d.url, ...ENV });
      const base = `http://127.0.0.1:${String(port)}`;
      try {
        for (const lang of ["de", "en"] as const) {
          const r = await get(base, `/sitemap-roads-${lang}.xml`);
          expect([r.status, r.retry, r.body], lang).toEqual([503, "300", ""]);
        }
        // the page: a road with nothing on it is a noindex page; a digest that does not answer is, since #1205
        // (lib/degraded.ts), a person's degraded 200 — noindex, no-store, reloading itself — and a crawler's 503
        const page = await get(base, roadPath("de", "b51"));
        if (state === "empty") {
          expect(page.status).toBe(200);
          expect(page.body).toMatch(/<meta name="robots" content="noindex, follow"/u);
        } else {
          expect([page.status, page.retry, page.degraded, page.cache]).toEqual([200, null, "1", "no-store"]);
          expect(page.body).toMatch(/<meta name="robots" content="noindex">/u);
          expect(page.body).toMatch(/<meta http-equiv="refresh" content="5;url=\/de\/road\/b51\?vf_wait=1">/u);
          expect(all(page.body, "section.roadpage")).toHaveLength(0);
          const bot = await get(base, roadPath("de", "b51"), { "x-vf-agent-class": "crawler" });
          expect([bot.status, bot.retry, bot.degraded, bot.body]).toEqual([503, "60", "1", ""]);
        }
      } finally {
        s.kill();
        await d.close();
      }
    });
  }
});
