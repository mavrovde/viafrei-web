/**
 * #901 D3/D4/D5/D8/D9/D10: the motorway page's type filter and its cards, in a real browser against the BUILT shell
 * and the real digest (`real-digest.ts`: the fixture A7), at 1200 and 390 px, in German and English.
 *
 *   - D5: the cards stand several per row at 1200 px and in one column at 390 px; the Ampel first, full width.
 *   - D3/D4: one checkbox per card; unticking hides the card (the `hidden` attribute), its rows in the around block and
 *     its marks on both maps, with no reload and no request; the summary sums the shown cards' counts and names the
 *     radius while the visitor's own position is in use.
 *   - D8: hiding a kind the Ampel's reasons link to says that the Ampel still judges it.
 *   - D9: `?show=` in the address (replaceState), never the position; a `?show=` page paints filtered; nothing in
 *     localStorage until "Auswahl merken" is clicked; with JavaScript off the bar is hidden and every card shows.
 *   - D10: real checkboxes reached and toggled by the keyboard, the live summary, no horizontal scroll, no shift.
 *   - D12: with the visitor's position the from/to selectors list only the radius's junctions (10 km fewer than
 *     50 km, "Ganz Deutschland" every one); a chosen stretch narrows the page inside the radius; a smaller radius the
 *     stretch reaches outside of resets the page to the radius with a short notice.
 *   - D13: on the planted A4 (`real-digest.ts`) between AS Düren (5) and AS Kerpen (6), towards Köln: every card in
 *     road order with "Sie sind hier – zwischen AS Düren (5) und AS Kerpen (6)", a badge on each row, the rows behind
 *     folded under "1 hinter Ihnen", the map shading the stretch ahead and behind with its legend; none of it without
 *     a position.
 */
import type { ChildProcess } from "node:child_process";
import { AxeBuilder } from "@axe-core/playwright";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { junctionSlugs, stretchSlug, towardsSlug } from "@viafrei/ingest";
import { motorwayPath } from "../src/site/motorways.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8873;
const BASE = `http://127.0.0.1:${PORT}`;
/** Between AS Düren (5) and AS Kerpen (6) on the planted A4, on its line. */
const A4_POS = { latitude: 50.8603, longitude: 6.5805, accuracy: 20 };
/** The planted A4's junctions (`real-digest.ts` A4_POINTS) and the direction towards its last, Köln-Lövenich. */
const A4_JUNCTIONS = [["1", "Aachen-Laurensberg"], ["2", "Aachen"], ["3", "Eschweiler-West"], ["4", "Weisweiler"], ["5", "Düren"], ["6", "Kerpen"], ["7", "Frechen"], ["8", "Köln-Lövenich"]].map(([no, name]) => ({ no: no!, name: name! }));
const TOWARDS_KOELN = towardsSlug(junctionSlugs(A4_JUNCTIONS)[A4_JUNCTIONS.length - 1]!);
const PERSON_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const ID = { IMPRESSUM_NAME: "Filter Probe", IMPRESSUM_STREET: "Probeweg 9", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "filter@example.invalid" };
/** On the fixture A7's line (the around e2e's point). */
const ON = { latitude: 52.5512, longitude: 9.4513, accuracy: 20 };

let browser: Browser;
const shells: ChildProcess[] = [];
let digest: Awaited<ReturnType<typeof startRealDigest>>;

beforeAll(async () => {
  digest = await startRealDigest();
  shells.push(await startShell(PORT, { ...ID, DIGEST_URL: digest.url, VF_MOTORWAY_AROUND: "1" }));
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  for (const s of shells) s.kill();
  await digest?.close();
});

type Seen = { requests: string[] };
async function open(path: string, o: { width?: number; pos?: boolean; js?: boolean; lang?: string } = {}): Promise<{ ctx: BrowserContext; page: Page; seen: Seen }> {
  const ctx = await browser.newContext({
    viewport: { width: o.width ?? 1200, height: 1000 },
    userAgent: PERSON_UA,
    javaScriptEnabled: o.js ?? true,
    ...(o.pos === true ? { geolocation: ON, permissions: ["geolocation"] } : {}),
  });
  const page = await ctx.newPage();
  const seen: Seen = { requests: [] };
  page.on("request", (r) => seen.requests.push(r.url()));
  await page.goto(`${BASE}${path}`);
  return { ctx, page, seen };
}

const kindsShown = (page: Page): Promise<string[]> => page.$$eval("#motorway-main .mwk", (cs) => cs.filter((c) => !(c as HTMLElement).hidden && getComputedStyle(c).display !== "none").map((c) => c.id.slice(4)));
const sumOfShown = (page: Page): Promise<number> =>
  page.$$eval("#motorway-main .mwk", (cs) => cs.filter((c) => !(c as HTMLElement).hidden).reduce((a, c) => a + Number(c.querySelector<HTMLDataElement>(".mwk__n")?.value ?? 0), 0));
const box = (k: string): string => `#mwf input[name=show][value="${k}"]`;

describe("D5: the cards", () => {
  for (const width of [1200, 390])
    it(`${String(width)} px: ${width === 1200 ? "several cards per row" : "one column"}, the Ampel first and full width, no horizontal scroll`, async () => {
      const { ctx, page } = await open(motorwayPath("de", "A7"), { width });
      const lefts = await page.$$eval("#mw-cards > .mwk", (cs) => [...new Set(cs.map((c) => Math.round(c.getBoundingClientRect().left)))]);
      if (width === 1200) expect(lefts.length).toBeGreaterThan(1);
      else expect(lefts.length).toBe(1);
      const ampel = await page.$eval("#ampel-slot .ampel", (a) => a.getBoundingClientRect().width);
      const grid = await page.$eval("#mw-cards", (g) => g.getBoundingClientRect().width);
      expect(ampel).toBeGreaterThanOrEqual(grid - 2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await ctx.close();
    });
});

describe("D3/D4/D10: one checkbox per card, the whole page follows, nothing sent", () => {
  for (const width of [1200, 390])
    it(`${String(width)} px (de): untick parking — its card, its map marks go; the summary sums the rest; no request, no reload`, async () => {
      const { ctx, page, seen } = await open(motorwayPath("de", "A7"), { width });
      await page.waitForSelector("#mwf:not([hidden])");
      // every card of the page, in document order: since #1000/#987 the reference cards (cities, borders) sit before
      // the live grid and are filterable too (#1049)
      const cards = await page.$$eval("#motorway-main .mwk", (cs) => cs.map((c) => c.id.slice(4)));
      const offered = await page.$$eval("#mwf input[name=show]", (bs) => bs.map((b) => (b as HTMLInputElement).value));
      expect(offered).toEqual(cards);
      // every box a real, labelled checkbox
      for (const k of offered) expect(await page.$eval(box(k), (b) => (b as HTMLInputElement).type === "checkbox" && b.closest("label") !== null)).toBe(true);
      expect(await page.textContent("#mwf-sum")).toMatch(/^Alle Daten: \d+ Einträge?$/);
      expect(await page.$$eval("#motorway-main .mw-parking", (ps) => ps.some((p) => getComputedStyle(p).display !== "none"))).toBe(true);
      const before = seen.requests.length;
      const marker = await page.evaluate(() => ((window as unknown as { __kept: number }).__kept = 42));
      await page.uncheck(box("parking"));
      expect(await page.$eval("#mwk-parking", (c) => (c as HTMLElement).hidden)).toBe(true);
      expect(await kindsShown(page)).not.toContain("parking");
      expect(await page.$$eval("#motorway-main .mw-parking", (ps) => ps.every((p) => getComputedStyle(p).display === "none"))).toBe(true);
      expect(new URL(page.url()).searchParams.get("show")).toBe(offered.filter((k) => k !== "parking").join(","));
      expect(seen.requests.length).toBe(before);
      expect(await page.evaluate(() => (window as unknown as { __kept: number }).__kept)).toBe(marker);
      // only parking and charging: the summary names them and sums their counts
      for (const k of offered) if (k !== "charging") await page.uncheck(box(k));
      await page.check(box("parking"));
      const n = await sumOfShown(page);
      expect(await kindsShown(page)).toEqual(["parking", "charging"]);
      expect(await page.textContent("#mwf-sum")).toBe(`Parken und Laden: ${String(n)} ${n === 1 ? "Eintrag" : "Einträge"}`);
      expect(new URL(page.url()).searchParams.get("show")).toBe("parking,charging");
      // "Alle anzeigen" brings everything back and clears the address
      await page.click("#mwf .mwf__all");
      expect(await kindsShown(page)).toEqual(cards);
      expect(new URL(page.url()).search).toBe("");
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await ctx.close();
    });

  it("the keyboard: Tab reaches the boxes, Space toggles one, the summary is a polite live region", async () => {
    const { ctx, page } = await open(motorwayPath("de", "A7"));
    await page.waitForSelector("#mwf:not([hidden])");
    expect(await page.getAttribute("#mwf-sum", "aria-live")).toBe("polite");
    await page.focus(box("jams"));
    await page.keyboard.press("Space");
    expect(await page.$eval(box("jams"), (b) => (b as HTMLInputElement).checked)).toBe(false);
    expect(await kindsShown(page)).not.toContain("jams");
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => (document.activeElement as HTMLInputElement | null)?.name)).toBe("show");
    await ctx.close();
  });

  it("English: the legend, the summary and the kinds in English only", async () => {
    const { ctx, page } = await open(motorwayPath("en", "A7"), { width: 390 });
    await page.waitForSelector("#mwf:not([hidden])");
    expect(await page.textContent("#mwf-l")).toBe("Show");
    expect(await page.textContent("#mwf-sum")).toMatch(/^All data: \d+ entr(y|ies)$/);
    for (const k of await page.$$eval("#mwf input[name=show]", (bs) => bs.map((b) => (b as HTMLInputElement).value))) if (k !== "charging" && k !== "parking") await page.uncheck(box(k));
    expect(await page.textContent("#mwf-sum")).toMatch(/^Parking and Charging: \d+ entr(y|ies)$/);
    const text = await page.textContent("#mwf");
    for (const w of ["Anzeigen", "Einträge", "merken", "Parken"]) expect(text, w).not.toContain(w);
    await ctx.close();
  });
});

describe("D4 with the radius, D8 the Ampel", () => {
  for (const width of [1200, 390])
    it(`${String(width)} px: with the visitor's position the summary names the radius, and the around block's rows follow the boxes`, async () => {
      const { ctx, page } = await open(motorwayPath("de", "A7"), { width, pos: true });
      await page.waitForSelector("#motorway-main .mwa-you");
      await page.waitForFunction(() => /im Umkreis von \d+ km: /.test(document.getElementById("mwf-sum")?.textContent ?? ""));
      const r = await page.$eval("#mwr-range", (x) => (x as HTMLInputElement).value);
      expect(await page.textContent("#mwf-sum")).toMatch(new RegExp(`^Alle Daten im Umkreis von ${r} km: \\d+ Einträge?$`));
      const aroundKinds = await page.$$eval("#motorway-around .mwa__item", (ls) => [...new Set(ls.map((l): string | undefined => /mwa__item--([a-z]+)/.exec(l.getAttribute("class") ?? "")?.[1]).filter((x): x is string => x !== undefined))]);
      expect(aroundKinds.length).toBeGreaterThan(0);
      const k = aroundKinds[0]!;
      await page.uncheck(box(k));
      expect(await page.$$eval(`#motorway-around .mwa__item--${k}`, (ls) => ls.every((l) => (l as HTMLElement).hidden))).toBe(true);
      // a radius change swaps the main block in: the choice holds over it
      await page.click('.mwr__chip[value="50"]');
      await page.waitForFunction(() => /im Umkreis von 50 km: /.test(document.getElementById("mwf-sum")?.textContent ?? ""));
      expect(await kindsShown(page)).not.toContain(k);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await ctx.close();
    });

  it("only 'Sperrungen': only the closures card, and on the map only the closure marks (every other kind's marks hidden)", async () => {
    const { ctx, page } = await open(motorwayPath("de", "A7"));
    await page.waitForSelector("#mwf:not([hidden])");
    for (const k of await page.$$eval("#mwf input[name=show]", (bs) => bs.map((b) => (b as HTMLInputElement).value))) if (k !== "closures") await page.uncheck(box(k));
    expect(await kindsShown(page)).toEqual(["closures"]);
    const drawn = await page.$$eval("#motorway-main svg path[class^='mw-']", (ps) => ps.filter((x) => getComputedStyle(x).display !== "none").map((x) => x.getAttribute("class") ?? ""));
    expect(drawn).toContain("mw-closure");
    for (const k of ["mw-parking", "mw-charging", "mw-camera", "mw-weather", "mw-roadworks", "mw-jam", "mw-warn"]) expect(drawn, k).not.toContain(k);
    const keys = await page.$$eval("#motorway-main .motorway__legend .mw-key", (ks: Element[]): string[] => ks.filter((x) => getComputedStyle(x).display !== "none").map((x) => x.getAttribute("class") ?? ""));
    expect(keys.some((x) => x.includes("mw-key--closure"))).toBe(true);
    expect(keys.some((x) => x.includes("mw-key--parking"))).toBe(false);
    expect(await page.textContent("#mwf-sum")).toMatch(/^Sperrungen: \d+ Einträge?$/);
    await ctx.close();
  });

  it("'Parken' + 'Laden' at a 50 km radius: only those two cards, every row within 50 km, and the summary's count is the rows'", async () => {
    const { ctx, page } = await open(motorwayPath("de", "A7"), { pos: true });
    await page.waitForSelector("#motorway-main .mwa-you");
    await page.click('.mwr__chip[value="50"]');
    await page.waitForFunction(() => (document.querySelector("#motorway-around .mwa__count")?.textContent ?? "").includes("50 km") && !document.getElementById("motorway-main")?.classList.contains("is-updating"));
    for (const k of await page.$$eval("#mwf input[name=show]", (bs) => bs.map((b) => (b as HTMLInputElement).value))) if (k !== "parking" && k !== "charging") await page.uncheck(box(k));
    expect(await kindsShown(page)).toEqual(["parking", "charging"]);
    // every listed row (the divider aside) is counted, and every badge says 50 km or less
    // the rows shown first, those behind "Alle N zeigen", those folded behind you, those "hier bei Ihnen" and the
    // share-alike and OSM blocks (M11, M12): every item the two cards show is counted
    const rows = await page.$$eval("#mwk-parking li:not(.mwk__you), #mwk-charging li:not(.mwk__you)", (ls) => ls.filter((li) => li.parentElement?.closest("li:not(.mwk__you)") == null).length);
    const n = await sumOfShown(page);
    expect(rows).toBe(n);
    expect(await page.textContent("#mwf-sum")).toBe(`Parken und Laden im Umkreis von 50 km: ${String(n)} ${n === 1 ? "Eintrag" : "Einträge"}`);
    const kms = await page.$$eval("#mwk-parking .mwk__rel, #mwk-charging .mwk__rel", (bs) => bs.map((b) => b.textContent ?? ""));
    expect(kms.length).toBeGreaterThan(0);
    for (const t of kms) {
      const m = /([\d,.]+)\s*(km|m)\b/.exec(t);
      if (m === null) continue; // "hier bei Ihnen"
      const km = Number(m[1]!.replace(/\./g, "").replace(",", ".")) / (m[2] === "m" ? 1000 : 1);
      expect(km, t).toBeLessThanOrEqual(50);
    }
    await ctx.close();
  });

  it("?r=10 without a position is the whole road: the same cards and the same counts as the bare address", async () => {
    const counts = async (path: string): Promise<string> => {
      const { ctx, page } = await open(path);
      await page.waitForSelector("#mwf:not([hidden])");
      const c = JSON.stringify(await page.$$eval("#mw-cards > .mwk", (cs) => cs.map((x) => [x.id, x.querySelector<HTMLDataElement>(".mwk__n")?.value ?? null])));
      await ctx.close();
      return c;
    };
    expect(await counts(`${motorwayPath("de", "A7")}?r=10`)).toBe(await counts(motorwayPath("de", "A7")));
  });

  for (const scheme of ["light", "dark"] as const)
    it(`axe: no serious or critical violation in the filter bar and the cards (${scheme}, 390 px)`, async () => {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, userAgent: PERSON_UA, colorScheme: scheme });
      const page = await ctx.newPage();
      await page.goto(`${BASE}${motorwayPath("de", "A7")}`);
      await page.waitForSelector("#mwf:not([hidden])");
      await page.uncheck(box("jams"));
      const r = await new AxeBuilder({ page }).include("#mwf").include("#mw-cards").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.map((x) => x.target.join(" ")).slice(0, 3).join(", ")}`);
      expect(bad).toEqual([]);
      await ctx.close();
    });

  it("hiding a kind the Ampel's reasons link to says that the Ampel still judges it; showing it again takes the note away", async () => {
    const { ctx, page } = await open(motorwayPath("de", "A7"));
    await page.waitForSelector("#mwf:not([hidden])");
    const linked = await page.$$eval("#ampel-slot a[href^='#mw-']", (as) => as.map((a) => a.getAttribute("href") ?? ""));
    expect(linked.length).toBeGreaterThan(0);
    expect(await page.isVisible("#mwf-ampel")).toBe(false);
    const kind = await page.$eval(linked[0]!, (row) => row.closest(".mwk")?.id.slice(4) ?? "");
    expect(kind).not.toBe("");
    const lamp = await page.$eval("#ampel-slot .ampel", (x: Element): string => x.getAttribute("class") ?? "");
    const line = await page.textContent("#ampel-slot .ampel__line");
    await page.uncheck(box(kind));
    expect(await page.isVisible("#mwf-ampel")).toBe(true);
    // the lamp and its sentence are unchanged: it still judges everything
    expect(await page.$eval("#ampel-slot .ampel", (x: Element): string => x.getAttribute("class") ?? "")).toBe(lamp);
    expect(await page.textContent("#ampel-slot .ampel__line")).toBe(line);
    expect(await page.textContent("#mwf-ampel")).toBe("Die Ampel bewertet weiterhin alles – einige ihrer Gründe sind gerade ausgeblendet.");
    // the Ampel itself is unchanged: it judges everything
    expect(await page.isVisible("#ampel-slot .ampel")).toBe(true);
    await page.check(box(kind));
    expect(await page.isVisible("#mwf-ampel")).toBe(false);
    await ctx.close();
  });
});

describe("D9: the address, the device, no script", () => {
  /** The page's layout shift over its first two seconds (the position bar's arrival included). */
  const cls = async (path: string, pos: boolean): Promise<number> => {
    const { ctx, page } = await open(path, { pos });
    const s = await page.evaluate(
      () =>
        new Promise<number>((res) => {
          let v = 0;
          new PerformanceObserver((l) => {
            for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) v += e.value;
          }).observe({ type: "layout-shift", buffered: true });
          setTimeout(() => res(v), 2000);
        }),
    );
    await ctx.close();
    return s;
  };

  for (const pos of [false, true])
    it(`no CLS regression (${pos ? "with" : "without"} a position): a ?show= page shifts no more than the page with every card`, async () => {
      const bare = await cls(motorwayPath("de", "A7"), pos);
      const shown = await cls(`${motorwayPath("de", "A7")}?show=parking,charging`, pos);
      expect(shown).toBeLessThanOrEqual(bare + 0.01);
      if (!pos) expect(shown).toBeLessThan(0.01);
    });

  it("a ?show= page paints filtered, the boxes as asked, and never carries a position", async () => {
    const { ctx, page } = await open(`${motorwayPath("de", "A7")}?show=parking,charging`, { pos: true });
    await page.waitForSelector("#mwf:not([hidden])");
    expect(await kindsShown(page)).toEqual(["parking", "charging"]);
    expect(await page.$eval(box("jams"), (b) => (b as HTMLInputElement).checked)).toBe(false);
    await page.waitForSelector("#motorway-main .mwa-you");
    expect(page.url()).not.toMatch(/52\.55|9\.45|lat=|lon=/);
    expect(new URL(page.url()).searchParams.get("show")).toBe("parking,charging");
    await ctx.close();
  });

  it("nothing in localStorage until 'Auswahl merken'; then the choice opens the next visit; 'Nicht mehr merken' removes it", async () => {
    const { ctx, page } = await open(motorwayPath("de", "A7"));
    await page.waitForSelector("#mwf:not([hidden])");
    await page.uncheck(box("jams"));
    expect(await page.evaluate(() => window.localStorage.getItem("vf.motorway.show"))).toBeNull();
    await page.click("#mwf .mwf__save");
    expect(await page.evaluate(() => window.localStorage.getItem("vf.motorway.show"))).not.toContain("jams");
    expect(await page.isVisible("#mwf .mwf__kept")).toBe(true);
    await page.goto(`${BASE}${motorwayPath("de", "A7")}`);
    await page.waitForSelector("#mwf:not([hidden])");
    expect(await kindsShown(page)).not.toContain("jams");
    await page.click("#mwf .mwf__forget");
    expect(await page.evaluate(() => window.localStorage.getItem("vf.motorway.show"))).toBeNull();
    await ctx.close();
  });

  it("JavaScript off: the bar is hidden and every card shows", async () => {
    const { ctx, page } = await open(`${motorwayPath("de", "A7")}?show=parking`, { js: false });
    expect(await page.$("#mwf[hidden]")).not.toBeNull();
    expect(await page.isVisible("#mwf")).toBe(false);
    const all = await page.$$eval("#mw-cards > .mwk", (cs) => cs.map((c) => getComputedStyle(c).display !== "none"));
    expect(all.length).toBeGreaterThan(5);
    expect(all.every(Boolean)).toBe(true);
    await ctx.close();
  });
});

/** The fixture A7's junctions (`real-motorway.ts`: every point i with i % 9 in 0, 2, 4, 6) and their slugs, the digest's rule. */
const JUNCTION_POINTS = Array.from({ length: 320 }, (_, i) => i).filter((i) => [0, 2, 4, 6].includes(i % 9));
const SLUGS = junctionSlugs(JUNCTION_POINTS.map((i) => ({ no: String(i + 1), name: `Musterstadt-${["Nord", "Süd", "Ost", "West", "Mitte"][i % 5]!} ${String(i + 1)}` })));
/**
 * Points 94 … 96 (junctions 95 and 97), north of the position at point 100: the first two junctions a 50 km radius
 * holds on the fixture (its stretch is 95 … 106; the radius never leaves the position's own LCL chain) — so 50 km
 * holds the stretch and 10 km does not.
 */
const NEAR = stretchSlug(SLUGS[JUNCTION_POINTS.indexOf(94)]!, SLUGS[JUNCTION_POINTS.indexOf(96)]!);

const fromCount = (page: Page): Promise<number> => page.$$eval('#motorway-main select[name="from"] option', (os) => os.filter((o) => (o as HTMLOptionElement).value !== "").length);
const radiusTo = async (page: Page, km: number): Promise<void> => {
  await page.click(`.mwr__chip[value="${String(km)}"]`);
  await page.waitForFunction((r) => (document.querySelector("#motorway-around .mwa__count")?.textContent ?? "").includes(`${String(r)} km`) && !document.getElementById("motorway-main")?.classList.contains("is-updating"), km);
};

describe("D12: the from/to selectors follow the radius", () => {
  for (const width of [1200, 390])
    it(`${String(width)} px (de): radius 10 lists only its junctions, 50 more, 'Ganz Deutschland' every one; nothing preselected, the blanks name the radius's ends`, async () => {
      const { ctx, page } = await open(motorwayPath("de", "A7"), { width, pos: true });
      await page.waitForSelector("#motorway-main .mwa-you");
      await radiusTo(page, 10);
      const ten = await fromCount(page);
      expect(ten).toBeGreaterThan(0);
      expect(ten).toBeLessThan(8);
      expect(await page.$eval('#motorway-main select[name="from"] option[value=""]', (o) => o.textContent ?? "")).toMatch(/^Anfang des Umkreises \(/);
      expect(await page.$eval('#motorway-main select[name="to"] option[value=""]', (o) => o.textContent ?? "")).toMatch(/^Ende des Umkreises \(/);
      expect(await page.$$eval("#motorway-main select option", (os) => os.some((o) => (o as HTMLOptionElement).selected && (o as HTMLOptionElement).value !== ""))).toBe(false);
      // road order: the junction numbers rise
      const nos = await page.$$eval('#motorway-main select[name="from"] option', (os) => os.map((o) => Number(/^(\d+) /.exec(o.textContent ?? "")?.[1] ?? "NaN")).filter((n) => !Number.isNaN(n)));
      expect(nos).toEqual([...nos].sort((a, b) => a - b));
      await radiusTo(page, 50);
      const fifty = await fromCount(page);
      expect(fifty).toBeGreaterThan(ten);
      await page.click("#place-pill");
      await page.click("#place-scope-de");
      await page.waitForFunction(() => document.getElementById("mwr")?.hidden === true && !document.querySelector("#motorway-main .mwa-you"));
      expect(await fromCount(page)).toBe(JUNCTION_POINTS.length);
      // the position never reaches the address
      expect(page.url()).not.toMatch(/52\.55|9\.45|lat=|lon=|ort-|musterstadt/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await ctx.close();
    });

  for (const [lang, width] of [["de", 1200], ["en", 390]] as const)
    it(`${lang}, ${String(width)} px: a chosen stretch inside the radius narrows the page to it; a smaller radius it reaches outside of resets to the radius with a notice; back again, the notice goes`, async () => {
      const { ctx, page } = await open(`${motorwayPath(lang, "A7")}/${NEAR}?r=50`, { width, pos: true, lang });
      await page.waitForSelector("#motorway-main .mwa-you");
      await page.waitForFunction(() => (document.querySelector("#motorway-around .mwa__count")?.textContent ?? "").includes("50 km"));
      expect(await page.$("#motorway-around .mwa__reset")).toBeNull();
      expect(await page.textContent("#motorway-around .mwa__inforce")).toMatch(lang === "de" ? /^Die Listen unten zeigen Ihren gewählten Abschnitt .+ in Ihrem Umkreis von 50 km\.$/ : /^The lists below show your chosen stretch .+ within your 50 km radius\.$/);
      // the chosen stretch stays selected; the selectors still list the radius's junctions only
      expect(await page.$eval('#motorway-main select[name="from"]', (x) => (x as HTMLSelectElement).value)).toBe(SLUGS[JUNCTION_POINTS.indexOf(94)]);
      expect(await page.$eval('#motorway-main select[name="to"]', (x) => (x as HTMLSelectElement).value)).toBe(SLUGS[JUNCTION_POINTS.indexOf(96)]);
      const narrowed = await page.$$eval("#mw-cards > .mwk", (cs) => cs.reduce((a, c) => a + Number(c.querySelector<HTMLDataElement>(".mwk__n")?.value ?? 0), 0));
      await radiusTo(page, 10);
      expect(await page.textContent("#motorway-around .mwa__reset")).toBe(lang === "de" ? "Ihr gewählter Abschnitt liegt außerhalb Ihres Umkreises von 10 km – es gilt der Umkreis." : "The stretch you chose lies outside your 10 km radius – the radius applies.");
      expect(await page.$$eval("#motorway-main select option", (os) => os.some((o) => (o as HTMLOptionElement).selected && (o as HTMLOptionElement).value !== ""))).toBe(false);
      await radiusTo(page, 50);
      expect(await page.$("#motorway-around .mwa__reset")).toBeNull();
      expect(await page.$$eval("#mw-cards > .mwk", (cs) => cs.reduce((a, c) => a + Number(c.querySelector<HTMLDataElement>(".mwk__n")?.value ?? 0), 0))).toBe(narrowed);
      // the address keeps the chosen stretch and the radius, never the position
      expect(page.url()).not.toMatch(/52\.55|9\.45|lat=|lon=/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await ctx.close();
    });
});

describe("D13: where you are in every list, on the planted A4 between Düren and Kerpen", () => {
  const card = (page: Page, kind: string): Promise<string> => page.$eval(`#mwk-${kind}`, (c) => (c as HTMLElement).innerText.replace(/\s+/g, " "));
  const COPY = {
    de: { you: "Sie sind hier – zwischen AS Düren (5) und AS Kerpen (6)", ahead: /vor Ihnen/, behind: "1 hinter Ihnen", towardsEnd: /Richtung Köln-Lövenich/, towardsStart: /Richtung Aachen-Laurensberg/, mapAhead: "Strecke vor Ihnen", mapBehind: "Strecke hinter Ihnen" },
    en: { you: "You are here – between Düren junction (5) and Kerpen junction (6)", ahead: /ahead/, behind: "1 behind you", towardsEnd: /towards Köln-Lövenich/, towardsStart: /towards Aachen-Laurensberg/, mapAhead: "Stretch ahead of you", mapBehind: "Stretch behind you" },
  } as const;

  for (const [lang, width] of [["de", 1200], ["de", 390], ["en", 1200], ["en", 390]] as const)
    it(`${lang}, ${String(width)} px: towards Köln — the divider between Düren and Kerpen, ahead and behind, the behind folded, the map shaded`, async () => {
      const c = COPY[lang];
      const { ctx, page } = await open(`${motorwayPath(lang, "A4")}/${TOWARDS_KOELN}`, { width, pos: true });
      await ctx.setGeolocation(A4_POS);
      await page.reload();
      await page.waitForSelector("#motorway-main .mwk__you");
      const rw = await card(page, "roadworks");
      expect(rw).toContain(c.you);
      // ahead: Kerpen – Frechen, with its badge; behind: Weisweiler – Düren, folded under "1 hinter Ihnen"
      const ahead = await page.$eval("#mwk-roadworks .mwk__road", (u) => [...u.children].filter((li) => !li.classList.contains("mwk__you")).map((li) => (li as HTMLElement).innerText));
      expect(ahead.length).toBe(1);
      expect(ahead[0]).toMatch(c.ahead);
      expect(ahead[0]).toContain("Frechen");
      expect(ahead[0]).toMatch(/↓/);
      const box = await page.$eval("#mwk-roadworks .mwk__behindbox", (d) => ({ open: (d as HTMLDetailsElement).open, sum: d.querySelector("summary")?.textContent ?? "", text: (d as HTMLElement).textContent ?? "" }));
      expect(box.open).toBe(false);
      expect(box.sum).toBe(c.behind);
      expect(box.text).toContain("Weisweiler");
      // the muted style of a row behind
      expect(await page.$eval("#mwk-roadworks .mwk__behind", (li) => getComputedStyle(li).color)).not.toBe(await page.$eval("#mwk-roadworks .mwk__road > li:not(.mwk__you)", (li) => getComputedStyle(li).color));
      // every card that lists rows carries the divider (the closures card too)
      expect(await card(page, "closures")).toContain(c.you);
      // the map: the stretch ahead and behind shaded, each in the legend
      expect(await page.$("#motorway-main path.mw-ahead")).not.toBeNull();
      expect(await page.$("#motorway-main path.mw-behind")).not.toBeNull();
      const legend = await page.$$eval("#motorway-main .motorway__legend li", (ls) => ls.map((l) => l.textContent ?? ""));
      expect(legend).toContain(c.mapAhead);
      expect(legend).toContain(c.mapBehind);
      // the --you swatch on the divider
      expect(await page.$("#mwk-roadworks .mwk__you .mw-key--you")).not.toBeNull();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      // the position never reaches the address
      expect(page.url()).not.toMatch(/50\.86|6\.58|lat=|lon=/);
      await ctx.close();
    });

  for (const lang of ["de", "en"] as const)
    it(`${lang}: no direction — road order, the divider, each row 'Richtung <end>', nothing folded and no shading`, async () => {
      const c = COPY[lang];
      const { ctx, page } = await open(motorwayPath(lang, "A4"), { pos: true });
      await ctx.setGeolocation(A4_POS);
      await page.reload();
      await page.waitForSelector("#motorway-main .mwk__you");
      const rw = await card(page, "roadworks");
      expect(rw).toContain(c.you);
      expect(rw).toMatch(c.towardsEnd);
      expect(rw).toMatch(c.towardsStart);
      // Weisweiler stands before the divider, Frechen after it
      expect(rw.indexOf("Weisweiler")).toBeLessThan(rw.indexOf(c.you));
      expect(rw.indexOf("Frechen")).toBeGreaterThan(rw.indexOf(c.you));
      expect(await page.$("#mwk-roadworks .mwk__behindbox")).toBeNull();
      expect(await page.$("#motorway-main path.mw-ahead")).toBeNull();
      await ctx.close();
    });

  it("no position: no divider, no badge, no shading anywhere on the page", async () => {
    const { ctx, page } = await open(`${motorwayPath("de", "A4")}/${TOWARDS_KOELN}`);
    await page.waitForSelector("#mw-cards");
    await page.waitForTimeout(300);
    expect(await page.$(".mwk__you")).toBeNull();
    expect(await page.$(".mwk__rel")).toBeNull();
    expect(await page.$("path.mw-ahead, path.mw-behind")).toBeNull();
    expect(await page.textContent("#motorway-main")).not.toContain("Sie sind hier");
    await ctx.close();
  });
});

describe("D6/D7: the parking card's publisher and OpenStreetMap filter groups, CSS only (the planted A7: every other lorry park a shower and 'kein WC', every sixth odd one a charger and a WC; OpenStreetMap a WC and a café near every fourth asked site)", () => {
  /** Every parking row of the card's own list (the share-alike and OSM car-park blocks aside), each with whether it is shown and its text. */
  // #1061: a chip opens every fold of the card (the filter reads the whole list); the rows are read once all are in
  const rows = async (page: Page): Promise<{ shown: boolean; text: string; cls: string[] }[]> => {
    // the script marks each fold it opens (data-all); with JavaScript off nothing is marked and nothing is waited for
    for (let i = 0; i < 100; i++) {
      const pending = await page.$$eval("#mwk-parking details.pager[data-all]", (ds) => ds.filter((d) => d.getAttribute("data-state") !== "done").length);
      if (pending === 0) break;
      await page.waitForTimeout(50);
    }
    return page.$$eval("#mwk-parking li:not(.mwk__you)", (ls) =>
      ls
        .filter((li) => li.closest(".pcard__osm") === null)
        .map((li) => ({
          shown: getComputedStyle(li).display !== "none",
          text: (li.textContent ?? "").replace(/\s+/g, " "),
          cls: [...li.querySelectorAll("[class]")].flatMap((e) => (e.getAttribute("class") ?? "").split(" ")),
        })),
    );
  };
  const chipOf = (group: "amchips" | "nbchips", value: string): string => `#mwk-parking .${group} input[value="${value}"]`;
  /** From 1024 px the desktop dashboard (#1180) stands the parking card as its head and one "alle N anzeigen" button;
   *  the visitor opens it before filtering, and so does the test. Without JavaScript nothing is folded. */
  const opened = async (page: Page, js = true): Promise<void> => {
    if (js) await page.click("#mwk-parking > .desk__more");
  };
  const shownBlocks = (page: Page, sel: string): Promise<boolean[]> => page.$$eval(sel, (bs) => bs.map((b) => getComputedStyle(b).display !== "none"));

  for (const js of [true, false])
    it(`'Dusche' keeps only the rows whose own publisher states a shower, each with its publisher line; the credits stay (JS ${js ? "on" : "off"})`, async () => {
      const { ctx, page } = await open(motorwayPath("de", "A7"), { js });
      await opened(page, js);
      await page.waitForSelector("#mwk-parking .amchips");
      const before = await rows(page);
      expect(before.every((r) => r.shown)).toBe(true);
      await page.check(chipOf("amchips", "shower"));
      const after = await rows(page);
      const kept = after.filter((r) => r.shown);
      expect(kept.length).toBeGreaterThan(0);
      expect(kept.length).toBeLessThan(after.length);
      for (const r of kept) {
        expect(r.cls, r.text).toContain("am-shower");
        expect(r.text).toContain("Ausstattung laut Herausgeber:");
      }
      for (const r of after.filter((x) => !x.shown)) expect(r.cls, r.text).not.toContain("am-shower");
      expect(await page.isVisible("#mwk-parking .amchips p")).toBe(true);
      for (const v of await shownBlocks(page, "#mwk-parking .credit")) expect(v).toBe(true);
      await ctx.close();
    });

  it("none qualifying ('Dusche' and 'Laden'): no row, and the sentence 'k von n … unbekannt, nicht ausgeschlossen' with the credits of every counted site", async () => {
    const { ctx, page } = await open(motorwayPath("de", "A7"));
    await opened(page);
    await page.waitForSelector("#mwk-parking .amchips");
    await page.check(chipOf("amchips", "shower"));
    await page.check(chipOf("amchips", "charging"));
    expect((await rows(page)).filter((r) => r.shown)).toEqual([]);
    const said = (await page.textContent("#mwk-parking .amchips p")) ?? "";
    expect(said).toMatch(/^\d+ von \d+ Anlagen nennen eine Ausstattung — bei den übrigen ist sie unbekannt, nicht ausgeschlossen\.$/u);
    expect(await page.isVisible("#mwk-parking .amchips p")).toBe(true);
    const credits = await shownBlocks(page, "#mwk-parking .credit");
    expect(credits.length).toBeGreaterThan(0);
    for (const v of credits) expect(v).toBe(true);
    await ctx.close();
  });

  it("C6: 'Laden' keeps only rows whose publisher states charging — a site near a charging station (the charging card) is not kept by it", async () => {
    const { ctx, page } = await open(motorwayPath("de", "A7"));
    await opened(page);
    await page.waitForSelector("#mwk-parking .amchips");
    await page.check(chipOf("amchips", "charging"));
    const all = await rows(page);
    const kept = all.filter((r) => r.shown);
    expect(kept.length).toBeGreaterThan(0);
    for (const r of kept) expect(r.cls, r.text).toContain("am-charging");
    // a nearby line never carries an amenity class: every hidden row lacks the publisher's charging
    for (const r of all.filter((x) => !x.shown)) expect(r.cls, r.text).not.toContain("am-charging");
    // C6 holds on the motorway page by TYPE: a motorway site's nearby part carries no chargers at all
    // (`chargers: readonly []`, analysis/motorway-layers.ts), so no charger can stand beside a site there. What a browser
    // can show is that the nearby parts that ARE there (OpenStreetMap's, classed nb-*) never carry an amenity class.
    const nearCls = await page.$$eval("#mwk-parking .pcard__near [class]", (es) => es.map((e) => e.getAttribute("class") ?? ""));
    expect(nearCls.length).toBeGreaterThan(0);
    expect(nearCls.every((c) => /^nb-/u.test(c))).toBe(true);
    expect(nearCls.some((c) => /\bam-/u.test(c))).toBe(false);
    await ctx.close();
  });

  it("D7: under its own heading, OpenStreetMap 'WC' keeps only rows naming an OSM WC — name, distance, Luftlinie; the share-alike and OSM car-park blocks hidden; the OSM line and the offer shown; no count, no fuel", async () => {
    const { ctx, page } = await open(motorwayPath("de", "A7"));
    await opened(page);
    await page.waitForSelector("#mwk-parking .nbchips");
    expect(await page.textContent("#mwk-parking .nbchips legend")).toBe("In der Nähe laut OpenStreetMap:");
    const group = (await page.textContent("#mwk-parking .nbchips")) ?? "";
    expect(group).not.toMatch(/\d/u);
    expect(await page.$$eval("#mwk-parking .nbchips input", (bs) => bs.map((b) => (b as HTMLInputElement).value))).not.toContain("fuel");
    expect(await page.$$eval("#mwk-parking .pcard__osm", (bs) => bs.length)).toBeGreaterThan(0);
    await page.check(chipOf("nbchips", "toilet"));
    const kept = (await rows(page)).filter((r) => r.shown);
    expect(kept.length).toBeGreaterThan(0);
    for (const r of kept) {
      expect(r.cls, r.text).toContain("nb-toilet");
      expect(r.text).toMatch(/In der Nähe laut OpenStreetMap \(Luftlinie[^)]*\): [^]*WC \d+ m \([^)]+\)/u);
    }
    // N7: the publisher's "kein WC" stays beside a site kept by an OSM WC
    expect(kept.some((r) => r.text.includes("kein WC"))).toBe(true);
    for (const v of await shownBlocks(page, "#mwk-parking .pcard__osm")) expect(v).toBe(false);
    // N4: the credit and the offer
    expect(await page.isVisible("#mwk-parking .pcard__nearsrc a[href='https://www.openstreetmap.org/copyright']")).toBe(true);
    expect(await page.textContent("#mwk-parking .pcard__nearsrc")).toContain("Impressum");
    // N5: no count anywhere for it, and the publisher's figures do not move
    expect(await page.isVisible("#mwk-parking .nbchips p")).toBe(true);
    expect((await page.textContent("#mwk-parking .nbchips")) ?? "").not.toMatch(/\d/u);
    // N8/M14: no fuel price and no Tankerkönig string in the page the server renders, nor in the parking card. The
    // page's own fuel block loads its prices (with their credit, by law) when it comes into view — a fragment of its
    // own, not this filter's (2.4.3: the fuel slot is laid out from the first paint, so the chip's scroll reveals it).
    const served = await (await fetch(`${BASE}${motorwayPath("de", "A7")}`)).text();
    expect(served.toLowerCase()).not.toMatch(/tankerk(ö|oe)nig/u);
    expect(((await page.textContent("#mwk-parking")) ?? "").toLowerCase()).not.toMatch(/tankerk(ö|oe)nig|€\/l/u);
    await ctx.close();
  });

  it("D7 (N1): a publisher chip and an OpenStreetMap chip together keep only rows matching both, each with both labels; the publisher's 'k von n' does not move", async () => {
    const { ctx, page } = await open(motorwayPath("de", "A7"));
    await opened(page);
    await page.waitForSelector("#mwk-parking .nbchips");
    const said = await page.textContent("#mwk-parking .amchips p");
    await page.check(chipOf("amchips", "shower"));
    await page.check(chipOf("nbchips", "toilet"));
    const kept = (await rows(page)).filter((r) => r.shown);
    expect(kept.length).toBeGreaterThan(0);
    for (const r of kept) {
      expect(r.cls).toContain("am-shower");
      expect(r.cls).toContain("nb-toilet");
      expect(r.text).toContain("Ausstattung laut Herausgeber:");
      expect(r.text).toContain("In der Nähe laut OpenStreetMap");
    }
    expect(await page.textContent("#mwk-parking .amchips p")).toBe(said);
    await ctx.close();
  });

  it("D7 (N4): an empty filtered view still shows the OpenStreetMap line, the § 4.6 offer and 'unbekannt, nicht ausgeschlossen'", async () => {
    const { ctx, page } = await open(motorwayPath("de", "A7"));
    await opened(page);
    await page.waitForSelector("#mwk-parking .nbchips");
    for (const v of await page.$$eval("#mwk-parking .nbchips input", (bs) => bs.map((b) => (b as HTMLInputElement).value))) await page.check(chipOf("nbchips", v));
    await page.check(chipOf("amchips", "charging"));
    expect((await rows(page)).filter((r) => r.shown)).toEqual([]);
    expect(await page.isVisible("#mwk-parking .pcard__nearsrc a[href='https://www.openstreetmap.org/copyright']")).toBe(true);
    expect(await page.textContent("#mwk-parking .pcard__nearsrc")).toContain("Impressum");
    expect(await page.textContent("#mwk-parking .nbchips p")).toContain("unbekannt, nicht ausgeschlossen");
    expect(await page.isVisible("#mwk-parking .nbchips p")).toBe(true);
    // N9: nothing reached the address
    expect(page.url()).not.toMatch(/toilet|shower|charging|nb=|am=/u);
    await ctx.close();
  });

  it("the around block's count line follows the type filter: the kinds still shown, the unlisted rows included", async () => {
    const { ctx, page } = await open(motorwayPath("de", "A7"), { pos: true });
    await page.waitForSelector("#motorway-around .mwa__n");
    const by = async (): Promise<Record<string, number>> =>
      Object.fromEntries(((await page.getAttribute("#motorway-around .mwa__by", "value")) ?? "").split(" ").map((kv) => [kv.slice(0, kv.lastIndexOf(":")), Number(kv.slice(kv.lastIndexOf(":") + 1))]));
    const counts = await by();
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(Number(await page.textContent("#motorway-around .mwa__n"))).toBe(total);
    const kinds = Object.keys(counts).filter((k) => k !== "_");
    expect(kinds.length).toBeGreaterThan(0);
    const hide = kinds[0]!;
    await page.uncheck(box(hide));
    await page.waitForFunction((n) => document.querySelector("#motorway-around .mwa__n")?.textContent === String(n), total - counts[hide]!);
    // every listed row of the hidden kind is hidden with it
    expect(await page.$$eval(`#motorway-around .mwa__item--${hide}`, (ls) => ls.every((l) => (l as HTMLElement).hidden))).toBe(true);
    await page.check(box(hide));
    await page.waitForFunction((n) => document.querySelector("#motorway-around .mwa__n")?.textContent === String(n), total);
    await ctx.close();
  });
});

describe("#901 review: the D8 note with a position, and the from/to form keeping the type choice", () => {
  it("1: with a position at 50 km the around Ampel's reasons link into the around list; hiding the cited kind shows the note, the lamp unchanged", async () => {
    const { ctx, page } = await open(motorwayPath("de", "A7"), { pos: true });
    await page.waitForSelector("#motorway-main .mwa-you");
    await page.click('.mwr__chip[value="50"]');
    await page.waitForFunction(() => (document.querySelector("#motorway-around .mwa__count")?.textContent ?? "").includes("50 km") && !document.getElementById("motorway-main")?.classList.contains("is-updating"));
    await page.waitForSelector("#ampel-slot #motorway-ampel-around");
    // the reasons cite rows of the around list (#mwa-iN), and none of the cards' anchors
    const cited = await page.$$eval("#ampel-slot a[href^='#mwa-i']", (as) =>
      as.map((a) => {
        const t = document.getElementById((a.getAttribute("href") ?? "").slice(1));
        return (/mwa__item--([a-z]+)/.exec(t?.className ?? "") ?? [])[1] ?? "";
      }),
    );
    const kinds = cited.filter((k) => k !== "");
    expect(kinds.length).toBeGreaterThan(0);
    // the review's case: a closure, when the Ampel cites one; else the first kind it cites
    const kind = kinds.includes("closures") ? "closures" : kinds[0]!;
    expect(await page.isVisible("#mwf-ampel")).toBe(false);
    const lamp = await page.$eval("#ampel-slot .ampel", (x: Element): string => x.getAttribute("class") ?? "");
    const line = await page.textContent("#ampel-slot .ampel__line");
    await page.uncheck(box(kind));
    await page.waitForSelector("#mwf-ampel:not([hidden])");
    expect(await page.textContent("#mwf-ampel")).toBe("Die Ampel bewertet weiterhin alles – einige ihrer Gründe sind gerade ausgeblendet.");
    expect(await page.$eval("#ampel-slot .ampel", (x: Element): string => x.getAttribute("class") ?? "")).toBe(lamp);
    expect(await page.textContent("#ampel-slot .ampel__line")).toBe(line);
    await page.check(box(kind));
    await page.waitForSelector("#mwf-ampel[hidden]", { state: "attached" });
    await ctx.close();
  });

  it("9: ?show=parking, then a stretch from the form — the address keeps show=parking, the form sends no layer choice", async () => {
    const { ctx, page } = await open(`${motorwayPath("de", "A7")}?show=parking`);
    await page.waitForSelector("#mwf:not([hidden])");
    expect(await kindsShown(page)).toEqual(["parking"]);
    const form = "#motorway-main form.motorway__filter";
    expect(await page.$eval(`${form} input[type=hidden][name=show]`, (i) => (i as HTMLInputElement).value)).toBe("parking");
    // the hidden layer boxes and f=1 are not sent
    expect(await page.$$eval(`${form} .motorway__layers input`, (is) => is.every((i) => (i as HTMLInputElement).disabled))).toBe(true);
    const opts = await page.$$eval(`${form} select[name=from] option`, (os) => os.map((o) => (o as HTMLOptionElement).value).filter((v) => v !== ""));
    expect(opts.length).toBeGreaterThan(3);
    // owner 2026-10-27: no Apply button with scripts on — the select sends the form by itself
    expect(await page.$$eval(`${form} button[type=submit]`, (bs) => bs.length)).toBe(0);
    await Promise.all([page.waitForURL((u) => u.pathname !== motorwayPath("de", "A7")), page.selectOption(`${form} select[name=from]`, opts[1]!)]);
    const u = new URL(page.url());
    expect(u.searchParams.get("show")).toBe("parking");
    expect(u.searchParams.get("f")).toBeNull();
    expect(u.searchParams.getAll("layer")).toEqual([]);
    await page.waitForSelector("#mwf:not([hidden])");
    expect(await kindsShown(page)).toEqual(["parking"]);
    // ticking every kind again: the form carries no show at all
    await page.click("#mwf .mwf__all");
    expect(await page.$(`${form} input[type=hidden][name=show]`)).toBeNull();
    await ctx.close();
  });
});

// #753: the bar in four of the fifteen languages at 390 px — French (long words, a no-break space before ":"),
// Cyrillic Serbian, Greek and Hungarian. The bar fits the phone, its words are the page's own, and a choice
// rewrites the summary in that language (its plural form by the page's Intl tag).
describe("#753: the filter bar at 390 px in fr, sr, el and hu", () => {
  for (const lang of ["fr", "sr", "el", "hu"] as const)
    it(`${lang}: inside the viewport, no horizontal scroll, the page's own words, the summary rewritten on a choice`, async () => {
      const { ctx, page } = await open(motorwayPath(lang, "A7"), { width: 390 });
      await page.waitForSelector("#mwf:not([hidden])");
      const fit = await page.$eval("#mwf", (b) => {
        const r = b.getBoundingClientRect();
        const wide = Array.from(b.querySelectorAll("*")).filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1).length;
        return { left: r.left, right: r.right, vw: window.innerWidth, sw: document.documentElement.scrollWidth, wide };
      });
      expect(fit.left, lang).toBeGreaterThanOrEqual(0);
      expect(fit.right, lang).toBeLessThanOrEqual(fit.vw);
      expect(fit.sw, lang).toBeLessThanOrEqual(fit.vw);
      expect(fit.wide, lang).toBe(0);
      const before = (await page.textContent("#mwf-sum")) ?? "";
      expect(before, lang).toMatch(/\d/);
      for (const k of await page.$$eval("#mwf input[name=show]", (bs) => bs.map((b) => (b as HTMLInputElement).value))) if (k !== "parking") await page.uncheck(box(k));
      const after = (await page.textContent("#mwf-sum")) ?? "";
      expect(after, lang).not.toBe(before);
      const text = (await page.textContent("#mwf")) ?? "";
      for (const w of ["Anzeigen", "Einträge", "merken", "Parken", "Show all", "entries", "Remember"]) expect(text, `${lang} ${w}`).not.toContain(w);
      if (lang === "sr" || lang === "el") expect(text.replace(/OpenStreetMap|DWD|ViaFrei|\bA\d+\b|\bkm\b/g, ""), lang).not.toMatch(/[A-Za-z]{2,}/);
      await ctx.close();
    });
});

// #983 (owner 2026-10-24, "how can I uncheck all selections?"): "Keine" beside "Alle", in the island's bar and, with
// JavaScript off, in the form itself — links that keep the stretch and direction and set only the layers.
describe("#983: Alle and Keine", () => {
  it("with the island: 'Keine anzeigen' unticks every kind, then ticking Sperrungen shows only the closures", async () => {
    const { ctx, page } = await open(motorwayPath("de", "A7"));
    await page.waitForSelector("#mwf:not([hidden])");
    expect(await page.getAttribute("#mwf .mwf__none", "aria-label")).toBe("Keine anzeigen – alle Arten abwählen");
    expect(await page.getAttribute("#mwf .mwf__all", "aria-label")).toBe("Alle anzeigen – alle Arten auswählen");
    await page.click("#mwf .mwf__none");
    expect(await kindsShown(page)).toEqual([]);
    expect(await page.textContent("#mwf-sum")).toBe("Nichts ausgewählt – wählen Sie mindestens eine Art.");
    await page.check(box("closures"));
    expect(await kindsShown(page)).toEqual(["closures"]);
    expect(new URL(page.url()).searchParams.get("show")).toBe("closures");
    // reached by the keyboard: Tab from "Alle anzeigen" lands on "Keine anzeigen", and Enter applies it
    await page.focus("#mwf .mwf__all");
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.activeElement?.classList.contains("mwf__none"))).toBe(true);
    await page.keyboard.press("Enter");
    expect(await kindsShown(page)).toEqual([]);
    // axe over the form as a no-script visitor gets it (the island hides its layer fieldset; shown again here): the
    // nested fieldset with its legend and the two fully named links carry no violation
    await page.evaluate(() => document.querySelectorAll<HTMLElement>("form.motorway__filter .motorway__layers").forEach((f) => (f.hidden = false)));
    const axe = await new AxeBuilder({ page }).include("form.motorway__filter").analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
    await ctx.close();
  });

  it("JavaScript off: 'Keine' keeps the stretch and direction, the page says nothing is chosen, then Meldungen + Anzeigen shows the closures and not the parking", async () => {
    const { ctx, page } = await open(motorwayPath("de", "A7"), { js: false });
    const slugs = await page.$$eval("form.motorway__filter select[name=from] option", (o) => o.map((x) => (x as HTMLOptionElement).value).filter((v) => v !== ""));
    const path = `${motorwayPath("de", "A7")}/${stretchSlug(slugs[1]!, slugs[6]!)}`;
    await page.goto(`${BASE}${path}`);
    // the layer boxes: a fieldset with its legend, the two links named in full
    expect(await page.textContent("form.motorway__filter fieldset.motorway__layers > legend")).toBe("Zeigen");
    expect(await page.getAttribute("a.motorway__layernone", "aria-label")).toBe("Keine – alle Ebenen abwählen");
    expect(await page.getAttribute("a.motorway__layerall", "aria-label")).toBe("Alle Ebenen auswählen");
    await Promise.all([page.waitForNavigation(), page.click("a.motorway__layernone")]);
    const u = new URL(page.url());
    expect(u.pathname).toBe(path);
    expect(u.search).toBe("?f=1");
    expect(await page.textContent("p.motorway__nolayer")).toBe("Keine Ebene gewählt – wählen Sie oben, was gezeigt werden soll. Alle");
    expect(await page.$$eval("form.motorway__filter input[name=layer]:checked", (b) => b.length)).toBe(0);
    // the counts line still counts the whole road
    expect(await page.textContent("#motorway-main .motorway__counts")).toMatch(/Sperrung/);
    expect(await page.$("#mwk-closures")).toBeNull();
    // the stretch is still chosen in the selectors
    expect(await page.$eval("form.motorway__filter select[name=from]", (x) => (x as HTMLSelectElement).value)).toBe(slugs[1]);
    // JavaScript off: the box sends nothing by itself, the <noscript> Anzeigen does (owner 2026-10-27: no Apply button with scripts on)
    await page.check("form.motorway__filter input[name=layer][value=events]");
    await Promise.all([page.waitForNavigation(), page.click("form.motorway__filter button[type=submit]")]);
    expect(new URL(page.url()).searchParams.getAll("layer")).toEqual(["events"]);
    expect(await page.$("p.motorway__nolayer")).toBeNull();
    expect(await page.$("#mwk-closures")).not.toBeNull();
    expect(await page.$("#mwk-parking")).toBeNull();
    // "Alle" brings every layer back on the same stretch
    await Promise.all([page.waitForNavigation(), page.click("a.motorway__layerall")]);
    expect(new URL(page.url()).pathname).toBe(path);
    expect(new URL(page.url()).search).toBe("");
    expect(await page.$("#mwk-parking")).not.toBeNull();
    await ctx.close();
  });
});

// #983 review S2: a shared "Keine" link (?f=1) opened WITH JavaScript. The page has none of the layers' cards, so the
// type bar cannot offer them; the form's own layer boxes stay shown and live, and the hint carries "Alle" — either way
// the layers come back on the same stretch, and the radius in the address is kept.
describe("#983 review: ?f=1 with JavaScript on", () => {
  it("the hint's 'Alle' brings every layer back on the same stretch, keeping ?r=; the boxes are usable and Anzeigen keeps the stretch", async () => {
    const { ctx, page } = await open(motorwayPath("de", "A7"), { js: false });
    const slugs = await page.$$eval("form.motorway__filter select[name=from] option", (o) => o.map((x) => (x as HTMLOptionElement).value).filter((v) => v !== ""));
    await ctx.close();
    const path = `${motorwayPath("de", "A7")}/${stretchSlug(slugs[1]!, slugs[6]!)}`;
    // with the visitor's position, so the radius is in use and ?r= stays in the address
    const { ctx: c2, page: p2 } = await open(`${path}?f=1&r=50`, { pos: true });
    await p2.waitForSelector("#mwf:not([hidden])");
    await p2.waitForFunction(() => document.querySelector("#motorway-main .motorway__shown")?.textContent?.includes("50 km") === true);
    // the hint, with its way out
    expect(await p2.textContent("p.motorway__nolayer")).toBe("Keine Ebene gewählt – wählen Sie oben, was gezeigt werden soll. Alle");
    // the form's layer boxes are shown and live (the bar cannot offer layers whose cards the page does not hold)
    expect(await p2.isVisible("form.motorway__filter fieldset.motorway__layers")).toBe(true);
    expect(await p2.$$eval("form.motorway__filter .motorway__layers input", (is) => is.every((i) => !(i as HTMLInputElement).disabled))).toBe(true);
    // #982/#983 review: the HREF already carries the radius — a middle click or "open in new tab" follows it with no click event
    expect(new URL((await p2.getAttribute("p.motorway__nolayer a.motorway__layerall", "href"))!, BASE).searchParams.get("r")).toBe("50");
    // what the middle button followed is the new tab's own navigation request (as below for the click: `nav[0]`)
    const opened: string[] = [];
    const onReq = (r: { isNavigationRequest: () => boolean; url: () => string }): void => void (r.isNavigationRequest() && opened.push(r.url()));
    c2.on("request", onReq);
    const [tab] = await Promise.all([c2.waitForEvent("page"), p2.click("p.motorway__nolayer a.motorway__layerall", { button: "middle" })]);
    await tab.waitForLoadState("load");
    c2.off("request", onReq);
    expect(new URL(opened[0]!).pathname).toBe(path);
    expect(new URL(opened[0]!).searchParams.get("r")).toBe("50");
    await tab.close();
    // the link the visitor follows: the same stretch, every layer, and the radius of the address it was followed from
    const nav: string[] = [];
    p2.on("request", (r) => { if (r.isNavigationRequest()) nav.push(r.url()); });
    await Promise.all([p2.waitForURL((u) => u.search !== "?f=1&r=50"), p2.click("p.motorway__nolayer a.motorway__layerall")]);
    const u = new URL(nav[0]!);
    expect(u.pathname).toBe(path);
    expect(u.searchParams.get("f")).toBeNull();
    expect(u.searchParams.get("r")).toBe("50");
    expect(new URL(p2.url()).pathname).toBe(path);
    await p2.waitForSelector("#mwk-parking");
    expect(await p2.$("p.motorway__nolayer")).toBeNull();
    await c2.close();
    // and in the empty state with no position in use (the selectors then keep the address's stretch): one box and
    // its change bring that layer back, on the same stretch
    const { ctx: c3, page: p3 } = await open(`${path}?f=1`);
    await p3.waitForSelector("#mwf:not([hidden])");
    await Promise.all([p3.waitForURL((x) => x.searchParams.getAll("layer").length > 0), p3.check("form.motorway__filter input[name=layer][value=events]")]);
    expect(new URL(p3.url()).pathname).toBe(path);
    expect(new URL(p3.url()).searchParams.getAll("layer")).toEqual(["events"]);
    await p3.waitForSelector("#mwk-closures");
    expect(await p3.$("#mwk-parking")).toBeNull();
    await c3.close();
  });
});
