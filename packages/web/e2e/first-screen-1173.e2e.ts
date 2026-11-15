/**
 * #1173: a road page and an exit page on a phone, 375×812, the first viewport by bounding boxes: the H1, the WHOLE road's
 * lamp, its count line and the first reported item, in the plain state, with a kept place, with the IP guess's row (shown,
 * asserted) and with the consent sheet (shown, asserted; nothing the test asks for may sit under it). The position's
 * block follows as its own, second.
 *
 * Run in the pinned Linux image only.
 */
import { execFileSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = 8897;
const IP_PORT = 8898;
const TAG_PORT = 8899;
const GEO_DIR = mkdtempSync(join(tmpdir(), "vf-1173-"));
const GEO_FILE = join(GEO_DIR, "geoip.vfgeo");
const PROBE_IP = "198.18.0.10";
const PROBE_ROW = "198.18.0.0,198.18.0.255,EU,DE,Niedersachsen,Probe,52.5512,9.4513\n";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const ID = { IMPRESSUM_NAME: "Fold Probe", IMPRESSUM_STREET: "Probeweg 5", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "fold@example.invalid" };
const PHONE = { width: 375, height: 812 } as const;
const GZIP_MAX = 200_000;
const THIRD_PARTY = /googletagmanager\.com|google-analytics\.com|clarity\.ms/u;
const CONSENT = ".consent[role=dialog]";

let browser: Browser;
let digest: Awaited<ReturnType<typeof startRealDigest>>;
const shells: ChildProcess[] = [];
const base = (port: number): string => `http://127.0.0.1:${String(port)}`;

beforeAll(async () => {
  digest = await startRealDigest({});
  const env = { ...ID, DIGEST_URL: digest.url, VF_MOTORWAY_AROUND: "1" };
  shells.push(await startShell(PORT, env));
  const csv = PROBE_ROW + readFileSync(join(HERE, "..", "test", "fixtures", "geoip-fixture.csv"), "utf8");
  execFileSync(process.execPath, [join(HERE, "..", "..", "..", "scripts", "geoip-build.mjs"), "--release", "2026-10", "--out", GEO_FILE, "--min-de-ranges", "1"], { input: csv, encoding: "utf8" });
  shells.push(await startShell(IP_PORT, { ...env, GEOIP_FILE: GEO_FILE }));
  shells.push(await startShell(TAG_PORT, { ...env, GOOGLE_TAG: "G-0" }));
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  for (const s of shells) s.kill();
  await digest?.close();
  rmSync(GEO_DIR, { recursive: true, force: true });
});

async function open(url: string, o: { readonly ip?: string; readonly stored?: Readonly<Record<string, unknown>> } = {}): Promise<{ readonly ctx: BrowserContext; readonly page: Page }> {
  const ctx = await browser.newContext({ viewport: PHONE, userAgent: UA, hasTouch: true, ...(o.ip === undefined ? {} : { extraHTTPHeaders: { "X-Forwarded-For": o.ip } }) });
  ctx.setDefaultTimeout(2_000);
  if (o.stored !== undefined) await ctx.addInitScript((kept) => localStorage.setItem("viafrei.place", JSON.stringify(kept)), o.stored);
  await ctx.route(THIRD_PARTY, (r) => r.fulfill({ status: 204, body: "" }));
  const page = await ctx.newPage();
  await page.goto(url);
  return { ctx, page };
}

async function exitPath(lang: string): Promise<string> {
  const a7 = await (await fetch(`${base(PORT)}/${lang}/autobahn/a7`)).text();
  const href = /<a href="(a7\/exit-[a-z0-9-]+)"/u.exec(a7)?.[1];
  if (href === undefined) throw new Error("the A7 names no junction");
  return `/${lang}/autobahn/${href}`;
}

type Measure = { readonly h1Top: number; readonly h1Lines: number; readonly statusEnd: number; readonly itemEnd: number | null };
async function measure(page: Page, floor: number): Promise<Measure> {
  const h1 = (await page.locator("main h1").first().boundingBox())!;
  const status = (await page.locator("#road-status").boundingBox())!;
  // the first reported item: a road page's top items; an exit page's are the junction's two directions (#1182 part 1),
  // which take the top items' place in the first block
  const item = await page.locator("#page-first :is(.topitems__row, .exitways__item)").first().boundingBox();
  const lh = await page.locator("main h1").first().evaluate((el) => Number.parseFloat(getComputedStyle(el).lineHeight));
  const m = { h1Top: Math.round(h1.y), h1Lines: Math.round(h1.height / lh), statusEnd: Math.round(status.y + status.height), itemEnd: item === null ? null : Math.round(item.y + item.height) };
  expect(m.h1Top, "the H1 stands inside the limit").toBeLessThanOrEqual(200);
  expect(m.h1Lines, "the H1 is at most two lines").toBeLessThanOrEqual(2);
  expect(m.statusEnd, "the lamp and the count line in the first viewport").toBeLessThanOrEqual(floor);
  expect(m.itemEnd, "the fixture reports something on the A7").not.toBeNull();
  expect(m.itemEnd!, "the first reported item in the first viewport").toBeLessThanOrEqual(floor);
  return m;
}

describe("the first viewport (#1173 AC 1, 375×812)", () => {
  const measured: Record<string, Measure> = {};
  afterAll(() => {
    console.log(`first screen 1173: ${JSON.stringify(measured)}`);
  });
  for (const lang of ["de", "en"] as const) {
    for (const what of ["road", "exit"] as const) {
      const path = async (): Promise<string> => (what === "road" ? `/${lang}/autobahn/a7` : exitPath(lang));

      it(`${lang} ${what}, plain`, async () => {
        const { ctx, page } = await open(`${base(PORT)}${await path()}`);
        measured[`${lang} ${what} plain`] = await measure(page, PHONE.height);
        await ctx.close();
      });
      it(`${lang} ${what}, the IP guess: its row was shown`, async () => {
        const { ctx, page } = await open(`${base(IP_PORT)}${await path()}`, { ip: PROBE_IP });
        await page.waitForSelector("#place-confirm:not([hidden])");
        measured[`${lang} ${what} ip`] = await measure(page, PHONE.height);
        await ctx.close();
      });
      it(`${lang} ${what}, the consent sheet: it was shown, nothing asked for sits under it`, async () => {
        const { ctx, page } = await open(`${base(TAG_PORT)}${await path()}`);
        await page.waitForSelector(CONSENT);
        const sheet = (await page.locator(CONSENT).boundingBox())!;
        measured[`${lang} ${what} consent`] = await measure(page, sheet.y);
        await ctx.close();
      });
    }
    it(`${lang} road, a kept place: its row was shown`, async () => {
      const { ctx, page } = await open(`${base(PORT)}/${lang}/autobahn/a7`, { stored: { at: null, label: "", how: "germany" } });
      await page.waitForSelector("#place-kept:not([hidden])");
      measured[`${lang} road kept`] = await measure(page, PHONE.height);
      await ctx.close();
    });
  }
});

describe("the whole road first, the position second (#1173 AC 2)", () => {
  it("the first lamp in the page is the road's; the position's block follows it", async () => {
    const { ctx, page } = await open(`${base(IP_PORT)}/de/autobahn/a7`, { ip: PROBE_IP });
    const road = (await page.locator("#road-status").boundingBox())!;
    const lamps = await page.evaluate(() => [...document.querySelectorAll("#road-status, #ampel-slot .ampel")].map((e) => e.id || "slot"));
    expect(lamps[0]).toBe("road-status");
    const slot = await page.locator("#ampel-slot").boundingBox();
    if (slot !== null) expect(slot.y).toBeGreaterThan(road.y);
    await ctx.close();
  });
});

describe("the jump links (#1173 AC 5)", () => {
  it("each lands on its section", async () => {
    const { ctx, page } = await open(`${base(PORT)}/de/autobahn/a7`);
    const targets = await page.locator("#page-first .jumps__chip").evaluateAll((els) => els.map((e) => e.getAttribute("href")!));
    expect(targets.length).toBeGreaterThan(0);
    for (const href of targets) {
      await page.locator(`#page-first .jumps__chip[href="${href}"]`).click();
      await page.waitForFunction((h) => location.hash === h, href);
      const box = (await page.locator(href).first().boundingBox())!;
      expect(box.y, href).toBeLessThan(PHONE.height);
      expect(box.y + box.height, href).toBeGreaterThan(0);
    }
    await ctx.close();
  });
});

describe("a road's budget (#1173 AC 8)", () => {
  it("the heaviest road of the fixture within 200 KB gzip, and the first screen in the HTML without a script", async () => {
    const html = await (await fetch(`${base(PORT)}/de/autobahn/a7`, { headers: { "user-agent": UA } })).text();
    const gz = gzipSync(html).length;
    console.log(`road budget 1173: ${String(html.length)} B raw, ${String(gz)} B gzip`);
    expect(gz).toBeLessThanOrEqual(GZIP_MAX);
    expect(html.indexOf('id="road-status"'), "served, not scripted").toBeGreaterThan(0);
    const ctx = await browser.newContext({ viewport: PHONE, userAgent: UA, javaScriptEnabled: false });
    ctx.setDefaultTimeout(2_000);
    const page = await ctx.newPage();
    await page.goto(`${base(PORT)}/de/autobahn/a7`);
    expect(await page.locator("#road-status").isVisible()).toBe(true);
    await ctx.close();
  });
});
