/**
 * 2.4.4 review B2: the charging filter's Apply is in <noscript>, so with scripts on a change must send the form on
 * EVERY page it renders — the motorway page's charging block (no data-card), a place card with no fragment, a card the
 * island swaps in. One rule (`EVF_SUBMIT_JS`), carried by the refresh script for a form it does not re-fetch in place
 * and by the stand-alone `evf` script on a page without the refresh script — RUN here in a VM, the shipped text, and
 * the pages' decision (`needsChargingSubmit`) pinned where each page makes it.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Script, createContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { REFRESH_JS } from "../src/lib/card-refresh.js";
import { EVF_JS, chargingSubmitScript, needsChargingSubmit } from "../src/lib/charging-filter.js";
import { INLINE_SCRIPTS } from "../src/lib/inline-scripts.js";

const src = (...p: string[]): string => readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "src", ...p), "utf8");

type Form = { requested: number; submitted: number; inCard: boolean; requestSubmit?: () => void; closest: (s: string) => unknown };

function form(o: { inCard?: boolean; legacy?: boolean } = {}): Form {
  const f: Form = {
    requested: 0,
    submitted: 0,
    inCard: o.inCard === true,
    closest: (s: string) => (s === "form.evf" ? f : s === "article.pcard[data-card]" && f.inCard ? card : null),
  };
  if (o.legacy !== true) f.requestSubmit = () => void f.requested++;
  (f as unknown as { submit: () => void }).submit = () => void f.submitted++;
  return f;
}
const card = { id: "pcard-charging", getAttribute: () => null, querySelector: () => null };

/** One page in a VM running `code`; `fire` dispatches an event to the document's listeners and says whether it was prevented. */
function run(code: string): { fire: (type: string, target: unknown) => boolean } {
  const listeners = new Map<string, ((e: unknown) => void)[]>();
  const document = {
    documentElement: { lang: "de" },
    hidden: false,
    activeElement: null,
    body: { appendChild: () => undefined },
    addEventListener: (t: string, f: (e: unknown) => void) => listeners.set(t, [...(listeners.get(t) ?? []), f]),
    querySelectorAll: () => [],
    getElementById: () => null,
    createElement: () => ({ setAttribute: () => undefined, style: {} }),
  };
  const ctx = createContext({ document, location: { search: "", pathname: "/de/autobahn/a7", hash: "" }, history: { state: null, replaceState: () => undefined }, FormData: class { get(): null { return null; } getAll(): string[] { return []; } }, WeakMap, Date, Math, setTimeout: () => 0, clearTimeout: () => undefined, setInterval: () => 0 });
  new Script(code).runInContext(ctx);
  return {
    fire: (type, target) => {
      let prevented = false;
      for (const l of listeners.get(type) ?? []) l({ type, target, preventDefault: () => void (prevented = true) });
      return prevented;
    },
  };
}
const control = (f: Form, o: { disabled?: boolean } = {}): unknown => ({ disabled: o.disabled === true, closest: (s: string) => f.closest(s) });

describe("the stand-alone evf script (no refresh script on the page)", () => {
  for (const [name, code] of [["source", `(function () {\n${EVF_JS}\n})();`], ["shipped (minified)", chargingSubmitScript()]] as const) {
    it(`${name}: a change sends the form — inside a card or not — with requestSubmit, else submit`, () => {
      const p = run(code);
      const out = form();
      p.fire("change", control(out));
      expect(out.requested).toBe(1);
      const inCard = form({ inCard: true });
      p.fire("change", control(inCard));
      expect(inCard.requested).toBe(1);
      const legacy = form({ legacy: true });
      p.fire("change", control(legacy));
      expect(legacy.submitted).toBe(1);
    });

    it(`${name}: a disabled box and a control of another form send nothing`, () => {
      const p = run(code);
      const f = form();
      p.fire("change", control(f, { disabled: true }));
      p.fire("change", { disabled: false, closest: () => null });
      expect(f.requested + f.submitted).toBe(0);
    });
  }

  it("the page calls the minified script", () => {
    expect(chargingSubmitScript()).toBe(`(${INLINE_SCRIPTS.evf})();`);
  });
});

describe("the refresh script carries the same rule for a form it does not re-fetch in place", () => {
  it("a change on a form outside a data-card card is sent by the browser, and its submit is not prevented", () => {
    const p = run(`(function () {\n${REFRESH_JS}\n})();`);
    const f = form();
    p.fire("change", control(f));
    expect(f.requested).toBe(1);
    expect(p.fire("submit", f)).toBe(false);
  });

  it("a form inside a data-card card is re-fetched in place, never sent", () => {
    const p = run(`(function () {\n${REFRESH_JS}\n})();`);
    const f = form({ inCard: true });
    // the in-place path prevents the submit; its change is the re-fetch (the refetch suite runs it), not a send
    expect(p.fire("submit", f)).toBe(true);
    expect(f.requested + f.submitted).toBe(0);
  });
});

describe("where the stand-alone script is carried (needsChargingSubmit)", () => {
  const bar = '<form class="tpf evf" method="get" action="#mw-charging">';
  it("never beside the refresh script; else with the form, or where cards are swapped in", () => {
    expect(needsChargingSubmit({ refresh: true, html: bar, swaps: true })).toBe(false);
    expect(needsChargingSubmit({ refresh: false, html: bar, swaps: false })).toBe(true);
    expect(needsChargingSubmit({ refresh: false, html: "<section></section>", swaps: true })).toBe(true);
    expect(needsChargingSubmit({ refresh: false, html: "<section></section>", swaps: false })).toBe(false);
  });

  it("each page decides with it and renders the script on that decision", () => {
    const mw = src("layouts", "MotorwayPage.astro");
    expect(mw).toContain("const evSubmit = needsChargingSubmit({ refresh: false, html, swaps: around !== null });");
    expect(mw).toContain("{evSubmit && <script is:inline set:html={chargingSubmitScript()} />}");
    const st = src("layouts", "StationPage.astro");
    expect(st).toContain("const evSubmit = needsChargingSubmit({ refresh: refreshes, html: head.html, swaps: false });");
    expect(st).toContain("if (refreshes || evSubmit) Astro.locals.hasScript = true;");
    expect(st).toContain("{evSubmit && <script is:inline set:html={chargingSubmitScript()} />}");
    const pb = src("components", "PlaceBlock.astro");
    expect(pb).toContain('const evSubmit = needsChargingSubmit({ refresh: refreshes, html: place?.html ?? "", swaps: true });');
    expect(pb).toContain("{evSubmit && <script is:inline set:html={chargingSubmitScript()} />}");
  });
});
