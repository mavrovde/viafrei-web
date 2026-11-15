/**
 * #1061 review B2: a filter chip of a card (`.amchips`/`.nbchips`, CSS-only) judges only the entries in the document,
 * so checking one opens EVERY pager fold of its card, chained — each fold the fragment brings is opened in turn — and
 * focus does not move. The e2e test drives that in a browser; this one runs the SHIPPED pager script (the minified
 * text the page carries) and its readable source against a stub DOM whose fetch answers the fragments, so removing
 * `openAll` from the chip's listener (or from the chain) goes red here without a browser.
 */
import { describe, expect, it } from "vitest";
import { cardPagerScript, PAGER_JS } from "../src/lib/card-more.js";

type Listener = (e: { target: unknown }) => void;

type Stub = {
  tagName: string;
  classes: string[];
  attrs: Record<string, string>;
  children: Stub[];
  parent: Stub | null;
  checked?: boolean;
  focused: boolean;
  isOpen: boolean;
  open: boolean;
  innerHTML: string;
  getAttribute(n: string): string | null;
  setAttribute(n: string, v: string): void;
  removeAttribute(n: string): void;
  classList: { contains(c: string): boolean };
  matches(sel: string): boolean;
  closest(sel: string): Stub | null;
  querySelector(sel: string): Stub | null;
  querySelectorAll(sel: string): Stub[];
  focus(): void;
};

/** A selector the script uses, as a test of one stub: `details.pager`, `.pcard`, `.amchips, .nbchips`, `.pcard__morebody`, `li`. */
function matches(e: Stub, sel: string): boolean {
  return sel.split(",").some((one) => {
    const s = one.trim();
    const [tag, ...cls] = s.split(".");
    return (tag === "" || e.tagName === tag!.toUpperCase()) && cls.every((c) => e.classes.includes(c));
  });
}

function page() {
  const listeners: Record<string, Listener[]> = {};
  const fetched: string[] = [];
  /** The digest's fragments by `from`: a list, and the next fold inside it until the last page. */
  const fragments: Record<string, { entries: number; next: string | null }> = {
    "13": { entries: 12, next: "/fragment/more?road=A7&card=roadworks&lang=de&from=25&v=42" },
    "25": { entries: 6, next: null },
  };
  const descendants = (e: Stub): Stub[] => e.children.flatMap((c) => [c, ...descendants(c)]);
  const make = (tagName: string, classes: string[], attrs: Record<string, string> = {}): Stub => {
    let open = false;
    let html = "";
    const e: Stub = {
      tagName: tagName.toUpperCase(),
      classes,
      attrs: { ...attrs },
      children: [],
      parent: null,
      focused: false,
      isOpen: false,
      get open() {
        return open;
      },
      set open(v: boolean) {
        const was = open;
        open = v;
        e.isOpen = v;
        // a details element fires `toggle` after its state changed, asynchronously
        if (v !== was) queueMicrotask(() => (listeners["toggle"] ?? []).forEach((l) => l({ target: e })));
      },
      get innerHTML() {
        return html;
      },
      set innerHTML(v: string) {
        html = v;
        e.children = [];
        const n = (v.match(/<li/g) ?? []).length;
        for (let i = 0; i < n; i += 1) add(e, make("li", []));
        const rows = (v.match(/<tr class="pcard__dep"/g) ?? []).length;
        for (let i = 0; i < rows; i += 1) add(e, make("tr", ["pcard__dep"]));
        const next = /data-more="([^"]+)"/.exec(v)?.[1];
        if (next !== undefined) add(e, pager(next));
      },
      getAttribute: (n) => e.attrs[n] ?? null,
      setAttribute: (n, v) => void (e.attrs[n] = v),
      removeAttribute: (n) => void delete e.attrs[n],
      classList: { contains: (c) => e.classes.includes(c) },
      matches: (sel) => matches(e, sel),
      closest: (sel) => {
        for (let x: Stub | null = e; x !== null; x = x.parent) if (matches(x, sel)) return x;
        return null;
      },
      querySelector: (sel) => descendants(e).find((x) => matches(x, sel)) ?? null,
      querySelectorAll: (sel) => descendants(e).filter((x) => matches(x, sel)),
      focus: () => void (e.focused = true),
    };
    return e;
  };
  const add = (parent: Stub, child: Stub): Stub => {
    child.parent = parent;
    parent.children.push(child);
    return child;
  };
  const pager = (url: string): Stub => {
    const d = make("details", ["pcard__more", "pager"], { "data-more": url, "data-loaded": "12 weitere Einträge geladen" });
    add(d, make("div", ["pcard__morebody"]));
    return d;
  };
  // one card: a chip row and the first fold (entries 13–24)
  const card = make("section", ["pcard"]);
  const chips = add(card, make("div", ["amchips"]));
  const chip = add(chips, make("input", []));
  const other = add(card, make("div", ["plain"]));
  const plainBox = add(other, make("input", []));
  const first = add(card, pager("/fragment/more?road=A7&card=roadworks&lang=de&from=13&v=42"));
  const fetchStub = (url: string): Promise<{ status: number; text: () => Promise<string> }> => {
    fetched.push(url);
    const f = fragments[/[?&]from=(\d+)/.exec(url)?.[1] ?? ""];
    // #1115 B: a stop's departures step is a departure board — a table whose rows are the entries
    if (url.includes("card=departures")) {
      const rows = '<tr class="pcard__dep"><td>x</td></tr>'.repeat(5);
      return Promise.resolve({ status: 200, text: () => Promise.resolve(`<table class="pcard__board"><thead><tr><th>Zeit</th></tr></thead><tbody>${rows}</tbody></table>`) });
    }
    if (f === undefined) return Promise.resolve({ status: 404, text: () => Promise.resolve("") });
    const lis = '<li><div class="entry"></div></li>'.repeat(f.entries);
    const next = f.next === null ? "" : `<details class="pcard__more pager" data-more="${f.next}"><summary>›</summary><div class="pcard__morebody"></div></details>`;
    return Promise.resolve({ status: 200, text: () => Promise.resolve(`<ul class="pcard__list motorway__list">${lis}</ul>${next}`) });
  };
  const body = make("body", []);
  const document = {
    body,
    addEventListener: (type: string, l: Listener) => void (listeners[type] ??= []).push(l),
    getElementById: () => null,
    createElement: (t: string) => make(t, []),
    dispatchEvent: () => true,
  };
  const change = (target: Stub): void => (listeners["change"] ?? []).forEach((l) => l({ target }));
  /** Every fold of the card, in document order. */
  const folds = (): Stub[] => card.querySelectorAll("details.pager");
  // a second card, the stations card, whose fold brings a departure board (#1115 B)
  const depsCard = make("section", ["pcard"]);
  const deps = add(depsCard, pager("/fragment/more?place=koeln&card=departures&lang=de&stop=x&after=y"));
  return { document, fetchStub, change, chip, plainBox, first, deps, depsCard, folds, fetched, card };
}

/** Lets every queued fetch, `then` and `toggle` run. */
const settle = async (): Promise<void> => {
  for (let i = 0; i < 20; i += 1) await new Promise((r) => setImmediate(r));
};

const SCRIPTS: readonly (readonly [string, string])[] = [
  ["the shipped (minified) script", cardPagerScript()],
  ["the readable source", `(function () {\n${PAGER_JS}\n})();`],
];

describe.each(SCRIPTS)("a card's filter chip opens every fold of its card (#1061 review B2) — %s", (_name, script) => {
  const run = (p: ReturnType<typeof page>): void => {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- running the shipped script is the point
    new Function("document", "fetch", "location", "setTimeout", "CustomEvent", script)(p.document, p.fetchStub, { reload: () => undefined }, () => 0, class {});
  };

  it("a checked .amchips chip opens the first fold, then the fold it brought, to the end; focus stays", async () => {
    const p = page();
    run(p);
    p.chip.checked = true;
    p.change(p.chip);
    await settle();
    expect(p.fetched).toEqual(["/fragment/more?road=A7&card=roadworks&lang=de&from=13&v=42", "/fragment/more?road=A7&card=roadworks&lang=de&from=25&v=42"]);
    const folds = p.folds();
    expect(folds).toHaveLength(2);
    for (const d of folds) {
      expect(d.isOpen).toBe(true);
      expect(d.getAttribute("data-state")).toBe("done");
    }
    expect(p.card.querySelectorAll("li")).toHaveLength(18);
    expect(p.card.querySelectorAll("li").some((li) => li.focused)).toBe(false);
  });

  it("the same for a .nbchips chip", async () => {
    const p = page();
    p.chip.parent!.classes = ["nbchips"];
    run(p);
    p.chip.checked = true;
    p.change(p.chip);
    await settle();
    expect(p.folds().map((d) => d.isOpen)).toEqual([true, true]);
  });

  it("an unchecked chip, or a box outside a chip row, opens nothing", async () => {
    const p = page();
    run(p);
    p.chip.checked = false;
    p.change(p.chip);
    p.plainBox.checked = true;
    p.change(p.plainBox);
    await settle();
    expect(p.fetched).toEqual([]);
    expect(p.first.isOpen).toBe(false);
  });

  it("a fold a person opens loads one page and moves focus there — it does not chain", async () => {
    const p = page();
    run(p);
    p.first.open = true;
    await settle();
    expect(p.fetched).toHaveLength(1);
    const folds = p.folds();
    expect(folds).toHaveLength(2);
    expect(folds[1]!.isOpen).toBe(false);
    expect(p.card.querySelectorAll("li")[0]!.focused).toBe(true);
  });

  it("#1115 B: a departures fold moves focus to the first row of the board it brought", async () => {
    const p = page();
    run(p);
    p.deps.open = true;
    await settle();
    const rows = p.depsCard.querySelectorAll("tr.pcard__dep");
    expect(rows).toHaveLength(5);
    expect(rows[0]!.focused).toBe(true);
    expect(rows[0]!.getAttribute("tabindex")).toBe("-1");
  });
});
