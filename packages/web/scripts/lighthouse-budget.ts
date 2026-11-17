/**
 * The mobile page-experience budget (#1310 D1, #1030): Lighthouse's mobile profile (Moto G Power, simulated slow 4G),
 * the MEDIAN of three runs per page, on the pages a driver lands on from search — /de, /de/autobahn, a motorway page, a
 * second motorway page, a place page and one exit page — of the BUILT shell fed by the real digest renderer over the
 * fixture snapshot, through the edge's compression (`e2e/gzip-front.ts`). Budget, each median:
 * LCP ≤ 2.5 s, CLS ≤ 0.1, TBT ≤ 200 ms.
 *
 * `scripts/lighthouse.ts` judges the category SCORES; this gate judges the three METRICS Google's page experience reads,
 * because a score of 95 can carry a 0.15 layout shift (the score weighs it at 25 %).
 *
 * The fixture's register has no A24 (A1–A10, A34, A57, A61), so the issue's /de/autobahn/a24 slot is measured on
 * `SUBSTITUTE.to`, the register's quiet road, and the run SAYS so on its first line — a page that is not served is never
 * measured as if it were (`judgeBudget` refuses a page that did not answer 200, exit 2).
 *
 * The proof that it can say NO: `--plant unsized-image` puts an image with no width or height at the top of every page's
 * `<main>`, served late, so everything under it moves when it arrives; `--plant blocking-font` puts a render-blocking
 * stylesheet with a `font-display: block` face in every `<head>`, served late. Each must exit 1, naming the page and the
 * metric (`bash` evidence in the release's web leg record). The plant sits between the gzip front and the shell, so the
 * transfer it is measured over is the edge's.
 *
 * Exit 1 names each page and metric over budget; exit 2 is "could not check" (a page not 200, a run without the three
 * audits, fewer runs than asked: §5b).
 *
 *   npm run web:build && npx tsx packages/web/scripts/lighthouse-budget.ts [--plant unsized-image|blocking-font]
 *
 * Linux only, like every browser gate here: run it in the pinned Playwright image (e2e-arm), never on the macOS laptop.
 */
import { randomBytes } from "node:crypto";
import { createServer, request, type Server } from "node:http";
import { fileURLToPath } from "node:url";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";
import { chromium } from "playwright";
import { startGzipFront } from "../e2e/gzip-front.js";
import { startRealDigest } from "../e2e/real-digest.js";
import { startShell } from "../e2e/server.js";
import { median, RUNS } from "./lighthouse.js";

/** The issue's pages; `EXIT` is resolved from the A7 page's first junction link at run time. */
export const EXIT = "<exit>";
export const BUDGET_PAGES = ["/de", "/de/autobahn", "/de/autobahn/a7", "/de/autobahn/a24", "/de/place/hamburg", EXIT] as const;
/** The one page the fixture cannot serve, and what is measured in its slot (named on the run's first line). */
export const SUBSTITUTE = { from: "/de/autobahn/a24", to: "/de/autobahn/a61" } as const;
export const BUDGET = { lcpMs: 2_500, cls: 0.1, tbtMs: 200 } as const;
export const AUDITS = { lcpMs: "largest-contentful-paint", cls: "cumulative-layout-shift", tbtMs: "total-blocking-time" } as const;
export type Metric = keyof typeof BUDGET;
export type Metrics = Readonly<Record<Metric, number>>;
export const PLANTS = ["unsized-image", "blocking-font"] as const;
export type Plant = (typeof PLANTS)[number];

/** One run's three metrics out of a Lighthouse result's audits, or null when one is missing or not a number. */
export function metricsOf(audits: Readonly<Record<string, { readonly numericValue?: number } | undefined>> | undefined): Metrics | null {
  if (audits === undefined) return null;
  const out: Partial<Record<Metric, number>> = {};
  for (const m of Object.keys(AUDITS) as Metric[]) {
    const v = audits[AUDITS[m]]?.numericValue;
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    out[m] = v;
  }
  return out as Metrics;
}

const show = (m: Metric, v: number): string => (m === "cls" ? v.toFixed(3) : `${String(Math.round(v))} ms`);

/**
 * Judge the runs per page: exit 2 when a page did not answer 200 or has fewer than RUNS complete runs (or nothing was
 * measured), 1 when a median is over its budget, else 0.
 */
export function judgeBudget(runs: ReadonlyMap<string, { readonly status: number; readonly runs: readonly Metrics[] }>): { readonly code: 0 | 1 | 2; readonly lines: readonly string[] } {
  if (runs.size === 0) return { code: 2, lines: ["✗ page budget: could not check — no page was measured"] };
  for (const [page, r] of runs) {
    if (r.status !== 200) return { code: 2, lines: [`✗ page budget: could not check — ${page} answered ${String(r.status)}, not 200`] };
    if (r.runs.length < RUNS) return { code: 2, lines: [`✗ page budget: could not check — ${page} has ${String(r.runs.length)} of ${String(RUNS)} runs`] };
  }
  const lines: string[] = [];
  let red = false;
  for (const [page, r] of runs) {
    const med = Object.fromEntries((Object.keys(BUDGET) as Metric[]).map((m) => [m, median(r.runs.map((x) => x[m]))])) as Record<Metric, number>;
    const over = (Object.keys(BUDGET) as Metric[]).filter((m) => med[m] > BUDGET[m]);
    lines.push(`  ${page.padEnd(34)} LCP ${show("lcpMs", med.lcpMs)}  CLS ${show("cls", med.cls)}  TBT ${show("tbtMs", med.tbtMs)}${over.length ? `   ✗ ${over.map((m) => AUDITS[m]).join(", ")}` : ""}`);
    if (over.length) red = true;
  }
  lines.push(red ? "✗ page budget: a median is over its budget" : `✓ page budget: ${String(runs.size)} page(s) × ${String(RUNS)} runs, every median within LCP 2.5 s · CLS 0.1 · TBT 200 ms`);
  return { code: red ? 1 : 0, lines };
}

/** The planted fault's markup, put into an HTML page: an unsized late image at the top of `<main>`, or a blocking font stylesheet in `<head>`. */
export function plantInto(html: string, plant: Plant): string {
  if (plant === "unsized-image") {
    const at = /<main\b[^>]*>/u.exec(html);
    if (at === null) return html;
    const end = at.index + at[0].length;
    return `${html.slice(0, end)}<img src="/_plant/hero.svg" alt="">${html.slice(end)}`;
  }
  return html.replace(/<head\b[^>]*>/u, (h) => `${h}<link rel="stylesheet" href="/_plant/font.css">`);
}

/** The Accept-Language every run sends: a German page measured as a German visitor meets it. */
export const GERMAN_VISITOR = "de-DE,de;q=0.9";

/** How late each planted asset is served (ms): late enough that the page has painted and is measured moving or waiting. */
export const PLANT_DELAY_MS = 3_000;
const HERO = '<svg xmlns="http://www.w3.org/2000/svg" width="375" height="600"><rect width="375" height="600" fill="#888"/></svg>';
const FONT_CSS = '@font-face{font-family:Plant;src:url(/_plant/plant.woff2) format("woff2");font-display:block}*{font-family:Plant,sans-serif!important}';

/**
 * The planted face's bytes: a webfont's weight, incompressible. Lighthouse SIMULATES slow 4G over the request graph it
 * observed and models a request's server time by its origin, so a late answer alone barely moves the simulated LCP
 * (measured: +0.3 s for a 3 s delay); the face's transfer before any text may paint is what a blocking font costs.
 */
export const PLANT_FONT_BYTES = 800_000;
const FONT = randomBytes(PLANT_FONT_BYTES);

/** The plant's own front on `port`: `/_plant/*` served late, every HTML answer of the shell on `upstream` planted. */
function startPlantFront(port: number, upstream: number, plant: Plant): Promise<Server> {
  const server = createServer((req, res) => {
    if (req.url?.startsWith("/_plant/")) {
      const body = req.url === "/_plant/hero.svg" ? HERO : req.url === "/_plant/font.css" ? FONT_CSS : req.url === "/_plant/plant.woff2" ? FONT : "";
      const type = req.url.endsWith(".svg") ? "image/svg+xml" : req.url.endsWith(".css") ? "text/css" : "font/woff2";
      setTimeout(() => {
        res.writeHead(body === "" ? 404 : 200, { "content-type": type, "cache-control": "no-store" });
        res.end(body);
      }, PLANT_DELAY_MS);
      return;
    }
    const headers = { ...req.headers };
    delete headers["accept-encoding"];
    const up = request({ host: "127.0.0.1", port: upstream, method: req.method, path: req.url, headers }, (u) => {
      const chunks: Buffer[] = [];
      u.on("data", (c: Buffer) => chunks.push(c));
      u.on("end", () => {
        let body = Buffer.concat(chunks);
        const out = { ...u.headers };
        if (String(u.headers["content-type"] ?? "").startsWith("text/html")) {
          body = Buffer.from(plantInto(body.toString("utf8"), plant), "utf8");
          // the site's policy (`security/csp.ts`) allows no font at all; whoever adds a webfont adds its source too
          const csp = u.headers["content-security-policy"];
          if (plant === "blocking-font" && typeof csp === "string") out["content-security-policy"] = `${csp}; font-src 'self'`;
        }
        delete out["transfer-encoding"];
        out["content-length"] = String(body.length);
        res.writeHead(u.statusCode ?? 502, out);
        res.end(body);
      });
    });
    up.on("error", () => {
      res.writeHead(502);
      res.end();
    });
    req.pipe(up);
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

/** The main thread's work by group and the scripts' own time, largest first, from a run's audits: the reason for a TBT. */
export function breakdownOf(audits: Readonly<Record<string, { readonly details?: unknown } | undefined>> | undefined): string {
  type Item = { readonly group?: string; readonly groupLabel?: string; readonly url?: string; readonly duration?: number; readonly total?: number; readonly scripting?: number };
  const items = (id: string): Item[] => ((audits?.[id]?.details as { items?: Item[] } | undefined)?.items ?? []);
  const groups = items("mainthread-work-breakdown").slice(0, 3).map((i) => `${i.groupLabel ?? i.group ?? "?"} ${String(Math.round(i.duration ?? 0))} ms`);
  const scripts = items("bootup-time").slice(0, 2).map((i) => `${(i.url ?? "?").replace(/^https?:\/\/[^/]+/u, "")} ${String(Math.round(i.scripting ?? i.total ?? 0))} ms`);
  return [`main thread: ${groups.join(", ") || "no breakdown"}`, `scripts: ${scripts.join(", ") || "none"}`].join("; ");
}

/** `--only <path>`: measure the listed page(s) whose path is this (repeatable), for a focused re-run; the gate itself never passes it. */
export function onlyOf(argv: readonly string[]): readonly string[] {
  return argv.flatMap((a, i) => (argv[i - 1] === "--only" ? [a] : []));
}

/** `--plant <name>` from argv, or null; an unknown name is a usage error. */
export function plantOf(argv: readonly string[]): Plant | null {
  const i = argv.indexOf("--plant");
  if (i < 0) return null;
  const v = argv[i + 1];
  if (!(PLANTS as readonly string[]).includes(v ?? "")) throw new Error(`--plant takes one of ${PLANTS.join(", ")}`);
  return v as Plant;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let plant: Plant | null;
  try {
    plant = plantOf(process.argv.slice(2));
  } catch (e) {
    console.log(`✗ page budget: ${(e as Error).message}`);
    process.exit(64);
  }
  const port = 18_970;
  const shellPort = 18_969;
  const plantPort = 18_968;
  const digest = await startRealDigest();
  const shell = await startShell(shellPort, { DIGEST_URL: digest.url });
  const planted = plant === null ? null : await startPlantFront(plantPort, shellPort, plant);
  const front = await startGzipFront(port, planted === null ? shellPort : plantPort);
  // --disable-dev-shm-usage: a container's /dev/shm is 64 MB, and Chrome without it dies before its DevTools port answers
  const chrome = await chromeLauncher.launch({ chromePath: chromium.executablePath(), chromeFlags: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"] });
  const runs = new Map<string, { status: number; runs: Metrics[] }>();
  let code: 0 | 1 | 2 = 2;
  try {
    console.log(`  (${SUBSTITUTE.from}: not in the fixture's register — its slot is measured on ${SUBSTITUTE.to})${plant === null ? "" : `  PLANTED: ${plant}`}`);
    const a7 = await (await fetch(`http://127.0.0.1:${String(shellPort)}/de/autobahn/a7`)).text();
    const exit = /<a href="(a7\/exit-[a-z0-9-]+)"/u.exec(a7)?.[1];
    if (exit === undefined) throw new Error("the A7 page names no junction, so there is no exit page to measure");
    const only = onlyOf(process.argv.slice(2));
    for (const listed of BUDGET_PAGES) {
      const page = listed === EXIT ? `/de/autobahn/${exit}` : listed === SUBSTITUTE.from ? SUBSTITUTE.to : listed;
      if (only.length > 0 && !only.includes(listed) && !only.includes(page)) continue;
      const url = `http://127.0.0.1:${String(port)}${page}`;
      const status = (await fetch(url)).status;
      const rs: Metrics[] = [];
      let attempts = 0;
      while (status === 200 && rs.length < RUNS && attempts < RUNS + 2) {
        attempts++;
        // the default config is the mobile profile: Moto G Power, simulated slow 4G, 4× CPU slowdown
        // A German visitor's Accept-Language: Chrome's own (en-US) would be sent once to /en/... by the language switch
        // (`i18n/lang-redirect.ts`), and the run would measure a redirect and another page than the one it names.
        const r = await lighthouse(url, { port: chrome.port, output: "json", logLevel: "error", onlyCategories: ["performance"], extraHeaders: { "Accept-Language": GERMAN_VISITOR } });
        if (r !== undefined && r.lhr.finalDisplayedUrl !== url) throw new Error(`${page} ended on ${r.lhr.finalDisplayedUrl}, not the page it names`);
        const m = metricsOf(r?.lhr.audits);
        if (m !== null) rs.push(m);
        // what the main thread spent its time on, per run, for a page whose blocking time is over budget
        if (m !== null && m.tbtMs > BUDGET.tbtMs) console.log(`  (${page}: TBT ${String(Math.round(m.tbtMs))} ms — ${breakdownOf(r?.lhr.audits)})`);
      }
      if (attempts > RUNS) console.log(`  (${page}: ${String(attempts)} attempts for ${String(rs.length)} complete runs)`);
      runs.set(page, { status, runs: rs });
    }
    const v = judgeBudget(runs);
    for (const l of v.lines) console.log(l);
    code = v.code;
  } catch (e) {
    console.log(`✗ page budget: could not check — ${(e as Error).message}`);
  } finally {
    chrome.kill();
    await new Promise<void>((done) => front.close(() => done()));
    if (planted !== null) await new Promise<void>((done) => planted.close(() => done()));
    shell.kill();
    await digest.close();
  }
  process.exit(code);
}
