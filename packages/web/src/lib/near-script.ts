/**
 * The "near your place" block of an index page, read from the visitor's remembered choice (#1113 the motorway index,
 * #1182 the station index): ONE script for both, configured by the page (`C`: `{ lang, slot, route, shape }`).
 *
 * The script READS the choice and writes nothing (the click-only rule of 2026-10-13: nothing is stored on load). The
 * entry is read by the location island's own rule: `viafrei.place`, a place only when `how` is "manual" or "browser"
 * and its key is well formed, and an entry twelve months old is no choice. A shared address wins over what is
 * remembered without changing it (`placeScopeOf`): `?scope=de` shows the country, `?at=<ags:|slug:>` that place. The
 * key travels in a POST body, never in a URL, and the answer is `no-store`.
 *
 * #1182: the island tells the page when the choice changes — a click in the place bar (`vf:place`, fired before the
 * island writes the choice, so the script re-reads once the click's own work has ended) and "Ort vergessen"
 * (`vf:cleared`): the block follows, and with no choice left the slot holds again what the server rendered into it
 * (the station index's IP rung, or nothing).
 */
import { INLINE_SCRIPTS } from "./inline-scripts.js";

/** The page's configuration: its language, the slot's id, the public route asked, the answer's required opening. */
export type NearScriptConfig = { readonly lang: string; readonly slot: string; readonly route: string; readonly shape: string };

/** The script's readable source (minified into `src/generated/inline-scripts.json` as `near`, #1064). */
export const NEAR_JS = `var slot = document.getElementById(C.slot);
if (!slot || typeof fetch !== "function") return;
var KEY_RE = /^(?:ags:\\d{8}|slug:[a-z0-9]+(?:-[a-z0-9]+)*|pt:-?\\d{1,2}(?:\\.\\d{1,6})?,-?\\d{1,3}(?:\\.\\d{1,6})?)$/;
var first = slot.innerHTML, firstHidden = slot.hidden, last, n = 0;
// undefined: nothing chosen (the server's block stays); null: the country chosen (no block); else the key
function chosen() {
  var q = "";
  try { q = String(location.search || ""); } catch (e) { q = ""; }
  // a shared address wins over the remembered choice, and changes nothing kept
  if (/(?:^\\?|&)scope=de(?:&|$)/.test(q)) return null;
  var m = /(?:^\\?|&)at=((?:ags:\\d{8})|(?:slug:[a-z0-9]+(?:-[a-z0-9]+)*))(?:&|$)/.exec(q);
  if (m) return m[1];
  var s = null;
  try { s = JSON.parse(localStorage.getItem("viafrei.place") || "null"); } catch (e) { s = null; }
  var d = new Date(), month = d.getUTCFullYear() * 12 + d.getUTCMonth();
  if (!s || typeof s !== "object") return undefined;
  if (typeof s.m === "number" && month - s.m >= 12) return undefined;
  if (s.how === "germany") return null;
  if (s.how !== "manual" && s.how !== "browser") return undefined;
  if (typeof s.at !== "string" || !KEY_RE.test(s.at)) return undefined;
  return s.at;
}
function show() {
  var at = chosen();
  if (at === last) return;
  last = at;
  var mine = ++n;
  if (typeof at !== "string") {
    slot.innerHTML = at === null ? "" : first;
    slot.hidden = at === null ? true : firstHidden;
    return;
  }
  fetch(C.route, { method: "POST", headers: { accept: "text/html", "content-type": "application/json" }, body: JSON.stringify({ at: at, lang: C.lang }), credentials: "omit" })
    .then(function (r) { return r.status === 200 ? r.text() : ""; })
    .then(function (h) {
      if (mine !== n || h.indexOf(C.shape) !== 0) return;
      slot.innerHTML = h;
      slot.removeAttribute("hidden");
    })
    .catch(function () {});
}
show();
function later() { setTimeout(show, 0); }
if (typeof document.addEventListener === "function") {
  document.addEventListener("vf:place", later);
  document.addEventListener("vf:cleared", later);
}`;

/** A page's call of the minified script with its configuration. */
export function nearScript(cfg: NearScriptConfig): string {
  return `(${INLINE_SCRIPTS.near})(${JSON.stringify(cfg)});`;
}
