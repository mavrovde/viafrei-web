/**
 * #1184 phase 2: the overload challenge (data-steward ruling 2026-11-04, P1–P6).
 *
 * While the digest says its person pool is saturated (`pressure.ts`), a request for a page that reads the database
 * (`DB_PAGE`) is served to a verified search engine or AI assistant (`verified-class.ts`), to a browser holding a
 * valid pass (`pass.ts`) and, since #1205, to every client within its share of the pool (`trip.ts`). A client past
 * its share gets the interim page: a 503 (so it is not a page view, P5, and an unverified
 * robot reads "come back later"), `no-store`, `X-Robots-Tag: noindex`, in the page's language, with the Impressum and
 * Datenschutz links, no analytics and no consent bar (P6). Its one script, under this request's CSP nonce, solves the
 * proof-of-work over the challenge the page carries and POSTs the answer to `PASS_ROUTE`; the server answers it with
 * the HttpOnly `Set-Cookie` — only while the overload lasts (P2) — and the script reloads the page.
 *
 * The script reads no property of the device and stores nothing (P4): no `navigator`, `screen`, canvas, WebGL,
 * audio, fonts, time zone, plugins, battery, storage or `document.cookie`. It uses `crypto.subtle`, `TextEncoder`,
 * `fetch` to this origin, `location` and `history.replaceState` (#1205, to drop its own mark from the address). It marks one reload in the address's fragment (`#vf-pass=<the challenge's second>`), so a browser
 * that keeps no cookie sees the sentence and a "try again" link instead of a loop; since #1205 the mark is removed
 * from the address at once and binds only the reload right after the answer, so it cannot outlive the attempt.
 *
 * #1205: the challenge trips PER CLIENT (`trip.ts`): while the pool is saturated, only a client past its share of
 * database pages is answered the interim page, and a verified search engine or AI assistant (class `search`) never is.
 *
 * No cookie, no verdict, no address and no User-Agent reaches a log line (P5): no line is written per request; a
 * refusal is only counted under its class and family (`trip.ts` `refusalLabel`), and the counts are written as hourly
 * sums (P9; data-steward 2026-11-13, T1–T8). Without the overload none of this runs: no
 * request is challenged or counted and no `Set-Cookie` of it is sent (P2).
 */
import { t } from "../i18n/index.js";
import { isLang } from "../i18n/index.js";
import { DEFAULT_LANG, pathFor, type Lang } from "../site/pages.js";
import { SECURITY_HEADERS } from "../security/csp.js";
import { CHALLENGE_COPY } from "./copy.js";
import type { AgentClass } from "../lib/agent-class.js";
import type { CrawlerVerifier } from "./crawler-verify.js";
import { requestAgentClass } from "./verified-class.js";
import { refusalLabel, type ClientTrip, type TripOutcome } from "./trip.js";
import { passOf, POW_BITS, type PassBook } from "./pass.js";
import type { Pressure } from "./pressure.js";

/** Where the script posts its answer. */
export const PASS_ROUTE = "/_vf/pass";
/** The pages a walk costs the database for: a place, a station, a motorway, a road, a Land, a charging site, a fuel page. */
export const DB_PAGE = /^\/([a-z]{2})\/(?:place|station|autobahn|road|state|charging|fuel)\/[^/]/;
export const RETRY_AFTER_S = 60;
/** How long after the challenge's server second its reload guard still stops the page (#1205): the reload right after the answer, never a later visit. Handed to the script as `data-guard`. */
export const GUARD_S = 30;

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return -- runs in a browser, serialised with toString; `any` is the honest type */
/**
 * The interim page's script. Self-contained ON PURPOSE (serialised with `toString`): it references only its parameter
 * and the browser's globals through `w`. `test/overload.test.ts` scans this very text for the APIs P4 forbids.
 */
export function solvePass(w: any): void {
  const d = w.document;
  const el = d.getElementById("vf-pass");
  if (el === null) return;
  const note = d.getElementById("vf-pass-note");
  const stop = (): void => {
    if (note !== null) note.hidden = false;
  };
  const c: string = el.getAttribute("data-c") ?? "";
  const bits = Number(el.getAttribute("data-bits") ?? "0");
  const guardS = Number(el.getAttribute("data-guard") ?? "0");
  // #1205: the reload guard names the SERVER's second of the challenge it answered (`#vf-pass=<s>`), and this page's
  // challenge carries the server's second too, so no clock of the device is read. It is dropped from the address at
  // once, so a reload, a bookmark or a shared link starts a new attempt; and it stops this page only when that page
  // is the reload right after the answer (`GUARD_S`). A bare `#vf-pass` (the guard before #1205) never stops a page.
  const issued = Number(/^c1\.(\d+)\./.exec(c)?.[1] ?? "NaN");
  const guard = /^#vf-pass(?:=(\d+))?$/.exec(String(w.location.hash));
  if (guard !== null) {
    w.history?.replaceState?.(null, "", `${w.location.pathname}${w.location.search}`);
    if (guard[1] !== undefined && issued - Number(guard[1]) <= guardS) return stop();
  }
  const subtle = w.crypto?.subtle;
  if (c === "" || !(bits > 0) || subtle === undefined) return stop();
  const enc = new w.TextEncoder();
  const zero = (buf: ArrayBuffer): boolean => {
    const b = new Uint8Array(buf);
    let left = bits;
    for (let i = 0; i < b.length && left > 0; i++) {
      if (left >= 8) {
        if (b[i] !== 0) return false;
        left -= 8;
      } else return b[i]! >> (8 - left) === 0;
    }
    return true;
  };
  const BATCH = 128;
  const run = (from: number): Promise<number> =>
    Promise.all(Array.from({ length: BATCH }, (_, k) => subtle.digest("SHA-256", enc.encode(`${c}.${from + k}`)))).then((hs: ArrayBuffer[]) => {
      for (let k = 0; k < hs.length; k++) if (zero(hs[k]!)) return from + k;
      return from + BATCH < 1 << 22 ? run(from + BATCH) : -1;
    });
  run(0)
    .then((n) => {
      if (n < 0) return stop();
      return w
        .fetch("/_vf/pass", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ c, n }), credentials: "same-origin" })
        .then((res: any) => {
          if (res.status !== 204) return stop();
          w.location.hash = `vf-pass=${String(issued)}`;
          w.location.reload();
        });
    })
    .catch(stop);
}
/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The interim page (P6). `retry`: this address without its fragment, the "try again" link of a stopped attempt (#1205). */
export function challengePage(lang: Lang, challenge: string, nonce: string, retry = "/"): string {
  const copy = CHALLENGE_COPY[lang];
  const imprint = pathFor("impressum", lang);
  const privacy = pathFor("datenschutz", lang);
  return (
    `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<meta name="robots" content="noindex"><title>ViaFrei</title>` +
    `<style nonce="${nonce}">body{font:16px/1.5 system-ui,sans-serif;max-width:36rem;margin:3rem auto;padding:0 1rem;color:#1a1a1a;background:#fff}` +
    `@media (prefers-color-scheme:dark){body{color:#eee;background:#111}a{color:#9cf}}footer{margin-top:2rem;font-size:.875rem}</style></head>` +
    `<body><main><p id="vf-pass" data-c="${esc(challenge)}" data-bits="${String(POW_BITS)}" data-guard="${String(GUARD_S)}">${esc(copy.line)}</p>` +
    `<p id="vf-pass-note" hidden>${esc(copy.noscript)} <a id="vf-pass-retry" href="${esc(retry)}">${esc(copy.retry)}</a></p><noscript><p>${esc(copy.noscript)}</p></noscript></main>` +
    `<footer><a href="${imprint}">${esc(t(lang, "footer.imprint"))}</a> · <a href="${privacy}">${esc(t(lang, "footer.privacy"))}</a></footer>` +
    `<script nonce="${nonce}">(${solvePass.toString()})(window);</script></body></html>`
  );
}

/** The interim page's policy: its own nonce for its script and style, fetches to this origin only. */
export const challengePolicy = (nonce: string): string =>
  `default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; connect-src 'self'; img-src 'self'`;

export type OverloadDeps = {
  readonly pressure: Pressure;
  readonly passes: PassBook;
  readonly crawlers: CrawlerVerifier;
  readonly clientIp: (headers: Headers) => string | null;
  /** #1205: who is past their share of the saturated pool. */
  readonly trip: ClientTrip;
};

/**
 * The gate: null to serve the page as always, or the interim page. Asks the pressure first, and nothing else when the
 * pool is not saturated — no cookie read, no lookup, nothing counted (P2, P7). While it is saturated (#1205): a
 * verified search engine or AI assistant is served; a client holding a pass is served; a client within its share
 * (`trip.ts`) is served; only a client past it is answered the interim page, and that refusal is counted and logged
 * by class. `cls` is the request's class as the middleware decided it (`verified-class.ts`); left out, it is decided
 * here the same way.
 */
export async function overloadGate(req: Request, url: URL, nonce: string, d: OverloadDeps, cls?: AgentClass | null): Promise<Response | null> {
  if (req.method !== "GET" && req.method !== "HEAD") return null;
  const m = DB_PAGE.exec(url.pathname);
  if (m === null) return null;
  if (!(await d.pressure.saturated())) {
    d.trip.idle();
    return null;
  }
  // owner 2026-11-12: a verified search engine or AI assistant is never refused, and never counted against anybody
  const c = cls === undefined ? await requestAgentClass(req.headers, d) : cls;
  const outcome: TripOutcome | null =
    c === "search" ? "exempt_verified" : d.passes.admit(passOf(req.headers.get("cookie"))) ? "pass" : d.trip.over(d.clientIp(req.headers)) ? null : "served";
  if (outcome !== null) {
    d.trip.count(outcome);
    return null;
  }
  d.trip.count("refused", refusalLabel(c, req.headers.get("user-agent")));
  const lang = isLang(m[1] ?? "") ? (m[1] as Lang) : DEFAULT_LANG;
  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex",
    "Retry-After": String(RETRY_AFTER_S),
    "Content-Security-Policy": challengePolicy(nonce),
  });
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
  return new Response(req.method === "HEAD" ? null : challengePage(lang, d.passes.challenge(), nonce, `${url.pathname}${url.search}`), { status: 503, headers });
}

/**
 * `POST /_vf/pass` `{ c, n }`: a solved challenge earns a pass — the `Set-Cookie` only while the overload lasts (P2);
 * without it the answer is the same 204 with no cookie, and the reload is served as always. A wrong answer is a 400.
 */
export async function passRoute(req: Request, d: OverloadDeps): Promise<Response> {
  const headers = new Headers({ "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'" });
  if (req.method !== "POST") return new Response(null, { status: 405, headers });
  // the page's own script only: a same-origin fetch
  if (req.headers.get("sec-fetch-site") !== null && req.headers.get("sec-fetch-site") !== "same-origin") return new Response(null, { status: 403, headers });
  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > 512) return new Response(null, { status: 413, headers });
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400, headers });
  }
  const b = body as { c?: unknown; n?: unknown } | null;
  if (b === null || typeof b !== "object" || !d.passes.solve(b.c, b.n)) return new Response(null, { status: 400, headers });
  if (await d.pressure.saturated()) headers.append("Set-Cookie", d.passes.setCookie());
  return new Response(null, { status: 204, headers });
}
