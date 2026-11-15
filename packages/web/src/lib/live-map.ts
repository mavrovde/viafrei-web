/**
 * #1183: the live map of Germany's motorways, on the motorway index. The digest's overview figure
 * (`packages/digest/src/presentation/motorway-overview.ts`) is server-rendered and complete without a script: every
 * motorway a path inside a link to its page, the hot ones drawn again on top by reference. This script makes the SAME
 * paths live — it sends no geometry and asks for none (AC 2):
 *
 *  - it fetches the overlay (`/fragment/motorway-overlay`, the digest's `/internal/motorway/overlay`: a class and the
 *    words per road, the credit lines of every toggle combination, the hours of today on offer) and re-classes the
 *    paths by `<use>` groups, one per state, closure on top;
 *  - the layer toggles (Autobahn, Baustellen) and the zoom buttons appear only once that answer is in, so a page whose
 *    overlay does not arrive stays today's map; a toggle's state is stored only on its click (the click-only rule of
 *    2026-10-13, AC 8), and read back on the next visit;
 *  - zoom and pan by the viewBox: the mouse wheel (once the map has focus or is zoomed, or with Ctrl, so a page that is
 *    only being scrolled is never caught), a drag, two fingers (`touch-action: none` on the live map only, so the page
 *    does not scroll under them, AC 7), the keyboard (+, −, 0 and the arrows on the focused map) and the buttons;
 *  - hovering or focusing a line names it ("A2 · 6 Sperrungen · 3 Staus") in a tip; the name is also the link's;
 *  - the time slider asks the overlay for a past full hour of today and says on the map that it is not current;
 *  - Bahn and Wetterwarnungen (off on a first visit) ask their geometry once, when turned on (`/fragment/map-layer`,
 *    the digest's `/internal/map/rail|kreise`): DB InfraGO's lines with the station dots, and the VG2500 Kreise, put
 *    into the SAME svg under the motorways (LM4); the overlay names the warned Kreise and the script colours those;
 *  - the CC BY-SA delay layer (Bahn's sub-toggle, LM12–LM17) is its OWN `<svg>` stacked over the base figure, filled
 *    from its OWN response (`/fragment/map-layer?l=sa`): it draws the base dots again by `<use>` and writes nothing
 *    into the base svg, and its lines and the LM14 sentence stand in a block of their own, exactly while it draws.
 *
 * The rule of which road is drawn how under the toggles is `drawnAs` in the digest's `presentation/live-map.ts`; the
 * three lines of `drawn` below are the same rule, held equal by `test/live-map.test.ts`. The credit lines are never
 * chosen here: the payload carries the lines of each combination, as the digest decided them (steward M32/R3, LM24).
 */
import { createHash } from "node:crypto";
import { PAGE_HEAD_COPY, foldWhole } from "@viafrei/design";
import { isLang } from "../i18n/index.js";
import type { Lang } from "../site/pages.js";
import { digestFetch } from "./agent-class.js";
import { INLINE_SCRIPTS } from "./inline-scripts.js";
import type { FetchLike, TileFetchOptions } from "./tiles.js";

/** The public route the script asks. */
export const LIVE_MAP_ROUTE = "/fragment/motorway-overlay";
/** Where a toggle's state is kept once a person has clicked one. */
export const LIVE_MAP_KEY = "viafrei.lmap";
/** The overlay is asked again this often while the slider is at "now" and the tab is visible. */
export const LIVE_MAP_REFRESH_MS = 120_000;
/** The most zoom: a twelfth of Germany's width (about 50 km). */
export const LIVE_MAP_MAX_ZOOM = 12;
/** #1183: the public route of the layers' geometry and of the CC BY-SA layer. */
export const MAP_LAYER_ROUTE = "/fragment/map-layer";

/**
 * The script's readable source (minified into `src/generated/inline-scripts.json` as `lmap`, #1064). `C`: `{ lang }`.
 */
export const LIVE_MAP_JS = `if (typeof fetch !== "function" || !window.JSON) return;
var figs = document.querySelectorAll("figure.lmap");
for (var f = 0; f < figs.length; f++) if (!figs[f].hasAttribute("data-live")) { figs[f].setAttribute("data-live", ""); init(figs[f]); }
function init(fig) {
var svg = fig.querySelector("svg.motorway-overview__svg"), bar = fig.querySelector(".lmap__bar"), roadsG = fig.querySelector(".lmap__roads"), hotG = fig.querySelector(".lmap__hot");
var tip = fig.querySelector(".lmap__tip"), view0 = fig.querySelector(".lmap__view"), src = fig.querySelector(".motorway__mapsrc"), tpl = fig.querySelector(".lmap__tpl");
var range = bar && bar.querySelector("input[type=range]"), when = fig.querySelector(".lmap__when"), status = fig.querySelector(".lmap__status");
var legends = fig.querySelectorAll(".motorway__legend"), twin = fig.querySelector(".lmap__twin"), sasrc = fig.querySelector(".lmap__sasrc");
if (!svg || !bar || !roadsG || !range || !src || !tpl || !tpl.content || !view0 || !svg.viewBox || !svg.viewBox.baseVal) return;
var NS = "http://www.w3.org/2000/svg", KEY = "${LIVE_MAP_KEY}", ROUTE = "${LIVE_MAP_ROUTE}", LAYER = "${MAP_LAYER_ROUTE}";
var vb = svg.viewBox.baseVal, X0 = vb.x, Y0 = vb.y, W = vb.width, H = vb.height, view = { x: X0, y: Y0, w: W, h: H };
var GW = Number(fig.getAttribute("data-gw")) || W, P = fig.id + "-";
var layers = { roads: true, works: true, rail: false, warn: false, sa: false }, now = null, shown = null, hours = [], at = null, timer = 0, live = false;
var geo = { rail: null, kreise: null, dots: null }, asked = { rail: false, kreise: false }, sa = null, saSvg = null;
function word(c) { var e = tpl.content.querySelector("." + c); return e ? e.textContent : ""; }
try {
  var kept = JSON.parse(localStorage.getItem(KEY) || "null");
  if (kept && typeof kept === "object") { layers.roads = kept.r !== 0; layers.works = kept.w !== 0; layers.rail = kept.b === 1; layers.warn = kept.d === 1; layers.sa = kept.s === 1; }
} catch (e) {}
var boxes = bar.querySelectorAll("input[type=checkbox]");
for (var b = 0; b < boxes.length; b++) {
  boxes[b].checked = layers[boxes[b].name] === true;
  boxes[b].addEventListener("click", function (ev) {
    var x = ev.currentTarget;
    layers[x.name] = x.checked;
    try { localStorage.setItem(KEY, JSON.stringify({ r: layers.roads ? 1 : 0, w: layers.works ? 1 : 0, b: layers.rail ? 1 : 0, d: layers.warn ? 1 : 0, s: layers.sa ? 1 : 0 })); } catch (e) {}
    need(); paint();
  });
}
function idOf(road) { return P + road.replace(/[^A-Za-z0-9]/g, ""); }
function drawn(state, works) {
  if (layers.roads) return state === "" || state === "free" || (state === "roadworks" && !layers.works) ? "line" : state;
  return layers.works && works ? "roadworks" : null;
}
var WIDTH = { line: 2.4, roadworks: 2.4, jam: 4, closure: 4 };
function widths() {
  var k = Math.sqrt(GW / view.w), sts = svg.querySelectorAll(".lmap__st");
  roadsG.setAttribute("stroke-width", String(WIDTH.line / k));
  for (var i = 0; i < sts.length; i++) {
    var s = (sts[i].getAttribute("class") || "").replace(/.*lmap__st--/, "");
    var w = (WIDTH[s] || WIDTH.line) / k;
    sts[i].setAttribute("stroke-width", String(w));
    if (s === "roadworks") sts[i].setAttribute("stroke-dasharray", w * 2 + " " + w * 1.5);
  }
}
function box(n) { for (var i = 0; i < boxes.length; i++) if (boxes[i].name === n) return boxes[i]; return null; }
function need() {
  var sb = box("sa");
  if (sb) sb.disabled = !layers.rail;
  if (layers.rail && !asked.rail) { asked.rail = true; geoLoad("rail"); }
  if (layers.warn && !asked.kreise) { asked.kreise = true; geoLoad("kreise"); }
  if (layers.rail && layers.sa) saLoad(0);
}
function geoLoad(l) {
  fetch(LAYER + "?l=" + l + "&lang=" + C.lang, { credentials: "omit", headers: { accept: "image/svg+xml" } })
    .then(function (r) { return r.status === 200 ? r.text() : null; })
    .then(function (t) {
      if (!t) { asked[l] = false; return; }
      var g = document.createElementNS(NS, "g");
      g.innerHTML = t;
      var el = g.firstElementChild;
      if (!el) return;
      // the figure's own ids, so a second map on the page draws its own dots and Kreise (P: the figure's id)
      var ids = el.querySelectorAll("[id]");
      for (var i = 0; i < ids.length; i++) { ids[i].id = P + ids[i].id; if (W < GW && ids[i].tagName === "circle") ids[i].setAttribute("r", String(Math.round(22 * Math.sqrt(W / GW)) / 10)); }
      geo[l] = el;
      // under the motorways, the Kreise under the rail
      var ref = l === "kreise" && geo.rail ? geo.rail : roadsG;
      roadsG.parentNode.insertBefore(el, ref);
      // the dots above the motorways and after them in the keyboard's order (AC 4), the lines under them
      var dots = l === "rail" ? el.querySelector(".lmap__stations") : null;
      if (dots) { roadsG.parentNode.insertBefore(dots, roadsG.nextSibling); geo.dots = dots; }
      paint();
    })
    .catch(function () { asked[l] = false; });
}
function saLoad(tries) {
  fetch(LAYER + "?l=sa&lang=" + C.lang, { credentials: "omit", headers: { accept: "application/json" } })
    .then(function (r) {
      if (r.status === 503 && tries < 5) { setTimeout(function () { if (layers.sa) saLoad(tries + 1); }, 1000); return undefined; }
      return r.status === 200 ? r.json() : null;
    })
    .then(function (p) { if (p === undefined) return; sa = p && p.stations ? p : null; paint(); })
    .catch(function () {});
}
function li(text, cls) { var e = document.createElement("li"); if (cls) e.className = cls; e.textContent = text; return e; }
function paintSa() {
  var on = layers.rail && layers.sa && sa && geo.rail && sa.stations.length > 0;
  if (!on) { if (saSvg) saSvg.setAttribute("display", "none"); if (sasrc) { sasrc.hidden = true; sasrc.innerHTML = ""; } return; }
  if (!saSvg) {
    saSvg = document.createElementNS(NS, "svg");
    saSvg.setAttribute("class", "lmap__sa");
    saSvg.setAttribute("aria-hidden", "true");
    saSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    view0.insertBefore(saSvg, svg.nextSibling);
  }
  saSvg.removeAttribute("display");
  saSvg.setAttribute("viewBox", svg.getAttribute("viewBox"));
  while (saSvg.firstChild) saSvg.removeChild(saSvg.firstChild);
  var list = document.createElement("ul");
  list.className = "lmap__sa-list";
  for (var i = 0; i < sa.stations.length; i++) {
    var s = sa.stations[i], id = P + "lms-" + s[0].replace(/[^a-z0-9-]/g, "");
    if (!document.getElementById(id)) continue;
    var u = document.createElementNS(NS, "use");
    u.setAttribute("href", "#" + id);
    u.setAttribute("class", "lmap__sa--" + s[1]);
    saSvg.appendChild(u);
    list.appendChild(li(s[2] + " · " + word("lmap__sa" + s[1])));
  }
  if (sasrc) { sasrc.innerHTML = sa.credits; sasrc.appendChild(list); sasrc.hidden = false; }
}
function paintLayers() {
  if (geo.rail) geo.rail.setAttribute("display", layers.rail ? "inline" : "none");
  if (geo.dots) geo.dots.setAttribute("display", layers.rail ? "inline" : "none");
  var ks = shown.kreise, warned = {};
  if (geo.kreise) {
    var ps = geo.kreise.querySelectorAll("path");
    if (layers.warn && ks) for (var k = 0; k < ks.length; k++) warned[P + "lmk-" + ks[k][0]] = ks[k][1];
    for (var q = 0; q < ps.length; q++) { var lv = warned[ps[q].id]; ps[q].setAttribute("class", lv ? "lmap__warn--" + lv : ""); }
  }
  if (twin) {
    while (twin.firstChild) twin.removeChild(twin.firstChild);
    if (layers.warn && ks) for (var t = 0; t < ks.length; t++) twin.appendChild(li(ks[t][2]));
    if (layers.warn && !ks) twin.appendChild(li(word("lmap__warnpast")));
    twin.hidden = !twin.firstChild;
  }
  var lgs = fig.querySelectorAll(".lmap__lg");
  for (var g = 0; g < lgs.length; g++) {
    var c = lgs[g].className;
    lgs[g].hidden = !(c.indexOf("--rail") > 0 ? layers.rail && geo.rail : c.indexOf("--warn") > 0 ? layers.warn && ks && ks.length > 0 : layers.rail && layers.sa && sa && sa.stations.length > 0);
  }
  paintSa();
}
function paint() {
  if (!shown) return;
  var old = svg.querySelectorAll(".lmap__st");
  for (var i = old.length - 1; i >= 0; i--) old[i].parentNode.removeChild(old[i]);
  if (hotG) hotG.setAttribute("display", "none");
  roadsG.setAttribute("visibility", layers.roads ? "visible" : "hidden");
  var groups = { roadworks: [], jam: [], closure: [] }, label = {};
  for (var j = 0; j < shown.roads.length; j++) {
    var r = shown.roads[j], d = drawn(r[1], r[2] === 1);
    label[idOf(r[0])] = r[3];
    if (d && d !== "line") groups[d].push(r[0]);
  }
  var order = ["roadworks", "jam", "closure"];
  for (var o = 0; o < order.length; o++) {
    var g = document.createElementNS(NS, "g");
    g.setAttribute("class", "lmap__st lmap__st--" + order[o]);
    for (var u = 0; u < groups[order[o]].length; u++) {
      var use = document.createElementNS(NS, "use");
      use.setAttribute("href", "#" + idOf(groups[order[o]][u]));
      g.appendChild(use);
    }
    roadsG.parentNode.appendChild(g);
  }
  var links = roadsG.querySelectorAll("a");
  for (var l = 0; l < links.length; l++) {
    var p = links[l].querySelector("path"), name = p ? label[p.id] : null;
    if (name) links[l].setAttribute("aria-label", name);
    if (layers.roads) links[l].removeAttribute("tabindex"); else links[l].setAttribute("tabindex", "-1");
  }
  // a layer whose geometry is not in yet draws nothing, so its lines wait for it (M32/R3)
  var key = (layers.roads ? "1" : "0") + (layers.works ? "1" : "0") + (layers.rail && geo.rail ? "1" : "0") + (layers.warn && geo.kreise ? "1" : "0");
  src.innerHTML = shown.credits[key] || "";
  paintLayers();
  widths();
}
function setView() {
  svg.setAttribute("viewBox", [view.x, view.y, view.w, view.h].map(function (n) { return Math.round(n * 10) / 10; }).join(" "));
  fig.classList.toggle("lmap--zoomed", view.w < W);
  if (saSvg) saSvg.setAttribute("viewBox", svg.getAttribute("viewBox"));
  widths();
}
function clampView() {
  view.w = Math.max(W / ${String(LIVE_MAP_MAX_ZOOM)}, Math.min(W, view.w));
  view.h = view.w * H / W;
  view.x = Math.max(X0 - view.w / 2, Math.min(X0 + W - view.w / 2, view.x));
  view.y = Math.max(Y0 - view.h / 2, Math.min(Y0 + H - view.h / 2, view.y));
}
function zoomAt(f, cx, cy) {
  var nw = Math.max(W / ${String(LIVE_MAP_MAX_ZOOM)}, Math.min(W, view.w / f)), q = nw / view.w;
  view.x = cx - (cx - view.x) * q; view.y = cy - (cy - view.y) * q; view.w = nw;
  clampView(); setView();
}
function centre(f) { zoomAt(f, view.x + view.w / 2, view.y + view.h / 2); }
function reset() { view = { x: X0, y: Y0, w: W, h: H }; setView(); }
function user(px, py) {
  var bx = svg.getBoundingClientRect(), s = Math.min(bx.width / view.w, bx.height / view.h) || 1;
  return { x: view.x + (px - bx.left - (bx.width - view.w * s) / 2) / s, y: view.y + (py - bx.top - (bx.height - view.h * s) / 2) / s, s: s };
}
function pan(dx, dy) { view.x += dx; view.y += dy; clampView(); setView(); }
var pts = {}, last = null, moved = 0;
function gesture() {
  var ids = Object.keys(pts);
  if (ids.length === 0) return null;
  var a = pts[ids[0]];
  if (ids.length === 1) return { x: a.x, y: a.y, d: 0 };
  var c = pts[ids[1]];
  return { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2, d: Math.sqrt((a.x - c.x) * (a.x - c.x) + (a.y - c.y) * (a.y - c.y)) };
}
function start() {
  if (live) return;
  live = true;
  bar.hidden = false;
  fig.classList.add("lmap--live");
  svg.setAttribute("tabindex", "0");
  if (legends.length > 1) { legends[0].hidden = true; legends[1].hidden = false; }
  bar.querySelector("button[name=in]").addEventListener("click", function () { centre(1.6); });
  bar.querySelector("button[name=out]").addEventListener("click", function () { centre(1 / 1.6); });
  bar.querySelector("button[name=reset]").addEventListener("click", reset);
  svg.addEventListener("wheel", function (e) {
    if (!e.ctrlKey && view.w >= W && !fig.contains(document.activeElement)) return;
    e.preventDefault();
    var p = user(e.clientX, e.clientY);
    zoomAt(Math.exp(-e.deltaY * 0.0015), p.x, p.y);
  }, { passive: false });
  svg.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pts[e.pointerId] = { x: e.clientX, y: e.clientY };
    moved = 0; last = gesture();
  });
  svg.addEventListener("pointermove", function (e) {
    var p = pts[e.pointerId];
    if (!p) return;
    p.x = e.clientX; p.y = e.clientY;
    var g = gesture();
    if (!last || !g) { last = g; return; }
    if (g.d && last.d) { var c = user(g.x, g.y); zoomAt(g.d / last.d, c.x, c.y); }
    moved += Math.abs(g.x - last.x) + Math.abs(g.y - last.y) + Math.abs(g.d - last.d);
    if (moved > 4 && svg.setPointerCapture && !svg.hasPointerCapture(e.pointerId)) { try { svg.setPointerCapture(e.pointerId); } catch (x) {} }
    var s = user(0, 0).s;
    pan(-(g.x - last.x) / s, -(g.y - last.y) / s);
    last = g;
    e.preventDefault();
  });
  function up(e) { delete pts[e.pointerId]; last = gesture(); }
  svg.addEventListener("pointerup", up);
  svg.addEventListener("pointercancel", up);
  svg.addEventListener("click", function (e) { if (moved > 4) { e.preventDefault(); e.stopPropagation(); } moved = 0; }, true);
  svg.addEventListener("keydown", function (e) {
    var k = e.key, step = view.w * 0.1;
    if (k === "+" || k === "=") centre(1.6);
    else if (k === "-" || k === "_") centre(1 / 1.6);
    else if (k === "0") reset();
    else if (k === "ArrowLeft") pan(-step, 0);
    else if (k === "ArrowRight") pan(step, 0);
    else if (k === "ArrowUp") pan(0, -step);
    else if (k === "ArrowDown") pan(0, step);
    else return;
    e.preventDefault();
  });
  function showTip(a, x, y) {
    var t = a && a.getAttribute("aria-label");
    if (!t || !tip) return;
    var bx = view0.getBoundingClientRect();
    tip.textContent = t;
    tip.hidden = false;
    tip.style.left = Math.max(0, Math.min(bx.width - tip.offsetWidth, x - bx.left + 12)) + "px";
    tip.style.top = Math.max(0, y - bx.top - tip.offsetHeight - 8) + "px";
  }
  function hideTip() { if (tip) tip.hidden = true; }
  function linkOf(t) { return t && t.closest ? t.closest("a") : null; }
  roadsG.addEventListener("pointerover", function (e) { if (e.pointerType === "mouse") showTip(linkOf(e.target), e.clientX, e.clientY); });
  roadsG.addEventListener("pointerout", hideTip);
  // on the svg, not the group: Chromium makes an SVG element with focus listeners a tab stop of its own
  svg.addEventListener("focusin", function (e) { var a = linkOf(e.target); if (!a) return; var r = a.getBoundingClientRect(); showTip(a, r.left + r.width / 2, r.top + r.height / 2); });
  svg.addEventListener("focusout", hideTip);
  range.addEventListener("input", function () {
    var i = Number(range.value);
    when.textContent = i >= hours.length ? word("lmap__now") : hours[i][1];
    clearTimeout(timer);
    timer = setTimeout(function () { pick(i); }, 200);
  });
}
function pick(i) {
  if (i >= hours.length) {
    at = null; shown = now;
    status.textContent = "";
    fig.classList.remove("lmap--past");
    paint();
    return;
  }
  at = hours[i][0];
  load(at, 0);
}
function blank(p) { for (var i = 0; i < p.roads.length; i++) if (p.roads[i][1] !== "") return false; return true; }
function load(h, tries) {
  if (h !== null) status.textContent = word("lmap__loading");
  fetch(ROUTE + "?lang=" + C.lang + (h === null ? "" : "&h=" + h), { credentials: "omit", headers: { accept: "application/json" } })
    .then(function (r) {
      if (r.status === 503 && h !== null && tries < 5) {
        setTimeout(function () { if (at === h) load(h, tries + 1); }, 1000);
        return undefined;
      }
      return r.status === 200 ? r.json() : null;
    })
    .then(function (p) {
      if (p === undefined) return;
      if (!p || !p.roads || !p.credits) { if (h !== null && at === h) status.textContent = word("lmap__none"); return; }
      if (h === null) {
        now = p;
        hours = p.hours || [];
        range.max = String(hours.length);
        if (at === null) { range.value = String(hours.length); shown = p; start(); need(); paint(); }
        return;
      }
      if (at !== h) return;
      shown = p;
      status.textContent = blank(p) ? word("lmap__none") : word("lmap__asof").replace("{t}", p.at);
      fig.classList.add("lmap--past");
      paint();
    })
    .catch(function () {});
}
load(null, 0);
setInterval(function () { if (at === null && document.visibilityState === "visible") load(null, 0); }, ${String(LIVE_MAP_REFRESH_MS)});
}`;

/** The index page's call of the minified script with its configuration. */
export function liveMapScript(lang: Lang): string {
  return `(${INLINE_SCRIPTS.lmap})(${JSON.stringify({ lang })});`;
}

/**
 * #1183 part 5: whether a fragment carries a live map (the one component's figure, whatever its id: the index's `lmap`,
 * a Land's `lmap-land`, a road's `lmap-road`), so its page declares the script and the middleware writes the nonce.
 */
export function hasLiveMap(html: string): boolean {
  return html.includes('<figure class="motorway__map motorway-overview lmap" id="lmap');
}

/** #1183 part 5: the home's slot for the national live map, filled by the loader (never by the server: the home's byte budget). */
export const HOME_LIVE_MAP_SLOT = "lmap-home-slot";
/** The public route of the home's figure (the digest's `/internal/map/live`). */
export const LIVE_MAP_FIGURE_ROUTE = "/fragment/live-map";
/** The public route of the live map's script as a file, the one the home's loader adds (`'strict-dynamic'` trusts it). */
export const LIVE_MAP_SCRIPT_ROUTE = "/fragment/live-map.js";

/**
 * The home's loader (`lmapload`, ~0.5 KB): the home's raw byte budget has no room for the figure and the 10 KB script
 * inline, so a person's browser asks for the figure and then adds the script as a file — the SAME `lmap` script, served
 * by `liveMapScriptFile`. Nothing happens without fetch; a figure that does not arrive leaves the slot empty and hidden.
 */
export const LIVE_MAP_LOADER_JS = `var slot = document.getElementById("${HOME_LIVE_MAP_SLOT}");
if (!slot || typeof fetch !== "function") return;
fetch("${LIVE_MAP_FIGURE_ROUTE}?lang=" + C.lang, { credentials: "omit", headers: { accept: "text/html" } })
  .then(function (r) { return r.status === 200 ? r.text() : null; })
  .then(function (t) {
    if (!t) return;
    slot.innerHTML = t;
    slot.hidden = false;
    var s = document.createElement("script");
    s.src = "${LIVE_MAP_SCRIPT_ROUTE}?lang=" + C.lang + "&v=" + C.v;
    document.head.appendChild(s);
  })
  .catch(function () {});`;

/** The live map script's version: its minified text's hash, so a file kept a day is never an old script. */
export function liveMapScriptVersion(): string {
  return createHash("sha256").update(INLINE_SCRIPTS.lmap).digest("base64url").slice(0, 12);
}

/** The home's call of the loader. */
export function liveMapLoaderScript(lang: Lang): string {
  return `(${INLINE_SCRIPTS.lmapload})(${JSON.stringify({ lang, v: liveMapScriptVersion() })});`;
}

/**
 * GET `/fragment/live-map.js?lang=<l>&v=<version>`: the live map's script as a file — the inline one's exact text, so
 * the home runs the same code as the index. Kept a day under its version; any other version or parameter is refused.
 */
export function liveMapScriptFile(req: Request): Response {
  if (req.method !== "GET") return empty(405, { allow: "GET" });
  const q = new URL(req.url).searchParams;
  const lang = q.get("lang") ?? "";
  if (!isLang(lang) || q.get("v") !== liveMapScriptVersion() || [...q.keys()].some((k) => k !== "lang" && k !== "v")) return empty(400);
  return new Response(liveMapScript(lang), { status: 200, headers: { "content-type": "text/javascript; charset=utf-8", "x-robots-tag": "noindex", "cache-control": "public, max-age=86400" } });
}

/** The home's figure as the digest renders it: one live map, under the home's id, nothing that runs. */
export function isHomeFigure(body: string): boolean {
  return body.startsWith('<figure class="motorway__map motorway-overview lmap" id="lmap-home"') && body.endsWith("</figure>") && !UNSAFE.test(body) && !/<script/i.test(body);
}

/** The class of the home map's own fold (`homeMapFold`), which the stylesheet opens everywhere but on the desktop home. */
export const HOME_LIVE_MAP_FOLD = "lmap__homefold";

/**
 * Review S2 of aa0dd63ee (#1180 AC 5): the home's figure folded whole behind its own line ("Karte anzeigen"), its credit
 * lines inside with it (FS-2026-11-06 FS1) and its summary naming their publishers (FS3), as the place's own map is
 * (`ampel__mapfold`). The stylesheet keeps this fold open, its summary not drawn, wherever the roads fold around it is
 * open — a phone that opened "Das Wichtigste jetzt anzeigen", a tablet — so those see the map as before; on the desktop
 * home, where the desk moves that roads fold into the open heat strip (`homeDesk`), the map stands behind its line,
 * because open there it made the middle column 0.3–1.3 screens taller than the place's column and the page more than
 * eight screens.
 */
export function homeMapFold(lang: Lang, figure: string): string {
  const label = PAGE_HEAD_COPY[lang].showCounted.replace("{x}", PAGE_HEAD_COPY[lang].map).replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;");
  return foldWhole(lang, figure, label, HOME_LIVE_MAP_FOLD);
}

/**
 * The fold's own share of the figure route's ETag (#1223 review N1): the shell sends a representation the digest did not
 * render, so its tag is the digest's plus this hash of the wrapper in that language — a release that changes the wrapper
 * changes the tag, and a browser holding the old wrapper is answered 200, never 304.
 */
export function homeMapFoldTag(lang: Lang): string {
  return createHash("sha256").update(homeMapFold(lang, "")).digest("hex").slice(0, 10);
}

/** GET `/fragment/live-map?lang=<l>`: the digest's home figure checked in its shape, in its own fold (`homeMapFold`), revalidated by its ETag and the fold's (`homeMapFoldTag`). */
export async function liveMapFigureRoute(req: Request, o: TileFetchOptions): Promise<Response> {
  if (req.method !== "GET") return empty(405, { allow: "GET" });
  const q = new URL(req.url).searchParams;
  const lang = q.get("lang") ?? "";
  if (!isLang(lang) || [...q.keys()].some((k) => k !== "lang")) return empty(400);
  const fold = `-f${homeMapFoldTag(lang)}"`;
  // A tag is forwarded only when it was made with THIS wrapper; another (an older release's) asks unconditionally.
  const asked = req.headers.get("if-none-match");
  const inner = asked !== null && asked.endsWith(fold) ? `${asked.slice(0, -fold.length)}"` : null;
  try {
    const get: FetchLike = o.fetchImpl ?? ((url, init) => digestFetch(url, init));
    const r = await get(`${o.baseUrl}/internal/map/live?lang=${lang}`, { signal: AbortSignal.timeout(o.timeoutMs), headers: { accept: "text/html", ...(inner !== null && ETAG.test(inner) ? { "if-none-match": inner } : {}) } });
    const etag = r.headers.get("etag");
    const own: Record<string, string> = { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex", "cache-control": "no-cache" };
    if (etag !== null && ETAG.test(etag)) own["etag"] = `${etag.slice(0, -1)}${fold}`;
    if (r.status === 304) {
      delete own["content-type"];
      return new Response(null, { status: 304, headers: own });
    }
    if (r.status === 404) return empty(404);
    const body = r.status === 200 ? await r.text() : "";
    if (r.status !== 200 || !isHomeFigure(body)) return empty(502);
    return new Response(homeMapFold(lang, body), { status: 200, headers: own });
  } catch {
    return empty(504);
  }
}
/** What the overlay route answers with, beside the body. */
const HEADERS = { "content-type": "application/json; charset=utf-8", "x-robots-tag": "noindex" } as const;
/** A strong ETag as the digest writes it (`fragmentEtag`, `platformEtag`). */
const ETAG = /^"mw-[a-z0-9]+-[A-Za-z0-9_-]{16}(?:-[a-z]+)?"$/;
const empty = (status: number, extra: Record<string, string> = {}): Response => new Response(null, { status, headers: { "cache-control": "no-store", ...extra } });

/** The sixteen combinations of the four toggles (roads, works, rail, warn), as the digest keys them. */
export const LAYER_KEYS: readonly string[] = Array.from({ length: 16 }, (_, i) => (15 - i).toString(2).padStart(4, "0"));
/** Markup that may never ride in a credit block, a geometry layer or a label. */
const UNSAFE = /<script|<style|<foreignObject|<iframe|javascript:|\son[a-z]+=|xlink:href|href="(?!\/|#|https:\/\/)/i;

/** A payload the script may apply: the four keys, each road a `[road, state, works, label]` and nothing carrying markup that runs. */
export function isOverlay(body: string): boolean {
  let p: unknown;
  try {
    p = JSON.parse(body);
  } catch {
    return false;
  }
  if (p === null || typeof p !== "object") return false;
  const o = p as { roads?: unknown; credits?: unknown; hours?: unknown; at?: unknown };
  if (!Array.isArray(o.roads) || !Array.isArray(o.hours) || (o.at !== null && typeof o.at !== "string") || o.credits === null || typeof o.credits !== "object") return false;
  const credits = o.credits as Record<string, unknown>;
  if (!LAYER_KEYS.every((k) => { const c = credits[k]; return typeof c === "string" && !UNSAFE.test(c); })) return false;
  const kreise = (p as { kreise?: unknown }).kreise;
  if (kreise !== null && !(Array.isArray(kreise) && kreise.every((k) => Array.isArray(k) && k.length === 3 && typeof k[0] === "string" && /^\d{5}$/.test(k[0]) && [1, 2, 3, 4].includes(k[1] as number) && typeof k[2] === "string"))) return false;
  return o.roads.every((r) => Array.isArray(r) && r.length === 4 && typeof r[0] === "string" && ["", "free", "roadworks", "jam", "closure"].includes(r[1] as string) && (r[2] === 0 || r[2] === 1) && typeof r[3] === "string");
}

/**
 * GET `/fragment/motorway-overlay?lang=<l>[&h=<hour>]`: the digest's overlay passed on — 200 with its ETag (now:
 * revalidated on every ask, `no-cache`; a past hour: kept ten minutes), a 304 for an unchanged one, a 503 with
 * `Retry-After` while a frame is still being read, and anything else refused. No position, no person: the hour is a
 * number of today, the language one of the site's (LM23).
 */
export async function motorwayOverlayRoute(req: Request, o: TileFetchOptions): Promise<Response> {
  if (req.method !== "GET") return empty(405, { allow: "GET" });
  const q = new URL(req.url).searchParams;
  const lang = q.get("lang") ?? "";
  const h = q.get("h");
  if (!isLang(lang) || (h !== null && !/^(?:[0-9]|1[0-9]|2[0-3])$/.test(h)) || [...q.keys()].some((k) => k !== "lang" && k !== "h")) return empty(400);
  const asked = req.headers.get("if-none-match");
  try {
    const get: FetchLike = o.fetchImpl ?? ((url, init) => digestFetch(url, init));
    const r = await get(`${o.baseUrl}/internal/motorway/overlay?lang=${lang}${h === null ? "" : `&h=${h}`}`, { signal: AbortSignal.timeout(o.timeoutMs), headers: { accept: "application/json", ...(asked !== null && ETAG.test(asked) ? { "if-none-match": asked } : {}) } });
    const etag = r.headers.get("etag");
    const own: Record<string, string> = { ...HEADERS, "cache-control": h === null ? "no-cache" : "private, max-age=600" };
    if (etag !== null && ETAG.test(etag)) own["etag"] = etag;
    if (r.status === 304) {
      delete own["content-type"];
      return new Response(null, { status: 304, headers: own });
    }
    if (r.status === 503) return empty(503, { "retry-after": /^\d{1,2}$/.test(r.headers.get("retry-after") ?? "") ? r.headers.get("retry-after")! : "1" });
    if (r.status === 404) return empty(404);
    const body = r.status === 200 ? await r.text() : "";
    if (r.status !== 200 || !isOverlay(body)) return empty(502);
    return new Response(body, { status: 200, headers: own });
  } catch {
    return empty(504);
  }
}

/** A geometry layer the script may put into the base svg: one `<g>` of the layer's class, paths, circles and same-site links only. */
export function isGeoLayer(kind: "rail" | "kreise", body: string): boolean {
  if (!body.startsWith(`<g class="lmap__${kind}"`) || !body.endsWith("</g>") || UNSAFE.test(body)) return false;
  if ([...body.matchAll(/\shref="([^"]*)"/g)].some((m) => !/^\/[a-z]/.test(m[1]!))) return false;
  const tags = new Set([...body.matchAll(/<([a-zA-Z]+)[\s>/]/g)].map((m) => m[1]!));
  return [...tags].every((t) => ["g", "path", "circle", "a"].includes(t));
}

/** The CC BY-SA layer's own payload (LM12): its licence, `[slug, state, label]` per station, its credit block. */
export function isSaLayer(body: string): boolean {
  let p: unknown;
  try {
    p = JSON.parse(body);
  } catch {
    return false;
  }
  if (p === null || typeof p !== "object") return false;
  const o = p as { license?: unknown; stations?: unknown; credits?: unknown };
  if (o.license !== "CC BY-SA 4.0" || typeof o.credits !== "string" || UNSAFE.test(o.credits) || !Array.isArray(o.stations)) return false;
  return o.stations.every((s) => Array.isArray(s) && s.length === 3 && typeof s[0] === "string" && /^[a-z0-9-]+$/.test(s[0]) && (s[1] === "late" || s[1] === "bad") && typeof s[2] === "string");
}

/**
 * GET `/fragment/map-layer?l=rail|kreise|sa&lang=<l>` (#1183): the digest's `/internal/map/<l>` passed on only in its
 * shape — the two geometry layers kept a day with their ETag, the CC BY-SA layer revalidated on every ask, a 503 with
 * `Retry-After` while it is still being read. No position, no person (LM23).
 */
export async function mapLayerRoute(req: Request, o: TileFetchOptions): Promise<Response> {
  if (req.method !== "GET") return empty(405, { allow: "GET" });
  const q = new URL(req.url).searchParams;
  const lang = q.get("lang") ?? "";
  const l = q.get("l") ?? "";
  if (!isLang(lang) || !["rail", "kreise", "sa"].includes(l) || [...q.keys()].some((k) => k !== "lang" && k !== "l")) return empty(400);
  const asked = req.headers.get("if-none-match");
  try {
    const get: FetchLike = o.fetchImpl ?? ((url, init) => digestFetch(url, init));
    const path = l === "sa" ? "rail-sa" : l;
    const r = await get(`${o.baseUrl}/internal/map/${path}?lang=${lang}`, { signal: AbortSignal.timeout(o.timeoutMs), headers: { accept: l === "sa" ? "application/json" : "image/svg+xml", ...(asked !== null && ETAG.test(asked) ? { "if-none-match": asked } : {}) } });
    const etag = r.headers.get("etag");
    const own: Record<string, string> = { "content-type": l === "sa" ? "application/json; charset=utf-8" : "image/svg+xml; charset=utf-8", "x-robots-tag": "noindex", "cache-control": l === "sa" ? "no-cache" : "public, max-age=86400" };
    if (etag !== null && ETAG.test(etag)) own["etag"] = etag;
    if (r.status === 304) {
      delete own["content-type"];
      return new Response(null, { status: 304, headers: own });
    }
    if (r.status === 503 && l === "sa") return empty(503, { "retry-after": /^\d{1,2}$/.test(r.headers.get("retry-after") ?? "") ? r.headers.get("retry-after")! : "1" });
    if (r.status === 404) return empty(404);
    const body = r.status === 200 ? await r.text() : "";
    if (r.status !== 200 || !(l === "sa" ? isSaLayer(body) : isGeoLayer(l as "rail" | "kreise", body))) return empty(502);
    return new Response(body, { status: 200, headers: own });
  } catch {
    return empty(504);
  }
}
