/**
 * #890: "around you" on a motorway page, in a real browser with an EMULATED
 * position (owner rule: UI flows are driven in a browser), against the BUILT
 * shell and the real digest (`real-digest.ts`: the fixture A7). The switch is
 * on for this shell only (`VF_MOTORWAY_AROUND=1`); the default shell carries
 * no position bar at all (G5).
 */
import { execFileSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { all } from "@viafrei/design/testing";
import { motorwayPath } from "../src/site/motorways.js";
import { pathFor } from "../src/site/pages.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8836;
const OFF_PORT = 8837;
/** The IP rung (#890 G5.3): a shell with a GeoIP file built from the test fixture, plus one range on the fixture A7. */
const IP_PORT = 8838;
const HERE = dirname(fileURLToPath(import.meta.url));
const GEO_DIR = mkdtempSync(join(tmpdir(), "vf-around-geo-"));
const GEO_FILE = join(GEO_DIR, "geoip.vfgeo");
/** A documentation range (RFC 5737) placed on the fixture A7's point 100; the fixture CSV carries Köln, Basel and Mountain View. */
const A7_IP = "198.18.0.10";
const A7_ROW = "198.18.0.0,198.18.0.255,EU,DE,Niedersachsen,Probe,52.5512,9.4513\n";
const BASE = `http://127.0.0.1:${PORT}`;
const PERSON_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const ID = { IMPRESSUM_NAME: "Around Probe", IMPRESSUM_STREET: "Probeweg 5", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "around@example.invalid" };
/** On the fixture A7's line (its point 100: 54.8 − 100·7.2/320, 9.4 + 1·0.05), a little off the cell's centre. */
const ON = { latitude: 52.5512, longitude: 9.4513, accuracy: 20 };
const ON_CELL = "pt:52.55,9.45";
/** About 17 km west of the line. */
const OFF = { latitude: 52.5512, longitude: 9.15, accuracy: 20 };

let browser: Browser;
const shells: ChildProcess[] = [];
let digest: Awaited<ReturnType<typeof startRealDigest>>;

beforeAll(async () => {
  digest = await startRealDigest();
  shells.push(await startShell(PORT, { ...ID, DIGEST_URL: digest.url, VF_MOTORWAY_AROUND: "1" }));
  shells.push(await startShell(OFF_PORT, { ...ID, DIGEST_URL: digest.url }));
  const csv = A7_ROW + readFileSync(join(HERE, "..", "test", "fixtures", "geoip-fixture.csv"), "utf8");
  execFileSync(process.execPath, [join(HERE, "..", "..", "..", "scripts", "geoip-build.mjs"), "--release", "2026-10", "--out", GEO_FILE, "--min-de-ranges", "1"], { input: csv, encoding: "utf8" });
  shells.push(await startShell(IP_PORT, { ...ID, DIGEST_URL: digest.url, VF_MOTORWAY_AROUND: "1", GEOIP_FILE: GEO_FILE }));
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  for (const s of shells) s.kill();
  await digest?.close();
  rmSync(GEO_DIR, { recursive: true, force: true });
});

type Posts = { bodies: string[] };
async function open(pos: typeof ON | null, path: string, o: { width?: number; reducedMotion?: "reduce" | "no-preference"; before?: string; touch?: boolean } = {}): Promise<{ ctx: BrowserContext; page: Page; posts: Posts }> {
  const ctx = await browser.newContext({
    viewport: { width: o.width ?? 1000, height: 1000 },
    userAgent: PERSON_UA,
    reducedMotion: o.reducedMotion ?? "no-preference",
    ...(o.touch === true ? { hasTouch: true } : {}),
    ...(pos === null ? {} : { geolocation: pos, permissions: ["geolocation"] }),
  });
  const page = await ctx.newPage();
  const posts: Posts = { bodies: [] };
  page.on("request", (r) => {
    if (r.url().endsWith("/fragment/motorway-around")) posts.bodies.push(r.postData() ?? "");
  });
  if (o.before !== undefined) await page.goto(`${BASE}${o.before}`);
  await page.goto(`${BASE}${path}`);
  return { ctx, page, posts };
}
const marks = (page: Page): Promise<number> => page.$$eval("#motorway-around path.mwa-mark", (ps) => ps.reduce((n, p) => n + ((p.getAttribute("d") ?? "").match(/M/g) ?? []).length, 0));
/**
 * The around list's own items: the rows it lists and the "N weitere" past them — what its zoomed map draws (M6). #901
 * prod: the count line beside them counts the CARDS' entries once the main block follows the radius (the figures the
 * filter summary sums), which hold rows the zoomed map may not draw (share-alike and OSM blocks, undrawable sites).
 */
const aroundItems = (page: Page): Promise<number> =>
  page.$eval("#motorway-around", (b) => b.querySelectorAll(".mwa__item").length + Number(/\d+/.exec(b.querySelector(".mwa__more")?.textContent ?? "")?.[0] ?? 0));
const countText = (page: Page): Promise<number> => page.$eval("#motorway-around .mwa__count", (e) => Number(/\d+/.exec(e.textContent ?? "")?.[0] ?? NaN));
const boxWidth = (page: Page): Promise<number> => page.$eval("#motorway-around svg.mwa__svg", (s) => Number((s.getAttribute("viewBox") ?? "").split(" ")[2]));

describe("on the motorway, with a standing grant (de)", () => {
  it("only the rounded cell is sent; the block opens with the marker on top; nothing is stored", async () => {
    const { ctx, page, posts } = await open(ON, motorwayPath("de", "A7"));
    await page.waitForSelector("#motorway-around");
    expect(posts.bodies).toHaveLength(1);
    const body = JSON.parse(posts.bodies[0]!) as Record<string, unknown>;
    expect(body).toMatchObject({ at: ON_CELL, road: "A7", r: 25, how: "browser", lang: "de" });
    expect(posts.bodies[0]).not.toContain("52.5512");
    expect(await page.textContent("#mwa-h")).toContain("Rund um Sie auf der A7");
    expect(await page.textContent("#motorway-around .mwa__you")).toMatch(/^Ihr Standort: an der A7, nahe AS /);
    // every list item: exactly one map link
    const links = await page.$$eval("#motorway-around .mwa__item", (lis) => lis.map((li) => li.querySelectorAll('a[href^="https://www.openstreetmap.org/?mlat="]').length));
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((n) => n === 1)).toBe(true);
    expect(await marks(page)).toBe(await aroundItems(page));
    // the marker: visible, labelled, and nothing covers its centre
    const pin = await page.$("#motorway-around .mwa-pin");
    expect(await pin!.isVisible()).toBe(true);
    // 2.3.8: said in words under the map, with the pin's own swatch (an SVG label was 7 px on a phone)
    expect(await page.textContent("#motorway-around .mwa__legend")).toBe("Ihr Standort (gerundet, ca. 500 m)");
    // clearly bigger than any mark: the pin is drawn more than twice a mark's width
    const sizes = await page.evaluate(() => {
      const svg = document.querySelector("#motorway-around svg.mwa__svg") as SVGSVGElement;
      const k = svg.getBoundingClientRect().width / Number((svg.getAttribute("viewBox") ?? "").split(" ")[2]);
      const mark = Math.max(...[...svg.querySelectorAll("path.mwa-mark")].map((p) => Number(p.getAttribute("stroke-width")) * k));
      return { pin: document.querySelector("#motorway-around .mwa-pin")!.getBoundingClientRect().width, mark };
    });
    expect(sizes.pin).toBeGreaterThan(2 * sizes.mark);
    const top = await page.evaluate(() => {
      // in view first: elementFromPoint answers null for a point outside the viewport
      document.querySelector("#motorway-around .mwa-pin")!.scrollIntoView({ block: "center", behavior: "instant" });
      const p = document.querySelector("#motorway-around .mwa-pin")!.getBoundingClientRect();
      const e = document.elementFromPoint(p.x + p.width / 2, p.y + p.height / 2);
      return e?.closest(".mwa-you") !== null && e?.closest(".mwa-you") !== undefined;
    });
    expect(top).toBe(true);
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("viafrei.place")))).toEqual([]);
    await page.screenshot({ path: `${process.env["TMPDIR"] ?? "/tmp"}/890-around-de.png`, fullPage: false });
    await ctx.close();
  });

  it("the chips re-frame the map and the list without a reload; the URL follows; Back leaves the page", async () => {
    const { ctx, page, posts } = await open(ON, motorwayPath("de", "A7"), { before: "/de" });
    await page.waitForSelector("#motorway-around");
    await page.evaluate(() => ((window as unknown as { vfProbe: number }).vfProbe = 1));
    const w25 = await boxWidth(page);
    const n25 = await countText(page);
    const circle25 = await page.$eval("#motorway-around .mwa-radius", (e) => e.getBoundingClientRect().width);
    await page.click('.mwr__chip[value="5"]');
    await page.waitForFunction(() => document.querySelector("#motorway-around .mwa__count")?.textContent?.match(/(^|[^0-9])5 km/) != null);
    expect(await boxWidth(page)).toBeCloseTo(11, 0);
    expect(await boxWidth(page)).toBeLessThan(w25);
    expect(await countText(page)).toBeLessThanOrEqual(n25);
    expect(await marks(page)).toBe(await aroundItems(page));
    expect(page.url()).toMatch(/\?r=5$/);
    expect(await page.evaluate(() => (window as unknown as { vfProbe?: number }).vfProbe)).toBe(1);
    await page.click('.mwr__chip[value="100"]');
    await page.waitForFunction(() => document.querySelector("#motorway-around .mwa__count")?.textContent?.includes("100 km") === true);
    expect(await boxWidth(page)).toBeCloseTo(220, 0);
    expect(await countText(page)).toBeGreaterThanOrEqual(n25);
    expect(await marks(page)).toBe(await aroundItems(page));
    // the circle is the same share of the frame at every radius; the frame is what grew
    expect(await page.$eval("#motorway-around .mwa-radius", (e) => e.getBoundingClientRect().width)).toBeCloseTo(circle25, -1);
    expect(page.url()).toMatch(/\?r=100$/);
    expect(posts.bodies.map((b) => (JSON.parse(b) as { r: number }).r)).toEqual([25, 5, 100]);
    await page.goBack();
    expect(new URL(page.url()).pathname).toBe("/de");
    await ctx.close();
  });

  it("2.4.4: the newest ask wins — a 50 km answer arriving AFTER the 5 km one the visitor chose since changes nothing", async () => {
    const { ctx, page, posts } = await open(ON, motorwayPath("de", "A7"));
    await page.waitForSelector("#motorway-around");
    // hold the 50 km answer until the 5 km one has been shown, then let it arrive: the late-answer order of the flake
    let release: () => void = () => undefined;
    const held = new Promise<void>((r) => (release = r));
    await page.route("**/fragment/motorway-around", async (route) => {
      if ((JSON.parse(route.request().postData() ?? "{}") as { r?: number }).r === 50) await held;
      await route.continue();
    });
    await page.click('.mwr__chip[value="50"]');
    await page.waitForFunction(() => document.querySelector(".mwr__chip[value='50']")?.getAttribute("aria-pressed") === "true");
    await page.click('.mwr__chip[value="5"]');
    await page.waitForFunction(() => document.querySelector("#motorway-around .mwa__count")?.textContent?.match(/(^|[^0-9])5 km/) != null);
    const asked = posts.bodies.length;
    release();
    // the late answer has arrived once the request finished; give the page its turn to (not) swap it in
    await page.waitForResponse((r) => r.url().endsWith("/fragment/motorway-around") && (JSON.parse(r.request().postData() ?? "{}") as { r?: number }).r === 50);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    expect(await page.textContent("#motorway-around .mwa__count")).toMatch(/(^|[^0-9])5 km/);
    expect(await boxWidth(page)).toBeCloseTo(11, 0);
    expect(await page.getAttribute('.mwr__chip[value="5"]', "aria-pressed")).toBe("true");
    expect(posts.bodies.length).toBe(asked);
    await ctx.close();
  });

  it("a slider drag from 5 to 50 km asks at most 3 times and ends at ?r=50", async () => {
    const { ctx, page, posts } = await open(ON, `${motorwayPath("de", "A7")}?r=5`);
    await page.waitForSelector("#motorway-around");
    const before = posts.bodies.length;
    await page.focus("#mwr-range");
    for (let i = 0; i < 45; i++) await page.keyboard.press("ArrowRight", { delay: 5 });
    await page.waitForFunction(() => document.querySelector("#motorway-around .mwa__count")?.textContent?.includes("50 km") === true);
    expect(posts.bodies.length - before).toBeLessThanOrEqual(3);
    expect(page.url()).toMatch(/\?r=50$/);
    await ctx.close();
  });

  it("a failed request keeps the previous map and says so", async () => {
    const { ctx, page } = await open(ON, motorwayPath("de", "A7"));
    await page.waitForSelector("#motorway-around");
    const vb = await page.$eval("#motorway-around svg.mwa__svg", (s) => s.getAttribute("viewBox"));
    await page.route("**/fragment/motorway-around", (r) => r.fulfill({ status: 502, body: "" }));
    await page.click('.mwr__chip[value="10"]');
    await page.waitForSelector("#mwr-status:not([hidden])");
    await page.waitForFunction(() => document.querySelector("#mwr-status")?.textContent?.includes("Konnte nicht") === true);
    expect(await page.$eval("#motorway-around svg.mwa__svg", (s) => s.getAttribute("viewBox"))).toBe(vb);
    await ctx.close();
  });

  it("the radius control works by keyboard alone, with a visible label", async () => {
    const { ctx, page, posts } = await open(ON, motorwayPath("de", "A7"));
    await page.waitForSelector("#motorway-around");
    expect(await page.isVisible("#mwr-l")).toBe(true);
    await page.focus('.mwr__chip[value="10"]');
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector("#motorway-around .mwa__count")?.textContent?.includes("10 km") === true);
    expect(await page.getAttribute('.mwr__chip[value="10"]', "aria-pressed")).toBe("true");
    expect(posts.bodies.length).toBe(2);
    await ctx.close();
  });

  it("at 390 px the control, the zoomed map and the marker fit with no horizontal scroll", async () => {
    const { ctx, page } = await open(ON, motorwayPath("de", "A7"), { width: 390 });
    await page.waitForSelector("#motorway-around");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    const svg = await page.$eval("#motorway-around svg.mwa__svg", (s) => s.getBoundingClientRect().width);
    expect(svg).toBeGreaterThan(250);
    expect(svg).toBeLessThanOrEqual(390);
    await ctx.close();
  });

  it("prefers-reduced-motion: the halo does not move", async () => {
    const { ctx, page } = await open(ON, motorwayPath("de", "A7"), { reducedMotion: "reduce" });
    await page.waitForSelector("#motorway-around");
    expect(await page.$eval("#motorway-around .mwa-halo", (e) => getComputedStyle(e).animationName)).toBe("none");
    await ctx.close();
    const moving = await open(ON, motorwayPath("de", "A7"));
    await moving.page.waitForSelector("#motorway-around");
    expect(await moving.page.$eval("#motorway-around .mwa-halo", (e) => getComputedStyle(e).animationName)).not.toBe("none");
    await moving.ctx.close();
  });

  it("the page with both maps stays under the 500 KB budget at 100 km", async () => {
    const { ctx, page } = await open(ON, `${motorwayPath("de", "A7")}?r=100`);
    await page.waitForSelector("#motorway-around");
    const bytes = await page.evaluate(() => new TextEncoder().encode(document.documentElement.outerHTML).length);
    expect(bytes).toBeLessThan(500_000);
    await ctx.close();
  });
});

describe("off the motorway, and in English", () => {
  it("says how far, names the nearest point and the junction to join, each with a map link, and draws the dashed way", async () => {
    const { ctx, page } = await open(OFF, motorwayPath("en", "A7"));
    await page.waitForSelector("#motorway-around");
    const text = (await page.textContent("#motorway-around")) ?? "";
    expect(text).toMatch(/Your position: about 1\d km from the A7/);
    expect(text).toContain("Nearest point of the A7");
    // #901 D11 (owner, 2.3.11 prod): "Nearest junction (Anschlussstelle): Kassel-Nord (77), 5.6 km as the crow flies"
    expect(text).toMatch(/Nearest junction \(Anschlussstelle\): [^,]+, [\d.]+ km as the crow flies · /u);
    expect(text).not.toContain("Join at");
    expect(await page.$$eval("#motorway-around .mwa__way li", (lis) => lis.map((li) => li.querySelectorAll('a[href^="https://www.openstreetmap.org/?mlat="]').length))).toEqual([1, 1]);
    expect(await page.$("#motorway-around .mwa-way")).not.toBeNull();
    expect(await page.textContent("#mwa-h")).toMatch(/^Around .* on the A7$/);
    // one language per page
    for (const w of ["Sie sind", "Umkreis", "Richtung"]) expect(text, w).not.toContain(w);
    await ctx.close();
  });

  // #901 review 2: a radius smaller than the way to the road holds nothing of it — the page shows the WHOLE road and
  // says so once; no radius count line, and the filter summary names no radius over the whole road's cards.
  it("#901 review 2: about 17 km off at r = 10 — nothing within 10 km, the lists show the whole A7, no radius count, the summary names no radius", async () => {
    const { ctx, page } = await open(OFF, `${motorwayPath("de", "A7")}?r=10`);
    await page.waitForFunction(() => document.querySelector("#motorway-around .mwa__inforce")?.textContent?.includes("10 km") === true);
    expect(await page.textContent("#motorway-around .motorway__none")).toBe("Im Umkreis von 10 km ist nichts verzeichnet.");
    expect(await page.textContent("#motorway-around .mwa__inforce")).toBe("Im Umkreis von 10 km liegt keine Anschlussstelle; die Listen unten zeigen die ganze A7.");
    expect(await page.$("#motorway-around .mwa__count")).toBeNull();
    // the main block is the whole road's, drawn with the position, and it names no radius
    await page.waitForSelector("#motorway-main .mwa-you");
    expect((await page.textContent("#motorway-main .motorway__shown")) ?? "").not.toContain("Umkreis");
    await page.waitForSelector("#mwf:not([hidden])");
    expect(await page.textContent("#mwf-sum")).toMatch(/^Alle Daten: \d+ Einträge?$/u);
    const offered = await page.$$eval("#mwf input[name=show]", (bs) => bs.map((b) => (b as HTMLInputElement).value));
    for (const k of offered) if (k !== "parking" && k !== "charging") await page.uncheck(`#mwf input[name=show][value="${k}"]`);
    expect(await page.textContent("#mwf-sum")).toMatch(/^Parken und Laden: \d+ Einträge?$/u);
    // a radius that reaches the road again brings the radius's count line back
    await page.click('.mwr__chip[value="25"]');
    await page.waitForSelector("#motorway-around .mwa__count");
    expect(await page.textContent("#mwf-sum")).toMatch(/^Parken und Laden im Umkreis von 25 km: \d+ Einträge?$/u);
    await ctx.close();
  });
});

describe("2.3.8: the page follows the radius (owner 2026-10-21: \"the map and many info does not react on radius\")", () => {
  const listed = (page: Page): Promise<number> => page.$$eval("#motorway-main #mw-cards > .mwk ul.motorway__list > li:not(.mwk__you)", (l) => l.length);
  it("the main block's map and lists are the radius's stretch, swapped in place; the address keeps only ?r=; no POST names a junction", async () => {
    const { ctx, page, posts } = await open(ON, motorwayPath("de", "A7"));
    await page.waitForFunction(() => document.querySelector("#motorway-main .motorway__shown")?.textContent?.includes("Ihr Umkreis von 25 km") === true);
    expect(await page.textContent("#motorway-around .mwa__inforce")).toMatch(/^Die Listen unten folgen Ihrem Umkreis von 25 km: /);
    // the overview map draws the position, topmost, with its legend line
    expect(await page.$("#motorway-main .mwa-you .mwa-pin")).not.toBeNull();
    expect(await page.textContent("#motorway-main .mwa__legend")).toBe("Ihr Standort (gerundet, ca. 500 m)");
    const top = await page.evaluate(() => {
      document.querySelector("#motorway-main .mwa-pin")!.scrollIntoView({ block: "center", behavior: "instant" });
      const q = document.querySelector("#motorway-main .mwa-pin")!.getBoundingClientRect();
      const e = document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2);
      return e?.closest(".mwa-you") != null ? true : `${e?.tagName ?? "none"}.${e?.getAttribute("class") ?? ""} ${JSON.stringify(q)}`;
    });
    expect(top).toBe(true);
    // the form preselects nothing the position chose
    expect(await page.$$eval("#motorway-main select option[selected]", (o) => o.length)).toBe(0);
    const n25 = await listed(page);
    await page.click('.mwr__chip[value="5"]');
    await page.waitForFunction(() => document.querySelector("#motorway-main .motorway__shown")?.textContent?.includes("Ihr Umkreis von 5 km") === true);
    const n5 = await listed(page);
    await page.click('.mwr__chip[value="100"]');
    await page.waitForFunction(() => document.querySelector("#motorway-main .motorway__shown")?.textContent?.includes("Ihr Umkreis von 100 km") === true);
    const n100 = await listed(page);
    expect(n5).toBeLessThanOrEqual(n25);
    expect(n100).toBeGreaterThanOrEqual(n25);
    expect(n100).toBeGreaterThan(n5);
    expect(new URL(page.url()).search).toBe("?r=100");
    expect(new URL(page.url()).pathname).toBe(motorwayPath("de", "A7"));
    for (const b of posts.bodies) expect(Object.keys(JSON.parse(b) as object).sort()).toEqual(["at", "how", "lang", "r", "road", "s"].filter((k) => k !== "s" || b.includes('"s"')).sort());
    // the swapped main block's chips are revealed too (#1003: one MutationObserver, nothing re-bound)
    expect(await page.$$eval("#motorway-main .endpoint-chip__copy", (bs) => bs.length > 0 && bs.every((b) => !(b as HTMLButtonElement).hidden))).toBe(true);
    await ctx.close();
  });

  // #901 D12 (owner 2026-10-21): a stretch in the address no longer wins over the radius — it narrows the page inside it.
  it("a stretch in the address inside the radius narrows the main block to it: kept selected, the position drawn, and the block says so", async () => {
    const { ctx, page } = await open(ON, motorwayPath("de", "A7"));
    await page.waitForSelector("#motorway-main .mwa-you");
    // with a position the selectors list the radius's junctions only (D12): a stretch of two of them lies inside it
    const slugs = await page.$$eval("#motorway-main select[name=from] option", (o) => o.map((x) => (x as HTMLOptionElement).value).filter((v) => v !== ""));
    expect(slugs.length).toBeGreaterThan(2);
    const path = `${motorwayPath("de", "A7")}/${slugs[0]!}-to-${slugs[1]!}`;
    await page.goto(`${BASE}${path}`);
    await page.waitForSelector("#motorway-main .mwa-you");
    expect(await page.textContent("#motorway-around .mwa__inforce")).toMatch(/^Die Listen unten zeigen Ihren gewählten Abschnitt .+ in Ihrem Umkreis von 25 km\.$/);
    expect(await page.$eval("#motorway-main select[name=from]", (x) => (x as HTMLSelectElement).value)).toBe(slugs[0]);
    expect(await page.$eval("#motorway-main select[name=to]", (x) => (x as HTMLSelectElement).value)).toBe(slugs[1]);
    expect(await page.$("#motorway-around .mwa__reset")).toBeNull();
    await ctx.close();
  });

  // #901 prod (2.3.11, the A7 near Kassel at 50 km with "Parken" and "Laden"): the around block said 54 entries, the
  // filter summary 63, and the cards listed sites 51-54 km along the road. One rule now holds every card, and the count
  // line counts the cards' entries — the figures the summary sums.
  it("#901 prod: at 50 km with only Parken and Laden the count line and the filter summary say one number, and no badge says more than 50 km", async () => {
    const { ctx, page } = await open(ON, `${motorwayPath("de", "A7")}?r=50`);
    await page.waitForFunction(() => document.querySelector("#motorway-main .motorway__shown")?.textContent?.includes("Ihr Umkreis von 50 km") === true);
    await page.waitForSelector("#mwf:not([hidden])");
    const offered = await page.$$eval("#mwf input[name=show]", (bs) => bs.map((b) => (b as HTMLInputElement).value));
    expect(offered).toEqual(expect.arrayContaining(["parking", "charging"]));
    for (const k of offered) if (k !== "parking" && k !== "charging") await page.uncheck(`#mwf input[name=show][value="${k}"]`);
    const sum = (await page.textContent("#mwf-sum")) ?? "";
    expect(sum).toMatch(/^Parken und Laden im Umkreis von 50 km: \d+ Einträge?$/u);
    const n = Number(/: (\d+) Eintr/u.exec(sum)?.[1]);
    expect(n).toBeGreaterThan(0);
    expect(await page.textContent("#motorway-around .mwa__n")).toBe(String(n));
    // the map's description carries no count of its own to disagree with
    expect(await page.textContent("#motorway-around #mwa-map-d")).toBe("Ausschnitt der A7 im Umkreis von 50 km um Ihre Position.");
    // every badge of every card measures along the road from the same anchor as the rule: none past the radius
    const km = await page.$$eval("#motorway-main .mwk__rel", (bs) => bs.flatMap((b) => [...(b.textContent ?? "").matchAll(/(\d+(?:,\d+)?) km/gu)].map((m) => Number(m[1]!.replace(",", ".")))));
    expect(km.length).toBeGreaterThan(0);
    expect(Math.max(...km)).toBeLessThanOrEqual(50);
    await ctx.close();
  });

  it("'all of Germany' restores the page's own main block", async () => {
    const { ctx, page } = await open(ON, motorwayPath("de", "A7"));
    await page.waitForSelector("#motorway-main .mwa-you");
    await page.click("#place-pill");
    await page.click("#place-scope-de");
    await page.waitForFunction(() => document.querySelector("#motorway-main .mwa-you") === null);
    expect(await page.$("#motorway-around")).toBeNull();
    expect(await page.$("#motorway-main .motorway__shown")).toBeNull();
    await ctx.close();
  });
});

describe("2.3.8: the map zooms the radius (owner: \"add zooming to the map and relate it to the radius component\")", () => {
  const zin = (page: Page): Promise<string | null> => page.getAttribute("#motorway-around .mwz__in", "aria-label");
  it("+ from 25 goes to 10: the chip, ?r= and the viewBox follow; − goes back; at 5 km + is disabled", async () => {
    const { ctx, page, posts } = await open(ON, motorwayPath("de", "A7"));
    await page.waitForSelector("#motorway-around .mwz__in");
    expect(await zin(page)).toBe("Karte vergrößern – Umkreis 10 km");
    expect(await page.getAttribute("#motorway-around .mwz__out", "aria-label")).toBe("Karte verkleinern – Umkreis 50 km");
    const before = posts.bodies.length;
    await page.click("#motorway-around .mwz__in");
    await page.waitForFunction(() => document.querySelector("#motorway-around .mwa__count")?.textContent?.includes("10 km") === true);
    expect(await page.getAttribute('.mwr__chip[value="10"]', "aria-pressed")).toBe("true");
    expect(await page.inputValue("#mwr-range")).toBe("10");
    expect(page.url()).toMatch(/\?r=10$/);
    expect(await boxWidth(page)).toBeCloseTo(22, 0);
    expect(posts.bodies.length - before).toBe(1);
    await page.click("#motorway-around .mwz__in");
    await page.waitForFunction(() => document.querySelector("#motorway-around .mwa__count")?.textContent?.match(/(^|[^0-9])5 km/) != null);
    expect(await page.getAttribute("#motorway-around .mwz__in", "aria-disabled")).toBe("true");
    expect(await zin(page)).toBe("Karte vergrößern – kleinster Umkreis erreicht");
    // a run of clicks is one ask, once it rests
    const mid = posts.bodies.length;
    await page.click("#motorway-around .mwz__out");
    await page.click("#motorway-around .mwz__out");
    await page.click("#motorway-around .mwz__out");
    await page.waitForFunction(() => document.querySelector("#motorway-around .mwa__count")?.textContent?.includes("50 km") === true);
    expect(posts.bodies.length - mid).toBe(1);
    expect(page.url()).toMatch(/\?r=50$/);
    await ctx.close();
  });

  it("a chip change updates the zoom buttons' labels at once", async () => {
    const { ctx, page } = await open(ON, motorwayPath("en", "A7"));
    await page.waitForSelector("#motorway-around .mwz__in");
    await page.click('.mwr__chip[value="100"]');
    expect(await zin(page)).toBe("Zoom in – radius 50 km");
    expect(await page.getAttribute("#motorway-around .mwz__out", "aria-label")).toBe("Zoom out – largest radius reached");
    await page.waitForFunction(() => document.querySelector("#motorway-around .mwa__count")?.textContent?.includes("100 km") === true);
    expect(await page.getAttribute("#motorway-around .mwz__out", "aria-disabled")).toBe("true");
    await ctx.close();
  });

  it("review 2.3.8: + pressed twice BY KEYBOARD keeps the focus on the button while the radius goes 25 → 10 → 5", async () => {
    const { ctx, page, posts } = await open(ON, motorwayPath("de", "A7"));
    await page.waitForSelector("#motorway-around .mwz__in");
    expect(await page.inputValue("#mwr-range")).toBe("25");
    await page.focus("#motorway-around .mwz__in");
    const n = posts.bodies.length;
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector("#motorway-around .mwa__count")?.textContent?.includes(" 10 km") === true);
    expect(await page.evaluate(() => document.activeElement?.classList.contains("mwz__in") === true && document.activeElement.closest("#motorway-around") !== null)).toBe(true);
    expect(await page.inputValue("#mwr-range")).toBe("10");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector("#motorway-around .mwa__count")?.textContent?.includes(" 5 km") === true);
    expect(await page.evaluate(() => document.activeElement?.classList.contains("mwz__in") === true)).toBe(true);
    expect(await page.inputValue("#mwr-range")).toBe("5");
    expect(posts.bodies.length - n).toBe(2);
    // at the end the button says so and stays focusable; a third press asks nothing
    expect(await page.getAttribute("#motorway-around .mwz__in", "aria-disabled")).toBe("true");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
    expect(posts.bodies.length - n).toBe(2);
    expect(await page.evaluate(() => document.activeElement?.classList.contains("mwz__in") === true)).toBe(true);
    // the map's keys are named in the spelling the attribute defines
    expect(await page.getAttribute("#motorway-around .mwa__map", "aria-keyshortcuts")).toBe("Plus Minus");
    await ctx.close();
  });

  it("review 2.3.8 (WCAG 1.4.4): on a map that is NOT focused, Ctrl + wheel and a pinch are the browser's page zoom — not prevented, nothing asked", async () => {
    const { ctx, page, posts } = await open(ON, motorwayPath("de", "A7"), { touch: true });
    await page.waitForSelector("#motorway-around .mwz__in");
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const n = posts.bodies.length;
    const prevented = await page.$eval("#motorway-around .mwa__map", (f) => {
      const w = new WheelEvent("wheel", { deltaY: -40, ctrlKey: true, bubbles: true, cancelable: true });
      f.dispatchEvent(w);
      const t = (x: number, id: number): Touch => new Touch({ identifier: id, target: f, clientX: x, clientY: 100 });
      const mk = (type: string, a: number, b: number): TouchEvent => new TouchEvent(type, { touches: [t(a, 1), t(b, 2)], bubbles: true, cancelable: true });
      f.dispatchEvent(mk("touchstart", 90, 230));
      const m = mk("touchmove", 60, 260);
      f.dispatchEvent(m);
      f.dispatchEvent(new TouchEvent("touchend", { touches: [], bubbles: true, cancelable: true }));
      return { wheel: w.defaultPrevented, touch: m.defaultPrevented };
    });
    expect(prevented).toEqual({ wheel: false, touch: false });
    // and the browser may pinch over it: no touch-action restriction until the map is focused
    expect(await page.$eval("#motorway-around svg.mwa__svg", (s) => getComputedStyle(s).touchAction)).toBe("auto");
    await page.waitForTimeout(400);
    expect(posts.bodies.length - n).toBe(0);
    expect(await page.inputValue("#mwr-range")).toBe("25");
    // a click activates it: the ring shows and the map takes the pinch
    await page.click("#motorway-around svg.mwa__svg", { position: { x: 5, y: 5 } });
    expect(await page.evaluate(() => document.activeElement?.classList.contains("mwa__map") === true)).toBe(true);
    expect(await page.$eval("#motorway-around .mwa__map", (f) => getComputedStyle(f).outlineStyle)).toBe("solid");
    expect(await page.$eval("#motorway-around svg.mwa__svg", (s) => getComputedStyle(s).touchAction)).toBe("pan-x pan-y");
    await ctx.close();
  });

  it("Ctrl + wheel and a two-finger pinch on the FOCUSED map each send ONE request per gesture; + and − work while the map has focus", async () => {
    const { ctx, page, posts } = await open(ON, motorwayPath("de", "A7"), { touch: true });
    await page.waitForSelector("#motorway-around .mwz__in");
    await page.focus("#motorway-around .mwa__map");
    let n = posts.bodies.length;
    // a trackpad pinch arrives as a burst of ctrl+wheel events
    await page.$eval("#motorway-around .mwa__map", (f) => {
      for (let i = 0; i < 8; i++) f.dispatchEvent(new WheelEvent("wheel", { deltaY: -40, ctrlKey: true, bubbles: true, cancelable: true }));
    });
    await page.waitForFunction(() => document.querySelector("#motorway-around .mwa__count")?.textContent?.includes(" 5 km") === true);
    await page.waitForTimeout(400);
    expect(posts.bodies.length - n).toBe(1);
    expect((JSON.parse(posts.bodies.at(-1)!) as { r: number }).r).toBe(5);
    // a wheel without Ctrl/⌘ scrolls the page and asks nothing
    n = posts.bodies.length;
    await page.$eval("#motorway-around .mwa__map", (f) => f.dispatchEvent(new WheelEvent("wheel", { deltaY: 200, bubbles: true, cancelable: true })));
    await page.waitForTimeout(400);
    expect(posts.bodies.length - n).toBe(0);
    // two fingers spreading apart and then pinching in hard: one ask, at the gesture's end value — the focus came back
    expect(await page.evaluate(() => document.activeElement?.classList.contains("mwa__map") === true)).toBe(true);
    n = posts.bodies.length;
    await page.$eval("#motorway-around .mwa__map", (f) => {
      const t = (x: number, id: number): Touch => new Touch({ identifier: id, target: f, clientX: x, clientY: 100 });
      const ev = (type: string, a: number, b: number): void => void f.dispatchEvent(new TouchEvent(type, { touches: type === "touchend" ? [] : [t(a, 1), t(b, 2)], bubbles: true, cancelable: true }));
      // fingers closing from 140 px to 20 px: four steps out, 5 → 10 → 25 → 50 → 100
      ev("touchstart", 90, 230);
      for (let d = 140; d >= 20; d -= 5) ev("touchmove", 160 - d / 2, 160 + d / 2);
      ev("touchend", 0, 0);
    });
    await page.waitForFunction(() => document.querySelector("#motorway-around .mwa__count")?.textContent?.includes("100 km") === true);
    await page.waitForTimeout(400);
    expect(posts.bodies.length - n).toBe(1);
    expect((JSON.parse(posts.bodies.at(-1)!) as { r: number }).r).toBe(100);
    // keyboard: + and − on the focused map
    n = posts.bodies.length;
    const r0 = Number(await page.inputValue("#mwr-range"));
    await page.focus("#motorway-around .mwa__map");
    await page.keyboard.press("+");
    await page.waitForTimeout(400);
    expect(Number(await page.inputValue("#mwr-range"))).toBe(50);
    expect(r0).toBe(100);
    expect(posts.bodies.length - n).toBe(1);
    await ctx.close();
  });

  it("no position: no zoom buttons, and the overview map as it is", async () => {
    const { ctx, page } = await open(null, motorwayPath("de", "A7"));
    await page.waitForSelector("#mwr", { state: "attached" });
    await page.waitForTimeout(400);
    expect(await page.$(".mwz")).toBeNull();
    expect(await page.$("#motorway-main .mwa-you")).toBeNull();
    await ctx.close();
  });

  it("at 390 px the buttons are 44 px targets on the map, and the page does not scroll sideways", async () => {
    const { ctx, page } = await open(ON, motorwayPath("de", "A7"), { width: 390 });
    await page.waitForSelector("#motorway-main .mwa-you");
    await page.waitForSelector("#motorway-around .mwz__in");
    const b = await page.$eval("#motorway-around .mwz__in", (e) => e.getBoundingClientRect().toJSON() as DOMRect);
    const m = await page.$eval("#motorway-around svg.mwa__svg", (e) => e.getBoundingClientRect().toJSON() as DOMRect);
    expect(b.width).toBeGreaterThanOrEqual(44);
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(b.right).toBeLessThanOrEqual(m.right + 16);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await ctx.close();
  });
});

describe("no position, and the switch off", () => {
  it("no grant and nothing remembered: nothing is asked and no block appears", async () => {
    const { ctx, page, posts } = await open(null, motorwayPath("de", "A7"));
    await page.waitForSelector("#mwr", { state: "attached" });
    await page.waitForTimeout(500);
    expect(posts.bodies).toEqual([]);
    expect(await page.$("#motorway-around")).toBeNull();
    await ctx.close();
  });

  it("'use my location' on a motorway page remembers the place alone; the pill shows the road before it (review 2.3.6)", async () => {
    const { ctx, page } = await open(ON, motorwayPath("de", "A7"));
    await page.waitForSelector("#motorway-around");
    await page.click("#place-pill");
    await page.click("#place-geo");
    await page.waitForFunction(() => localStorage.getItem("viafrei.place") !== null);
    const kept = JSON.parse((await page.evaluate(() => localStorage.getItem("viafrei.place"))) ?? "{}") as { label?: string };
    expect(kept.label).toBeTruthy();
    expect(kept.label).not.toContain("A7");
    expect(await page.textContent("#place-pill-label")).toBe(`A7 · ${kept.label!}`);
    // A manual choice is what writes the recent list: neither key may carry the road.
    await page.click("#place-pill");
    await page.click("#place-bar a.place-opt");
    await page.waitForFunction(() => localStorage.getItem("viafrei.place.recent") !== null);
    const after = await page.evaluate(() => [localStorage.getItem("viafrei.place") ?? "", localStorage.getItem("viafrei.place.recent") ?? ""]);
    expect(after[1]).toMatch(/"label":"[^"]+"/);
    for (const v of after) expect(v).not.toContain("A7");
    await ctx.close();
  });

  it("a remembered position (after a click on 'use my location' elsewhere) produces the block at once", async () => {
    const { ctx, page, posts } = await open(null, motorwayPath("de", "A7"));
    await page.evaluate((at) => localStorage.setItem("viafrei.place", JSON.stringify({ at, label: "Musterstadt", how: "browser" })), ON_CELL);
    await page.reload();
    await page.waitForSelector("#motorway-around");
    expect((JSON.parse(posts.bodies.at(-1) ?? "{}") as { at?: string; how?: string }).at).toBe(ON_CELL);
    // the remembered label is the place; the road is added for the eye only
    expect(await page.textContent("#place-pill-label")).toMatch(/^A7 · /);
    await ctx.close();
  });

  it("the default shell (switch off, G5) renders no position bar and its route answers 404", async () => {
    const r = await fetch(`http://127.0.0.1:${String(OFF_PORT)}${motorwayPath("de", "A7")}`);
    const html = await r.text();
    expect(html).not.toContain('id="mwr"');
    // #1153: the header's own location island is on every page (its code names every route it may ask), but with the
    // switch off no page configures it for a motorway's "around you"
    expect(html).not.toContain('"around":{');
    expect(html).not.toContain('id="motorway-around"');
    const p = await fetch(`http://127.0.0.1:${String(OFF_PORT)}/fragment/motorway-around`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ at: ON_CELL, road: "A7", lang: "de" }) });
    expect(p.status).toBe(404);
  });
});

describe("the main page's map links (#890 § 5) at the A7's production size", () => {
  it("every junction of the strip carries one, and the page with them stays under 500 KB (switch off)", async () => {
    const r = await fetch(`http://127.0.0.1:${String(OFF_PORT)}${motorwayPath("de", "A7")}`);
    const html = await r.text();
    expect(new TextEncoder().encode(html).length).toBeLessThan(500_000);
    const strip = html.slice(html.indexOf('class="motorway__junctions motorway__strip"'));
    const lis = strip.slice(0, strip.indexOf("</ol>")).split("<li").slice(1);
    expect(lis.length).toBeGreaterThan(100);
    for (const li of lis) expect((li.match(/openstreetmap\.org\/\?mlat=|motorway__nocoord/g) ?? []).length).toBe(1);
  });
});

describe("the IP rung (#890 G5.3): the first render from the visitor's network, no prompt, nothing stored", () => {
  async function ipOpen(ip: string, pos: typeof ON | null = null): Promise<{ ctx: BrowserContext; page: Page; posts: string[]; html: string }> {
    const ctx = await browser.newContext({
      viewport: { width: 1000, height: 1000 },
      userAgent: PERSON_UA,
      extraHTTPHeaders: { "X-Forwarded-For": ip },
      ...(pos === null ? {} : { geolocation: pos, permissions: ["geolocation"] }),
    });
    const page = await ctx.newPage();
    const posts: string[] = [];
    page.on("request", (r) => {
      if (r.url().endsWith("/fragment/motorway-around")) posts.push(r.postData() ?? "");
    });
    const res = await page.goto(`http://127.0.0.1:${String(IP_PORT)}${motorwayPath("de", "A7")}`);
    return { ctx, page, posts, html: (await res?.text()) ?? "" };
  }

  it("an address on the A7 opens the block server-side as an area, said to be approximate — no geolocation asked, nothing stored; 2.3.11: no radius, so no post for a radius main block", async () => {
    const { ctx, page, posts, html } = await ipOpen(A7_IP);
    // In the server's own HTML: the block came from the IP, not from the browser.
    expect(html).toContain('id="motorway-around"');
    expect(html).toContain("ungefähr, aus Ihrem Netz");
    expect(html).not.toContain(A7_IP);
    expect(html).not.toContain("52.5512");
    await page.waitForSelector("#motorway-around");
    expect(await page.$("#motorway-around .mwa-area")).not.toBeNull();
    expect(await page.$("#motorway-around .mwa-pin")).toBeNull();
    // 2.3.11 (owner 2026-10-21): an IP guess is not the visitor's own position — no radius control, no zoom, and the
    // main block stays the whole road's (2.3.8 asked for the radius's main block here)
    await page.waitForTimeout(600);
    expect(posts).toEqual([]);
    expect(await page.$("#motorway-main .mwa-you")).toBeNull();
    expect(await page.isVisible("#mwr")).toBe(false);
    expect(await page.$("#mwr[hidden]")).not.toBeNull();
    expect(await page.$(".mwz")).toBeNull();
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("viafrei.")))).toEqual([]);
    expect(await page.evaluate(async () => (await navigator.permissions.query({ name: "geolocation" })).state)).not.toBe("granted");
    await ctx.close();
  });

  it("review 2.3.8 (dbip_city_lite, CC BY 4.0): the lookup RAN, so the DB-IP credit stays when a browser fix follows", async () => {
    const { ctx, page, html } = await ipOpen(A7_IP, ON);
    expect(all(html, ".placebar__credit").length).toBeGreaterThan(0);
    // the standing grant answers: the block is the browser's now
    await page.waitForFunction(() => document.querySelector("#motorway-around .mwa-pin") !== null);
    await page.waitForTimeout(300);
    const credit = await page.$(".placebar__credit");
    expect(credit).not.toBeNull();
    expect(await credit!.isVisible()).toBe(true);
    expect(await credit!.textContent()).toContain("IP Geolocation by DB-IP");
    await ctx.close();
  });

  it("review 2.3.8: where the lookup never ran (a shell without a GeoIP file, a browser fix), no DB-IP credit at all", async () => {
    const { ctx, page } = await open(ON, motorwayPath("de", "A7"));
    await page.waitForSelector("#motorway-around .mwa-pin");
    expect(await page.$(".placebar__credit")).toBeNull();
    await ctx.close();
  });

  it("an address abroad and not a neighbour gives no block: the bar offers the position, nothing is guessed", async () => {
    const { ctx, page, posts, html } = await ipOpen("203.0.113.7");
    expect(html).toContain('id="mwr"');
    expect(html).not.toContain('id="motorway-around"');
    expect(html).not.toContain("Mountain View");
    expect(posts).toEqual([]);
    expect(await page.$("#motorway-around")).toBeNull();
    await ctx.close();
  });
});

describe("the Datenschutz page follows the switch, over the real route (G5.10, review 2.3.6)", () => {
  const heading = (html: string): string => /<h3 id="ort">([^<]*)<\/h3>/.exec(html)?.[1] ?? "";
  it("switch off: no #ort-autobahn paragraph and the home-only heading; switch on: both present", async () => {
    const path = pathFor("datenschutz", "de");
    const off = await fetch(`http://127.0.0.1:${String(OFF_PORT)}${path}`);
    expect(off.status).toBe(200);
    const offHtml = await off.text();
    expect(offHtml).not.toContain('id="ort-autobahn"');
    expect(heading(offHtml)).toBe("Ihr Ort auf der Startseite");
    const on = await fetch(`${BASE}${path}`);
    expect(on.status).toBe(200);
    const onHtml = await on.text();
    expect(all(onHtml, "p[id=\"ort-autobahn\"]").length).toBeGreaterThan(0);
    expect(heading(onHtml)).toBe("Ihr Ort auf der Startseite und den Autobahnseiten");
  });
});

describe("2.3.11: the radius only for the visitor's own position (owner 2026-10-21: \"it must be visible only for the current position if the user wants to provide it\")", () => {
  const hidden = async (page: Page): Promise<void> => {
    expect(await page.$("#mwr[hidden]")).not.toBeNull();
    expect(await page.isVisible("#mwr")).toBe(false);
    expect(await page.isVisible(".mwr__chip")).toBe(false);
    expect(await page.$(".mwz")).toBeNull();
    // out of the tab order: Tab never lands on a chip, the slider or a zoom button
    const reached = await page.evaluate(() => [...document.querySelectorAll("#mwr button, #mwr input, .mwz button")].some((e) => (e as HTMLElement).offsetParent !== null));
    expect(reached).toBe(false);
  };
  for (const width of [1000, 390]) {
    it(`no position: hidden; 'use my location': shown with the zoom; 'Ganz Deutschland': hidden again at once (${String(width)} px)`, async () => {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, userAgent: PERSON_UA });
      const page = await ctx.newPage();
      await page.goto(`${BASE}${motorwayPath("de", "A7")}`);
      await page.waitForSelector("#mwr", { state: "attached" });
      await page.waitForTimeout(300);
      await hidden(page);
      await ctx.grantPermissions(["geolocation"]);
      await ctx.setGeolocation(ON);
      await page.click("#place-pill");
      await page.click("#place-geo");
      await page.waitForSelector("#motorway-around .mwz__in");
      expect(await page.isVisible("#mwr")).toBe(true);
      expect(await page.isVisible('.mwr__chip[value="10"]')).toBe(true);
      await page.click('.mwr__chip[value="10"]');
      await page.waitForFunction(() => location.search === "?r=10");
      await page.click("#place-pill");
      await page.click("#place-scope-de");
      await page.waitForFunction(() => document.getElementById("mwr")?.hidden === true);
      await hidden(page);
      // the radius left the address; #1112: the address follows the bar's choice, `?scope=de` for Germany
      expect(new URL(page.url()).search).toBe("?scope=de");
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await ctx.close();
    });
  }

  it("a chosen town hides the radius, and the main block is the whole road's again", async () => {
    const { ctx, page } = await open(ON, motorwayPath("de", "A7"));
    await page.waitForSelector("#motorway-main .mwa-you");
    expect(await page.isVisible("#mwr")).toBe(true);
    await page.click("#place-pill");
    await page.fill("#place-hq", "Kassel");
    // #1153: the header's list names the motorway's junctions too; the town is in its place group
    const opt = await page.waitForSelector("#place-hresults .ss-group--place a.place-opt", { timeout: 2000 }).catch(() => null);
    if (opt === null) {
      // the fixture gazetteer may not carry the town: a recent place stands in, chosen the same way
      await page.evaluate(() => localStorage.setItem("viafrei.place", JSON.stringify({ at: "ags:06611000", label: "Kassel", how: "manual" })));
      await page.reload();
    } else await opt.click();
    await page.waitForFunction(() => document.getElementById("mwr")?.hidden === true);
    await hidden(page);
    expect(await page.$("#motorway-main .mwa-you")).toBeNull();
    await ctx.close();
  });

  it("an old link with ?r=10 and no position: hidden, the whole road, and ?r= leaves the address", async () => {
    const { ctx, page, posts } = await open(null, `${motorwayPath("de", "A7")}?r=10`);
    await page.waitForSelector("#mwr", { state: "attached" });
    await page.waitForFunction(() => location.search === "");
    await hidden(page);
    expect(posts.bodies).toEqual([]);
    expect(await page.$("#motorway-main .motorway__shown")).toBeNull();
    await ctx.close();
  });

  it("in English as well: hidden without a position, shown with one", async () => {
    const none = await open(null, motorwayPath("en", "A7"));
    await none.page.waitForSelector("#mwr", { state: "attached" });
    await hidden(none.page);
    await none.ctx.close();
    const mine = await open(ON, motorwayPath("en", "A7"));
    await mine.page.waitForSelector("#motorway-around .mwz__in");
    expect(await mine.page.isVisible("#mwr")).toBe(true);
    await mine.ctx.close();
  });
});

describe("#901 D11: the nearest Anschlussstelle, named and linked (steward G5.13)", () => {
  for (const width of [1200, 390]) {
    it(`with a position: name, number, distance as the crow flies and a plain map link at the junction's LCL point; nothing about it reaches a URL of ours or Google's, before or after the click (${String(width)} px)`, async () => {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, userAgent: PERSON_UA, geolocation: ON, permissions: ["geolocation"] });
      const page = await ctx.newPage();
      const urls: string[] = [];
      page.on("request", (r) => urls.push(r.url()));
      // the map service is not ours: its request is recorded and answered locally, never sent
      await ctx.route("https://www.openstreetmap.org/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<p>map</p>" }));
      await page.goto(`${BASE}${motorwayPath("de", "A7")}`);
      await page.waitForSelector("#motorway-around .mwa__next");
      const text = (await page.textContent("#motorway-around .mwa__next")) ?? "";
      expect(text).toMatch(/^Nächste Anschlussstelle: .+ \(\d+\), .+ \(Luftlinie\) · /);
      const a = await page.$("#motorway-around .mwa__next a");
      const href = (await a!.getAttribute("href")) ?? "";
      expect(href).toMatch(/^https:\/\/www\.openstreetmap\.org\/\?mlat=\d+\.\d{5}&mlon=\d+\.\d{5}#map=15\/\d+\.\d{5}\/\d+\.\d{5}$/);
      expect(await a!.getAttribute("rel")).toContain("noreferrer");
      expect(await a!.getAttribute("rel")).toContain("noopener");
      // (ii): never in the page's own HTML, the address or the title
      const first = await (await fetch(`${BASE}${motorwayPath("de", "A7")}`)).text();
      expect(first).not.toContain("mwa__next");
      expect(page.url()).not.toMatch(/mlat|mlon|52\.55|9\.45/);
      expect(await page.title()).not.toContain("Anschlussstelle");
      const ours = (): string[] => urls.filter((u) => u.startsWith(BASE) || /google/.test(u));
      for (const u of ours()) expect(u).not.toMatch(/mlat|mlon|52\.55|9\.45/);
      await a!.click();
      await page.waitForURL(/openstreetmap\.org/);
      for (const u of ours()) expect(u).not.toMatch(/mlat|mlon|52\.55|9\.45/);
      expect(urls.some((u) => u.startsWith("https://www.openstreetmap.org/?mlat="))).toBe(true);
      await ctx.close();
    });
  }
  it("in English: the owner's wording; without a position: no such line", async () => {
    const en = await open(ON, motorwayPath("en", "A7"));
    await en.page.waitForSelector("#motorway-around .mwa__next");
    expect((await en.page.textContent("#motorway-around .mwa__next")) ?? "").toMatch(/^Nearest junction \(Anschlussstelle\): .+ \(\d+\), .+ as the crow flies · /);
    await en.ctx.close();
    const none = await open(null, motorwayPath("de", "A7"));
    await none.page.waitForSelector("#mwr", { state: "attached" });
    await none.page.waitForTimeout(300);
    expect(await none.page.$(".mwa__next")).toBeNull();
    await none.ctx.close();
  });
});

// #982 (owner 2026-10-24): off the motorway the lists say where the person WOULD be — the divider at the nearest
// Anschlussstelle, hypothetically, the badges counted from it — and the overview map draws the person where they are,
// off the line, tied to the entry on the line by a dashed line. On the motorway: unchanged.
describe("#982: off the motorway, the nearest entry; on it, 'Sie sind hier'", () => {
  it("about 17 km off the A7: no 'Sie sind hier' between the items — the entry's divider, with its map links, badges 'ab der Auffahrt', the map off the line", async () => {
    const { ctx, page } = await open(OFF, `${motorwayPath("de", "A7")}?r=50`);
    await page.waitForSelector("#motorway-main li.mwk__you");
    const dividers = await page.$$eval("#motorway-main li.mwk__you", (ls: Element[]): { cls: string; text: string; osm: number; app: number }[] => ls.map((l) => ({ cls: l.className, text: (l.querySelector("strong")?.textContent ?? "").trim(), osm: l.querySelectorAll(':scope > a[href^="https://www.openstreetmap.org/?mlat="]').length, app: l.querySelectorAll(':scope > a[href^="https://www.google.com/maps/"]').length })));
    expect(dividers.length).toBeGreaterThan(0);
    for (const d of dividers) {
      expect(d.cls).toBe("mwk__you mwk__you--entry");
      expect(d.text).toMatch(/^Wenn Sie an der nächsten Auffahrt AS .+ auffahren \([\d,]+ km von Ihrem Standort\), sind Sie hier$/u);
      expect([d.osm, d.app]).toEqual([1, 1]);
    }
    expect(await page.textContent("#motorway-main #mw-cards")).not.toContain("Sie sind hier –");
    const rel = await page.$$eval("#motorway-main .mwk__rel", (bs) => bs.map((b) => b.textContent ?? ""));
    expect(rel.length).toBeGreaterThan(0);
    for (const r of rel) expect(r).toMatch(/ab der Auffahrt|an der Auffahrt/u);
    // the map: the entry on the line, the dashed way from the person, the person's pin where they are, and the legend
    expect(await page.$("#motorway-main .mwa-entry")).not.toBeNull();
    expect(await page.$("#motorway-main .mwa-way")).not.toBeNull();
    expect(await page.$("#motorway-main .mwa-you .mwa-pin")).not.toBeNull();
    expect(await page.textContent("#motorway-main .mwa__legend--entry")).toMatch(/^Nächste Auffahrt AS .+ – gestrichelt mit Ihrer Position verbunden$/u);
    await ctx.close();
  });

  it("on the A7: 'Sie sind hier' between the items, as before — no entry line", async () => {
    const { ctx, page } = await open(ON, `${motorwayPath("de", "A7")}?r=50`);
    await page.waitForSelector("#motorway-main li.mwk__you");
    const cls = await page.$$eval("#motorway-main li.mwk__you", (ls: Element[]): string[] => ls.map((l) => l.className));
    for (const c of cls) expect(c).toBe("mwk__you");
    expect(await page.textContent("#motorway-main li.mwk__you strong")).toBe("Sie sind hier");
    expect(await page.$("#motorway-main .mwk__you--entry")).toBeNull();
    expect(await page.$("#motorway-main .mwa-entry")).toBeNull();
    await ctx.close();
  });
});
