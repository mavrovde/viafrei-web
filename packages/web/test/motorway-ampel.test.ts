/**
 * #895: the shell moves the digest's Ampel to the top of a motorway page — the
 * page's (whole road or the address's choice) out of the fragment, a position's
 * out of the around block — and judges nothing. The browser half moves nodes
 * and sends nothing (G5.5). The lamp colours are tokens under the contrast gate.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderAmpel, renderMotorwayPage } from "@viafrei/digest";
import { ampelSwapScript, liftAmpel, liftAroundAmpel } from "../src/lib/motorway-ampel.js";
import { motorwayHeadOf } from "../src/lib/motorway-head.js";

const NOW = new Date("2026-10-21T08:00:00Z");
const quietPage = {
  road: "A7",
  at: NOW,
  staticState: "ok" as const,
  junctions: [],
  lands: [],
  towns: [],
  live: { state: "quiet" as const, asOf: NOW },
  attributions: [],
  line: [],
  layers: null,
};

describe("liftAmpel", () => {
  it("takes the digest's Ampel out of the page fragment, leaving the rest unchanged", () => {
    const head = motorwayHeadOf("A7", renderMotorwayPage("de", quietPage));
    const l = liftAmpel(head.html);
    expect(l.ampel).not.toBeNull();
    expect(l.ampel!.startsWith('<section class="pcard pcard--')).toBe(true);
    expect(l.ampel).toContain('id="motorway-ampel"');
    expect(l.ampel!.endsWith("</section>")).toBe(true);
    expect(l.html).not.toContain('id="motorway-ampel"');
    expect(l.html.replace(/^<section class="motorway" id="motorway"[^>]*>/, "")).toBe(head.html.replace(/^<section class="motorway" id="motorway"[^>]*>/, "").replace(l.ampel!, ""));
  });
  it("leaves a fragment without an Ampel (an older digest) as it is", () => {
    const f = '<section class="motorway" id="motorway"><h2>x</h2></section>';
    expect(liftAmpel(f)).toEqual({ html: f, ampel: null });
    expect(liftAmpel("<p>other</p>")).toEqual({ html: "<p>other</p>", ampel: null });
  });
});

describe("liftAroundAmpel", () => {
  it("takes the position's Ampel out of the around block", () => {
    const amp = renderAmpel("de", "A7", { lamp: "green", reasons: [], scope: { kind: "around", radiusKm: 25, dir: null, onRoad: true }, asOf: NOW, sight: [], noCourse: false }, NOW, { prefix: "ampela" });
    const block = `<section class="mwa" id="motorway-around" aria-labelledby="mwa-h">${amp}<h2 id="mwa-h">x</h2></section>`;
    const l = liftAroundAmpel(block);
    expect(l.ampel).toBe(amp);
    expect(l.html).toBe('<section class="mwa" id="motorway-around" aria-labelledby="mwa-h"><h2 id="mwa-h">x</h2></section>');
  });
});

describe("the swap script (G5.5: it moves nodes, nothing else)", () => {
  const s = ampelSwapScript();
  it("asks nothing, stores nothing, sends nothing", () => {
    expect(s).not.toMatch(/fetch|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|cookie|gtag|dataLayer|history\.|location/);
    expect(s).toContain('addEventListener("vf:loaded"');
  });
  it("#890 + #895: on the main block's swap it lifts the radius's Ampel out of #motorway-main, and the position's Ampel keeps the top", () => {
    expect(s).toContain('addEventListener("vf:main", liftMain)');
    expect(s).toContain('main.querySelector("#motorway-ampel")');
    expect(s).toContain('else if (a && !top.querySelector("#motorway-ampel-around"))');
    // The position's Ampel, when the new block carries one, wins over the radius's.
    expect(s.indexOf('b.querySelector("#motorway-ampel-around")')).toBeLessThan(s.indexOf("if (radius)"));
    // ...and keeps the top while its block is the slot's (a second sync after the same load changes nothing).
    expect(s).toContain("if (from && b === from) return;");
  });
  it("#895 review: the whole road's template is the server's and is never written; 'all of Germany' re-syncs the top", () => {
    expect(s).not.toMatch(/whole\.content\.replaceChildren|whole\.innerHTML|whole\.content\.append/);
    expect(s).toContain('addEventListener("vf:cleared"');
    expect(s).toContain("top.replaceChildren(whole.content.cloneNode(true))");
    const island = readFileSync(new URL("../src/location/island.ts", import.meta.url), "utf8");
    expect(island).toContain('fire("vf:cleared")');
  });
});

describe("the layout", () => {
  const astro = readFileSync(new URL("../src/layouts/MotorwayPage.astro", import.meta.url), "utf8");
  it("puts the Ampel slot above the position bar and the page fragment", () => {
    expect(astro.indexOf('id="ampel-slot"')).toBeLessThan(astro.indexOf("<MotorwayPlace"));
    expect(astro.indexOf("<MotorwayPlace")).toBeLessThan(astro.indexOf('class="wrap motorway-page"'));
  });
  it("styles the lamps from tokens only", () => {
    const css = readFileSync(new URL("../src/styles/site.css", import.meta.url), "utf8");
    const block = css.slice(css.indexOf("#895: the motorway Ampel"));
    expect(block).toContain("var(--lamp-stop)");
    expect(block).toContain("var(--lamp-wait)");
    expect(block).toContain("var(--lamp-go)");
    expect(block).not.toMatch(/:\s*#[0-9a-f]{3,8}\b/i);
  });
});

// #1113: a kept "Ganz Deutschland" on a motorway page — the island empties the slot before this script runs.
describe("the swap script at load, run against a small fake page (#1113)", () => {
  type N = { id: string; kids: N[]; querySelector: (s: string) => N | null; replaceChildren: (n: N) => void; cloneNode: () => N; firstElementChild: N | null; content?: N };
  const node = (id: string, kids: N[] = []): N => {
    const n: N = {
      id,
      kids,
      querySelector: (s: string) => {
        const want = s.replace(/^#/, "");
        const walk = (x: N): N | null => {
          for (const k of x.kids) {
            if (k.id === want) return k;
            const r = walk(k);
            if (r !== null) return r;
          }
          return null;
        };
        return walk(n);
      },
      // a document fragment (the template's content) gives up its children, as in a browser
      replaceChildren: (c: N) => {
        n.kids = c.id === "frag" ? c.kids : [c];
      },
      cloneNode: () => node(n.id, n.kids.map((k) => k.cloneNode())),
      get firstElementChild() {
        return n.kids[0] ?? null;
      },
    };
    return n;
  };
  const page = (slotKids: N[]): { top: N } => {
    const top = node("ampel-slot", [node("motorway-ampel-around")]);
    const whole = node("ampel-whole");
    whole.content = node("frag", [node("motorway-ampel")]);
    const els: Record<string, N> = { "ampel-slot": top, "ampel-whole": whole, "place-slot": node("place-slot", slotKids), "motorway-main": node("motorway-main") };
    const doc = { getElementById: (i: string) => els[i] ?? null, addEventListener: () => undefined };
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- the shipped text, run
    new Function("document", ampelSwapScript())(doc);
    return { top };
  };
  it("an emptied slot: the top shows the whole road's lamp, not the IP position's the server put there", () => {
    const { top } = page([]);
    expect(top.kids.map((k) => k.id)).toEqual(["motorway-ampel"]);
  });
  it("the IP block still in the slot: the position's lamp stays at the top", () => {
    const { top } = page([node("mwa", [node("x")])]);
    expect(top.kids.map((k) => k.id)).toEqual(["motorway-ampel-around"]);
  });
});
