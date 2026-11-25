/**
 * #1167 S1 (data-steward 2026-11-04, the station pages' ruling): NO LIST NAMES A FUEL STATION'S PAGE. A sitemap of every
 * `/<lang>/fuel/<slug>` is the "public list of all stations we hold" the MTS-K terms forbid, each slug spelling the
 * station's brand, town and street. So no served sitemap, no robots `Sitemap:` line and no `llms*.txt` names a fuel
 * station URL or a fuel sitemap, and `/sitemap-fuel*.xml` is no route (404).
 *
 * Every sitemap route FILE under `src/pages` is driven here — in every live language and, for a part file, its first
 * parts — against a loopback digest that answers EVERY station list (`/internal/<kind>/list`) with planted station
 * slugs, so a route that asked the fuel list would print fuel URLs and go red. No network beyond loopback, no provider.
 */
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { APIContext } from "astro";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LIVE_LANGS } from "../src/site/pages.js";
import { ALL_SITEMAPS } from "../src/site/sitemaps.js";
import { llmsFullTxt, llmsTxt, robotsTxt } from "../src/site/discovery.js";

const PAGES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "pages");
const PLANTED = ["aral-nuernberg-fuerther-str-abcdefghij", "shell-fulda-hauptstrasse-bcdefghijk"];
/** A fuel station page's address, in any language, absolute or not. */
const FUEL_URL = /\/[a-z]{2}\/fuel\/[a-z0-9-]+/u;

let digest: Server | undefined;
const asked: string[] = [];
const saved = process.env["DIGEST_URL"];

beforeAll(async () => {
  digest = createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://x");
    asked.push(u.pathname);
    if (/^\/internal\/(?:fuel|charging)\/list$/u.test(u.pathname)) {
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8", "energy-pages": String(PLANTED.length), "energy-parts": "1" });
      res.end(PLANTED.map((s) => `${s}\t2026-11-03\n`).join(""));
      return;
    }
    res.writeHead(404, { "content-type": "text/html; charset=utf-8" }).end("<p>no</p>");
  });
  await new Promise<void>((r) => digest!.listen(0, "127.0.0.1", () => r()));
  process.env["DIGEST_URL"] = `http://127.0.0.1:${String((digest.address() as AddressInfo).port)}`;
});

afterAll(async () => {
  await new Promise<void>((r) => (digest === undefined ? r() : digest.close(() => r())));
  if (saved === undefined) delete process.env["DIGEST_URL"];
  else process.env["DIGEST_URL"] = saved;
});

type Route = { readonly GET: (ctx: APIContext) => Response | Promise<Response> };

/** Every address a route file serves here: each live language, and parts 1–2 of a part file. */
function paramsOf(file: string): Record<string, string>[] {
  const langs = file.includes("[lang]") ? LIVE_LANGS.map((l) => ({ lang: l })) : [{}];
  return file.includes("[part]") ? langs.flatMap((p) => ["1", "2"].map((part) => ({ ...p, part }))) : langs;
}

describe("#1167 S1: no sitemap, robots line or llms*.txt names a fuel station's page", () => {
  const files = readdirSync(PAGES_DIR).filter((f) => /^sitemap.*\.xml\.ts$/u.test(f));

  it("reads the sitemap route files (a sweep of nothing would agree with anything); none is a fuel sitemap", () => {
    expect(files.length).toBeGreaterThanOrEqual(9); // #49 A: nine since the charging part files left
    // #49 A: the charging part files are retired too — no route lists an energy page
    expect(files.filter((f) => f.includes("charging"))).toEqual([]);
    expect(files.filter((f) => f.includes("fuel"))).toEqual([]);
    expect(ALL_SITEMAPS.filter((p) => p.includes("fuel"))).toEqual([]);
  });

  it("every sitemap every route file serves, in every language, names no fuel station URL and no fuel sitemap", async () => {
    const bodies: [string, string][] = [];
    for (const f of files) {
      const mod = (await import(join(PAGES_DIR, f))) as Route;
      for (const params of paramsOf(f)) {
        const res = await mod.GET({ params, request: new Request("https://viafrei.de/") } as unknown as APIContext);
        bodies.push([`${f} ${JSON.stringify(params)}`, await res.text()]);
      }
    }
    for (const [where, body] of bodies) {
      expect(body, where).not.toMatch(FUEL_URL);
      expect(body, where).not.toContain("sitemap-fuel");
      for (const s of PLANTED) expect(body.includes(`/fuel/${s}`), where).toBe(false);
    }
    // the sweep served every route file; #49 A: no body names a charging page or a charging sitemap either
    expect(bodies.length).toBeGreaterThanOrEqual(files.length);
    for (const [where, body] of bodies) expect(body, where).not.toMatch(/\/charging\/|sitemap-charging/u);
    // and nothing asked the digest for an energy list
    expect(asked.filter((p) => /^\/internal\/(?:fuel|charging)\//u.test(p))).toEqual([]);
  });

  it("robots.txt names no fuel sitemap; llms.txt and llms-full.txt name no fuel station URL", () => {
    const robots = robotsTxt();
    expect(robots).not.toContain("sitemap-charging"); // #49 A
    expect(robots).not.toContain("sitemap-fuel");
    for (const [name, txt] of [["llms.txt", llmsTxt()], ["llms-full.txt", llmsFullTxt()]] as const) {
      expect(txt.length, name).toBeGreaterThan(1000);
      expect(txt, name).not.toMatch(FUEL_URL);
      expect(txt, name).not.toContain("sitemap-fuel");
    }
  });
});
