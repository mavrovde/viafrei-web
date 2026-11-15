/**
 * #1174: the fixed bottom bar (`.actionbar`, a phone only) stays hidden at the top of a page, so it never covers the end
 * of the first screen. Where the browser has scroll timelines the stylesheet alone does that; where it has not, this
 * script shows the bar from the same 520 px of scroll on, by one attribute on the root (`data-actionbar`). It asks nothing
 * and stores nothing. A page that runs no script (the fuel board) simply shows no bar in such a browser, and covers nothing.
 * #1177: a person who asks for reduced motion is in the same case: `animation: none !important` takes the timeline away
 * and left the bar hidden for ever on every phone (the e2e image asks for it), so the script shows it there too.
 */
import { INLINE_SCRIPTS } from "./inline-scripts.js";

/** Where the bar appears, the stylesheet's `animation-range` start. */
export const ACTION_BAR_FROM_PX = 520;

export const ACTION_BAR_JS = `function () {
  var still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!still && window.CSS && CSS.supports && CSS.supports("animation-timeline", "scroll()")) return;
  var root = document.documentElement;
  function sync() {
    if ((window.scrollY || root.scrollTop) >= ${String(ACTION_BAR_FROM_PX)}) root.setAttribute("data-actionbar", "on");
    else root.removeAttribute("data-actionbar");
  }
  window.addEventListener("scroll", sync, { passive: true });
  sync();
}`;

/** The text a page carries: called, because the minifier emits a function expression. */
export function actionBarScript(): string {
  return `(${INLINE_SCRIPTS.actionbar})();`;
}
