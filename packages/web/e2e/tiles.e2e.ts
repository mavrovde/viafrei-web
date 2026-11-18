/**
 * #378 web-side criteria against the BUILT shell and a stub digest:
 *
 * - tile-embedding: a digest answering 500 for one tile gives an `is-error`
 *   tile and a 200 page; a digest that HANGS 5 s gives the same within 2.5 s
 *   — the isolation claim, measured with a clock;
 * - shell: one <h1>, `lang`, the four anchors, one filled action, the language
 *   list in each language's own script with the current one marked;
 * - no-js: with JavaScript disabled the page renders the same tiles and
 *   carries the home's refresh, HOME_REFRESH_S (D3, 20 min since 2026-10-03);
 * - overflow: scrollWidth ≤ innerWidth at 375, 390, 768 and 1280;
 * - the mobile height budget at 390 (#379: under 6 000 px) and the transfer
 *   budget (A8), with every credit line of every tile in the default view.
 */
import type { ChildProcess } from "node:child_process";
import { gzipSync } from "node:zlib";
import { chromium, type Browser, type Page } from "playwright";
import { HOME_REFRESH_CONTENT, LIVE_LANGS, allPaths, type Lang } from "../src/site/pages.js";
import { menuGroups, reviewedLocales } from "../src/i18n/locales.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { all, classesIn, classesOf, elements, parse, text as nodeText } from "@viafrei/design/testing";
import { shortSource } from "@viafrei/design";
import { EMBEDDED_TILES, FACTS } from "../src/lib/tiles.js";
import { LICENCE_CATALOGUE, MTSK_CONSUMER_NOTE, licenceTextFor } from "@viafrei/ingest";
import { t } from "../src/i18n/index.js";
import { startShell } from "./server.js";
import { gotoSettled } from "./settle.js";
import { startStubDigest } from "./stub-digest.js";
import { RETRY_WAITS_MS } from "../src/lib/fragment-retry.js";
import { TILE_SHOW_BY_MS } from "../src/lib/fill.js";
import { startRealDigest } from "./real-digest.js";
import { startAsksStub } from "./asks-stub.js";
import { HOME_RAW_MAX, LIMITS } from "../scripts/budget.js";

const PORT = 8793;
let browser: Browser;
let shell: ChildProcess | undefined;
let stub: Awaited<ReturnType<typeof startStubDigest>> | undefined;

async function withDigest(behaviour: Parameters<typeof startStubDigest>[0], tileTimeoutMs = "2000"): Promise<void> {
  if (shell) shell.kill();
  if (stub) await stub.close();
  stub = await startStubDigest(behaviour);
  shell = await startShell(PORT, { DIGEST_URL: stub.url, WEB_TILE_TIMEOUT_MS: tileTimeoutMs });
}

beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await stub?.close();
});

describe("tile embedding and isolation", () => {
  it("embeds every live tile from the digest, one GET per tile per render, with its credit line in the default view", async () => {
    await withDigest({});
    const res = await fetch(`http://127.0.0.1:${PORT}/de`);
    expect(res.status).toBe(200);
    const html = await res.text();
    for (const id of EMBEDDED_TILES) {
      expect(all(html, `section.tile.is-ok[id="tile-${id}"]`).length, id).toBeGreaterThan(0);
      expect(all(html, '.credit[lang="de"]').length, id).toBeGreaterThan(0);
    }
    // the bus and tram board is asked for, answers empty, and is NOT rendered — no slot, no placeholder
    expect(html).not.toContain('id="tile-transit"');
    expect(html).not.toContain("moment__tile--board");
    const asked = stub?.hits.filter((h) => h.startsWith("/internal/tiles/")) ?? [];
    expect(asked.sort()).toEqual(
      [...EMBEDDED_TILES.map((id) => `/internal/tiles/${id}?lang=de`), "/internal/tiles/transit?lang=de", ...FACTS.map((id) => `/internal/tiles/${id}?lang=de&view=fact`)].sort(),
    );
    // the "Heute" strip carries all four facts, each with its credit line
    for (const id of FACTS) expect(html, id).toMatch(new RegExp(`<section class="tile tile--fact is-ok" id="fact-${id}">[\\s\\S]*?class="credit"`));
    // FS-2026-11-06: a credit line sits inside a <details> only WITH its data, in a tile's fold whose summary names its
    // publishers (FS3) — never in any other disclosure
    for (const d of all(html, "details")) {
      if (all(d, 'p.credit[lang="de"]').length === 0) continue;
      expect(d.attrs["class"] ?? "", "a credit line folds only in a tile's fold").toMatch(/\bfold\b/u);
      expect(all(d, "summary .fold__sources").length, "its summary names the publishers").toBeGreaterThan(0);
    }
  });

  it("renders a 500 tile as is-error and the page as 200, the other tiles untouched", async () => {
    await withDigest({ charging: 500, "fact-punctuality": 500 });
    const res = await fetch(`http://127.0.0.1:${PORT}/en`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(all(html, "section.tile.is-error[id=\"tile-charging\"]").length).toBeGreaterThan(0);
    for (const id of EMBEDDED_TILES) if (id !== "charging") expect(all(html, `section.tile.is-ok[id="tile-${id}"]`).length, id).toBeGreaterThan(0);
    // the shell's own error tile has no figure and no credit line
    const charging = /<section class="tile is-error" id="tile-charging"[\s\S]*?<\/section>/.exec(html)?.[0] ?? "";
    expect([...classesIn(charging)].filter((c) => c.startsWith("credit"))).toEqual([]);
    expect(charging).not.toMatch(/tile__num num">[0-9]/);
    // a fact that failed is simply absent from the strip; the other two stay
    expect(html).not.toContain('id="fact-punctuality"');
    expect(html).toContain('id="fact-roads"');
    expect(html).toContain('id="fact-charging"');
  });

  it("says the fuel list is not available, in the page's language, when no board renders — never the lead's promise (review N5)", async () => {
    // a fuel tile with no board (the stub's fragment), and the shell's error tile for a 500
    for (const behaviour of [{}, { fuel: 500 as const }]) {
      await withDigest(behaviour);
      for (const lang of LIVE_LANGS) {
        const res = await fetch(`http://127.0.0.1:${PORT}/${lang}/fuel`);
        expect(res.status, lang).toBe(200);
        const html = await res.text();
        expect(all(html, "p.lead.fuel-page__unavailable").map(nodeText), `${lang}: the not-available line`).toContain(`${t(lang, "fuelPage.unavailable")}`);
        // (the page's meta description is the lead, as for every page; the visible lead is what may not promise)
        expect(all(html, "p.lead").filter((p) => nodeText(p).startsWith(t(lang, "fuelPage.lead"))), `${lang}: no lead promising a list`).toHaveLength(0);
        expect(html, lang).toContain('id="tile-fuel"');
      }
    }
  });

  it("answers within the panel deadline when one tile hangs 5 s — that tile a loading placeholder, the others is-ok — and its background fill is refused, never a hang (#564)", async () => {
    await withDigest({ lifts: "hang" });
    const t0 = performance.now();
    const res = await fetch(`http://127.0.0.1:${PORT}/de`);
    const html = await res.text();
    const took = performance.now() - t0;
    expect(res.status).toBe(200);
    // render-then-fill (owner 2026-10-12): the first HTML waits the 500 ms panel deadline, no longer the 2 s tile deadline
    expect(took, `page took ${took.toFixed(0)} ms`).toBeLessThan(900);
    expect(took).toBeGreaterThanOrEqual(450); // it really did wait for the deadline, not skip the tile
    expect(all(html, "section.tile.is-loading[id=\"tile-lifts\"]").length).toBeGreaterThan(0);
    expect(html).toContain('data-vf-fill="/fragment/tile?id=lifts&amp;lang=de"');
    for (const id of EMBEDDED_TILES) if (id !== "lifts") expect(all(html, `section.tile.is-ok[id="tile-${id}"]`).length, id).toBeGreaterThan(0);
    const f0 = performance.now();
    const fill = await fetch(`http://127.0.0.1:${PORT}/fragment/tile?id=lifts&lang=de`);
    expect(fill.status).toBe(502);
    expect(performance.now() - f0).toBeLessThan(2500);
  });

  it("in a browser: a slow tile is filled in the background, a dead one turns into its error state with its sentence — never blank (#564)", async () => {
    // #1239: the visitor-facing time, with the REAL clock and the product's own 2 s tile deadline. A hanging digest used
    // to keep the tile "loading" for 1 + 3 deadlines plus RETRY_WAITS_MS (~14 s); now the tile says its error at
    // TILE_SHOW_BY_MS after the page is shown — inside the owner's 2 s ceiling — and its asks go on behind it (#1224's
    // retry is kept: a busy read is never final while asks remain). The slow tile (1 s) still fills, never an error.
    await withDigest({ lifts: "hang", reports: "slow" }, "2000");
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const fills: string[] = [];
    page.on("request", (r) => {
      const u = new URL(r.url());
      if (u.pathname.startsWith("/fragment/")) fills.push(u.pathname + u.search);
    });
    await page.goto(`http://127.0.0.1:${PORT}/de`, { waitUntil: "commit" });
    await page.waitForSelector("#tile-lifts", { state: "attached", timeout: 2_000 });
    const shown = performance.now();
    // the first HTML holds the placeholder: the same box as the tile that arrives
    expect(await page.$eval("#tile-lifts", (e: Element) => e.className)).toBe("tile is-loading");
    await page.waitForSelector("#tile-lifts.is-error", { timeout: 2_000 });
    const waited = performance.now() - shown;
    expect(waited, `the visitor looked at "loading" for ${waited.toFixed(0)} ms`).toBeLessThan(2_000);
    expect(waited, "it waited for the show-by mark, not an instant error").toBeGreaterThanOrEqual(TILE_SHOW_BY_MS - 300);
    expect(await page.$eval("#tile-lifts .tile__note", (e) => e.textContent)).toBe(t("de", "tile.errorNote"));
    expect(await page.$eval("#tile-lifts .age__state", (e) => e.textContent)).toBe(t("de", "tile.error"));
    await page.waitForSelector("#tile-reports.is-ok", { timeout: 2_000 });
    // asked on behind the error: a second ask goes out after the shell's deadline and the first wait (2 s + 400 ms after
    // the first ask), while the visitor already reads the error
    await expect.poll(() => fills.filter((f) => f === "/fragment/tile?id=lifts&lang=de").length, { timeout: 2_000, interval: 25 }).toBe(2);
    expect(RETRY_WAITS_MS[0]).toBeLessThan(2_000);
    expect(fills.filter((f) => f === "/fragment/tile?id=reports&lang=de")).toHaveLength(1);
    await ctx.close();
  });

  it("refuses an answer that is not a tile fragment and renders the error state instead", async () => {
    await withDigest({ reports: "html-but-not-tile" });
    const html = await (await fetch(`http://127.0.0.1:${PORT}/de`)).text();
    expect(all(html, "section.tile.is-error[id=\"tile-reports\"]").length).toBeGreaterThan(0);
    expect(all(html, "div").map(nodeText)).not.toContain("not a tile");
  });

  it("keeps the page up when the digest is not there at all", async () => {
    if (shell) shell.kill();
    if (stub) await stub.close();
    stub = undefined;
    shell = await startShell(PORT, { DIGEST_URL: "http://127.0.0.1:1", WEB_TILE_TIMEOUT_MS: "500" });
    const res = await fetch(`http://127.0.0.1:${PORT}/de`);
    expect(res.status).toBe(200);
    const html = await res.text();
    for (const id of EMBEDDED_TILES) expect(all(html, `section.tile.is-error[id="tile-${id}"]`).length, id).toBeGreaterThan(0);
    // no fact without a number: no fact is printed at all (#990: the facts are cells of "Deutschland jetzt")
    expect(html).not.toContain('id="fact-');
  });

  it("fills the bus and tram slot only when the digest answers the transit board live", async () => {
    await withDigest({ transit: "ok" });
    const html = await (await fetch(`http://127.0.0.1:${PORT}/de`)).text();
    // #990: in the rail group of "Deutschland jetzt", not in the moment
    expect(all(html, "#now-rail section.tile.is-ok[id=\"tile-transit\"]").length).toBeGreaterThan(0);
    expect(all(html, "#day section.tile").length).toBe(0);
  });
});

describe("the shell", () => {
  it("has one h1, lang, the three anchors, one filled action, and the language list marked", async () => {
    await withDigest({});
    for (const lang of ["de", "en"] as const) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await gotoSettled(page, `http://127.0.0.1:${PORT}/${lang}`);
      expect(await page.$$eval("h1", (h) => h.length)).toBe(1);
      expect(await page.$eval("html", (h) => h.lang)).toBe(lang);
      const anchors = await page.$$eval(".site-nav a", (as) => as.map((a) => a.getAttribute("href")));
      expect(anchors).toEqual(["#day", "#start", "#tools"]);
      // no protocol words above the fold: the first screen speaks to a traveller — but for the pitch's own
      // "One MCP. No API key." (#935, owner 2026-10-22), the reason to click now
      const fold = await page.evaluate(() => {
        const hero = document.querySelector(".hero");
        if (!(hero instanceof HTMLElement)) return { rest: "", pitch: "" };
        const pitch = hero.querySelector(".hero__pitch");
        return { rest: hero.innerText.replace(pitch instanceof HTMLElement ? pitch.innerText : "\u0000", ""), pitch: pitch instanceof HTMLElement ? pitch.innerText : "" };
      });
      expect(fold.pitch).toMatch(/\bMCP\b/);
      expect(fold.rest).not.toMatch(/\bMCP\b|Streamable|Endpunkt|endpoint|\bSSE\b|JSON|tools\/list/i);
      // #935: the h1 is the tagline of the page's own language
      expect(await page.$eval("h1", (h) => h.textContent)).toBe(t(lang, "meta.tagline"));
      // nine moments, each with one question visible and its copyable text
      expect(await page.$$eval(".moment", (m) => m.length)).toBe(9);
      expect(await page.$$eval(".moment__lead > :is(.moment__q, .moment__qfold) > .ask .ask__q .ask__text", (q) => q.map((e) => getComputedStyle(e).userSelect))).toEqual(Array(9).fill("all"));
      for (const a of anchors) expect(await page.$(a ?? "x"), a ?? "").not.toBeNull();
      expect(await page.$$eval(".site-head .btn--primary", (b) => b.length)).toBe(1);
      // the header's language MENU carries every reviewed language (#235), the current one marked, in the
      // menu's order: by its own name, Latin script first, then Greek, then Cyrillic (#753, `menuGroups`)
      const langs = await page.$$eval(".site-head .langmenu .langs a", (as) => as.map((a) => ({ hreflang: a.getAttribute("hreflang"), current: a.getAttribute("aria-current") })));
      const order = menuGroups(reviewedLocales().map((l) => l.code as Lang)).flat();
      expect(langs).toEqual(order.map((l) => ({ hreflang: l, current: l === lang ? "page" : null })));
      expect(await page.$$eval('a[href="/impressum"], a[href="/en/impressum"]', (a) => a.length)).toBeGreaterThan(0);
      await ctx.close();
    }
  });

  // #753: twenty-two languages in the header menu on a 390 px phone. Opened by
  // the keyboard alone, the panel stays inside the viewport and below 70 % of
  // its height, every language is reachable inside it, and the page does not scroll sideways.
  it("opens the 22-language menu by keyboard on a 390 px phone, inside the viewport, every language reachable (#753)", async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const total = reviewedLocales().length; // 22 since #753; pages.test.ts pins the list
    for (const lang of ["de", "fr", "sr", "el"] as const) {
      if (!reviewedLocales().some((l) => l.code === lang)) continue;
      await gotoSettled(page, `http://127.0.0.1:${PORT}/${lang}`);
      await page.focus(".site-head .langmenu__summary");
      await page.keyboard.press("Enter");
      expect(await page.$eval(".site-head .langmenu", (d) => (d as HTMLDetailsElement).open), lang).toBe(true);
      const box = await page.$eval(".site-head .langmenu__panel", (p) => {
        const r = p.getBoundingClientRect();
        return { left: r.left, right: r.right, height: r.height, vw: window.innerWidth, vh: window.innerHeight, sw: document.documentElement.scrollWidth };
      });
      expect(box.left, lang).toBeGreaterThanOrEqual(0);
      expect(box.right, lang).toBeLessThanOrEqual(box.vw);
      expect(box.height, lang).toBeLessThanOrEqual(box.vh * 0.7 + 1);
      expect(box.sw, lang).toBeLessThanOrEqual(box.vw);
      // every link can be scrolled into view inside the panel and is then fully within the viewport's width
      const links = await page.$$(".site-head .langmenu__panel a");
      expect(links.length, lang).toBe(total);
      for (const a of links) {
        await a.scrollIntoViewIfNeeded();
        const r = await a.boundingBox();
        expect(r, lang).not.toBeNull();
        expect((r?.x ?? -1) >= 0 && (r?.x ?? 0) + (r?.width ?? 0) <= 390 && (r?.width ?? 0) > 0, `${lang}: ${await a.getAttribute("hreflang")}`).toBe(true);
      }
      // Tab walks from the summary into the names
      await page.focus(".site-head .langmenu__summary");
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => document.activeElement?.closest(".langmenu__panel") !== null), lang).toBe(true);
    }
    await ctx.close();
  });

  it("renders the same tiles with JavaScript disabled and carries the home refresh (D3)", async () => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await gotoSettled(page, `http://127.0.0.1:${PORT}/de`);
    for (const id of EMBEDDED_TILES) expect(await page.$(`#tile-${id}.tile.is-ok`), id).not.toBeNull();
    expect(await page.$eval('meta[http-equiv="refresh"]', (m) => m.getAttribute("content"))).toBe(HOME_REFRESH_CONTENT);
    await ctx.close();
  });

  it("overflows horizontally at no width: 375, 390, 768, 1280", async () => {
    for (const width of [375, 390, 768, 1280]) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await ctx.newPage();
      await gotoSettled(page, `http://127.0.0.1:${PORT}/de`);
      const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
      expect(sw, `width ${width}`).toBeLessThanOrEqual(iw);
      // and no element pokes out of the viewport inside a clipped box either (the fuel table did) — but for the one
      // strip that scrolls sideways by design: the position bar's row of recent places (#1112, owner: "ONE row of chips
      // that scrolls sideways on a narrow screen"), itself inside the viewport
      const wide = await page.$$eval("main *", (els) => els.filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1 && e.closest(".placepos__chips") === null).map((e) => `${e.tagName}.${e.getAttribute("class") ?? ""}`));
      const strip = await page.$$eval(".placepos__chips", (ss) => ss.map((e) => { const r = e.getBoundingClientRect(); return r.right <= window.innerWidth + 1 && getComputedStyle(e).overflowX === "auto"; }));
      expect(strip.every(Boolean), `width ${width}: the chip strip is inside the viewport and scrolls`).toBe(true);
      expect(wide, `width ${width}`).toEqual([]);
      await ctx.close();
    }
  });

  // Every page in every language, not only the home: a verbatim credit line
  // quoting an unbroken URL widened /en/connect and /ru/connect to 699 px on a
  // 375 px phone for as long as this test read /de alone (found in the v1.7.5
  // baselines, which had recorded the overflow as the expected picture).
  it("overflows horizontally on no page of the map at 375 and 768", async () => {
    const paths = allPaths();
    expect(paths.length).toBeGreaterThanOrEqual(40);
    const wide: string[] = [];
    let measured = 0;
    // Twenty-two languages since #753 put ~300 pages on the map, and reading
    // them in one sequence ran past the timeout: each width is now read by four
    // pages at once, each taking the next path off one shared queue.
    for (const width of [375, 768]) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 } });
      const queue = [...paths];
      await Promise.all(
        Array.from({ length: 4 }, async () => {
          const page = await ctx.newPage();
          for (let path = queue.shift(); path !== undefined; path = queue.shift()) {
            await gotoSettled(page, `http://127.0.0.1:${PORT}${path}`);
            const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
            measured += 1;
            if (sw > iw) wide.push(`${path} @${width}: ${sw} px`);
          }
        }),
      );
      await ctx.close();
    }
    expect(measured).toBe(paths.length * 2);
    expect(wide.sort()).toEqual([]);
  }, 180_000);

  // Owner 2026-10-05 on the live v1.8.2: the fuel table and the BKG credit's
  // unbroken URL widened /de to 1 477 px at 1 366. Measured on REAL fragments
  // (production markup) at the three widths, on the home and the connect page:
  // the document never scrolls sideways, and no element pokes out of the viewport.
  it("overflows horizontally at no width on REAL fragments: /de, /en and /de/connect at 1366, 768 and 375", async () => {
    if (shell) shell.kill();
    if (stub) await stub.close();
    stub = undefined;
    const real = await startRealDigest();
    shell = await startShell(PORT, { DIGEST_URL: real.url });
    try {
      const report: string[] = [];
      const max: Record<string, number> = {};
      let checked = 0;
      for (const width of [1366, 768, 375]) {
        const ctx = await browser.newContext({ viewport: { width, height: 900 } });
        const page = await ctx.newPage();
        for (const path of ["/de", "/en", "/de/connect"]) {
          await gotoSettled(page, `http://127.0.0.1:${PORT}${path}`);
          // open every fold and disclosure, so what a click reveals is measured too
          await page.$$eval("details", (ds) => ds.forEach((d) => (d.open = true)));
          const [sw, iw, n] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth, document.querySelectorAll("body *").length]);
          max[String(width)] = Math.max(max[String(width)] ?? 0, sw);
          checked += n;
          if (sw > iw) report.push(`${path} @${width}: scrollWidth ${sw} > ${iw}`);
          const wide = await page.$$eval("body *", (els) =>
            els
              .filter((e) => {
                const r = e.getBoundingClientRect();
                if (r.width === 0 || (r.right <= window.innerWidth + 1 && r.left >= -1)) return false;
                // a code sample inside a box that scrolls itself (overflow-x: auto) is clipped by that box, not by the page
                for (let a = e.parentElement; a !== null && a !== document.body; a = a.parentElement) {
                  const ox = getComputedStyle(a).overflowX;
                  if ((ox === "auto" || ox === "scroll") && a.getBoundingClientRect().right <= window.innerWidth + 1) return false;
                }
                return true;
              })
              .slice(0, 5)
              .map((e) => `${e.tagName}.${e.getAttribute("class") ?? ""} ${Math.round(e.getBoundingClientRect().right)}`),
          );
          for (const w of wide) report.push(`${path} @${width}: ${w}`);
        }
        await ctx.close();
      }
      console.log(`max scrollWidth on real fragments: ${JSON.stringify(max)}`);
      expect(checked, "elements measured").toBeGreaterThan(3000);
      expect(report).toEqual([]);
    } finally {
      shell.kill();
      shell = undefined;
      await real.close();
    }
  }, 120_000);

  // #799 C15: on the built home with the REAL digest's fragments, the parking
  // moment shows the lorry tile and then the city car-park tile, each with its
  // own title and only its own sources' credit lines, at 375 px with no overflow.
  it("shows the lorry tile and then the city car-park tile in the parking group of \"Deutschland jetzt\" (#990; the parking moment until then), each with its own sources, on REAL fragments (#799)", async () => {
    if (shell) shell.kill();
    if (stub) await stub.close();
    stub = undefined;
    const real = await startRealDigest();
    shell = await startShell(PORT, { DIGEST_URL: real.url });
    try {
      const hh = (LICENCE_CATALOGUE["hamburg_parkhaeuser"]?.attribution ?? "").split(",")[0] ?? "";
      const truck = (LICENCE_CATALOGUE["mobilithek_truckpark_static_geonutzv"]?.attribution ?? "").split(",")[0] ?? "";
      expect(hh).not.toBe("");
      expect(truck).not.toBe("");
      for (const lang of ["de", "en"] as const) {
        const ctx = await browser.newContext({ viewport: { width: 375, height: 900 } });
        const page = await ctx.newPage();
        await gotoSettled(page, `http://127.0.0.1:${PORT}/${lang}`);
        await settled(page, `/${lang}`);
        const order = await page.$$eval("section.tile[id^='tile-']", (els) => els.map((e) => e.id));
        const iL = order.indexOf("tile-lorry");
        const iC = order.indexOf("tile-carparks");
        expect(iL, `${lang}: lorry tile`).toBeGreaterThanOrEqual(0);
        expect(iC, `${lang}: car-park tile right after it`).toBe(iL + 1);
        // both in the same group of the national band
        const sameMoment = await page.evaluate(() => {
          const a = document.getElementById("tile-lorry")?.closest(".now__group");
          return a !== null && a !== undefined && a.id === "now-parking" && a === document.getElementById("tile-carparks")?.closest(".now__group");
        });
        expect(sameMoment, lang).toBe(true);
        const cars = (await page.locator("#tile-carparks").textContent()) ?? "";
        const lorry = (await page.locator("#tile-lorry").textContent()) ?? "";
        expect(await page.locator("#tile-carparks .tile__title").textContent(), lang).toBe(t(lang, "tiles.carparks"));
        expect(await page.locator("#tile-carparks").getAttribute("class"), lang).toMatch(/is-(ok|stale)/);
        expect(cars, `${lang}: a city line on the car-park tile`).toContain(hh.replace("&amp;", "&"));
        expect(cars, `${lang}: no lorry line on the car-park tile`).not.toContain(truck.replace("&amp;", "&"));
        expect(lorry, `${lang}: no city line on the lorry tile`).not.toContain(hh.replace("&amp;", "&"));
        const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
        expect(sw, `${lang}@375 overflow`).toBeLessThanOrEqual(iw);
        await ctx.close();
      }
    } finally {
      shell.kill();
      shell = undefined;
      await real.close();
    }
  }, 120_000);

  /**
   * Since #564 a panel that misses the shell's 500 ms deadline arrives later by a
   * background fill, so a page is measured only once no placeholder is busy and
   * none failed: on a slow runner (the amd64-emulated noble container) en@320
   * was measured at 5 444 px, a page whose cards had not arrived yet.
   */
  const settled = async (page: Page, where: string): Promise<void> => {
    await page.waitForFunction(() => document.querySelector('[data-vf-fill][aria-busy="true"]') === null, null, { timeout: 20_000 });
    expect(await page.locator("[data-vf-fill].is-error").count(), `${where}: a background fill failed`).toBe(0);
  };
  it("stays under the measured height budget at 390, 375 and 320 px on REAL fragments (ten reports, three fuel grades, every source), credit lines visible, under the transfer budget", async () => {
    if (shell) shell.kill();
    if (stub) await stub.close();
    stub = undefined;
    const real = await startRealDigest();
    // #744: production's live assistant answers beside the facts — a home measured without them stands shorter.
    const asks = await startAsksStub();
    shell = await startShell(PORT, { DIGEST_URL: real.url, MCP_INTERNAL_URL: asks.url });
    try {
      const heights: Record<string, number> = {};
      // the narrower phones first: the home's answers are open at every width (owner 2026-10-05), so 375 and 320 are measured too
      for (const width of [375, 320] as const) {
        for (const lang of ["de", "en"] as const) {
          const ctx = await browser.newContext({ viewport: { width, height: 844 } });
          const page = await ctx.newPage();
          await gotoSettled(page, `http://127.0.0.1:${PORT}/${lang}`);
          await settled(page, `${lang}@${width}`);
          heights[`${lang}@${width}`] = await page.evaluate(() => document.documentElement.scrollHeight);
          await ctx.close();
        }
      }
      for (const lang of ["de", "en"] as const) {
        const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
        const page = await ctx.newPage();
        await gotoSettled(page, `http://127.0.0.1:${PORT}/${lang}`);
        await settled(page, `${lang}@390`);
        heights[lang] = await page.evaluate(() => document.documentElement.scrollHeight);
        // #935 (owner 2026-10-22, rule 2): the first screen of a phone carries the tagline, the pitch and the connect
        // button, under the beta notice and the place bar; the one real conversation (#742) follows the button, so it now
        // starts on the first screen and ends below it. Measured 2026-10-22 at 390×844 (noble, DejaVu): de button
        // 608–652 and the sign from 707; el (the longest pitch) button 734–778.
        const SEL = [".hero h1", ".hero .hero__pitch", ".hero .btn--primary"] as const;
        const fold = await page.evaluate((sels) => sels.map((s) => document.querySelector(s)?.getBoundingClientRect().bottom ?? Number.POSITIVE_INFINITY), [...SEL]);
        for (const [i, b] of fold.entries()) expect(b, `${lang}@390: ${SEL[i]!} ends at ${String(b)} px`).toBeLessThanOrEqual(844);
        // #1153 (owner 2026-11-03): the place headline is the header's, on every page — above the hero, on the first
        // screen; the conversation follows the button (the #1088 order, headline after the button, is retired with it).
        const [button, head, sign] = await page.evaluate(() => [".hero .btn--primary", "header .placehead", ".hero .sign"].map((s) => document.querySelector(s)?.getBoundingClientRect() ?? null).map((r) => (r === null ? null : { top: r.top, bottom: r.bottom })));
        expect(await page.locator("#place .placehead").count(), `${lang}@390: no headline in the place section`).toBe(0);
        expect(head!.bottom, `${lang}@390: the place headline is above the button`).toBeLessThanOrEqual(button!.top);
        expect(head!.bottom, `${lang}@390: the place headline is on the first screen`).toBeLessThanOrEqual(844);
        expect(sign!.top, `${lang}@390: the conversation follows the button`).toBeGreaterThan(button!.bottom);
        expect(await page.$eval(".hero .sign", (e) => e.getAttribute("data-live"))).toBe("1");
        // every tile came from the real digest; every credit line on a tile is laid out, or folded WITH its tile's data in a
        // fold whose visible summary names its publishers (FS-2026-11-06, FS1/FS3) — never folded away from data in view
        for (const id of EMBEDDED_TILES) expect(await page.$(`#tile-${id}:not(.is-error)`), id).not.toBeNull();
        const credits = await page.$$eval(".tile .credit", (ps) =>
          ps.map((p) => {
            const fold = p.closest("details.fold:not([open])");
            if (fold === null) return p.getBoundingClientRect().height > 0 && p.closest("details:not([open])") === null;
            const line = fold.querySelector(":scope > summary .fold__sources");
            return line !== null && line.getBoundingClientRect().height > 0;
          }),
        );
        expect(credits.length).toBeGreaterThanOrEqual(EMBEDDED_TILES.length);
        for (const visible of credits) expect(visible).toBe(true);
        const folds = await page.$$eval("details.fold", (ds) => ds.map((d) => (d as HTMLDetailsElement).open));
        expect(folds.length).toBeGreaterThanOrEqual(5);
        expect(folds.every((o) => !o)).toBe(true);
        await ctx.close();
        const html = await (await fetch(`http://127.0.0.1:${PORT}/${lang}`)).text();
        expect(html).not.toContain("Stub ");
        const sheet = /href="(\/_a\/site\.[^"]+\.css)"/.exec(html)?.[1] ?? "";
        const css = await (await fetch(`http://127.0.0.1:${PORT}${sheet}`)).text();
        // 100 000 until v1.8.4 put production's answer under every question (owner 2026-10-05:
        // "All example requests must have the right response!"): the home measured 100 960 at v1.8.8.
        // The raw size is a proxy; the transfer budget on the next line is the cost a reader pays,
        // and it still holds. The raw ceiling moves by one answer card of headroom, not more.
        // 2.0.0: + the place block (#564: the pill, the sheet and its island, the outside hero
        // with the popular places) and the News strip (#588) — de measured 104 584 B; the
        // hard limit stays the page budget's 150 KB (`scripts/budget.ts`).
        // #564 render-then-fill (owner 2026-10-12): + the filler script (2 004 B inline, `lib/fill.ts`) and the
        // island's `how`/fill wiring — de measured 109 526 B on these fragments; one more card of headroom.
        // 2.1.13 (#715): + the link strip of the live pages (the nine one-digit motorways, the index, the twelve
        // largest cities — the internal links the task asked for, inside the page budget): de measured 112 611 B.
        // 2.1.16 (#716 C1): + the home's motorway block. It first measured 115 132 B and was TRIMMED, not the
        // bound raised: the zero counts left out of its rows, the rows' class in a <small>, the order sentence
        // left to the index that states it, an unused wrapper class — de 114 656, ru 114 567 B (block 2.0 KB).
        // 2.1.17 (#716, owner: "Make it visible and easy understandable, attractive"): the block became cards — each motorway
        // one link with its route ends and worded count chips, the order sentence with its Stand, and the catalogue as a
        // button with the register's count — and moved up under the live tiles. Trimmed first (short class names, no
        // translate mark on a bare road number), then measured on these fragments: de 116 782 B, en 115 256 B (+2 126 B on
        // de's 114 656). The bound moves by that and ~700 B of headroom, not to the 120 000 allowed. Heights at the same run:
        // 390 px de 15 898 / en 15 293, 375 px de 16 279 / en 15 747, 320 px de 18 823 / en 18 147 — inside the budget below.
        // 2.1.18 (#744, owner 2026-10-14: each card shows its theme's live figure and, beside it, the live MCP question
        // and answer; "Update limit to 500"): three facts gained their question, production's answer, its tool, its
        // time and the short credit line of every source that answered (not folded: a figure and its source may not be
        // hidden) — the long tool attribution was replaced by those register lines first, which halved the cost.
        // Measured on these fragments with production's recorded answers: de 123 220 B (+6 438 B on 116 782). The
        // bound moves by that and ~800 B of headroom; the 500 KB page limit (scripts/budget.ts) is far above it.
        // 2.1.19 (owner 2026-10-15: "there must be usually 7 news items"): the News strip went from three entries
        // to seven (`HOME_NEWS_COUNT`), four more one-line links — de measured 125 343 B (+2 123 B on 123 220,
        // ~530 B an entry). The bound moves by that and ~850 B of headroom, as before.
        // 2.1.23 (#706, data-steward L4): the place island gained the twelve-month expiry of a kept choice — the
        // month stamp, the deletion and the stamping of entries from before — printed 12 865 → 13 757 B (de, the
        // island alone, measured with islandScript). Home de 126 387 B (+1 044 on 125 343). The bound moves by that
        // and ~800 B of headroom, as before.
        // 2.1.24 (#746, owner 2026-10-15: "restore every removed example"): every moment carries three questions
        // again (eighteen more questions and answers, each with its credit lines, in the folds) and four fuel
        // requests; the first question of the driving, parking and charging moments is the engine's own, answered
        // live. Measured 2026-10-17 on these fragments with production's recorded answers: de 154 542 B (+28 155 B
        // on 126 387), en 152 875 B. The bound moves by that and ~850 B of headroom; the 500 KB page limit is far above.
        // 2.3.0 (#863): a place chosen on a place page navigates to that place's page, so the island printed on the
        // home grew 12 962 → 13 556 B (+594 B, measured with islandScript against v2.2.14's island.ts). Home de
        // measured 2026-10-20 at 155 485 B (+943 B on 154 542; the rest is the real fragments' text). No credit line
        // repeats inside one answer's run of credits (checked on that page). The bound moves by the 943 B.
        // 2.3.8 (#890, owner 2026-10-21: the motorway page follows the radius): the island swaps the motorway page's
        // main block, restores it for "all of Germany" and hides the DB-IP credit once another rung answered — printed
        // 15 117 → 15 931 B (+814 B, de, measured with islandScript against v2.3.7's island.ts). Home de measured
        // 2026-10-21 at 157 244 B (+901 B on the old bound, which these fragments had already reached).
        // 2.3.8 review: the credit is no longer hidden, the settle ask never swaps under a focus inside the main block,
        // and a restored main block drops its fuel prices — printed 15 931 → 16 187 B (+256 B, de, islandScript).
        // Home de measured 2026-10-21 at 157 506 B. The bound moves by that and ~800 B of headroom, as before.
        // 2.3.12 (#753): the language menu became a panel grouped by script, each language with its name and its badge,
        // and every language added one menu link and one hreflang alternate. Home de measured with French live at
        // 159 304 B; with French, Spanish, Italian and Portuguese 160 411 B, so ~370 B for each further language (its
        // menu link and its alternate). The bound moves by the first and ~800 B of headroom, and by 380 B per language.
        // 2.3.21 (#989): a country flag before every name of both language menus (23 flags, English two) and the one
        // sprite they use: 10 884 B raw on every home, measured by stripping the sprite and the flags from the built
        // page (de 175 021 → 164 137 B; ~1.5 KB gzip). The bound moves by 10 900 B.
        // 2.3.21 (#1001, owner 2026-10-24: every AI answer example says it works only with ViaFrei connected): one note
        // under each of the home's 32 example answers (the sign, the moments, the fuel request, the "Heute" pairs), each
        // with its in-place how-to (endpoint, three clients' steps, the guide link): 1 400 B per note in German, 44 800 B
        // raw on the home, measured by stripping the notes from the built page on these fragments (de 219 846 →
        // 175 046 B, en 215 392 → 173 248 B). gzip carries the repeats for ~1.5 KB. The bound moves by 44 800 B.
        // 2.3.22 (#1003, #1006): the endpoint chip with its copy button and the eight assistants' links in each of the
        // 32 notes (1 976 B per note in German, was ~1 400: +576 B, 18 432 B on the home), the hero's connected line
        // (169 B) and the chip of the 60-second block. Measured at the 2.3.22 cut on these fragments: de 239 949 B
        // (+20 103 B on 219 846), en 237 146 B (+21 754 B on 215 392). The bound moves by 20 100 B (de
        // stays ~1.3 KB under it, en ~4 KB).
        // 2.4.6 (owner 2026-10-28): the bound is a flat 250 000 B, replacing the formula 235 900 + 380 B per live language
        // past eight — measured 241 487 B (de) on Linux at 7bd20f721 (the home's station search with its type-ahead, the
        // stations block's chips). The gzip limit below is unchanged.
        // 2.5.14 (owner 2026-11-05: "Raise to 255 000 B"): 250 853 B (de) on Linux at b4e67e701, +3.2 KB on 2.5.13's
        // 247 672 B — the #1186 recent-places upgrade script (2 090 B) and the location island (+739 B).
        // 2.5.16 (owner 2026-11-06 "Raise limits", inside the 700 KB raw budget): 256 078 B (de) on Linux at 1a1f49f2b —
        // FS11's names line under each first block is the growth. The bound moves to 262 000 B.
        // 2.5.17 (#1180, the desktop dashboard): the desk script with the home's config (6 417 B inline: the minified
        // `lib/desk.ts` and its fold/cap/move lists) and the heat strip's rows six to ten of each top list (`is-desk`,
        // 1 616 B, hidden below 1024 px) — de measured 265 416 B on Linux (noble arm64) on these fragments. The bound
        // moves to 268 000 B, inside the 700 KB raw budget; the gzip limit below is unchanged. Owner 2026-11-06 ("Raise to 268 KB"): the desk script stays inline, before first paint.
        console.log(`home raw html ${lang}: ${String(html.length)} B`);
        // owner 2026-11-08: home 268 654 B with the live-map loader (#1183)
        // Owner 2026-11-16 ("Increase the budget to 300"): 300 000 B. #746 gave the home answers their full credits;
        // the home measures 286 612 B (de; e2e-arm, 2.6.19 release head), see HOME_RAW_MAX in scripts/budget.ts.
        expect(html.length).toBeLessThan(HOME_RAW_MAX);
        // data-steward on 2.6.19 (#746, #1193): a later answer may only NAME a publisher ("Ebenso aus den Quellen oben: …")
        // whose full register line, or a #1120 disclosure naming it, stands on the same card BEFORE that answer. Read on
        // the served page, in document order: `aboveIds` alone only proves the ids exist in the catalogue.
        let named = 0;
        for (const card of all(html, "article.moment")) {
          const els = elements(card);
          for (const again of els.filter((e) => classesOf(e).includes("qa-answer__again"))) {
            let answer = again.parent;
            while (answer !== null && !classesOf(answer).includes("qa-answer")) answer = answer.parent;
            expect(answer, "the short line sits in an answer").not.toBeNull();
            const before = els.slice(0, els.indexOf(answer!));
            const lines = before.filter((e) => e.tag === "li" && e.attrs.lang === "de").map((e) => shortSource(nodeText(e)));
            const folds = before.filter((e) => e.tag === "details" && classesOf(e).includes("sources")).map((e) => nodeText(e.children.find((c) => "tag" in c && c.tag === "summary") ?? { text: "" }));
            const names = all(again, 'span[translate="no"]').map((e) => nodeText(e).trim());
            expect(names.length, `${lang}: a short line names someone`).toBeGreaterThan(0);
            for (const n of names) {
              named++;
              expect(lines.includes(n) || folds.some((f) => f.includes(n)), `${lang} ${card.attrs.class ?? ""}: "${n}" stands above`).toBe(true);
            }
          }
        }
        console.log(`home ${lang}: ${String(named)} publishers named as standing above`);
        expect(named, "the check reads something").toBeGreaterThan(0);
        // #1064: the gate's own limit (200 KB since the owner decision of 2026-10-25; 80 KB since #891), never a second copy of it.
        expect(gzipSync(html).length + gzipSync(css).length).toBeLessThan(LIMITS.gzipTotal);
      }
      console.log(`mobile height on real fragments: ${JSON.stringify(heights)}`);
      // 6 000 px (#379) + the fuel tile (#423, owner 2026-10-04): its sample, qualifier
      // and MTS-K note are data-steward conditions and may not fold, so the budget moved
      // by what they cost (de measured 6 122 px) instead of the lines moving into a fold.
      // #430-#432 (owner 2026-10-04): three more moments — jams, places, watches — each
      // a card with one visible question and no tile, ~250 px apiece at 390 px. Measured
      // locally de 6 869 / en 6 706 px. CI measured 6 498 with SIX moments where this
      // machine reads 6 122 (63f6a9e4, run 37194074355); adding the same ~380 px offset
      // PROJECTS nine moments at ~7 250 on CI (a proportional gap gives ~7 290), so the
      // budget is that projection plus one card of headroom — CI has not measured nine yet.
      // v1.8.2 PR 3 (owner 2026-10-05: "find the proper height"): eight moments now show
      // production's answer OPEN under their first question at every width, each a short
      // glance (≤ 160 characters, the rest folded) with its credit lines, which may not fold.
      // Measured locally on these real fragments, 2026-10-05: 390 px de 8 567 / en 8 262,
      // 375 px de 8 820 / en 8 552, 320 px de 10 247 / en 9 769 (ru, not judged here, 8 884 /
      // 9 224 / 10 894). CI measures HIGHER than this machine (6 498 there against 6 122 here on
      // the six-moment page, +380 px, comment above), so the budget is the larger of de/en plus
      // that offset plus ~3 % headroom: 390 → 9 200, 375 → 9 500, 320 → 11 000. Growing past it
      // means a moment grew, and the fix is a shorter glance, not a bigger number.
      // v1.8.2 PR 3, the tiles merged in (feat/1.8.2-tiles): no moment grew — the TILES did,
      // by what the owner asked of them on 2026-10-05 and the data steward's conditions keep
      // unfolded: the punctuality tile names three cities and carries the DELFI static line
      // beside the realtime one (its share leaves out the untimed trips), the fact carries
      // that line too, and the fuel tile lists up to three stations per Land with addresses.
      // Measured on these real fragments, 2026-10-05, at 390 px: tile-punctuality 968 px,
      // tile-fuel 727 px, each credit line 36 px. Page: 390 px de 9 491 / en 9 113, 375 px
      // de 9 795 / en 9 431, 320 px de 11 387 / en 10 813. Same method as above (the larger
      // of de/en + CI's +380 px + ~3 %): 390 → 10 200, 375 → 10 500, 320 → 12 100.
      // v1.8.x (owner 2026-10-05: "All example requests must have the right response! Not
      // only first."): every question now carries production's answer directly under it. The
      // second and third sit in the moments' folds (closed on a phone, so they cost nothing
      // here); what is OPEN on a phone grew by the watch moment's first answer, the fourth
      // "Heute" fact (lorry parking) and the folded fuel requests' summary under the fuel tile
      // (their reasons, questions and answers fold on a phone like the moments' — measured
      // unfolded they were 1 541 px at 390). Measured on these real fragments, 2026-10-05:
      // 390 px de 10 315 / en 9 986, 375 px de 10 650 / en 10 334, 320 px de 12 463 / en
      // 12 020. Same method (the larger of de/en + CI's +380 px + ~3 %): 390 → 11 000,
      // 375 → 11 400, 320 → 13 200.
      // v1.8.18: no moment grew — seven moments LOST their folded question (closed on a phone, so
      // that saved no height) and the fuel board left the home. What grew is the FIXTURE: it now
      // renders production's tiles, and on a phone the height comes from the parts that stay OPEN —
      // the credit line of each of nine lorry-parking and eight charging sources (each its own line,
      // which may not fold) and the publishers' long report titles. The punctuality tile's sixteen
      // Länder sit in a fold that is closed below 601 px, so they cost no height here. The fixture
      // now measures the height production already has. Measured on these real fragments, 2026-10-06: 390 px de 12 095 /
      // en 11 771, 375 px de 12 459 / en 12 209, 320 px de 14 790 / en 14 407. Same method (the
      // larger of de/en + CI's +380 px + ~3 %): 390 → 12 900, 375 → 13 300, 320 → 15 700.
      // 1.8 (#520, #519): two live tiles joined the home — the city jams under the jam moment
      // (ten cities, the three longest jams in the publishers' words, five credit lines) and the
      // eight main stations under the station moment (eight rows, three credit lines); neither
      // folds, because a figure and its source may not be hidden. Measured on these real
      // fragments, 2026-10-07: 390 px de 14 640 / en 14 136, 375 px de 15 024 / en 14 572,
      // 320 px de 17 626 / en 17 040. Same method: 390 → 15 500, 375 → 15 900, 320 → 18 600.
      // 1.9 (cut locally, so CI first measured it on the 1.9.17 main, run 38168649155): the
      // line's site examples and sources (Hamburg roadworks #490, the rotated cards, the new
      // sources' credit lines, which may not fold) put de@375 at 16 062 against 15 900 — about
      // 1 %, and under the local gate because this machine reads ~380 px lower. These are CI's
      // OWN numbers, so no offset is added: 390 px de 15 475 / en 14 984, 375 px de 16 062 /
      // en 15 574, 320 px de 19 105 / en 18 450. Larger of de/en + ~3 %: 390 → 16 000,
      // 375 → 16 600, 320 → 19 700.
      // 2.0.4 (#693 nearest stations and nearby places, #564 fuel ring and render-then-fill),
      // measured in the Playwright noble container (the visual baselines' renderer) after every
      // background fill settled: 390 px de 16 039 / en 15 548, 375 px de 16 671 / en 16 164,
      // 320 px de 19 775 / en 19 159. Same method: 390 → 16 500, 375 → 17 200, 320 → 20 400.
      // 2.1.18 (#744, owner 2026-10-14: each "Heute" fact paired with its live assistant question and answer, the
      // answer's credit lines unfolded because a figure and its source may not be hidden): measured on this machine
      // with production's recorded answers, 2026-10-15: 390 px de 17 527 / en 16 906, 375 px de 17 924 / en 17 424,
      // 320 px de 20 756 / en 20 086 — about 500 px per pair on a phone, and the long tool attributions had already
      // been replaced by the register's short lines. This machine reads ~380 px lower than CI, so the method above
      // (larger of de/en + 380 + ~3 %): 390 → 18 450, 375 → 18 850, 320 → 21 800.
      // 2.1.24 (#746): the second and third questions sit in the folds (closed on a phone, no height); what grew
      // OPEN is the three moments whose first question is now the engine's live answer (`LiveAsk`: its own question,
      // the answer card with tool, time and a credit line per source, and the "ask your assistant" link, which a
      // recorded answer did not carry). Measured on this machine, 2026-10-17: 390 px de 18 669 / en 18 137,
      // 375 px de 19 065 / en 18 615, 320 px de 22 123 / en 21 484 (+1 142 px de@390). Same method (larger of de/en
      // + 380 + ~3 %): 390 → 19 650, 375 → 20 050, 320 → 23 200.
      // 2.3.16 (#935): re-measured in the Playwright noble container with DejaVu (the visual baselines' renderer),
      // 2026-10-23, at three trees on the same fixture. The 2.1.24 budget came from a macOS measurement, and the
      // container reads ~1 000 px more than macOS, not the +380 assumed above: v2.1.24 ITSELF measures there
      // 390 px de 19 692 / en 19 211, 375 px de 20 395 / en 19 850, 320 px de 23 956 / en 23 254 — over its own
      // budget at every width from the day it was set. v2.3.15 grew by content, nothing bloated: 390 px de 20 365 /
      // en 19 909, 375 px de 21 164 / en 20 644, 320 px de 24 843 / en 24 021 (+673 px de@390). Of that, the city
      // car-park tile beside the lorry tile (#799) +978 px — one figure and credit line per source, which may not
      // fold — less 312 px the lorry tile's credits lost and 56 px of the fuel board's form that left the home;
      // the motorway block +66 px (the BASt LCL credit line, and each of its nine rows 5 px taller). The brand hero
      // (#935) adds 98–172 px: 390 px de 20 500 / en 20 081, 375 px de 21 262 / en 20 816, 320 px de 25 002 /
      // en 24 181. These are the container's OWN numbers, so no offset is added (the 1.9 method): larger of de/en
      // + ~3 %: 390 → 21 150, 375 → 21 900, 320 → 25 800.
      // Printed so a re-measure reads every width at once (the method below needs all six).
      // 2.3.21 (#1001): the "works only with ViaFrei connected" note under every one of the home's 32 example answers,
      // its summary a 44 px control (a11y.e2e.ts's target rule) that wraps to two lines on a phone. Measured on this
      // machine (macOS) with the notes' own boxes summed, 2026-10-24: 2 512 px at 390, 375 and 320, de and en alike;
      // the pages then read 390 px de 20 648 / en 20 062, 375 px de 21 063 / en 20 645, 320 px de 24 305 / en 23 704.
      // The 2.3.16 container numbers plus the notes, + ~3 % (the method above): 390 → 23 700, 375 → 24 500,
      // 320 → 28 350. Re-measured at the 2.3.21 cut in the Playwright noble container with DejaVu (the visual
      // baselines' renderer), 2026-10-24: 390 px de 21 617 / en 21 198, 375 px de 22 379 / en 21 933, 320 px
      // de 26 119 / en 25 297 (+1 117 px de@390 over 2.3.16's container numbers; the macOS sum over-counted the
      // notes). The container's own numbers, larger of de/en + ~3 %: 390 → 22 300, 375 → 23 050, 320 → 26 900.
      console.log(`measured heights: ${JSON.stringify(heights)}`);
      const BUDGET: Readonly<Record<string, number>> = { "390": 22300, "375": 23050, "320": 26900 };
      for (const lang of ["de", "en"] as const) {
        expect(heights[lang], `${lang}@390 ${heights[lang]} px`).toBeLessThan(BUDGET["390"]!);
        for (const w of ["375", "320"]) expect(heights[`${lang}@${w}`], `${lang}@${w} ${heights[`${lang}@${w}`]} px`).toBeLessThan(BUDGET[w]!);
      }
      // and the folds open themselves on a desktop
      const wide = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const wp = await wide.newPage();
      await gotoSettled(wp, `http://127.0.0.1:${PORT}/de`);
      expect(await wp.$eval(".toolgroups", (e) => e.getBoundingClientRect().height)).toBeGreaterThan(100);
      expect(await wp.$eval(".fold__summary", (e) => getComputedStyle(e).display)).toBe("none");
      await wide.close();
    } finally {
      shell.kill();
      shell = undefined;
      await real.close();
      await asks.close();
    }
  });
  it("keeps the hero's connect button whole on the first screen of a 375×812 phone in every live language (#1153)", async () => {
    if (shell) shell.kill();
    if (stub) await stub.close();
    stub = undefined;
    const real = await startRealDigest();
    const asks = await startAsksStub();
    shell = await startShell(PORT, { DIGEST_URL: real.url, MCP_INTERNAL_URL: asks.url });
    try {
      // #1153 (lead decision 2026-11-03): with the place row moved into the header, the home hero's connect button
      // (`.hero .btn--primary`) must still end on the FIRST screen of a phone — judged at 375×812, the shortest phone
      // the budget measures, in every live language (the 390×844 check above covers de and en only, and el's pitch
      // stood ~126 px lower than de's). Linux's DejaVu runs wider than macOS's fonts, so the bound here is the screen
      // less a 40 px margin, not the screen itself.
      const H = 812;
      const MARGIN = 40;
      const bottoms: Record<string, number> = {};
      for (const lang of LIVE_LANGS) {
        const ctx = await browser.newContext({ viewport: { width: 375, height: H } });
        const page = await ctx.newPage();
        await gotoSettled(page, `http://127.0.0.1:${PORT}/${lang}`);
        await settled(page, `${lang}@375x812`);
        bottoms[lang] = await page.$eval(".hero .btn--primary", (e) => Math.round(e.getBoundingClientRect().bottom));
        await ctx.close();
      }
      console.log(`hero button bottom at 375x812: ${JSON.stringify(bottoms)}`);
      for (const lang of LIVE_LANGS) expect(bottoms[lang], `${lang}@375x812: the connect button ends at ${String(bottoms[lang])} px`).toBeLessThanOrEqual(H - MARGIN);
    } finally {
      shell.kill();
      shell = undefined;
      await real.close();
      await asks.close();
    }
  }, 180_000);
  it("links the licence text beside every tile line and every Sources line that owes it, in all seven languages (owner 2026-10-05)", async () => {
    // MUTANT (run 2026-10-05): `licenceLink()` in packages/digest/src/presentation/tiles.ts
    // returning "" turns the tile half red; the Sources clause removed turns the other half red.
    if (shell) shell.kill();
    if (stub) await stub.close();
    stub = undefined;
    const real = await startRealDigest();
    shell = await startShell(PORT, { DIGEST_URL: real.url });
    try {
      const owing = Object.entries(LICENCE_CATALOGUE).filter(([, f]) => f.attribution !== null && f.attribution !== undefined && licenceTextFor(f.label) !== null);
      let tileLines = 0;
      let sourceLines = 0;
      for (const lang of LIVE_LANGS) {
        const html = (await (await fetch(`http://127.0.0.1:${PORT}/${lang}`)).text()).replace(/&amp;/g, "&").replace(/&quot;/g, '"');
        for (const m of html.matchAll(/<(p|li) class="credit[^"]*" lang="de">([\s\S]*?)<\/\1>/g)) {
          const inner = m[2] ?? "";
          const hit = owing.find(([, f]) => inner.includes(`>${f.attribution}</a>`));
          if (hit === undefined) continue;
          if (m[1] === "p") tileLines++;
          else sourceLines++;
          const lt = licenceTextFor(hit[1].label)!;
          expect(inner, `${lang}: «${hit[0]}» without its licence text`).toContain(
            ` · <a class="credit__licence" href="${lt.url}" rel="license noopener noreferrer" lang="${lang}">${t(lang, "sources.licenceText")}</a>`,
          );
        }
      }
      // both carriers were read, in every language, or the sweep proved nothing
      expect(tileLines, "tile lines owing the link").toBeGreaterThanOrEqual(LIVE_LANGS.length);
      expect(sourceLines, "Sources lines owing the link").toBeGreaterThanOrEqual(LIVE_LANGS.length);
    } finally {
      shell.kill();
      shell = undefined;
      await real.close();
    }
  });
  it("embeds the fuel tile on the home in all seven languages (#423): its MTS-K credit, its sample, and no price in any other tile", async () => {
    if (shell) shell.kill();
    if (stub) await stub.close();
    stub = undefined;
    const real = await startRealDigest();
    shell = await startShell(PORT, { DIGEST_URL: real.url });
    try {
      for (const lang of LIVE_LANGS) {
        const html = await (await fetch(`http://127.0.0.1:${PORT}/${lang}`)).text();
        const fuel = /<section class="tile is-(?:ok|stale) vf-noclarity" id="tile-fuel"[\s\S]*?<\/section>/.exec(html)?.[0] ?? "";
        // a stacked list, never a table (owner 2026-10-05: the table ran out of the card)
        expect(all(fuel, "ul.fuel").length, lang).toBeGreaterThan(0);
        expect(all(fuel, "table"), lang).toEqual([]);
        // ruling condition 5: the credit element exactly as the digest emits it — German, the line, the MTS-K note in the SAME element
        const credit = /<p class="credit credit--fuel" lang="de">([\s\S]*?)<\/p>/.exec(fuel)?.[1] ?? "";
        expect(credit, lang).toContain("Tankerkönig");
        expect(all(credit, "span.credit__note").map(nodeText), lang).toContain(`${MTSK_CONSUMER_NOTE}`);
        // ruling condition 3: N, the window and the sample qualifier stay visible
        const subs = [...fuel.matchAll(/<p class="tile__sub">([\s\S]*?)<\/p>/g)].map((m) => m[1] ?? "");
        expect(subs.length, lang).toBe(2);
        expect(subs[0], lang).toMatch(/318/);
        expect(subs[0], lang).toMatch(/\d{2}:\d{2}/);
        expect((subs[1] ?? "").length, lang).toBeGreaterThan(40);
        // the unit and the decimal in the page's language (#449; owner 2026-10-05: German "1,739 €/l", never "1.739 EUR/l")
        // the Cyrillic languages and Greek write the litre in their own script (Serbian and Greek since #753)
        const unit = ({ ru: "€/л", uk: "€/л", bg: "€/л", sr: "€/л", el: "€/λ" } as Readonly<Record<string, string>>)[lang] ?? "€/l";
        expect(fuel, lang).toContain(unit);
        expect(fuel, lang).not.toContain("EUR/l");
        expect(fuel, lang).toMatch(lang === "en" ? /\d\.\d{3}\u00a0€\/l/ : /\d,\d{3}\u00a0€\/[lлλ]/);
        // #990: in the energy group of "Deutschland jetzt", beside charging — not in the hero, a moment or the roads group
        const energy = /<section class="now__group now__group--energy"[\s\S]*?<\/section>\s*(?:<\/div>\s*)?(?=<section class="now__group|<nav)/.exec(html)?.[0] ?? "";
        expect(energy, lang).toContain('id="tile-fuel"');
        expect(energy.indexOf('id="tile-charging"'), lang).toBeLessThan(energy.indexOf('id="tile-fuel"'));
        expect(/<article class="moment[\s\S]*?<\/article>/.exec(html)?.[0] ?? "", lang).not.toContain('id="tile-fuel"');
        // the cheapest price names its station so it can be found (data-steward ruling
        // cdc75d3b, 2026-10-05, superseding #176 (iv)) — on the fuel tile and nowhere else
        expect(fuel, lang).toContain("Musterhof");
        // no OTHER tile prints a price or the station (R6); the questions' dated example answers are not tiles
        const others = [...html.matchAll(/<section class="tile[^"]*"[\s\S]*?<\/section>/g)].map((m) => m[0]).filter((x) => x !== fuel).join("");
        expect(others.length, lang).toBeGreaterThan(1000);
        expect(others, lang).not.toContain("Musterhof");
        expect(others, lang).not.toContain(unit);
      }
    } finally {
      shell.kill();
      shell = undefined;
      await real.close();
    }
  });
  it("moves the per-Land station board to the fuel page in all seven languages (owner 2026-10-06): the home links to it, the page carries every Land with the credit, the MTS-K note and the BKG line", async () => {
    if (shell) shell.kill();
    if (stub) await stub.close();
    stub = undefined;
    const real = await startRealDigest();
    shell = await startShell(PORT, { DIGEST_URL: real.url });
    try {
      for (const lang of LIVE_LANGS) {
        const home = await (await fetch(`http://127.0.0.1:${PORT}/${lang}`)).text();
        const homeFuel = /<section class="tile is-(?:ok|stale) vf-noclarity" id="tile-fuel"[\s\S]*?<\/section>/.exec(home)?.[0] ?? "";
        expect(all(homeFuel, "ul.fuel").length, lang).toBeGreaterThan(0);
        expect(home, `${lang}: no board on the home`).not.toContain("fuel-board");
        expect(all(home, `a[href="/${lang}/fuel"]`).length, `${lang}: the home links to its fuel page`).toBeGreaterThan(0);
        const res = await fetch(`http://127.0.0.1:${PORT}/${lang}/fuel`);
        expect(res.status, lang).toBe(200);
        const page = await res.text();
        const tile = /<section class="tile is-(?:ok|stale) vf-noclarity" id="tile-fuel"[\s\S]*?<\/section>/.exec(page)?.[0] ?? "";
        // the fixture holds all sixteen Länder at three stations each, as production does
        expect((tile.match(/<li class="fuel-board__land[ "]/g) ?? []).length, lang).toBe(16);
        expect((tile.match(/<li class="fuel-board__station[ "]/g) ?? []).length, lang).toBe(48);
        // the summary rows are the home's, unchanged
        const rows = (h: string): string => h.slice(h.indexOf('<p class="fuel__legend">'), h.indexOf("</ul>", h.indexOf('<ul class="fuel">')));
        expect(rows(tile), lang).toBe(rows(homeFuel));
        // ruling cdc75d3b condition 6: the CC BY line and the MTS-K note, German, in one element, wherever the board renders
        const credit = /<p class="credit credit--fuel" lang="de">([\s\S]*?)<\/p>/.exec(tile)?.[1] ?? "";
        expect(credit, lang).toContain("Tankerkönig");
        expect(all(credit, "span.credit__note").map(nodeText), lang).toContain(`${MTSK_CONSUMER_NOTE}`);
        expect(nodeText(parse(tile).root), `${lang}: the Länder are the BKG's, so its line rides along`).toContain("Verwaltungseinheiten: © BKG (2026) dl-de/by-2-0");
        expect(all(tile, "a[href=\"https://www.bkg.bund.de\"][rel=\"license noopener noreferrer\"]").map(nodeText), `${lang}: the Länder are the BKG's, so its line rides along`).toContain("BKG");
        expect(all(tile, "a[href=\"https://www.govdata.de/dl-de/by-2-0\"][rel=\"license noopener noreferrer\"]").map(nodeText), `${lang}: the Länder are the BKG's, so its line rides along`).toContain("dl-de/by-2-0");
        // the page is the board and nothing machine-readable: no JSON-LD, no data-* attribute, no other tile
        // (#1174: the one exception is the place bar's fold state, `data-fold="closed"`, a phone's layout switch that carries no figure)
        expect((page.match(/\sdata-fold="closed"/g) ?? []).length, `${lang}: the place bar's fold state, once`).toBe(1);
        // The MARKUP is judged, tags included (a `<script type="application/ld+json">` tag is still refused), never an
        // inline script's own text: since 2.5.14 (#1186, 6b034f859) the header's recent-place upgrade parses the suggest
        // answer with a regex literal that spells ` data-at=` and posts `application/json` — words in code, no attribute.
        const markup = page.replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/g, "$1</script>");
        expect(markup.replace(/<div class="wrap site-place__wrap" id="place-fold" data-fold="closed">/, ""), lang).not.toMatch(/application\/(ld\+)?json|\sdata-[a-z]/);
        expect((page.match(/<section class="tile /g) ?? []).length, lang).toBe(1);
        // and it is a page of the map: its own title, the home linked back
        expect(all(page, `a[href="/${lang}"]`).length, lang).toBeGreaterThan(0);
        // data-steward ruling 2026-10-06, C2: the lead that says how the selection is made comes BEFORE the board
        const lead = page.indexOf('<p class="lead">');
        expect(lead, `${lang}: the lead is on the page`).toBeGreaterThan(-1);
        expect(lead, `${lang}: the lead precedes the board`).toBeLessThan(page.indexOf('id="tile-fuel"'));
        // C5: no search engine keeps a cached copy of the board — on the fuel page, and only there
        expect(all(page, "meta[name=\"robots\"][content=\"noarchive\"]").length, `${lang}: noarchive on the fuel page`).toBeGreaterThan(0);
        expect(home, `${lang}: the home carries no robots directive`).not.toContain('name="robots"');
      }
    } finally {
      shell.kill();
      shell = undefined;
      await real.close();
    }
  });
});
