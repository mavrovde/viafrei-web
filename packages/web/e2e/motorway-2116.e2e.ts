/**
 * 2.1.16 (#716 C+D) against the BUILT shell and the REAL digest
 * (`real-digest.ts`): the home's motorway catalogue in every language, the
 * index's search and order (a GET form that works with no script; a variant is
 * `noindex` with the bare index as its canonical), its overview map, and the
 * full "ask your assistant" block on a motorway page in every language — the
 * copy button revealed by the page's script under its CSP, the address on the
 * clipboard after a click.
 */
import type { ChildProcess } from "node:child_process";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { all } from "@viafrei/design/testing";
import { MCP_ENDPOINT } from "../src/site/endpoints.js";
import { motorwayPath } from "../src/site/motorways.js";
import { LIVE_LANGS, pathFor } from "../src/site/pages.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8817;
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

const get = async (path: string): Promise<{ status: number; body: string; headers: Headers }> => {
  const r = await fetch(`${BASE}${path}`, { redirect: "manual" });
  return { status: r.status, body: await r.text(), headers: r.headers };
};
/**
 * The motorway each index ROW is about: its first shield. Since #998 a row also names the motorways it connects to
 * (`.motorway-index__joins`), as shields of their own, so every shield of the list is not every row (#1049).
 */
const SHIELD = /class="shield" href="\/[a-z]{2}\/(?:autobahn|motorway)\/(a\d+)"/;
const rowsIn = (html: string, from: number, to: number): string[] => html.slice(from, to).split("<li").slice(1);
const rowRoadsIn = (html: string, from: number, to: number): string[] =>
  rowsIn(html, from, to)
    .map((li) => SHIELD.exec(li)?.[1])
    .filter((x): x is string => x !== undefined);
/** The connections a row names after its own road (#998 item 4). */
const joinsIn = (html: string, from: number, to: number, road: string): string[] => {
  const li = rowsIn(html, from, to).find((x) => SHIELD.exec(x)?.[1] === road) ?? "";
  const joins = li.split('class="motorway-index__joins"')[1] ?? "";
  return roadsIn(joins, 0, joins.length);
};
// 2.1.17: the home's block lists cards (`mwcard`), the index shields — one rule reads both
const roadsIn = (html: string, from: number, to: number): string[] => [...html.slice(from, to).matchAll(/class="(?:shield|mwcard)" href="\/[a-z]{2}\/(?:autobahn|motorway)\/(a\d+)"/g)].map((m) => m[1]!);

describe("the home's motorway catalogue (#716 C1)", () => {
  for (const lang of LIVE_LANGS) {
    it(`${pathFor("start", lang)}: the motorways most affected now, worst first, at most ten, the index linked`, async () => {
      const r = await get(pathFor("start", lang));
      expect(r.status).toBe(200);
      const at = r.body.indexOf('id="motorway-top"');
      expect(at).toBeGreaterThan(0);
      const end = r.body.indexOf("</section>", at);
      const roads = roadsIn(r.body, at, end);
      // the fixture's A7 has six closures and eight jams: the worst
      expect(roads[0]).toBe("a7");
      expect(roads.length).toBeLessThanOrEqual(10);
      expect(r.body.slice(at, end)).toContain(`href="${pathFor("motorways", lang)}"`);
    });
  }
});

describe("the home block's place on the page (2.1.17, owner: the catalogue pinned on the main page; #990: in the national band)", () => {
  for (const lang of LIVE_LANGS) {
    it(`${pathFor("start", lang)}: in "Deutschland jetzt" (#990), in its roads group, before the moments and the news, with the catalogue's button`, async () => {
      const r = await get(pathFor("start", lang));
      const now = r.body.indexOf('id="now"');
      const roads = r.body.indexOf('id="now-roads"');
      const block = r.body.indexOf('id="motorway-top"');
      const day = r.body.indexOf('id="day"');
      const news = r.body.indexOf('id="news"');
      expect(now).toBeGreaterThan(0);
      expect(roads).toBeGreaterThan(now);
      expect(block).toBeGreaterThan(roads);
      expect(day).toBeGreaterThan(block);
      expect(news).toBeGreaterThan(day);
      // inside the roads group: no other group's heading between the group's start and the block
      expect(r.body.slice(roads, block)).not.toMatch(/id="now-(rail|energy|parking)"/);
      const end = r.body.indexOf("</section>", block);
      expect(r.body.slice(block, end)).toMatch(new RegExp(`<a class="btn btn--primary" href="${pathFor("motorways", lang)}">[^<]*\\d{2,}[^<]*</a>`));
      expect(all(r.body.slice(block, end), ".motorway-top__lead").length).toBeGreaterThan(0);
    });
  }
});

describe("the home block's link targets (Lighthouse target-size, WCAG 2.5.8)", () => {
  // 2.1.16: the two stacked credit lines sat 3 px apart, so the Autobahn GmbH line (16 px tall) had no clear 24 px
  // target circle and /de, /en scored a11y 96. Lighthouse's rule, measured: every target under 24 px has a 24 px
  // circle around its centre that no other target enters — save a link inline in a line of other text.
  for (const width of [320, 412, 1280]) {
    it(`at ${String(width)} px every link of the block keeps a clear 24 px target`, async () => {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      try {
        await page.goto(`${BASE}${pathFor("start", "de")}`, { waitUntil: "load" });
        const crowded = await page.$$eval("#motorway-top a", (as) => {
          const rects = as.flatMap((a) => [...a.getClientRects()].map((r) => ({ a, r })));
          const out: string[] = [];
          for (const { a, r } of rects) {
            if (r.width >= 24 && r.height >= 24) continue;
            // axe's exception, which Lighthouse applies: a link inline in a line of other text is not judged (it still counts as a neighbour)
            const block = a.parentElement;
            if (block !== null && (block.textContent ?? "").trim() !== (a.textContent ?? "").trim()) continue;
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            for (const o of rects) {
              if (o.a === a) continue;
              const dx = Math.max(o.r.left - cx, 0, cx - o.r.right);
              const dy = Math.max(o.r.top - cy, 0, cy - o.r.bottom);
              if (Math.hypot(dx, dy) < 12) out.push(`${(a.textContent ?? "").slice(0, 30)} ↔ ${(o.a.textContent ?? "").slice(0, 30)}`);
            }
          }
          return out;
        });
        expect(crowded).toEqual([]);
        expect(await page.$$eval("#motorway-top a", (as) => as.length)).toBeGreaterThan(3);
      } finally {
        await page.close();
      }
    });
  }
});

describe("the index: search, order, overview (#716 C1)", () => {
  it("the bare index carries the GET form, the overview map with the BKG line, and allows the form in its CSP", async () => {
    const r = await get(pathFor("motorways", "de"));
    expect(r.status).toBe(200);
    expect(all(r.body, "form.motorway-search[method=\"get\"][action=\"/de/autobahn\"][role=\"search\"]").length).toBeGreaterThan(0);
    expect(all(r.body, ".motorway__map.motorway-overview").length).toBeGreaterThan(0);
    expect(r.body.replace(/<[^>]+>/g, "")).toContain("Kartengrundlage: © BKG (2026) dl-de/by-2-0");
    expect(r.headers.get("content-security-policy")).toContain("form-action 'self'");
    expect(r.body).not.toContain('name="robots"');
  });

  it("?q=7 lists the matching motorways only, noindex, the bare index as its canonical", async () => {
    const r = await get(`${pathFor("motorways", "en")}?q=7`);
    expect(r.status).toBe(200);
    expect(all(r.body, "meta[name=\"robots\"][content=\"noindex, follow\"]").length).toBeGreaterThan(0);
    expect(all(r.body, `link[rel="canonical"][href="https://viafrei.de${pathFor("motorways", "en")}"]`).length).toBeGreaterThan(0);
    // the list (#1028 puts the national summary, which names its own motorways, above it)
    const at = r.body.indexOf('<ul class="motorway-index">');
    const end = r.body.indexOf("</section>", at);
    expect(rowRoadsIn(r.body, at, end)).toEqual(["a7"]);
    // its connections are still named on its row, after it (#998)
    expect(joinsIn(r.body, at, end, "a7").length).toBeGreaterThan(0);
    expect(joinsIn(r.body, at, end, "a7")).not.toContain("a7");
    expect(all(r.body, ".motorway__map.motorway-overview")).toEqual([]);
  });

  it("?sort=worst orders by the rule it states; a number that is no motorway says so", async () => {
    const r = await get(`${pathFor("motorways", "de")}?sort=worst`);
    // the list (#1028 puts the national summary, which names its own motorways, above it)
    const at = r.body.indexOf('<ul class="motorway-index">');
    expect(roadsIn(r.body, at, r.body.indexOf("</section>", at))[0]).toBe("a7");
    expect(r.body).toContain("Zuerst die Autobahnen mit den meisten Sperrungen und Staus zusammen");
    const none = await get(`${pathFor("motorways", "de")}?q=999`);
    expect(none.body).toContain("Keine Autobahn mit der Nummer „999“.");
  });

  it("the form works in a browser: typing a number and sending it lands on the filtered index", async () => {
    const page = await browser.newPage();
    try {
      await page.goto(`${BASE}${pathFor("motorways", "de")}`, { waitUntil: "load" });
      // the box arrives empty: typing into it is the whole search
      expect(await page.inputValue("#mw-q")).toBe("");
      await page.locator("#mw-q").pressSequentially("57");
      await page.fill("#mw-q", "A 57");
      await page.click(".motorway-search button[type=submit]");
      await page.waitForURL(/q=A\+57/);
      // each row's own road is its first shield; the shields after it are the roads it connects to (#998, #1049)
      expect(await page.$$eval("#motorway-index ul.motorway-index > li", (lis) => lis.map((li) => li.querySelector(".shield")?.textContent ?? ""))).toEqual(["A57"]);
    } finally {
      await page.close();
    }
  });
});

describe("the assistant block on a motorway page (#716 C2)", () => {
  for (const lang of LIVE_LANGS) {
    it(`${motorwayPath(lang, "A7")}: connect button, endpoint, 2–3 examples each with its source`, async () => {
      const r = await get(motorwayPath(lang, "A7"));
      const ask = r.body.indexOf('class="motorway__ask"');
      expect(ask).toBeGreaterThan(r.body.indexOf('class="motorway__layer motorway__rules"'));
      const block = r.body.slice(ask, r.body.indexOf("</aside>", ask));
      expect(all(block, `a.btn.btn--primary.btn--sm[href="${pathFor("connect", lang)}"]`).length).toBeGreaterThan(0);
      // #1003: the address is the endpoint chip, one URL across its host and path spans
      expect(block.replace(/<[^>]+>/gu, "")).toContain(MCP_ENDPOINT);
      const n = (block.match(/<q class="pcard__q">/g) ?? []).length;
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(3);
      expect((block.match(/class="motorway__src"/g) ?? []).length).toBe(n);
      // the planned closures and their signed detour (#716 D)
      expect(r.body).toContain('id="mw-planned"');
      expect(r.body).toContain("U 12");
    });
  }

  it("the copy button is revealed by the page's script and puts the address on the clipboard (#1003: the endpoint chip)", async () => {
    const ctx = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    try {
      await page.goto(`${BASE}${motorwayPath("de", "A7")}`, { waitUntil: "load" });
      // the block's own chip: the one in the address line, not a note's
      const chip = page.locator(".motorway__ask > p > .endpoint-chip");
      const b = chip.locator(".endpoint-chip__copy");
      await b.waitFor({ state: "visible" });
      await b.click();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(MCP_ENDPOINT);
      await chip.locator('[role="status"]:not(:empty)').waitFor({ state: "visible" });
      expect(errors.filter((e) => /Content Security Policy|CSP/i.test(e))).toEqual([]);
    } finally {
      await ctx.close();
    }
  });
});

describe("F4: every register motorway's map (#716 F4)", () => {
  it("each fixture motorway: the junction core narrower than the line, every chain end capped, every break named", async () => {
    const list = await (await fetch(`${digest.url}/internal/motorway/list`)).text();
    const roads = [...list.matchAll(/autobahn\/(a\d+)"/g)].map((m) => m[1]!.toUpperCase());
    expect(roads.length).toBeGreaterThanOrEqual(10);
    for (const road of roads) {
      const html = await (await fetch(`${digest.url}/internal/motorway/${road}?lang=de`)).text();
      // 2.1.17: the fixture's A34 is a motorway the LCL records no course of — no map to judge, the page says so
      if (road === "A34") {
        expect(all(html, ".mw-line"), road).toEqual([]);
        expect(html, road).toContain("motorway__nocourse");
        continue;
      }
      const w = (cls: string): number => Number(new RegExp(`<path class="${cls}" d="[^"]*" stroke-width="([0-9.]+)"`).exec(html)?.[1] ?? Number.NaN);
      expect(w("mw-junctions"), road).toBeLessThan(w("mw-line"));
      const line = /<path class="mw-line" d="([^"]*)"/.exec(html)?.[1] ?? "";
      const chains = (line.match(/M/g) ?? []).length;
      expect((/<path class="mw-ends" d="([^"]*)"/.exec(html)?.[1]?.match(/M/g) ?? []).length, road).toBe(2 * chains);
      const named = (/<ul class="motorway__gaps">([\s\S]*?)<\/ul>/.exec(html)?.[1]?.match(/<li>/g) ?? []).length;
      // the fixture's chains are all long: every break between two is named
      expect(named, road).toBe(chains - 1);
    }
  });
});

describe("the motorway index fits a phone in every language (2.4.3, /bg/autobahn scrolled sideways)", () => {
  it("no row of the index is wider than the screen at 320 and 390 px — a long lamp label wraps the row instead", async () => {
    for (const width of [320, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      try {
        for (const lang of LIVE_LANGS) {
          await page.goto(`${BASE}${pathFor("motorways", lang)}`, { waitUntil: "load" });
          const { rows, over } = await page.$$eval(".motorway-index li", (rs) => ({ rows: rs.length, over: rs.filter((r) => r.scrollWidth > r.clientWidth + 1).length }));
          expect(rows, `${lang} at ${String(width)} px: the index has rows`).toBeGreaterThan(0);
          expect(over, `${lang} at ${String(width)} px: rows wider than their box`).toBe(0);
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${lang} at ${String(width)} px`).toBe(true);
        }
      } finally {
        await page.close();
      }
    }
  });
});
