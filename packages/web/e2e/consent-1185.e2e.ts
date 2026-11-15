/**
 * #1185 (data-steward ruling 2026-11-04), R1–R5 in a real Chromium against the BUILT server, with a tag:
 *   - R1: with a frozen clock, a refusal is not asked again on day 179 and is on day 180; a consent not on day 364 and
 *     is on day 365; Escape stores a refusal, and leaving the page without a decision stores nothing;
 *   - R2: what is stored matches `^(granted|denied)\|\d{4}-\d{2}-\d{2}$`, and the value is in no outgoing request (URL,
 *     header or body), the page's own and Google's alike;
 *   - R3: the footer's "Privacy settings" link on every page of the map opens the dialog with the current decision
 *     and its day, and changes it in both directions;
 *   - R4: "agree" on a page without analytics (a place page, the Impressum) stores it and makes NO request to
 *     googletagmanager.com or clarity.ms; on /de it does; "decline" expires the cookies;
 *   - R5: the two buttons have the same computed style in light and dark, the same focus outline, work from the
 *     keyboard, and axe finds nothing serious or critical in the open dialog.
 * The pure intervals are `test/consent-store-1185.test.ts`; the render sweep is `test/consent-settings-1185.test.ts`.
 * Linux only, like every browser suite here (the laptop is macOS).
 */
import type { ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { AxeBuilder } from "@axe-core/playwright";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startShell } from "./server.js";
import { startStubDigest } from "./stub-digest.js";
import { placePath } from "../src/site/places.js";

const ID = { IMPRESSUM_NAME: "Consent Probe", IMPRESSUM_STREET: "Probeweg 3", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "consent@example.invalid" };
const PORT = 8871;
const KEY = "viafrei.consent.analytics";
const FORM = /^(granted|denied)\|\d{4}-\d{2}-\d{2}$/u;
const BAR = ".consent[role=dialog]";
const ACCEPT = '.consent__actions [data-vf-consent="granted"]';
const DECLINE = '.consent__actions [data-vf-consent="denied"]';
const SETTINGS = "footer a[data-vf-consent-settings]";
const THIRD_PARTY = /googletagmanager\.com|google-analytics\.com|clarity\.ms/u;
/** The decision's day, at noon UTC. */
const DECIDED = Date.parse("2026-01-10T12:00:00.000Z");
const day = (n: number): number => DECIDED + n * 86_400_000;

let shell: ChildProcess | undefined;
let stub: Awaited<ReturnType<typeof startStubDigest>>;
let browser: Browser;
const url = (path: string): string => `http://127.0.0.1:${String(PORT)}${path}`;

beforeAll(async () => {
  stub = await startStubDigest({});
  shell = await startShell(PORT, { ...ID, DIGEST_URL: stub.url, GOOGLE_TAG: "G-0" });
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await stub?.close();
});

/** A context whose clock is frozen at `now`, holding `stored` (or nothing), with Google's origins answered by nothing. */
async function at(now: number, stored: string | null, scheme: "light" | "dark" = "light"): Promise<{ ctx: BrowserContext; page: Page; thirdParty: string[]; requests: string[] }> {
  const ctx = await browser.newContext({ colorScheme: scheme });
  if (stored !== null) await ctx.addInitScript(([k, v]) => window.localStorage.setItem(k, v), [KEY, stored] as const);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(now);
  const thirdParty: string[] = [];
  const requests: string[] = [];
  page.on("request", (r) => {
    requests.push(`${r.url()}\n${JSON.stringify(r.headers())}\n${r.postData() ?? ""}`);
    if (THIRD_PARTY.test(r.url())) thirdParty.push(r.url());
  });
  await page.route(THIRD_PARTY, (r) => void r.fulfill({ status: 204, body: "" }));
  return { ctx, page, thirdParty, requests };
}

const barOpen = async (page: Page): Promise<boolean> => {
  await page.waitForLoadState("networkidle");
  return (await page.$(BAR)) !== null;
};
const stored = (page: Page): Promise<string | null> => page.evaluate((k) => window.localStorage.getItem(k), KEY);

describe("R1: the bar asks again on day 180 after a refusal and on day 365 after a consent, never earlier", () => {
  for (const [decision, standsOn, asksOn] of [["denied", 179, 180], ["granted", 364, 365]] as const) {
    it(`${decision}: no bar on day ${String(standsOn)}, the bar on day ${String(asksOn)}`, async () => {
      const value = `${decision}|2026-01-10`;
      const before = await at(day(standsOn), value);
      await before.page.goto(url("/de/connect"));
      expect(await barOpen(before.page)).toBe(false);
      await before.ctx.close();
      const after = await at(day(asksOn), value);
      await after.page.goto(url("/de/connect"));
      await after.page.waitForSelector(BAR, { state: "visible" });
      await after.ctx.close();
    });
  }

  it("Escape is a refusal and is stored; leaving without a decision stores nothing", async () => {
    const a = await at(day(0), null);
    await a.page.goto(url("/de/connect"));
    await a.page.waitForSelector(BAR, { state: "visible" });
    await a.page.goto(url("/de/business")); // left without a decision
    expect(await stored(a.page)).toBeNull();
    await a.page.waitForSelector(BAR, { state: "visible" });
    await a.page.keyboard.press("Escape");
    expect(await a.page.$(BAR)).toBeNull();
    expect(await stored(a.page)).toBe("denied|2026-01-10");
    expect(a.thirdParty).toEqual([]);
    await a.ctx.close();
  });
});

describe("R2: what is stored, and that it goes nowhere", () => {
  it("each decision writes the decision and the UTC day only, and no request carries it", async () => {
    for (const button of [ACCEPT, DECLINE]) {
      const a = await at(day(0), null);
      await a.page.goto(url("/de/connect"));
      await a.page.waitForSelector(BAR, { state: "visible" });
      await a.page.click(button);
      const v = await stored(a.page);
      expect(v).toMatch(FORM);
      await a.page.goto(url("/de/developers"), { waitUntil: "networkidle" });
      expect(a.requests.length).toBeGreaterThan(0);
      for (const r of a.requests) expect(r).not.toContain(v ?? "\u0000");
      await a.ctx.close();
    }
  });
});

describe("R3/R4: the settings dialog", () => {
  for (const path of [placePath("de", "koeln"), "/impressum"]) it(`${path}, a page without analytics: agree is stored and loads nothing; the state sentence names it with its day`, async () => {
    const a = await at(day(0), null);
    await a.page.goto(url(path), { waitUntil: "networkidle" });
    expect(await a.page.$(BAR)).toBeNull(); // it never opens by itself
    await a.page.click(SETTINGS);
    await a.page.waitForSelector(BAR, { state: "visible" });
    expect(await a.page.textContent("#vf-consent-current")).toBe("Sie haben noch keine Entscheidung getroffen.");
    await a.page.click(ACCEPT);
    expect(await stored(a.page)).toBe("granted|2026-01-10");
    await a.page.waitForTimeout(500);
    expect(a.thirdParty).toEqual([]);
    expect(await a.page.evaluate(() => typeof (window as { gtag?: unknown }).gtag)).toBe("undefined");
    await a.page.click(SETTINGS);
    expect(await a.page.textContent("#vf-consent-current")).toBe("Ihre aktuelle Entscheidung: eingewilligt am 10. Januar 2026.");
    await a.ctx.close();
  });

  it("on /de, a measured page, the same agree loads the tag (the rule is not vacuous)", async () => {
    const a = await at(day(0), null);
    await a.page.goto(url("/de"));
    await a.page.waitForSelector(BAR, { state: "visible" });
    await a.page.click(ACCEPT);
    await expect.poll(() => a.thirdParty.some((u) => u.includes("googletagmanager.com"))).toBe(true);
    await a.ctx.close();
  });

  it("decline from the dialog stores the refusal and expires the GA and Clarity cookies", async () => {
    const a = await at(day(3), "granted|2026-01-10");
    await a.ctx.addCookies([
      { name: "_ga", value: "GA1.1.1.1", url: url("/") },
      { name: "_ga_ABC123", value: "GS1.1.1", url: url("/") },
      { name: "_clck", value: "x", url: url("/") },
      { name: "_clsk", value: "y", url: url("/") },
      { name: "theme", value: "keep", url: url("/") },
    ]);
    await a.page.goto(url("/datenschutz"), { waitUntil: "networkidle" });
    await a.page.click(SETTINGS);
    expect(await a.page.textContent("#vf-consent-current")).toBe("Ihre aktuelle Entscheidung: eingewilligt am 10. Januar 2026.");
    await a.page.click(DECLINE);
    expect(await stored(a.page)).toBe("denied|2026-01-13");
    expect((await a.ctx.cookies()).map((c) => c.name).sort()).toEqual(["theme"]);
    await a.ctx.close();
  });

  it("the fuel board runs no script: its link goes to the Datenschutz anchor, which opens the dialog", async () => {
    const a = await at(day(0), "denied|2026-01-10");
    await a.page.goto(url("/de/fuel"), { waitUntil: "networkidle" });
    const href = await a.page.getAttribute(SETTINGS, "href");
    expect(href).toBe("/datenschutz#datenschutz-einstellungen");
    await a.page.click(SETTINGS);
    await a.page.waitForSelector(BAR, { state: "visible" });
    expect(await a.page.textContent("#vf-consent-current")).toBe("Ihre aktuelle Entscheidung: abgelehnt am 10. Januar 2026.");
    await a.ctx.close();
  });

  it("every page of the map carries the link once", async () => {
    const routes = readFileSync(new URL("../../../scripts/site-pages.txt", import.meta.url), "utf8")
      .split("\n")
      .filter((l) => l.trim() !== "" && !l.startsWith("#"))
      .map((l) => l.split(/\s+/u))
      .filter((c) => (c[3] ?? "").split(",").some((f) => f === "page" || f === "identity"))
      .map((c) => c[0] ?? "");
    expect(routes.length).toBeGreaterThan(15);
    // the map also lists files (the sitemaps, robots.txt, llms.txt, /.well-known/…): a page is what answers HTML, and
    // every route answers — a 503 carries no footer and would hide a missing link behind a missing page
    let pages = 0;
    for (const r of routes) {
      const res = await fetch(url(r));
      expect(res.status, r).toBe(200);
      const html = await res.text();
      if (!(res.headers.get("content-type") ?? "").startsWith("text/html")) continue;
      pages++;
      expect([...html.matchAll(/data-vf-consent-settings/gu)].length, r).toBe(1);
    }
    expect(pages).toBeGreaterThan(routes.length - 15);
  });
});

describe("R5: two buttons alike, keyboard and axe", () => {
  for (const scheme of ["light", "dark"] as const) {
    it(`${scheme}: the same computed style and focus outline; Tab reaches both; axe finds nothing serious`, async () => {
      const a = await at(day(0), null, scheme);
      await a.page.goto(url("/de/connect"));
      await a.page.waitForSelector(BAR, { state: "visible" });
      const style = (sel: string): Promise<Record<string, string>> =>
        a.page.$eval(sel, (b) => {
          const s = getComputedStyle(b);
          return Object.fromEntries(["color", "background-color", "border", "font-size", "font-weight", "padding", "height", "border-radius", "text-decoration"].map((p) => [p, s.getPropertyValue(p)]));
        });
      expect(await style(DECLINE)).toEqual(await style(ACCEPT));
      const outline = async (sel: string): Promise<string> => {
        await a.page.focus(sel);
        return a.page.$eval(sel, (b) => { const s = getComputedStyle(b); return `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor} ${s.outlineOffset}`; });
      };
      expect(await outline(DECLINE)).toBe(await outline(ACCEPT));
      // the accept button has the focus when the bar opens; Shift+Tab reaches decline and Enter presses it
      await a.page.focus(ACCEPT);
      await a.page.keyboard.press("Shift+Tab");
      expect(await a.page.evaluate(() => document.activeElement?.getAttribute("data-vf-consent"))).toBe("denied");
      const r = await new AxeBuilder({ page: a.page }).include(BAR).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
      await a.page.keyboard.press("Enter");
      expect(await stored(a.page)).toBe("denied|2026-01-10");
      await a.ctx.close();
    });
  }
});
