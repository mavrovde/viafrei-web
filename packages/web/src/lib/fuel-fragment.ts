/**
 * The deferred fuel fragments, the parts both pages share (#716 motorway
 * layer, #1065 place card; steward ruling M14–M22): the headers every answer
 * carries, the shape check, the read of the digest's fragment, the #712
 * re-read wrapper, and the browser's re-read loop. `motorway-fuel.ts` and
 * `place-fuel.ts` hold only what differs — the query, the route's ask, and
 * WHEN the page asks (the card coming into view
 * on a place page).
 */
import { FUEL_FILL_MAX_MS, FUEL_FILL_MIN_MS, FUEL_FILL_RETRY_MS } from "./fuel-refresh.js";
import { digestFetch } from "./agent-class.js";
import type { FetchLike, TileFetchOptions } from "./tiles.js";

/** (b): every answer, the sentence included — no shared cache keeps a copy, no index or snippet is made of it. */
export const FUEL_PRIVATE_HEADERS: Readonly<Record<string, string>> = {
  "cache-control": "private, no-store",
  "x-robots-tag": "noindex, nofollow, noarchive, nosnippet",
};
export const FUEL_FRAGMENT_HEADERS: Readonly<Record<string, string>> = { "content-type": "text/html; charset=utf-8", ...FUEL_PRIVATE_HEADERS };

/** An answer with those headers. */
export const fuelAnswer = (status: number, body: string): Response => new Response(body, { status, headers: { ...FUEL_FRAGMENT_HEADERS } });

/** (f): the digest fragment's shape — one `<div class="<root>">`, no script, no style, no `javascript:`, no frame or image. */
export function isFragmentOf(root: string, body: string): boolean {
  return body.startsWith(`<div class="${root}">`) && body.trimEnd().endsWith("</div>") && !/<script|<style|javascript:|<iframe|<img/i.test(body);
}

/** The fragment wrapped to be re-read (#712): the delay and the poll count ride on its own root tag. */
export function refillOf(root: string, body: string, delayMs: number, polls: number, head = 0): string {
  return body.replace(`<div class="${root}">`, `<div class="${root}" data-vf-refill="${String(Math.ceil(delayMs))}" data-vf-polls="${String(polls)}" data-vf-head="${String(head)}">`);
}

/** The digest's `Fuel-Ask` point, by its own shape only (a `pt:` key, 4 decimals); anything else asks nothing. */
export function fuelAskOf(v: string | null): string | null {
  return v !== null && /^pt:-?\d{1,2}\.\d{1,4},-?\d{1,3}\.\d{1,4}$/.test(v) ? v : null;
}

/** One read of the digest's fragment: the body when it has the shape (of any of the roots given), and the `Fuel-Ask` point it names; null for anything else. */
export async function readFuelFragment(url: string, o: TileFetchOptions, root: string | readonly string[]): Promise<{ readonly body: string; readonly ask: string | null } | null> {
  const fetchImpl: FetchLike = o.fetchImpl ?? ((u, init) => digestFetch(u, init));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), o.timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: controller.signal, headers: { accept: "text/html" } });
    if (res.status !== 200) return null;
    const body = await res.text();
    return (typeof root === "string" ? [root] : root).some((r) => isFragmentOf(r, body)) ? { body, ask: fuelAskOf(res.headers.get("fuel-ask")) } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The browser's half, as script text for a page's one inline script: declares
 * `load(n, h)` — fetch `path` with the query `params` builds (statements
 * declaring `p`, a `URLSearchParams`), check the root, put it in `o` (the output element, a
 * name the caller binds) — `shown()` — resolved while the page is visible
 * (and, with `prerender`, not prerendering), so nothing is asked from a hidden
 * or speculative page —
 * and `again(…)`, the #712 re-read of an answer the route wrapped
 * (`data-vf-refill`), while it is still the one shown, at the clamped delay —
 * and never while a person has a pager fold of it open (#1061 review B7: the
 * re-read replaced the list and closed the fold under them); it waits another
 * delay and reads once the fold is closed.
 * The caller decides when `load(0, 0)` is first called.
 */
export function fuelLoaderJs(o: { readonly path: string; readonly root: string; readonly params: string }): string {
  // Both callers ask on a person's VIEW (PF2: the place card, and since 2026-10-26 the motorway layer), so a
  // prerendered page waits until it is shown; a click no longer starts any load.
  const visible = `document.hidden!==true&&document.prerendering!==true`;
  const events = ["visibilitychange", "prerenderingchange"];
  return (
    `const load=async(n,h)=>{${o.params}if(n>0){p.set("polls",String(n));p.set("head",String(h||0))}const r=await fetch(${JSON.stringify(o.path)}+"?"+p.toString(),{credentials:"same-origin",headers:{accept:"text/html"}});const t=await r.text();if(!r.ok||!/^<div class="${o.root}[" ]/.test(t)||/<script/i.test(t))throw new Error("fuel");o.innerHTML=t;const e=o.firstElementChild,d=e?Number(e.getAttribute("data-vf-refill")):0,c=e?Number(e.getAttribute("data-vf-polls")):0,k=e?Number(e.getAttribute("data-vf-head")):0;if(d>0&&c>0)again(e,c,k,d)};` +
    `const shown=()=>${visible}?Promise.resolve():new Promise(r=>{const v=()=>{if(${visible}){${events.map((e) => `document.removeEventListener("${e}",v);`).join("")}r()}};${events.map((e) => `document.addEventListener("${e}",v)`).join(";")}});` +
    `const again=(e,c,k,d)=>{setTimeout(async()=>{await shown();if(!o.isConnected||o.firstElementChild!==e)return;if(o.querySelector(".pager[open]")){again(e,c,k,d);return}try{await load(c,k)}catch(x){again(e,c,k,${String(FUEL_FILL_RETRY_MS)})}},Math.min(Math.max(d,${String(FUEL_FILL_MIN_MS)}),${String(FUEL_FILL_MAX_MS)}))};`
  );
}
