/**
 * #1224 (2.5.22): a FIRST visit to the home from a place nobody had asked for yet (a cold cell) said "Dieser Ort ließ
 * sich gerade nicht laden." and a reload showed the cards. Measured on prod 2026-11-08: a cold place's
 * `POST /fragment/place` answers 200 with the shell's LOADING placeholder (`<div class="place-fill place-fill--loading
 * is-loading" …>`, 622 bytes — the #1184/#1198 "asked again shortly" answer for a read that missed the deadline), and
 * the page's filler took that answer for a foreign shape and said the failed sentence; the reload found the read done.
 *
 * Here the digest is a cold one in front of the real fixture digest: the first render's read of the cards is slower
 * than the page's 500 ms deadline (so the page carries the placeholder), the filler's first read slower than the
 * shell's own place deadline (so the shell answers the loading placeholder) — every later read is the real one. The
 * IP rung (the GeoIP fixture's Köln) is a fresh context with a person's browser. The cards must arrive without a
 * reload and the failed sentence must never be on the page. Chromium in the pinned Linux image; every wait ≤ 2 s.
 */
import type { ChildProcess } from "node:child_process";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer, request as httpRequest, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { t } from "../src/i18n/index.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8997;
const base = `http://127.0.0.1:${String(PORT)}`;
const ID = { IMPRESSUM_NAME: "Cold Probe", IMPRESSUM_STREET: "Probeweg 6", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "cold@example.invalid" };
const THIRD_PARTY = /googletagmanager\.com|google-analytics\.com|clarity\.ms/u;
const CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";
/** The shell's own deadline for a place read (`WEB_PLACE_TIMEOUT_MS`); the cold reads are timed against it. */
const PLACE_MS = 1_000;

let browser: Browser;
let digest: Awaited<ReturnType<typeof startRealDigest>>;
let cold: { url: string; reads: () => number; reset: () => void; close: () => Promise<void> };
let shell: ChildProcess;
let geoDir: string;

/** A digest whose first two reads of place cards are cold: the first past the page's deadline, the second past the shell's. */
async function startColdDigest(target: string): Promise<typeof cold> {
  let reads = 0;
  const up = new URL(target);
  const server: Server = createServer((req, res) => {
    const cards = (req.url ?? "").startsWith("/internal/place/cards");
    const n = cards ? ++reads : 0;
    const wait = n === 1 ? 700 : n === 2 ? PLACE_MS + 400 : 0;
    setTimeout(() => {
      const fwd = httpRequest({ host: up.hostname, port: up.port, path: req.url, method: req.method, headers: req.headers }, (r) => {
        res.writeHead(r.statusCode ?? 502, r.headers);
        r.pipe(res);
      });
      fwd.on("error", () => res.destroyed || res.writeHead(502).end());
      req.pipe(fwd);
    }, wait);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  return {
    url: `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`,
    reads: () => reads,
    reset: () => (reads = 0),
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}

beforeAll(async () => {
  digest = await startRealDigest({});
  cold = await startColdDigest(digest.url);
  geoDir = mkdtempSync(join(tmpdir(), "vf-1224-geo-"));
  const here = fileURLToPath(new URL(".", import.meta.url));
  execFileSync("node", [join(here, "..", "..", "..", "scripts", "geoip-build.mjs"), "--release", "2026-10", "--out", join(geoDir, "geoip.vfgeo"), "--min-de-ranges", "1"], { input: readFileSync(join(here, "..", "test", "fixtures", "geoip-fixture.csv")), stdio: ["pipe", "ignore", "inherit"] });
  shell = await startShell(PORT, { ...ID, DIGEST_URL: cold.url, GEOIP_FILE: join(geoDir, "geoip.vfgeo"), WEB_PLACE_TIMEOUT_MS: String(PLACE_MS) });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await cold?.close();
  await digest?.close();
  if (geoDir) rmSync(geoDir, { recursive: true, force: true });
});

describe("#1224: a first visit from a cold place — the shell answers the cards' loading placeholder first, then the cards", () => {
  for (const lang of ["de", "en"] as const) {
    it(`${lang} home: the cards arrive without a reload, the failed sentence is never shown`, async () => {
      cold.reset();
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, userAgent: CHROME, extraHTTPHeaders: { "x-forwarded-for": "192.0.2.77" } });
      ctx.setDefaultTimeout(2_000);
      await ctx.route(THIRD_PARTY, (r) => r.fulfill({ status: 204, body: "" }));
      const page = await ctx.newPage();
      const answers: { status: number; head: string }[] = [];
      page.on("response", (r) => {
        if (r.request().method() !== "POST" || new URL(r.url()).pathname !== "/fragment/place") return;
        void r.text().then((b) => answers.push({ status: r.status(), head: b.slice(0, 60) }), () => undefined);
      });
      let navigations = 0;
      page.on("framenavigated", (f) => {
        if (f === page.mainFrame()) navigations += 1;
      });
      const failed = t(lang, "place.failed");
      // every text the page ever showed (rendered text: `innerText`, so no script's configuration), so a failed sentence
      // later replaced is still seen
      const shown: string[] = [];
      await page.exposeFunction("vfShown", (s: string) => shown.push(s));
      await page.addInitScript(() => {
        document.addEventListener("DOMContentLoaded", () => {
          const tell = (): void => (window as unknown as { vfShown: (s: string) => void }).vfShown(document.querySelector<HTMLElement>("main")?.innerText ?? "");
          new MutationObserver(tell).observe(document.body, { childList: true, characterData: true, subtree: true });
          tell();
        });
      });

      await page.goto(`${base}/${lang}`);
      // the first render missed its deadline: the page carries the loading placeholder, not the cards
      expect(await page.locator("#place-cards").count(), "no cards in the first HTML").toBe(0);
      await page.locator(".place-fill--loading").first().waitFor({ state: "attached" });
      // the cold read, the shell's loading placeholder, its refill: waited for in steps of at most 2 s
      for (let i = 0; i < 4 && (await page.locator("#place-cards").count()) === 0; i += 1) {
        await page.locator("#place-cards").first().waitFor({ state: "attached" }).catch(() => undefined);
      }
      const cards = await page.locator("#place-cards").count();
      const mainText = await page.locator("main").first().innerText();
      await ctx.close();

      expect(answers[0]?.status, "the shell answered the cold read").toBe(200);
      expect(answers[0]?.head, "with its loading placeholder").toMatch(/^<div class="place-fill place-fill--loading is-loading"/);
      expect(shown.some((s) => s.includes(failed)), "the failed sentence was never shown").toBe(false);
      expect(mainText).not.toContain(failed);
      expect(cards, "the cards arrived without a reload").toBe(1);
      expect(navigations, "no reload").toBe(1);
      expect(cold.reads(), "the first render's read, the filler's cold read and its refill").toBeGreaterThanOrEqual(3);
    });
  }
});
