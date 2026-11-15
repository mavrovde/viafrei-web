/**
 * #1070 against the REAL built shell and the REAL digest renderer over the fixture (no database, no network; the
 * fixture's boundary is `real-digest.ts` BORDER_TOWNS): an emulated browser position in Flensburg shows local cards,
 * in Strasbourg Kehl's cards under the honest line with the motorway crossing, in Paris and in Reykjavik (outside the
 * old box) "Ganz Deutschland" and never an error — in de, en and tr. Nothing about an outside position is stored.
 */
import type { ChildProcess } from "node:child_process";
import { all } from "@viafrei/design/testing";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8901;
const BASE = `http://127.0.0.1:${String(PORT)}`;
let browser: Browser;
let shell: ChildProcess;
let digest: Awaited<ReturnType<typeof startRealDigest>>;

beforeAll(async () => {
  digest = await startRealDigest();
  shell = await startShell(PORT, { DIGEST_URL: digest.url, WEB_TILE_TIMEOUT_MS: "2000" });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
});

const WORDS = {
  de: { outside: "Außerhalb Deutschlands — nächster deutscher Ort:", germany: "Ganz Deutschland", far: "außerhalb Deutschlands" },
  en: { outside: "Outside Germany — nearest German town:", germany: "All of Germany", far: "outside Germany" },
  tr: { outside: "Almanya dışında — en yakın Alman yerleşimi:", germany: null, far: "Almanya dışında" },
} as const;

type Seen = { pill: string; slot: string; stored: string | null; live: string; germanyOn: string | null };

/** "Use my location" at a position, on the home of a language. */
async function useLocation(lang: keyof typeof WORDS, latitude: number, longitude: number): Promise<Seen> {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 }, geolocation: { latitude, longitude, accuracy: 20 }, permissions: ["geolocation"] });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/${lang}`, { waitUntil: "networkidle" });
  // #1112: "use my location" is in the position bar, on the page — no window to open
  await Promise.all([page.waitForResponse((r) => r.url().endsWith("/fragment/place")), page.click("#place-geo")]);
  await page.waitForFunction(() => document.getElementById("place-slot")?.innerHTML.includes("place-cards") === true);
  const seen: Seen = {
    pill: ((await page.textContent("#place-pill-label")) ?? "").trim(),
    slot: await page.innerHTML("#place-slot"),
    stored: await page.evaluate(() => window.localStorage.getItem("viafrei.place")),
    live: ((await page.textContent("#place-live")) ?? "").trim(),
    // #1088: "Ganz Deutschland" is the headline's second radio; the place radio names no place then
    germanyOn: await page.getAttribute("#place-scope-de", "aria-checked"),
  };
  await ctx.close();
  return seen;
}

describe("#1070: a browser position outside Germany", () => {
  for (const lang of ["de", "en", "tr"] as const) {
    it(`${lang}: Flensburg (inside) shows the position's own cards and is remembered after the click`, async () => {
      const s = await useLocation(lang, 54.7836, 9.4321);
      expect(all(s.slot, ".pcard").length).toBeGreaterThan(0);
      expect(s.slot).not.toContain("place__outside");
      expect(s.slot).not.toContain("place__far");
      expect(s.stored).not.toBeNull();
    });

    it(`${lang}: Strasbourg (border) shows Kehl's cards, the honest line and the A5 crossing — nothing stored`, async () => {
      const s = await useLocation(lang, 48.5734, 7.7521);
      expect(s.slot).toContain(WORDS[lang].outside);
      expect(s.slot).toContain(">Kehl</span>");
      expect(s.slot).toContain(`href="/${lang}/autobahn/a5"`);
      expect(all(s.slot, ".pcard").length).toBeGreaterThan(0);
      expect(s.pill).toBe("Kehl");
      expect(s.stored).toBeNull();
    });

    for (const [where, lat, lon] of [["Paris", 48.8566, 2.3522], ["Reykjavik (outside the old box)", 64.1466, -21.9426]] as const) {
      it(`${lang}: ${where} (far) is "Ganz Deutschland", not an error — nothing stored`, async () => {
        const s = await useLocation(lang, lat, lon);
        expect(all(s.slot, ".place__far")).toHaveLength(1);
        expect(s.slot.toLowerCase()).toContain(WORDS[lang].far.toLowerCase());
        expect(all(s.slot, ".pcard")).toHaveLength(0);
        expect(s.germanyOn).toBe("true");
        if (WORDS[lang].germany !== null) expect(s.live).toBe(WORDS[lang].germany);
        expect(s.stored).toBeNull();
      });
    }
  }
});
