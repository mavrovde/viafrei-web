/**
 * #939: a place card (and, since #1042, a station page's live card) refreshed in place — the ↻ in every card's head and, for a live card, a quiet refresh at its
 * own cadence, without reloading the page. Only the card's own fragment is asked again: `/fragment/card` proxies the
 * digest's `/internal/place/<slug>/card/<card>`, which renders the card exactly as the place page does from the same
 * 60 s cache (no provider call), with its DATA version as the validator: `If-None-Match` on unchanged data is a 304
 * with no body. The answer is never indexed (`noindex`), `/fragment/` is disallowed in every robots.txt, and the
 * page rate limit covers it (nginx, every non-asset path).
 *
 * The cadence of each card is the digest's table (`cards/refresh.ts`), carried on the card as `data-refresh` — this
 * script holds no cadence of its own.
 */
import { isLang } from "../i18n/index.js";
import { INLINE_SCRIPTS } from "./inline-scripts.js";
import { mapQuery, type FetchLike, type TileFetchOptions } from "./tiles.js";
import { isPlaceSlug } from "../site/places.js";
import { PLACE_PAGER_CARDS } from "./card-more.js";
import { isStationSlug } from "../site/stations.js";
import { stationLiveChoice } from "./station.js";
import { CHARGING_FILTER_PAIR_SOURCE, EVF_SUBMIT_JS, chargingFilterTail } from "./charging-filter.js";
import { digestFetch } from "./agent-class.js";
import { askAgain, RETRY_WAITS_MS } from "./fragment-retry.js";

/** The public route (the digest's `CARD_FRAGMENT_PATH`). */
export const CARD_REFRESH_ROUTE = "/fragment/card";

/** Headers of every answer: one person's card, revalidated on every ask, never indexed. */
export const CARD_REFRESH_HEADERS: Readonly<Record<string, string>> = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "private, no-cache",
  "X-Robots-Tag": "noindex, nofollow",
};

/** What the digest's answer begins with: the card's article. */
// a card is an article; the Ampel (#1114) a region of the same class
const SHAPE = /^<(?:article|div role="region") class="pcard[ "]/;
/** The validator the digest sends (`cardEtag`, with the platform before the closing quote for android and ios). */
const ETAG = /^"cd-[0-9a-f]{24}(?:-(?:android|ios))?"$/;
/**
 * #1042 caching criterion: the header a station's live card may pass on — the digest's own, counted from the card's
 * read (`stationLiveCacheControl`: `public, max-age=60, stale-while-revalidate=600` for a value read this instant).
 * Only a station card with none of the person's choices is ever public (a choice is one person's board, and the
 * digest answers it `no-store`); a place card stays `private, no-cache`.
 */
const STATION_PUBLIC_CACHE = /^public, max-age=(\d{1,3}), stale-while-revalidate=(\d{1,3}), stale-if-error=\2$/;
/** Whether the card's answer may be kept by a cache: a bare station live card whose digest header is the public shape, within its bounds. */
export function stationCardCacheControl(params: URLSearchParams, digestHeader: string | null): string | null {
  const station = params.get("station");
  if (station === null || params.get("area") === "1" || stationLiveChoice(params) !== "" || digestHeader === null) return null;
  const m = STATION_PUBLIC_CACHE.exec(digestHeader);
  if (m === null || Number(m[1]) > 60 || Number(m[2]) > 600) return null;
  return digestHeader;
}

/**
 * The validator a browser sends back, as the digest sent it: an edge that compresses the answer (nginx's gzip) weakens
 * a strong ETag to `W/"…"` (seen on production 2.4.6, 2026-10-28), and `If-None-Match` compares weakly (RFC 9110
 * § 13.1.2), so the `W/` is dropped before the shape is checked — else every refresh was a full 200.
 */
export function validatorOf(asked: string | null): string | null {
  if (asked === null) return null;
  const v = asked.trim().replace(/^W\//u, "");
  return ETAG.test(v) ? v : null;
}

/** The instant the card's data was read, as the digest sends it. */
const AS_OF = /^\d{4}-\d\d-\d\dT[\d:.]+Z$/;

/** #1042: the station page's live cards, refreshed in place like a place card (`/internal/station/<slug>/card/<card>`). */
export const STATION_LIVE_CARDS = ["board", "arrivals", "lifts", "platforms", "alerts", "nearby", "around"] as const;

/** #1114 (§9.4): the place cards a refresh may ask for, and the Ampel (with its map), which has no pages. */
const isRefreshCard = (card: string): boolean => card === "ampel" || (PLACE_PAGER_CARDS as readonly string[]).includes(card);

/**
 * The digest address of a public request, or null when the request is malformed (the fuel card is never one, #1065).
 * A station card (`station=<slug>`) carries the person's choices of the page it is on (`platform`, `to`, `access`),
 * each by its own shape (`stationLiveChoice`), so a refresh keeps the filtered board; a place card of a station page
 * (`station=<slug>&area=1`, #1084) is the digest's `/internal/station/<slug>/area/<card>`.
 */
export function cardRefreshTarget(params: URLSearchParams, o: Pick<TileFetchOptions, "baseUrl" | "mapPlatform">): string | null {
  const station = params.get("station");
  if (station !== null && params.get("area") === "1") {
    // #1084: a place card of a station page (the cards of its position) — `pages` as on a place card, no other choice
    const card = params.get("card") ?? "";
    const lang = params.get("lang") ?? "";
    const pages = params.get("pages");
    if (!isStationSlug(station) || card === "fuel" || !isRefreshCard(card) || !isLang(lang) || params.has("place")) return null;
    if (pages !== null && (card === "ampel" || !/^(?:[1-9]|[1-9][0-9])$/.test(pages))) return null;
    // #1109: the station's full charging card keeps the filter it was shown under, as a place page's does
    const ev = card === "charging" ? chargingFilterTail(params) : "";
    return `${o.baseUrl}/internal/station/${station}/area/${card}?lang=${lang}${pages === null || pages === "1" ? "" : `&pages=${pages}`}${ev}${mapQuery(o)}`;
  }
  if (station !== null) {
    const card = params.get("card") ?? "";
    const lang = params.get("lang") ?? "";
    if (!isStationSlug(station) || params.has("area") || !(STATION_LIVE_CARDS as readonly string[]).includes(card) || !isLang(lang) || params.has("place") || params.has("pages")) return null;
    const choice = stationLiveChoice(params);
    return `${o.baseUrl}/internal/station/${station}/card/${card}?lang=${lang}${choice === "" ? "" : `&${choice}`}${mapQuery(o)}`;
  }
  const place = params.get("place") ?? "";
  const card = params.get("card") ?? "";
  const lang = params.get("lang") ?? "";
  const pages = params.get("pages");
  if (!isPlaceSlug(place) || card === "fuel" || !isRefreshCard(card) || !isLang(lang)) return null;
  if (pages !== null && (card === "ampel" || !/^(?:[1-9]|[1-9][0-9])$/.test(pages))) return null;
  // #1081: a refreshed charging card keeps the filter it was shown under
  const ev = card === "charging" ? chargingFilterTail(params) : "";
  return `${o.baseUrl}/internal/place/${place}/card/${card}?lang=${lang}${pages === null || pages === "1" ? "" : `&pages=${pages}`}${ev}${mapQuery(o)}`;
}

/** The public route's answer: 200 with the article, 304 and 404 passed on, anything else a 502/504 the script keeps the card through. */
export async function cardRefreshRoute(request: Request, o: TileFetchOptions): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const target = cardRefreshTarget(params, o);
  const refuse = (status: number): Response => new Response("", { status, headers: { ...CARD_REFRESH_HEADERS, "Cache-Control": "no-store" } });
  if (target === null) return refuse(400);
  const asked = validatorOf(request.headers.get("if-none-match"));
  try {
    const get: FetchLike = o.fetchImpl ?? ((url, init) => digestFetch(url, init));
    const r = await get(target, { signal: AbortSignal.timeout(o.timeoutMs), headers: { accept: "text/html", ...(asked !== null ? { "if-none-match": asked } : {}) } });
    const etag = r.headers.get("etag");
    const asOf = r.headers.get("x-fragment-as-of");
    const own: Record<string, string> = { ...CARD_REFRESH_HEADERS };
    // #1042: a bare station live card is a minute's public data, kept by a cache as long as the digest says
    const kept = stationCardCacheControl(params, r.headers.get("cache-control"));
    // (a card's map links follow the visitor's platform, #944: a shared cache keys it by the User-Agent)
    if (kept !== null) {
      own["Cache-Control"] = kept;
      own["Vary"] = "User-Agent";
    }
    if (etag !== null && ETAG.test(etag)) own["ETag"] = etag;
    if (asOf !== null && AS_OF.test(asOf)) own["X-Fragment-As-Of"] = asOf;
    if (r.status === 304) {
      // no body, so no type: the middleware must not take it for a page
      delete own["Content-Type"];
      return new Response(null, { status: 304, headers: own });
    }
    if (r.status === 404) return refuse(404);
    const body = r.status === 200 ? await r.text() : "";
    if (r.status !== 200 || !SHAPE.test(body)) return refuse(502);
    return new Response(body, { status: 200, headers: own });
  } catch {
    return refuse(504);
  }
}

/**
 * The refresh script (#939). Every `.pcard[data-card]` — a card's article, and since #1114 the Ampel's region — is refreshed:
 *  - by hand: a click on its ↻ (`.pcard__refresh`, a real link to the place page at the card without script);
 *  - by itself: every `data-refresh` seconds (the digest's table), never while the tab is hidden (one refresh on return
 *    when it is due), the card is hidden by the topic filter, focus is inside it (other than on its ↻) or a fold of it
 *    is loading, or a stop's departures were paged further (#938 E1: a `data-deps` step is a person's reading, kept
 *    until the ↻ is pressed);
 *  - an expanded card asks `&pages=N` for the N pages it shows (a stop's departure steps are not pages), so a refresh
 *    keeps the expansion (#938);
 *  - a 304 or an identical card changes nothing and announces nothing; a changed card is swapped (its class and its
 *    body, never its id, its `hidden` or its data) and announced once through the polite live region; focus is never
 *    moved — a ↻ that had it gets it back;
 *  - a failure keeps the last card, says "Stand HH:MM – Aktualisierung fehlgeschlagen" (the time of the last good
 *    content, Berlin) and doubles the wait, up to eight times the cadence; the next success clears it;
 *  - a 404 (the place no longer shows the card) stops that card's refreshes; the next page view shows the new state;
 *  - each refresh tells the consent island `vf:card-refresh` (card, manual|auto, changed|unchanged); an automatic one
 *    one time in ten.
 * It stores nothing and sends nothing else. Minified into `src/generated/inline-scripts.json` (`npm run web:inline`).
 */
export const REFRESH_JS = `var LIVE = "vf-card-live";
var lang = document.documentElement.lang || "de";
var fmt = null;
try { fmt = new Intl.DateTimeFormat(lang, { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }); } catch (e) {}
var state = new WeakMap();
function say(t) {
  if (!t) return;
  var live = document.getElementById(LIVE);
  if (!live) {
    live = document.createElement("p");
    live.id = LIVE;
    live.className = "visually-hidden";
    live.setAttribute("aria-live", "polite");
    document.body.appendChild(live);
  }
  live.textContent = "";
  setTimeout(function () { live.textContent = t; }, 50);
}
function st(a) {
  var s = state.get(a);
  if (!s) { s = { etag: null, asOf: new Date(), fails: 0, timer: 0, busy: false, due: 0, stopped: false, waiting: false }; state.set(a, s); }
  return s;
}
function every(a) {
  var n = Number(a.getAttribute("data-refresh"));
  return n > 0 ? n * 1000 : 0;
}
function own(a) { return a.querySelector(".pcard__refresh"); }
// #1081: the charging filter of the address (ev_*) rides with the charging card's every refresh, so it stays filtered
function evq() {
  var q = String(location.search || "").replace(/^\\?/, "").split("&").filter(function (p) { return /${CHARGING_FILTER_PAIR_SOURCE}/.test(p); });
  return q.length ? "&" + q.join("&") : "";
}
function evCard(a) { return a.id === "pcard-charging" || !!a.querySelector("form.evf"); }
function inside(a) {
  var f = document.activeElement;
  return (f && f !== own(a) && a.contains(f)) || !!a.querySelector("details.pager[data-state=loading], details.pager[data-deps][data-state=done]");
}
function failedLine(a, s) {
  var p = a.querySelector(".pcard__refreshfail");
  if (!p) {
    p = document.createElement("p");
    p.className = "pcard__note pcard__refreshfail";
    var head = a.querySelector(".pcard__head");
    if (head && head.parentNode) head.parentNode.insertBefore(p, head.nextSibling);
    else a.insertBefore(p, a.firstChild);
  }
  p.textContent = (a.getAttribute("data-failed") || "").replace("{t}", fmt ? fmt.format(s.asOf) : "");
  return p.textContent;
}
function tell(a, how, result) {
  // #1081 D10: a filter's re-fetch is no refresh, and sends nothing
  if (how === "filter") return;
  if (how === "auto" && Math.random() >= 0.1) return;
  try { document.dispatchEvent(new CustomEvent("vf:card-refresh", { detail: { card: a.id.replace(/^pcard-/, ""), how: how, result: result } })); } catch (e) {}
}
// 2.4.6 (item 3): a fold the person opened stays open through a swap — the board's "Weitere Abfahrten" closed every
// minute under the reader. A fold is known by what its summary controls (the rows fold's tbody id), else by its place
// among the card's folds; a pager fold is not one of them (its pages are asked again, "&pages=N").
function openFolds(a) {
  var out = [];
  Array.prototype.forEach.call(a.querySelectorAll("details"), function (d, i) {
    if (!d.open || d.classList.contains("pager")) return;
    var sum = d.querySelector("summary[aria-controls]");
    out.push(sum ? "#" + sum.getAttribute("aria-controls") : i);
  });
  return out;
}
function reopen(a, keys) {
  if (!keys.length) return;
  var all = a.querySelectorAll("details");
  keys.forEach(function (k) {
    var d = null;
    if (typeof k === "number") d = all[k] || null;
    else Array.prototype.forEach.call(all, function (x) { var sum = x.querySelector("summary[aria-controls]"); if (sum && "#" + sum.getAttribute("aria-controls") === k) d = x; });
    if (d && !d.classList.contains("pager")) d.open = true;
  });
}
function plan(a) {
  var s = st(a);
  clearTimeout(s.timer);
  var e = every(a);
  if (!e || s.stopped) return;
  var wait = e * Math.pow(2, s.fails);
  s.due = Date.now() + wait;
  s.timer = setTimeout(function () { tick(a); }, wait);
}
function tick(a) {
  var s = st(a);
  if (document.hidden) { s.waiting = true; return; }
  if (a.hidden || inside(a)) { plan(a); return; }
  refresh(a, "auto");
}
function refresh(a, how, after) {
  var s = st(a);
  var url = a.getAttribute("data-card");
  if (!url) return;
  // #1081 review 4: a filter changed while a fetch is in flight is fetched once that one lands — never dropped, so the
  // card always ends on the filter the address shows (the in-flight answer is then not shown at all).
  if (s.busy) { if (how === "filter") s.again = after || function () {}; return; }
  var n = a.querySelectorAll("details.pager[data-state=done]:not([data-deps])").length + 1;
  var focused = document.activeElement === own(a);
  s.busy = true;
  s.waiting = false;
  a.setAttribute("aria-busy", "true");
  var h = {};
  if (s.etag) h["If-None-Match"] = s.etag;
  fetch(url + (n > 1 ? "&pages=" + n : "") + (evCard(a) ? evq() : ""), { credentials: "same-origin", headers: h }).then(function (r) {
    if (r.status === 304) return { same: true };
    if (r.status === 404) return { gone: true };
    if (r.status !== 200) throw new Error(String(r.status));
    var tag = r.headers.get("ETag");
    var at = r.headers.get("X-Fragment-As-Of");
    return r.text().then(function (html) { return { html: html, etag: tag, asOf: at }; });
  }).then(function (x) {
    s.busy = false;
    a.removeAttribute("aria-busy");
    if (s.again) { var g = s.again; s.again = null; s.etag = null; refresh(a, "filter", g); return; }
    if (x.gone) { s.stopped = true; clearTimeout(s.timer); return; }
    var changed = false;
    if (!x.same) {
      var t = document.createElement("template");
      t.innerHTML = x.html;
      var fresh = t.content.firstElementChild;
      if (!fresh || fresh.id !== a.id) throw new Error("shape");
      if (x.etag) s.etag = x.etag;
      if (fresh.innerHTML !== a.innerHTML || fresh.className !== a.className) {
        var opened = openFolds(a);
        // #1147: the mode chip the person chose stays chosen through a swap
        var chips = Array.prototype.map.call(a.querySelectorAll(".tmchips input:checked"), function (i) { return [i.name, i.value]; });
        a.className = fresh.className;
        a.innerHTML = fresh.innerHTML;
        reopen(a, opened);
        chips.forEach(function (c) { Array.prototype.forEach.call(a.querySelectorAll(".tmchips input"), function (i) { if (i.name === c[0] && i.value === c[1]) i.checked = true; }); });
        changed = true;
      }
    }
    s.asOf = x.asOf ? new Date(x.asOf) : new Date();
    s.fails = 0;
    var bad = a.querySelector(".pcard__refreshfail");
    if (bad) bad.parentNode.removeChild(bad);
    if (after) after(changed);
    else if (changed) {
      say(a.getAttribute("data-updated"));
      if (focused && own(a)) own(a).focus();
    }
    if (changed) {
      try { document.dispatchEvent(new CustomEvent("vf:loaded")); } catch (e) {}
    }
    tell(a, how, changed ? "changed" : "unchanged");
    plan(a);
  }).catch(function () {
    s.busy = false;
    a.removeAttribute("aria-busy");
    if (s.again) { var g = s.again; s.again = null; s.etag = null; refresh(a, "filter", g); return; }
    s.fails = Math.min(s.fails + 1, 3);
    var said = failedLine(a, s);
    if (how !== "auto") say(said);
    plan(a);
  });
}
function scan() {
  Array.prototype.forEach.call(document.querySelectorAll(".pcard[data-card]"), function (a) {
    if (!state.get(a)) plan(a);
  });
}
document.addEventListener("click", function (e) {
  var l = e.target && e.target.closest ? e.target.closest(".pcard__refresh") : null;
  var a = l ? l.closest(".pcard[data-card]") : null;
  if (!a) return;
  e.preventDefault();
  refresh(a, "manual");
});
document.addEventListener("visibilitychange", function () {
  if (document.hidden) return;
  Array.prototype.forEach.call(document.querySelectorAll(".pcard[data-card]"), function (a) {
    var s = st(a);
    if (s.stopped || !every(a)) return;
    if (s.waiting || Date.now() >= s.due) refresh(a, "auto");
  });
});
// 2.4.6 (owner: a station page never 503s because a part is slow): a part of a station page that was not ready inside
// the page's deadline is in its loading state (stpart--loading). The page asks for ITSELF again (the digest finished the read
// meanwhile, so it is answered from its cache), and each part the answer carries ready is put in place of its loading
// block; the static part carries the live part inside it, and a live part already in place is kept. After the last try
// a part still loading says its error sentence. Focus and scroll are not touched: nothing above the block moves.
var PARTS = ["station", "station-live", "place-cards"];
// #1224: the one ask-again of a part that did not answer (\`lib/fragment-retry.ts\`), the place island's and filler's too
var askAgain = ${askAgain.toString()};
var FILL_WAITS = ${JSON.stringify(RETRY_WAITS_MS)};
function loadingParts() {
  // an object page's parts only (a station page's, #1188: and the around block of every object page): another page's
  // own loading blocks are its own scripts' business
  if (!document.getElementById("station") && !document.getElementById("vf-around")) return [];
  return PARTS.map(function (id) { var el = document.getElementById(id); return el && el.classList.contains("stpart--loading") ? el : null; }).filter(function (el) { return !!el; });
}
// the block's two sentences: the error sentence first (what a page without script says), the loading one second
function say2(el, loading) {
  var ps = el.querySelectorAll(":scope > p");
  if (ps.length < 2) return;
  ps[0].hidden = loading;
  ps[1].hidden = !loading;
  if (loading) { ps[0].removeAttribute("role"); ps[1].setAttribute("role", "status"); } else { ps[1].removeAttribute("role"); ps[0].setAttribute("role", "status"); }
}
function giveUp(el) {
  say2(el, false);
  el.classList.remove("stpart--loading");
  el.classList.add("is-error");
}
function fillFrom(doc) {
  var swapped = false;
  loadingParts().forEach(function (el) {
    if (!el.isConnected) return;
    var nu = doc.getElementById(el.id);
    if (!nu || nu.classList.contains("stpart--loading")) return;
    var put = document.importNode(nu, true);
    var held = el.id === "station" ? document.getElementById("station-live") : null;
    if (held && !held.classList.contains("stpart--loading")) { var inner = put.querySelector("#station-live"); if (inner) inner.replaceWith(held); }
    el.replaceWith(put);
    swapped = true;
  });
  if (swapped) {
    scan();
    try { document.dispatchEvent(new CustomEvent("vf:swapped")); } catch (e) {}
  }
}
// one ask of the page itself: the parts it carries ready are put in place; how many are still loading is the answer
function askPage() {
  // X-VF-Fill: the re-ask is no visit — the access log leaves it out (the edge configuration $vf_visit)
  return fetch(location.pathname + location.search, { credentials: "same-origin", headers: { accept: "text/html", "x-vf-fill": "1" } })
    .then(function (r) { return r.status === 200 ? r.text() : ""; })
    .then(function (h) {
      if (h && typeof DOMParser === "function") fillFrom(new DOMParser().parseFromString(h, "text/html"));
      return loadingParts().length;
    });
}
loadingParts().forEach(function (el) { say2(el, true); });
// the server printed the parts as loading, so that was the first ask: the next waits FILL_WAITS[0]
if (loadingParts().length) askAgain(window, askPage, function (left) { return left !== 0; }, FILL_WAITS, true).then(function () { loadingParts().forEach(giveUp); });
// #1081 D1: the charging filter re-fetches its card alone — the address follows the choice (replaceState, so the
// no-script link and a reload show the same), focus returns to the control that changed, and the count is read out.
function applyEv(f, a) {
  var keep = String(location.search || "").replace(/^\\?/, "").split("&").filter(function (p) { return p !== "" && !/^ev_/.test(p); });
  var fd = new FormData(f);
  var add = [];
  var op = fd.get("ev_op");
  if (op) add.push("ev_op=" + encodeURIComponent(op));
  var kw = fd.getAll("ev_kw");
  if (kw.length) add.push("ev_kw=" + kw.join(","));
  var pl = fd.getAll("ev_plug");
  if (pl.length) add.push("ev_plug=" + pl.join(","));
  if (fd.get("ev_free") === "1") add.push("ev_free=1");
  var tm = fd.getAll("ev_term");
  if (tm.length) add.push("ev_term=" + tm.join(","));
  var q = keep.concat(add).join("&");
  history.replaceState(history.state, "", location.pathname + (q ? "?" + q : "") + location.hash);
  var at = document.activeElement && f.contains(document.activeElement) ? [document.activeElement.name, document.activeElement.value] : null;
  st(a).etag = null;
  refresh(a, "filter", function () {
    var c = a.querySelector(".evf__count, .evf__none");
    say(c ? c.textContent : a.getAttribute("data-updated"));
    if (!at) return;
    var back = a.querySelector('form.evf [name="' + at[0] + '"]' + (at[0] === "ev_op" ? "" : '[value="' + at[1] + '"]'));
    if (back) back.focus();
  });
}
${EVF_SUBMIT_JS}
// 2.4.4 review B2: a form this script does not re-fetch in place (outside a data-card card — the motorway page's, a card
// with no fragment — or a browser without replaceState/FormData) is sent on change by the shared rule, and its submit
// is the browser's own.
function evForm(e) {
  var f = e.target && e.target.closest ? e.target.closest("form.evf") : null;
  if (!f) return;
  var a = f.closest("article.pcard[data-card]");
  if (!a || typeof history.replaceState !== "function" || typeof FormData !== "function") { if (e.type === "change") evSubmit(e); return; }
  e.preventDefault();
  applyEv(f, a);
}
document.addEventListener("submit", evForm);
document.addEventListener("change", evForm);
// owner 2026-10-27: the station board's filter has no Apply button — a mode or a platform applies at once (the
// name box on Enter or a picked suggestion, never on leaving it); the submit is in <noscript> for a browser without
// scripts. 2.4.6 (item 4): every choice of the board — the form, a suggested name, a line of "Linien hier", the reset —
// applies IN PLACE: the board card alone is asked again under the new choices (its data-card), the address follows
// (replaceState, so the link and a reload show the same), focus stays on the control that was used, and the count is
// read out. A browser without replaceState or FormData sends the form (or follows the link) as before.
var BOARD_KEYS = ["side", "mode", "platform", "to", "line", "time", "at", "issues", "stepfree"];
function boardKey(p) { var k = p.split("=")[0]; try { k = decodeURIComponent(k); } catch (e) {} return BOARD_KEYS.indexOf(k) >= 0; }
function boardCard() { var a = document.getElementById("pcard-station-board"); return a && a.getAttribute("data-card") ? a : null; }
function inPlace() { return typeof history.replaceState === "function" && typeof FormData === "function" && !!boardCard(); }
function applyBoard(pairs, back) {
  var a = boardCard();
  var add = pairs.filter(function (kv) { return kv[1] !== "" && BOARD_KEYS.indexOf(kv[0]) >= 0; }).map(function (kv) { return encodeURIComponent(kv[0]) + "=" + encodeURIComponent(kv[1]); });
  var keep = String(location.search || "").replace(/^\\?/, "").split("&").filter(function (p) { return p !== "" && !boardKey(p); });
  var q = keep.concat(add).join("&");
  history.replaceState(history.state, "", location.pathname + (q ? "?" + q : "") + location.hash);
  var url = a.getAttribute("data-card");
  var i = url.indexOf("?");
  var base = url.slice(0, i + 1) + url.slice(i + 1).split("&").filter(function (p) { return p !== "" && !boardKey(p); }).join("&");
  a.setAttribute("data-card", base + (add.length ? "&" + add.join("&") : ""));
  st(a).etag = null;
  refresh(a, "filter", function () {
    var c = a.querySelector(".stlive__count, .stpage__note");
    say(c ? c.textContent : a.getAttribute("data-updated"));
    var b = back ? back(a) : null;
    if (b && typeof b.focus === "function") b.focus();
  });
}
function boardForm(e) {
  var t = e.target, f = t && t.closest ? t.closest("form.stlive__filter") : null;
  if (!f) return;
  if (e.type === "change" && t.type === "search") return;
  if (!inPlace()) {
    if (e.type === "change") { if (typeof f.requestSubmit === "function") f.requestSubmit(); else f.submit(); }
    return;
  }
  e.preventDefault();
  var used = e.type === "submit" ? f.querySelector("input[type=search]") : t;
  var name = used ? used.name : "", value = used ? used.value : "", box = !!used && (used.type === "radio" || used.type === "checkbox");
  var pairs = [];
  new FormData(f).forEach(function (v, k) { pairs.push([k, String(v).trim()]); });
  applyBoard(pairs, function (a) {
    return a.querySelector('form.stlive__filter [name="' + name + '"]' + (box ? '[value="' + value + '"]' : ""));
  });
}
document.addEventListener("change", boardForm);
document.addEventListener("submit", boardForm);
function linkPairs(href) {
  var qi = href.indexOf("?"), hi = href.indexOf("#");
  var qs = qi < 0 ? "" : href.slice(qi + 1, hi < 0 ? href.length : hi);
  var out = [];
  qs.split("&").forEach(function (p) {
    if (p === "") return;
    var j = p.indexOf("=");
    var k = j < 0 ? p : p.slice(0, j), v = j < 0 ? "" : p.slice(j + 1);
    try { out.push([decodeURIComponent(k), decodeURIComponent(v.replace(/\\+/g, " "))]); } catch (x) {}
  });
  return out;
}
// A link of the station's live part to this page's own board (a suggested name, a line, the reset): its choices.
function boardLink(l) {
  if (!l || !l.closest("#station-live") || l.classList.contains("pcard__refresh")) return false;
  var href = l.getAttribute("href") || "";
  var path = href.split("#")[0].split("?")[0];
  return href.slice(href.indexOf("#")) === "#pcard-station-board" && href.indexOf("#") > 0 && path === location.pathname;
}
document.addEventListener("click", function (e) {
  var l = e.target && e.target.closest ? e.target.closest("a[href]") : null;
  if (!boardLink(l) || e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !inPlace()) return;
  var href = l.getAttribute("href");
  e.preventDefault();
  var outside = !boardCard().contains(l);
  var listed = !!l.closest(".sheet__results");
  // a line of "Linien hier" (outside the card): it is the one chosen now
  if (outside) Array.prototype.forEach.call(document.querySelectorAll(".stlive__lines a"), function (x) { if (x === l) x.setAttribute("aria-current", "true"); else x.removeAttribute("aria-current"); });
  applyBoard(linkPairs(href), function (a) {
    if (outside) return l;
    // a name picked from the box's list: back to the box (the list is closed again)
    if (listed) return a.querySelector('form.stlive__filter input[name="to"]');
    var same = null;
    Array.prototype.forEach.call(a.querySelectorAll("a[href]"), function (x) { if (!same && x.getAttribute("href") === href) same = x; });
    return same || a.querySelector("form.stlive__filter input, form.stlive__filter select");
  });
});
// #1147: the departures/arrivals tabs of the station board. The digest renders both panels and a hidden tab list; here
// the list is shown, the panel not chosen is hidden, a tab is chosen by a click or the arrow keys (Home/End too, the
// WAI-ARIA tabs pattern with automatic activation), and the choice is then applied in place like the old switch was:
// the card is asked again under side=arr or no side, the name dropped (a destination is no origin).
function showTab(t, ts) {
  Array.prototype.forEach.call(ts, function (x) {
    var on = x === t;
    x.setAttribute("aria-selected", on ? "true" : "false");
    x.tabIndex = on ? 0 : -1;
    var p = document.getElementById(x.getAttribute("aria-controls"));
    if (p) p.hidden = !on;
  });
}
function chooseTab(t, ts) {
  if (t.getAttribute("aria-selected") === "true") return;
  showTab(t, ts);
  t.focus();
  if (!inPlace()) return;
  var f = boardCard().querySelector("form.stlive__filter");
  var pairs = [];
  if (f) new FormData(f).forEach(function (v, k) { if (k !== "side" && k !== "to") pairs.push([k, String(v).trim()]); });
  pairs.push(["side", /-tab-arr$/.test(t.id) ? "arr" : ""]);
  var id = t.id;
  applyBoard(pairs, function () { tabs(); return document.getElementById(id); });
}
function tabs() {
  Array.prototype.forEach.call(document.querySelectorAll(".stlive__tabs[role=tablist]"), function (l) {
    if (l.vfTabs) return;
    l.vfTabs = true;
    var ts = l.querySelectorAll("[role=tab]");
    var sel = null;
    Array.prototype.forEach.call(ts, function (x) { if (x.getAttribute("aria-selected") === "true") sel = x; });
    showTab(sel || ts[0], ts);
    l.hidden = false;
    l.addEventListener("click", function (e) { var t = e.target && e.target.closest ? e.target.closest("[role=tab]") : null; if (t) chooseTab(t, ts); });
    l.addEventListener("keydown", function (e) {
      var i = Array.prototype.indexOf.call(ts, document.activeElement), n = ts.length, j = -1;
      if (i < 0) return;
      if (e.key === "ArrowRight") j = (i + 1) % n;
      else if (e.key === "ArrowLeft") j = (i - 1 + n) % n;
      else if (e.key === "Home") j = 0;
      else if (e.key === "End") j = n - 1;
      if (j < 0) return;
      e.preventDefault();
      chooseTab(ts[j], ts);
    });
  });
}
document.addEventListener("vf:loaded", tabs);
tabs();
document.addEventListener("vf:loaded", scan);
scan();`;

/** The refresh script for a page whose cards carry their fragment address. */
export function cardRefreshScript(): string {
  return `(${INLINE_SCRIPTS.refresh})();`;
}

/** Whether a fragment carries a card that refreshes in place. */
export const carriesRefresh = (html: string): boolean => / data-card="\/fragment\/card\?/.test(html);
