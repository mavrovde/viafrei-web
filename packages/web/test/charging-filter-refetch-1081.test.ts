/**
 * #1081 review 4: the charging filter's re-fetch, RUN — the shipped refresh script in a VM over a minimal page — so a
 * second change made while the first fetch is in flight is not dropped: the card ends on the filter the address shows,
 * and the in-flight answer for the superseded filter is never shown.
 */
import { Script, createContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { REFRESH_JS } from "../src/lib/card-refresh.js";

type Pending = { url: string; resolve: (html: string) => void };

function page(): { change: (data: Record<string, string[]>) => void; fetches: Pending[]; card: { innerHTML: string }; search: () => string; settle: () => Promise<void> } {
  const listeners = new Map<string, ((e: unknown) => void)[]>();
  const fetches: Pending[] = [];
  const loc = { search: "?topics=charging", pathname: "/de/place/koeln", hash: "" };
  const node = (): Record<string, unknown> => ({ setAttribute: () => undefined, appendChild: () => undefined, style: {} });
  const attrs: Record<string, string> = { "data-card": "/fragment/card?place=koeln&card=charging&lang=de" };
  const card = {
    id: "pcard-charging",
    className: "pcard",
    innerHTML: "<p>first</p>",
    hidden: false,
    getAttribute: (k: string) => attrs[k] ?? null,
    setAttribute: () => undefined,
    removeAttribute: () => undefined,
    querySelector: () => null,
    querySelectorAll: () => [],
    contains: () => false,
  };
  let data: Record<string, string[]> = {};
  const form = { closest: (sel: string) => (sel === "form.evf" ? form : sel.startsWith("article.pcard") ? card : null), contains: () => false };
  class FormData {
    get(k: string): string | null {
      return data[k]?.[0] ?? null;
    }
    getAll(k: string): string[] {
      return data[k] ?? [];
    }
  }
  const document = {
    documentElement: { lang: "de" },
    hidden: false,
    activeElement: null,
    body: node(),
    addEventListener: (t: string, f: (e: unknown) => void) => listeners.set(t, [...(listeners.get(t) ?? []), f]),
    dispatchEvent: () => true,
    querySelectorAll: () => [],
    getElementById: () => null,
    createElement: (tag: string) => {
      if (tag !== "template") return { ...node(), textContent: "" };
      const t = { content: { firstElementChild: null as unknown }, set innerHTML(v: string) {
        t.content.firstElementChild = { id: "pcard-charging", className: "pcard", innerHTML: v };
      } };
      return t;
    },
  };
  const fetch = (url: string): Promise<unknown> =>
    new Promise((res) => {
      fetches.push({ url, resolve: (html) => res({ status: 200, headers: { get: () => null }, text: () => Promise.resolve(html) }) });
    });
  const ctx = createContext({
    document,
    location: loc,
    history: { state: null, replaceState: (_s: unknown, _t: string, u: string) => (loc.search = u.includes("?") ? u.slice(u.indexOf("?")) : "") },
    fetch,
    FormData,
    WeakMap,
    Intl,
    Date,
    Math,
    Number,
    String,
    Array,
    Error,
    setTimeout: (f: () => void) => (f(), 0),
    clearTimeout: () => undefined,
    CustomEvent: class {
      constructor(public type: string) {}
    },
  });
  new Script(REFRESH_JS).runInContext(ctx);
  const change = (d: Record<string, string[]>): void => {
    data = d;
    for (const l of listeners.get("change") ?? []) l({ target: form, preventDefault: () => undefined });
  };
  return { change, fetches, card, search: () => loc.search, settle: () => new Promise((r) => setImmediate(r)) };
}

describe("a second filter change while the first fetch is in flight (#1081 review 4)", () => {
  it("is fetched once the first lands; the card ends on the second filter, the first answer never shown", async () => {
    const p = page();
    p.change({ ev_kw: ["hpc"] });
    expect(p.fetches).toHaveLength(1);
    expect(p.fetches[0]!.url).toContain("&ev_kw=hpc");
    p.change({ ev_kw: ["ac"] });
    // the address follows at once; nothing else is asked while the first is in flight
    expect(p.search()).toBe("?topics=charging&ev_kw=ac");
    expect(p.fetches).toHaveLength(1);
    p.fetches[0]!.resolve("<p>hpc</p>");
    await p.settle();
    expect(p.card.innerHTML).toBe("<p>first</p>");
    expect(p.fetches).toHaveLength(2);
    expect(p.fetches[1]!.url).toContain("&ev_kw=ac");
    expect(p.fetches[1]!.url).not.toContain("hpc");
    p.fetches[1]!.resolve("<p>ac</p>");
    await p.settle();
    expect(p.card.innerHTML).toBe("<p>ac</p>");
  });

  it("one change: one fetch, its answer shown", async () => {
    const p = page();
    p.change({ ev_op: ["enbw"], ev_free: ["1"] });
    expect(p.fetches[0]!.url).toContain("&ev_op=enbw&ev_free=1");
    p.fetches[0]!.resolve("<p>enbw</p>");
    await p.settle();
    expect(p.fetches).toHaveLength(1);
    expect(p.card.innerHTML).toBe("<p>enbw</p>");
  });

  it("#1081 phase 2: the terms of use ride in the address the card is re-fetched with", async () => {
    const p = page();
    p.change({ ev_term: ["open247", "card"] });
    expect(p.fetches[0]!.url).toContain("&ev_term=open247,card");
    p.fetches[0]!.resolve("<p>terms</p>");
    await p.settle();
    expect(p.card.innerHTML).toBe("<p>terms</p>");
  });
});
