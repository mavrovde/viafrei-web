/**
 * The visual gate (#381 item 6; owner 2026-10-03: "Linux baselines in CI").
 *
 * Every page of the map in German and English, at 375, 768 and 1280 px, light
 * and dark — 84 full-page screenshots of the BUILT shell fed by the real digest
 * renderer over the fixture snapshot (fixed clock) — compared with the
 * committed baselines in `e2e/__screenshots__/linux/`, at most 0.2 % of the
 * pixels of any image may differ (`MAX_DIFF_RATIO`). The BROWSER's clock is
 * frozen at the fixture's (`FROZEN_AT`), so a relative age the page computes
 * itself (the motorway index's `.fresh__age`, filled from `Date.now()`) is the
 * same text on every day the gate runs — a mask hides the pixels but not the
 * height a longer age wraps to — and the age pills, `.fresh__age` and every
 * `<time>` are masked besides (`PAGE_MASKS`).
 *
 * WHY LINUX ONLY: macOS and the Ubuntu runner render text with different
 * fonts, so a baseline is a statement about one platform. Baselines are made
 * on the runner (CI's `web` job uploads them when they are missing) and
 * committed from that artifact; anywhere else this script says so and does
 * not compare (`– DID NOT RUN`, exit 0) — a darwin run proves nothing either way.
 *
 *   npx tsx packages/web/scripts/visual.ts            # compare (CI)
 *   npx tsx packages/web/scripts/visual.ts --update   # write baselines to the out dir
 *
 * Exit 1 names each image over the ratio; exit 2 is "could not check" — no
 * baselines on Linux (the bootstrap: run --update and commit the artifact), a
 * baseline missing for one image, or a size mismatch.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { chromium, type BrowserContext, type Page } from "playwright";
import { NOW as FIXTURE_NOW, startRealDigest } from "../e2e/real-digest.js";
import { startShell } from "../e2e/server.js";
import { motorwayPath } from "../src/site/motorways.js";
import { PAGES, pathFor, type Lang } from "../src/site/pages.js";

/** A person's browser: Playwright's default UA says HeadlessChrome, which the site treats as automation (crawlers.ts) and serves the crawler variant — the fuel board withheld. The shots are of what a person sees. */
const PERSON_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const WIDTHS = [375, 768, 1280] as const;
export const SCHEMES = ["light", "dark"] as const;
export const LANGS: readonly Lang[] = ["de", "en"];
export const MAX_DIFF_RATIO = 0.002;
/** The instant every shot's browser clock is frozen at: the fixture snapshot's own clock (2.5.4 cut). */
export const FROZEN_AT: Date = FIXTURE_NOW;
/** What a full-page shot masks: the age pills, the motorway index's computed age, every `<time>`. */
export const PAGE_MASKS = [".age", ".fresh__age", "time"] as const;

const HERE = dirname(fileURLToPath(import.meta.url));
export const BASELINE_DIR = join(HERE, "..", "e2e", "__screenshots__", "linux");

/**
 * #989: the language menu OPEN, header and footer — the flags live inside a closed `<details>`, so no
 * full-page shot shows them. The open panel alone, in German and English, at a phone and a desktop width.
 */
export const MENUS = [".site-head", ".site-foot"] as const;
export const MENU_WIDTHS = [390, 1280] as const;
export function menuShotName(where: (typeof MENUS)[number], lang: string, width: number, scheme: string): string {
  return `menu-${where === ".site-head" ? "head" : "foot"}-${lang}-${String(width)}-${scheme}.png`;
}

/**
 * #1051: the motorway page's "nothing reported" line — one wrapped line of frameless chips at the end of the lists —
 * on the fixture's A61 (every live topic quiet), German, at a phone and a desktop width. The element alone, so a change
 * anywhere else on the page is not this shot's difference.
 */
export const QUIET_ROAD = "A61";
export const QUIET_WIDTHS = [390, 1120] as const;
export function quietShotName(width: number, scheme: string): string {
  return `quiet-${QUIET_ROAD.toLowerCase()}-de-${String(width)}-${scheme}.png`;
}

/**
 * #1032: the related motorways and the linked map — the A7's crossings card (its rows and the related motorways it
 * begins on without a Kreuz, each with its lamp) and the zoomed map's keyboard-linked shields at the A7's first
 * junction, German, at a phone and a desktop width. The pages each lamp speaks for are read first (as the e2e does),
 * so a lamp is judged, never grey; the map is drawn by a second shell with the around block on and a position granted.
 */
export const RELATED_ROAD = "A7";
export const RELATED_WIDTHS = [390, 1120] as const;
export const RELATED_SHOTS = ["crossings", "map"] as const;
/** On the fixture A7, about 8 km from its first junction (the #1032 e2e's position). */
export const RELATED_POSITION = { latitude: 54.7551, longitude: 9.4999, accuracy: 20 } as const;
export function relatedShotName(what: (typeof RELATED_SHOTS)[number], width: number, scheme: string): string {
  return `related-${what}-${RELATED_ROAD.toLowerCase()}-de-${String(width)}-${scheme}.png`;
}

/**
 * #1083 and #1115: the two departure boards, the element alone — the station page's board (the navy platform
 * display; the twelve `station` page shots are the catalogue, which carries no board) at the issue's phone widths and
 * a desktop, and the place card's buses and trains (each stop's table) at 360 px, the width #1115 measures. German,
 * light and dark. Every clock and countdown is masked: the rows count down from the digest's own clock.
 */
export const BOARD_SHOTS = [
  { what: "station-board", path: "/de/station/koeln-hbf", card: "#pcard-station-board", widths: [320, 360, 390, 1280] },
  { what: "place-stations", path: "/de/place/koeln", card: "#pcard-stations", widths: [360] },
] as const;
export const BOARD_MASKS = ["time:visible", ".pcard__in:visible", ".age:visible", ".fresh__age:visible"] as const;
export const BOARD_SHOT_COUNT = BOARD_SHOTS.reduce((n, b) => n + b.widths.length, 0);
export function boardShotName(what: (typeof BOARD_SHOTS)[number]["what"], width: number, scheme: string): string {
  return `board-${what}-de-${String(width)}-${scheme}.png`;
}

/**
 * #1081 D7: the place page's charging card under a filter — the bar with a box ticked, the "N von M" line and the
 * filtered rows — German at the issue's phone width, light and dark. The fixture's "fast" filter keeps two of Köln's
 * three chargers, so the shot carries a count, a kept row and the reset.
 */
export const CHARGING_FILTER_SHOT = { path: "/de/place/koeln?ev_kw=fast", card: "#pcard-charging", width: 375 } as const;
export function chargingFilterShotName(scheme: string): string {
  return `charging-filter-place-de-${String(CHARGING_FILTER_SHOT.width)}-${scheme}.png`;
}

/**
 * 2.4.3: `networkidle` alone fired while the home was still being parsed — one render of `de-1280-light` came out
 * 1671 px tall against 21678, and heights at idle varied by 3000 px between renders of the same page. A shot waits
 * for the load event, the fonts and two frames, so the page it takes is the laid-out one.
 */
/**
 * #1176: a place's cards after the first are folded on a phone; a shot of a card shows the card a person sees once they
 * open it (as a person's click does, without one — the fold is open by CSS from 601 px up).
 */
async function unfold(page: Page): Promise<void> {
  await page.$$eval("details.pcard__fold:not([open])", (ds) => ds.forEach((d) => d.setAttribute("open", "")));
}

async function settled(page: Page): Promise<void> {
  await page.waitForLoadState("load");
  // bounded (two-second rule): a browser that never settles is a named failure, not a hang until the job's timeout
  await page.evaluate(async () => {
    const settle = (async () => {
      await document.fonts.ready;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    })();
    await Promise.race([settle, new Promise((_, no) => setTimeout(() => no(new Error("the page did not settle within 2 s")), 2_000))]);
  });
}

/** A page in a fresh context whose `Date.now()` is `FROZEN_AT` from the first script on (timers still run). */
export async function frozenPage(ctx: BrowserContext): Promise<Page> {
  const page = await ctx.newPage();
  await page.clock.setFixedTime(FROZEN_AT);
  return page;
}

export function shotName(path: string, width: number, scheme: string): string {
  return `${path.replace(/^\//, "").replaceAll("/", "-") || "root"}-${width}-${scheme}.png`;
}

/** The share of differing pixels, or a reason the two images cannot be compared. */
export function compare(a: Buffer, b: Buffer): { readonly ratio: number } | { readonly why: string } {
  const pa = PNG.sync.read(a);
  const pb = PNG.sync.read(b);
  if (pa.width !== pb.width || pa.height !== pb.height) return { why: `size ${pa.width}×${pa.height} vs baseline ${pb.width}×${pb.height}` };
  const diff = pixelmatch(pa.data, pb.data, undefined, pa.width, pa.height, { threshold: 0.1 });
  return { ratio: diff / (pa.width * pa.height) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const update = process.argv.includes("--update");
  const outDir = process.env["VISUAL_OUT_DIR"] ?? BASELINE_DIR;
  if (process.platform !== "linux") {
    console.log(`– visual: DID NOT RUN on ${process.platform} — the baselines are Linux renders (CI's web job runs this gate)`);
    process.exit(0);
  }
  if (!update && !existsSync(BASELINE_DIR)) {
    console.log(`✗ visual: could not check — no baselines in ${BASELINE_DIR}. Bootstrap: run with --update on the runner and commit the images.`);
    process.exit(2);
  }
  const digest = await startRealDigest();
  const shell = await startShell(18990, { DIGEST_URL: digest.url, IMPRESSUM_NAME: "Visual Probe", IMPRESSUM_STREET: "Probeweg 9", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "visual@example.invalid" });
  // #1032: the around block's shell (its map needs the flag and a position)
  const around = await startShell(18991, { DIGEST_URL: digest.url, VF_MOTORWAY_AROUND: "1", IMPRESSUM_NAME: "Visual Probe", IMPRESSUM_STREET: "Probeweg 9", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "visual@example.invalid" });
  const browser = await chromium.launch();
  const lines: string[] = [];
  let code: 0 | 1 | 2 = 0;
  let shots = 0;
  try {
    if (update) mkdirSync(outDir, { recursive: true });
    for (const p of PAGES) for (const lang of LANGS) for (const width of WIDTHS) for (const scheme of SCHEMES) {
      const path = pathFor(p.id, lang);
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: "reduce", userAgent: PERSON_UA });
      const page = await frozenPage(ctx);
      await page.goto(`http://127.0.0.1:18990${path}`, { waitUntil: "networkidle" });
      await settled(page);
      const png = await page.screenshot({ fullPage: true, animations: "disabled", mask: PAGE_MASKS.map((m) => page.locator(m)) });
      await ctx.close();
      shots++;
      const name = shotName(path, width, scheme);
      if (update) { writeFileSync(join(outDir, name), png); continue; }
      const base = join(BASELINE_DIR, name);
      if (!existsSync(base)) { code = 2; lines.push(`✗ ${name}: no baseline`); continue; }
      const c = compare(png, readFileSync(base));
      if ("why" in c) { code = 2; lines.push(`✗ ${name}: ${c.why}`); continue; }
      if (c.ratio > MAX_DIFF_RATIO) {
        if (code === 0) code = 1; // a size or baseline problem (2) outranks a difference (1)
        lines.push(`✗ ${name}: ${(c.ratio * 100).toFixed(3)} % of pixels differ (> ${MAX_DIFF_RATIO * 100} %)`);
      }
    }
    for (const where of MENUS) for (const lang of LANGS) for (const width of MENU_WIDTHS) for (const scheme of SCHEMES) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: "reduce", userAgent: PERSON_UA });
      const page = await frozenPage(ctx);
      await page.goto(`http://127.0.0.1:18990${pathFor("start", lang)}`, { waitUntil: "networkidle" });
      await settled(page);
      await page.click(`${where} .langmenu__summary`);
      const png = await page.locator(`${where} .langmenu__panel`).screenshot({ animations: "disabled" });
      await ctx.close();
      shots++;
      const name = menuShotName(where, lang, width, scheme);
      if (update) { writeFileSync(join(outDir, name), png); continue; }
      const base = join(BASELINE_DIR, name);
      if (!existsSync(base)) { code = 2; lines.push(`✗ ${name}: no baseline`); continue; }
      const c = compare(png, readFileSync(base));
      if ("why" in c) { code = 2; lines.push(`✗ ${name}: ${c.why}`); continue; }
      if (c.ratio > MAX_DIFF_RATIO) {
        if (code === 0) code = 1;
        lines.push(`✗ ${name}: ${(c.ratio * 100).toFixed(3)} % of pixels differ (> ${MAX_DIFF_RATIO * 100} %)`);
      }
    }
    for (const width of QUIET_WIDTHS) for (const scheme of SCHEMES) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: "reduce", userAgent: PERSON_UA });
      const page = await frozenPage(ctx);
      await page.goto(`http://127.0.0.1:18990${motorwayPath("de", QUIET_ROAD)}`, { waitUntil: "networkidle" });
      await settled(page);
      // The fuel block above reads its prices when it comes into view (2.4.3): bring it into view and let its answer
      // replace the loading line BEFORE the shot, or the shot catches the row mid-move (1.6 % between two renders).
      await page.locator(".motorway__fuel").scrollIntoViewIfNeeded();
      await page.locator(".motorway__fuelloading").waitFor({ state: "hidden", timeout: 2_000 });
      // only the visible time: a closed chip's <time> has no box, and masking it painted over the words
      const png = await page.locator("#mw-quiet").screenshot({ animations: "disabled", mask: [page.locator("#mw-quiet time:visible")] });
      await ctx.close();
      shots++;
      const name = quietShotName(width, scheme);
      if (update) { writeFileSync(join(outDir, name), png); continue; }
      const base = join(BASELINE_DIR, name);
      if (!existsSync(base)) { code = 2; lines.push(`✗ ${name}: no baseline`); continue; }
      const c = compare(png, readFileSync(base));
      if ("why" in c) { code = 2; lines.push(`✗ ${name}: ${c.why}`); continue; }
      if (c.ratio > MAX_DIFF_RATIO) {
        if (code === 0) code = 1;
        lines.push(`✗ ${name}: ${(c.ratio * 100).toFixed(3)} % of pixels differ (> ${MAX_DIFF_RATIO * 100} %)`);
      }
    }
    for (const what of RELATED_SHOTS) for (const width of RELATED_WIDTHS) for (const scheme of SCHEMES) {
      const map = what === "map";
      const ctx = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: scheme, reducedMotion: "reduce", userAgent: PERSON_UA, ...(map ? { geolocation: RELATED_POSITION, permissions: ["geolocation"] } : {}) });
      const page = await frozenPage(ctx);
      const base = map ? "http://127.0.0.1:18991" : "http://127.0.0.1:18990";
      // the page each lamp speaks for, first: the A2 for the card's related row, the A1 for the map's shield at the AD
      await page.goto(`${base}${motorwayPath("de", map ? "A1" : "A2")}`, { waitUntil: "load" });
      await page.goto(`${base}${motorwayPath("de", RELATED_ROAD)}`, { waitUntil: "networkidle" });
      await settled(page);
      const target = map ? page.locator("#motorway-around svg.mwa__svg") : page.locator("#mwk-crossings");
      if (map) await page.waitForSelector("#motorway-around svg.mwa__svg .mwc-links a", { timeout: 2_000 });
      // from 1024 px the dashboard (#1180) stands the crossings card as its head and one "alle N anzeigen" button: the
      // shot is of the rows, so the card is opened first, as the visitor does (and as motorway-related-1032.e2e.ts does)
      if (!map && width >= 1024) await page.click("#mwk-crossings > .desk__more", { timeout: 2_000 });
      await target.scrollIntoViewIfNeeded();
      const png = await target.screenshot({ animations: "disabled", mask: [page.locator("#mwk-crossings time:visible, #motorway-around time:visible")] });
      await ctx.close();
      shots++;
      const name = relatedShotName(what, width, scheme);
      if (update) { writeFileSync(join(outDir, name), png); continue; }
      const file = join(BASELINE_DIR, name);
      if (!existsSync(file)) { code = 2; lines.push(`✗ ${name}: no baseline`); continue; }
      const c = compare(png, readFileSync(file));
      if ("why" in c) { code = 2; lines.push(`✗ ${name}: ${c.why}`); continue; }
      if (c.ratio > MAX_DIFF_RATIO) {
        if (code === 0) code = 1;
        lines.push(`✗ ${name}: ${(c.ratio * 100).toFixed(3)} % of pixels differ (> ${MAX_DIFF_RATIO * 100} %)`);
      }
    }
    for (const b of BOARD_SHOTS) for (const width of b.widths) for (const scheme of SCHEMES) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: "reduce", userAgent: PERSON_UA });
      const page = await frozenPage(ctx);
      await page.goto(`http://127.0.0.1:18990${b.path}`, { waitUntil: "networkidle" });
      await settled(page);
      await unfold(page);
      const target = page.locator(b.card);
      await target.scrollIntoViewIfNeeded();
      const png = await target.screenshot({ animations: "disabled", mask: BOARD_MASKS.map((m) => page.locator(`${b.card} ${m}`)) });
      await ctx.close();
      shots++;
      const name = boardShotName(b.what, width, scheme);
      if (update) { writeFileSync(join(outDir, name), png); continue; }
      const file = join(BASELINE_DIR, name);
      if (!existsSync(file)) { code = 2; lines.push(`✗ ${name}: no baseline`); continue; }
      const c = compare(png, readFileSync(file));
      if ("why" in c) { code = 2; lines.push(`✗ ${name}: ${c.why}`); continue; }
      if (c.ratio > MAX_DIFF_RATIO) {
        if (code === 0) code = 1;
        lines.push(`✗ ${name}: ${(c.ratio * 100).toFixed(3)} % of pixels differ (> ${MAX_DIFF_RATIO * 100} %)`);
      }
    }
    for (const scheme of SCHEMES) {
      const ctx = await browser.newContext({ viewport: { width: CHARGING_FILTER_SHOT.width, height: 900 }, colorScheme: scheme, reducedMotion: "reduce", userAgent: PERSON_UA });
      const page = await frozenPage(ctx);
      await page.goto(`http://127.0.0.1:18990${CHARGING_FILTER_SHOT.path}`, { waitUntil: "networkidle" });
      await settled(page);
      await unfold(page);
      const target = page.locator(CHARGING_FILTER_SHOT.card);
      await target.scrollIntoViewIfNeeded();
      const png = await target.screenshot({ animations: "disabled", mask: BOARD_MASKS.map((m) => page.locator(`${CHARGING_FILTER_SHOT.card} ${m}`)) });
      await ctx.close();
      shots++;
      const name = chargingFilterShotName(scheme);
      if (update) { writeFileSync(join(outDir, name), png); continue; }
      const file = join(BASELINE_DIR, name);
      if (!existsSync(file)) { code = 2; lines.push(`✗ ${name}: no baseline`); continue; }
      const c = compare(png, readFileSync(file));
      if ("why" in c) { code = 2; lines.push(`✗ ${name}: ${c.why}`); continue; }
      if (c.ratio > MAX_DIFF_RATIO) {
        if (code === 0) code = 1;
        lines.push(`✗ ${name}: ${(c.ratio * 100).toFixed(3)} % of pixels differ (> ${MAX_DIFF_RATIO * 100} %)`);
      }
    }
  } catch (e) {
    code = 2;
    lines.push(`✗ visual: could not check — ${(e as Error).message}`);
  } finally {
    await browser.close();
    around.kill();
    shell.kill();
    await digest.close();
  }
  for (const l of lines) console.log(l);
  if (shots !== ((PAGES.length * WIDTHS.length + MENUS.length * MENU_WIDTHS.length) * LANGS.length + QUIET_WIDTHS.length + RELATED_SHOTS.length * RELATED_WIDTHS.length + BOARD_SHOT_COUNT + 1) * SCHEMES.length) { code = 2; console.log(`✗ visual: could not check — ${shots} screenshots taken`); }
  if (update) console.log(`✓ visual: ${shots} baseline(s) written to ${outDir}`);
  else if (code === 0) console.log(`✓ visual: ${shots} screenshot(s) within ${MAX_DIFF_RATIO * 100} % of their Linux baselines`);
  process.exit(code);
}
