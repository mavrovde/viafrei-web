/**
 * #1103: a page's own inline `<style>` is styled whether or not the page carries a script.
 *
 * The station, motorway and catalogue layouts carry their page CSS as ONE inline `<style>` (`layouts/*.astro`).
 * Until 2.5.0 the no-script policy said `style-src 'self'`, so such a page WITHOUT a script lost its CSS (the station
 * catalogue rendered with browser defaults until 2.4.6 gave it a script by accident). The rule now: every page's
 * policy names the request's nonce in `style-src`, and the middleware writes it on every page (`security/csp.ts`
 * `noScriptPolicy`).
 *
 * The inventory is taken from the BUILT shell without a tag (production carries a tag, so every page there already
 * uses the nonce policy): every page of the route map (`scripts/site-pages.txt`) and the dynamic families the stand-in
 * digest answers (station catalogue, a station, the motorway index, a motorway), in every live language. Each page
 * that ships an inline `<style>` is loaded in Chromium and must log no CSP violation and carry the header's nonce on
 * its `<style>`. Until 2.5.2 only the script-less ones were loaded; since #1111 every page but the fuel board carries
 * the header search's script, so no page with an inline `<style>` is script-less any more and that filter selected
 * nothing — a suite over no page. Every such page is loaded now, with or without a script, and a script-less one
 * appearing again is still among them. A page with a `style=` attribute anywhere fails outright (a nonce does not
 * cover an attribute). Run in the pinned Linux image (laptop results are not evidence).
 */
import type { ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startShell } from "./server.js";
import { startStubDigest } from "./stub-digest.js";
import { LIVE_LANGS } from "../src/site/pages.js";

const PORT = 8961;
const BASE = `http://127.0.0.1:${String(PORT)}`;
const HERE = dirname(fileURLToPath(import.meta.url));
let browser: Browser;
let shell: ChildProcess;
let digest: Awaited<ReturnType<typeof startStubDigest>>;

/** The route map's pages (not its redirects, not its identity files), and four dynamic families per language. */
function paths(): string[] {
  const map = readFileSync(join(HERE, "..", "..", "..", "scripts", "site-pages.txt"), "utf8")
    .split("\n")
    .filter((l) => l !== "" && !l.startsWith("#"))
    .map((l) => l.trim().split(/\s+/))
    .filter((c) => c[3] === "page")
    .map((c) => c[0]!);
  const dynamic = LIVE_LANGS.flatMap((l) => [`/${l}/station`, `/${l}/station/koeln-hbf`, `/${l}/autobahn`, `/${l}/autobahn/a7`]);
  return [...new Set([...map, ...dynamic])];
}

type Seen = { readonly path: string; readonly status: number; readonly csp: string; readonly styles: number; readonly scripts: number; readonly styleAttrs: number };
const inventory: Seen[] = [];

beforeAll(async () => {
  digest = await startStubDigest({}, 5000, { fullCards: true });
  shell = await startShell(PORT, { DIGEST_URL: digest.url, WEB_TILE_TIMEOUT_MS: "2000" });
  browser = await chromium.launch();
  for (const path of paths()) {
    const r = await fetch(`${BASE}${path}`, { redirect: "manual" });
    const html = await r.text();
    inventory.push({
      path,
      status: r.status,
      csp: r.headers.get("content-security-policy") ?? "",
      styles: (html.match(/<style\b/g) ?? []).length,
      scripts: (html.match(/<script\b(?![^>]*type="application\/ld\+json")/g) ?? []).length,
      styleAttrs: (html.match(/<[a-z][^>]*\sstyle="/gi) ?? []).length,
    });
  }
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
});

const exposed = (): Seen[] => inventory.filter((s) => s.status === 200 && s.styles > 0);

describe("#1103: the inventory, from the built shell without a tag", () => {
  it("read the whole route map and the dynamic families, and found pages with an inline <style> in every language (else this suite proves nothing)", () => {
    expect(inventory.length).toBeGreaterThan(200);
    for (const lang of LIVE_LANGS) expect(exposed().filter((s) => s.path.startsWith(`/${lang}/`)).length, lang).toBeGreaterThan(0);
  });
  it("no page carries a style= attribute (a nonce does not cover one)", () => {
    expect(inventory.filter((s) => s.styleAttrs > 0).map((s) => s.path)).toEqual([]);
  });
  it("every script-less page's policy refuses scripts and names the nonce in style-src", () => {
    for (const s of inventory.filter((x) => x.status === 200 && x.scripts === 0 && x.csp !== "")) {
      expect(s.csp, s.path).toContain("script-src 'none'");
      expect(s.csp, s.path).toMatch(/style-src 'self' 'nonce-[A-Za-z0-9_-]{16,}';/);
    }
  });
});

describe("#1103: each page with an inline <style>, in a real browser", () => {
  for (const lang of LIVE_LANGS) {
    it(`${lang}: no CSP violation, and the <style> carries the header's nonce`, async () => {
      const mine = exposed().filter((s) => s.path === `/${lang}` || s.path.startsWith(`/${lang}/`));
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      ctx.setDefaultTimeout(2000);
      for (const s of mine) {
        const page = await ctx.newPage();
        const violations: string[] = [];
        page.on("console", (m) => {
          if (/Content.Security.Policy|Refused to/i.test(m.text())) violations.push(m.text());
        });
        const res = await page.goto(`${BASE}${s.path}`, { waitUntil: "load" });
        const nonce = /style-src 'self' 'nonce-([A-Za-z0-9_-]+)'/.exec(res?.headers()["content-security-policy"] ?? "")?.[1] ?? "";
        expect(nonce.length, s.path).toBeGreaterThanOrEqual(16);
        expect(await page.$$eval("style", (els) => els.map((e) => e.nonce)), s.path).toEqual(Array(s.styles).fill(nonce));
        expect(violations, s.path).toEqual([]);
        await page.close();
      }
      await ctx.close();
    });
  }
});
