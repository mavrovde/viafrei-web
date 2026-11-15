/**
 * The motorway Ampel at the top of the page (#895). The digest renders it:
 * the whole motorway's (or the address's stretch and direction's) as the first
 * element of the page fragment, and a position's as the first element of the
 * around block. The shell only MOVES it above the position bar — it reads no
 * database (A2) and judges nothing.
 *
 *   - `liftAmpel` takes the page's Ampel out of the fragment;
 *   - `liftAroundAmpel` takes the position's Ampel out of the around block the
 *     first HTML holds (the IP rung), so the top shows it instead;
 *   - `ampelSwapScript` does the same in the browser whenever the island loads
 *     a new around block (`vf:loaded`): the position's Ampel moves to the top,
 *     and the page's comes back when the block carries none.
 *
 * The Ampel's HTML is the digest's: no script, no data-*, only in-page anchors;
 * the script here moves nodes and sends nothing (G5.5).
 */

const PAGE_AMPEL = /^<section class="pcard pcard--(?:attention|info|clear) ampel ampel--(?:red|yellow|green)" id="motorway-ampel" [\s\S]*?<\/section>/;
const AROUND_AMPEL = /<section class="pcard pcard--(?:attention|info|clear) ampel ampel--(?:red|yellow|green)" id="motorway-ampel-around" [\s\S]*?<\/section>/;

/** The page fragment (after `motorwayHeadOf`) without its Ampel, and the Ampel; the fragment unchanged when it carries none. */
export function liftAmpel(html: string): { readonly html: string; readonly ampel: string | null } {
  const root = /^<section class="motorway" id="motorway"[^>]*>/.exec(html);
  if (root === null) return { html, ampel: null };
  const rest = html.slice(root[0].length);
  const m = PAGE_AMPEL.exec(rest);
  if (m === null) return { html, ampel: null };
  return { html: root[0] + rest.slice(m[0].length), ampel: m[0] };
}

/** The around block without its Ampel, and the Ampel; unchanged when it carries none. */
export function liftAroundAmpel(html: string): { readonly html: string; readonly ampel: string | null } {
  const m = AROUND_AMPEL.exec(html);
  if (m === null) return { html, ampel: null };
  return { html: html.replace(m[0], ""), ampel: m[0] };
}

/**
 * The browser half: after every around load, the position's Ampel (if the block
 * carries one) replaces the top's; otherwise the radius's (the main block the
 * around answer swapped in carries it), otherwise the whole road's from its
 * template. The whole road's template is the server's and is never written: a
 * radius Ampel is kept apart, so "all of Germany" (`vf:cleared`, and the plain
 * main block coming back on `vf:main`) shows the whole road's lamp again and
 * never a stale one. No request, no storage, no event sent.
 */
export function ampelSwapScript(): string {
  return `(function () {
  var top = document.getElementById("ampel-slot");
  var whole = document.getElementById("ampel-whole");
  if (!top || !whole) return;
  var radius = null;
  // The around block the top's position Ampel came from: the top keeps it while that block is the slot's.
  function block() {
    var slot = document.getElementById("place-slot");
    return slot ? slot.firstElementChild : null;
  }
  var from = top.querySelector("#motorway-ampel-around") ? block() : null;
  function sync() {
    var b = block();
    var a = b ? b.querySelector("#motorway-ampel-around") : null;
    if (a) { from = b; top.replaceChildren(a); return; }
    if (from && b === from) return;
    from = null;
    if (radius) { top.replaceChildren(radius.cloneNode(true)); return; }
    top.replaceChildren(whole.content.cloneNode(true));
  }
  // #890 (2.3.8) + #895: the main block swapped for the radius brings the Ampel of the radius's stretch; it leaves the
  // block and is held apart from the whole road's (whose template stays the server's). A plain main block (the page's
  // own, restored by "all of Germany") carries none, so the radius Ampel is dropped with it.
  // At load (no event) the top is the server's choice and stays; on a swap (vf:main) the top is judged again.
  function liftMain(e) {
    var main = document.getElementById("motorway-main");
    var a = main ? main.querySelector("#motorway-ampel") : null;
    if (a) a.remove();
    radius = a;
    if (e) sync();
    else if (a && !top.querySelector("#motorway-ampel-around")) top.replaceChildren(a.cloneNode(true));
  }
  document.addEventListener("vf:loaded", function (e) { if (e.detail && e.detail.ok) sync(); });
  document.addEventListener("vf:main", liftMain);
  document.addEventListener("vf:cleared", function () { radius = null; sync(); });
  liftMain();
  // #1113: a kept "Ganz Deutschland" emptied the slot before this ran — the top is the whole road's, never the IP guess's.
  if (!from && top.querySelector("#motorway-ampel-around")) sync();
})();`;
}
