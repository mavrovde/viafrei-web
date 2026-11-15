/**
 * #1186 (owner 2026-11-04: "Save the type of the position hidden and switch to the specific type of the related
 * page"): a recent place ("my places", `viafrei.place.recent`) keeps its type (`k`) and its page (`p`) since 2.5.14,
 * set where the entry is made (the location island). An entry stored BEFORE that is a bare position (`pt:` key, no
 * `k`), and a located place could carry the nearest stop's name as its label ("Eschweiler Hbf") while its chip opened
 * the coordinate's cards. This script upgrades such an entry ONCE, on render:
 *
 *  - only an entry with a `pt:` key, no `k` and a label of 2–60 characters is read;
 *  - its label is asked of the position bar's own suggestions (`/fragment/suggest`, POST, `{ q, lang }` — the label
 *    the device already shows, never a position and never a type);
 *  - a station line whose name (with or without its town, or after a leading "near" word) equals the label and whose
 *    point lies within `RECENT_STATION_M` of the entry's cell is the station: the entry is REPLACED in place by that
 *    station (`k: "station"`, `p: <slug>`, the station's name) and keeps its key and month;
 *  - any other answer marks the entry a point (`k: "point"`), unchanged otherwise, so it is never asked again;
 *  - a failed read changes nothing.
 *
 * Exactly one write per entry, replacing that entry only; nothing is written for an entry it does not read, nothing
 * on a page with no such entry. It then tells the island (`vf:recent`), which renders the chips again. Minified into
 * `src/generated/inline-scripts.json` (`npm run web:inline`).
 */
import { INLINE_SCRIPTS } from "./inline-scripts.js";

/** How far from an old entry's cell centre its station may lie: the ~500 m cell's half-diagonal and the label's 250 m. */
export const RECENT_STATION_M = 600;

export const RECENT_KINDS_JS = `var K = "viafrei.place.recent", LANG = document.documentElement.lang || "de";
function fold(s) {
  var t = String(s).toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
  if (t.normalize) t = t.normalize("NFKD").replace(/[\\u0300-\\u036f]/g, "");
  return t.replace(/[^a-z0-9]+/g, " ").trim();
}
function read() {
  try { var v = JSON.parse(localStorage.getItem(K) || "null"); return Array.isArray(v) ? v : null; } catch (e) { return null; }
}
function old(r) {
  return r !== null && typeof r === "object" && typeof r.at === "string" && /^pt:-?\\d{1,2}(\\.\\d{1,6})?,-?\\d{1,3}(\\.\\d{1,6})?$/.test(r.at) && r.k === undefined && typeof r.label === "string" && r.label.length >= 2 && r.label.length <= 60;
}
function text(s) {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
}
function metres(a, b, c, d) {
  var x = (d - b) * Math.cos(((a + c) / 2) * Math.PI / 180), y = c - a;
  return Math.sqrt(x * x + y * y) * 111320;
}
function station(r, h) {
  var c = r.at.slice(3).split(",").map(Number), f = fold(r.label), m;
  var re = /<a class="place-opt" href="\\/[a-z]{2}\\/station\\/([a-z0-9][a-z0-9-]{0,89})" data-at="pt:(-?[0-9.]+),(-?[0-9.]+)" data-kind="station"><span class="place-opt__name"[^>]*>([^<]{1,120})<\\/span>/g;
  while ((m = re.exec(h)) !== null) {
    var line = text(m[4]), name = line.split(", ")[0], n = fold(name), w = fold(line);
    if ((f === n || f === w || f.slice(-n.length - 1) === " " + n || f.slice(-w.length - 1) === " " + w) && metres(c[0], c[1], Number(m[2]), Number(m[3])) <= ${String(RECENT_STATION_M)}) return { k: "station", p: m[1], label: name };
  }
  return null;
}
function upgrade(r) {
  fetch("/fragment/suggest", { method: "POST", headers: { accept: "text/html", "content-type": "application/json" }, body: JSON.stringify({ q: r.label, lang: LANG }), credentials: "omit" })
    .then(function (x) { return x.status === 200 ? x.text() : null; })
    .then(function (h) {
      if (h === null || !/^<div class="place-suggest[ "]/.test(h)) return;
      var s = station(r, h), list = read();
      if (list === null) return;
      var i = list.findIndex(function (e) { return old(e) && e.at === r.at && e.label === r.label; });
      if (i < 0) return;
      list[i] = s === null ? Object.assign({}, list[i], { k: "point" }) : { at: r.at, label: s.label, m: list[i].m, k: s.k, p: s.p };
      try { localStorage.setItem(K, JSON.stringify(list)); } catch (e) { return; }
      document.dispatchEvent(new CustomEvent("vf:recent"));
    })
    .catch(function () {});
}
(read() || []).filter(old).slice(0, 5).forEach(upgrade);`;

/**
 * The script text the page carries (every page with the position bar's script): the minified function, CALLED. The
 * minifier ships a function expression (`(function () { … })`), like every inline script; without the call the page
 * carried the upgrade and never ran it (the 2.5.14 Linux round, recent-kinds-1186 AC 3).
 */
export function recentKindsScript(): string {
  return `(${INLINE_SCRIPTS.recent})();`;
}
