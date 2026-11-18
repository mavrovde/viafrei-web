/**
 * #1182 AC 1 and AC 3: every page type of #1182 at 375×812 and at 1440×900, in German and English, over the REAL digest
 * on the fixture database (`real-digest.ts`).
 *
 *   AC 1  the components in the #1173 order: the H1 first in `main`, then the first block where the page has live data
 *         (status line, top items, jump links), then the page's own content; the H1 on the first screen (its top at most
 *         160 px on a desktop, inside the viewport on a phone); on business, developers and examples the page's one action
 *         is on the first screen.
 *   AC 3  the budgets: at most 25 screens of page at each width (owner 2026-11-06, the home with a place: page ≤ 25), at
 *         most 700 KB raw and 200 KB gzip of HTML.
 *   AC 5  the Länder index: sixteen links on the map, each named with its lamp in words, every one reachable by Tab.
 *   AC 6  every page type's served `<title>` and meta description in EVERY live language, the recorded ones
 *         (`test/__golden__/page-heads-1182.tsv`, suite `web-page-heads`): one line per type and language. A clock time
 *         is written `hh:mm`, so the line pins the words and not the minute the fixture was read at.
 *
 * Run in the pinned Linux image only (the laptop is macOS: fonts and Intl differ). No screenshot is compared here and no
 * baseline is recorded by this file.
 */
import { gzipSync } from "node:zlib";
import type { ChildProcess } from "node:child_process";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";
import { LIVE_LANGS, pathFor, type Lang } from "../src/site/pages.js";

const PORT = 8911;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const ID = { IMPRESSUM_NAME: "Page Probe", IMPRESSUM_STREET: "Probeweg 5", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "page@example.invalid" };
const VIEWS = [
  { name: "phone", width: 375, height: 812 },
  { name: "desk", width: 1440, height: 900 },
] as const;
const LANGS = ["de", "en"] as const;
const SCREENS_MAX = 25;
// Owner 2026-11-16 ("Increase the budget"): the examples page may run to 27 screens. #746 gave each re-asked answer its
// full credits; with the #1120 fold it measured 26.1 (de) and 25.8 (en) screens at 1440×900 in 2.6.19. Every other page
// type keeps 25.
const SCREENS_MAX_EXAMPLES = 27;
const RAW_MAX = 700_000;
const GZIP_MAX = 200_000;
const DESK_H1_TOP_MAX = 160;
const THIRD_PARTY = /googletagmanager\.com|google-analytics\.com|clarity\.ms/u;

let browser: Browser;
let digest: Awaited<ReturnType<typeof startRealDigest>>;
let shell: ChildProcess;
const base = `http://127.0.0.1:${String(PORT)}`;

/** A page type, its address in a language (read off the fixture where it depends on it), and what it must hold. */
type Kind = { readonly id: string; readonly path: (lang: string) => Promise<string>; readonly live: boolean; readonly action?: string; readonly legal?: true };

async function firstHref(path: string, re: RegExp, what: string): Promise<string> {
  const html = await (await fetch(base + path)).text();
  const m = re.exec(html)?.[1];
  if (m === undefined) throw new Error(`${path} names no ${what}: the fixture changed, and this suite refuses to pass on nothing`);
  return m.startsWith("/") ? m : new URL(m, base + path).pathname;
}

const KINDS: readonly Kind[] = [
  { id: "state", path: (l) => Promise.resolve(`/${l}/state/bayern`), live: true },
  { id: "states", path: (l) => Promise.resolve(`/${l}/states`), live: false },
  { id: "road", path: async (l) => firstHref(`/sitemap-roads-${l}.xml`, /<loc>https?:\/\/[^/]+(\/[^<]+)<\/loc>/u, "road"), live: true },
  { id: "exit", path: async (l) => firstHref(`/${l}/autobahn/a7`, /<a href="(a7\/exit-[a-z0-9-]+)"/u, "junction"), live: true },
  { id: "motorways", path: (l) => Promise.resolve(`/${l}/autobahn`), live: false },
  { id: "stations", path: (l) => Promise.resolve(`/${l}/station`), live: false },
  { id: "stop", path: async (l) => firstHref(await firstHref(`/${l}/station`, /<a href="(\/[a-z]{2}\/station\/[^"?#]+)" translate="no">/u, "station"), /<a [^>]*href="([^"]*\/stop\/[^"]+)"/u, "stop"), live: false },
  { id: "fuel", path: (l) => Promise.resolve(`/${l}/fuel`), live: false },
  { id: "business", path: (l) => Promise.resolve(`/${l}/business`), live: false, action: '[data-vf-cta="pilot"]' },
  { id: "developers", path: (l) => Promise.resolve(`/${l}/developers`), live: false, action: ".dev-hero__endpoint" },
  { id: "examples", path: (l) => Promise.resolve(`/${l}/examples`), live: false, action: ".pagehead .btn--primary" },
  // a legal page is German at the site root and under the prefix in every other language (`pages.ts`, A4): never /de/impressum
  // and (AC 2, `test/page-types-1182.test.ts`) it is Base alone, with no page head of its own
  { id: "impressum", path: (l) => Promise.resolve(pathFor("impressum", l as Lang)), live: false, legal: true },
];

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

async function open(path: string, v: (typeof VIEWS)[number]): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height }, userAgent: UA, hasTouch: v.name === "phone" });
  ctx.setDefaultTimeout(2_000);
  await ctx.route(THIRD_PARTY, (r) => r.fulfill({ status: 204, body: "" }));
  const page = await ctx.newPage();
  const res = await page.goto(base + path);
  if (res === null || res.status() !== 200) throw new Error(`${path} answered ${String(res?.status())}`);
  return page;
}

describe("#1182: every page type in the #1173 order, within its budgets", () => {
  for (const k of KINDS)
    for (const lang of LANGS)
      for (const v of VIEWS)
        it(`${k.id} ${lang} at ${String(v.width)}×${String(v.height)}`, async () => {
          const path = await k.path(lang);
          const page = await open(path, v);
          try {
            const order = await page.evaluate(() => {
              const main = document.querySelector("main")!;
              const all = [...main.querySelectorAll("*")];
              const at = (el: Element | null): number => (el === null ? -1 : all.indexOf(el));
              const h1 = main.querySelector("h1");
              return {
                h1s: main.querySelectorAll("h1").length,
                h1: at(h1),
                head: at(h1?.closest(".pagehead") ?? null),
                first: at(main.querySelector("#page-first")),
                status: at(main.querySelector("#page-first .statusline")),
                after: at(main.querySelector(".pagehead ~ *")),
              };
            });
            expect(order.h1s, "one H1").toBe(1);
            if (k.legal === true) expect(order.head, "a legal page has no page head of its own (AC 2)").toBe(-1);
            else expect(order.head, "the H1 stands in PageHead").toBeGreaterThan(-1);
            if (k.live) {
              expect(order.first, "a page with live data has its first block").toBeGreaterThan(order.h1);
              expect(order.status, "the status line opens the first block").toBeGreaterThan(order.first);
            }
            if (order.first > -1 && order.after > -1) expect(order.first).toBeLessThan(order.after);
            const h1 = (await page.locator("main h1").boundingBox())!;
            if (v.name === "desk") expect(h1.y).toBeLessThanOrEqual(DESK_H1_TOP_MAX);
            expect(h1.y + h1.height).toBeLessThanOrEqual(v.height);
            // #1182 part 1: an exit page opens with the junction's two directions — the block's head in the first viewport
            // on both sizes, and on the desktop both columns' heads beside each other in it too
            if (k.id === "exit") {
              const ways = (await page.locator("#page-first #exit-ways .exitways__h").boundingBox())!;
              expect(ways.y + ways.height, "both directions in the first viewport").toBeLessThanOrEqual(v.height);
              expect(await page.locator("#exit-ways .exitways__way").count(), "one column per direction").toBe(2);
              if (v.name === "desk")
                for (const sense of ["pos", "neg"]) {
                  const col = (await page.locator(`#exit-ways .exitways__way--${sense} .exitways__to`).boundingBox())!;
                  expect(col.y + col.height, `the ${sense} column's head in the first viewport`).toBeLessThanOrEqual(v.height);
                }
            }
            // item 10 with #1181: a Land page carries the star and, after its blocks, three Land questions
            if (k.id === "state") {
              expect(await page.locator("#vf-star").count(), "the star").toBe(1);
              expect(await page.locator("#desk-ask .askai > li").count(), "three questions").toBe(3);
              const last = await page.evaluate(() => {
                const ask = document.querySelector("#desk-ask")!;
                const facts = document.querySelector("#state-facts")!;
                return facts.compareDocumentPosition(ask) & Node.DOCUMENT_POSITION_FOLLOWING;
              });
              expect(last, "the questions after the page's sections").toBeTruthy();
            }
            if (k.action !== undefined) {
              const a = (await page.locator(k.action).first().boundingBox())!;
              expect(a.y + a.height, "the one action on the first screen").toBeLessThanOrEqual(v.height);
            }
            const screens = await page.evaluate(() => document.documentElement.scrollHeight / window.innerHeight);
            console.log(`1182 ${k.id} ${lang} ${v.name}: ${screens.toFixed(1)} screens`);
            expect(screens).toBeLessThanOrEqual(k.id === "examples" ? SCREENS_MAX_EXAMPLES : SCREENS_MAX);
          } finally {
            await page.context().close();
          }
        });

  for (const k of KINDS)
    it(`${k.id}: within ${String(RAW_MAX)} B raw and ${String(GZIP_MAX)} B gzip in every language asked`, async () => {
      for (const lang of LANGS) {
        const html = await (await fetch(base + (await k.path(lang)))).text();
        const gz = gzipSync(html).length;
        console.log(`1182 budget ${k.id} ${lang}: ${String(html.length)} B raw, ${String(gz)} B gzip`);
        expect(html.length).toBeLessThanOrEqual(RAW_MAX);
        expect(gz).toBeLessThanOrEqual(GZIP_MAX);
      }
    });

  it("AC 6: every page type's title and description in every live language are the recorded ones", async () => {
    const decode = (v: string): string => v.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    const clock = (v: string): string => v.replace(/\b\d{1,2}[:.]\d{2}\b/gu, "hh:mm");
    const lines: string[] = [];
    for (const k of KINDS)
      for (const lang of LIVE_LANGS) {
        const path = await k.path(lang);
        const html = await (await fetch(base + path)).text();
        const title = /<title>([^<]*)<\/title>/u.exec(html)?.[1];
        const description = /<meta name="description" content="([^"]*)"/u.exec(html)?.[1];
        if (title === undefined || description === undefined) throw new Error(`${path}: no title or no description`);
        expect(title.trim(), `${k.id} ${lang}`).not.toBe("");
        expect(description.trim(), `${k.id} ${lang}`).not.toBe("");
        lines.push([k.id, lang, clock(decode(title)), clock(decode(description))].join("\t"));
      }
    expect(lines).toHaveLength(KINDS.length * LIVE_LANGS.length);
    await expect(`${lines.join("\n")}\n`).toMatchFileSnapshot("../test/__golden__/page-heads-1182.tsv");
  }, 120_000);

  for (const lang of LANGS)
    it(`AC 5 ${lang}: the Länder map is sixteen links, named with their lamps, each reachable by Tab`, async () => {
      const page = await open(`/${lang}/states`, VIEWS[1]);
      try {
        // the map's own links: the figure's caption carries the VG2500 credit's links too, which are no Land
        const links = page.locator("figure.stmap--index svg a");
        expect(await links.count()).toBe(16);
        const names = await links.evaluateAll((as) => as.map((a) => a.getAttribute("aria-label") ?? ""));
        for (const n of names) expect(n).toMatch(/^.+: .+$/u);
        const reached = new Set<string>();
        for (let i = 0; i < 200 && reached.size < 16; i += 1) {
          await page.keyboard.press("Tab");
          const href = await page.evaluate(() => (document.activeElement?.closest("figure.stmap--index svg") ? (document.activeElement.getAttribute("href") ?? "") : ""));
          if (href !== "") reached.add(href);
        }
        expect(reached.size).toBe(16);
      } finally {
        await page.context().close();
      }
    });
});
