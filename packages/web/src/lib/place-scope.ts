/**
 * #1088: the place headline — "Live für [📍 Kassel ▾] [🇩🇪 Ganz Deutschland]" — of the home, the place pages and the
 * motorway pages. Its markup is `components/PlaceHead.astro`; this module holds what the server decides about it
 * (`placeScopeOf`, `scopeHrefs`) and its small inline script (`PLACEHEAD_JS`), which only FOLLOWS the location island
 * (`location/island.ts`): the island announces every place it shows with `vf:place`, and this script sets which radio
 * of the group "Bereich" is on, the source line, the IP guess's confirm row and the "aktualisiert für X" mark.
 *
 * Without JavaScript the two radios are links: the place's own address (a place page, or the home) and `?scope=de`,
 * which the home answers with no IP lookup at all (`location/server.ts`). The search is hidden until this script runs,
 * because what is typed is POSTed by the island and never put in a URL (no form can carry it without one).
 *
 * Nothing here reads or writes storage, and nothing is sent anywhere.
 */
import { t } from "../i18n/index.js";
import type { Lang } from "../site/pages.js";
import { INLINE_SCRIPTS } from "./inline-scripts.js";
import { isAddressableKey } from "../location/ladder.js";

/** What the address asked for (`?scope=de`, `?at=<addressable key>`): Germany, a chosen key, or nothing. */
export type ScopeAsk = { readonly kind: "germany" } | { readonly kind: "at"; readonly at: string } | { readonly kind: "none" };

/**
 * The home's address choice. `?at=` is honoured for an ADDRESSABLE key only (a Gemeinde, a district, a postcode —
 * `isAddressableKey`): a point is a person's position and never stands in a URL. `scope=de` wins over `at`.
 */
export function placeScopeOf(params: URLSearchParams): ScopeAsk {
  if (params.get("scope") === "de") return { kind: "germany" };
  const at = params.get("at");
  return at !== null && isAddressableKey(at) ? { kind: "at", at } : { kind: "none" };
}

/** The two radios' no-script targets: the place's own address and the same page with `?scope=de` (other parameters dropped). */
export function scopeHrefs(path: string, placeHref: string | null): { readonly place: string; readonly germany: string } {
  return { place: placeHref ?? path, germany: `${path}?scope=de` };
}

/** The script's words, in the page's language. */
export function placeHeadCopy(lang: Lang): Readonly<Record<string, string>> {
  return {
    // the template itself: the script fills {place}
    upd: t(lang, "place.head.updated", { place: "{place}" }),
    germany: t(lang, "place.germany"),
    confirmed: t(lang, "place.head.confirmed"),
    outside: t(lang, "place.head.outside"),
    germanyHow: t(lang, "place.head.germanyHow"),
  };
}

/**
 * The headline's script (a function of its copy `C` and whether the server's place was an IP guess `ip`). It must run
 * BEFORE the island, so it hears the island's first `vf:place`.
 */
export const PLACEHEAD_JS = `function (C) {
  var d = document;
  function $(id) { return d.getElementById(id); }
  var place = $("place-pill"), de = $("place-scope-de"), how = $("place-pill-how"), upd = $("place-upd");
  var row = $("place-confirm"), box = $("place-head"), q = $("place-hq"), out = $("place-hresults");
  if (!place || !de) return;
  if (box) box.removeAttribute("hidden");
  var confirmed = false;
  var prev = C.at ? C.label : null;
  function show(e, on) { if (!e) return; if (on) e.removeAttribute("hidden"); else e.setAttribute("hidden", ""); }
  var onPlace = place.getAttribute("aria-checked") === "true";
  function radios(on) {
    onPlace = on;
    de.setAttribute("aria-checked", on ? "false" : "true");
    de.setAttribute("tabindex", on ? "-1" : "0");
    if (oneLine()) return;
    place.setAttribute("aria-checked", on ? "true" : "false");
    place.setAttribute("tabindex", on ? "0" : "-1");
  }
  show(row, C.ip);
  d.addEventListener("vf:place", function (e) {
    var det = (e && e.detail) || {};
    var label = typeof det.label === "string" ? det.label : null;
    radios(label !== null);
    // the note sits in the page's place block, below the header and this script (#1153): looked up when used
    show($("place-de-note"), label === null);
    if (how && label === null) how.textContent = C.germanyHow;
    else if (how && det.outside === "border") how.textContent = C.outside;
    else if (how && confirmed && det.how === "ip") how.textContent = C.confirmed;
    show(row, label !== null && det.how === "ip" && !confirmed);
    // #1177: the home's open bar folds when the place arrives (a kept one, a just-found one); a person who opened it keeps it
    if (label !== null && fold && !fold.hasAttribute("data-fold")) folded(true);
    if (label !== prev && upd) {
      upd.textContent = C.upd.replace("{place}", label === null ? C.germany : label);
      show(upd, true);
    }
    prev = label;
  });
  // #1174 (#1190, #1173): the folded bar (a phone only: data-fold and the stylesheet). It opens on the search symbol, on
  // the pill, on "Anderer Ort" and on the island's way to the search (vf:search), never on a scope switch; "Schließen"
  // and Escape fold it again, Escape only while no suggestion is open (the form's own Escape clears those first). While
  // it shows the one line the pill IS the bar's opener, so it is a button then, a radio again as soon as the rows stand.
  var fold = $("place-fold"), opener = $("place-open"), closer = $("place-close"), group = $("place-scope"), arrow = false, back = opener;
  var phone = window.matchMedia ? window.matchMedia("(max-width: 600px)") : null;
  function oneLine() { return !!fold && !!opener && !!phone && phone.matches && fold.getAttribute("data-fold") === "closed"; }
  function roles() {
    var line = oneLine();
    place.setAttribute("role", line ? "button" : "radio");
    if (group) group.setAttribute("role", line ? "group" : "radiogroup");
    if (line) { place.removeAttribute("aria-checked"); place.setAttribute("aria-expanded", "false"); place.setAttribute("aria-controls", "place-rows"); place.setAttribute("tabindex", "0"); }
    else { place.removeAttribute("aria-expanded"); place.setAttribute("aria-controls", "place-hq"); radios(onPlace); }
  }
  function folded(on) {
    if (!fold || !opener) return;
    fold.setAttribute("data-fold", on ? "closed" : "open");
    opener.setAttribute("aria-expanded", on ? "false" : "true");
    roles();
  }
  var yes = $("place-cyes"), other = $("place-cother");
  if (yes) yes.addEventListener("click", function () {
    confirmed = true;
    show(row, false);
    if (how) how.textContent = C.confirmed;
  });
  if (other) other.addEventListener("click", function () {
    show(row, false);
    folded(false);
    if (q) q.focus();
  });
  if (fold && opener) {
    opener.setAttribute("role", "button");
    function openFrom(e, from) { e.preventDefault(); back = from; folded(false); if (q) q.focus(); }
    opener.addEventListener("click", function (e) { openFrom(e, opener); });
    opener.addEventListener("keydown", function (e) { if (e.key === " ") { e.preventDefault(); opener.click(); } });
    // this script runs before the island, so while the one line stands the pill's tap is the fold's and never the island's
    place.addEventListener("click", function (e) { if (oneLine()) { e.stopImmediatePropagation(); openFrom(e, place); } });
    place.addEventListener("keydown", function (e) { if (e.key === " " && oneLine()) { e.preventDefault(); place.click(); } });
    if (phone && phone.addEventListener) phone.addEventListener("change", roles);
    roles();
    if (closer) closer.addEventListener("click", function () { folded(true); back.focus(); });
    // an arrow key selects a radio: that is a scope switch, even when the island then heads for the search
    d.addEventListener("vf:search", function () { if (!arrow) folded(false); });
    fold.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || fold.getAttribute("data-fold") !== "open" || (out && out.querySelector("a.place-opt"))) return;
      folded(true);
      // a desktop shows no opener (every row stays): nothing to fold there, the rows stay open
      if (opener.offsetParent === null) { folded(false); return; }
      back.focus();
    }, true);
  }
  // The radio group's keys: an arrow moves to the other radio and selects it.
  if (group) group.addEventListener("keydown", function (e) {
    if (oneLine() || ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].indexOf(e.key) < 0) return;
    e.preventDefault();
    var to = d.activeElement === place ? de : place;
    to.focus();
    arrow = true;
    to.click();
    arrow = false;
  });
  // The search as a combobox: the list is announced as open when it holds options; arrows walk it, Escape clears it.
  if (q && out) {
    d.addEventListener("vf:suggested", function () {
      var n = out.querySelectorAll("a.place-opt").length;
      q.setAttribute("aria-expanded", n > 0 ? "true" : "false");
    });
    var head = $("place-head");
    if (head) head.addEventListener("keydown", function (e) {
      var opts = Array.prototype.slice.call(out.querySelectorAll("a.place-opt"));
      if (e.key === "Escape" && opts.length > 0) { out.innerHTML = ""; q.setAttribute("aria-expanded", "false"); q.focus(); return; }
      if ((e.key !== "ArrowDown" && e.key !== "ArrowUp") || opts.length === 0) return;
      var i = opts.indexOf(d.activeElement);
      if (i < 0 && d.activeElement !== q) return;
      e.preventDefault();
      var next = e.key === "ArrowDown" ? (i + 1) % opts.length : i <= 0 ? -1 : i - 1;
      if (next < 0) q.focus(); else opts[next].focus();
    });
  }
}`;

/** The script text a page carries: the headline's script and its configuration. */
export function placeHeadScript(lang: Lang, state: { readonly ip: boolean; readonly at: boolean; readonly label: string | null }): string {
  const json = JSON.stringify({ ...placeHeadCopy(lang), ip: state.ip, at: state.at, label: state.label }).replaceAll("<", "\\u003c");
  return `(${INLINE_SCRIPTS.placehead})(${json});`;
}
