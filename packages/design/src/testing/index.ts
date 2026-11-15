/**
 * Parsed-DOM test helpers (#922): assert STRUCTURE — which state a tile is in,
 * what it is labelled by, which credit lines it carries, which classes an
 * element has — instead of a substring of the markup, so a markup change that
 * leaves behaviour alone breaks no test that is not a golden.
 *
 * The parser is ours and small on purpose: it reads the fragments WE emit
 * (elements, double- or single-quoted attributes, text, entities, void
 * elements, `<!doctype>` and comments skipped, raw text inside `<script>` and
 * `<style>`), with no dependency (the workspace has none; `linkedom` and
 * `parse5` would be the first). It is not a browser: unclosed or misnested
 * tags are closed at the nearest matching open element, which is enough to
 * read our own output and to notice when it stops being well-formed
 * (`wellFormed`). Test-only: exported as `@viafrei/design/testing`, never
 * imported by a runtime file.
 */
import { RENDERED_STATES, type RenderedState } from "../tile.js";

export type El = {
  readonly tag: string;
  readonly attrs: Readonly<Record<string, string>>;
  readonly children: readonly Node[];
  readonly parent: El | null;
};
export type Node = El | { readonly text: string };
const isEl = (n: Node): n is El => "tag" in n;

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const RAW = new Set(["script", "style"]);
const ENTITIES: Readonly<Record<string, string>> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** `&amp;` → `&`, numeric references too. */
export function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

type MutableEl = { tag: string; attrs: Record<string, string>; children: Node[]; parent: MutableEl | null };

/** The fragment as a tree under a synthetic `#root`; `problems` lists what was not well-formed. */
export function parse(html: string): { readonly root: El; readonly problems: readonly string[] } {
  const root: MutableEl = { tag: "#root", attrs: {}, children: [], parent: null };
  const problems: string[] = [];
  let cur = root;
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      cur.children.push({ text: decode(html.slice(i)) });
      break;
    }
    if (lt > i) cur.children.push({ text: decode(html.slice(i, lt)) });
    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt);
      i = end === -1 ? html.length : end + 3;
      continue;
    }
    if (html.startsWith("<!", lt)) {
      const end = html.indexOf(">", lt);
      i = end === -1 ? html.length : end + 1;
      continue;
    }
    const close = /^<\/([a-zA-Z][\w-]*)\s*>/.exec(html.slice(lt));
    if (close !== null) {
      const tag = close[1]!.toLowerCase();
      let e: MutableEl | null = cur;
      while (e !== null && e.tag !== tag) e = e.parent;
      if (e === null || e === root) problems.push(`a stray </${tag}> at ${String(lt)}`);
      else {
        if (e !== cur) problems.push(`<${cur.tag}> closed by </${tag}> at ${String(lt)}`);
        cur = e.parent ?? root;
      }
      i = lt + close[0].length;
      continue;
    }
    const open = /^<([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/.exec(html.slice(lt));
    if (open === null) {
      cur.children.push({ text: "<" });
      i = lt + 1;
      continue;
    }
    const tag = open[1]!.toLowerCase();
    const a: Record<string, string> = {};
    for (const m of open[2]!.matchAll(/([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) a[m[1]!.toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? "");
    const el: MutableEl = { tag, attrs: a, children: [], parent: cur };
    cur.children.push(el);
    i = lt + open[0].length;
    if (RAW.has(tag)) {
      const end = html.toLowerCase().indexOf(`</${tag}`, i);
      const stop = end === -1 ? html.length : end;
      el.children.push({ text: html.slice(i, stop) });
      i = stop;
      cur = el;
    } else if (!VOID.has(tag) && open[3] !== "/") cur = el;
  }
  if (cur !== root) problems.push(`<${cur.tag}> never closed`);
  return { root, problems };
}

/** The problems of `html` as a tree (empty: every element closed where it opened). */
export function wellFormed(html: string): readonly string[] {
  return parse(html).problems;
}

/** Every element under `n`, in document order. */
export function elements(n: El): readonly El[] {
  const out: El[] = [];
  const walk = (e: El): void => {
    for (const c of e.children)
      if (isEl(c)) {
        out.push(c);
        walk(c);
      }
  };
  walk(n);
  return out;
}

/** The element's classes. */
export const classesOf = (e: El): readonly string[] => (e.attrs.class ?? "").split(/\s+/).filter((c) => c !== "");

/** Its text, entities decoded, whitespace as written. */
export function text(n: Node): string {
  return isEl(n) ? n.children.map(text).join("") : n.text;
}

type Simple = { readonly tag: string | null; readonly classes: readonly string[]; readonly id: string | null; readonly attrs: readonly (readonly [string, string | null])[] };
const parseSimple = (s: string): Simple => {
  const tag = /^[a-zA-Z][\w-]*/.exec(s)?.[0]?.toLowerCase() ?? null;
  // classes and the id are read OUTSIDE the brackets: `[href="https://a.b/#c"]` holds a dot and a hash that are neither
  const bare = s.replace(/\[[^\]]*\]/g, "");
  return {
    tag,
    classes: [...bare.matchAll(/\.([\w-]+)/g)].map((m) => m[1]!),
    id: /#([\w-]+)/.exec(bare)?.[1] ?? null,
    attrs: [...s.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)].map((m) => [m[1]!.toLowerCase(), m[2] ?? null] as const),
  };
};
const matches = (e: El, s: Simple): boolean =>
  (s.tag === null || e.tag === s.tag) &&
  (s.id === null || e.attrs.id === s.id) &&
  s.classes.every((c) => classesOf(e).includes(c)) &&
  s.attrs.every(([k, v]) => (v === null ? k in e.attrs : e.attrs[k] === v));

/**
 * Every element matching a selector of simple parts — `tag`, `.class`, `#id`,
 * `[attr]`, `[attr="v"]`, compounded (`p.credit[lang="de"]`) — joined by the
 * descendant combinator (a space). Enough for our fragments; no `>`, no pseudo.
 */
export function all(html: string | El, selector: string): readonly El[] {
  const root = typeof html === "string" ? parse(html).root : html;
  const parts = selector.trim().split(/\s+(?![^[]*\])/).map(parseSimple);
  return elements(root).filter((e) => {
    if (!matches(e, parts[parts.length - 1]!)) return false;
    let k = parts.length - 2;
    for (let p = e.parent; p !== null && k >= 0; p = p.parent) if (matches(p, parts[k]!)) k--;
    return k < 0;
  });
}

/** The first element matching, or null. */
export const first = (html: string | El, selector: string): El | null => all(html, selector)[0] ?? null;

/** Every class used anywhere in `html`. */
export function classesIn(html: string): ReadonlySet<string> {
  return new Set(elements(parse(html).root).flatMap(classesOf));
}

export type TileView = {
  readonly id: string;
  readonly state: RenderedState | "loading" | null;
  readonly title: string;
  /** What `aria-labelledby` names, read from the element it points at; null when it points at nothing. */
  readonly accessibleName: string | null;
  /** The pill's state word and its age, as read. */
  readonly pill: { readonly word: string; readonly time: string | null } | null;
  /** The figure's number (the dash when there is none), or null when the tile has no figure. */
  readonly figure: string | null;
  readonly note: string | null;
  /** The text of each credit line, in order. */
  readonly credits: readonly string[];
};

/** The first tile in `html`, read as a visitor's assistive technology would. */
export function tile(html: string): TileView {
  const { root } = parse(html);
  const t = first(root, "section.tile");
  if (t === null) throw new Error("no section.tile in the fragment");
  const label = t.attrs["aria-labelledby"];
  const named = label === undefined ? null : (elements(root).find((e) => e.attrs.id === label) ?? null);
  const state = classesOf(t).map((c) => c.replace(/^is-/, "")).find((c) => (RENDERED_STATES as readonly string[]).includes(c) || c === "loading");
  const pill = first(t, "p.age");
  const word = pill === null ? null : first(pill, ".age__state");
  const time = pill === null ? null : first(pill, ".age__time");
  const fig = first(t, ".tile__figure .tile__num");
  const note = first(t, "p.tile__note");
  return {
    id: t.attrs.id ?? "",
    state: (state as TileView["state"] | undefined) ?? null,
    title: text(first(t, ".tile__title") ?? { text: "" }),
    accessibleName: named === null ? null : text(named).trim(),
    pill: pill === null ? null : { word: word === null ? "" : text(word), time: time === null ? null : text(time).replace(/^·\s*/, "") },
    figure: fig === null ? null : text(fig),
    note: note === null ? null : text(note),
    credits: all(t, "p.credit").map((c) => text(c)),
  };
}
