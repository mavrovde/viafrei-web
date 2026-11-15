/**
 * #1198: a place the visitor chose and the browser keeps ("Düsseldorf") is what the header's pill names on every page
 * that runs the location island — never a name an answer gave its cards. On a motorway page the "around you" answer
 * names its stretch by the nearest junction's town, and the pill said "A5 · Butzbach" / "A7 · Homberg (Efze)" for a
 * remembered Alsdorf (owner 2026-11-06). The one rule is at the top of `setPill` in `location/island.ts`.
 *
 * Also here: the first asks of a place's cards on a page load are never a 404 the island and the filler take as final
 * when the digest's read failed (`lib/fragment-route.ts`: only "no such place" is the 404) — the two 404s on
 * POST /fragment/place of the first /en load.
 *
 * Every page kind: home, place, station, motorway, motorway exit, road, the fuel board, a fuel station, news, connect.
 * The fuel board ran no script from v1.8.18; since #1198 (owner 2026-11-06, "add the place script") it carries the
 * header's place script under the page's nonce, with no analytics, so its pill names the kept place too.
 * Chromium (owner 2026-11-06: Chromium first). Run in the pinned Linux image (`e2e-arm.sh`); every wait ≤ 2 s.
 */
import type { ChildProcess } from "node:child_process";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pathFor } from "../src/site/pages.js";
import { placePath } from "../src/site/places.js";
import { stationPath } from "../src/site/stations.js";
import { AUTOHOF_FUEL_SLUG } from "./energy-autohof.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8977;
const ID = { IMPRESSUM_NAME: "Fold Probe", IMPRESSUM_STREET: "Probeweg 5", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "fold@example.invalid" };
const THIRD_PARTY = /googletagmanager\.com|google-analytics\.com|clarity\.ms/u;
const KEPT = { at: "ags:05111000", how: "manual", label: "Düsseldorf" };
const base = `http://127.0.0.1:${String(PORT)}`;

let browser: Browser;
let digest: Awaited<ReturnType<typeof startRealDigest>>;
let shell: ChildProcess;

beforeAll(async () => {
  digest = await startRealDigest({});
  shell = await startShell(PORT, { ...ID, DIGEST_URL: digest.url, VF_MOTORWAY_AROUND: "1" });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
});

type Lang = "de" | "en";
type Kind = "home" | "place" | "station" | "motorway" | "exit" | "road" | "fuel" | "fuel-station" | "news" | "connect";
const KINDS: readonly Kind[] = ["home", "place", "station", "motorway", "exit", "road", "fuel", "fuel-station", "news", "connect"];

async function exitPath(lang: Lang): Promise<string> {
  const a7 = await (await fetch(`${base}/${lang}/autobahn/a7`)).text();
  const href = /<a href="(a7\/exit-[a-z0-9-]+)"/u.exec(a7)?.[1];
  if (href === undefined) throw new Error("the A7 names no junction");
  return `/${lang}/autobahn/${href}`;
}
async function pathOf(kind: Kind, lang: Lang): Promise<string> {
  switch (kind) {
    case "home": return `/${lang}`;
    case "place": return placePath(lang, "koeln");
    case "station": return stationPath(lang, "koeln-hbf");
    case "motorway": return `/${lang}/autobahn/a7`;
    case "exit": return exitPath(lang);
    case "road": return `/${lang}/road/l249`;
    case "fuel": return pathFor("fuel", lang);
    case "fuel-station": return `/${lang}/fuel/${AUTOHOF_FUEL_SLUG}`;
    case "news": return pathFor("news", lang);
    case "connect": return pathFor("connect", lang);
  }
}

describe("the pill names the place the visitor kept, on every page kind (#1198)", () => {
  const measured: Record<string, unknown> = {};
  afterAll(() => console.log(`place pill 1198: ${JSON.stringify(measured)}`));
  for (const lang of ["de", "en"] as const) {
    for (const kind of KINDS) {
      it(`${lang} ${kind}`, async () => {
        const path = await pathOf(kind, lang);
        const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
        ctx.setDefaultTimeout(2_000);
        await ctx.route(THIRD_PARTY, (r) => r.fulfill({ status: 204, body: "" }));
        await ctx.addInitScript((k) => localStorage.setItem("viafrei.place", JSON.stringify(k)), KEPT);
        const page = await ctx.newPage();
        const asks: string[] = [];
        const cspErrors: string[] = [];
        page.on("console", (m) => {
          if (m.type() === "error" && /Content Security Policy/u.test(m.text())) cspErrors.push(m.text());
        });
        page.on("response", (r) => {
          if (r.request().method() === "POST" && /\/fragment\//u.test(r.url())) asks.push(`${String(r.status())} ${new URL(r.url()).pathname}`);
        });
        const res = await page.goto(`${base}${path}`);
        // the island has answered: the kept line is shown — then every ask it made has come back
        await page.locator("#place-kept:not([hidden])").first().waitFor({ state: "visible" });
        await page.waitForLoadState("networkidle", { timeout: 1_900 }).catch(() => undefined);
        const pill = ((await page.locator("#place-pill-label").first().textContent()) ?? "").trim();
        const scripts = await page.evaluate(() => Array.from(document.scripts).filter((e) => e.type !== "application/ld+json").map((e) => ({ nonced: e.nonce !== "", src: e.src, body: e.textContent ?? "" })));
        measured[`${lang} ${kind}`] = { path, pill, asks, scripts: scripts.length };
        await ctx.close();
        // a motorway's pill is its road and the place ("A7 · Düsseldorf"); every other page's is the place
        expect(pill, `${path}: the pill names the kept place`).toBe(kind === "motorway" || kind === "exit" ? "A7 · Düsseldorf" : "Düsseldorf");
        if (kind === "fuel" || kind === "fuel-station") {
          // #1198: the place script runs under the page's nonce (the CSP) and a fuel page carries no analytics
          const policy = res?.headers()["content-security-policy"] ?? "";
          expect(policy, `${path}: a nonce policy`).toMatch(/script-src[^;]*'nonce-[^']+'/u);
          expect(policy, `${path}: no inline style`).not.toMatch(/style-src[^;]*'unsafe-inline'/u);
          expect(scripts.length, `${path}: the place script is there`).toBeGreaterThan(0);
          expect(scripts.filter((x) => !x.nonced && x.src === "").length, `${path}: every inline script carries the nonce`).toBe(0);
          expect(scripts.filter((x) => /googletagmanager\.com|clarity\.ms/u.test(x.src) || /gtag\(|dataLayer/u.test(x.body)).length, `${path}: no analytics script`).toBe(0);
          expect(cspErrors, `${path}: no CSP violation`).toEqual([]);
        }
        expect(asks.filter((a) => a.startsWith("404 ")), `${path}: no ask of the kept place's cards was refused as missing`).toEqual([]);
      });
    }
  }
});
