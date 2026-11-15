/**
 * 2.4.6 (owner: "the field must suggest stations as you type, exactly like the place search"): ONE type-ahead for the
 * site's search fields that are not the place search — the station search (the catalogue's and the home block's) and,
 * on a station's departures, the "Ziel"/"Von" box. Both show the place search's own list (`place-suggest`,
 * `place-opt`, `sheet__results`), so every suggestion list looks alike, and keep its keys: ↓/↑ move through the
 * suggestions (↑ on the first returns to the field), Enter follows one, Esc closes the list and returns to the field.
 * A field is a `role="combobox"` input whose list is named by its `aria-controls` — no data attribute (the digest's
 * fragments carry none, the data-steward's sweep) — except the position bar's (`form.placepos__search`, #1112), whose
 * list the place island fills:
 *
 *  - in a search form (`form[role=search]`): what was typed (2–60 characters) is POSTed to `/fragment/station-suggest`
 *    — never put into a URL, like the place search's — and the digest's list of station links is shown;
 *  - in the SITE search (`form.site-search`, the header's box on every page and the search page's, #1111): the same,
 *    POSTed to `/fragment/search`, after a shorter pause (150 ms) — every kind of thing we hold, grouped;
 *  - in the board's filter (`form.stlive__filter`): the list is already in the page, hidden — the board's own names,
 *    each a link that applies the filter (the refresh script applies it in place); typing shows the ones that match.
 *
 * Without script each field is the plain GET field it was: Enter sends the form. It stores nothing and sends nothing
 * else. Minified into `src/generated/inline-scripts.json` (`npm run web:inline`).
 */
import { INLINE_SCRIPTS } from "./inline-scripts.js";
import { getFragment } from "./place.js";
import type { Lang } from "../site/pages.js";
import type { TileFetchOptions } from "./tiles.js";
import { SITE_SEARCH_ROUTE } from "./site-search.js";

/** The public route the station search asks (POST, JSON `{ q, lang }`). */
export const STATION_SUGGEST_ROUTE = "/fragment/station-suggest";
/** What the digest's answer begins with: the place search's list. */
export const STATION_SUGGEST_SHAPE = /^<div class="place-suggest[ "]/;
/** At most this many names of a board's own list are shown at once. */
export const NAMES_SUGGEST_MAX = 8;

export const SUGGEST_JS = `var LANG = document.documentElement.lang || "de";
var timers = new WeakMap(), asked = new WeakMap();
function fold(s) {
  var t = String(s).toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
  if (t.normalize) t = t.normalize("NFKD").replace(/[\\u0300-\\u036f]/g, "");
  return t.replace(/[^a-z0-9]+/g, " ").trim();
}
function kind(t) {
  if (!t || !t.getAttribute || t.getAttribute("role") !== "combobox" || !t.form || !t.getAttribute("aria-controls")) return null;
  // #1112: the position bar's search (form.placepos__search) is a search form too, but the place island owns its list
  // (the gazetteer's places, set in place); answering it here as a station field emptied that list
  if (t.form.classList.contains("placepos__search")) return null;
  if (t.form.classList.contains("stlive__filter")) return "names";
  if (t.form.classList.contains("site-search")) return "site";
  return t.form.getAttribute("role") === "search" ? "stations" : null;
}
function box(inp) { return document.getElementById(inp.getAttribute("aria-controls")); }
function expanded(inp) {
  var o = box(inp), n = 0;
  if (o) Array.prototype.forEach.call(o.querySelectorAll("a.place-opt"), function (a) { if (!a.closest("li").hidden) n++; });
  inp.setAttribute("aria-expanded", n > 0 && o && !o.hidden ? "true" : "false");
}
function close(inp) {
  var o = box(inp);
  if (!o) return;
  if (kind(inp) === "names") o.hidden = true; else o.innerHTML = "";
  expanded(inp);
}
function names(inp, q) {
  var o = box(inp), f = fold(q), first = [], rest = [];
  if (!o) return;
  Array.prototype.forEach.call(o.querySelectorAll("li"), function (li) {
    var t = fold(li.textContent || ""), at = t.indexOf(f);
    li.hidden = true;
    if (at === 0) first.push(li); else if (at > 0) rest.push(li);
  });
  first.concat(rest).slice(0, ${String(NAMES_SUGGEST_MAX)}).forEach(function (li) { li.hidden = false; });
  o.hidden = first.length + rest.length === 0;
  expanded(inp);
}
function ask(inp, q, route) {
  fetch(route, { method: "POST", headers: { accept: "text/html", "content-type": "application/json" }, body: JSON.stringify({ q: q, lang: LANG }), credentials: "omit" })
    .then(function (r) { return r.status === 200 ? r.text() : ""; })
    .then(function (h) {
      if (q !== asked.get(inp)) return;
      var o = box(inp);
      if (o) o.innerHTML = /^<div class="place-suggest[ "]/.test(h) ? h : "";
      expanded(inp);
    })
    .catch(function () {});
}
document.addEventListener("input", function (e) {
  var inp = e.target, k = kind(inp);
  if (!k) return;
  clearTimeout(timers.get(inp));
  timers.set(inp, setTimeout(function () {
    var q = String(inp.value || "").trim();
    if (q.length < 2 || q.length > 60) { asked.set(inp, ""); close(inp); return; }
    if (q === asked.get(inp)) return;
    asked.set(inp, q);
    if (k === "names") names(inp, q); else ask(inp, q, k === "site" ? "${SITE_SEARCH_ROUTE}" : "${STATION_SUGGEST_ROUTE}");
  }, k === "names" ? 80 : k === "site" ? 150 : 200));
});
function owner(t) {
  if (kind(t)) return t;
  var o = t && t.closest ? t.closest(".sheet__results") : null;
  if (!o || !o.id) return null;
  var inp = document.querySelector('[aria-controls="' + o.id + '"]');
  return kind(inp) ? inp : null;
}
document.addEventListener("keydown", function (e) {
  var inp = owner(e.target);
  if (!inp) return;
  var o = box(inp);
  var opts = o && !o.hidden ? Array.prototype.slice.call(o.querySelectorAll("a.place-opt")).filter(function (a) { return !a.closest("li").hidden; }) : [];
  if (e.key === "Escape") {
    if (!opts.length) return;
    e.preventDefault();
    close(inp);
    inp.focus();
    return;
  }
  if ((e.key !== "ArrowDown" && e.key !== "ArrowUp") || !opts.length) return;
  e.preventDefault();
  var i = opts.indexOf(document.activeElement);
  if (e.key === "ArrowUp" && i === 0) { inp.focus(); return; }
  var next = e.key === "ArrowDown" ? (i + 1) % opts.length : (i <= 0 ? opts.length : i) - 1;
  opts[next].focus();
});
// a name picked from the board's list: the box says it (the refresh script applies the link in place)
document.addEventListener("click", function (e) {
  var a = e.target && e.target.closest ? e.target.closest("a.place-opt") : null;
  var inp = a ? owner(a) : null;
  if (!inp || kind(inp) !== "names") return;
  var name = a.querySelector(".place-opt__name");
  inp.value = (name || a).textContent;
  asked.set(inp, inp.value);
  close(inp);
}, true);`;

/** The type-ahead's script for a page that carries a suggesting field. */
export function suggestScript(): string {
  return `(${INLINE_SCRIPTS.suggest})();`;
}

/** Whether a fragment carries a field this script serves: a combobox in the board's filter or a station search. */
export const carriesSuggest = (html: string): boolean => /<input class="sheet__input"[^>]* role="combobox"/.test(html);

/** The digest's suggestion list for what was typed (2–60 characters), or null (too short or long, or no answer). */
export async function fetchStationSuggest(q: string, lang: Lang, o: TileFetchOptions): Promise<string | null> {
  const t = q.trim();
  if (t.length < 2 || t.length > 60) return null;
  const r = await getFragment(`${o.baseUrl}/internal/station-suggest?q=${encodeURIComponent(t)}&lang=${lang}`, o, STATION_SUGGEST_SHAPE, "</div>");
  return r.ok ? r.html : null;
}
