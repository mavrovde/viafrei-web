/**
 * 2.4.6 against the REAL built shell and the REAL digest (Köln Hbf's fixture board), in a real browser — the owner's
 * "the dashboard must work smoothly without full reloading and lost focus":
 *  - every control of the board (a mode chip, the platform select, the side switch, a suggested destination, a line of
 *    "Linien hier", the reset) applies IN PLACE: no navigation (a marker set on `window` survives), the address follows
 *    (`replaceState`), and focus is back on the control that was used;
 *  - "Weitere Abfahrten" stays open across the card's in-place refresh;
 *  - the "Ziel" box and the station search suggest as you type, with the place search's keys;
 *  - a part that was not ready inside the page's deadline is filled in place from the page itself (no navigation).
 * Measured in the Linux image only.
 */
import type { ChildProcess } from "node:child_process";
import { createServer, request, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { stationPath } from "../src/site/stations.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8946;
const SLOW_PORT = 8947;
const BASE = `http://127.0.0.1:${String(PORT)}`;
const SLOW = `http://127.0.0.1:${String(SLOW_PORT)}`;
const CARD = "#pcard-station-board";
/** No wait above 2 s (owner 2026-10-26). */
const WAIT = { timeout: 2000 } as const;
let browser: Browser;
let shell: ChildProcess;
let slowShell: ChildProcess;
let digest: Awaited<ReturnType<typeof startRealDigest>>;
let proxy: Server;
/** How many station live parts / area answers the proxy still holds past the shell's deadline. */
let holdLive = 0;
let holdArea = 0;

beforeAll(async () => {
  digest = await startRealDigest();
  // a proxy in front of the digest that holds the next live part (or area) past the shell's deadline, then passes on
  proxy = createServer((req, res) => {
    const path = req.url ?? "";
    const hold = (/\/internal\/station\/[a-z0-9-]+\/live/.test(path) && holdLive-- > 0) || (/\/internal\/station\/[a-z0-9-]+\/area\?/.test(path) && holdArea-- > 0);
    const pass = (): void => {
      const up = request(`${digest.url}${path}`, { method: req.method, headers: req.headers }, (r) => {
        res.writeHead(r.statusCode ?? 502, r.headers);
        r.pipe(res);
      });
      up.on("error", () => res.destroy());
      req.pipe(up);
    };
    if (hold) setTimeout(pass, 1_200);
    else pass();
  });
  await new Promise<void>((r) => proxy.listen(0, "127.0.0.1", r));
  const proxyUrl = `http://127.0.0.1:${String((proxy.address() as AddressInfo).port)}`;
  shell = await startShell(PORT, { DIGEST_URL: digest.url, WEB_TILE_TIMEOUT_MS: "2000" });
  slowShell = await startShell(SLOW_PORT, { DIGEST_URL: proxyUrl, WEB_TILE_TIMEOUT_MS: "800" });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  slowShell?.kill();
  await new Promise((r) => proxy?.close(r));
  await digest?.close();
});

const open = async (query = "", base = BASE): Promise<Page> => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  ctx.setDefaultTimeout(2000);
  const page = await ctx.newPage();
  await page.goto(`${base}${stationPath("de", "koeln-hbf")}${query}`, { waitUntil: "networkidle" });
  // a full navigation would lose this
  await page.evaluate(() => ((window as unknown as { __vfMark: number }).__vfMark = 246));
  return page;
};
const notReloaded = (page: Page): Promise<boolean> => page.evaluate(() => (window as unknown as { __vfMark?: number }).__vfMark === 246);
const focused = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const a = document.activeElement as HTMLInputElement | HTMLAnchorElement | null;
    if (a === null) return "";
    return `${a.tagName.toLowerCase()}|${a.getAttribute("name") ?? ""}|${(a as HTMLInputElement).value ?? ""}|${a.getAttribute("href") ?? ""}`;
  });
const params = (page: Page): URLSearchParams => new URL(page.url()).searchParams;
const column = (page: Page, i: number): Promise<string[]> =>
  page.$$eval(`${CARD} .stlive__panel:not([hidden]) table.stlive__board tbody tr`, (rows, n) => rows.map((r) => (r as HTMLTableRowElement).cells[n]?.textContent?.trim() ?? ""), i);

describe("2.4.6 item 4 / P0 (c): the board's controls apply in place and keep focus", () => {
  it("a mode chip: no navigation, the address follows, focus stays on the chip's input", async () => {
    const page = await open();
    await Promise.all([page.waitForURL(/mode=tram/, WAIT), page.locator(`${CARD} fieldset.stlive__modes label.chip`, { hasText: "Straßenbahn" }).click()]);
    await page.waitForFunction(() => document.querySelectorAll("#pcard-station-board .stlive__panel:not([hidden]) table.stlive__board tbody tr").length === 1, null, WAIT);
    await page.waitForFunction(() => (document.activeElement as HTMLInputElement | null)?.name === "mode", null, WAIT);
    expect(await notReloaded(page)).toBe(true);
    expect(params(page).get("mode")).toBe("tram");
    expect(await focused(page)).toBe("input|mode|tram|");
    expect(await column(page, 2)).toEqual(["Bonn-Bad Godesberg"]);
    await page.context().close();
  });

  it("the platform select and the side switch: in place, focus kept, the other choices kept", async () => {
    const page = await open("?mode=regional");
    await Promise.all([page.waitForURL(/platform=4/, WAIT), page.selectOption(`${CARD} select[name="platform"]`, "4")]);
    // the board is swapped when its answer arrives; focus is back on the select then
    await page.waitForFunction(() => (document.activeElement as HTMLSelectElement | null)?.name === "platform", null, WAIT);
    expect(await focused(page)).toMatch(/^select\|platform\|4\|/);
    // #1147: the side switch is the Abfahrten | Ankünfte tab list; the chosen tab keeps the focus across the swap
    await Promise.all([page.waitForURL(/side=arr/, WAIT), page.click(`${CARD} [role="tab"]#pcard-station-board-tab-arr`)]);
    await page.waitForFunction(() => document.querySelector("#pcard-station-board h2.pcard__title")?.textContent?.trim() === "Ankunft", null, WAIT);
    await page.waitForFunction(() => document.activeElement?.id === "pcard-station-board-tab-arr", null, WAIT);
    expect(params(page).get("mode")).toBe("regional");
    expect(await page.getAttribute(`${CARD} #pcard-station-board-tab-arr`, "aria-selected")).toBe("true");
    expect(await page.isHidden(`${CARD} #pcard-station-board-dep`)).toBe(true);
    expect(await notReloaded(page)).toBe(true);
    await page.context().close();
  });

  it("a suggested destination and a line of 'Linien hier' apply in place; the reset too", async () => {
    const page = await open();
    const chip = page.locator(`${CARD} p.stlive__dests a.chip`).first();
    const name = (await chip.locator('span[translate="no"]').textContent())?.trim() ?? "";
    await Promise.all([page.waitForURL(/to=/, WAIT), chip.click()]);
    await page.waitForFunction((n) => [...document.querySelectorAll("#pcard-station-board .stlive__panel:not([hidden]) table.stlive__board tbody tr")].every((r) => ((r as HTMLTableRowElement).cells[2]?.textContent ?? "").includes(n)), name, WAIT);
    expect(params(page).get("to")).toBe(name);
    expect(await notReloaded(page)).toBe(true);
    const line = page.locator("p.stlive__lines a").first();
    const label = (await line.textContent())?.trim() ?? "";
    await Promise.all([page.waitForURL(/line=/, WAIT), line.click()]);
    expect(params(page).get("line")).toBe(label);
    expect(await line.getAttribute("aria-current")).toBe("true");
    expect(await focused(page)).toMatch(/^a\|\|\|\/de\/station\/koeln-hbf\?line=/);
    expect(await notReloaded(page)).toBe(true);
    await Promise.all([page.waitForURL((u) => !u.search.includes("to="), WAIT), page.click(`${CARD} a.stlive__reset`)]);
    expect(await notReloaded(page)).toBe(true);
    await page.context().close();
  });

  it("'Weitere Abfahrten' stays open across the card's in-place refresh (item 3)", async () => {
    const page = await open();
    await page.click(`${CARD} details.pcard__more--rows > summary`);
    await page.click(`${CARD} .pcard__refresh`);
    await page.waitForFunction(() => document.querySelector("#pcard-station-board")?.getAttribute("aria-busy") !== "true", null, WAIT);
    expect(await page.evaluate(() => document.querySelector<HTMLDetailsElement>("#pcard-station-board details.pcard__more--rows")?.open)).toBe(true);
    expect(await notReloaded(page)).toBe(true);
    await page.context().close();
  });
});

describe("2.4.6 items 2/5: type-ahead", () => {
  it("the 'Ziel' box lists the board's own names; ↓ moves into the list, ↑ back to the box, a pick applies in place", async () => {
    const page = await open();
    const box = page.locator(`${CARD} input[name="to"]`);
    const list = page.locator(`${CARD} .sheet__results`);
    await box.click();
    await box.pressSequentially("bo", { delay: 20 });
    await page.waitForFunction(() => !document.querySelector<HTMLElement>("#pcard-station-board .sheet__results")?.hidden, null, WAIT);
    expect(await box.getAttribute("aria-expanded")).toBe("true");
    await box.press("ArrowDown");
    const opt = await focused(page);
    expect(opt).toMatch(/^a\|\|/);
    await page.keyboard.press("ArrowUp");
    expect(await focused(page)).toMatch(/^input\|to\|/);
    await box.press("ArrowDown");
    await Promise.all([page.waitForURL(/to=/, WAIT), page.keyboard.press("Enter")]);
    expect(await notReloaded(page)).toBe(true);
    expect(await list.isHidden()).toBe(true);
    await page.context().close();
  });

  it("the station search suggests stations as you type; Esc closes the list and keeps the field", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    ctx.setDefaultTimeout(2000);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/de/station`, { waitUntil: "networkidle" });
    // the station search in the page (the header's site search, #1111, is a search form of its own)
    expect(await page.locator("main form[role=search] button").count()).toBe(0);
    const box = page.locator('main form[role=search] input[role="combobox"]').first();
    await box.click();
    await box.pressSequentially("Köl", { delay: 20 });
    // the page's own list: the header's recent-place chips are links of the same class, folded away on a desktop (#1180)
    await page.waitForSelector("main form[role=search] ~ * a.place-opt, .sheet__results a.place-opt", WAIT);
    expect(await page.locator(".sheet__results a.place-opt").first().getAttribute("href")).toMatch(/^\/de\/station\//);
    await box.press("Escape");
    expect(await page.locator(".sheet__results a.place-opt").count()).toBe(0);
    expect(await focused(page)).toMatch(/^input\|/);
    await ctx.close();
  });
});

describe("2.4.6 P0 (a): a part past the page's deadline loads in place", () => {
  it("the live part held past the deadline: the page answers 200 with its loading block, then the board stands in its place", async () => {
    holdLive = 1;
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    ctx.setDefaultTimeout(2000);
    const page = await ctx.newPage();
    const res = await page.goto(`${SLOW}${stationPath("de", "koeln-hbf")}`, { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBe(200);
    expect(await page.locator("section#station-live.stpart--loading").count()).toBe(1);
    await page.evaluate(() => ((window as unknown as { __vfMark: number }).__vfMark = 246));
    await page.waitForSelector(`${CARD} table.stlive__board`, WAIT);
    expect(await page.locator("section#station-live.stpart--loading").count()).toBe(0);
    expect(await notReloaded(page)).toBe(true);
    await ctx.close();
  });

  it("the place cards held past the deadline: their loading block, then the cards in place", async () => {
    holdArea = 1;
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    ctx.setDefaultTimeout(2000);
    const page = await ctx.newPage();
    const res = await page.goto(`${SLOW}${stationPath("de", "koeln-hbf")}`, { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBe(200);
    expect(await page.locator("section#place-cards.stpart--loading").count()).toBe(1);
    await page.waitForSelector("section#place-cards article.pcard", WAIT);
    expect(await page.locator("section#place-cards.stpart--loading").count()).toBe(0);
    await ctx.close();
  });
});
