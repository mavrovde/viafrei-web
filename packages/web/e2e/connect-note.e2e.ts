/**
 * #1001 (owner 2026-10-24: "It should be clear that it will work only with
 * ViaFrei connected"): every example answer the site renders carries EXACTLY
 * ONE "works only with ViaFrei connected" note, read from the browser against
 * the BUILT shell, the REAL digest (the A7 at production's size) and a
 * stand-in for the MCP listener serving production's recorded answers — the
 * home, a place page, a motorway page, the examples, connect and business
 * pages, in German and in English.
 *
 * An example answer is any of the four answer bubbles: `.qa-answer` (the
 * moments, the live answers, the connect and business questions, the place
 * cards), `.answer__a` (a recorded answer card), `.motorway__answer` (the
 * motorway page's assistant block) and `.sign__a` (the hero's sign). A
 * `.qa-answer` is followed directly by its note; the others carry it inside
 * their unit. The count of notes equals the count of answers, so a note
 * without an answer is as red as an answer without one.
 *
 * And the note itself: its expansion opens and closes from the keyboard, its
 * summary has an accessible name, axe is clean with it open, its guide link
 * reaches `/<lang>/connect#clients`, and a click on it is `cta_connect_click`
 * with the surface as `source` — only after consent, as every event.
 *
 * #1003: every note carries exactly one endpoint chip; every assistant name
 * on a note links to an anchor that EXISTS on the connect page; the chip's
 * copy button puts the address on the clipboard in Chromium with a visible
 * and announced "copied" state, and the copy is `cta_connect_click` with
 * `where: "copy"` only after consent; without a script the button stays
 * hidden and the address is selectable text; and at 320 px the address never
 * breaks inside the host.
 */
import type { ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { AxeBuilder } from "@axe-core/playwright";
import type { Result } from "axe-core";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectClients } from "../src/site/connect-clients.js";
import { motorwayPath } from "../src/site/motorways.js";
import { pathFor } from "../src/site/pages.js";
import { placePath } from "../src/site/places.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";
import { gotoSettled } from "./settle.js";

const PORT = 8851;
const TAG_PORT = 8852;
const BASE = `http://127.0.0.1:${String(PORT)}`;
const TAGGED = `http://127.0.0.1:${String(TAG_PORT)}`;
/** A person's browser: a crawler (the headless default user agent) is asked nothing on a place page. */
const PERSON_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const ID = { IMPRESSUM_NAME: "Note Probe", IMPRESSUM_STREET: "Probeweg 6", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "note@example.invalid" };
const KOELN = "ags:05315000";

let browser: Browser;
const shells: ChildProcess[] = [];
let digest: Awaited<ReturnType<typeof startRealDigest>>;
let mcp: { url: string; close(): Promise<void> };

/** The MCP listener's stand-in: production's recorded site answers, and one local answer for Köln's place cards. */
async function startMcpStub(): Promise<{ url: string; close(): Promise<void> }> {
  const recorded = JSON.parse(readFileSync(new URL("../test/fixtures/asks.json", import.meta.url), "utf8")) as { examples: { askedAt: string; projection: { asOf: string } }[] };
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "stub:/");
    const at = new Date(Date.now() - 4 * 60_000).toISOString();
    if (url.pathname === "/internal/examples") {
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ examples: recorded.examples.map((e) => ({ ...e, askedAt: at, projection: { ...e.projection, asOf: at } })) }));
      return;
    }
    if (url.pathname === "/internal/examples/local" && url.searchParams.get("at") === KOELN) {
      const parking = { key: "parking", tool: "find_parking", askedAt: at, projection: { variant: "unpublished", values: {}, names: { place: "Köln" }, asOf: at, attribution: "Parkhäuser: Stadt Köln", sources: ["koeln_parkhaeuser"] } };
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ answers: [parking] }));
      return;
    }
    res.writeHead(404, { "content-type": "application/json" }).end("{}");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  return { url: `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`, close: () => new Promise<void>((r) => server.close(() => r())) };
}

beforeAll(async () => {
  digest = await startRealDigest();
  mcp = await startMcpStub();
  shells.push(await startShell(PORT, { ...ID, DIGEST_URL: digest.url, MCP_INTERNAL_URL: mcp.url, WEB_TILE_TIMEOUT_MS: "2000" }));
  shells.push(await startShell(TAG_PORT, { ...ID, DIGEST_URL: digest.url, MCP_INTERNAL_URL: mcp.url, WEB_TILE_TIMEOUT_MS: "2000", GOOGLE_TAG: "G-0" }));
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  for (const s of shells) s.kill();
  await digest?.close();
  await mcp?.close();
});

type Inventory = {
  readonly answers: number;
  readonly notes: number;
  readonly bad: readonly string[];
  readonly hrefs: readonly string[];
  readonly sources: readonly string[];
  /** #1003: notes that do not carry exactly one endpoint chip, and every chip's address. */
  readonly chipless: number;
  readonly addresses: readonly string[];
};

/** Every answer bubble on the page and the note each carries — the rule, evaluated in the page. */
const INVENTORY = String.raw`(() => {
  const bad = [];
  const answers = Array.from(document.querySelectorAll(".qa-answer, .answer__a, .motorway__answer, .sign__a"));
  for (const a of answers) {
    const what = a.className + " " + (a.textContent || "").trim().slice(0, 40);
    if (a.matches(".qa-answer")) {
      const n = a.nextElementSibling;
      if (n === null || !n.matches(".connect-note")) bad.push(what + " → " + (n === null ? "nothing" : n.tagName + "." + n.className));
      continue;
    }
    const unit = a.closest(".answer__talk, .motorway__examples > li, figure.sign");
    const count = unit === null ? 0 : unit.querySelectorAll(".connect-note").length;
    if (count !== 1) bad.push(what + " → " + count + " notes in its unit");
  }
  // #1006 put the fragment's note under the place cards' QUESTIONS too (a question with no answer bubble), so the
  // answers' notes are the shell's <details> and the motorway examples' — and every note of either kind carries a chip
  const all = Array.from(document.querySelectorAll(".connect-note"));
  const notes = all.filter((n) => n.matches("details.connect-note") || n.closest(".motorway__examples") !== null);
  const links = all.flatMap((n) => Array.from(n.querySelectorAll("a[data-cta-source]")));
  const chips = all.flatMap((n) => Array.from(n.querySelectorAll(".endpoint-chip")));
  return {
    answers: answers.length,
    notes: notes.length,
    bad,
    hrefs: [...new Set(links.map((l) => l.getAttribute("href")))],
    sources: [...new Set(links.concat(chips).map((l) => l.getAttribute("data-cta-source")))],
    chipless: all.filter((n) => n.querySelectorAll(".endpoint-chip").length !== 1).length,
    addresses: [...new Set(chips.map((c) => (c.querySelector("code") || {}).textContent))],
  };
})()`;

async function visit(ctx: BrowserContext, path: string, base = BASE): Promise<Page> {
  const page = await ctx.newPage();
  const r = await gotoSettled(page, `${base}${path}`);
  expect(r?.status(), path).toBe(200);
  return page;
}

describe("#1001 inventory: every rendered example answer carries exactly one note", () => {
  const surfaces = (lang: "de" | "en") =>
    [
      // 29 since #990 (2.4.2): the deleted "Heute" block's live answer is the commute moment's own now, not a second copy —
      // nine moments (28 answers) and the hero sign
      [pathFor("start", lang), ["home"], 29],
      [placePath(lang, "koeln"), ["place"], 1],
      [motorwayPath(lang, "A7"), ["motorway"], 1],
      [pathFor("examples", lang), ["examples"], 20],
      [pathFor("connect", lang), ["connect"], 10],
      [pathFor("business", lang), ["business"], 6],
    ] as const;
  for (const lang of ["de", "en"] as const) {
    for (const [path, sources, min] of surfaces(lang)) {
      it(`${path}: answers and notes are equal, each answer carries its own, the link is /${lang}/connect#clients and the surface is ${sources.join(", ")}`, async () => {
        const ctx = await browser.newContext({ userAgent: PERSON_UA, viewport: { width: 1280, height: 900 } });
        try {
          const page = await visit(ctx, path);
          const inv = await page.evaluate<Inventory>(INVENTORY);
          expect(inv.bad, path).toEqual([]);
          expect(inv.answers, path).toBeGreaterThanOrEqual(min);
          expect(inv.notes, path).toBe(inv.answers);
          // the guide, and (in the shell's expansion) one link per assistant — every one to the connect page of this language
          expect(inv.hrefs, path).toContain(`/${lang}/connect#clients`);
          for (const h of inv.hrefs) expect(h, path).toMatch(new RegExp(`^/${lang}/connect#(clients|client-[a-z-]+)$`, "u"));
          expect(inv.sources, path).toEqual(sources);
          // #1003: every note carries the endpoint chip, and every chip says the one address
          expect(inv.chipless, path).toBe(0);
          expect(inv.addresses, path).toEqual(["https://mcp.viafrei.de/mcp"]);
        } finally {
          await ctx.close();
        }
      });
    }
  }
});

describe("#1001 the expansion", () => {
  it("opens and closes from the keyboard, and its summary has an accessible name; the guide link reaches /de/connect#clients", async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
    try {
      const page = await visit(ctx, pathFor("business", "de"));
      const summary = page.locator(".connect-note__summary").first();
      const note = page.locator("details.connect-note").first();
      await summary.focus();
      expect(await note.evaluate((d) => (d as HTMLDetailsElement).open)).toBe(false);
      await page.keyboard.press("Enter");
      expect(await note.evaluate((d) => (d as HTMLDetailsElement).open)).toBe(true);
      expect(await note.locator(".endpoint-chip__url").textContent()).toBe("https://mcp.viafrei.de/mcp");
      expect(await note.locator(".connect-note__clients a").count()).toBe(8);
      await page.keyboard.press("Space");
      expect(await note.evaluate((d) => (d as HTMLDetailsElement).open)).toBe(false);
      await page.keyboard.press("Space");
      expect(await note.evaluate((d) => (d as HTMLDetailsElement).open)).toBe(true);
      // the accessible name: the note's sentence and the link's words, never an empty control
      const name = await summary.evaluate((s) => (s.textContent ?? "").replace(/\s+/g, " ").trim());
      expect(name).toContain("Diese Antwort gibt Ihr KI-Assistent nur, wenn ViaFrei verbunden ist.");
      expect(name).toContain("So verbinden Sie ViaFrei");
      // Tab from the open summary reaches the guide link, and Enter follows it
      for (let i = 0; i < 14; i++) {
        await page.keyboard.press("Tab");
        if (await page.evaluate(() => document.activeElement?.classList.contains("connect-note__guide") === true)) break;
      }
      expect(await page.evaluate(() => document.activeElement?.getAttribute("href"))).toBe("/de/connect#clients");
      await Promise.all([page.waitForURL(/\/de\/connect#clients$/), page.keyboard.press("Enter")]);
      expect(await page.locator("#clients").count()).toBe(1);
    } finally {
      await ctx.close();
    }
  });

  for (const path of [pathFor("start", "de"), pathFor("connect", "en"), motorwayPath("de", "A7"), placePath("de", "koeln")]) {
    it(`${path}: axe is clean with every note open (light and dark)`, async () => {
      for (const scheme of ["light", "dark"] as const) {
        const ctx = await browser.newContext({ userAgent: PERSON_UA, viewport: { width: 390, height: 900 }, colorScheme: scheme });
        try {
          const page = await visit(ctx, path);
          await page.evaluate(() => document.querySelectorAll("details.connect-note").forEach((d) => ((d as HTMLDetailsElement).open = true)));
          const r = await new AxeBuilder({ page }).include(".connect-note").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
          const bad = r.violations.filter((v: Result) => v.impact === "serious" || v.impact === "critical").map((v: Result) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
          expect(bad, `${path} ${scheme}`).toEqual([]);
          // a summary is a control: 44 px tall at a phone's width (a11y.e2e.ts's target rule)
          const small = await page.$$eval(".connect-note__summary", (els) => els.filter((e) => (e as HTMLElement).offsetParent !== null && e.getBoundingClientRect().height < 43.5).length);
          expect(small, path).toBe(0);
        } finally {
          await ctx.close();
        }
      }
    });
  }
});

describe("#1001 analytics: cta_connect_click with the surface, behind consent", () => {
  type Layer = readonly { first: unknown; second: unknown; third: Record<string, unknown> | null }[];
  const layerOf = (page: Page): Promise<Layer> =>
    page.evaluate(() =>
      ((window as unknown as { dataLayer?: unknown[] }).dataLayer ?? []).map((e) => {
        const a = e as ArrayLike<unknown>;
        return { first: a[0], second: a[1], third: (a[2] as Record<string, unknown> | undefined) ?? null };
      }),
    );
  /** Click the first note's guide link without leaving the page (the listener runs on `document`, before this one on `window`). */
  const clickGuide = async (page: Page): Promise<void> => {
    await page.evaluate(() => {
      window.addEventListener("click", (e) => e.preventDefault());
      document.querySelectorAll("details.connect-note").forEach((d) => ((d as HTMLDetailsElement).open = true));
    });
    await page.locator(".connect-note a[data-cta-source]").first().dispatchEvent("click");
  };
  for (const [path, source] of [
    [pathFor("start", "de"), "home"],
    [pathFor("connect", "en"), "connect"],
    [pathFor("business", "de"), "business"],
    [motorwayPath("de", "A7"), "motorway"],
  ] as const) {
    it(`${path}: nothing before consent; after it, the click is cta_connect_click { where: note, source: ${source} }`, async () => {
      const ctx = await browser.newContext({ userAgent: PERSON_UA, viewport: { width: 1280, height: 900 } });
      await ctx.route(/https:\/\/([a-z0-9-]+\.)*(googletagmanager|google-analytics|analytics\.google)\.com\/.*/, (route) => void route.fulfill({ status: 200, contentType: "application/javascript", body: "/* intercepted */" }));
      try {
        const page = await visit(ctx, path, TAGGED);
        await page.waitForSelector(".consent[role=dialog]", { state: "visible" });
        await clickGuide(page);
        expect((await layerOf(page)).filter((e) => e.first === "event")).toEqual([]);
        await page.click(".consent__actions .btn:last-child"); // accept
        await page.waitForFunction(() => (window as unknown as { vfAnalytics?: boolean }).vfAnalytics === true);
        await page.locator(".connect-note a[data-cta-source]").first().dispatchEvent("click");
        const clicks = (await layerOf(page)).filter((e) => e.first === "event" && e.second === "cta_connect_click");
        const lang = path.split("/")[1];
        expect(clicks.map((e) => e.third)).toEqual([{ lang, where: "note", surface: source }]);
      } finally {
        await ctx.close();
      }
    });
  }
});

describe("#1003 the assistants: every name on a note links to an anchor that exists on the connect page", () => {
  for (const lang of ["de", "en"] as const) {
    it(`${lang}: the eight names, each to /${lang}/connect#client-…, each anchor a client block there`, async () => {
      const ctx = await browser.newContext({ userAgent: PERSON_UA, viewport: { width: 1280, height: 900 } });
      try {
        const page = await visit(ctx, pathFor("business", lang));
        const names = await page
          .locator("details.connect-note")
          .first()
          .locator(".connect-note__clients a")
          .evaluateAll((as) => as.map((a) => [a.textContent ?? "", a.getAttribute("href") ?? ""] as const));
        expect(names.map(([n]) => n)).toEqual(["Claude", "ChatGPT", "GitHub Copilot", "Cursor", "Gemini CLI", "Windsurf", "Codex", "Le Chat"]);
        const connect = await visit(ctx, pathFor("connect", lang));
        for (const [name, href] of names) {
          const [path, hash] = href.split("#");
          expect(path, name).toBe(pathFor("connect", lang));
          const target = connect.locator(`[id="${hash ?? ""}"]`);
          expect(await target.count(), `${name} → #${hash ?? ""}`).toBe(1);
          expect(await target.evaluate((e) => e.tagName + "." + e.className), name).toBe("DETAILS.client");
        }
        // Copilot's block carries the sandbox note; no block shows a logo — the only images are the real captures the page
        // wires (#1090): Claude's dated screenshots and the terminal transcripts of the clients really connected, each in
        // its captioned figure, counted from the page's own wiring (`connectClients`): each capture is ONE thumbnail
        // (`a.cshot__open`) and ONE full-size view of the same file (`a.cshot__full`), and no other image
        expect(await connect.locator("#client-copilot").textContent()).toContain("x-ms-block-by: sandbox-broker");
        expect(await connect.locator("#clients svg").count()).toBe(0);
        const clients = connectClients(lang);
        const shotsOf = (c: (typeof clients)[number]): number => c.shots.length + (c.flow?.steps.reduce((m, s) => m + s.shots.length, 0) ?? 0);
        const wired = clients.reduce((n, c) => n + shotsOf(c), 0);
        const claudeWired = clients.filter((c) => c.id === "claudeAi").reduce((n, c) => n + shotsOf(c), 0);
        expect(claudeWired).toBeGreaterThan(0);
        expect(wired).toBeGreaterThan(claudeWired);
        expect(await connect.locator("#client-claude-ai figure.cshot a.cshot__open > img").count()).toBe(claudeWired);
        expect(await connect.locator("#clients figure.cshot a.cshot__open > img").count()).toBe(wired);
        expect(await connect.locator("#clients a.cshot__full > img").count()).toBe(wired);
        expect(await connect.locator("#clients img").count()).toBe(2 * wired);
        // following a name opens the page at that client's block
        await gotoSettled(connect, `${BASE}${names[5]![1]}`);
        expect(await connect.evaluate(() => location.hash)).toBe("#client-windsurf");
      } finally {
        await ctx.close();
      }
    });
  }
});

describe("#1003 the endpoint chip's copy button", () => {
  for (const [path, label, copied] of [
    [pathFor("connect", "de"), "Adresse kopieren", "Kopiert"],
    [pathFor("start", "en"), "Copy address", "Copied"],
    [motorwayPath("de", "A7"), "Adresse kopieren", "Kopiert"],
    [placePath("en", "koeln"), "Copy address", "Copied"],
  ] as const) {
    it(`${path}: every chip's button is revealed, named "${label}", copies the address, shows and announces "${copied}"`, async () => {
      const ctx = await browser.newContext({ userAgent: PERSON_UA, viewport: { width: 1280, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
      try {
        const page = await visit(ctx, path);
        const hidden = await page.$$eval(".endpoint-chip__copy", (bs) => bs.filter((b) => (b as HTMLButtonElement).hidden).length);
        expect(await page.locator(".endpoint-chip__copy").count(), path).toBeGreaterThan(0);
        expect(hidden, path).toBe(0);
        // the first VISIBLE chip (the connect page's own, the 60-second block's, the motorway block's, the place note's)
        await page.evaluate(() => document.querySelectorAll("details.connect-note").forEach((d) => ((d as HTMLDetailsElement).open = true)));
        const chip = page.locator(".endpoint-chip").filter({ has: page.locator(".endpoint-chip__copy:visible") }).first();
        const button = chip.locator(".endpoint-chip__copy");
        expect(await button.getAttribute("aria-label")).toBe(label);
        await button.scrollIntoViewIfNeeded();
        await button.focus();
        await page.keyboard.press("Enter");
        await page.waitForFunction(() => document.querySelector(".endpoint-chip.is-copied") !== null);
        expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("https://mcp.viafrei.de/mcp");
        const status = chip.locator('[role="status"]');
        expect(await status.getAttribute("aria-live")).toBe("polite");
        expect(await status.textContent()).toBe(copied);
        expect(await status.isVisible()).toBe(true);
        // the state goes again
        await page.waitForFunction(() => document.querySelector(".endpoint-chip.is-copied") === null, undefined, { timeout: 5000 });
        expect(await status.textContent()).toBe("");
      } finally {
        await ctx.close();
      }
    });
  }

  it("without a script the button stays hidden and the address is plain selectable text", async () => {
    const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
    try {
      const page = await visit(ctx, pathFor("connect", "de"));
      expect(await page.locator(".endpoint-chip__copy").count()).toBeGreaterThan(0);
      expect(await page.locator(".endpoint-chip__copy:visible").count()).toBe(0);
      const code = page.locator(".connect-endpoint .endpoint-chip__url");
      expect(await code.textContent()).toBe("https://mcp.viafrei.de/mcp");
      expect(await code.evaluate((c) => getComputedStyle(c).userSelect)).toBe("all");
    } finally {
      await ctx.close();
    }
  });

  for (const width of [320, 375])
    it(`at ${String(width)} px the address breaks, if at all, only before /mcp — never inside the host`, async () => {
      const ctx = await browser.newContext({ viewport: { width, height: 800 } });
      try {
        for (const path of [pathFor("connect", "de"), pathFor("start", "de"), pathFor("business", "de")]) {
          const page = await visit(ctx, path);
          await page.evaluate(() => document.querySelectorAll("details.connect-note").forEach((d) => ((d as HTMLDetailsElement).open = true)));
          const bad = await page.$$eval(".endpoint-chip__host", (hs) =>
            hs
              .filter((h) => (h as HTMLElement).offsetParent !== null)
              // one line: every fragment of the host's box sits on the same line, and none leaves the viewport
              .filter((h) => new Set(Array.from(h.getClientRects(), (r) => Math.round(r.top))).size !== 1 || h.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5)
              .map((h) => h.closest("section, details, aside")?.className ?? "?"),
          );
          expect(bad, `${path} at ${String(width)}`).toEqual([]);
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), path).toBe(true);
          await page.close();
        }
      } finally {
        await ctx.close();
      }
    });

  it("a copy is cta_connect_click { where: copy } with the chip's surface — nothing before consent", async () => {
    const ctx = await browser.newContext({ userAgent: PERSON_UA, viewport: { width: 1280, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
    await ctx.route(/https:\/\/([a-z0-9-]+\.)*(googletagmanager|google-analytics|analytics\.google)\.com\/.*/, (route) => void route.fulfill({ status: 200, contentType: "application/javascript", body: "/* intercepted */" }));
    try {
      const page = await visit(ctx, pathFor("connect", "en"), TAGGED);
      await page.waitForSelector(".consent[role=dialog]", { state: "visible" });
      const copy = page.locator(".connect-endpoint .endpoint-chip__copy");
      await copy.dispatchEvent("click");
      await page.waitForFunction(() => document.querySelector(".connect-endpoint .is-copied") !== null);
      const layer = (): Promise<unknown[]> => page.evaluate(() => ((window as unknown as { dataLayer?: ArrayLike<unknown>[] }).dataLayer ?? []).filter((e) => e[0] === "event").map((e) => [e[1], e[2]]));
      expect(await layer()).toEqual([]);
      await page.click(".consent__actions .btn:last-child"); // accept
      await page.waitForFunction(() => (window as unknown as { vfAnalytics?: boolean }).vfAnalytics === true);
      await copy.dispatchEvent("click");
      await page.waitForFunction(() => ((window as unknown as { dataLayer?: ArrayLike<unknown>[] }).dataLayer ?? []).some((e) => e[1] === "cta_connect_click"));
      const clicks = ((await layer()) as [unknown, unknown][]).filter(([n]) => n === "cta_connect_click").map(([, p]) => p);
      expect(clicks).toEqual([{ lang: "en", where: "copy", surface: "connect" }]);
    } finally {
      await ctx.close();
    }
  });
});
