/**
 * #1195: a sticky desktop panel stays inside its own area. A sticky box is held by its CONTAINING BLOCK, and a grid item's
 * containing block, for `position: sticky`, is the whole grid rather than its grid area: the #1180 panels therefore
 * scrolled on over every block laid out after their rows (the station's area, the home's "Deutschland jetzt"). #1180's
 * AC 4 checks stopped at the end of the first row, which is why they never saw it.
 *
 * `stickyWalk` scrolls the page from the top to its END in steps of at most half a window and, at every step, compares
 * the panel's box with every other content block's: each box of the `.desk` grid (a `display: contents` wrapper is
 * looked through, so the blocks are the boxes the grid lays out), and every block of `main` and the footer after it.
 * The panel's own box, its ancestors and its descendants are not "other". The panel is the first element, the named
 * one or one inside it, whose computed `position` is `sticky`, so the same call reads a panel that is sticky itself and
 * one whose inner box is.
 *
 * #1196 rides on the same walk: no box of the panel scrolls inside itself, and each of its rows and lines (a legend row,
 * a credit line) stands whole in the window under the header at some step, so the page's own scroll reaches it (a
 * panel taller than the window shows its foot when the end of its area carries it up).
 */
import type { Page } from "playwright";

export type StickyWalk = {
  /** Every step's overlap, `"<scrollY>: <block>"`; empty when the panel covered nothing. */
  readonly hits: readonly string[];
  /** The scroll positions visited, the last one the end of the page. */
  readonly steps: readonly number[];
  /** How many blocks were compared (a walk over nothing is no evidence). */
  readonly blocks: number;
  /** The steps at which the panel stood stuck under the header (its top within 1 px of where it sticks). */
  readonly stuck: readonly number[];
  /** The sticky element that was walked: its id or class. */
  readonly panel: string;
  /** #1196: the boxes of the panel that scroll inside themselves (empty: it shows all it holds). */
  readonly inner: readonly string[];
  /** #1196: the panel's rows and lines never shown whole in the window under the header at any step. */
  readonly unseen: readonly string[];
  /** How many rows and lines of the panel were looked for. */
  readonly lines: number;
};

/** Open every fold the desktop closed (its "alle N anzeigen" buttons, a card's own fold): the longest the page can be. */
export async function openEveryFold(page: Page): Promise<number> {
  return page.evaluate(() => {
    let n = 0;
    for (const b of document.querySelectorAll<HTMLButtonElement>(".desk .desk__more[aria-expanded='false']")) {
      b.click();
      n++;
    }
    for (const d of document.querySelectorAll<HTMLDetailsElement>(".desk details.fold:not([open])")) {
      d.open = true;
      n++;
    }
    return n;
  });
}

export async function stickyWalk(page: Page, panel: string): Promise<StickyWalk> {
  return page.evaluate((sel) => {
    const named = document.querySelector(sel);
    if (named === null) throw new Error(`${sel}: not on the page`);
    // the panel's box: the sticky one (itself or inside it: the home's connect block's inner box), else the panel
    const sticky = [named, ...named.querySelectorAll("*")].find((e) => getComputedStyle(e).position === "sticky") ?? named;
    const grid = document.querySelector(".desk");
    if (grid === null) throw new Error("no .desk grid on the page");
    const mine = (e: Element): boolean => e === sticky || e.contains(sticky) || sticky.contains(e);
    const blocks: Element[] = [];
    const cells = (p: Element): void => {
      for (const c of p.children) {
        const d = getComputedStyle(c).display;
        if (d === "none") continue;
        if (d === "contents") cells(c);
        else if (!mine(c)) blocks.push(c);
        else if (c !== sticky && c.contains(sticky)) cells(c);
      }
    };
    cells(grid);
    for (let s = grid.nextElementSibling; s !== null; s = s.nextElementSibling) if (getComputedStyle(s).display !== "none") blocks.push(s);
    for (const f of document.querySelectorAll("body > footer, .site-foot")) if (!blocks.includes(f)) blocks.push(f);
    const name = (e: Element): string => e.id || `${e.tagName.toLowerCase()}.${(e.getAttribute("class") ?? "").trim().split(/\s+/u).join(".")}`;
    const step = Math.floor(window.innerHeight / 2);
    const end = document.documentElement.scrollHeight - window.innerHeight;
    const hits: string[] = [];
    const steps: number[] = [];
    const stuck: number[] = [];
    const top = parseFloat(getComputedStyle(sticky).top);
    // #1196: nothing of the panel scrolls inside it — the panel, the boxes holding it in the grid and every box in it
    const scroller = (e: Element): boolean => /auto|scroll/u.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 1;
    const inner: string[] = [];
    for (let e: Element | null = sticky; e !== null && e !== grid; e = e.parentElement) if (scroller(e)) inner.push(name(e));
    for (const e of sticky.querySelectorAll("*")) if (scroller(e) && !e.closest("pre, .table-scroll, .stpage__scroll, .fuelst__wrap")) inner.push(name(e));
    // #1196: every row and line of the panel (a legend row, a credit line) stands whole in the window at some step
    const lines = [...sticky.querySelectorAll("li, p, dt, dd, figcaption, tr")].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden";
    });
    const seen = new Set<Element>();
    const head = document.querySelector(".site-head");
    for (let y = 0; ; y = Math.min(end, y + step)) {
      window.scrollTo({ top: y, behavior: "instant" });
      const at = Math.round(window.scrollY);
      steps.push(at);
      const m = sticky.getBoundingClientRect();
      if (getComputedStyle(sticky).position === "sticky" && Math.abs(m.top - top) <= 1) stuck.push(at);
      const hb = head === null ? 0 : Math.max(0, head.getBoundingClientRect().bottom);
      for (const l of lines) {
        const r = l.getBoundingClientRect();
        if (r.top >= hb - 1 && r.bottom <= window.innerHeight + 1) seen.add(l);
      }
      for (const b of blocks) {
        const r = b.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.right > m.left + 0.5 && r.left < m.right - 0.5 && r.bottom > m.top + 0.5 && r.top < m.bottom - 0.5) hits.push(`${String(at)}: ${name(b)}`);
      }
      if (y >= end) break;
    }
    window.scrollTo({ top: 0, behavior: "instant" });
    const unseen = lines.filter((l) => !seen.has(l) && l.getBoundingClientRect().height < window.innerHeight / 2).map(name);
    return { hits, steps, blocks: blocks.length, stuck, panel: name(sticky), inner, unseen, lines: lines.length };
  }, panel);
}

/**
 * #1180 AC 4, kept under #1195/#1196: where a panel stands once the page is scrolled to `y`. It is sticky, and either
 * it sticks under the header near the window's top, or the end of its own area (the grid, the station's `.desk__top`,
 * the home's connect column) has carried it up — that is the bound, never a slide under the header. A panel taller
 * than the window keeps its foot below the window until then (it shows all it holds, nothing scrolls inside it).
 * The verdict is the failure in words, or null.
 */
export async function stickAt(page: Page, sel: string, y: number): Promise<{ readonly why: string | null; readonly top: number; readonly bottom: number; readonly carried: boolean }> {
  return page.evaluate(
    ([s, to]) => {
      const p = document.querySelector(s);
      if (p === null) throw new Error(`${s}: not on the page`);
      window.scrollTo({ top: to, behavior: "instant" });
      const r = p.getBoundingClientRect();
      const head = document.querySelector(".site-head");
      const hb = head === null ? 0 : Math.max(0, head.getBoundingClientRect().bottom);
      // its area: the box that holds it (the first ancestor with a box of its own — the grid, the station's
      // `.desk__top`, the home's connect column), to the end of its content; carried = the panel's margin box ends there
      let cb = p.parentElement!;
      while (getComputedStyle(cb).display === "contents" && cb.parentElement !== null) cb = cb.parentElement;
      const cs = getComputedStyle(cb);
      const area = cb.getBoundingClientRect().bottom - parseFloat(cs.paddingBottom) - parseFloat(cs.borderBottomWidth);
      const carried = Math.abs(r.bottom + parseFloat(getComputedStyle(p).marginBottom) - area) <= 2;
      let why: string | null = null;
      if (getComputedStyle(p).position !== "sticky") why = `not sticky (${getComputedStyle(p).position})`;
      else if (!carried && r.top < hb - 1) why = `its top ${String(Math.round(r.top))} under the header (${String(Math.round(hb))})`;
      else if (!carried && r.top >= window.innerHeight / 4) why = `its top ${String(Math.round(r.top))} not near the window's top`;
      return { why, top: Math.round(r.top), bottom: Math.round(r.bottom), carried };
    },
    [sel, y] as const,
  );
}
