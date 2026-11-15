/**
 * #1224: on a first visit the home's place cards said "this place could not be loaded" and showed after a reload —
 * the digest's person pool timed a cold place's own card round out, the shell answered that ask 502 (and the island
 * took any non-200 as final). Now a digest that did not answer is a 503 the island asks again (`lib/fragment-retry.ts`)
 * while the slot keeps its loading state.
 *
 * Here the FIRST answer to POST /fragment/place is a 503 and the second the real one: the cards are shown without a
 * reload, and the failed sentence is never said. Chromium, in the pinned Linux image (`e2e-arm.sh`); every wait ≤ 2 s.
 */
import type { ChildProcess } from "node:child_process";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { islandLabels } from "../src/location/labels.js";
import { RETRY_WAITS_MS } from "../src/lib/fragment-retry.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8996;
const ID = { IMPRESSUM_NAME: "Retry Probe", IMPRESSUM_STREET: "Probeweg 5", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "retry@example.invalid" };
const THIRD_PARTY = /googletagmanager\.com|google-analytics\.com|clarity\.ms/u;
const KEPT = { at: "ags:05111000", how: "manual", label: "Düsseldorf" };
const base = `http://127.0.0.1:${String(PORT)}`;

let browser: Browser;
let digest: Awaited<ReturnType<typeof startRealDigest>>;
let shell: ChildProcess;

beforeAll(async () => {
  digest = await startRealDigest({});
  shell = await startShell(PORT, { ...ID, DIGEST_URL: digest.url });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
});

describe("#1224: the first ask of a place's cards answered 503, the second 200 — the cards show without a reload", () => {
  for (const lang of ["de", "en"] as const) {
    it(`${lang} home`, async () => {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      ctx.setDefaultTimeout(2_000);
      await ctx.route(THIRD_PARTY, (r) => r.fulfill({ status: 204, body: "" }));
      await ctx.addInitScript((k) => localStorage.setItem("viafrei.place", JSON.stringify(k)), KEPT);
      // the first ask of the kept place is the digest that did not answer; every later one reaches the shell
      let refused = 0;
      await ctx.route("**/fragment/place", async (r) => {
        if (r.request().method() === "POST" && (r.request().postData() ?? "").includes(KEPT.at) && refused === 0) {
          refused += 1;
          await r.fulfill({ status: 503, headers: { "cache-control": "private, no-store" }, body: "" });
          return;
        }
        await r.fallback();
      });
      const page = await ctx.newPage();
      const asks: { status: number; at: number }[] = [];
      const t0 = Date.now();
      page.on("response", (r) => {
        if (r.request().method() === "POST" && new URL(r.url()).pathname === "/fragment/place" && (r.request().postData() ?? "").includes(KEPT.at)) asks.push({ status: r.status(), at: Date.now() - t0 });
      });
      let navigations = 0;
      page.on("framenavigated", (f) => {
        if (f === page.mainFrame()) navigations += 1;
      });
      const said: string[] = [];
      await page.exposeFunction("vfSaid", (t: string) => said.push(t));
      await page.addInitScript(() => {
        document.addEventListener("DOMContentLoaded", () => {
          const live = document.getElementById("place-live");
          if (live === null) return;
          new MutationObserver(() => (window as unknown as { vfSaid: (t: string) => void }).vfSaid(live.textContent ?? "")).observe(live, { childList: true, characterData: true, subtree: true });
        });
      });

      await page.goto(`${base}/${lang}`);
      // the kept place's cards arrive from the second ask, in place, with the slot no longer marked as updating
      await page.locator(`#place-slot #place-cards`).first().waitFor({ state: "attached" });
      await page.waitForFunction(() => document.getElementById("place-slot")?.classList.contains("is-updating") === false);
      await page.waitForFunction(() => (document.getElementById("place-pill-label")?.textContent ?? "").trim() === "Düsseldorf");
      const live = ((await page.locator("#place-live").first().textContent()) ?? "").trim();
      const failed = islandLabels(lang).failed;
      await ctx.close();

      expect(refused, "the first ask was the 503").toBe(1);
      expect(asks.map((a) => a.status), "a 503, then the cards").toEqual([503, 200]);
      // the second ask waited the first wait of the one ask-again
      expect((asks[1]?.at ?? 0) - (asks[0]?.at ?? 0)).toBeGreaterThanOrEqual(RETRY_WAITS_MS[0]! - 50);
      expect(navigations, "no reload").toBe(1);
      expect(said, "the failed sentence was never said").not.toContain(failed);
      expect(live).not.toBe(failed);
    });
  }
});
