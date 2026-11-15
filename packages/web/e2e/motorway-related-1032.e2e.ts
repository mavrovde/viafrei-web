/**
 * #1032 in a real browser, against the BUILT shell and the REAL digest (`real-digest.ts`):
 *  - the related motorways on the crossings card: the fixture's motorways all begin at the A7's first point (54.8° N,
 *    9.4° E), and the A7 leaves their line there — so, by the one rule, the A7 begins or ends on each of them, and since
 *    2.5.8 also on those it meets at that interchange (the A6, the A8 and the A1): the A7's OWN end is at their Dreieck,
 *    which is what the real register looks like (the A 980 begins at the AD Allgäu on the A 7). Each row links that
 *    motorway's page at its junction there, and the lamp the row shows is the one that page shows;
 *  - the zoomed map's shields as keyboard links (the around block with an emulated position near the A7's first
 *    junction, an AD): Tab reaches every shield, each named, each linking where a row of the card links; Enter on the
 *    A1's lands on the A1's page centred on its junction there, whose Ampel is the shield's lamp; axe finds nothing
 *    serious or critical on the map.
 * Visual baselines of the card and the linked map are made in the Linux container at the cut (never on macOS).
 */
import { AxeBuilder } from "@axe-core/playwright";
import type { ChildProcess } from "node:child_process";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { motorwayPath } from "../src/site/motorways.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8921;
const BASE = `http://127.0.0.1:${PORT}`;
const PERSON_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
/** On the fixture A7, by its third point (54.8 − 2·7.2/320, 9.4 + 2·0.05): about 8 km from its first junction, the AD. */
const NEAR_START = { latitude: 54.7551, longitude: 9.4999, accuracy: 20 };

let browser: Browser;
let shell: ChildProcess;
let digest: Awaited<ReturnType<typeof startRealDigest>>;

beforeAll(async () => {
  digest = await startRealDigest();
  shell = await startShell(PORT, { DIGEST_URL: digest.url, VF_MOTORWAY_AROUND: "1", IMPRESSUM_NAME: "Related Probe", IMPRESSUM_STREET: "Probeweg 9", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "related@example.invalid" });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
});

/** The colour of a lamp element's class (`mw-lamp--red` / `mwc-lamp--red` → red). */
const colourOf = (cls: string | null): string => /mwc?-lamp--(red|yellow|green|grey)/.exec(cls ?? "")?.[1] ?? "none";
/**
 * The main Ampel's lit lamp of a motorway page: the motorway's own (`#motorway-ampel`). Since #1188 an exit page also
 * carries the around block's place Ampel (`#vf-around #place-ampel`, the junction's surroundings, as on a station page),
 * a different scope — so the main one is found by its id, and every other lit lamp must be the around block's.
 */
const litAmpel = async (page: Page): Promise<string> => {
  const cls = await page.$$eval("#motorway-ampel .ampel__lamp.is-on", (xs) => xs.map((x) => x.getAttribute("class") ?? ""));
  expect(cls).toHaveLength(1);
  const others = await page.$$eval(".ampel__lamp.is-on", (xs) => xs.filter((x) => x.closest("#motorway-ampel") === null && x.closest("#vf-around") === null).length);
  expect(others, "a lit lamp outside the motorway's Ampel and the around block").toBe(0);
  return /ampel__lamp--(red|yellow|green|grey)/.exec(cls[0]!)?.[1] ?? "none";
};
/** Every href the crossings card links a motorway with — its crossings' rows and its related motorways'. */
const cardHrefs = (page: Page): Promise<string[]> => page.$$eval("#mwk-crossings .mwc__other a.shield", (as) => as.map((a) => a.getAttribute("href") ?? ""));

describe("#1032: the related motorways on the crossings card", () => {
  it("the A7 lists the motorways it begins on — at their Dreieck too (2.5.8) — each linked to that page there, the lamp the page shows", async () => {
    const page = await browser.newPage({ userAgent: PERSON_UA });
    try {
      // the other page first, so its lamp is judged from a page this process holds (as a visit before would)
      await page.goto(`${BASE}${motorwayPath("de", "A2")}`, { waitUntil: "load" });
      await page.goto(`${BASE}${motorwayPath("de", "A7")}`, { waitUntil: "load" });
      // the page opens at 1280 px, where the desktop dashboard (#1180) stands the crossings card as its head and one
      // "alle N anzeigen" button: the visitor opens it before following a row, and so does the test
      await page.click("#mwk-crossings > .desk__more");
      const rows = page.locator("#mwk-crossings .mwrel__row");
      const roads = await rows.locator("a.shield").allTextContents();
      expect(roads.length).toBeGreaterThan(0);
      // 2.5.8: the A7 BEGINS at the interchange it shares with the A1, A6 and A8 — so each is a crossing AND a related
      // row saying the A7 begins there (before 2.5.8 the crossed filter hid them, and on prod it hid every spur)
      for (const crossed of ["A1", "A6", "A8"]) {
        expect(roads).toContain(crossed);
        const r = page.locator(`#mwk-crossings .mwrel__row:has(a.shield[href^="${motorwayPath("de", crossed)}/"])`);
        expect(await r.textContent(), crossed).toMatch(/die A7 beginnt oder endet bei .+ an ihr/u);
      }
      expect(roads).toContain("A2");
      expect(await page.textContent("#mwk-crossings .mwrel__h")).toBe("Abzweige und Unterbrechungen");
      const row = page.locator(`#mwk-crossings .mwrel__row:has(a.shield[href^="${motorwayPath("de", "A2")}/"])`);
      expect(await row.textContent()).toMatch(/die A7 beginnt oder endet bei .+ an ihr/u);
      const rowLamp = colourOf(await row.locator(".mw-lamp").getAttribute("class"));
      // the precondition, unconditionally: the A2's page was read first, so its lamp there is judged — never grey (a grey
      // row would make the comparison below a comparison of two "unknown"s)
      expect(rowLamp).not.toBe("grey");
      expect(rowLamp).not.toBe("none");
      // one click: the A2 centred on its junction there, its own Ampel the row's colour
      await Promise.all([page.waitForURL(/\/de\/autobahn\/a2\/exit-.+/), row.locator("a.shield").click()]);
      expect(await litAmpel(page)).toBe(rowLamp);
      // and the A2 names the A7 back: it branches off the A2 there
      const back = page.locator(`#mwk-crossings .mwrel__row:has(a.shield[href^="${motorwayPath("de", "A7")}/"])`);
      expect(await back.textContent()).toMatch(/zweigt bei .+ von der A2 ab/u);
    } finally {
      await page.close();
    }
  });
});

describe("#1032: the zoomed map's Kreuz shields are keyboard links", () => {
  async function aroundAtStart(): Promise<{ ctx: BrowserContext; page: Page }> {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 1000 }, userAgent: PERSON_UA, geolocation: NEAR_START, permissions: ["geolocation"] });
    const page = await ctx.newPage();
    // the A1's page first, so the A1's lamp at the AD is judged (its one closure lies there: red, #1000's world)
    await page.goto(`${BASE}${motorwayPath("de", "A1")}`, { waitUntil: "load" });
    await page.goto(`${BASE}${motorwayPath("de", "A7")}`, { waitUntil: "load" });
    await page.waitForSelector("#motorway-around svg.mwa__svg .mwc-links a");
    return { ctx, page };
  }

  it("Tab reaches each shield; each is named and links where a row of the crossings card links; Enter lands on the A1 there, its Ampel the shield's lamp", async () => {
    const { ctx, page } = await aroundAtStart();
    try {
      const shields = await page.$$eval("#motorway-around svg.mwa__svg .mwc-links a", (as) => as.map((a) => ({ href: a.getAttribute("href") ?? "", name: a.getAttribute("aria-label") ?? "", lamp: a.querySelector("circle")?.getAttribute("class") ?? null })));
      // more than one shield, unconditionally: the focus-ring check below compares a focused shield with an unfocused one
      expect(shields.length).toBeGreaterThan(1);
      // the map is a group a reader enters, the shields its only content outside the hidden drawing
      expect(await page.getAttribute("#motorway-around svg.mwa__svg", "role")).toBe("group");
      const card = new Set(await cardHrefs(page));
      const atJunction = shields.filter((s) => s.lamp !== null);
      expect(atJunction.length).toBeGreaterThan(0);
      for (const s of atJunction) {
        expect(card.has(s.href), s.href).toBe(true);
        expect(s.name).toMatch(/^A\d+, .+ – Ampel dort: .+$/u);
      }
      // the first shield is in the tab order: Shift+Tab leaves it, Tab comes back to it; then Tab walks every shield in turn
      const active = (): Promise<string> => page.evaluate(() => (document.activeElement?.closest(".mwc-links") ? (document.activeElement.getAttribute("href") ?? "") : "outside the shields"));
      await page.locator("#motorway-around .mwc-links a").first().focus();
      await page.keyboard.press("Shift+Tab");
      expect(await active()).toBe("outside the shields");
      const reached: string[] = [];
      for (let i = 0; i < shields.length; i += 1) {
        await page.keyboard.press("Tab");
        reached.push(await active());
      }
      expect(reached).toEqual(shields.map((s) => s.href));
      // the focus ring is visible: the focused shield's box is drawn with a wider stroke than an unfocused one's
      const ring = await page.evaluate(() => {
        const a = document.activeElement?.querySelector("rect");
        const b = document.querySelector("#motorway-around .mwc-links a:not(:focus) rect");
        return a && b ? [parseFloat(getComputedStyle(a).strokeWidth), parseFloat(getComputedStyle(b).strokeWidth)] : null;
      });
      expect(ring).not.toBeNull();
      expect(ring![0]!).toBeGreaterThan(ring![1]!);
      // Enter on the A1's shield: the A1's page centred on its junction there, its Ampel the shield's lamp
      const a1 = atJunction.find((s) => s.href.startsWith(`${motorwayPath("de", "A1")}/`));
      expect(a1).toBeDefined();
      await page.locator(`#motorway-around .mwc-links a[href="${a1!.href}"]`).focus();
      await Promise.all([page.waitForURL(/\/de\/autobahn\/a1\/exit-.+/), page.keyboard.press("Enter")]);
      const lamp = colourOf(a1!.lamp);
      expect(lamp).not.toBe("none");
      // the precondition, unconditionally: the A1's page was read first and its one closure lies at the AD — red, never grey
      expect(lamp).not.toBe("grey");
      expect(new URL(page.url()).pathname).toBe(a1!.href);
      // the page the link names, as the link names it: read without a position (with one granted, the around block
      // re-renders the main block for the visitor's radius, which is not the exit view the shield's lamp speaks for)
      const plain = await browser.newPage({ userAgent: PERSON_UA });
      try {
        await plain.goto(`${BASE}${a1!.href}`, { waitUntil: "load" });
        expect(await litAmpel(plain)).toBe(lamp);
      } finally {
        await plain.close();
      }
    } finally {
      await ctx.close();
    }
  });

  it("axe finds nothing serious or critical on the linked map", async () => {
    const { ctx, page } = await aroundAtStart();
    try {
      const r = await new AxeBuilder({ page }).include("#motorway-around svg.mwa__svg").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      expect(r.passes.length).toBeGreaterThan(0);
      expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
    } finally {
      await ctx.close();
    }
  });
});
