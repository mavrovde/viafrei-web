/**
 * #1183 against the BUILT shell and the REAL digest (`real-digest.ts`), in Chromium: the motorway index's live map.
 *
 *  - AC 2: without a script the figure is the server's (controls hidden, the two no-script groups); with it the SAME
 *    paths are re-classed — the page holds one path per motorway either way, and the overlay carries no geometry;
 *  - AC 1: each combination of the two toggles prints exactly its sources' lines (the payload's, chosen by the toggles);
 *  - AC 8: nothing is stored until a toggle is clicked; the click's choice is there on the next visit;
 *  - AC 4: a click on a motorway line and Enter on a focused one open its page; Tab walks the lines in the list's
 *    order; axe reports nothing serious or critical on the live map;
 *  - zoom by the wheel, the keyboard and the buttons; AC 5 through the browser: the slider at 08:00 draws the fixture's
 *    A1 closure and says the frame is not current, at 09:00 the A1 is not closed;
 *  - AC 7: a phone at 375×812 pinches and pans the map with two fingers and the page does not scroll under them;
 *  - AC 6: the page's transfer and the map's first paint under a throttled profile (Lighthouse's mobile figures: 4×
 *    CPU, 150 ms RTT, 1.6 Mbit/s), asserted under the two-second ceiling, and printed.
 */
import type { ChildProcess } from "node:child_process";
import { gzipSync } from "node:zlib";
import { AxeBuilder } from "@axe-core/playwright";
import { LICENCE_CATALOGUE } from "@viafrei/ingest";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8833;
const BASE = `http://127.0.0.1:${PORT}`;
const INDEX = `${BASE}/de/autobahn`;
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

const line = (id: string): string => LICENCE_CATALOGUE[id]!.attribution!;
const live = async (page: Page): Promise<void> => {
  await page.goto(INDEX);
  await page.waitForSelector("#lmap.lmap--live", { timeout: 2000 });
};
/** The roads drawn in one state group. */
const inState = (page: Page, state: string): Promise<string[]> => page.$$eval(`#lmap .lmap__st--${state} use`, (us) => us.map((u) => (u.getAttribute("href") ?? "").replace("#lmap-", "")));
const credits = (page: Page): Promise<string> => page.$eval("#lmap .motorway__mapsrc", (e) => e.textContent ?? "");
const viewBox = (page: Page): Promise<string> => page.$eval("#lmap svg.motorway-overview__svg", (e) => e.getAttribute("viewBox") ?? "");
const setLayer = async (page: Page, name: "roads" | "works" | "rail" | "warn" | "sa", on: boolean): Promise<void> => {
  const box = page.locator(`#lmap input[name=${name}]`);
  if ((await box.isChecked()) !== on) await box.click();
};

describe("#1183 the live map on the motorway index", () => {
  it("AC 2: without a script, the server's figure — controls hidden, one path per motorway, the hot ones by reference", async () => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(INDEX);
    expect(await page.$eval("#lmap .lmap__bar", (e) => (e as HTMLElement).hidden)).toBe(true);
    const roads = await page.$$eval("#lmap .lmap__roads a > path", (ps) => ps.length);
    expect(roads).toBeGreaterThan(5);
    expect(await page.$$eval("#lmap path[d]", (ps) => ps.length)).toBe(roads + 2);
    expect(await page.$$eval("#lmap .lmap__hot use", (us) => us.length)).toBeGreaterThan(0);
    await ctx.close();
  });

  it("AC 2/3: with the script the same paths are coloured from the overlay, which carries no geometry", async () => {
    const page = await browser.newPage();
    const overlay = page.waitForResponse((r) => r.url().includes("/fragment/motorway-overlay"));
    await live(page);
    const body = await (await overlay).text();
    expect(gzipSync(body).length).toBeLessThan(30 * 1024);
    expect(body).not.toMatch(/"M\d|"(?:lat|lon|d)"/);
    // the fixture's A7 is closed, its A1 has roadworks only
    expect(await inState(page, "closure")).toContain("A7");
    expect(await inState(page, "roadworks")).toContain("A1");
    expect(await page.$eval("#lmap .lmap__hot", (e) => e.getAttribute("display"))).toBe("none");
    const roads = await page.$$eval("#lmap .lmap__roads a > path", (ps) => ps.length);
    expect(await page.$$eval("#lmap path[d]", (ps) => ps.length)).toBe(roads + 2);
    await page.close();
  });

  it("AC 1: each toggle combination prints exactly its sources' lines", async () => {
    const page = await browser.newPage();
    await live(page);
    // the two geometry layers fetched once (a layer whose geometry has not arrived counts as off), then all sixteen
    await setLayer(page, "rail", true);
    await setLayer(page, "warn", true);
    await page.waitForSelector("#lmap .lmap__stations circle", { state: "attached", timeout: 2000 });
    await page.waitForSelector("#lmap .lmap__kreise path", { state: "attached", timeout: 2000 });
    const parts: Record<string, string> = { bkg_vg2500: line("bkg_vg2500"), bast_lcl: line("bast_lcl"), autobahn: line("autobahn"), dbinfrago_streckennetz: "DB InfraGO AG, Bahn-Geodaten / 2026", db_stada: line("db_stada"), dwd: "Datenbasis: Deutscher Wetterdienst, zusammengefasst" };
    for (let n = 0; n < 16; n += 1) {
      const k = n.toString(2).padStart(4, "0");
      const [r, w, b, d] = [...k].map((c) => c === "1");
      await setLayer(page, "roads", r!);
      await setLayer(page, "works", w!);
      await setLayer(page, "rail", b!);
      await setLayer(page, "warn", d!);
      const want = ["bkg_vg2500", ...(r || w ? ["bast_lcl", "autobahn"] : []), ...(b ? ["dbinfrago_streckennetz", "db_stada"] : []), ...(d ? ["dwd"] : [])];
      const text = await credits(page);
      for (const id of Object.keys(parts)) expect(text.includes(parts[id]!), `${k} ${id}`).toBe(want.includes(id));
      expect(text, k).not.toContain("Quelle: Deutscher Wetterdienst");
    }
    await setLayer(page, "rail", false);
    await setLayer(page, "warn", false);
    // motorway layer off, roadworks on: only roadworks drawn, and the closed A7 has roadworks too
    await setLayer(page, "roads", false);
    await setLayer(page, "works", true);
    expect(await inState(page, "closure")).toEqual([]);
    expect(await inState(page, "roadworks")).toContain("A7");
    await page.close();
  });

  it("AC 8: nothing is stored on load; a click stores the toggles, and the next visit applies them", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await live(page);
    expect(await page.evaluate(() => localStorage.getItem("viafrei.lmap"))).toBeNull();
    await page.locator("#lmap input[name=works]").click();
    expect(JSON.parse((await page.evaluate(() => localStorage.getItem("viafrei.lmap"))) ?? "null")).toEqual({ r: 1, w: 0, b: 0, d: 0, s: 0 });
    await live(page);
    expect(await page.locator("#lmap input[name=works]").isChecked()).toBe(false);
    expect(await inState(page, "roadworks")).toEqual([]);
    await ctx.close();
  });

  it("LM1–LM18: the rail layer's dots link their stations, the warned Kreis is coloured, the CC BY-SA layer is its own svg", async () => {
    const page = await browser.newPage();
    await live(page);
    expect(await page.locator("#lmap input[name=sa]").isDisabled()).toBe(true);
    const rail = page.waitForResponse((r) => r.url().includes("/fragment/map-layer?l=rail"));
    await setLayer(page, "rail", true);
    expect((await rail).headers()["cache-control"]).toBe("public, max-age=86400");
    await page.waitForSelector("#lmap .lmap__stations circle", { state: "attached", timeout: 2000 });
    expect(await page.$$eval("#lmap .lmap__stations a", (as) => as.map((a) => [a.getAttribute("href"), a.getAttribute("aria-label")]))).toEqual([["/de/station/koeln-hbf", "Köln Hbf"], ["/de/station/kassel-hbf", "Kassel Hbf"]]);
    await setLayer(page, "warn", true);
    await page.waitForSelector("#lmap .lmap__kreise path.lmap__warn--2", { state: "attached", timeout: 2000 });
    expect(await page.$$eval("#lmap .lmap__kreise path[class^=lmap__warn--]", (ps) => ps.map((p) => p.id))).toEqual(["lmap-lmk-05315"]);
    expect(await page.$eval("#lmap .lmap__twin", (e) => e.textContent ?? "")).toMatch(/Köln.*STURMBÖEN/);
    expect(await page.locator("#lmap input[name=sa]").isDisabled()).toBe(false);
    const sa = page.waitForResponse((r) => r.url().includes("/fragment/map-layer?l=sa"));
    await setLayer(page, "sa", true);
    expect((await sa).headers()["cache-control"]).toBe("no-cache");
    await page.waitForSelector("#lmap svg.lmap__sa use", { state: "attached", timeout: 2000 });
    expect(await page.$$eval("#lmap svg.lmap__sa use", (us) => us.map((u) => [u.getAttribute("href"), u.getAttribute("class")]))).toEqual([["#lmap-lms-koeln-hbf", "lmap__sa--bad"]]);
    const src = await page.$eval("#lmap .lmap__sasrc", (e) => e.textContent ?? "");
    expect(src).toContain("CC BY-SA 4.0");
    expect(src).toContain(line("delfi_siri_et"));
    // LM12: nothing of the CC BY-SA layer in the base svg, and its credit block is not the base one
    expect(await page.$eval("#lmap svg.motorway-overview__svg", (e) => e.outerHTML)).not.toMatch(/BY-SA|lmap__sa/);
    expect(await credits(page)).not.toContain("CC BY-SA");
    expect(JSON.parse((await page.evaluate(() => localStorage.getItem("viafrei.lmap"))) ?? "null")).toEqual({ r: 1, w: 1, b: 1, d: 1, s: 1 });
    await page.evaluate(() => localStorage.removeItem("viafrei.lmap"));
    await page.close();
  });

  it("AC 4: a click on a line and Enter on a focused one open its page; Tab walks the lines in the list's order; axe clean", async () => {
    const ctx = await browser.newContext(); // axe refuses a page made by browser.newPage()
    const page = await ctx.newPage();
    await live(page);
    // a point on the A7's own path inside the viewport, the topmost element there being its link
    await page.locator("#lmap svg.motorway-overview__svg").scrollIntoViewIfNeeded();
    const pt = await page.$eval("#lmap-A7", (p) => {
      const path = p as SVGPathElement;
      const m = path.getScreenCTM()!;
      for (let f = 0.02; f < 1; f += 0.02) {
        const q = path.getPointAtLength(path.getTotalLength() * f);
        const x = m.a * q.x + m.c * q.y + m.e;
        const y = m.b * q.x + m.d * q.y + m.f;
        const hit = document.elementFromPoint(x, y);
        if (hit === path || hit?.closest("a") === path.parentElement) return { x, y };
      }
      return null;
    });
    expect(pt).not.toBeNull();
    await Promise.all([page.waitForURL(/\/de\/autobahn\/a7$/), page.mouse.click(pt!.x, pt!.y)]);
    await live(page);
    // the list's order: the index's rows, first shield of each
    const list = await page.$$eval("ul.motorway-index > li", (lis) => lis.map((li) => li.querySelector("a.shield")?.getAttribute("href") ?? ""));
    const lines = await page.$$eval("#lmap .lmap__roads a", (as) => as.map((a) => a.getAttribute("href") ?? ""));
    expect(lines).toEqual(list.filter((h) => lines.includes(h)));
    await page.focus("#lmap svg.motorway-overview__svg");
    expect(await page.evaluate(() => document.activeElement?.matches("#lmap svg.motorway-overview__svg") ?? false)).toBe(true);
    const walked: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      await page.keyboard.press("Tab");
      walked.push(await page.evaluate(() => document.activeElement?.getAttribute("href") ?? `<${document.activeElement?.tagName ?? ""}.${document.activeElement?.getAttribute("class") ?? ""}>`));
    }
    expect(walked).toEqual(lines.slice(0, 3));
    expect(await page.$eval("#lmap .lmap__tip", (e) => [(e as HTMLElement).hidden, e.textContent])).toEqual([false, await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "")]);
    const axe = await new AxeBuilder({ page }).include("#lmap").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
    await Promise.all([page.waitForURL(new RegExp(`${lines[2]!}$`)), page.keyboard.press("Enter")]);
    await ctx.close();
  });

  it("zooms by the keyboard, the buttons and the wheel once the map has focus", async () => {
    const page = await browser.newPage();
    await live(page);
    const full = await viewBox(page);
    await page.focus("#lmap svg.motorway-overview__svg");
    await page.keyboard.press("+");
    const zoomed = await viewBox(page);
    expect(Number(zoomed.split(" ")[2])).toBeLessThan(Number(full.split(" ")[2]));
    await page.keyboard.press("ArrowRight");
    expect(await viewBox(page)).not.toBe(zoomed);
    await page.keyboard.press("0");
    expect(await viewBox(page)).toBe(full);
    await page.locator("#lmap button[name=in]").click();
    expect(await viewBox(page)).not.toBe(full);
    await page.locator("#lmap button[name=reset]").click();
    // the map in the viewport first (focusing an svg does not scroll it there), then the pointer on its centre
    await page.locator("#lmap svg.motorway-overview__svg").scrollIntoViewIfNeeded();
    await page.focus("#lmap svg.motorway-overview__svg");
    const box = (await page.locator("#lmap svg.motorway-overview__svg").boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const under = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x!, y!); return `${e?.tagName ?? "none"}.${e?.getAttribute("class") ?? ""} in-svg=${String(!!e?.closest("svg.motorway-overview__svg"))} focus=${document.activeElement?.tagName ?? ""} sy=${String(window.scrollY)}`; }, [box.x + box.width / 2, box.y + box.height / 2]);
    expect(under).toMatch(/in-svg=true focus=svg/);
    await page.mouse.wheel(0, -400);
    // the wheel is dispatched without waiting for the page to handle it: wait for the viewBox, not read it at once
    await page.waitForFunction((w) => Number(document.querySelector("#lmap svg.motorway-overview__svg")?.getAttribute("viewBox")?.split(" ")[2]) < w, Number(full.split(" ")[2]), { timeout: 1000 });
    await page.close();
  });

  it("AC 5: the slider at 08:00 draws the A1's closure of that hour and says it is not current; at 09:00 it is not closed", async () => {
    const page = await browser.newPage();
    await live(page);
    const hours = await page.$eval("#lmap input[type=range]", (e) => Number((e as HTMLInputElement).max));
    expect(hours).toBeGreaterThan(8);
    const slide = (v: number): Promise<void> =>
      page.$eval(
        "#lmap input[type=range]",
        (e, value) => {
          const r = e as HTMLInputElement;
          r.value = String(value);
          r.dispatchEvent(new Event("input", { bubbles: true }));
        },
        v,
      );
    await slide(8);
    await page.waitForFunction(() => /08:00/.test(document.querySelector("#lmap .lmap__status")?.textContent ?? ""), undefined, { timeout: 2000 });
    expect(await page.$eval("#lmap .lmap__status", (e) => e.textContent)).toBe("Stand 08:00 – nicht aktuell");
    expect(await inState(page, "closure")).toEqual(["A1"]);
    expect(await page.$eval("#lmap", (e) => e.classList.contains("lmap--past"))).toBe(true);
    await slide(9);
    await page.waitForFunction(() => /09:00/.test(document.querySelector("#lmap .lmap__status")?.textContent ?? ""), undefined, { timeout: 2000 });
    expect(await inState(page, "closure")).toEqual([]);
    await slide(hours);
    await page.waitForFunction(() => !document.querySelector("#lmap")?.classList.contains("lmap--past"), undefined, { timeout: 2000 });
    expect(await inState(page, "closure")).toContain("A7");
    await page.close();
  });

  it("AC 7: a phone pinches and pans with two fingers, and the page does not scroll under them", async () => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await live(page);
    await page.locator("#lmap svg.motorway-overview__svg").scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.scrollY);
    const full = await viewBox(page);
    const b = (await page.locator("#lmap svg.motorway-overview__svg").boundingBox())!;
    const cdp = await ctx.newCDPSession(page);
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    const touch = (type: "touchStart" | "touchMove" | "touchEnd", d: number, dy = 0) =>
      cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x: cx - d, y: cy + dy, id: 1 }, { x: cx + d, y: cy + dy, id: 2 }] });
    await touch("touchStart", 20);
    for (let s = 1; s <= 8; s += 1) await touch("touchMove", 20 + s * 10, -s * 12);
    await touch("touchEnd", 0);
    const after = await viewBox(page);
    expect(Number(after.split(" ")[2])).toBeLessThan(Number(full.split(" ")[2]));
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
    await ctx.close();
  });

  it("AC 6: the page and the script within budget; the map's first paint under the two-second ceiling, throttled", async () => {
    const html = await (await fetch(INDEX)).text();
    const page = gzipSync(html).length;
    const script = /<script[^>]*>((?:(?!<\/script>)[\s\S])*querySelectorAll\("figure\.lmap"\)(?:(?!<\/script>)[\s\S])*)<\/script>/.exec(html)?.[1] ?? "";
    expect(script.length).toBeGreaterThan(1000);
    const scriptGz = gzipSync(script).length;
    expect(page).toBeLessThan(200 * 1024);
    expect(scriptGz).toBeLessThan(40 * 1024);
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    const cdp = await ctx.newCDPSession(p);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    const t0 = Date.now();
    await p.goto(INDEX, { waitUntil: "commit" });
    await p.waitForSelector("#lmap svg.motorway-overview__svg", { state: "visible", timeout: 2000 });
    const painted = Date.now() - t0;
    await p.waitForSelector("#lmap.lmap--live", { timeout: 4000 });
    const live = Date.now() - t0;
    console.log(`#1183 measured: page ${String(html.length)} B raw, ${String(page)} B gzip; script ${String(script.length)} B, ${String(scriptGz)} B gzip; throttled map paint ${String(painted)} ms, live ${String(live)} ms`);
    expect(painted).toBeLessThan(2000);
    await ctx.close();
  });
});
