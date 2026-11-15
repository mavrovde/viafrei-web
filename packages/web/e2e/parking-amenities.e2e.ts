/**
 * #891: the parking card's amenity filter chips, driven in a real browser against the BUILT shell and the REAL
 * digest (`startRealDigest`: `renderPlace` over the fixture's rows, one of which — P+R Weiden West — carries a
 * publisher-stated WC and accessible WC and a stated "no shower"; P+R Köln-Messe states nothing). The chips need no
 * script: a checked chip hides, by the built `site.css` and `:has()`, every row whose amenity line lacks the
 * amenity, and the OpenStreetMap blocks (which state no amenity, and which `find_parking {facilities}` does not read).
 * German and English, one language per page. Since the steward ruling of 2026-10-21 (#891 O1–O9, C1–C6) each site
 * also names what OpenStreetMap and the charging tables hold NEAR it, on lines of their own, which no chip reads.
 */
import type { ChildProcess } from "node:child_process";
import { AxeBuilder } from "@axe-core/playwright";
import type { NodeResult, Result } from "axe-core";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

/** #1176: on a phone a place's cards after the first (a station's area: every card) are folded; a person opens a card's fold first. */
async function unfold(page: Page): Promise<void> {
  // opened as a person's click does, without one: a desktop or print shows no summary to click (it is open there by CSS)
  await page.$$eval("details.pcard__fold:not([open])", (ds) => ds.forEach((d) => d.setAttribute("open", "")));
}

const PORT = 8839;
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

const visibleRows = async (page: Page): Promise<string[]> => (await page.locator("#pcard-parking .pcard__list > li:visible").allTextContents()).map((t) => t.replace(/\s+/gu, " "));

describe("the parking card's amenity chips filter by what each publisher states (#891)", () => {
  for (const [path, chip, stated, unknownWord, hint, otherLang] of [
    ["/de/place/koeln", "WC", "Ausstattung laut Herausgeber: WC · barrierefreies WC · keine Dusche", "Ausstattung: keine Angaben", "nicht ausgeschlossen", "Facilities"],
    ["/en/place/koeln", "toilet", "Facilities per the publisher: toilet · accessible toilet · no shower", "Facilities: not reported", "not ruled out", "Ausstattung"],
  ] as const) {
    it(`${path}: the line, the chip hides the site that states nothing, unchecking restores it`, async () => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      const r = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
      await unfold(page);
      expect(r?.status(), path).toBeLessThan(400);
      await page.waitForSelector("#pcard-parking .amchips");
      const card = page.locator("#pcard-parking");
      const text = ((await card.textContent()) ?? "").replace(/\s+/gu, " ");
      expect(text, path).toContain(stated);
      expect(text, path).toContain(unknownWord);
      expect(text, path).not.toContain(otherLang);
      const before = await visibleRows(page);
      expect(before.some((t) => t.includes("Weiden West")), path).toBe(true);
      expect(before.some((t) => t.includes("Köln-Messe")), path).toBe(true);
      // the hint is shown only once a chip is checked
      expect(await card.locator(".amchips p").isVisible(), path).toBe(false);

      await card.getByLabel(chip, { exact: true }).check();
      const after = await visibleRows(page);
      expect(after.some((t) => t.includes("Weiden West")), path).toBe(true);
      expect(after.some((t) => t.includes("Köln-Messe")), path).toBe(false);
      expect(await card.locator(".amchips p").isVisible(), path).toBe(true);
      expect(((await card.locator(".amchips p").textContent()) ?? "").includes(hint), path).toBe(true);
      for (const osm of await card.locator(".pcard__osm").all()) expect(await osm.isVisible(), path).toBe(false);

      await card.getByLabel(chip, { exact: true }).uncheck();
      expect(await visibleRows(page), path).toEqual(before);
      await ctx.close();
    });
  }

  it("no chip is offered for an amenity no listed site states, and a stated 'no' is not a chip", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/de/place/koeln`, { waitUntil: "networkidle" });
    await unfold(page);
    const values = await page.locator("#pcard-parking .amchips input").evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
    expect(values).toEqual(["toilet", "accessible_toilet"]);
    // two chips are an AND: the one site stating both stays
    await page.locator('#pcard-parking .amchips input[value="toilet"]').check();
    await page.locator('#pcard-parking .amchips input[value="accessible_toilet"]').check();
    const rows = await visibleRows(page);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain("Weiden West");
    // the lorry card's one row states nothing: "keine Angaben", and no chip there
    expect(await page.locator("#pcard-lorry .amchips").count()).toBe(0);
    expect((await page.locator("#pcard-lorry").textContent()) ?? "").toContain("Ausstattung: keine Angaben");
    await ctx.close();
  });

  for (const scheme of ["light", "dark"] as const) {
    it(`axe: the parking card with its chips, unchecked and checked, has no serious or critical violation (${scheme})`, async () => {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, colorScheme: scheme });
      const page = await ctx.newPage();
      await page.goto(`${BASE}/de/place/koeln`, { waitUntil: "networkidle" });
      await unfold(page);
      const audit = async (): Promise<string[]> =>
        (await new AxeBuilder({ page }).include("#pcard-parking").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze()).violations
          .filter((v: Result) => v.impact === "serious" || v.impact === "critical")
          .map((v: Result) => `${v.id} (${v.impact}): ${v.nodes.map((n: NodeResult) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
      expect(await audit()).toEqual([]);
      await page.locator('#pcard-parking .amchips input[value="toilet"]').check();
      expect(await audit()).toEqual([]);
      await ctx.close();
    });
  }

  // #891 (steward O1–O9, C1–C6): what is NEAR each listed site, on lines of its own under the publisher's line.
  for (const [path, osmFrame, chargerFrame, restaurant, toilet, charger, chip] of [
    ["/de/place/koeln", "In der Nähe laut OpenStreetMap (Luftlinie): ", "In der Nähe (Luftlinie): ", "Restaurant 180 m", "WC 80 m", "Ladesäule 150 kW, 110 m (RheinEnergie)", "WC"],
    ["/en/place/koeln", "Nearby per OpenStreetMap (straight line): ", "Nearby (straight line): ", "restaurant 180 m", "toilet 80 m", "EV charger 150 kW, 110 m (RheinEnergie)", "toilet"],
  ] as const) {
    it(`${path}: OpenStreetMap's amenities and the nearest charger beside each site, each linked to its point; a chip is satisfied by the publisher's line alone`, async () => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
      await unfold(page);
      const card = page.locator("#pcard-parking");
      const row = (name: string) => card.locator(".pcard__list > li", { hasText: name });
      const near = async (name: string): Promise<string[]> => (await row(name).locator(".pcard__near").allTextContents()).map((t) => t.replace(/\s+/gu, " "));
      // Weiden West states a WC: OpenStreetMap's WC 90 m off is left out (O8), its restaurant is named
      expect(await near("Weiden West"), path).toEqual([`${osmFrame}${restaurant}`]);
      // Köln-Messe states nothing: OpenStreetMap's WC and the charger, each on its own line; the register row never (#526)
      expect(await near("Köln-Messe"), path).toEqual([`${osmFrame}${toilet}`, `${chargerFrame}${charger}`]);
      expect(((await card.textContent()) ?? "").includes("Register"), path).toBe(false);
      // the publisher's line comes first and is unchanged
      expect(((await row("Köln-Messe").textContent()) ?? "").replace(/\s+/gu, " "), path).toMatch(/(keine Angaben|not reported).*(In der Nähe|Nearby)/u);
      // each part links to openstreetmap.org at its own point
      const hrefs = await row("Köln-Messe").locator(".pcard__near a").evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? ""));
      expect(hrefs, path).toHaveLength(2);
      for (const h of hrefs) expect(h, path).toMatch(/^https:\/\/www\.openstreetmap\.org\/\?mlat=50\.94\d+&mlon=6\.98220#map=18\//u);
      // O3/O4: the OpenStreetMap line and the § 4.6 offer; C3: the charger's own line among the card's credits
      const src = card.locator(".pcard__nearsrc");
      expect(await src.isVisible(), path).toBe(true);
      expect((await src.textContent()) ?? "", path).toMatch(/OpenStreetMap[\s\S]*ODbL 1\.0/u);
      expect((await card.locator("footer").allTextContents()).join(" "), path).toContain("Ladepunkte: chargecloud GmbH via Mobilithek, CC0 1.0");
      // O5/C6: no chip for a restaurant (only OpenStreetMap names one); the WC chip hides Köln-Messe although a WC is 80 m off
      const values = await card.locator(".amchips input").evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
      expect(values, path).not.toContain("restaurant");
      expect(values, path).not.toContain("charging");
      await card.getByLabel(chip, { exact: true }).check();
      const after = await visibleRows(page);
      expect(after.some((t) => t.includes("Weiden West")), path).toBe(true);
      expect(after.some((t) => t.includes("Köln-Messe")), path).toBe(false);
      // the OpenStreetMap line stays while a site it credits is shown
      expect(await src.isVisible(), path).toBe(true);
      await ctx.close();
    });
  }

  it("stays inside the page budget (500 KB)", async () => {
    const html = await (await fetch(`${BASE}/de/place/koeln`)).text();
    expect(Buffer.byteLength(html)).toBeLessThan(500 * 1024);
  });
});
