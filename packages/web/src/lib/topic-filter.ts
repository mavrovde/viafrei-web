/**
 * The topic filter of the place cards (#1050, owner 2026-10-25: "the main page should have the same behavior
 * regarding filter buttons like autobahns pages have") on the home and the place pages — the pattern of the motorway
 * pages' layer filter (#983, `packages/digest/src/presentation/motorway-layers-html.ts`) and of their type bar
 * (`motorway-filter.ts`): one box per card, "Alle" and "Keine" named in full for a screen reader, a GET form whose
 * choice lives in the address (`?topics=roads,fuel`, shareable, working without JavaScript), and a sent form with no
 * box ticked says so in one sentence with its way back — never an empty page. It replaced "Mein Tag" (#798): two
 * filters over the same cards are the chaos #990 removes.
 *
 * The topics are the digest's card ids (`PLACE_CARD_IDS`, `packages/digest/src/analysis/place.ts`, pinned equal by
 * `test/topic-filter-1050.test.ts` because this package imports no database package), and each box is labelled with
 * the card's OWN heading as the fragment printed it — the card copy of the digest in the page's language, never a
 * second list of names.
 *
 * Danger is never hidden silently: a card the digest marks for attention now (`pcard--attention`: a warning in force,
 * a closure in the first ring) that the choice hides stays named in a chip under the bar, which shows it.
 */
import { t } from "../i18n/index.js";
import type { Lang } from "../site/pages.js";
import { filterCopy } from "./motorway-filter.js";
import { INLINE_SCRIPTS } from "./inline-scripts.js";
import { allNone, esc as escHtml } from "@viafrei/design";

export const PLACE_CARD_IDS = ["stations", "fuel", "parking", "roads", "motorways", "lorry", "charging", "warnings", "groceries", "health", "money", "food", "lodging", "garage", "police", "toilets", "neighbours", "lifts", "speed"] as const;
export type PlaceCardId = (typeof PLACE_CARD_IDS)[number];

/**
 * #1117: a retired topic and the cards that replaced it. "In der Nähe" (`pois`) became the everyday-need cards, so an
 * address or a stored choice naming it keeps its meaning — all of them on with it, all off without it — and nothing is
 * rewritten on load: the stored value is read through this map until the visitor saves a new choice. Owner
 * 2026-11-02: the one "Polizei & WC" card became two, `police` and `toilets`, so a choice saved with the old card's id
 * still opens both — the only place that id is still read, and only as a key of this map.
 */
export const RETIRED_TOPICS: Readonly<Record<string, readonly PlaceCardId[]>> = {
  pois: ["groceries", "health", "money", "food", "lodging", "garage", "police", "toilets"],
  safety: ["police", "toilets"],
};

/** The ids a choice names, each retired topic replaced by the cards that replaced it. */
const expandRetired = (raw: readonly string[]): string[] => raw.flatMap((s): readonly string[] => RETIRED_TOPICS[s.trim()] ?? [s.trim()]);

/** The one localStorage key the filter writes — the chosen ids, comma-joined — and only after a click on "merken". */
export const TOPICS_STORE = "viafrei.topics";
/** "Mein Tag"'s key (#798), retired by #1050: deleted when found, never written again. */
export const RETIRED_BOARD_KEY = "viafrei.board";

const isId = (s: string): s is PlaceCardId => (PLACE_CARD_IDS as readonly string[]).includes(s);

/**
 * The choice an address names: null = every topic (no `topics` and no sent form); otherwise the known ids in
 * `PLACE_CARD_IDS` order — a sent form (`f=1`) with none ticked is the empty list. `topics` may be one comma list (the
 * script's form) or repeated (the no-script form's); unknown ids are dropped.
 */
export function topicsOf(params: URLSearchParams): readonly PlaceCardId[] | null {
  const raw = params.getAll("topics").flatMap((v) => v.split(","));
  if (raw.length === 0 && !params.has("f")) return null;
  const set = new Set(expandRetired(raw).filter(isId));
  if (raw.length > 0 && set.size === 0 && !params.has("f")) return null;
  return PLACE_CARD_IDS.filter((id) => set.has(id));
}

/** Whether an address is a filtered view — `noindex`, its canonical the unfiltered page (#1050 SEO). */
export function isFilteredView(params: URLSearchParams): boolean {
  return params.has("topics") || params.has("f");
}

/** The query of a choice: "" for every topic, `?f=1` for none, else `?topics=a,b`. */
export function topicsQuery(chosen: readonly PlaceCardId[] | null): string {
  if (chosen === null || chosen.length === PLACE_CARD_IDS.length) return "";
  return chosen.length === 0 ? "?f=1" : `?topics=${chosen.join(",")}`;
}

/** One card of a fragment: its id, its heading as printed, and whether it needs attention now. */
export type TopicCard = { readonly id: PlaceCardId; readonly title: string; readonly attention: boolean };

const unescape = (s: string): string => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** The cards of a place fragment, in its order, each with its own heading (the icon left out). */
export function topicCardsOf(html: string): readonly TopicCard[] {
  const out: TopicCard[] = [];
  for (const m of html.matchAll(/<article class="pcard([^"]*)" id="pcard-([a-z]+)"[^>]*>([\s\S]*?)<\/article>/g)) {
    const id = m[2] ?? "";
    if (!isId(id) || out.some((c) => c.id === id)) continue;
    const h = /<h3 class="pcard__title"[^>]*>([\s\S]*?)<\/h3>/.exec(m[3] ?? "");
    const title = unescape((h?.[1] ?? "").replace(/<span class="pcard__icon"[^>]*>[\s\S]*?<\/span>/g, "").replace(/<[^>]+>/g, "")).trim();
    out.push({ id, title: title === "" ? id : title, attention: / pcard--attention\b/.test(m[1] ?? "") });
  }
  return out;
}

/** The fragment with every card the choice leaves out marked `hidden` (the no-script render; the script does the same). */
export function applyTopics(html: string, chosen: readonly PlaceCardId[] | null): string {
  if (chosen === null) return html;
  const keep = new Set<string>(chosen);
  return html.replace(/<article class="pcard([^"]*)" id="pcard-([a-z]+)"/g, (all, _cls: string, id: string) => (keep.has(id) ? all : `${all} hidden`));
}

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The copy of the bar: #983's words for "Alle", "Keine", "merken" (`filterCopy`), the topics' own for the rest. */
export function topicCopy(lang: Lang): Readonly<Record<"legend" | "apply" | "all" | "none" | "allLabel" | "noneLabel" | "save" | "saved" | "forget" | "nothing" | "shown" | "attention" | "ampel", string>> {
  const f = filterCopy(lang);
  return {
    legend: t(lang, "place.topics.legend"),
    apply: t(lang, "place.topics.apply"),
    all: f.all,
    none: f.none,
    allLabel: f.allLabel,
    noneLabel: f.noneLabel,
    save: f.save,
    saved: f.saved,
    forget: f.forget,
    nothing: t(lang, "place.topics.none"),
    shown: t(lang, "place.topics.shown", { n: "{n}", total: "{total}" }),
    attention: t(lang, "place.topics.attention", { topic: "{topic}" }),
    // 2.4.8 (#1085 AC 1): the motorway page's D8 sentence — one switch, one wording (#1088)
    ampel: f.ampel,
  };
}

/** "3 von 9 Themen angezeigt". */
export function shownText(lang: Lang, n: number, total: number): string {
  return topicCopy(lang).shown.replace("{n}", String(n)).replace("{total}", String(total));
}

/**
 * The bar, for the cards of `cards` and the choice `chosen` (null: all). `path` is the page's own address: "Alle" is
 * the bare address, "Keine" the sent form with none ticked, each attention chip the choice plus its topic. The form
 * is a plain GET form; the script (`TOPICS_JS`) makes ticking apply at once and keeps the address in step.
 */
export function topicBarHtml(lang: Lang, cards: readonly TopicCard[], chosen: readonly PlaceCardId[] | null, path: string): string {
  const c = topicCopy(lang);
  const on = new Set<string>(chosen ?? PLACE_CARD_IDS);
  const boxes = cards
    .map((x) => `<label class="chip tpf__opt"><input type="checkbox" name="topics" value="${x.id}"${on.has(x.id) ? " checked" : ""}> <span class="tpf__name">${esc(x.title)}</span></label>`)
    .join("");
  const hidden = cards.filter((x) => x.attention && !on.has(x.id));
  // #1158: "Alle · Keine" is the one shared control (`@viafrei/design` `allNone`), its links the no-script targets
  const allOpt = { text: escHtml(c.all), label: escHtml(c.allLabel), hook: "tpf__all", href: path } as const;
  const alerts = hidden
    .map((x) => `<a class="chip tpf__alert" href="${esc(`${path}${topicsQuery([...(chosen ?? []), x.id].filter((v, i, a) => a.indexOf(v) === i))}`)}" data-topic="${x.id}">${esc(c.attention.replace("{topic}", x.title))}</a>`)
    .join(" ");
  return (
    `<form class="tpf" id="tpf" method="get" action="${esc(path)}"${cards.length === 0 ? " hidden" : ""}>` +
    `<fieldset class="tpf__set"><legend class="tpf__legend" id="tpf-l">${esc(c.legend)}</legend>` +
    `<div class="tpf__opts">${boxes}</div>` +
    `<input type="hidden" name="f" value="1">` +
    `<p class="tpf__acts">${allNone({ all: allOpt, none: { text: escHtml(c.none), label: escHtml(c.noneLabel), hook: "tpf__none", href: `${path}?f=1` } })} ` +
    `<noscript><button type="submit" class="btn btn--sm tpf__apply">${esc(c.apply)}</button></noscript> <button type="button" class="btn btn--sm tpf__save" hidden>${esc(c.save)}</button> ` +
    `<span class="motorway__note tpf__kept" hidden>${esc(c.saved)} <button type="button" class="placebar__forget tpf__forget">${esc(c.forget)}</button></span></p>` +
    `</fieldset>` +
    `<p class="tpf__alerts" id="tpf-alerts"${hidden.length === 0 ? " hidden" : ""}>${alerts}</p>` +
    `<p class="tpf__nothing" id="tpf-nothing"${chosen !== null && chosen.length === 0 && cards.length > 0 ? "" : " hidden"}>${esc(c.nothing)} ${allNone({ all: allOpt })}</p>` +
    // 2.4.8 (#1085 AC 1, the motorway page's D8): shown by the stylesheet alone (`.tpf__ampel`, site.css) while a card
    // the place Ampel took a reason from is hidden — with or without a script, since both hide a card by `hidden`
    `<p class="motorway__note tpf__ampel" id="tpf-ampel">${esc(c.ampel)}</p>` +
    `</form>`
  );
}

/**
 * #1194 (owner 2026-11-06, "topics after the first item"): on the home the fragment opens with what comes first
 * (`#page-first`: the place's lamp, its count line and its first live item), and the topic filter stands right AFTER
 * it, so the status and the first item are the first screen and the wrapped topics come under them. The first item is
 * no card, so the filter never hid it. Returns the fragment with the bar after `#page-first`, or null when the fragment
 * carries none (a place page and a station page print it in their head; the placeholder; a place outside) — the bar
 * then stands before the slot as before. `TOPICS_JS` keeps the same place when the island swaps the cards.
 */
export function barAfterFirst(html: string, bar: string): string | null {
  // the fragment's own end mark of the block (`PAGE_FIRST_CLOSE`, the digest; read the same way by `place-head.ts`)
  const m = /<div class="pagefirst" id="page-first">[\s\S]*?<\/div><!--\/page-first-->/u.exec(html);
  if (m === null) return null;
  const end = m.index + m[0].length;
  return html.slice(0, end) + bar + html.slice(end);
}

/**
 * The count a screen reader hears after a change ("3 von 9 Themen angezeigt"), printed right AFTER the cards' slot —
 * the slot's stable end mark for `the public smoke`, which folds the slot up to it.
 */
export function topicSumHtml(lang: Lang, cards: readonly TopicCard[], chosen: readonly PlaceCardId[] | null): string {
  const on = new Set<string>(chosen ?? PLACE_CARD_IDS);
  const shown = cards.filter((x) => on.has(x.id)).length;
  return `<p class="tpf__sum visually-hidden" id="tpf-sum" aria-live="polite">${cards.length === 0 ? "" : esc(shownText(lang, shown, cards.length))}</p>`;
}

/**
 * The script: with it, ticking, "Alle" and "Keine" apply at once, the address follows with `pushState` (so the back
 * button restores the choice before) and `popstate` applies it again; "merken" writes `TOPICS_STORE` and nothing is
 * written before that click; the bar is rebuilt from the cards whenever the island swaps them. The copy it needs
 * arrives as `C` (`topicsScript`).
 */
export const TOPICS_JS = `function (C) {
  var d = document, form = d.getElementById("tpf"), slot = d.getElementById(C.slot);
  if (!form || !slot) return;
  try { if (window.localStorage.getItem(C.retired) !== null) window.localStorage.removeItem(C.retired); } catch (e) { /* storage blocked */ }
  var ids = C.ids;
  var retired = C.retiredTopics || {};
  var known = function (a) { var out = []; a.forEach(function (x) { (retired[x] || [x]).forEach(function (y) { out.push(y); }); }); return out.filter(function (x) { return ids.indexOf(x) >= 0; }); };
  var fromUrl = function () {
    try {
      var p = new URL(window.location.href).searchParams, raw = [];
      p.getAll("topics").forEach(function (v) { raw = raw.concat(v.split(",")); });
      if (raw.length === 0 && !p.has("f")) return null;
      var k = known(raw);
      if (raw.length > 0 && k.length === 0 && !p.has("f")) return null;
      return ids.filter(function (x) { return k.indexOf(x) >= 0; });
    } catch (e) { return null; }
  };
  var stored = function () { try { var s = window.localStorage.getItem(C.store); return s === null ? null : known(s === "" ? [] : s.split(",")); } catch (e) { return null; } };
  var chosen = fromUrl() || stored(), first = chosen;
  var has = function (st) { return st !== null && typeof st === "object" && "topics" in st; };
  var esc = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };
  var cards = function () {
    return Array.prototype.slice.call(slot.querySelectorAll("article.pcard[id^='pcard-']")).map(function (a) {
      var h = a.querySelector(".pcard__title"), t = "";
      if (h) { var c = h.cloneNode(true), i = c.querySelector(".pcard__icon"); if (i) i.remove(); t = c.textContent.trim(); }
      return { el: a, id: a.id.slice(6), title: t || a.id.slice(6), attention: a.classList.contains("pcard--attention") };
    }).filter(function (x) { return ids.indexOf(x.id) >= 0; });
  };
  var q = function (a) { return a === null || a.length === ids.length ? "" : a.length === 0 ? "?f=1" : "?topics=" + a.join(","); };
  // #1194: after the fragment's first block when it carries one (the home), else before the slot
  var at = function () { var f = slot.querySelector("#page-first"); if (f) { if (f.nextElementSibling !== form) f.after(form); } else if (!form.isConnected) slot.before(form); };
  var opts = form.querySelector(".tpf__opts"), alerts = d.getElementById("tpf-alerts"), nothing = d.getElementById("tpf-nothing"), sum = d.getElementById("tpf-sum"), kept = form.querySelector(".tpf__kept");
  var boxes = function () { return Array.prototype.slice.call(form.querySelectorAll("input[name=topics]")); };
  var build = function (cs) {
    var have = boxes().map(function (b) { return b.value; }).join(",");
    if (have === cs.map(function (c) { return c.id; }).join(",")) return;
    opts.innerHTML = cs.map(function (c) { return '<label class="chip tpf__opt"><input type="checkbox" name="topics" value="' + c.id + '"> <span class="tpf__name">' + esc(c.title) + "</span></label>"; }).join("");
  };
  var picked = function () { var on = boxes().filter(function (b) { return b.checked; }).map(function (b) { return b.value; }); return ids.filter(function (x) { return on.indexOf(x) >= 0; }); };
  var apply = function () {
    at();
    var cs = cards();
    build(cs);
    form.hidden = cs.length === 0;
    var on = chosen === null ? ids : chosen;
    boxes().forEach(function (b) { b.checked = on.indexOf(b.value) >= 0; });
    var shown = 0, warn = [];
    cs.forEach(function (c) {
      var show = on.indexOf(c.id) >= 0;
      c.el.hidden = !show;
      if (show) shown++; else if (c.attention) warn.push(c);
    });
    if (alerts) {
      // built as nodes, never as markup text: an address written into this script's text would read as a link to a crawler
      alerts.textContent = "";
      warn.forEach(function (c, i) {
        if (i > 0) alerts.appendChild(d.createTextNode(" "));
        var a = d.createElement("a");
        a.className = "chip tpf__alert";
        a.setAttribute("href", window.location.pathname + q(ids.filter(function (x) { return on.indexOf(x) >= 0 || x === c.id; })));
        a.setAttribute("data-topic", c.id);
        a.textContent = C.attention.replace("{topic}", c.title);
        alerts.appendChild(a);
      });
      alerts.hidden = warn.length === 0;
    }
    if (nothing) nothing.hidden = !(chosen !== null && chosen.length === 0 && cs.length > 0);
    // #1194: "merken" once there is a choice to keep — every topic is what a bare address shows anyway
    if (save) save.hidden = chosen === null;
    var text = cs.length === 0 ? "" : C.shown.replace("{n}", String(shown)).replace("{total}", String(cs.length));
    if (sum && sum.textContent !== text) sum.textContent = text;
  };
  var push = function () {
    try {
      var u = new URL(window.location.href);
      u.searchParams.delete("topics"); u.searchParams.delete("f");
      var s = q(chosen);
      var next = u.pathname + (s === "" ? (u.search || "") : (u.search ? u.search + "&" + s.slice(1) : s)) + u.hash;
      if (next === window.location.pathname + window.location.search + window.location.hash) return;
      if (!has(window.history.state)) window.history.replaceState({ topics: first }, "");
      window.history.pushState({ topics: chosen }, "", next);
    } catch (e) { /* no history: the page still filters */ }
  };
  form.addEventListener("change", function (e) { if (e.target && e.target.name === "topics") { chosen = picked(); apply(); push(); } });
  form.addEventListener("submit", function (e) { e.preventDefault(); chosen = picked(); apply(); push(); });
  form.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a.tpf__all, a.tpf__none, a.tpf__alert") : null;
    if (!a) return;
    e.preventDefault();
    if (a.classList.contains("tpf__all")) chosen = null;
    else if (a.classList.contains("tpf__none")) chosen = [];
    else { var id = a.getAttribute("data-topic"); chosen = (chosen === null ? ids : chosen).concat([id]).filter(function (x, i, arr) { return arr.indexOf(x) === i; }); chosen = ids.filter(function (x) { return chosen.indexOf(x) >= 0; }); }
    apply(); push();
  });
  var save = form.querySelector(".tpf__save"), forget = form.querySelector(".tpf__forget");
  if (save) { save.addEventListener("click", function () { try { window.localStorage.setItem(C.store, (chosen === null ? ids : chosen).join(",")); if (kept) kept.hidden = false; } catch (e) { /* storage blocked */ } }); }
  if (forget) forget.addEventListener("click", function () { try { window.localStorage.removeItem(C.store); } catch (e) { /* nothing stored */ } if (kept) kept.hidden = true; });
  if (kept) kept.hidden = stored() === null;
  window.addEventListener("popstate", function (e) { chosen = has(e.state) ? e.state.topics : fromUrl() || stored(); apply(); });
  new MutationObserver(function () { apply(); }).observe(slot, { childList: true });
  apply();
}`;

/** The script (minified, #1064) with its copy, for `<script is:inline set:html>` under the page's nonce. */
/** The cards slot a topic bar filters: the page's one, unless a page holds a second block beside the visitor's (#1188). */
export const PLACE_SLOT = "place-slot";

export function topicsScript(lang: Lang, slot: string = PLACE_SLOT): string {
  const c = topicCopy(lang);
  return `(${INLINE_SCRIPTS.topics})(${JSON.stringify({ ids: PLACE_CARD_IDS, retiredTopics: RETIRED_TOPICS, store: TOPICS_STORE, retired: RETIRED_BOARD_KEY, shown: c.shown, attention: c.attention, slot })});`;
}
