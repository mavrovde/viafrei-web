/**
 * #1310 B2, B1 and D2 in a browser, over the BUILT shell and the real digest renderer on the fixture snapshot.
 *
 * B2: the head of two pages of each type — place, station, Autobahn, road, state — read as a browser loads it: the meta
 * description is evergreen (120–160 characters, no clock time, no digit but the subject's own, no "Gewähr"), unique
 * across the ten, and equal to the `og:description` the page shares. B1: the home's title fits 60 characters.
 * D2: on a phone, 375×812, every SHOWN live item of the page's subject in its first block — a motorway page's top items, an
 * exit page's two directions — stands inside the first viewport (`first-screen-1173.e2e.ts` holds the FIRST one in
 * each of its states; this holds them all, in the plain state a search visitor meets). A row the block shows on a desk only
 * (`topitems__extra`, `display: none` under 1024 px in `site.css`) is not on the phone at all, so it is not judged.
 *
 * Run in the pinned Linux image only.
 */
import type { ChildProcess } from "node:child_process";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8911;
const BASE = `http://127.0.0.1:${String(PORT)}`;
const ID = { IMPRESSUM_NAME: "Head Probe", IMPRESSUM_STREET: "Probeweg 7", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "head@example.invalid" };
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const PHONE = { width: 375, height: 812 } as const;

/** Two pages per type, each with the subject's own name whose digits are allowed in its description. */
const PAGES = [
  { kind: "place", path: "/de/place/koeln", own: "Köln" },
  { kind: "place", path: "/de/place/berlin", own: "Berlin" },
  { kind: "station", path: "/de/station/koeln-hbf", own: "Köln Hbf" },
  { kind: "station", path: "/de/station/aachen-hbf", own: "Aachen Hbf" },
  { kind: "autobahn", path: "/de/autobahn/a7", own: "A7" },
  { kind: "autobahn", path: "/de/autobahn/a1", own: "A1" },
  { kind: "road", path: "/de/road/b51", own: "B 51" },
  { kind: "road", path: "/de/road/b264", own: "B 264" },
  { kind: "state", path: "/de/state/nordrhein-westfalen", own: "Nordrhein-Westfalen" },
  { kind: "state", path: "/de/state/bayern", own: "Bayern" },
] as const;

let browser: Browser;
let digest: Awaited<ReturnType<typeof startRealDigest>>;
let shell: ChildProcess;

beforeAll(async () => {
  digest = await startRealDigest({});
  shell = await startShell(PORT, { ...ID, DIGEST_URL: digest.url });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
});

async function open(path: string, viewport: { readonly width: number; readonly height: number } = PHONE): Promise<Page> {
  const ctx = await browser.newContext({ viewport, userAgent: UA, locale: "de-DE", extraHTTPHeaders: { "Accept-Language": "de-DE,de;q=0.9" } });
  ctx.setDefaultTimeout(2_000);
  const page = await ctx.newPage();
  const res = await page.goto(`${BASE}${path}`);
  expect(res?.status(), path).toBe(200);
  expect(new URL(page.url()).pathname, `${path} is not redirected`).toBe(path);
  return page;
}

describe("the head of every page type (#1310 B2)", () => {
  const seen = new Map<string, string>();
  for (const p of PAGES) {
    it(`${p.kind} ${p.path}: an evergreen description`, async () => {
      const page = await open(p.path);
      const description = (await page.locator('head meta[name="description"]').getAttribute("content")) ?? "";
      const og = await page.locator('head meta[property="og:description"]').getAttribute("content");
      const title = await page.title();
      await page.context().close();
      expect(description.length, `${p.path}: "${description}"`).toBeGreaterThanOrEqual(120);
      expect(description.length, `${p.path}: "${description}"`).toBeLessThanOrEqual(160);
      expect(description, "the subject is named").toContain(p.own.split(" ")[0]!);
      expect(description, "no clock time").not.toMatch(/\d{1,2}[:.]\d{2}/u);
      expect(description.replaceAll(p.own, ""), "no digit but the subject's own: no count of live items").not.toMatch(/\d/u);
      expect(description, "no guarantee line").not.toMatch(/Gewähr|garant/iu);
      if (og !== null) expect(og, "the shared description is the page's").toBe(description);
      expect(title.length, `${p.path} title`).toBeGreaterThan(0);
      for (const [other, d] of seen) expect(d, `${p.path} and ${other} differ`).not.toBe(description);
      seen.set(p.path, description);
    });
  }
});

describe("the home's title (#1310 B1)", () => {
  for (const path of ["/de", "/en"]) {
    it(`${path}: at most 60 characters`, async () => {
      const page = await open(path, { width: 1280, height: 900 });
      const title = await page.title();
      await page.context().close();
      expect(title.length, title).toBeLessThanOrEqual(60);
      expect(title).toContain("ViaFrei");
    });
  }
});

describe("the subject's live items above the fold on a phone (#1310 D2, 375×812)", () => {
  async function exitPath(): Promise<string> {
    const a7 = await (await fetch(`${BASE}/de/autobahn/a7`, { headers: { "user-agent": UA } })).text();
    const href = /<a href="(a7\/exit-[a-z0-9-]+)"/u.exec(a7)?.[1];
    if (href === undefined) throw new Error("the A7 names no junction");
    return `/de/autobahn/${href}`;
  }
  for (const what of ["road", "exit"] as const) {
    it(`${what}: every live item of the first block ends inside the first viewport`, async () => {
      const page = await open(what === "road" ? "/de/autobahn/a7" : await exitPath());
      const items = await page.locator("#page-first :is(.topitems__row, .exitways__item)").evaluateAll((els) =>
        els.map((e) => {
          const r = e.getBoundingClientRect();
          return { text: (e.textContent ?? "").trim().slice(0, 60), bottom: Math.round(r.bottom), visible: r.height > 0 };
        }),
      );
      await page.context().close();
      console.log(`fold 1310 ${what}: ${JSON.stringify(items.map((i) => i.bottom))}`);
      const shown = items.filter((i) => i.visible);
      expect(shown.length, "the fixture reports something on the A7").toBeGreaterThan(0);
      for (const i of shown) {
        expect(i.bottom, i.text).toBeLessThanOrEqual(PHONE.height);
      }
    });
  }
});
