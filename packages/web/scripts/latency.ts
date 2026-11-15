/**
 * The latency gate (#381 item 8), against the BUILT shell:
 *   1. 200 sequential requests to /de with a healthy stub digest: p95 ≤ 300 ms;
 *   2. with every tile delayed to 1.9 s (the #256 figure, just under the 2 s
 *      tile deadline): since #564 (render-then-fill, owner 2026-10-12) /de
 *      answers 200 within `FIRST_RENDER_MAX_MS` — the 500 ms panel deadline
 *      plus margin, where it took 1 962 ms before — every tile a LOADING
 *      placeholder (never an error: the source is slow, not broken), and the
 *      placeholder's own `/fragment/tile` answers the tile within 2.5 s;
 *   3. with every tile HANGING past the deadline: /de still answers 200
 *      within `FIRST_RENDER_MAX_MS` with loading placeholders (it took
 *      2 047 ms before), and the background fill of one of them is refused
 *      within 2.5 s, so the page turns it into its error state (#378 isolation);
 *   4. #1111 AC 7 (2.5.8): 200 POSTs to the header's /fragment/suggest against
 *      the stub digest, p95 ≤ 300 ms; the same with the site search's answer
 *      hanging (one kind late), p95 still ≤ `SUGGEST_LATE_MAX_MS` and every
 *      answer a 200; and a cold /de/search?q= over a digest whose search
 *      hangs answers 200 within the two-second ceiling.
 * Exit 1 names the case over its bound; exit 2 is "could not check" (no
 * answer at all, or fewer samples than asked).
 *
 *   npm run build -w @viafrei/web && npx tsx packages/web/scripts/latency.ts
 */
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { startShell } from "../e2e/server.js";
import { startStubDigest } from "../e2e/stub-digest.js";

export const N = 200;
export const P95_MAX_MS = 300;
export const SLOW_MAX_MS = 2500;
/** The first render with a slow or hanging digest (#564): the 500 ms panel deadline plus margin for the render itself. */
export const FIRST_RENDER_MAX_MS = 900;
/** #1111 AC 7: the header's suggestion with one half hanging — its 300 ms deadline plus margin for the answer itself. */
export const SUGGEST_LATE_MAX_MS = 400;
/** #1111 AC 7: the two-second ceiling of a cold page (owner 2026-10-26), for the search page over a hanging digest. */
export const SEARCH_COLD_MAX_MS = 2000;

export function p95(xs: readonly number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(s.length * 0.95) - 1)]!;
}

async function timed(url: string, init?: RequestInit): Promise<{ ms: number; status: number; body: string }> {
  const t0 = performance.now();
  const r = await fetch(url, init);
  const body = await r.text();
  return { ms: performance.now() - t0, status: r.status, body };
}

/** The header's suggestion POST (#1153), `{ q, lang }` — what was typed travels in the body. */
const suggestPost = (q: string): RequestInit => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q, lang: "de" }) });
/** Twenty names, asked in turn: places, a motorway, a station, a junction, a typo. */
const SUGGEST_QS = ["Köln", "A7", "Köln Hbf", "Kassel", "Berlin", "Weinsberger Kreuz", "Kevlaer", "München", "A4", "Hamburg", "Dresden", "Leipzig-Süd", "Heiligenhaus", "Datenschutz", "B51", "Mainz", "Bonn", "Ulm", "Kiel", "Trier"];

async function suggestRound(port: number): Promise<{ readonly ms: number[]; readonly bad: number }> {
  const ms: number[] = [];
  let bad = 0;
  for (let i = 0; i < N; i++) {
    const r = await timed(`http://127.0.0.1:${port}/fragment/suggest`, suggestPost(SUGGEST_QS[i % SUGGEST_QS.length]!));
    if (r.status !== 200) bad++;
    ms.push(r.ms);
  }
  return { ms, bad };
}

/** A digest whose every answer is delayed by `ms` — the slow-source case. */
async function slowDigest(ms: number): Promise<{ url: string; close: () => Promise<void> }> {
  const inner = await startStubDigest({});
  const server = createServer((req, res) => {
    // Only a tile path is forwarded, and only to the stub's own origin: the
    // proxy never builds a URL out of whatever a request carried (S5144).
    const path = /^\/internal\/tiles\/[a-z-]+(\?[a-z]+=[a-z]+(&[a-z]+=[a-z]+)*)?$/.exec(req.url ?? "")?.[0];
    if (path === undefined) {
      res.writeHead(404).end();
      return;
    }
    const target = new URL(path, inner.url);
    setTimeout(() => {
      void fetch(target).then(async (r) => {
        res.writeHead(r.status, { "Content-Type": r.headers.get("content-type") ?? "text/html" });
        res.end(await r.text());
      });
    }, ms);
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  const port = (server.address() as AddressInfo).port;
  return { url: `http://127.0.0.1:${port}`, close: async () => { server.close(); await inner.close(); } };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const lines: string[] = [];
  let code: 0 | 1 | 2 = 0;
  const fail = (m: string): void => { lines.push(`✗ ${m}`); code = code === 2 ? 2 : 1; };
  try {
    // 1. healthy
    const healthy = await startStubDigest({});
    const s1 = await startShell(18981, { DIGEST_URL: healthy.url });
    const ms: number[] = [];
    for (let i = 0; i < N; i++) {
      const r = await timed("http://127.0.0.1:18981/de");
      if (r.status !== 200) throw new Error(`request ${i + 1} answered ${r.status}`);
      ms.push(r.ms);
    }
    s1.kill(); await healthy.close();
    if (ms.length !== N) { code = 2; lines.push(`✗ latency: could not check — ${ms.length} of ${N} samples`); }
    const q = p95(ms);
    lines.push(`  healthy: ${N} requests, p95 ${q.toFixed(0)} ms (bound ${P95_MAX_MS})`);
    if (q > P95_MAX_MS) fail(`p95 ${q.toFixed(0)} ms > ${P95_MAX_MS} ms`);

    // 2. every tile 1.9 s slow
    const slow = await slowDigest(1900);
    const s2 = await startShell(18982, { DIGEST_URL: slow.url });
    const r2 = await timed("http://127.0.0.1:18982/de");
    const f2 = await timed("http://127.0.0.1:18982/fragment/tile?id=fuel&lang=de");
    s2.kill(); await slow.close();
    lines.push(`  tiles at 1.9 s: first render HTTP ${r2.status} in ${r2.ms.toFixed(0)} ms (bound ${FIRST_RENDER_MAX_MS}); background fill HTTP ${f2.status} in ${f2.ms.toFixed(0)} ms (bound ${SLOW_MAX_MS})`);
    if (r2.status !== 200 || r2.ms > FIRST_RENDER_MAX_MS) fail(`with 1.9 s tiles the first render took ${r2.ms.toFixed(0)} ms / HTTP ${r2.status}`);
    if (r2.body.includes('class="tile is-error"')) fail("with 1.9 s tiles (inside the 2 s deadline) a tile fell into its error state instead of loading");
    if (!r2.body.includes('class="tile is-loading"')) fail("with 1.9 s tiles no tile was a loading placeholder");
    if (f2.status !== 200 || f2.ms > SLOW_MAX_MS || !f2.body.startsWith('<section class="tile is-')) fail(`the background fill of a 1.9 s tile took ${f2.ms.toFixed(0)} ms / HTTP ${f2.status}`);

    // 3. every tile hanging past the deadline
    const hang = await startStubDigest(Object.fromEntries(["reports", "roads", "charging", "lorry", "lifts", "fuel", "punctuality", "transit"].map((id) => [id, "hang"])), 8000);
    const s3 = await startShell(18983, { DIGEST_URL: hang.url });
    const r3 = await timed("http://127.0.0.1:18983/de");
    const f3 = await timed("http://127.0.0.1:18983/fragment/tile?id=fuel&lang=de");
    s3.kill(); await hang.close();
    lines.push(`  tiles hanging: first render HTTP ${r3.status} in ${r3.ms.toFixed(0)} ms (bound ${FIRST_RENDER_MAX_MS}); background fill HTTP ${f3.status} in ${f3.ms.toFixed(0)} ms (bound ${SLOW_MAX_MS})`);
    if (r3.status !== 200 || r3.ms > FIRST_RENDER_MAX_MS) fail(`with hanging tiles the first render took ${r3.ms.toFixed(0)} ms / HTTP ${r3.status}`);
    if (!r3.body.includes('class="tile is-loading"')) fail("with hanging tiles no tile was a loading placeholder");
    // The fill is refused, never a hang: the placeholder then turns into the error state (test/fill.test.ts).
    if (f3.status !== 502 || f3.ms > SLOW_MAX_MS) fail(`the background fill of a hanging tile answered HTTP ${f3.status} in ${f3.ms.toFixed(0)} ms`);

    // 4. #1111 AC 7: the header's suggestions, healthy and with the site search hanging; the search page, cold
    const h4 = await startStubDigest({});
    const s4 = await startShell(18984, { DIGEST_URL: h4.url });
    const fast = await suggestRound(18984);
    s4.kill(); await h4.close();
    if (fast.ms.length !== N) { code = 2; lines.push(`✗ latency: could not check — ${fast.ms.length} of ${N} suggestion samples`); }
    const q4 = p95(fast.ms);
    lines.push(`  suggest: ${N} POSTs, p95 ${q4.toFixed(0)} ms (bound ${P95_MAX_MS}), ${fast.bad} not a 200`);
    if (q4 > P95_MAX_MS || fast.bad > 0) fail(`suggest p95 ${q4.toFixed(0)} ms / ${fast.bad} not a 200`);
    const late = await startStubDigest({ search: "hang" }, 8000);
    const s5 = await startShell(18985, { DIGEST_URL: late.url });
    const slowSuggest = await suggestRound(18985);
    const cold = await timed("http://127.0.0.1:18985/de/search?q=Kevlaer");
    s5.kill(); await late.close();
    const q5 = p95(slowSuggest.ms);
    lines.push(`  suggest, site search hanging: ${N} POSTs, p95 ${q5.toFixed(0)} ms (bound ${SUGGEST_LATE_MAX_MS}), ${slowSuggest.bad} not a 200`);
    if (q5 > SUGGEST_LATE_MAX_MS || slowSuggest.bad > 0) fail(`with the site search hanging the suggest p95 was ${q5.toFixed(0)} ms / ${slowSuggest.bad} not a 200`);
    lines.push(`  search page, digest hanging: HTTP ${cold.status} in ${cold.ms.toFixed(0)} ms (bound ${SEARCH_COLD_MAX_MS})`);
    if (cold.status !== 200 || cold.ms > SEARCH_COLD_MAX_MS) fail(`the cold search page over a hanging digest took ${cold.ms.toFixed(0)} ms / HTTP ${cold.status}`);
  } catch (e) {
    code = 2;
    lines.push(`✗ latency: could not check — ${(e as Error).message}`);
  }
  for (const l of lines) console.log(l);
  if (code === 0) console.log("✓ latency: p95 and the slow-source bounds hold");
  process.exit(code);
}
