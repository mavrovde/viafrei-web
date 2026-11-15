/**
 * #895: the motorway Ampel in a real browser, against the BUILT shell and the
 * real digest (`real-digest.ts`: the fixture A7 at production's size — six
 * closures in force along it, forty roadworks, a DWD warning), in de and en:
 *
 *   - switch OFF (production's default before 2.3.7): the Ampel at the top,
 *     above everything, for the whole motorway; for a stretch and a direction
 *     chosen in the address, its own scope;
 *   - switch ON (`VF_MOTORWAY_AROUND=1`), with an EMULATED position: the
 *     position's Ampel replaces the page's at the top, follows the radius chips
 *     and the direction of the address, and a closure behind the visitor is
 *     not red;
 *   - 390 px with no horizontal scroll, the "how" disclosure and the reasons by
 *     keyboard, axe on the Ampel in light and dark.
 *
 * The fixture's positions (`real-digest.ts` motorwayListing): closures at
 * lat 53.0, 52.7, 52.4, 52.1, 51.8, 51.5 (lon 9.8), the line running south from
 * 54.8 in a zigzag (so the distance ALONG the road is longer than the
 * latitudes say, and a closure at lon 9.8 lies on the line only where the
 * zigzag reaches it); from its point 100 (lat ≈ 52.55) the 52.4 closure is
 * ~29 km SOUTH along the road and no other closure is within 50 km.
 */
import type { ChildProcess } from "node:child_process";
import { AxeBuilder } from "@axe-core/playwright";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { junctionSlugs, towardsSlug } from "@viafrei/ingest";
import { motorwayPath } from "../src/site/motorways.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const ON_PORT = 8846;
const OFF_PORT = 8847;
const PERSON_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const ID = { IMPRESSUM_NAME: "Ampel Probe", IMPRESSUM_STREET: "Probeweg 6", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "ampel@example.invalid" };
/** Point 100 (the #890 suite's ON). */
const MIDDLE = { latitude: 52.5512, longitude: 9.4513, accuracy: 20 };
/** The fixture A7's junction slugs (the digest's own rule): its first and its last junction name the two directions. */
const NAMES = Array.from({ length: 320 }, (_, i) => i)
  .filter((i) => [0, 2, 4, 6].includes(i % 9))
  .map((i) => ({ no: String(i + 1), name: `Musterstadt-${["Nord", "Süd", "Ost", "West", "Mitte"][i % 5]!} ${String(i + 1)}` }));
const SLUGS = junctionSlugs(NAMES);
const TOWARDS_SOUTH = towardsSlug(SLUGS[SLUGS.length - 1]!);
const TOWARDS_NORTH = towardsSlug(SLUGS[0]!);
const SHOTS = process.env["TMPDIR"] ?? "/tmp";

let browser: Browser;
const shells: ChildProcess[] = [];
let digest: Awaited<ReturnType<typeof startRealDigest>>;

beforeAll(async () => {
  digest = await startRealDigest();
  shells.push(await startShell(ON_PORT, { ...ID, DIGEST_URL: digest.url, VF_MOTORWAY_AROUND: "1" }));
  shells.push(await startShell(OFF_PORT, { ...ID, DIGEST_URL: digest.url }));
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  for (const s of shells) s.kill();
  await digest?.close();
});

async function open(port: number, pos: typeof MIDDLE | null, path: string, o: { width?: number; scheme?: "light" | "dark" } = {}): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({
    viewport: { width: o.width ?? 1200, height: 1000 },
    userAgent: PERSON_UA,
    colorScheme: o.scheme ?? "light",
    ...(pos === null ? {} : { geolocation: pos, permissions: ["geolocation"] }),
  });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${String(port)}${path}`);
  return { ctx, page };
}
const lamp = (page: Page): Promise<string> => page.$eval("#ampel-slot .ampel", (e: Element) => /ampel--(red|yellow|green)/.exec(e.getAttribute("class") ?? "")?.[1] ?? "");
const topId = (page: Page): Promise<string> => page.$eval("#ampel-slot .ampel", (e) => e.id);
/** Wait until the top shows the position's Ampel for radius `r`. */
const aroundAt = (page: Page, r: number, word: string): Promise<unknown> =>
  page.waitForFunction(([r0, w]) => document.querySelector("#ampel-slot #motorway-ampel-around .ampel__scope")?.textContent?.includes(`${String(r0)} km`) === true && document.querySelector("#ampel-slot")?.textContent?.includes(w) === true, [r, word] as const);

describe("switch OFF: the whole motorway, or the address's choice", () => {
  for (const lang of ["de", "en"] as const) {
    it(`${lang}: the Ampel is the first thing after the heading, for the whole A7, red with its reasons linked to their rows`, async () => {
      const { ctx, page } = await open(OFF_PORT, null, motorwayPath(lang, "A7"));
      await page.waitForSelector("#ampel-slot #motorway-ampel");
      expect(await page.$("#place")).toBeNull();
      // Above everything: before the page fragment, the lists and the map.
      const order = await page.evaluate(() => {
        const a = document.getElementById("ampel-slot")!;
        const m = document.querySelector(".motorway-page")!;
        return a.compareDocumentPosition(m) & Node.DOCUMENT_POSITION_FOLLOWING;
      });
      expect(order).toBeTruthy();
      expect(await page.$$("#motorway-ampel")).toHaveLength(1);
      expect(await lamp(page)).toBe("red");
      const text = (await page.textContent("#ampel-slot"))!;
      expect(text).toContain(lang === "de" ? "Rot —" : "Red —");
      expect(text).toContain(lang === "de" ? "Für die ganze A7." : "For the whole A7.");
      // Exactly one lamp lit, its word beside it; the SVG's text twin is the reasons list.
      expect(await page.$$eval("#ampel-slot .ampel__lamp.is-on", (c) => c.map((x) => x.getAttribute("class")))).toEqual(["ampel__lamp ampel__lamp--red is-on"]);
      expect(await page.textContent("#ampel-slot .ampel__label.is-on")).toBe(lang === "de" ? "Rot" : "Red");
      const twin = await page.$eval("#ampel-slot svg.ampel__svg", (s) => document.getElementById(s.getAttribute("aria-describedby")!)?.tagName);
      expect(twin).toBe("OL");
      // Every reason link lands on a row of the page.
      const targets = await page.$$eval("#ampel-slot .ampel__why a", (as) => as.map((a) => a.getAttribute("href")!.slice(1)));
      expect(targets.length).toBeGreaterThan(0);
      for (const t of targets) expect(await page.$(`#${t}`), t).not.toBeNull();
      await page.screenshot({ path: `${SHOTS}/895-ampel-off-${lang}-desktop.png`, clip: (await (await page.$("#ampel-slot"))!.boundingBox())! });
      await ctx.close();
    });
  }

  it("de: a stretch and a direction in the address give the Ampel of that choice", async () => {
    const { ctx, page } = await open(OFF_PORT, null, `${motorwayPath("de", "A7")}/${TOWARDS_SOUTH}`);
    await page.waitForSelector("#ampel-slot #motorway-ampel");
    expect(await page.textContent("#ampel-slot .ampel__scope")).toContain("Für Ihre Auswahl auf der A7.");
    await ctx.close();
  });
});

describe("switch ON: the position's Ampel at the top (emulated position)", () => {
  for (const lang of ["de", "en"] as const) {
    it(`${lang}: the position's Ampel replaces the page's at the top; the chips move it (10 km not red, 50 km red: a closure ~29 km along the road)`, async () => {
      const red = lang === "de" ? "Rot" : "Red";
      const { ctx, page } = await open(ON_PORT, MIDDLE, `${motorwayPath(lang, "A7")}?r=10`);
      await page.waitForSelector("#ampel-slot #motorway-ampel-around");
      expect(await topId(page)).toBe("motorway-ampel-around");
      // One Ampel visible: the page's waits in its template, the block's moved to the top.
      expect(await page.$$("#place-slot .ampel")).toHaveLength(0);
      expect(await page.$$("#motorway-ampel")).toHaveLength(0);
      expect(await lamp(page)).not.toBe("red");
      await page.click('.mwr__chip[value="50"]');
      await aroundAt(page, 50, `${red} —`);
      expect(await lamp(page)).toBe("red");
      expect(await page.textContent("#ampel-slot")).toContain(lang === "de" ? "beiden Richtungen" : "both directions");
      // A reason links to its row of the around list.
      const t = await page.$eval("#ampel-slot .ampel__why a", (a) => a.getAttribute("href")!.slice(1));
      expect(t).toMatch(/^mwa-i\d+$/);
      expect(await page.$(`#place-slot #${t}`)).not.toBeNull();
      await page.screenshot({ path: `${SHOTS}/895-ampel-on-${lang}-desktop.png`, clip: (await (await page.$("#ampel-slot"))!.boundingBox())! });
      await ctx.close();
    });
  }

  it("de: position, then radius 10, then 'Ganz Deutschland' — the top is the whole road's lamp again, never the radius's or the position's (#895 review)", async () => {
    const { ctx, page } = await open(ON_PORT, MIDDLE, `${motorwayPath("de", "A7")}?r=50`);
    await aroundAt(page, 50, "Rot —");
    // The server's whole-road Ampel, as the template holds it before anything moved.
    const whole = await page.$eval("#ampel-whole", (t) => (t as HTMLTemplateElement).innerHTML);
    expect(whole).toContain('id="motorway-ampel"');
    await page.click('.mwr__chip[value="10"]');
    await aroundAt(page, 10, "—");
    // The swapped main block's radius Ampel left the block, and the template is still the server's.
    expect(await page.$$("#motorway-main .ampel")).toHaveLength(0);
    expect(await page.$eval("#ampel-whole", (t) => (t as HTMLTemplateElement).innerHTML)).toBe(whole);
    await page.click("#place-pill");
    await page.click("#place-scope-de");
    await page.waitForFunction(() => document.querySelector("#ampel-slot #motorway-ampel") !== null);
    expect(await topId(page)).toBe("motorway-ampel");
    expect(await page.$eval("#ampel-slot", (e) => e.innerHTML)).toBe(whole);
    expect(await page.textContent("#ampel-slot .ampel__scope")).toContain("Für die ganze A7.");
    expect(await lamp(page)).toBe("red");
    expect(await page.$$(".ampel")).toHaveLength(1);
    await ctx.close();
  });

  it("de: a closure BEHIND the visitor is not red; the same closure ahead is", async () => {
    // From point 100 the nearest closure on the line lies ~29 km SOUTH along the road (the #895 probe of the fixture):
    // driving north it is behind; driving south it is ahead.
    const behind = await open(ON_PORT, MIDDLE, `${motorwayPath("de", "A7")}/${TOWARDS_NORTH}?r=50`);
    await behind.page.waitForSelector("#ampel-slot #motorway-ampel-around");
    expect(await behind.page.textContent("#ampel-slot .ampel__scope")).toContain("vor Ihnen in Fahrtrichtung");
    expect(await lamp(behind.page)).not.toBe("red");
    await behind.ctx.close();
    const ahead = await open(ON_PORT, MIDDLE, `${motorwayPath("de", "A7")}/${TOWARDS_SOUTH}?r=50`);
    await ahead.page.waitForSelector("#ampel-slot #motorway-ampel-around");
    expect(await lamp(ahead.page)).toBe("red");
    expect(await ahead.page.textContent("#ampel-slot .ampel__line")).toMatch(/Rot — Vollsperrung .* km vor Ihnen/);
    await ahead.ctx.close();
  });

  it("the Ampel's request carries no position in an address: the page's URL holds only ?r=", async () => {
    const { ctx, page } = await open(ON_PORT, MIDDLE, motorwayPath("de", "A7"));
    const urls: string[] = [];
    page.on("request", (r) => urls.push(r.url()));
    await page.waitForSelector("#ampel-slot #motorway-ampel-around");
    await page.click('.mwr__chip[value="50"]');
    await aroundAt(page, 50, " — ");
    for (const u of urls) expect(u, u).not.toMatch(/52\.55|9\.45|pt:/);
    expect(new URL(page.url()).search).toBe("?r=50");
    await ctx.close();
  });
});

describe("phone, keyboard, axe", () => {
  for (const port of [OFF_PORT, ON_PORT])
    it(`at 390 px the Ampel fits with no horizontal scroll (${port === ON_PORT ? "on" : "off"})`, async () => {
      const { ctx, page } = await open(port, port === ON_PORT ? MIDDLE : null, motorwayPath("de", "A7"), { width: 390 });
      await page.waitForSelector(port === ON_PORT ? "#ampel-slot #motorway-ampel-around" : "#ampel-slot #motorway-ampel");
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
      const box = (await (await page.$("#ampel-slot .ampel"))!.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
      for (const scheme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme: scheme });
        // #1153 put the place row in the header, so the Ampel starts below the first 1000 px: the clip is taken in page
        // coordinates (`fullPage`), where the box was measured, and the shot is still exactly the Ampel
        await page.screenshot({ path: `${SHOTS}/895-ampel-${port === ON_PORT ? "on" : "off"}-390-${scheme}.png`, clip: box, fullPage: true });
      }
      await ctx.close();
    });

  it("the reasons and 'Wie die Ampel entsteht' work by keyboard alone", async () => {
    const { ctx, page } = await open(OFF_PORT, null, motorwayPath("de", "A7"));
    await page.waitForSelector("#ampel-slot #motorway-ampel");
    await page.focus("#ampel-slot .ampel__why a");
    const href = await page.evaluate(() => (document.activeElement as HTMLAnchorElement).getAttribute("href"));
    await page.keyboard.press("Enter");
    expect(new URL(page.url()).hash).toBe(href);
    await page.focus("#ampel-slot .ampel__how summary");
    expect(await page.$eval("#ampel-slot .ampel__how", (d) => (d as HTMLDetailsElement).open)).toBe(false);
    await page.keyboard.press("Enter");
    expect(await page.$eval("#ampel-slot .ampel__how", (d) => (d as HTMLDetailsElement).open)).toBe(true);
    expect(await page.textContent("#ampel-slot .ampel__how")).toContain("Stau ab 30 Minuten");
    await ctx.close();
  });

  for (const scheme of ["light", "dark"] as const)
    for (const port of [OFF_PORT, ON_PORT])
      it(`axe: no serious or critical violation in the Ampel (${scheme}, ${port === ON_PORT ? "on" : "off"})`, async () => {
        const { ctx, page } = await open(port, port === ON_PORT ? MIDDLE : null, motorwayPath("de", "A7"), { width: 390, scheme });
        await page.waitForSelector(port === ON_PORT ? "#ampel-slot #motorway-ampel-around" : "#ampel-slot #motorway-ampel");
        const r = await new AxeBuilder({ page }).include("#ampel-slot").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
        expect(r.passes.length).toBeGreaterThan(0);
        expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
        await ctx.close();
      });
});
