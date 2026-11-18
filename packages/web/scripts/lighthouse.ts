/**
 * The Lighthouse gate (#381 item 7): mobile profile, the MEDIAN of five runs,
 * on /de, /en, /de/connect, /de/developers, /de/business, /de/fuel and /de/examples of the BUILT shell
 * fed by the real digest renderer over the fixture snapshot. Floors:
 * performance ≥ 95, accessibility = 100, SEO ≥ 95, best practices ≥ 95.
 *
 * ONE exception, the same one `e2e/a11y.e2e.ts` makes and for the same owner
 * decision (2026-10-03, D3 amended): on the two home pages the `meta-refresh`
 * audit is skipped, and only after the page is read and its refresh is exactly
 * HOME_REFRESH_S — a home with any other refresh fails here.
 *
 * The pages are fetched through `e2e/gzip-front.ts`, the edge's compression rule read from `the edge configuration`
 * (2.5.2): the shell compresses nothing, and Lighthouse's simulated slow-4G paint times over its raw ~270 KB pages
 * described a transfer no visitor makes — /de, /de/connect and /de/examples scored perf 92 on HTML that leaves the
 * edge at 24–37 KB.
 *
 * Chrome is Playwright's own Chromium (no download, no second browser), driven
 * through chrome-launcher. Exit 1 names each page and category under its floor;
 * exit 2 is "could not check" — a run that produced no score, or fewer runs
 * than asked (§5b: a gate over zero runs is not a pass).
 *
 *   npm run build -w @viafrei/web && npx tsx packages/web/scripts/lighthouse.ts
 */
import { fileURLToPath } from "node:url";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";
import { chromium } from "playwright";
import { startGzipFront } from "../e2e/gzip-front.js";
import { startRealDigest } from "../e2e/real-digest.js";
import { startShell } from "../e2e/server.js";
import { HOME_REFRESH_CONTENT, LIVE_LANGS, pathFor } from "../src/site/pages.js";

// #747 (2.1.24): the examples page joins the gate, the longest page of answer cards beside the connect page
export const PAGES = ["/de", "/en", "/de/connect", "/de/developers", "/de/business", "/de/fuel", "/de/examples"] as const;
export const RUNS = 5;
export const FLOORS = { performance: 95, accessibility: 100, seo: 95, "best-practices": 95 } as const;
export type Category = keyof typeof FLOORS;
export type Scores = Readonly<Record<Category, number>>;

/**
 * The `Accept-Language` each page is loaded with: its own language. Lighthouse's Chrome sends `en-US`, and a German
 * page entered with it is sent once to its English twin (`src/i18n/lang-redirect.ts`, a 302) — so without this header
 * every /de/… entry measured the English page behind a redirect, the German page was never judged, and the redirect
 * pushed first paint past the work it should have counted (v0.2.1: "/de" 100 over the same HTML that scored 91 as /en).
 */
export function acceptLanguageOf(page: string): string {
  const lang = page.split("/")[1] ?? "";
  if (!(LIVE_LANGS as readonly string[]).includes(lang)) throw new Error(`${page}: no live language in its path`);
  return lang;
}

export function median(xs: readonly number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}

/** Judge per-page runs: exit 2 when a page has fewer than RUNS complete runs, 1 when a median is under its floor. */
export function judge(runs: ReadonlyMap<string, readonly Scores[]>): { readonly code: 0 | 1 | 2; readonly lines: readonly string[] } {
  if (runs.size === 0) return { code: 2, lines: ["✗ lighthouse: could not check — no page was audited"] };
  const lines: string[] = [];
  for (const [page, rs] of runs) {
    if (rs.length < RUNS) return { code: 2, lines: [`✗ lighthouse: could not check — ${page} has ${rs.length} of ${RUNS} runs`] };
  }
  let red = false;
  for (const [page, rs] of runs) {
    const med = Object.fromEntries((Object.keys(FLOORS) as Category[]).map((c) => [c, median(rs.map((r) => r[c]))])) as Record<Category, number>;
    const bad = (Object.keys(FLOORS) as Category[]).filter((c) => med[c] < FLOORS[c]);
    const verdict = bad.length ? "   ✗ " + bad.join(", ") : "";
    lines.push(`  ${page.padEnd(16)} perf ${med.performance}  a11y ${med.accessibility}  seo ${med.seo}  best ${med["best-practices"]}${verdict}`);
    if (bad.length) red = true;
  }
  lines.push(red ? "✗ lighthouse: a median is under its floor" : `✓ lighthouse: ${runs.size} page(s) × ${RUNS} runs, every median at or above perf 95 · a11y 100 · seo 95 · best 95`);
  return { code: red ? 1 : 0, lines };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = 18_960;
  /** The shell's own port behind the gzip front (`port`), which is what Lighthouse loads. */
  const shellPort = 18_959;
  const digest = await startRealDigest();
  const shell = await startShell(shellPort, { DIGEST_URL: digest.url });
  const front = await startGzipFront(port, shellPort);
  const chrome = await chromeLauncher.launch({ chromePath: chromium.executablePath(), chromeFlags: ["--headless=new", "--no-sandbox"] });
  const runs = new Map<string, Scores[]>();
  let code: 0 | 1 | 2 = 2;
  try {
    for (const page of PAGES) {
      const rs: Scores[] = [];
      const home = LIVE_LANGS.some((l) => page === pathFor("start", l));
      if (home) {
        const html = await (await fetch(`http://127.0.0.1:${port}${page}`)).text();
        const refresh = /<meta http-equiv="refresh" content="([^"]+)"/.exec(html)?.[1];
        if (refresh !== HOME_REFRESH_CONTENT) throw new Error(`${page}: refresh is ${refresh ?? "absent"}, the excepted value is ${HOME_REFRESH_CONTENT}`);
      }
      // A run Lighthouse returns without every category is retried, at most twice per page — and said.
      let attempts = 0;
      while (rs.length < RUNS && attempts < RUNS + 2) {
        attempts++;
        const r = await lighthouse(
          `http://127.0.0.1:${port}${page}`,
          { port: chrome.port, output: "json", logLevel: "error" },
          {
            extends: "lighthouse:default",
            settings: { extraHeaders: { "Accept-Language": acceptLanguageOf(page) }, ...(home ? { skipAudits: ["meta-refresh"] } : {}) },
          },
        );
        // a page that ended anywhere but where it was asked was not the page judged
        if (r && new URL(r.lhr.finalDisplayedUrl).pathname !== page) throw new Error(`${page}: Lighthouse ended on ${r.lhr.finalDisplayedUrl}`);
        const cats = r?.lhr.categories;
        if (!cats) continue;
        const s = Object.fromEntries((Object.keys(FLOORS) as Category[]).map((c) => [c, Math.round((cats[c]?.score ?? Number.NaN) * 100)])) as Record<Category, number>;
        if (Object.values(s).some((v) => Number.isNaN(v))) continue;
        rs.push(s);
      }
      if (attempts > RUNS) console.log(`  (${page}: ${attempts} attempts for ${rs.length} complete runs)`);
      runs.set(page, rs);
    }
    const v = judge(runs);
    for (const l of v.lines) console.log(l);
    code = v.code;
  } catch (e) {
    console.log(`✗ lighthouse: could not check — ${(e as Error).message}`);
  } finally {
    chrome.kill();
    await new Promise<void>((done) => front.close(() => done()));
    shell.kill();
    await digest.close();
  }
  process.exit(code);
}
