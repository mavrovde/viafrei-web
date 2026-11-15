/**
 * The station page against the REAL built shell and the REAL digest (Köln Hbf's fixture), three asks of 2.4.5:
 *
 *  - #1084: the page carries the place cards of the station's position — the stations card marks "dieser Bahnhof",
 *    since #1109 the charging card read at the station's own point, no lifts card for the station's own lifts — the topic filter hides a card at once, one card's
 *    ↻ asks for that card alone (200, then 304), a dead or slow area is that block's loading state (its error sentence without script) while the rest of the
 *    page renders, and nothing scrolls sideways at 320, 375 and 390 px;
 *  - owner 2026-10-27: every block of the page carries the freshness sign — a data time or date — and its relative
 *    age is written by the island;
 *  - #1094: the lifts card lists every unit (20, production's count at Köln Hbf) with no "more" button, while the
 *    departure board keeps its "more departures" fold (#1091).
 *
 * The source halves are `packages/digest/src/server/station-area-1084.test.ts`,
 * `packages/digest/src/presentation/station-live-freshness.test.ts` and
 * `packages/digest/src/presentation/station-facilities-1094.test.ts`. Measured in the Linux image only.
 */
import type { ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POI_NEEDS } from "@viafrei/ingest";
import { stationPath } from "../src/site/stations.js";
import { NOW, startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8937;
const PROXY_PORT = 8938;
const BASE = `http://127.0.0.1:${String(PORT)}`;
const PROXIED = `http://127.0.0.1:${String(PROXY_PORT)}`;
const KOELN = stationPath("de", "koeln-hbf");
let browser: Browser;
let shell: ChildProcess;
let proxiedShell: ChildProcess;
let digest: Awaited<ReturnType<typeof startRealDigest>>;
let proxy: Server;
/** How the proxy answers the station area: as the digest does, a 503, or later than the shell waits. */
let areaMode: "pass" | "dead" | "slow" = "pass";

beforeAll(async () => {
  digest = await startRealDigest();
  proxy = createServer((req, res) => {
    const url = req.url ?? "/";
    if (url.includes("/area") && areaMode === "dead") {
      res.writeHead(503).end();
      return;
    }
    const forward = async (): Promise<void> => {
      const r = await fetch(`${digest.url}${url}`, { headers: { "if-none-match": String(req.headers["if-none-match"] ?? "") } });
      const headers: Record<string, string> = {};
      r.headers.forEach((v, k) => {
        if (k !== "content-encoding" && k !== "content-length" && k !== "transfer-encoding" && k !== "connection") headers[k] = v;
      });
      res.writeHead(r.status, headers).end(Buffer.from(await r.arrayBuffer()));
    };
    if (url.includes("/area") && areaMode === "slow") setTimeout(() => void forward().catch(() => res.destroy()), 1500);
    else void forward().catch(() => res.destroy());
  });
  await new Promise<void>((r) => proxy.listen(0, "127.0.0.1", () => r()));
  const proxyUrl = `http://127.0.0.1:${String((proxy.address() as AddressInfo).port)}`;
  shell = await startShell(PORT, { DIGEST_URL: digest.url, WEB_TILE_TIMEOUT_MS: "2000" });
  proxiedShell = await startShell(PROXY_PORT, { DIGEST_URL: proxyUrl, WEB_TILE_TIMEOUT_MS: "500" });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  proxiedShell?.kill();
  proxy?.closeAllConnections();
  await new Promise<void>((r) => (proxy ? proxy.close(() => r()) : r()));
  await digest?.close();
});

async function open(o: { readonly width?: number; readonly js?: boolean; readonly base?: string; readonly path?: string; readonly clockAt?: Date } = {}): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ viewport: { width: o.width ?? 390, height: 900 }, javaScriptEnabled: o.js ?? true });
  ctx.setDefaultTimeout(2000);
  const page = await ctx.newPage();
  if (o.clockAt !== undefined) await page.clock.install({ time: o.clockAt });
  await page.goto(`${o.base ?? BASE}${o.path ?? KOELN}`, { waitUntil: o.js === false ? "domcontentloaded" : "networkidle" });
  return { ctx, page };
}

/** The area's cards a visitor sees. */
const shownArea = (page: Page): Promise<string[]> =>
  page.$$eval("#place-slot article.pcard", (cs) => cs.filter((c) => !(c as HTMLElement).hidden && getComputedStyle(c).display !== "none").map((c) => c.id.replace(/^pcard-/u, "")));

describe("#1084: the place cards of the station's position", () => {
  it("the area renders below the station: the stations card marks this station, the station's charging card (#1109), no own-lifts card", async () => {
    const { ctx, page } = await open({ js: false });
    const ids = await shownArea(page);
    expect(ids).toContain("stations");
    expect(ids).toContain("parking");
    // #1109: the charging card is the station's own (read at its StaDa point), since the fixture wires the filtered charging as `http.ts` does (#1081)
    expect(ids).toContain("charging");
    expect(ids).not.toContain("lifts");
    expect((await page.textContent("#pcard-stations .pcard__here"))?.trim()).toBe("dieser Bahnhof");
    expect(await page.getAttribute("#pcard-stations a[aria-current=page]", "href")).toBe(KOELN);
    // the station's own live part is still there, above the area
    expect(await page.locator("#pcard-station-board").count()).toBe(1);
    await ctx.close();
  });

  it("#1085: the station page shows the place Ampel and its map for the station's position, without script too", async () => {
    const { ctx, page } = await open({ js: false });
    const amp = page.locator("#place-slot #place-ampel");
    expect(await amp.count()).toBe(1);
    expect(await amp.isVisible()).toBe(true);
    expect((await page.textContent("#place-ampel .ampel__title"))?.trim()).toMatch(/^Ampel für Köln Hbf/u);
    expect(await page.locator("#place-ampel .ampel__lamp.is-on").count()).toBe(1);
    const map = page.locator("#place-ampel figure.pam svg.pam__svg");
    expect(await map.count()).toBe(1);
    expect((await map.boundingBox())?.width ?? 0).toBeGreaterThan(100);
    // the map is labelled by the Ampel's heading, its own title and its description; the caption credits what was drawn
    expect((await map.getAttribute("aria-labelledby"))?.split(" ")).toHaveLength(3);
    expect((await page.textContent("#place-ampel .pam__cap"))?.length ?? 0).toBeGreaterThan(20);
    // the Ampel stands above the cards it reads
    const [a, c] = await page.evaluate(() => [document.querySelector("#place-ampel")!.getBoundingClientRect().top, document.querySelector("#place-slot .place__cards")!.getBoundingClientRect().top]);
    expect(a).toBeLessThan(c);
    await ctx.close();
  });

  it("the topic filter hides a card at once, the others stay", async () => {
    const { ctx, page } = await open();
    const before = await shownArea(page);
    expect(before).toContain("parking");
    await page.uncheck("#tpf input[value=parking]");
    await expect.poll(() => shownArea(page)).toEqual(before.filter((x) => x !== "parking"));
    await ctx.close();
  });

  it("↻ asks for that area card alone — 200, then 304 — and the page is not reloaded", async () => {
    const { ctx, page } = await open();
    const seen: { url: string; status: number }[] = [];
    page.on("response", (r) => {
      if (r.url().includes("/fragment/card?")) seen.push({ url: r.url(), status: r.status() });
    });
    await page.evaluate(() => {
      (window as unknown as { vfMark: number }).vfMark = 1;
    });
    await page.locator("#pcard-stations .pcard__refresh").click();
    await expect.poll(() => seen.length).toBe(1);
    expect(seen[0]!.url).toContain("area=1");
    expect(seen[0]!.url).toContain("card=stations");
    expect(seen[0]!.status).toBe(200);
    await page.waitForFunction(() => document.querySelectorAll("[aria-busy]").length === 0);
    await page.locator("#pcard-stations .pcard__refresh").click();
    await expect.poll(() => seen.length).toBe(2);
    expect(seen[1]!.status).toBe(304);
    expect(await page.evaluate(() => (window as unknown as { vfMark?: number }).vfMark)).toBe(1);
    await ctx.close();
  });

  for (const mode of ["dead", "slow"] as const) {
    it(`a ${mode} area is that block's loading state, which says the error sentence without script; the station's own cards render`, async () => {
      areaMode = mode;
      try {
        const { ctx, page } = await open({ base: PROXIED, js: false });
        // 2.4.6: a 5xx or a deadline is the loading state (the page's script would ask again); without script it says the error sentence
        expect(await page.locator("section#place-cards.stpart--loading").count()).toBe(1);
        expect((await page.locator("section#place-cards p.place__none:visible").textContent())?.trim()).toBe("Diese Quelle antwortet gerade nicht. Wir zeigen lieber nichts als eine alte Zahl als neue.");
        expect(await page.locator("#place-slot article.pcard").count()).toBe(0);
        expect(await page.locator("#pcard-station-board").count()).toBe(1);
        expect(await page.locator("#pcard-station-lifts").count()).toBe(1);
        await ctx.close();
      } finally {
        areaMode = "pass";
      }
    });
  }

  for (const width of [320, 375, 390] as const) {
    it(`${String(width)} px: nothing scrolls sideways`, async () => {
      const { ctx, page } = await open({ width });
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over).toBeLessThanOrEqual(0);
      await ctx.close();
    });
  }
});

describe("owner 2026-10-27: every station-page block says how fresh its data is", () => {
  for (const lang of ["de", "en"] as const) {
    it(`${lang}: each live block and each area card read from a polled feed carries the sign with its data time`, async () => {
      const { ctx, page } = await open({ js: false, path: stationPath(lang, "koeln-hbf") });
      const blocks = await page.$$eval("article.pcard", (cs) =>
        cs.map((c) => ({ id: c.id, sign: c.querySelector(".pcard__head .fresh") !== null, time: c.querySelector(".fresh time") !== null, ask: c.querySelector(".fresh")?.textContent ?? "" })),
      );
      const live = blocks.filter((b) => b.id.startsWith("pcard-station-"));
      expect(live.map((b) => b.id)).toEqual(expect.arrayContaining(["pcard-station-board", "pcard-station-lifts", "pcard-station-platforms", "pcard-station-alerts"]));
      for (const b of live) {
        expect(b.sign, b.id).toBe(true);
        expect(b.time, b.id).toBe(true);
      }
      const area = blocks.filter((b) => !b.id.startsWith("pcard-station-"));
      for (const b of area) {
        // reference data no polled feed reads (OpenStreetMap's places — since #1117 one card per everyday need — and the
        // gazetteer's neighbours) carries no clock
        if (b.id === "pcard-pois" || b.id === "pcard-neighbours" || POI_NEEDS.some((n) => b.id === `pcard-${n}`)) continue;
        expect(b.sign, b.id).toBe(true);
        // fuel's prices are read when asked: its sign says so instead of a clock
        if (b.id !== "pcard-fuel") expect(b.time, b.id).toBe(true);
      }
      await ctx.close();
    });
  }

  it("the relative age is written by the island", async () => {
    const { ctx, page } = await open({ clockAt: new Date(NOW.getTime() + 3 * 60_000) });
    const ages = await page.$$eval("article.pcard .fresh__age", (xs) => xs.map((x) => x.textContent ?? ""));
    expect(ages.length).toBeGreaterThan(4);
    expect(ages.every((a) => a.trim() !== ""), ages.join(" | ")).toBe(true);
    await ctx.close();
  });
});

describe("#1094/#1175: a large station's lifts are all in the page, the faults first; the board keeps its fold", () => {
  for (const js of [true, false] as const) {
    it(`JavaScript ${js ? "on" : "off"}: every lift is listed, those out of service first and in view, the working ones behind one fold; the board's 'more departures' is there`, async () => {
      const { ctx, page } = await open({ js });
      // #1094 (no limit on lifts): every unit stays in the page
      expect(await page.locator("#pcard-station-lifts ul.stlive__lifts > li").count()).toBe(20);
      // #1175 (owner 2026-11-05, decision 2: #1175 wins over #1094): the faults stand first and open, the working ones
      // are behind ONE fold beside the footer's "Quellen und Lizenzen" (#1120), none of them lost
      expect(await page.locator("#pcard-station-lifts details:not(.sources)").count()).toBe(1);
      expect(await page.locator("#pcard-station-lifts details:not(.sources) li.stlive__lift--inactive").count()).toBe(0);
      expect(await page.locator("#pcard-station-lifts li.stlive__lift--inactive").count()).toBe(2);
      const firstLift = page.locator("#pcard-station-lifts ul.stlive__lifts > li").first();
      expect(await firstLift.getAttribute("class")).toContain("stlive__lift--inactive");
      expect(await firstLift.isVisible()).toBe(true);
      expect(await page.locator("#pcard-station-lifts details:not(.sources) li").count()).toBe(18);
      expect(await page.locator("#pcard-station-platforms details:not(.sources)").count()).toBe(0);
      // #1147: the board is two panels, Abfahrt | Ankunft — each keeps its own rows fold
      expect(await page.locator("#pcard-station-board-dep details.pcard__more--rows").count()).toBe(1);
      expect(await page.locator("#pcard-station-board-arr details.pcard__more--rows").count()).toBe(1);
      await ctx.close();
    });
  }
});
