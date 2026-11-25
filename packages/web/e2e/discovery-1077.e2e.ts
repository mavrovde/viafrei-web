/**
 * #1077 against the BUILT shell and the REAL digest (`real-digest.ts`, a fixture snapshot, no database, no network):
 * the AI-facing files as a crawler gets them.
 *
 *   - llms.txt and llms-full.txt name every page family with an English and a German example, and each example
 *     address answers 200 here (a family line pointing at a page that does not render is no line) — but the two whose
 *     example the fixture does not hold, which must reach their route (`NOT_IN_FIXTURE`);
 *   - robots.txt's every `Sitemap:` answers 200 with a sitemap document — every per-language file in every live
 *     language — and every group carries the `/fragment/` line;
 *   - the server card served on viafrei.de names the tools llms.txt names, which are the catalogue's.
 */
import type { ChildProcess } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import catalogue from "../src/generated/catalogue.json" with { type: "json" };
import { FRAGMENT_DISALLOW, PAGE_FAMILIES } from "../src/site/discovery.js";
import { SITE_ORIGIN } from "../src/site/endpoints.js";
import { LIVE_LANGS } from "../src/site/pages.js";
import { ALL_SITEMAPS } from "../src/site/sitemaps.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8877;
const BASE = `http://127.0.0.1:${String(PORT)}`;
let shell: ChildProcess;
let digest: Awaited<ReturnType<typeof startRealDigest>>;

beforeAll(async () => {
  digest = await startRealDigest();
  shell = await startShell(PORT, { DIGEST_URL: digest.url, IMPRESSUM_NAME: "Llms Probe", IMPRESSUM_STREET: "Probeweg 7", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "llms@example.invalid" });
});
afterAll(async () => {
  shell?.kill();
  await digest?.close();
});

const get = async (path: string): Promise<{ status: number; body: string; type: string | null }> => {
  const r = await fetch(`${BASE}${path}`, { redirect: "manual" });
  return { status: r.status, body: await r.text(), type: r.headers.get("content-type") };
};
/**
 * The families whose example is a junction and a stretch of the A7 that exist on production (read 2026-11-01, and
 * answering 200 there on 2026-11-03) but not in the digest fixture, whose A7 holds neither: here their address is
 * asserted to reach the motorway route, which answers a stretch it does not hold with a 301 to the road's own page.
 */
const NOT_IN_FIXTURE: Readonly<Record<string, string>> = {
  "A stretch of a motorway": "nesselwang-to-kempten is a stretch of production's A7, not of the fixture's",
  "A motorway junction": "exit-138-nesselwang is a junction of production's A7, not of the fixture's",
};
const section = (txt: string, h: string): string[] => {
  const lines = txt.split("\n");
  const i = lines.findIndex((l) => l.startsWith(`## ${h}`));
  if (i < 0) return [];
  const end = lines.findIndex((l, k) => k > i && l.startsWith("## "));
  return lines.slice(i + 1, end < 0 ? undefined : end).filter((l) => l !== "");
};

describe("#1077 (1) the served llms files: every family, an English and a German example, each a page that renders", () => {
  for (const file of ["/llms.txt", "/llms-full.txt"]) {
    it(`${file}: one line per family, both examples, each answering 200 here`, async () => {
      const r = await get(file);
      expect(r.status).toBe(200);
      const lines = section(r.body, "Page families");
      expect(lines).toHaveLength(PAGE_FAMILIES.length);
      for (const [i, f] of PAGE_FAMILIES.entries()) {
        for (const l of ["en", "de"] as const) {
          const path = f.example(l);
          expect(lines[i], `${f.name} ${l}`).toContain(`${SITE_ORIGIN}${path}`);
          const r = await fetch(`${BASE}${path}`, { redirect: "manual" });
          if (f.name in NOT_IN_FIXTURE) {
            // the route read the road and fell back to its page — never the index, never a 404 (`[...rest].astro`)
            expect(r.status, `${f.name} ${l}: ${path}`).toBe(301);
            expect(r.headers.get("location"), `${f.name} ${l}: ${path}`).toBe(path.split("/").slice(0, 4).join("/"));
          } else expect(r.status, `${f.name} ${l}: ${path}`).toBe(200);
        }
      }
      expect(Object.keys(NOT_IN_FIXTURE).filter((n) => !PAGE_FAMILIES.some((f) => f.name === n))).toEqual([]);
    });
  }
});

describe("#1077 (4) the served robots.txt: every sitemap answers, in every live language", () => {
  it("every Sitemap line is one of ALL_SITEMAPS, every per-language file is there for every language, and each answers a sitemap", async () => {
    const r = await get("/robots.txt");
    expect(r.status).toBe(200);
    const named = r.body.split("\n").filter((l) => l.startsWith("Sitemap: ")).map((l) => l.slice("Sitemap: ".length));
    expect([...named].sort()).toEqual(ALL_SITEMAPS.map((p) => `${SITE_ORIGIN}${p}`).sort());
    // #49: de and en only — every other language has no sitemap
    for (const l of LIVE_LANGS) for (const kind of ["places", "motorways", "exits", "stations"]) expect(named.includes(`${SITE_ORIGIN}/sitemap-${kind}-${l}.xml`), `${kind} ${l}`).toBe(l === "de" || l === "en");
    for (const u of named) {
      const s = await get(new URL(u).pathname);
      expect(s.status, u).toBe(200);
      expect(s.type ?? "", u).toMatch(/xml/u);
      expect(s.body, u).toMatch(/<(urlset|sitemapindex) xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/u);
    }
  });
  it("every group carries the /fragment/ line, and the file points at llms.txt", async () => {
    const body = (await get("/robots.txt")).body;
    const groups = body.split(/\n\n+/u).filter((g) => g.startsWith("User-agent:"));
    expect(groups.length).toBeGreaterThan(40);
    for (const g of groups) expect(g.split("\n"), g.split("\n")[0]).toContain(`Disallow: ${FRAGMENT_DISALLOW}`);
    expect(body.split("\n")[0]).toContain(`${SITE_ORIGIN}/llms.txt`);
  });
});

describe("#1077 (5) the served card and llms.txt name the same tools, the catalogue's", () => {
  it("the card's de.viafrei/tools are the catalogue's tools, and llms.txt lists exactly those", async () => {
    const card = JSON.parse((await get("/.well-known/mcp/server-card.json")).body) as { version: string; _meta: Record<string, unknown> };
    const tools = card._meta["de.viafrei/tools"] as { name: string; title: string }[];
    expect(tools).toEqual(catalogue.tools.map((x) => ({ name: x.name, title: x.title })));
    expect(card.version).toBe(catalogue.release.version);
    const llms = (await get("/llms.txt")).body;
    const listed = section(llms, "Tools (").join(" ").match(/`[a-z_]+`/gu)?.map((x) => x.slice(1, -1)) ?? [];
    expect(listed).toEqual(tools.map((x) => x.name));
  });
});
