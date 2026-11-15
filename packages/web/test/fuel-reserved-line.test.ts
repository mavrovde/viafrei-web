/**
 * The fuel slot keeps its height from the first paint (2.4.3 cut, the visual gate's A61 shot): the script swaps
 * the no-JavaScript line for the loading line AT ONCE, not when the card comes into view. Before, both were
 * hidden until the view, so the slot was empty and grew twice as the person scrolled to it — a layout shift of
 * every block under it (0.018 at 390 px, measured in the noble container). The read still waits for the view.
 */
import { describe, expect, it } from "vitest";
import { motorwayFuelScript } from "../src/lib/motorway-fuel.js";
import { placeFuelScript } from "../src/lib/place-fuel.js";

type Line = { hidden: boolean; style: { visibility: string } };
const line = (hidden: boolean): Line => ({ hidden, style: { visibility: "" } });

/** An observer that never reports the card in view: everything asserted happens BEFORE the view. */
class NeverInView {
  observe(): void {}
  disconnect(): void {}
}

/** An observer that reports the card in view as soon as it is observed. */
class AtOnceInView {
  constructor(private readonly cb: (es: { isIntersecting: boolean }[]) => void) {}
  observe(): void {
    this.cb([{ isIntersecting: true }]);
  }
  disconnect(): void {}
}

const run = (script: string, args: Record<string, unknown>): void => {
  const names = Object.keys(args);
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- running the shipped script is the point
  new Function(...names, script)(...names.map((k) => args[k]));
};

describe("the fuel slot holds the loading line from the start, before the card is in view", () => {
  it("motorway page: the no-JS line is hidden, the loading line shown, nothing fetched", () => {
    const n = line(false), l = line(true), f = line(true);
    const out = { innerHTML: "" };
    const section = { querySelector: (s: string) => ({ ".motorway__fuelout": out, ".motorway__fuelloading": l, ".motorway__fuelfailed": f, ".motorway__nojs": n })[s] ?? null };
    const fetched: string[] = [];
    run(motorwayFuelScript(), {
      document: { hidden: false, querySelector: (s: string) => (s === ".motorway__fuel" ? section : null), addEventListener: () => {}, removeEventListener: () => {} },
      location: { pathname: "/de/autobahn/a61", search: "" },
      fetch: (u: string) => { fetched.push(u); return new Promise(() => {}); },
      setTimeout,
      IntersectionObserver: NeverInView,
    });
    expect([n.hidden, l.hidden, f.hidden]).toEqual([true, false, true]);
    // #1142: the line holds its box but says nothing: no read is being made
    expect(l.style.visibility).toBe("hidden");
    expect(fetched).toEqual([]);
  });

  it("place card: the no-JS line is hidden, the loading line shown, nothing fetched — and a card with no place page says it failed instead", () => {
    const card = (href: string | null) => {
      const j = line(false), l = line(true), f = line(true);
      const out = { innerHTML: "", firstElementChild: null, addEventListener: () => {} };
      const a = href === null ? null : { getAttribute: () => href };
      const place = { querySelector: (s: string) => (s === "a.place__page" ? a : null) };
      const slot = {
        querySelector: (s: string) => ({ ".pcard__fuelout": out, ".pcard__fuelloading": l, ".pcard__fuelfailed": f, ".pcard__fueljs": j })[s] ?? null,
        closest: (s: string) => (s === ".place" ? place : null),
      };
      return { slot, j, l, f };
    };
    const priced = card("/de/place/koeln");
    const lost = card(null);
    const fetched: string[] = [];
    run(placeFuelScript(), {
      document: { hidden: false, querySelectorAll: () => [priced.slot, lost.slot], querySelector: () => null, addEventListener: () => {}, removeEventListener: () => {} },
      location: { pathname: "/de/place/koeln", search: "" },
      fetch: (u: string) => { fetched.push(u); return new Promise(() => {}); },
      setTimeout,
      IntersectionObserver: NeverInView,
    });
    expect([priced.j.hidden, priced.l.hidden, priced.f.hidden]).toEqual([true, false, true]);
    // #1142: the reserved line does not claim a load nobody started (Köln's card sits ~5 800 px down)
    expect(priced.l.style.visibility).toBe("hidden");
    expect([lost.j.hidden, lost.l.hidden, lost.f.hidden]).toEqual([true, true, false]);
    expect(fetched).toEqual([]);
  });
});

describe("#1142: the loading line is shown exactly while the read is made", () => {
  it("place card: in view, the request is sent with the line visible; the line goes when the answer is in", async () => {
    const j = line(false), l = line(true), f = line(true);
    const out = { innerHTML: "", firstElementChild: null, addEventListener: () => {} };
    const place = { querySelector: (s: string) => (s === "a.place__page" ? { getAttribute: () => "/de/place/koeln" } : null) };
    const slot = {
      querySelector: (s: string) => ({ ".pcard__fuelout": out, ".pcard__fuelloading": l, ".pcard__fuelfailed": f, ".pcard__fueljs": j })[s] ?? null,
      closest: (s: string) => (s === ".place" ? place : null),
    };
    const fetched: string[] = [];
    const lineAtAsk: string[] = [];
    let answer: (v: unknown) => void = () => {};
    run(placeFuelScript(), {
      document: { hidden: false, querySelectorAll: () => [slot], querySelector: () => null, addEventListener: () => {}, removeEventListener: () => {} },
      location: { pathname: "/de/place/koeln", search: "" },
      localStorage: { getItem: () => null, setItem: () => {} },
      fetch: (u: string) => {
        fetched.push(u);
        lineAtAsk.push(`${String(l.hidden)}/${l.style.visibility}`);
        return new Promise((r) => (answer = r));
      },
      setTimeout,
      IntersectionObserver: AtOnceInView,
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(fetched).toEqual(["/fragment/place-fuel?place=koeln&lang=de"]);
    expect(lineAtAsk).toEqual(["false/"]);
    answer({ ok: true, text: () => Promise.resolve('<div class="place-fuel"><p>x</p></div>') });
    await new Promise((r) => setTimeout(r, 0));
    expect(l.hidden).toBe(true);
    expect(out.innerHTML).toContain("place-fuel");
  });
});
