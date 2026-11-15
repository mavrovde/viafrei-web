/**
 * #1050 against the REAL built shell and a stand-in digest that answers every place with every card in the digest's
 * shape: the topic filter on a place page and on the home — with JavaScript OFF the GET form filters ("Keine" says
 * so and leads back, "Alle" shows all), with it ON a tick applies at once, the address follows without a reload, the
 * back button restores the choice before and a shared address opens filtered. A hidden warning stays named. Nothing
 * is stored before "merken", and the retired Mein Tag key is removed. In de, en and tr.
 */
import type { ChildProcess } from "node:child_process";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startShell } from "./server.js";
import { STUB_CARD_IDS, startStubDigest } from "./stub-digest.js";

const PORT = 8902;
const BASE = `http://127.0.0.1:${String(PORT)}`;
let browser: Browser;
let shell: ChildProcess;
let stub: Awaited<ReturnType<typeof startStubDigest>>;

beforeAll(async () => {
  stub = await startStubDigest({}, 5000, { fullCards: true });
  shell = await startShell(PORT, { DIGEST_URL: stub.url, WEB_TILE_TIMEOUT_MS: "2000" });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await stub?.close();
});

const shown = (page: Page): Promise<string[]> =>
  page.$$eval("#place-slot article.pcard", (cs) => cs.filter((c) => !(c as HTMLElement).hidden && getComputedStyle(c).display !== "none").map((c) => c.id.replace(/^pcard-/u, "")));

async function open(ctx: BrowserContext, path: string): Promise<Page> {
  const page = await ctx.newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForSelector("#place-slot .pcard", { state: "attached" });
  return page;
}

const NOTHING = { de: "Keine Themen gewählt.", en: null, tr: null } as const;

for (const lang of ["de", "en", "tr"] as const) {
  const PLACE = `/${lang}/place/berlin`;

  describe(`${lang}: with JavaScript OFF`, () => {
    it("every card shows; ticking two and sending the form shows those two (and names the hidden warning); Keine says so and leads back; Alle shows all", async () => {
      const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 420, height: 900 } });
      const page = await open(ctx, PLACE);
      expect(await shown(page)).toEqual([...STUB_CARD_IDS]);
      expect(await page.$$eval("#tpf input[name=topics]", (es) => es.map((e) => (e as HTMLInputElement).value))).toEqual([...STUB_CARD_IDS]);
      for (const id of STUB_CARD_IDS) if (id !== "fuel" && id !== "parking") await page.uncheck(`#tpf input[value=${id}]`);
      await Promise.all([page.waitForNavigation(), page.click("#tpf .tpf__apply")]);
      expect(new URL(page.url()).searchParams.getAll("topics").sort()).toEqual(["fuel", "parking"]);
      expect(await shown(page)).toEqual(["fuel", "parking"]);
      expect(await page.isVisible("#tpf-alerts .tpf__alert[data-topic=warnings]")).toBe(true);
      expect(await page.getAttribute('meta[name="robots"]', "content")).toBe("noindex, noarchive");
      await Promise.all([page.waitForNavigation(), page.click("#tpf .tpf__none")]);
      expect(await shown(page)).toEqual([]);
      expect(await page.isVisible("#tpf-nothing")).toBe(true);
      if (NOTHING[lang] !== null) expect((await page.textContent("#tpf-nothing"))?.trim()).toContain(NOTHING[lang]);
      await Promise.all([page.waitForNavigation(), page.click("#tpf-nothing .tpf__all")]);
      expect(new URL(page.url()).search).toBe("");
      expect(await shown(page)).toEqual([...STUB_CARD_IDS]);
      expect(await page.getAttribute('meta[name="robots"]', "content")).toBe("noarchive");
      await ctx.close();
    });
  });

  describe(`${lang}: with JavaScript ON`, () => {
    it("a tick applies at once and the address follows without a reload; back restores the choice before; Keine/Alle; nothing stored before merken", async () => {
      const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
      await ctx.addInitScript(() => {
        if (window.sessionStorage.getItem("planted") === null) {
          window.localStorage.setItem("viafrei.board", "parking");
          window.sessionStorage.setItem("planted", "1");
        }
      });
      const page = await open(ctx, PLACE);
      const requests: string[] = [];
      page.on("request", (r) => requests.push(r.url()));
      await page.evaluate(() => ((window as unknown as { marker: number }).marker = 42));
      expect(await page.evaluate(() => window.localStorage.getItem("viafrei.board"))).toBeNull();
      await page.uncheck("#tpf input[value=roads]");
      expect(await shown(page)).not.toContain("roads");
      expect(new URL(page.url()).searchParams.get("topics")?.split(",")).not.toContain("roads");
      await page.click("#tpf .tpf__none");
      expect(await shown(page)).toEqual([]);
      expect(new URL(page.url()).search).toBe("?f=1");
      expect(await page.isVisible("#tpf-nothing")).toBe(true);
      // the hidden warning is named, and its chip brings it back
      await page.click("#tpf-alerts .tpf__alert[data-topic=warnings]");
      expect(await shown(page)).toEqual(["warnings"]);
      expect(new URL(page.url()).searchParams.get("topics")).toBe("warnings");
      // back: the choice before ("Keine"), then the one before that (roads unticked)
      await page.goBack();
      expect(await shown(page)).toEqual([]);
      await page.goBack();
      expect(await shown(page)).toEqual(STUB_CARD_IDS.filter((x) => x !== "roads"));
      await page.click("#tpf .tpf__all");
      expect(await shown(page)).toEqual([...STUB_CARD_IDS]);
      expect(new URL(page.url()).search).toBe("");
      // all of it without one reload, and nothing stored
      expect(await page.evaluate(() => (window as unknown as { marker?: number }).marker)).toBe(42);
      expect(await page.evaluate(() => window.localStorage.getItem("viafrei.topics"))).toBeNull();
      expect(requests.filter((u) => u.includes("topics=") || u.includes("viafrei.topics"))).toEqual([]);
      // merken writes the choice; a fresh visit to the bare address uses it; vergessen removes it
      await page.click("#tpf .tpf__none");
      await page.click("#tpf .tpf__save");
      expect(await page.evaluate(() => window.localStorage.getItem("viafrei.topics"))).toBe("");
      await page.goto(`${BASE}${PLACE}`, { waitUntil: "networkidle" });
      expect(await shown(page)).toEqual([]);
      await page.click("#tpf .tpf__forget");
      expect(await page.evaluate(() => window.localStorage.getItem("viafrei.topics"))).toBeNull();
      await ctx.close();
    });

    it("a shared filtered address opens filtered, noindex, with the canonical of the page itself", async () => {
      const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } });
      const page = await open(ctx, `${PLACE}?topics=fuel,charging`);
      expect(await shown(page)).toEqual(["fuel", "charging"]);
      expect(await page.isChecked("#tpf input[value=fuel]")).toBe(true);
      expect(await page.isChecked("#tpf input[value=roads]")).toBe(false);
      expect(await page.getAttribute('meta[name="robots"]', "content")).toBe("noindex, noarchive");
      expect(await page.getAttribute('link[rel="canonical"]', "href")).toMatch(new RegExp(`${PLACE}$`));
      // the total is every card the page carries (#1117 turned one POI card into seven need cards), never a constant
      expect(await page.locator("#place-slot article.pcard").count()).toBe(STUB_CARD_IDS.length);
      const numbers = ((await page.textContent("#tpf-sum")) ?? "").match(/\d+/gu) ?? [];
      expect([...numbers].sort()).toEqual(["2", String(STUB_CARD_IDS.length)].sort());
      await ctx.close();
    });
  });
}

// #1117 AC4 in a person's browser: "In der Nähe" (`pois`) became the need cards. A choice stored or linked with the old
// id is read through to all of them — on with it, off without it — and the page writes nothing back on load.
describe("#1117: a stored or linked 'In der Nähe' choice opens the need cards, and nothing is rewritten on load", () => {
  const NEEDS = ["groceries", "health", "money", "food", "lodging", "garage", "police", "toilets"];
  const planted = async (value: string): Promise<{ ctx: BrowserContext; page: Page }> => {
    const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
    await ctx.addInitScript((v) => {
      if (window.sessionStorage.getItem("planted") === null) {
        window.localStorage.setItem("viafrei.topics", v);
        window.sessionStorage.setItem("planted", "1");
      }
    }, value);
    return { ctx, page: await open(ctx, "/de/place/berlin") };
  };

  it("stored with 'pois': every need card shows and is ticked, the stored value unchanged", async () => {
    const { ctx, page } = await planted("pois,roads");
    expect(await shown(page)).toEqual(STUB_CARD_IDS.filter((x) => x === "roads" || NEEDS.includes(x)));
    for (const id of NEEDS) expect(await page.isChecked(`#tpf input[value=${id}]`), id).toBe(true);
    expect(await page.isChecked("#tpf input[value=fuel]")).toBe(false);
    expect(await page.evaluate(() => window.localStorage.getItem("viafrei.topics")), "no write on load").toBe("pois,roads");
    await ctx.close();
  });

  it("stored without it: no need card shows, the stored value unchanged", async () => {
    const { ctx, page } = await planted("roads,fuel");
    expect(await shown(page)).toEqual(STUB_CARD_IDS.filter((x) => x === "roads" || x === "fuel"));
    for (const id of NEEDS) expect(await page.isChecked(`#tpf input[value=${id}]`), id).toBe(false);
    expect(await page.evaluate(() => window.localStorage.getItem("viafrei.topics")), "no write on load").toBe("roads,fuel");
    await ctx.close();
  });

  it("a shared address naming 'pois' opens the need cards and stores nothing", async () => {
    const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
    const page = await open(ctx, "/de/place/berlin?topics=pois");
    expect(await shown(page)).toEqual(STUB_CARD_IDS.filter((x) => NEEDS.includes(x)));
    expect(await page.evaluate(() => window.localStorage.getItem("viafrei.topics"))).toBeNull();
    await ctx.close();
  });
});

describe("the home", () => {
  it("at an emulated position the filter works on the live cards the position brought, and a filtered home is noindex with the home's canonical", async () => {
    const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, geolocation: { latitude: 50.9375, longitude: 6.9603, accuracy: 30 }, permissions: ["geolocation"] });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/de?topics=parking`, { waitUntil: "networkidle" });
    expect(await page.getAttribute('meta[name="robots"]', "content")).toBe("noindex, follow");
    expect(await page.getAttribute('link[rel="canonical"]', "href")).toMatch(/\/de$/);
    expect(await page.getAttribute('meta[http-equiv="refresh"]', "content")).toMatch(/;url=\?r=auto&topics=parking$/);
    // #1112: "use my location" is in the position bar, on the page — no window to open
    // #1177 (decision 3): a home that knows a place folds its bar on a phone; the person opens it first
    if (await page.locator("#place-open").isVisible()) await page.click("#place-open");
    await page.click("#place-geo");
    await page.waitForSelector("#place-slot .pcard", { state: "attached" });
    await page.waitForFunction(() => document.querySelectorAll("#tpf input[name=topics]").length > 0);
    expect(await shown(page)).toEqual(["parking"]);
    await page.check("#tpf input[value=charging]");
    expect(await shown(page)).toEqual(["parking", "charging"]);
    await ctx.close();
  });

  it("the unfiltered home carries no robots line and the plain refresh", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/de`, { waitUntil: "networkidle" });
    expect(await page.$('meta[name="robots"]')).toBeNull();
    expect(await page.getAttribute('meta[http-equiv="refresh"]', "content")).toMatch(/;url=\?r=auto$/);
    await ctx.close();
  });
});
