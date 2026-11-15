/**
 * #1092 against the REAL built shell and the REAL digest (Köln Hbf's fixture board: an RE from bus stand 85, an ICE
 * at 8 D-G, a KVB tram at its platform 11, the register's tracks 1–11): real tracks only under "Gleis", the filters
 * apply on change with no Apply button, every choice is in the address and comes back from it, the reset clears them,
 * the departures/arrivals switch, and a browser without scripts filters through the <noscript> button. The source half
 * is `packages/digest/src/presentation/station-board-filters-1092.test.ts`. Measured in the Linux image only.
 */
import type { ChildProcess } from "node:child_process";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { stationPath } from "../src/site/stations.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8934;
const BASE = `http://127.0.0.1:${String(PORT)}`;
const CARD = "#pcard-station-board";
/** No wait above 2 s (owner 2026-10-26): a filter that does not apply is red within it. */
const WAIT = { timeout: 2000 } as const;
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

const open = async (query = "", js = true): Promise<Page> => {
  const ctx = await browser.newContext({ javaScriptEnabled: js, viewport: { width: 1280, height: 900 } });
  ctx.setDefaultTimeout(2000);
  const page = await ctx.newPage();
  await page.goto(`${BASE}${stationPath("de", "koeln-hbf")}${query}`, { waitUntil: js ? "networkidle" : "domcontentloaded" });
  return page;
};
/** The text of one board column, every row (the folded rest included). */
const column = (page: Page, i: number): Promise<string[]> =>
  page.$$eval(`${CARD} .stlive__panel:not([hidden]) table.stlive__board tbody tr`, (rows, n) => rows.map((r) => (r as HTMLTableRowElement).cells[n]?.textContent?.trim() ?? ""), i);
const params = (page: Page): URLSearchParams => new URL(page.url()).searchParams;
/**
 * 2.4.6: a choice applies IN PLACE — the address follows at once (`replaceState`) and the board is swapped when its
 * answer arrives (the card is `aria-busy` until then), so a test reads the board after it settled, never before.
 */
const settled = (page: Page): Promise<unknown> => page.waitForFunction(() => document.querySelector("#pcard-station-board")?.getAttribute("aria-busy") !== "true", null, WAIT);

describe("#1092: the board's places", () => {
  it("a track is Gleis, a tram platform a Steig, stand 85 a Bussteig of the replacement bus — never 'Gleis 85'", async () => {
    const page = await open();
    const places = await column(page, 3);
    expect(places).toContain("Gleis 8 D-G");
    expect(places).toContain("Steig 11");
    expect(places).toContain("Bussteig 85 (Ersatzverkehr)");
    expect(places.some((p) => /^Gleis 8[3-9]/.test(p))).toBe(false);
    await page.context().close();
  });
});

describe("#1092: the filters apply on change and live in the address", () => {
  it("a mode chip applies at once, with no Apply button visible; its count is shown; the rows follow it", async () => {
    const page = await open();
    expect(await page.isVisible(`${CARD} form.stlive__filter button[type=submit]`)).toBe(false);
    const tram = page.locator(`${CARD} fieldset.stlive__modes label.chip`, { hasText: "Straßenbahn" });
    expect((await tram.textContent())?.replace(/\s+/g, " ")).toMatch(/Straßenbahn 1/);
    await Promise.all([page.waitForURL(/mode=tram/, WAIT), tram.click()]);
    await settled(page);
    expect(params(page).get("mode")).toBe("tram");
    expect(await column(page, 2)).toEqual(["Bonn-Bad Godesberg"]);
    expect(await page.isChecked(`${CARD} input[name="mode"][value="tram"]`)).toBe(true);
    await page.context().close();
  });

  it("a platform choice applies on change; Ankunft switches the board and keeps the other choices", async () => {
    const page = await open("?mode=regional");
    await Promise.all([page.waitForURL(/platform=4/, WAIT), page.selectOption(`${CARD} select[name="platform"]`, "4")]);
    await settled(page);
    expect(params(page).get("mode")).toBe("regional");
    await Promise.all([page.waitForURL(/side=arr/, WAIT), page.click(`${CARD} [role="tab"]#pcard-station-board-tab-arr`)]);
    await settled(page);
    expect(params(page).get("side")).toBe("arr");
    expect(params(page).get("mode")).toBe("regional");
    expect((await page.textContent(`${CARD} h2.pcard__title`))?.trim()).toBe("Ankunft");
    await page.context().close();
  });

  it("every choice comes back from the address: the controls show it, and the reset clears every one", async () => {
    const page = await open("?side=arr&mode=sbahn&time=30&issues=0&to=Herkunft");
    expect(await page.getAttribute(`${CARD} #pcard-station-board-tab-arr`, "aria-selected")).toBe("true");
    expect(await page.isChecked(`${CARD} input[name="mode"][value="sbahn"]`)).toBe(true);
    expect(await page.inputValue(`${CARD} select[name="time"]`)).toBe("30");
    expect(await page.inputValue(`${CARD} input[name="to"]`)).toBe("Herkunft");
    await Promise.all([page.waitForURL((u) => u.search === "", WAIT), page.click(`${CARD} a.stlive__reset`)]);
    await settled(page);
    expect(await page.isChecked(`${CARD} input[name="mode"][value=""]`)).toBe(true);
    expect(await page.$(`${CARD} a.stlive__reset`)).toBeNull();
    await page.context().close();
  });

  it("a suggested destination is a link that applies it", async () => {
    const page = await open();
    const chip = page.locator(`${CARD} p.stlive__dests a.chip`).first();
    const name = (await chip.locator('span[translate="no"]').textContent())?.trim() ?? "";
    expect(name).not.toBe("");
    await Promise.all([page.waitForURL(/to=/, WAIT), chip.click()]);
    await settled(page);
    expect(params(page).get("to")).toBe(name);
    for (const d of await column(page, 2)) expect(d).toContain(name);
    await page.context().close();
  });

  it("without JavaScript: the <noscript> button applies the form", async () => {
    const page = await open("", false);
    await page.check(`${CARD} input[name="mode"][value="tram"]`);
    await Promise.all([page.waitForURL(/mode=tram/, WAIT), page.click(`${CARD} form.stlive__filter button[type=submit]`)]);
    expect(await column(page, 2)).toEqual(["Bonn-Bad Godesberg"]);
    await page.context().close();
  });
});
