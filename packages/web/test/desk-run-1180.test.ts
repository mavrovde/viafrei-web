/**
 * #1180 review: the desk script run against a stub DOM, its readable source and the minified text the page ships.
 *
 *   - A run after a swap (`vf:loaded`) folds the new sections beside the ones already folded. The generated ids must be
 *     unique for the page's life: with a counter that restarts per run, the new section was `desk-s0` again, and its
 *     button opened the section but hid the OTHER section's button (the first `[aria-controls="desk-s0"]`).
 *   - A section the reader opened that comes back from an in-place refresh (a new element, the same id) stands open.
 *   - A phone runs none of it: no `--desk-top`, no observer, no resize listener.
 *   - From 1024 px the header's height is followed by a `ResizeObserver` (the place bar opening grows it).
 */
import { describe, expect, it } from "vitest";
import { DESK_JS, type DeskConfig } from "../src/lib/desk.js";
import { INLINE_SCRIPTS } from "../src/lib/inline-scripts.js";

type Fn = (e?: unknown) => void;

class El {
  tagName: string;
  attrs: Record<string, string> = {};
  classes = new Set<string>();
  children: El[] = [];
  parentNode: El | null = null;
  listeners: Record<string, Fn[]> = {};
  hidden = false;
  type = "";
  textContent = "";
  focused = false;
  rect = { height: 0 };
  doc: Doc;
  constructor(doc: Doc, tag: string, cls: string[] = [], attrs: Record<string, string> = {}) {
    this.doc = doc;
    this.tagName = tag.toUpperCase();
    cls.forEach((c) => this.classes.add(c));
    Object.assign(this.attrs, attrs);
  }
  get parentElement(): El | null { return this.parentNode; }
  get id(): string { return this.attrs.id ?? ""; }
  set id(v: string) { this.attrs.id = v; }
  set className(v: string) { this.classes = new Set(v.split(/\s+/u).filter(Boolean)); }
  get isConnected(): boolean {
    let e = this.parentNode;
    while (e?.parentNode) e = e.parentNode;
    return e === this.doc.body;
  }
  getBoundingClientRect(): { height: number } { return this.rect; }
  get classList() {
    return {
      add: (c: string) => this.classes.add(c),
      remove: (c: string) => this.classes.delete(c),
      contains: (c: string) => this.classes.has(c),
      toggle: (c: string, on?: boolean) => ((on ?? !this.classes.has(c)) ? this.classes.add(c) : this.classes.delete(c)),
    };
  }
  hasAttribute(n: string): boolean { return n in this.attrs; }
  getAttribute(n: string): string | null { return this.attrs[n] ?? null; }
  setAttribute(n: string, v: string): void { this.attrs[n] = v; }
  removeAttribute(n: string): void { delete this.attrs[n]; }
  addEventListener(n: string, f: Fn): void { (this.listeners[n] ??= []).push(f); }
  click(): void { (this.listeners.click ?? []).forEach((f) => f({ target: this })); }
  focus(): void { this.focused = true; }
  append(c: El): void { c.remove(); c.parentNode = this; this.children.push(c); }
  prepend(c: El): void { c.remove(); c.parentNode = this; this.children.unshift(c); }
  after(c: El): void { const p = this.parentNode!; c.remove(); c.parentNode = p; p.children.splice(p.children.indexOf(this) + 1, 0, c); }
  before(c: El): void { const p = this.parentNode!; c.remove(); c.parentNode = p; p.children.splice(p.children.indexOf(this), 0, c); }
  replaceWith(c: El): void { this.before(c); this.remove(); }
  remove(): void { if (this.parentNode) { this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; } }
  all(): El[] { return this.children.flatMap((c) => [c, ...c.all()]); }
  matches(sel: string, scope?: El): boolean { return sel.split(",").some((s) => one(this, s.trim(), scope)); }
  querySelectorAll(sel: string): El[] { return this.all().filter((e) => e.matches(sel, this)); }
  querySelector(sel: string): El | null { return this.querySelectorAll(sel)[0] ?? null; }
  closest(sel: string): El | null { return this.matches(sel) ? this : (this.parentNode?.closest(sel) ?? null); }
}

/** A compound selector (`tag.class[attr="v"]`), optionally `:scope > X` or `A > B`. */
function compound(e: El, s: string): boolean {
  const m = /^([a-z0-9]*)((?:\.[\w-]+)*)((?:\[[^\]]+\])*)$/iu.exec(s);
  if (!m) throw new Error(`stub selector: ${s}`);
  if (m[1] && e.tagName !== m[1].toUpperCase()) return false;
  for (const c of m[2]!.split(".").filter(Boolean)) if (!e.classes.has(c)) return false;
  for (const a of m[3]!.match(/\[[^\]]+\]/gu) ?? []) {
    const [, n, v] = /^\[([\w-]+)(?:="([^"]*)")?\]$/u.exec(a)!;
    if (!(n! in e.attrs) || (v !== undefined && e.attrs[n!] !== v)) return false;
  }
  return true;
}
function one(e: El, s: string, scope?: El): boolean {
  if (s.startsWith(":scope > ")) return e.parentNode === scope && compound(e, s.slice(9));
  const parts = s.split(" > ");
  if (parts.length === 2) return compound(e, parts[1]!) && e.parentNode !== null && compound(e.parentNode, parts[0]!);
  return compound(e, s);
}

class Doc {
  body: El;
  listeners: Record<string, Fn[]> = {};
  rootStyle: Record<string, string> = {};
  constructor() { this.body = new El(this, "body"); }
  createElement(t: string): El { return new El(this, t); }
  querySelector(s: string): El | null { return this.body.querySelector(s); }
  querySelectorAll(s: string): El[] { return this.body.querySelectorAll(s); }
  getElementById(id: string): El | null { return this.body.all().find((e) => e.id === id) ?? null; }
  addEventListener(n: string, f: Fn): void { (this.listeners[n] ??= []).push(f); }
  fire(n: string): void { (this.listeners[n] ?? []).forEach((f) => f()); }
  get documentElement() {
    return { style: { setProperty: (k: string, v: string) => { this.rootStyle[k] = v; }, removeProperty: (k: string) => { delete this.rootStyle[k]; } } };
  }
}

const C: DeskConfig = { fold: ".f", cap: [], map: "#nomap", more: "alle {n} anzeigen" };

function section(doc: Doc, id?: string): El {
  const s = new El(doc, "section", ["f"], id ? { id } : {});
  s.append(new El(doc, "h2"));
  s.append(new El(doc, "li"));
  return s;
}

function boot(src: string, desktop: boolean) {
  const doc = new Doc();
  const head = new El(doc, "header", ["site-head"]);
  head.rect = { height: 101 };
  doc.body.append(head);
  const root = new El(doc, "div", ["desk"]);
  doc.body.append(root);
  const win: { listeners: Record<string, Fn[]>; observers: number } = { listeners: {}, observers: 0 };
  const window = {
    addEventListener: (n: string, f: Fn) => { (win.listeners[n] ??= []).push(f); },
    removeEventListener: (n: string, f: Fn) => { win.listeners[n] = (win.listeners[n] ?? []).filter((x) => x !== f); },
    matchMedia: true,
    ResizeObserver: class { constructor() { win.observers++; } observe(): void {} disconnect(): void { win.observers--; } },
  };
  const mq = { matches: desktop, addEventListener: () => undefined };
  const run = (): void => {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- running the shipped script is the point
    new Function("document", "window", "matchMedia", "location", "ResizeObserver", `(${src})(${JSON.stringify(C)})`)(
      doc, window, () => mq, { hash: "" }, window.ResizeObserver,
    );
  };
  return { doc, root, win, run };
}

for (const [name, src] of [["source", DESK_JS], ["shipped", INLINE_SCRIPTS.desk]] as const) {
  describe(`#1180 review: the desk script run (${name})`, () => {
    it("a run after a swap gives the new section an id of its own, and its button opens it and hides only its own button", () => {
      const p = boot(src, true);
      const a = section(p.doc);
      p.root.append(a);
      p.run();
      const b = section(p.doc);
      p.root.append(b);
      p.doc.fire("vf:loaded");
      expect(a.id).not.toBe("");
      expect(b.id).not.toBe(a.id);
      const [ba, bb] = [a, b].map((s) => s.querySelector(".desk__more")!);
      expect(bb!.getAttribute("aria-controls")).toBe(b.id);
      bb!.click();
      expect(b.getAttribute("data-desk")).toBe("open");
      expect(bb!.hidden).toBe(true);
      expect(ba!.hidden).toBe(false);
      expect(a.getAttribute("data-desk")).toBe("folded");
    });
    it("a section the reader opened stands open when a refresh brings it back as a new element", () => {
      const p = boot(src, true);
      const a = section(p.doc, "pcard-parking");
      const n = section(p.doc);
      p.root.append(a);
      p.root.append(n);
      p.run();
      a.querySelector(".desk__more")!.click();
      const a2 = section(p.doc, "pcard-parking");
      a.replaceWith(a2);
      const n2 = section(p.doc);
      n.replaceWith(n2);
      p.doc.fire("vf:loaded");
      expect(a2.getAttribute("data-desk")).toBe("open");
      expect(a2.querySelector(".desk__more")!.hidden).toBe(true);
      // one with no id of its own is a new section to the script: folded
      expect(n2.getAttribute("data-desk")).toBe("folded");
    });
    it("a phone runs none of it: no --desk-top, no observer, no resize listener, nothing folded", () => {
      const p = boot(src, false);
      const a = section(p.doc);
      p.root.append(a);
      p.run();
      expect(p.doc.rootStyle).toEqual({});
      expect(p.win.observers).toBe(0);
      expect(p.win.listeners.resize ?? []).toEqual([]);
      expect(a.hasAttribute("data-desk")).toBe(false);
      expect(a.id).toBe("");
    });
    it("from 1024 px it writes the header's height and follows it with one ResizeObserver across runs", () => {
      const p = boot(src, true);
      p.root.append(section(p.doc));
      p.run();
      p.doc.fire("vf:loaded");
      p.doc.fire("vf:main");
      expect(p.doc.rootStyle["--desk-top"]).toBe("101px");
      expect(p.win.observers).toBe(1);
    });
  });
}
