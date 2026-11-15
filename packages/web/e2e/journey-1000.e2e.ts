/**
 * #1000 (2.3.23), the owner's journey in a real browser against the BUILT shell and the REAL digest
 * (`real-digest.ts`): from a motorway to the motorway it crosses, to a town along it, to a neighbouring town, and
 * back to a motorway — each step one click, each showing its live state with its Stand, and the state a link carries
 * the state its target shows. Then a crawl of three hops from a motorway page and a place page: no link lands on a
 * missing or empty page, and no page is a dead end.
 *
 * The fixture's world (`real-digest.ts` `ALONG`): the A7 meets the A1 at its first junction, where the A1's one
 * closure lies (a red lamp); Köln lies along the A1 and the A3, Düsseldorf along the A3, Essen along none.
 */
import type { ChildProcess } from "node:child_process";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { motorwayPath } from "../src/site/motorways.js";
import { placePath } from "../src/site/places.js";
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

/** The colour of a lamp element's class (`mw-lamp--red` → red). */
const colourOf = (cls: string | null): string => /mw-lamp--(red|yellow|green|grey)/.exec(cls ?? "")?.[1] ?? "none";
/**
 * The main Ampel's lit lamp of a motorway page: the motorway's own (`#motorway-ampel`). Since #1188 an exit page also
 * carries the around block's place Ampel (`#vf-around #place-ampel`, the junction's surroundings, as on a station page),
 * a different scope — so the main one is found by its id, and every other lit lamp must be the around block's.
 */
const litAmpel = async (page: Page): Promise<string> => {
  const cls = await page.$$eval("#motorway-ampel .ampel__lamp.is-on", (xs) => xs.map((x) => x.getAttribute("class") ?? ""));
  expect(cls).toHaveLength(1);
  const others = await page.$$eval(".ampel__lamp.is-on", (xs) => xs.filter((x) => x.closest("#motorway-ampel") === null && x.closest("#vf-around") === null).length);
  expect(others, "a lit lamp outside the motorway's Ampel and the around block").toBe(0);
  return /ampel__lamp--(red|yellow|green|grey)/.exec(cls[0]!)?.[1] ?? "none";
};
/**
 * 2.4.8 (owner 2026-10-28, "one lamp per place"): a place page shows ONE lamp, the place Ampel; the Autobahn card no
 * longer carries its own "Ampel am Ort". The link's state (the worst lamp of the motorways a place is along) is still
 * the cities and neighbours cards' — a different scope, so the journey asserts the one lamp is there, not equality.
 */
const oneLamp = async (page: Page): Promise<void> => {
  expect(await page.locator("#pcard-motorways .pcard__links .mw-lamp").count()).toBe(0);
  expect(await page.locator("#place-ampel .ampel__lamp.is-on").count()).toBe(1);
};
/** A page shows a Stand (a time it was read at). */
const hasStand = async (page: Page): Promise<boolean> => /Stand \d\d:\d\d/.test(await page.innerText("main"));

/**
 * #1180 (owner 2026-11-06, the desktop dashboard): from 1024 px a road page's cards stand collapsed — their head, their
 * sources and one "alle N anzeigen" (or their own fold's summary) — so a reader opens the card first. Opens the one
 * holding `sel`, as a reader does; a phone, or a card that stands open, is left as it is.
 */
async function deskOpen(page: Page, sel: string): Promise<void> {
  await page.evaluate((s) => {
    const sec = document.querySelector(s)?.closest("[data-desk='folded'], [data-desk='native'], [data-desk='capped']");
    if (!sec) return;
    if (sec.getAttribute("data-desk") === "native") sec.querySelector<HTMLElement>(":scope > details.fold > summary")?.click();
    else document.querySelector<HTMLElement>(`.desk__more[aria-controls="${sec.id}"]`)?.click();
  }, sel);
}

describe("#1000: the owner's journey, one click a step, each target agreeing with the link that led there", () => {
  it("A7 → the A1 at the crossing (red) → Köln along the A1 → Düsseldorf next door → the A3 at Düsseldorf's exit", async () => {
    const page = await browser.newPage();
    try {
      // 1. the A7: its crossings card names the A1 at the AD, with the A1's own lamp there — red, the A1 is closed there
      await page.goto(`${BASE}${motorwayPath("de", "A7")}`, { waitUntil: "load" });
      expect(await hasStand(page)).toBe(true);
      await deskOpen(page, "#mwk-crossings");
      const cross = page.locator(`#mwk-crossings .mwc__other:has(a[href^="${motorwayPath("de", "A1")}/"])`).first();
      const crossLamp = colourOf(await cross.locator(".mw-lamp").getAttribute("class"));
      expect(crossLamp).toBe("red");

      // 2. one click: the A1 centred on that junction — its own Ampel lit the same colour, with its Stand
      await Promise.all([page.waitForURL(/\/de\/autobahn\/a1\/.+/), cross.locator(`a[href^="${motorwayPath("de", "A1")}/"]`).first().click()]);
      expect(await litAmpel(page)).toBe(crossLamp);
      expect(await hasStand(page)).toBe(true);

      // 3. one click: Köln, a town along the A1 — the cities card carries Köln's state, and Köln's page shows the same
      await deskOpen(page, "#mwk-cities");
      const city = page.locator(`#mwk-cities li:has(a[href="${placePath("de", "koeln")}"]), #mwk-cities .mwk__row:has(a[href="${placePath("de", "koeln")}"])`).first();
      const cityState = colourOf(await page.locator(`#mwk-cities .mwp-state .mw-lamp`).first().getAttribute("class"));
      await Promise.all([page.waitForURL(new RegExp(`${placePath("de", "koeln")}$`)), page.locator(`#mwk-cities a[href="${placePath("de", "koeln")}"]`).first().click()]);
      expect(await city.count()).toBe(0); // (we left the motorway page)
      expect(cityState).not.toBe("none");
      await oneLamp(page);
      await deskOpen(page, "#pcard-motorways");
      // review N2: on the PLACE page the lamp is a dot that is seen — styled, sized and coloured, not an empty span
      const dot = await page.$eval("#pcard-motorways .mw-lamp__dot", (d) => {
        const st = getComputedStyle(d);
        return { display: st.display, w: d.getBoundingClientRect().width, bg: st.backgroundColor };
      });
      expect(dot.display).toBe("inline-block");
      expect(dot.w).toBeGreaterThan(4);
      expect(dot.bg).not.toBe("rgba(0, 0, 0, 0)");
      // Köln's Autobahn card lists the A1 and the A3, each with its lamp, each exit a link to the centred page
      const rows = await page.$$eval("#pcard-motorways .pcard__list > li, #pcard-motorways li", (xs) => xs.map((x) => x.innerHTML));
      expect(rows.join("")).toMatch(/\/de\/autobahn\/a1\//);
      expect(rows.join("")).toMatch(/\/de\/autobahn\/a3\//);

      // 4. one click: Düsseldorf from the Nachbarorte card — the line's state is the state Düsseldorf's page shows
      await deskOpen(page, "#pcard-neighbours");
      const nb = page.locator(`#pcard-neighbours li:has(a[href="${placePath("de", "duesseldorf")}"])`).first();
      const nbState = colourOf(await nb.locator(".mw-lamp").getAttribute("class"));
      expect(nbState).not.toBe("none");
      await Promise.all([page.waitForURL(new RegExp(`${placePath("de", "duesseldorf")}$`)), nb.locator(`a[href="${placePath("de", "duesseldorf")}"]`).click()]);
      await oneLamp(page);
      expect(await hasStand(page)).toBe(true);

      // 5. one click: back to a motorway — the A3 centred on Düsseldorf's exit, its Ampel the row's lamp
      await deskOpen(page, "#pcard-motorways");
      const row = page.locator(`#pcard-motorways li:has(a[href^="${motorwayPath("de", "A3")}/"])`).first();
      const rowLamp = colourOf(await row.locator(".mw-lamp").first().getAttribute("class"));
      await Promise.all([page.waitForURL(/\/de\/autobahn\/a3\/.+/), row.locator(`a[href^="${motorwayPath("de", "A3")}/"]`).first().click()]);
      expect(await litAmpel(page)).toBe(rowLamp);
      expect(await hasStand(page)).toBe(true);
    } finally {
      await page.close();
    }
  });
});

/** The internal links of a body that lead to a motorway or a place page (the graph #1000 is about). */
const graphLinks = (body: string): string[] =>
  [...new Set([...body.matchAll(/href="(\/de\/(?:autobahn|place)(?:\/[^"#?]*)?)"/g)].map((m) => m[1]!))].filter((h) => !h.endsWith("/fuel"));

describe("#1000: three hops from a motorway page and a place page", () => {
  it("finds no missing page, no empty page and no dead end", async () => {
    const seen = new Map<string, { status: number; links: number; empty: boolean }>();
    let frontier: string[] = [motorwayPath("de", "A7"), placePath("de", "koeln")];
    for (let hop = 0; hop <= 3 && frontier.length > 0; hop++) {
      const next: string[] = [];
      // a few at a time: the fixture digest renders each page in full
      for (let k = 0; k < frontier.length; k += 8) {
        await Promise.all(
          frontier.slice(k, k + 8).map(async (path) => {
            if (seen.has(path)) return;
            const r = await fetch(`${BASE}${path}`, { redirect: "manual" });
            const body = r.status === 200 ? await r.text() : "";
            const links = graphLinks(body);
            const empty = r.status === 200 && !/class="(?:lead motorway__intro|pcard |motorway-index)/.test(body) && !/id="pcard-/.test(body);
            seen.set(path, { status: r.status, links: links.length, empty });
            if (hop < 3) for (const l of links) if (!seen.has(l)) next.push(l);
          }),
        );
      }
      frontier = [...new Set(next)];
    }
    const pages = [...seen];
    // it read the graph: motorways, centred junction pages and towns, not just the two start pages
    expect(pages.length).toBeGreaterThan(20);
    expect(pages.some(([p]) => /^\/de\/autobahn\/a\d+\/.+/.test(p))).toBe(true);
    expect(pages.filter(([p]) => p.startsWith("/de/place/")).length).toBeGreaterThanOrEqual(3);
    expect(pages.filter(([, v]) => v.status !== 200).map(([p, v]) => `${p} ${String(v.status)}`)).toEqual([]);
    expect(pages.filter(([, v]) => v.empty).map(([p]) => p)).toEqual([]);
    expect(pages.filter(([, v]) => v.links === 0).map(([p]) => p)).toEqual([]);
  }, 600_000);
});
