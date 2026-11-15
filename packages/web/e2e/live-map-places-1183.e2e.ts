/**
 * #1183 part 5 against the BUILT shell and the REAL digest (`real-digest.ts`), in Chromium: the one live map on the Land
 * pages, the road pages and the home.
 *
 *  - a Land page: its map card is the live map cropped to the Land (its own id, a viewBox that is not Germany's), made
 *    live by the inline script; Bahn turned on draws the dots under the figure's own ids;
 *  - a road page: the live map cropped around the road's items, under its own map heading;
 *  - the home: the slot is filled by the loader (the figure, then the same script as a file), the home's raw bytes stay
 *    under the bound of `tiles.e2e.ts`, and the map goes live;
 *  - two maps on one page: a second figure put on a Land page and the script added again makes the second live without
 *    touching the first, and no id is shared;
 *  - the first paint of a Land page's map under the two-second ceiling, throttled (Lighthouse's mobile figures).
 */
import type { ChildProcess } from "node:child_process";
import { gzipSync } from "node:zlib";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";
import { hasLiveMap } from "../src/lib/live-map.js";

const PORT = 8834;
const BASE = `http://127.0.0.1:${PORT}`;
let browser: Browser;
let shell: ChildProcess;
let digest: Awaited<ReturnType<typeof startRealDigest>>;

beforeAll(async () => {
  digest = await startRealDigest();
  shell = await startShell(PORT, { DIGEST_URL: digest.url, IMPRESSUM_NAME: "Site Probe", IMPRESSUM_STREET: "Probeweg 3", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "site@example.invalid" });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
});

const vb = (page: Page, id: string): Promise<string> => page.$eval(`#${id} svg.motorway-overview__svg`, (e) => e.getAttribute("viewBox") ?? "");
const roads = (page: Page, id: string): Promise<string[]> => page.$$eval(`#${id} .lmap__roads path`, (ps) => ps.map((p) => p.id));

describe("#1183 part 5: the one live map on the Land, road and home pages", () => {
  it("a Land page: the live map cropped to the Land, live, its dots under its own ids", async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/de/state/bayern`);
    await page.waitForSelector("#lmap-land.lmap--live", { timeout: 2000 });
    expect(await page.$$eval("#state-map figure.lmap", (fs) => fs.map((f) => f.id))).toEqual(["lmap-land"]);
    expect(await vb(page, "lmap-land")).not.toBe("0 0 650 870");
    const ids = await roads(page, "lmap-land");
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((i) => i.startsWith("lmap-land-A"))).toBe(true);
    await page.locator("#lmap-land input[name=rail]").click();
    await page.waitForSelector("#lmap-land .lmap__stations circle", { state: "attached", timeout: 2000 });
    expect(await page.$$eval("#lmap-land .lmap__stations circle", (cs) => cs.map((c) => c.id))).toEqual(["lmap-land-lms-koeln-hbf", "lmap-land-lms-kassel-hbf"]);
    // the dots are scaled to the crop (smaller than the national 2.2)
    expect(Number(await page.$eval("#lmap-land .lmap__stations circle", (c) => c.getAttribute("r")))).toBeLessThan(2.2);
    await page.evaluate(() => localStorage.removeItem("viafrei.lmap"));
    await page.close();
  });

  it("a road page: the live map cropped around the road, under its own heading", async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/de/road/b51`);
    await page.waitForSelector("#lmap-road.lmap--live", { timeout: 2000 });
    expect(await page.$eval("h2#road-map", (h) => h.textContent)).toBeTruthy();
    expect(await vb(page, "lmap-road")).not.toBe("0 0 650 870");
    expect((await roads(page, "lmap-road")).length).toBeGreaterThan(0);
    await page.close();
  });

  it("the home: the loader fills the slot, adds the same script as a file, and the map goes live", async () => {
    const html = await (await fetch(`${BASE}/`)).text();
    expect(html).toContain('id="lmap-home-slot" hidden');
    expect(html).not.toContain('id="lmap-home"');
    console.log(`#1183 part 5 measured: home raw html ${String(html.length)} B`);
    expect(html.length).toBeLessThan(268_000);
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const js = page.waitForResponse((r) => r.url().includes("/fragment/live-map.js?"));
    await page.goto(`${BASE}/`);
    const r = await js;
    expect([r.status(), r.headers()["cache-control"]]).toEqual([200, "public, max-age=86400"]);
    await page.waitForSelector("#lmap-home.lmap--live", { state: "attached", timeout: 2000 });
    expect(await page.$eval("#lmap-home-slot", (e) => (e as HTMLElement).hidden)).toBe(false);
    expect(await vb(page, "lmap-home")).toBe("0 0 650 870");
    expect((await roads(page, "lmap-home")).every((i) => i.startsWith("lmap-home-A"))).toBe(true);
    await page.close();
  });

  it("two maps on one page: the second goes live on its own, the first untouched, no id shared", async () => {
    const ctx = await browser.newContext({ bypassCSP: true });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/de/state/bayern`);
    await page.waitForSelector("#lmap-land.lmap--live", { timeout: 2000 });
    const before = await vb(page, "lmap-land");
    // what the home's loader does: the figure into a slot, then the script as a file
    await page.evaluate(async () => {
      const t = await (await fetch("/fragment/live-map?lang=de")).text();
      const slot = document.createElement("div");
      slot.innerHTML = t;
      document.querySelector("main")!.appendChild(slot);
    });
    // the script file as the home's loader adds it (the test's own tag: the context bypasses the CSP, the page does not)
    const v = /"v":"([A-Za-z0-9_-]+)"/.exec(await (await fetch(`${BASE}/`)).text())?.[1] ?? "";
    await page.addScriptTag({ url: `/fragment/live-map.js?lang=de&v=${v}` });
    await page.waitForSelector("#lmap-home.lmap--live", { state: "attached", timeout: 2000 });
    expect(await page.$$eval("figure.lmap[data-live]", (fs) => fs.map((f) => f.id))).toEqual(["lmap-land", "lmap-home"]);
    expect(await vb(page, "lmap-land")).toBe(before);
    const ids = await page.$$eval("[id]", (es) => es.map((e) => e.id));
    expect(ids.length).toBe(new Set(ids).size);
    // the first map's toggle moves the first map only
    await page.locator("#lmap-land input[name=works]").click();
    expect(await page.locator("#lmap-home input[name=works]").isChecked()).toBe(true);
    await ctx.close();
  });

  it("the Land and road pages with the map stay inside the page budget (200 KB gzip)", async () => {
    for (const path of ["/de/state/bayern", "/de/road/b51"]) {
      const html = await (await fetch(`${BASE}${path}`)).text();
      const gz = gzipSync(html).length;
      console.log(`#1183 part 5 measured: ${path} ${String(html.length)} B raw, ${String(gz)} B gzip`);
      expect(hasLiveMap(html), path).toBe(true);
      expect(gz).toBeLessThan(200 * 1024);
    }
  });

  it("a Land page's map paints under the two-second ceiling, throttled", async () => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    const cdp = await ctx.newCDPSession(p);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    const t0 = Date.now();
    await p.goto(`${BASE}/de/state/bayern`, { waitUntil: "commit" });
    await p.waitForSelector("#lmap-land svg.motorway-overview__svg", { state: "attached", timeout: 2000 });
    const painted = Date.now() - t0;
    await p.waitForSelector("#lmap-land.lmap--live", { timeout: 4000 });
    console.log(`#1183 part 5 measured: Land page map in the DOM ${String(painted)} ms, live ${String(Date.now() - t0)} ms (throttled)`);
    expect(painted).toBeLessThan(2000);
    await ctx.close();
  });
});
