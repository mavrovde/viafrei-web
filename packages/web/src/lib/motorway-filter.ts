/**
 * The motorway page's type filter (#901 D3, D4, D8, D9, D10): one checkbox per kind of data the page carries, in
 * any combination, driving the WHOLE page — the cards of the main block, the rows and marks of the around block and
 * of both maps, the live count — together with the radius. The digest renders the cards (one per kind of its block
 * registry, `packages/digest/src/analysis/motorway-kinds.ts`); this file only shows and hides them in the browser.
 *
 *   - D3: the kinds are the registry's (`MOTORWAY_FILTER_KINDS`, held equal to the digest's list by
 *     `test/motorway-filter.test.ts`): a kind added there and not here turns that test red. The bar offers the kinds
 *     whose card the fragment holds, labelled with the card's own heading.
 *   - D4: a change applies at once, with no reload and no request: the cards and rows get the `hidden` attribute,
 *     the maps' marks of the kind (`MOTORWAY_FILTER_MAP`) `display: none` through the CSSOM, and the summary says "Parken und Laden im Umkreis von 50 km: 12 Einträge" — the radius named only while the visitor's
 *     own position is in use (the radius control is then shown, 2.3.11) and the cards are the radius's (the around
 *     block carries its count line; #901 review 2: a radius holding no junction shows the whole road, unnamed).
 *   - D8: the Ampel still judges everything it holds; when the filter hides a row one of its reasons links to, the
 *     bar says so (`MOTORWAY_ANCHOR_KIND`, the reasons' anchors by kind).
 *   - D9: the choice may stand in the address (`?show=parking,charging`, `history.replaceState`; a page with a query
 *     is `noindex`), the position never does; it is remembered on the device only after a click on "Auswahl merken"
 *     (localStorage, every access in try/catch). With JavaScript off the bar stays `hidden` and every card shows.
 *   - D10: real checkboxes in a fieldset with its legend, the summary `aria-live="polite"`; the bar is rendered by the
 *     server with the right boxes checked and shown by an inline script placed directly after it, before the cards
 *     below are parsed; until the page is parsed a mutation observer filters each chunk before it is painted — so a
 *     `?show=` page paints filtered, with no shift, and the shared stylesheet carries no rule per kind (the home's
 *     60 KB budget pays for every byte of it).
 *
 * Reads no database (A2): the cards and their counts are read off the fragment the page embeds.
 */
import { t } from "../i18n/index.js";
import type { Lang } from "../site/pages.js";
import { TAGS } from "./dates.js";
import { INLINE_SCRIPTS } from "./inline-scripts.js";
import { allNone, esc as escHtml } from "@viafrei/design";
import { listFormat, numberFormat, pluralRules } from "./intl-formats.js";

/**
 * The digest's block registry (`MOTORWAY_KINDS`), in its order — pinned equal by `test/motorway-filter.test.ts`. #987:
 * that order is the tier order (A live danger, B route and plan, C services, D reference), so the bar's boxes stand in
 * the order of the cards they show.
 */
export const MOTORWAY_FILTER_KINDS = [
  "closures",
  "jams",
  "warnings",
  "weather",
  "roadweather",
  "roadworks",
  "planned",
  "crossings",
  "detours",
  "messages",
  "lorry",
  "parking",
  "charging",
  "fuel",
  "cities",
  "cameras",
  "speed",
  "bridges",
  "borders",
] as const;
export type MotorwayFilterKind = (typeof MOTORWAY_FILTER_KINDS)[number];

/**
 * #987: each kind's icon — the id of its `<symbol>` in the sprite the digest's fragment carries (`MOTORWAY_KIND_META`'s
 * `icon`, pinned equal), so the bar's box shows the card head's own icon.
 */
export const MOTORWAY_FILTER_ICONS: Readonly<Record<MotorwayFilterKind, string>> = Object.fromEntries(MOTORWAY_FILTER_KINDS.map((k) => [k, `mwi-${k}`])) as Record<MotorwayFilterKind, string>;

/** The maps' mark classes of each kind (the digest's `MOTORWAY_KIND_MAP`, pinned equal), hidden with the kind. */
export const MOTORWAY_FILTER_MAP: Readonly<Record<MotorwayFilterKind, readonly string[]>> = {
  closures: ["mw-closure", "mw-closure-ext", "mw-key--closure"],
  jams: ["mw-jam", "mw-jam-extent", "mw-jam-end", "mw-delay", "mw-key--jam"],
  warnings: ["mwa-warning"],
  roadworks: ["mw-roadworks", "mw-works-ext", "mw-key--roadworks"],
  planned: [],
  crossings: [],
  messages: [],
  bridges: [],
  detours: [],
  borders: [],
  lorry: [],
  weather: ["mw-warn", "mw-key--warn", "mwa-dwd"],
  roadweather: ["mw-weather", "mw-key--weather"],
  parking: ["mw-parking", "mw-key--parking"],
  charging: ["mw-charging", "mw-key--charging"],
  cameras: ["mw-camera", "mw-key--camera"],
  speed: [],
  fuel: [],
  cities: [],
};

/** The Ampel's reason anchors by kind (the digest's `MOTORWAY_ANCHOR_KIND`, pinned equal): `mw-c3` is a closure's row. */
export const MOTORWAY_ANCHOR_KIND: Readonly<Record<string, MotorwayFilterKind>> = { c: "closures", j: "jams", x: "warnings", r: "roadworks", w: "weather", rw: "roadweather", m: "messages", b: "bridges" };

/** The localStorage key — written only by a click on "Auswahl merken" (D9). */
export const MOTORWAY_FILTER_STORE = "vf.motorway.show";

const isKind = (x: string): x is MotorwayFilterKind => (MOTORWAY_FILTER_KINDS as readonly string[]).includes(x);

/** One card of the fragment: its kind, its heading (the digest's escaped text) and its count (null: not a list). */
export type FilterCard = { readonly kind: MotorwayFilterKind; readonly title: string; readonly n: number | null };

// #987: a card of the grid or the reference block (`<section>`); the head opens with the kind's icon.
const CARD = /<section class="pcard mwk[^"]*" id="mwk-([a-z]+)" aria-labelledby="[^"]+"[^>]*><header class="pcard__head[^"]*">(?:<svg class="mwi"[^>]*><use href="#[a-z0-9-]+"\/><\/svg>)?<h3 class="pcard__title mwk__t" id="[^"]+">([^<]*)<\/h3>(?:<data class="mwk__n" value="(\d+)">)?/g;
// #1051: a chip of the "nothing reported" line — a `<details>` whose summary is the kind's icon and word, no count:
// a topic with nothing, so its count is 0.
const CHIP = /<details class="mwk mwk-chip[^"]*" id="mwk-([a-z]+)" aria-labelledby="[^"]+"[^>]*><summary class="mwk-chip__s">(?:<svg class="mwi"[^>]*><use href="#[a-z0-9-]+"\/><\/svg>)?<span class="mwk-chip__t" id="[^"]+">([^<]*)<\/span>/g;

/** The cards the fragment holds, in its order; a kind this file does not know is left out (its test keeps that from shipping). */
export function filterCardsOf(html: string): readonly FilterCard[] {
  const found = [
    ...[...html.matchAll(CARD)].map((m) => ({ at: m.index, kind: m[1] ?? "", title: m[2] ?? "", n: m[3] === undefined ? null : Number(m[3]) })),
    ...[...html.matchAll(CHIP)].map((m) => ({ at: m.index, kind: m[1] ?? "", title: m[2] ?? "", n: 0 })),
  ].sort((a, b) => a.at - b.at);
  const out: FilterCard[] = [];
  for (const f of found) {
    const kind = f.kind;
    if (!isKind(kind) || out.some((c) => c.kind === kind)) continue;
    out.push({ kind, title: f.title, n: f.n });
  }
  return out;
}

/** The address's `?show=` as kinds (unknown names dropped, the registry's order); null when the address names none. */
export function showOf(params: URLSearchParams): readonly MotorwayFilterKind[] | null {
  const raw = params.get("show");
  if (raw === null) return null;
  const asked = new Set(raw.split(",").map((x) => x.trim()));
  return MOTORWAY_FILTER_KINDS.filter((k) => asked.has(k));
}

/** `show=…` for a view query (kept by a redirect, `motorwayViewQuery`), or "" for none or every kind. */
export function showQuery(params: URLSearchParams): string {
  const s = showOf(params);
  return s === null || s.length === 0 || s.length === MOTORWAY_FILTER_KINDS.length ? "" : `show=${s.join(",")}`;
}

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The copy the bar and its script use, in the page's language. */
export function filterCopy(lang: Lang): Readonly<Record<"legend" | "all" | "none" | "allLabel" | "noneLabel" | "save" | "saved" | "forget" | "everything" | "nothing" | "sum" | "sumR" | "zero" | "one" | "few" | "many" | "other" | "ampel", string>> {
  // the templates themselves: the summary fills {kinds}, {r} and {n} (on the server and in the script alike)
  const k = (key: Parameters<typeof t>[1]): string => t(lang, key, { kinds: "{kinds}", r: "{r}", n: "{n}" });
  return {
    legend: k("place.motorway.filter.legend"),
    all: k("place.motorway.filter.all"),
    // #983: "Keine anzeigen" beside "Alle anzeigen", and both named in full for a screen reader (the visible words inside)
    none: k("place.motorway.filter.none"),
    allLabel: k("place.motorway.filter.allLabel"),
    noneLabel: k("place.motorway.filter.noneLabel"),
    save: k("place.motorway.filter.save"),
    saved: k("place.motorway.filter.saved"),
    forget: k("place.motorway.filter.forget"),
    everything: k("place.motorway.filter.everything"),
    nothing: k("place.motorway.filter.nothing"),
    sum: k("place.motorway.filter.sum"),
    sumR: k("place.motorway.filter.sumR"),
    zero: k("place.motorway.filter.entriesZero"),
    one: k("place.motorway.filter.entriesOne"),
    few: k("place.motorway.filter.entriesFew"),
    many: k("place.motorway.filter.entriesMany"),
    other: k("place.motorway.filter.entriesOther"),
    ampel: k("place.motorway.filter.ampel"),
  };
}

/** "Parken und Laden" — the kinds' headings as the language joins a list (`Intl.ListFormat`). */
function kindsText(lang: Lang, titles: readonly string[]): string {
  return listFormat(TAGS[lang], { style: "long", type: "conjunction" }).format(titles);
}

/**
 * "12 Einträge" by the language's plural rule, read with the page's Intl tag (European Portuguese, Cyrillic Serbian,
 * #753). Latvian's "zero" category (0, 10–20, 30 …) takes its own form ("10 ierakstu"); every other language repeats
 * its "other" form there.
 */
function entriesText(lang: Lang, c: ReturnType<typeof filterCopy>, n: number): string {
  const r = pluralRules(TAGS[lang]).select(n);
  const tpl = r === "zero" ? c.zero : r === "one" ? c.one : r === "few" ? c.few : r === "many" ? c.many : c.other;
  return tpl.replace("{n}", numberFormat(TAGS[lang]).format(n));
}

/** The summary line for a choice (the server's first render and the script's, the same words). */
export function summaryText(lang: Lang, cards: readonly FilterCard[], shown: ReadonlySet<MotorwayFilterKind>, radiusKm: number | null = null): string {
  const c = filterCopy(lang);
  const on = cards.filter((x) => shown.has(x.kind));
  if (on.length === 0) return c.nothing;
  const n = on.reduce((a, x) => a + (x.n ?? 0), 0);
  const decode = (s: string): string => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const kinds = on.length === cards.length ? c.everything : kindsText(lang, on.map((x) => decode(x.title)));
  return (radiusKm === null ? c.sum : c.sumR).replace("{kinds}", kinds).replace("{r}", String(radiusKm)).replace("{n}", entriesText(lang, c, n));
}

/**
 * The bar, `hidden` (shown by its script: with JavaScript off every card shows, D9). `show`: the address's choice,
 * checked as asked; null: every kind. Empty when the fragment carries no card.
 */
export function motorwayFilterHtml(lang: Lang, cards: readonly FilterCard[], show: readonly MotorwayFilterKind[] | null): string {
  if (cards.length === 0) return "";
  const c = filterCopy(lang);
  const shown = new Set(show ?? MOTORWAY_FILTER_KINDS);
  const boxes = cards
    .map((x) => `<label class="chip mwf__opt"><input type="checkbox" name="show" value="${x.kind}"${shown.has(x.kind) ? " checked" : ""}> <svg class="mwi" aria-hidden="true" focusable="false"><use href="#${MOTORWAY_FILTER_ICONS[x.kind]}"/></svg><span class="mwf__name">${x.title}</span></label>`)
    .join("");
  return (
    `<section class="wrap mwf" id="mwf" hidden aria-labelledby="mwf-l">` +
    `<fieldset class="mwf__set"><legend class="mwf__legend" id="mwf-l">${esc(c.legend)}</legend>` +
    `<div class="mwf__opts">${boxes}</div>` +
    `<p class="mwf__acts">${allNone({ all: { text: escHtml(c.all), label: escHtml(c.allLabel), hook: "mwf__all" }, none: { text: escHtml(c.none), label: escHtml(c.noneLabel), hook: "mwf__none" } })} <button type="button" class="btn mwf__save">${esc(c.save)}</button> <span class="motorway__note mwf__kept" hidden>${esc(c.saved)} <button type="button" class="placebar__forget mwf__forget">${esc(c.forget)}</button></span></p>` +
    `</fieldset>` +
    `<p class="mwf__sum" id="mwf-sum" aria-live="polite">${esc(summaryText(lang, cards, shown))}</p>` +
    `<p class="motorway__note mwf__ampel" id="mwf-ampel" hidden>${esc(c.ampel)}</p>` +
    `</section>`
  );
}

/**
 * #986: each freshness sign's relative age ("vor 3 Min."), from its <time datetime>, in the page's language (`C.lang`),
 * recomputed every 30 s and after a swap — the fragment is cached, so the server never writes an age that would go
 * stale in it. ONE text, carried by the road page's bar script and by {@link freshAgesScript} (the overview, review S3).
 */
export const AGES_JS = `// #986: each freshness sign's relative age ("vor 3 Min."), from its <time datetime>, in the page's language, recomputed
// every 30 s and after a swap — the fragment is cached, so the server never writes an age that would go stale in it.
function ages() {
  var now = Date.now(), rtf = typeof Intl === "object" && Intl.RelativeTimeFormat ? new Intl.RelativeTimeFormat(C.lang, { numeric: "auto", style: "short" }) : null;
  if (!rtf) return;
  Array.prototype.forEach.call(document.querySelectorAll(".fresh__t"), function (t) {
    var at = Date.parse(t.getAttribute("datetime") || ""), out = t.nextElementSibling;
    if (!out || !out.classList.contains("fresh__age") || !isFinite(at)) return;
    var s = Math.max(0, Math.round((now - at) / 1000)), txt;
    if (s < 60) txt = rtf.format(-s, "second"); else if (s < 3600) txt = rtf.format(-Math.floor(s / 60), "minute"); else if (s < 86400) txt = rtf.format(-Math.floor(s / 3600), "hour"); else txt = rtf.format(-Math.floor(s / 86400), "day");
    txt = " (" + txt + ")";
    if (out.textContent !== txt) out.textContent = txt;
  });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ages); else ages();
setInterval(ages, 30000);
["vf:main", "vf:loaded"].forEach(function (ev) { document.addEventListener(ev, function () { setTimeout(ages, 0); }); });`;

/**
 * The relative-age filler alone (review S3 of 2.3.23): the motorway overview shows a freshness sign with an empty
 * `.fresh__age` and has no filter bar, so it ships this — an inline script under the page's nonce like the road page's.
 */
export function freshAgesScript(lang: Lang): string {
  // #1064: AGES_JS as the build minified it (`src/generated/inline-scripts.json`), its configuration the one argument
  return `(${INLINE_SCRIPTS.ages})(${JSON.stringify({ lang: TAGS[lang] })});`;
}

/**
 * The bar's script, placed directly after the bar (D10: it runs before the cards below are parsed, and filters each
 * parsed chunk before it is painted). It sends nothing and stores nothing unless "Auswahl merken"
 * is clicked; it re-applies whenever the island swaps the main block in (`vf:main`) or loads an around block
 * (`vf:loaded`, the Ampel may have changed) and when the position goes (`vf:cleared`, `vf:pos`).
 */
export function motorwayFilterScript(lang: Lang): string {
  const c = filterCopy(lang);
  const cfg = { lang: TAGS[lang], kinds: MOTORWAY_FILTER_KINDS, map: MOTORWAY_FILTER_MAP, anchors: MOTORWAY_ANCHOR_KIND, store: MOTORWAY_FILTER_STORE, c };
  // #1064: FILTER_JS as the build minified it (`src/generated/inline-scripts.json`), its configuration the one argument
  return `(${INLINE_SCRIPTS.filter})(${JSON.stringify(cfg).replace(/</g, "\\u003c")});`;
}

/**
 * #1064: the bar script's source, the body of a function of its configuration `C`. The page carries it MINIFIED
 * (`scripts/inline-min.ts` → `src/generated/inline-scripts.json`, held equal to this text by
 * `test/inline-scripts.test.ts`): its comments and indentation were about 40 % of its bytes on every motorway page.
 */
export const FILTER_JS = `// #983 review: the digest's "Alle" / "Keine" links name the stretch, the direction and the layers; the view options it
// never sees — the radius and this bar's choice — are carried over from the page's own address as a link is followed,
// so neither resets (the bar's own "show" is left out where the link turns every layer back on, its point being "all").
// #982/#983 review: a middle click fires auxclick, never click, and "open in new tab" from the context menu fires
// neither — so the hrefs are rewritten once the links are parsed (and again when a swap brings new ones), and once more
// at the moment any button or the menu reaches one, since the radius in the address can move in between.
var LAYER_LINKS = "a.motorway__layerall, a.motorway__layernone";
function carry(a) {
  try {
    var u = new URL(a.getAttribute("href") || "", window.location.href), here = new URL(window.location.href);
    var r = here.searchParams.get("r");
    if (r !== null) u.searchParams.set("r", r);
    var show = here.searchParams.get("show");
    if (show !== null && a.classList.contains("motorway__layernone")) u.searchParams.set("show", show);
    a.setAttribute("href", u.pathname + u.search + u.hash);
  } catch (err) { /* the link as the digest wrote it */ }
}
function carryAll() { Array.prototype.forEach.call(document.querySelectorAll(LAYER_LINKS), carry); }
["click", "auxclick", "contextmenu"].forEach(function (ev) {
  document.addEventListener(ev, function (e) {
    var a = e.target && e.target.closest ? e.target.closest(LAYER_LINKS) : null;
    if (a) carry(a);
  }, true);
});
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", carryAll); else carryAll();
["vf:main", "vf:loaded"].forEach(function (ev) { document.addEventListener(ev, function () { setTimeout(carryAll, 0); }); });
${AGES_JS}
// owner 2026-10-27: the stretch form has no Apply button — a select, a direction or a layer box sends it at once (the
// submit is in <noscript> for a browser without scripts). Delegated, because a radius swap brings a new form; a box
// this bar has disabled sends nothing.
document.addEventListener("change", function (e) {
  var f = e.target && e.target.closest ? e.target.closest("form.motorway__filter") : null;
  if (!f || e.target.disabled) return;
  if (typeof f.requestSubmit === "function") f.requestSubmit(); else f.submit();
});
var bar = document.getElementById("mwf");
if (!bar) return;
var boxes = Array.prototype.slice.call(bar.querySelectorAll("input[name=show]"));
var offered = boxes.map(function (b) { return b.value; });
var sum = document.getElementById("mwf-sum");
var note = document.getElementById("mwf-ampel");
var kept = bar.querySelector(".mwf__kept");
function valid(list) { return list.filter(function (k) { return C.kinds.indexOf(k) >= 0; }); }
function saved() { try { var s = window.localStorage.getItem(C.store); return s === null ? null : valid(s.split(",")); } catch (e) { return null; } }
function asked() { try { var s = new URL(window.location.href).searchParams.get("show"); return s === null ? null : valid(s.split(",")); } catch (e) { return null; } }
var start = asked() || saved();
if (start !== null) boxes.forEach(function (b) { b.checked = start.indexOf(b.value) >= 0; });
if (kept) kept.hidden = saved() === null;
function on() { return boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; }); }
function main() { return document.getElementById("motorway-main"); }
// #901 review 2: the radius is named only while the cards ARE the radius's — the around block then carries its count
// line; a radius holding no junction shows the whole road with no count line, and the summary then names no radius.
function radius() { var f = document.getElementById("mwr"), r = document.getElementById("mwr-range"); return f && !f.hidden && r && document.querySelector("#motorway-around .mwa__count") ? Number(r.value) : null; }
function entries(n) { var r = new Intl.PluralRules(C.lang).select(n); var t = r === "zero" ? C.c.zero : r === "one" ? C.c.one : r === "few" ? C.c.few : r === "many" ? C.c.many : C.c.other; return t.replace("{n}", new Intl.NumberFormat(C.lang).format(n)); }
// A kind the bar does not offer (a card a later swap brought, which has no box) is never hidden.
function off(list, k) { return offered.indexOf(k) >= 0 && list.indexOf(k) < 0; }
// The maps' marks of each kind (SVG paths and legend keys) by the CSSOM, which the CSP allows (no style attribute is written).
function marks(list) { C.kinds.forEach(function (k) { var o = off(list, k); C.map[k].forEach(function (cls) { Array.prototype.forEach.call(document.getElementsByClassName(cls), function (e) { e.style.display = o ? "none" : ""; }); }); }); }
function apply() {
  var list = on();
  marks(list);
  var m = main();
  // #987: the grid's cards, the reference block's and (#1051) the chips of the "nothing reported" line, a chip naming its kind in .mwk-chip__t
  var cards = m ? Array.prototype.slice.call(m.querySelectorAll("#mw-cards > .mwk, #mw-quiet > .mwk, #mw-ref > .mwk")) : [];
  var n = 0, titles = [], hiddenCards = [];
  cards.forEach(function (card) {
    var k = card.id.slice(4), show = !off(list, k);
    card.hidden = !show;
    if (!show) { hiddenCards.push(k); return; }
    var d = card.querySelector(".mwk__n");
    if (d) n += Number(d.value) || 0;
    var h = card.querySelector(".mwk__t, .mwk-chip__t");
    if (h) titles.push(h.textContent);
  });
  // The around block's rows go with their kind's card.
  Array.prototype.forEach.call(document.querySelectorAll("#motorway-around .mwa__item"), function (li) {
    var k = (li.className.match(/mwa__item--([a-z]+)/) || [])[1];
    li.hidden = k !== undefined && off(list, k);
  });
  // ...and its count line says how many of them are still shown: the kinds' counts, past the listed rows too.
  var by = document.querySelector("#motorway-around .mwa__by"), nEl = document.querySelector("#motorway-around .mwa__n");
  if (by && nEl) {
    var left = 0;
    (by.getAttribute("value") || "").split(" ").forEach(function (kv) { var i = kv.lastIndexOf(":"), k = kv.slice(0, i); if (i > 0 && (k === "_" || !off(list, k))) left += Number(kv.slice(i + 1)) || 0; });
    if (nEl.textContent !== String(left)) nEl.textContent = String(left);
  }
  if (sum && cards.length > 0) {
    var r = radius();
    var kinds = titles.length === 0 ? null : titles.length === cards.length ? C.c.everything : new Intl.ListFormat(C.lang, { style: "long", type: "conjunction" }).format(titles);
    var t = kinds === null ? C.c.nothing : (r === null ? C.c.sum : C.c.sumR).replace("{kinds}", kinds).replace("{r}", String(r)).replace("{n}", entries(n));
    // written only when it changes: a write is itself a mutation the parse-time observer would answer (and the live
    // region would read out a sentence that did not change)
    if (sum.textContent !== t) sum.textContent = t;
  }
  // D8: a reason of the Ampel whose row the filter hides — the Ampel still judged it, and says so here.
  if (note) {
    // Judged by the reason's own row: the whole road's and the radius's Ampel link into the cards (#mw-c0), the
    // position's into the around list (#mwa-i3) — a row this bar hid (its card, or the around row of its kind) is
    // hidden. A reason whose row is not on the page falls back to the anchor's kind.
    var hid = Array.prototype.some.call(document.querySelectorAll("#ampel-slot a[href^='#']"), function (a) {
      var id = a.getAttribute("href").slice(1), t = id === "" ? null : document.getElementById(id);
      if (t) return t.closest("[hidden]") !== null;
      var p = (id.match(/^mw-([a-z]+)\\d/) || [])[1];
      var k = p === undefined ? undefined : C.anchors[p];
      return k !== undefined && off(list, k);
    });
    note.hidden = !hid;
  }
  // The GET form's own layer choice gives way to this bar while it is shown: its boxes (and f=1) are disabled, so a
  // submitted stretch carries no layer choice, and the bar's choice rides along as a hidden "show" (#901 review 9).
  // #983 review: a page sent with NO layer (a shared "Keine" link, ?f=1) has none of the layers' cards, so this bar
  // cannot offer them back; there the form's own layer boxes stay shown and live, the way out the hint points to.
  var none = m ? m.querySelector(".motorway__nolayer") : null;
  if (m && none) Array.prototype.forEach.call(m.querySelectorAll("form.motorway__filter"), function (form) {
    Array.prototype.forEach.call(form.querySelectorAll(".motorway__layers"), function (p) {
      p.hidden = false;
      Array.prototype.forEach.call(p.querySelectorAll("input"), function (i) { i.disabled = false; });
    });
    var h = form.querySelector("input[type=hidden][name=show]");
    if (h) h.remove();
  });
  else if (m) Array.prototype.forEach.call(m.querySelectorAll("form.motorway__filter"), function (form) {
    Array.prototype.forEach.call(form.querySelectorAll(".motorway__layers"), function (p) {
      p.hidden = true;
      Array.prototype.forEach.call(p.querySelectorAll("input"), function (i) { i.disabled = true; });
    });
    var h = form.querySelector("input[type=hidden][name=show]");
    var all = list.length === offered.length && offered.every(function (k) { return list.indexOf(k) >= 0; });
    if (all) { if (h) h.remove(); return; }
    if (!h) { h = document.createElement("input"); h.type = "hidden"; h.name = "show"; form.appendChild(h); }
    if (h.value !== list.join(",")) h.value = list.join(",");
  });
}
function address() {
  try {
    var u = new URL(window.location.href), list = on();
    if (list.length === offered.length && offered.every(function (k) { return list.indexOf(k) >= 0; })) u.searchParams.delete("show"); else u.searchParams.set("show", list.join(","));
    if (u.search !== window.location.search) window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash);
  } catch (e) { /* no history: the view still changes */ }
}
boxes.forEach(function (b) { b.addEventListener("change", function () { apply(); address(); }); });
bar.querySelector(".mwf__all").addEventListener("click", function () { boxes.forEach(function (b) { b.checked = true; }); apply(); address(); });
bar.querySelector(".mwf__none").addEventListener("click", function () { boxes.forEach(function (b) { b.checked = false; }); apply(); address(); });
bar.querySelector(".mwf__save").addEventListener("click", function () { try { window.localStorage.setItem(C.store, on().join(",")); if (kept) kept.hidden = false; } catch (e) { /* storage blocked: nothing kept */ } });
var forget = bar.querySelector(".mwf__forget");
if (forget) forget.addEventListener("click", function () { try { window.localStorage.removeItem(C.store); } catch (e) { /* nothing to forget */ } if (kept) kept.hidden = true; });
bar.hidden = false;
apply();
// While the page is still being parsed, each chunk the parser adds is filtered before it is painted (a mutation
// observer's callback runs before rendering): a ?show= page paints filtered, with no shift and no stylesheet rule.
if (document.readyState === "loading") {
  // nodes the PARSER added, never this script's own writes (the summary): those would answer themselves for ever
  var mo = window.MutationObserver ? new MutationObserver(function (rs) { if (rs.some(function (r) { return !bar.contains(r.target); })) apply(); }) : null;
  if (mo) mo.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", function () { if (mo) mo.disconnect(); apply(); });
}
["vf:main", "vf:loaded", "vf:cleared", "vf:pos"].forEach(function (ev) { document.addEventListener(ev, function () { setTimeout(apply, 0); }); });
`;
