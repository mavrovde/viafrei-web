/**
 * #707: the SID clickwrap on the site (data-steward draft 707 § B.2, owner-approved 2026-10-26).
 *
 * Every place where a Toll Collect SID truck-parking figure would appear — the lorry card of a place, the motorway
 * page's parking card — is rendered by the digest with the static site data and a gate (`.sid-gate`): the button,
 * the acceptance sentence with the link to `/terms#sid`, the sites' ids. No figure is in the HTML. The figures are
 * fetched only by the click:
 *
 *  - the script below shows the button (it is `hidden` without script — nothing can be clicked, so nothing is
 *    loaded), and on a click POSTs `{ ids, lang, accept }` to `/fragment/sid`, with a 2 s deadline (the owner's
 *    two-second ceiling: a slow answer is that card's error line, and the button can be clicked again);
 *  - `/fragment/sid` asks the digest's internal `/internal/sid/occupancy` with the same three, and passes on only
 *    an answer shaped like the figures block. Without the token it refuses with a 403 before the digest is asked.
 *
 * Nothing is stored (no cookie, no storage: the click reveals the figures for this page view) and nothing about the
 * request is logged by this process. The token is versioned with section 2 of the terms (`SID_ACCEPT_TOKEN` in
 * @viafrei/ingest, which this package may not import — `test/sid.test.ts` holds the two equal).
 */
import { isLang } from "../i18n/index.js";
import { INLINE_SCRIPTS } from "./inline-scripts.js";
import { digestFetch } from "./agent-class.js";
import type { FetchLike, TileFetchOptions } from "./tiles.js";

/** The public route. */
export const SID_ROUTE = "/fragment/sid";
/** The digest's internal route (`packages/digest/src/server/app.ts` `SID_ROUTE`). */
export const SID_DIGEST_PATH = "/internal/sid/occupancy";
/** The click's token: section 2 of the terms, version 1. */
export const SID_ACCEPT = "sid-terms-1";
/** The visitor waits at most this long (owner 2026-10-26, the two-second ceiling). */
export const SID_DEADLINE_MS = 2_000;

/** Every answer: one person's click, never cached, never indexed. */
export const SID_HEADERS: Readonly<Record<string, string>> = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
};

const IDS = /^[1-9][0-9]{0,18}(?:,[1-9][0-9]{0,18}){0,39}$/;
/** What the digest's answer begins with. */
const SHAPE = /^<div class="sid-figures">/;
const MAX_BODY = 2_048;

const refuse = (status: number, extra: Record<string, string> = {}): Response => new Response("", { status, headers: { ...SID_HEADERS, ...extra } });

/** The request's three fields, or null when one is missing or malformed. The token is checked apart (403, not 400). */
async function fieldsOf(req: Request): Promise<{ ids: string; lang: string; accept: unknown } | null> {
  if (!(req.headers.get("content-type") ?? "").startsWith("application/json")) return null;
  const text = await req.text();
  if (text.length > MAX_BODY) return null;
  try {
    const v: unknown = JSON.parse(text);
    if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
    const b = v as Record<string, unknown>;
    const ids = b["ids"];
    const lang = b["lang"];
    if (typeof ids !== "string" || !IDS.test(ids) || typeof lang !== "string" || !isLang(lang)) return null;
    return { ids, lang, accept: b["accept"] };
  } catch {
    return null;
  }
}

/**
 * POST `/fragment/sid`: 403 without the click's token (the digest is not asked), 400 for a malformed request, the
 * figures block on 200, 504 past the deadline, 502 for anything else the digest answers.
 */
export async function sidRoute(req: Request, o: Pick<TileFetchOptions, "baseUrl" | "timeoutMs" | "fetchImpl">): Promise<Response> {
  if (req.method !== "POST") return refuse(405, { allow: "POST" });
  const f = await fieldsOf(req);
  if (f === null) return refuse(400);
  if (f.accept !== SID_ACCEPT) return refuse(403);
  const target = `${o.baseUrl}${SID_DIGEST_PATH}?ids=${f.ids}&lang=${f.lang}&accept=${SID_ACCEPT}`;
  try {
    const get: FetchLike = o.fetchImpl ?? ((url, init) => digestFetch(url, init));
    const r = await get(target, { signal: AbortSignal.timeout(Math.min(o.timeoutMs, SID_DEADLINE_MS)), headers: { accept: "text/html" } });
    const body = r.status === 200 ? await r.text() : "";
    if (r.status !== 200 || !SHAPE.test(body)) return refuse(502);
    return new Response(body, { status: 200, headers: { ...SID_HEADERS } });
  } catch {
    return refuse(504);
  }
}

/**
 * The click script. Shows every gate's button (also in cards swapped in later: the island, the motorway filter and
 * the pager announce `vf:loaded`), and on a click fetches the figures into the gate's output. Stores nothing.
 */
export const SID_JS = `function scan() {
  Array.prototype.forEach.call(document.querySelectorAll(".sid-gate .sid-gate__btn[hidden]"), function (b) { b.hidden = false; });
}
document.addEventListener("click", function (e) {
  var b = e.target && e.target.closest ? e.target.closest(".sid-gate__btn") : null;
  var g = b ? b.closest(".sid-gate") : null;
  if (!g || g.getAttribute("aria-busy") === "true") return;
  var out = g.querySelector(".sid-gate__out");
  if (!out) return;
  g.setAttribute("aria-busy", "true");
  b.disabled = true;
  out.textContent = out.getAttribute("data-sid-loading") || "";
  var ctl = typeof AbortController === "function" ? new AbortController() : null;
  var timer = ctl ? setTimeout(function () { ctl.abort(); }, ${String(SID_DEADLINE_MS)}) : 0;
  var body = JSON.stringify({ ids: g.getAttribute("data-sid-ids"), lang: g.getAttribute("data-sid-lang"), accept: g.getAttribute("data-sid-accept") });
  fetch("${SID_ROUTE}", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: body, signal: ctl ? ctl.signal : undefined }).then(function (r) {
    if (r.status !== 200) throw new Error(String(r.status));
    return r.text();
  }).then(function (html) {
    clearTimeout(timer);
    var t = document.createElement("template");
    t.innerHTML = html;
    var f = t.content.firstElementChild;
    if (!f || f.className !== "sid-figures") throw new Error("shape");
    out.textContent = "";
    out.appendChild(f);
    b.hidden = true;
    g.removeAttribute("aria-busy");
  }).catch(function () {
    clearTimeout(timer);
    out.textContent = out.getAttribute("data-sid-error") || "";
    b.disabled = false;
    g.removeAttribute("aria-busy");
  });
});
document.addEventListener("vf:loaded", scan);
scan();
// 2.4.6: and on the cards a station page puts in place of its loading block
document.addEventListener("vf:swapped", scan);`;

/** The click script for a page that can carry a gate. */
export function sidScript(): string {
  return `(${INLINE_SCRIPTS.sid})();`;
}

/** Whether a fragment carries a gate. */
export const carriesSid = (html: string): boolean => html.includes('class="sid-gate"');
