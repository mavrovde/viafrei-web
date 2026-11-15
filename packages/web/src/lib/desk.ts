/**
 * #1180: the desktop dashboard's one script (from 1024 px; a phone runs nothing of it). The page is a `.desk` grid —
 * its blocks in the left column in their DOM order, its map sticky in the right (`site.css`, "desktop"). This script
 * does three things there, and none below 1024 px:
 *
 *   1. **Collapse.** The sections named by the page's `fold` selector stand as their head, their count and their
 *      sources line, with one "alle N anzeigen" button (`aria-expanded`, `aria-controls`); the lists named by `cap` show
 *      their first rows (the rest carry `desk__cut`) and the same button. A section holding its own fold (a place's card,
 *      #1176) is closed by that native `<details>` instead (`data-desk="native"`), whose summary carries the FS3 line. What must be seen is never in either selector (a road's closures
 *      and jams, its DWD warnings, the fuel card, FS-2026-11-06: fuel never folds), and a credit line folds only WITH its
 *      data: the sources line of a folded section stays in view, the rest of its credits go with its rows. Without a
 *      script, or below 1024 px, every section stands whole, as before.
 *   2. **Row ↔ marker.** The map's marks are links to their rows (`a.map-link[href="#<row id>"]`, #1043), or (a
 *      station's stops) to the page the row's own link names; the link itself is the pairing, so no row id is exported
 *      in the map (rule M7). Hovering or focusing a row lights its
 *      marks (`is-hot`); hovering or focusing a mark lights its row; activating a mark opens the section that holds its
 *      row, scrolls to it and marks it (`is-hit`) until the next one.
 *   3. **The map follows.** The section in the middle of the window has its rows' marks lit softly (`is-near`).
 *
 * The map sticks under the site's sticky header: the script writes the header's height as `--desk-top` on the root
 * (a CSSOM property, which the page's CSP allows; the stylesheet's fallback is 7rem), again whenever the header's own
 * box changes (a `ResizeObserver`: the place bar opened). Below 1024 px it writes nothing and observes nothing, and
 * takes the property away when the window narrows.
 *
 * It stores nothing and asks nothing. The fragment of a road page is swapped whole by the place island (`vf:main`):
 * the listeners sit on the `.desk` element, which is not swapped, and the collapse and the observer are run again. A
 * section the reader opened stays open across such a run when it carries an id of its own (it is remembered by that
 * id for the page's life); a section without one is a new element to the script and folds again.
 */
import { INLINE_SCRIPTS } from "./inline-scripts.js";
import { PAGE_HEAD_COPY } from "@viafrei/design";
import type { Lang } from "../site/pages.js";
import { PLACE_CARD_IDS } from "./topic-filter.js";

/** Where the dashboard begins: the stylesheet's `@media (min-width: 1024px)`. */
export const DESK_FROM_PX = 1024;


export type DeskConfig = {
  /** The sections that stand collapsed on a desktop; "" folds none. */
  readonly fold: string;
  /** The lists that show only their first rows on a desktop: a selector and how many rows it keeps. */
  readonly cap: readonly (readonly [string, number])[];
  /** The map whose marks link to the rows. */
  readonly map: string;
  /** "alle {n} anzeigen" in the page's language. */
  readonly more: string;
  /**
   * Blocks the desktop shows in another column: each `[block, into]` is appended to `into` from 1024 px and put back in
   * its place below (a comment holds it), so the phone's order is the HTML's. The home's heat strip, the ask box under a
   * map. A selector matching nothing moves nothing.
   */
  readonly move?: readonly (readonly [string, string])[];
};

/** The "Frag deine KI" box (`components/AskBox.astro`), under the sticky map of a dashboard page. */
const ASK_INTO = (map: string): readonly [string, string] => ["#desk-ask", map];

/**
 * A road page's: every card but the closures, the jams, the DWD warnings and the fuel; the rules; the questions; the route's junctions,
 * the assistant's examples and the Ampel's reasons cut to their first rows. What stays in view of a folded section is
 * the stylesheet's (`[data-desk="folded"] > :not(…)`: its head, its sources line, its button).
 */
export function roadDesk(lang: Lang): DeskConfig {
  return {
    fold: "#mw-cards > .mwk:not(#mwk-closures):not(#mwk-jams):not(#mwk-weather):not(#mwk-fuel), .mwk-ref > .mwk:not(#mwk-fuel), #mw-rules, .motorway-faq",
    cap: [
      ["ol.motorway__junctions", 4],
      ["ul.motorway__examples", 1],
      // the Ampel's reasons are a summary: every closure and jam they name stands open in its card right below
      ["ol.ampel__why", 2],
    ],
    map: ".motorway__map",
    more: PAGE_HEAD_COPY[lang].showAll,
    move: [ASK_INTO(".motorway__map")],
  };
}

/**
 * A place's cards a desktop folds: what the phone folds (#1176, `CARDS_OPEN`), less what must be seen beside the map —
 * the city's roads (their closures and jams, #1173), the DWD warnings and the fuel (FS-2026-11-06 FS5: fuel never folds).
 * The motorways and the departures fold as on a phone: a motorway event near the place stands on the map and among the
 * Ampel's reasons, and a mark activated opens the card that holds its row.
 */
const PLACE_FOLDED = ["stations", "motorways", "parking", "lorry", "charging", "groceries", "health", "money", "food", "lodging", "garage", "police", "toilets", "neighbours", "speed"] as const;

/**
 * A place page's: the folded cards stand as their head and their own fold's summary (its FS3 sources line); the roads,
 * the DWD warnings and the fuel stand open. From 601 px the stylesheet opens each card's own fold (#1176), so on a
 * desktop the script closes it again (`data-desk="native"`), and the summary is the one fold a reader opens. Its map is the place's Ampel
 * card, sticky in the right column (`site.css`), its marks paired with their rows like a road's, its reasons cut to two.
 */
export function placeDesk(lang: Lang): DeskConfig {
  return {
    fold: PLACE_FOLDED.map((id) => `.place__cards > #pcard-${id}`).join(", "),
    // the Ampel's reasons, as on a road: its first two, so its map stays inside the first window; each one is a link to
    // its row, and the map's marks open the card that holds it
    cap: [["#place-ampel ol.ampel__why", 2]],
    map: "#place-ampel",
    more: PAGE_HEAD_COPY[lang].showAll,
    move: [ASK_INTO("#place-ampel")],
  };
}

/**
 * A station page's (#1175 on a phone: the station's own block first and open, every card of its area folded): the same
 * on a desktop — the board and the station's live cards stand in the left column, its platforms and facilities as their
 * head, their sources and one button; the area under them, the full width, its cards closed on their own fold (their
 * summary carries the FS3 line) except the fuel (FS-2026-11-06 FS5), its Ampel's reasons cut to two and its map behind
 * its line as on a phone. The map is the nearby-stops card, sticky in the right column beside the station: its marks are
 * the stops' links (#1043), paired with the rows.
 */
export function stationDesk(lang: Lang): DeskConfig {
  return {
    // the station's static facts (its platforms, its facilities) stand as their head, their sources and one button
    fold: ["#pcard-station-platforms", "#station-facilities", ...PLACE_CARD_IDS.filter((id) => id !== "fuel").map((id) => `.place__cards > #pcard-${id}`)].join(", "),
    cap: [["#place-ampel ol.ampel__why", 2]],
    map: "#pcard-station-nearby",
    more: PAGE_HEAD_COPY[lang].showAll,
    move: [ASK_INTO("#pcard-station-nearby")],
  };
}

/**
 * The home's (#1180): three columns — the hero's head and the visitor's place on the left, the heat strip in the middle,
 * the connect block ("Loslegen", the box that says how to ask your AI) sticky on the right — then "Deutschland jetzt"
 * and the questions, the news, the tools, the audience and the sources under the two. The heat strip is the motorways
 * and the stations most affected now (`HOME_WORST_DESK` + `STATION_TOP_DESK`, ten each), moved out of their groups into
 * the middle column, open. Every other national panel, every folded moment, the tools and the
 * audience are closed on their own fold, whose summary names the publishers inside (FS3); the place's cards fold as on a
 * place page; the fuel never folds (FS5) and is in neither selector. The map is the place's Ampel when there is one.
 */
export function homeDesk(lang: Lang): DeskConfig {
  return {
    fold: [
      ...PLACE_FOLDED.map((id) => `.place__cards > #pcard-${id}`),
      "#now .now__cell:has(> details.fold)",
      "#now .now__cell > section:has(> details.fold)",
      "#day .moment__lead:has(> details.fold)",
      "#day .moment__main:has(> details.fold)",
      "#tools > .wrap",
      "#audience > .wrap",
      // the register of every source, as on a phone: each fold's summary names the publishers inside it (FS3)
      "#sources .sources__grid",
      "#sources .sources__grid > div:has(> details.fold)",
    ].join(", "),
    // the day's first two moments, each with its live answer and its credit; the others wait behind "alle 9 anzeigen",
    // each whole — its question, its answer and its credit line together (FS-2026-11-06: a credit folds only WITH its data)
    cap: [
      ["#place-ampel ol.ampel__why", 2],
      ["#day .moments", 2],
    ],
    map: "#place-ampel",
    more: PAGE_HEAD_COPY[lang].showAll,
    move: [
      ["#now-roads > .now__widefold", "#desk-heat"],
      ["#now-rail > .now__widefold", "#desk-heat"],
    ],
  };
}

/**
 * The connect page's (#1180): the address sticky in the right column (`.desk__side`), the guides and the examples in the
 * left. The folds a phone closes (#1179: the further examples, the further live answers, the register of every source)
 * are closed on a desktop too, each on its own fold, whose summary names the publishers inside (FS3); the guides and
 * the first questions stand open, and the first three live answers (each whole, its credit with it). No map: nothing on
 * it is paired.
 */
export function connectDesk(lang: Lang): DeskConfig {
  return {
    fold: ["#answers > .wrap", "#sources > .wrap", "#asks > .wrap"].join(", "),
    // the live answers a phone shows open: their first three, each whole with its credit line; "alle N anzeigen" the rest
    cap: [["#answers .cards", 3]],
    map: "#endpoint",
    more: PAGE_HEAD_COPY[lang].showAll,
  };
}

export const DESK_JS = `function (C) {
  var root = document.querySelector(".desk");
  if (!root || !window.matchMedia) return;
  var mq = matchMedia("(min-width: ${String(DESK_FROM_PX)}px)");
  var hit = null, io = null, ro = null;
  // a generated section id is unique for the page's life, not per run: a run after a swap (\`vf:main\`, \`vf:loaded\`,
  // \`vf:swapped\`) adds sections beside the ones already folded, and two \`desk-s0\` would pair a button with another's section
  var seq = 0;
  // the sections the reader opened, by their authored id: an in-place refresh brings a new element for the same card,
  // which stands open again instead of folding under the reader (a section with no id of its own is folded again)
  var opened = {};
  function count(s) {
    if (s.getAttribute("data-desk") === "capped") return String(s.children.length);
    var n = s.querySelector("data.mwk__n");
    if (n && n.getAttribute("value")) return n.getAttribute("value");
    var lis = s.matches("ol, ul") ? s.children.length : s.querySelectorAll("li, tbody > tr").length;
    return String(lis);
  }
  function button(s) {
    if (!s.id) {
      s.id = "desk-s" + seq++;
      s.setAttribute("data-desk-id", "");
    }
    var b = document.createElement("button");
    b.type = "button";
    b.className = "btn desk__more";
    b.setAttribute("aria-expanded", "false");
    b.setAttribute("aria-controls", s.id);
    b.textContent = C.more.replace("{n}", count(s));
    b.addEventListener("click", function () { open(s, true, b); });
    return b;
  }
  function collapse() {
    if (C.fold) root.querySelectorAll(C.fold).forEach(function (s) {
      if (s.hasAttribute("data-desk")) return;
      // a card with its own fold (#1176, FS-2026-11-06) is closed by it: its summary names every publisher inside (FS3)
      var own = s.querySelectorAll(":scope > details.fold");
      if (own.length) {
        s.setAttribute("data-desk", "native");
        if (wasOpen(s)) open(s, false);
        else own.forEach(function (d) { d.open = false; });
        return;
      }
      var head = s.querySelector(":scope > .pcard__head, :scope > h2, :scope > h3");
      s.setAttribute("data-desk", "folded");
      var b = button(s);
      if (head) head.after(b); else s.prepend(b);
      if (wasOpen(s)) open(s, false, b);
    });
    C.cap.forEach(function (c) {
      root.querySelectorAll(c[0]).forEach(function (l) {
        if (l.hasAttribute("data-desk") || l.children.length <= c[1]) return;
        l.setAttribute("data-desk", "capped");
        for (var k = c[1]; k < l.children.length; k++) l.children[k].classList.add("desk__cut");
        var b = button(l);
        l.after(b);
        if (wasOpen(l)) open(l, false, b);
      });
    });
  }
  function key(s) { return s.id && !s.hasAttribute("data-desk-id") ? s.id : ""; }
  function wasOpen(s) { var k = key(s); return k !== "" && opened[k] === true; }
  function open(s, focus, b) {
    if (!s.hasAttribute("data-desk")) return;
    if (key(s)) opened[key(s)] = true;
    if (s.getAttribute("data-desk") === "native") s.querySelectorAll(":scope > details.fold").forEach(function (d) { d.open = true; });
    s.setAttribute("data-desk", "open");
    s.querySelectorAll(":scope > .desk__cut").forEach(function (r) { r.classList.remove("desk__cut"); });
    if (!b) b = root.querySelector('.desk__more[aria-controls="' + s.id + '"]');
    if (b) {
      b.setAttribute("aria-expanded", "true");
      b.hidden = true;
    }
    if (focus) {
      var h = s.querySelector("h2, h3") || s;
      if (!h.hasAttribute("tabindex")) h.setAttribute("tabindex", "-1");
      h.focus({ preventScroll: true });
    }
  }
  var held = [];
  function place() {
    // a block moved into a fragment that was swapped since (a road page's map, \`vf:main\`) is held here: it goes into the new one
    held.forEach(function (h) {
      var into = h[0].isConnected ? null : document.querySelector(h[2]);
      if (into) into.append(h[0]);
    });
    (C.move || []).forEach(function (m) {
      var b = document.querySelector(m[0]), into = document.querySelector(m[1]);
      if (!b || !into || into.contains(b)) return;
      var mark = document.createComment("desk");
      b.before(mark);
      held.push([b, mark, m[1]]);
      into.append(b);
    });
  }
  function back() {
    held.forEach(function (h) { if (h[1].parentNode) h[1].replaceWith(h[0]); });
    held = [];
  }
  function whole() {
    back();
    root.querySelectorAll("[data-desk]").forEach(function (s) { s.removeAttribute("data-desk"); });
    root.querySelectorAll(".desk__cut").forEach(function (r) { r.classList.remove("desk__cut"); });
    root.querySelectorAll(".desk__more").forEach(function (b) { b.remove(); });
    root.querySelectorAll("[data-desk-id]").forEach(function (s) { s.removeAttribute("id"); s.removeAttribute("data-desk-id"); });
    if (ro) ro.disconnect();
    ro = null;
    window.removeEventListener("resize", top);
    document.documentElement.style.removeProperty("--desk-top");
  }
  function map() { return root.querySelector(C.map); }
  // a mark is a link in the map's drawing: to its row ("#id", #1043), or to the page a row of the list also links to
  // (a station's stops, each to its own view) - then the row is the row of the map's own card holding that same link
  function drawn() {
    var m = map();
    return m ? Array.prototype.slice.call(m.querySelectorAll("svg a[href]")) : [];
  }
  function own(row) {
    return Array.prototype.filter.call(row.querySelectorAll("a[href]"), function (x) { return !x.closest("svg"); }).map(function (x) { return x.getAttribute("href"); });
  }
  function marks(id) {
    var row = id ? document.getElementById(id) : null;
    if (!row) return [];
    // a row's own links pair only inside the map's card (a station's stop list beside its drawing)
    var m = map();
    var hs = m && m.contains(row) ? own(row) : [];
    hs.push("#" + id);
    return drawn().filter(function (a) { return hs.indexOf(a.getAttribute("href")) >= 0; });
  }
  function rowOf(a) {
    var h = a.getAttribute("href") || "";
    if (h.charAt(0) === "#") return document.getElementById(h.slice(1));
    var rows = map().querySelectorAll("li[id], tr[id]");
    for (var k = 0; k < rows.length; k++) if (own(rows[k]).indexOf(h) >= 0) return rows[k];
    return null;
  }
  function markOf(t) {
    var a = t.closest("svg a[href]");
    var m = map();
    return a && m && m.contains(a) ? a : null;
  }
  function light(on) {
    root.querySelectorAll(".is-hot").forEach(function (e) { e.classList.remove("is-hot"); });
    if (on) on.forEach(function (e) { e.classList.add("is-hot"); });
  }
  function point(t) {
    if (!mq.matches || !t || !t.closest) return;
    var a = markOf(t);
    if (a) {
      var r = rowOf(a);
      light(r ? [a, r] : [a]);
      return;
    }
    // the row: the nearest element with an id a mark of the map names (a list row, a place's entry, a stop)
    for (var row = t; row && row !== root; row = row.parentElement) {
      if (!row.id) continue;
      var ms = marks(row.id);
      if (ms.length) {
        light([row].concat(ms));
        return;
      }
    }
    light(null);
  }
  function reveal(row) {
    var f = row.closest("[data-desk]");
    if (f && f.getAttribute("data-desk") !== "open") open(f, false);
    for (var d = row.closest("details"); d; d = d.parentElement ? d.parentElement.closest("details") : null) d.open = true;
    if (hit) hit.classList.remove("is-hit");
    hit = row;
    row.classList.add("is-hit");
  }
  function observe() {
    if (io) io.disconnect();
    if (!window.IntersectionObserver || !mq.matches) return;
    io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        e.target.querySelectorAll("[id]").forEach(function (r) {
          marks(r.id).forEach(function (a) { a.classList.toggle("is-near", e.isIntersecting); });
        });
      });
    }, { rootMargin: "-45% 0px -45% 0px" });
    root.querySelectorAll(".pcard, ol.motorway__junctions").forEach(function (s) { if (s.querySelector("[id]")) io.observe(s); });
  }
  function fromHash() {
    var id = location.hash.slice(1);
    var row = id ? document.getElementById(id) : null;
    if (row && root.contains(row) && row.closest("[data-desk]")) {
      // #1197: the browser has already scrolled to a row it could show, and a second scroll here (centring it) moved
      // the page back. Only a row the collapse kept out of view is scrolled to, once shown, as the browser would have
      var shown = row.checkVisibility ? row.checkVisibility() : row.getClientRects().length > 0;
      reveal(row);
      if (!shown) row.scrollIntoView({ block: "start" });
    }
  }
  function top() {
    var h = document.querySelector(".site-head");
    if (h) document.documentElement.style.setProperty("--desk-top", Math.ceil(h.getBoundingClientRect().height) + "px");
  }
  // the sticky header changes height without a resize (the place bar opened, a line wrapping): the map and the connect
  // column read its height again whenever it does, so they never slide under it
  function follow() {
    var h = document.querySelector(".site-head");
    if (ro || !h) return;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(top);
      ro.observe(h);
    } else window.addEventListener("resize", top, { passive: true });
  }
  function run() {
    if (mq.matches) {
      top();
      follow();
      place();
      collapse();
      fromHash();
    } else whole();
    observe();
  }
  root.addEventListener("pointerover", function (e) { point(e.target); });
  root.addEventListener("focusin", function (e) { point(e.target); });
  root.addEventListener("pointerleave", function () { light(null); });
  root.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? markOf(e.target) : null;
    var row = a && rowOf(a);
    if (row && mq.matches) reveal(row);
  });
  window.addEventListener("hashchange", function () { if (mq.matches) fromHash(); });
  if (mq.addEventListener) mq.addEventListener("change", run);
  // a swap of the page's main fragment (a road page) or of the place's cards (the island, the home) is collapsed again
  ["vf:main", "vf:loaded", "vf:swapped"].forEach(function (n) { document.addEventListener(n, run); });
  run();
}`;

/** The text a desk page carries: the minified function called with the page's configuration. */
export function deskScript(c: DeskConfig): string {
  return `(${INLINE_SCRIPTS.desk})(${JSON.stringify(c).replace(/</g, "\\u003c")});`;
}
