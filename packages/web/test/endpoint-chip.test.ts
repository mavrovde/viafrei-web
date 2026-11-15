/**
 * #1003: the endpoint chip on every surface that shows the MCP address, and
 * the shell's copy script that enhances it.
 *
 *   - every renderer that prints the address prints it through the ONE chip of
 *     `@viafrei/design` — the connect page, the "connected in 60 seconds" block,
 *     the shell's note, the digest's note and motorway block — and no runtime
 *     file prints it in a `<code>`/`<pre>` of its own;
 *   - every layout that shows a chip declares the copy script, once;
 *   - the script, run against a small fake DOM: it reveals the buttons (also
 *     ones added later), copies the address on a click, shows and announces
 *     the "copied" word, hands the surface to the consent island as an event,
 *     does nothing without a clipboard, and binds once however often it runs.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { C, CONNECT_SOURCES } from "@viafrei/design";
import { all, first, text } from "@viafrei/design/testing";
import { MOTORWAY_EXTRAS_COPY } from "../../../.pinned/app/packages/digest/dist/src/presentation/i18n-motorway-extras.js";
import { MCP_ENDPOINT_URL, askNoteHtml } from "../../../.pinned/app/packages/digest/dist/src/presentation/ask-note.js";
import { t } from "../src/i18n/index.js";
import { connectNoteHtml, endpointChipHtml } from "../src/lib/connect-note.js";
import { COPIED_CLASS, ENDPOINT_COPY_EVENT, endpointCopyScript } from "../src/lib/endpoint-copy.js";
import { MCP_ENDPOINT } from "../src/site/endpoints.js";
import { LIVE_LANGS } from "../src/site/pages.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const read = (p: string): string => readFileSync(join(SRC, p), "utf8");
const DIGEST = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", ".pinned", "app", "packages", "digest", "dist", "src", "presentation");

describe("one chip on every surface that shows the address (#1003)", () => {
  it("the shell's chip and note, in every language: the address, the copy name and the 'copied' word of the page's language", () => {
    for (const lang of LIVE_LANGS) {
      for (const html of [endpointChipHtml(lang, "connect"), connectNoteHtml(lang, "home")]) {
        const chip = first(html, `span.${C.endpointChip}`)!;
        expect(text(first(chip, "code")!), lang).toBe(MCP_ENDPOINT);
        const b = first(chip, "button")!;
        expect(b.attrs["aria-label"], lang).toBe(t(lang, "connectNote.copy"));
        expect(b.attrs["value"], lang).toBe(t(lang, "connectNote.copied"));
        expect("hidden" in b.attrs, lang).toBe(true);
      }
      // a language's own words, never the German ones
      if (lang !== "de") expect(t(lang, "connectNote.copy"), lang).not.toBe(t("de", "connectNote.copy"));
    }
  });

  it("the digest's note carries the chip in every language, in the fragment's words, and the shell's and the digest's words agree", () => {
    for (const lang of LIVE_LANGS) {
      const html = askNoteHtml(lang, "place");
      const chips = all(html, `p.${C.connectNote} span.${C.endpointChip}`);
      expect(chips, lang).toHaveLength(1);
      expect(chips[0]!.attrs["data-cta-source"]).toBe("place");
      expect(text(first(chips[0]!, "code")!), lang).toBe(MCP_ENDPOINT);
      expect(MOTORWAY_EXTRAS_COPY[lang].ask.copy, lang).toBe(t(lang, "connectNote.copy"));
      expect(MOTORWAY_EXTRAS_COPY[lang].ask.copied, lang).toBe(t(lang, "connectNote.copied"));
      expect(html, lang).not.toMatch(/<script/u);
    }
    expect(MCP_ENDPOINT_URL).toBe(MCP_ENDPOINT);
  });

  it("the connect page and the 'connected in 60 seconds' block print the address through the chip, and no runtime file prints it any other way", () => {
    expect(read("layouts/ConnectPage.astro")).toContain('set:html={endpointChipHtml(lang, "connect")}');
    expect(read("components/Start.astro")).toContain("set:html={endpointChipHtml(lang, source)}");
    for (const f of ["layouts/ConnectPage.astro", "components/Start.astro", "components/Hero.astro", "components/Footer.astro"]) expect(read(f), f).not.toContain("{MCP_ENDPOINT}");
    const extras = readFileSync(join(DIGEST, "motorway-extras-html.js"), "utf8");
    expect(extras).toContain('${endpointChipOf(lang, "motorway")}');
    expect(extras).not.toMatch(/safe\(MCP_ENDPOINT_URL\)/u);
  });

  it("every layout that shows a chip carries the copy script once; every surface word is one the analytics list knows", () => {
    for (const f of ["Home", "PlacePage", "MotorwayPage", "ConnectPage", "ExamplesPage", "BusinessPage"]) {
      const src = read(`layouts/${f}.astro`);
      expect(src.match(/<EndpointCopy \/>/gu), f).toHaveLength(1);
    }
    expect(read("components/EndpointCopy.astro")).toContain("Astro.locals.hasScript = true;");
    expect(read("layouts/MotorwayPage.astro")).not.toContain("motorwayCopyScript");
    for (const s of CONNECT_SOURCES) expect(first(endpointChipHtml("de", s), `span.${C.endpointChip}`)!.attrs["data-cta-source"]).toBe(s);
  });
});

// --- the copy script, against a fake DOM ------------------------------------------------------------------------

type FakeEl = {
  hidden: boolean;
  value: string;
  textContent: string;
  readonly attrs: Record<string, string>;
  readonly classes: Set<string>;
  readonly kids: FakeEl[];
  parent: FakeEl | null;
  readonly sel: readonly string[];
  readonly nodeType: 1;
  matches(s: string): boolean;
  querySelector(s: string): FakeEl | null;
  querySelectorAll(s: string): FakeEl[];
  closest(s: string): FakeEl | null;
  getAttribute(n: string): string | null;
  classList: { add(c: string): void; remove(c: string): void };
  vfT?: unknown;
};

function el(sel: readonly string[], attrs: Record<string, string> = {}, textContent = "", kids: FakeEl[] = []): FakeEl {
  const e: FakeEl = {
    hidden: "hidden" in attrs,
    value: attrs["value"] ?? "",
    textContent,
    attrs,
    classes: new Set(),
    kids,
    parent: null,
    sel,
    nodeType: 1,
    matches: (s) => e.sel.includes(s),
    querySelector: (s) => e.querySelectorAll(s)[0] ?? null,
    querySelectorAll: (s) => e.kids.flatMap((k) => [...(k.matches(s) ? [k] : []), ...k.querySelectorAll(s)]),
    closest: (s) => (e.matches(s) ? e : (e.parent?.closest(s) ?? null)),
    getAttribute: (n) => e.attrs[n] ?? null,
    classList: { add: (c) => e.classes.add(c), remove: (c) => e.classes.delete(c) },
  };
  for (const k of kids) k.parent = e;
  return e;
}

/** A chip as the design system draws it, as far as the script reads it. */
function chip(source: string): { root: FakeEl; button: FakeEl; status: FakeEl } {
  const button = el([`.${C.endpointChipCopy}`], { value: "Kopiert", hidden: "" });
  const status = el(['[role="status"]'], { role: "status" });
  const code = el(["code"], {}, "https://mcp.viafrei.de/mcp");
  const root = el([`.${C.endpointChip}`], { "data-cta-source": source }, "", [code, button, status]);
  return { root, button, status };
}

function run(opts: { clipboard: boolean; chips: FakeEl[] }) {
  const listeners: Record<string, ((e: unknown) => unknown)[]> = {};
  const observers: ((m: unknown[]) => void)[] = [];
  const copied: string[] = [];
  const events: { type: string; detail: unknown }[] = [];
  const body = el(["body"], {}, "", opts.chips);
  const document = {
    body,
    querySelectorAll: (s: string) => body.querySelectorAll(s),
    addEventListener: (t: string, f: (e: unknown) => unknown) => (listeners[t] ??= []).push(f),
    dispatchEvent: (e: { type: string; detail: unknown }) => events.push(e),
  };
  class FakeElement {}
  Object.setPrototypeOf(body, FakeElement.prototype);
  const markElement = (e: FakeEl): void => {
    Object.setPrototypeOf(e, FakeElement.prototype);
    e.kids.forEach(markElement);
  };
  opts.chips.forEach(markElement);
  const window: Record<string, unknown> = {};
  const navigator = opts.clipboard ? { clipboard: { writeText: (s: string): Promise<void> => (copied.push(s), Promise.resolve()) } } : {};
  class MutationObserver {
    constructor(private readonly f: (m: unknown[]) => void) {}
    observe(): void {
      observers.push(this.f);
    }
  }
  class CustomEvent {
    constructor(
      readonly type: string,
      readonly init: { detail: unknown },
    ) {}
    get detail(): unknown {
      return this.init.detail;
    }
  }
  const timers: (() => void)[] = [];
  const exec = (): void => {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- running the shipped script is the point
    new Function("window", "document", "navigator", "MutationObserver", "CustomEvent", "Element", "setTimeout", "clearTimeout", endpointCopyScript())(
      window,
      document,
      navigator,
      MutationObserver,
      CustomEvent,
      FakeElement,
      (f: () => void) => timers.push(f),
      () => undefined,
    );
  };
  const click = async (target: FakeEl): Promise<void> => {
    for (const f of listeners["click"] ?? []) await f({ target });
  };
  const add = (c: FakeEl): void => {
    markElement(c);
    for (const f of observers) f([{ addedNodes: [c] }]);
  };
  return { exec, click, add, copied, events, listeners, timers };
}

describe("the copy script (#1003)", () => {
  it("reveals every chip's button, copies the address on a click, shows and announces 'copied', and hands the surface to the consent island", async () => {
    const a = chip("connect");
    const r = run({ clipboard: true, chips: [a.root] });
    r.exec();
    expect(a.button.hidden).toBe(false);
    await r.click(a.button);
    expect(r.copied).toEqual(["https://mcp.viafrei.de/mcp"]);
    expect(a.root.classes.has(COPIED_CLASS)).toBe(true);
    expect(a.status.textContent).toBe("Kopiert");
    expect(r.events.map((e) => [e.type, e.detail])).toEqual([[ENDPOINT_COPY_EVENT, { surface: "connect" }]]);
    // the state goes after its timer, and the status is emptied again
    for (const f of r.timers) f();
    expect(a.root.classes.has(COPIED_CLASS)).toBe(false);
    expect(a.status.textContent).toBe("");
  });

  it("a chip added later (a filled panel, a swapped main block) is revealed and copies through the same one listener", async () => {
    const r = run({ clipboard: true, chips: [] });
    r.exec();
    const b = chip("motorway");
    r.add(b.root);
    expect(b.button.hidden).toBe(false);
    await r.click(b.button);
    expect(r.copied).toEqual(["https://mcp.viafrei.de/mcp"]);
    expect(r.listeners["click"]).toHaveLength(1);
  });

  it("without a clipboard it reveals nothing and listens to nothing: the address stays plain selectable text", () => {
    const a = chip("home");
    const r = run({ clipboard: false, chips: [a.root] });
    r.exec();
    expect(a.button.hidden).toBe(true);
    expect(r.listeners["click"]).toBeUndefined();
  });

  it("runs once however often it is emitted, and a click elsewhere copies nothing", async () => {
    const a = chip("home");
    const r = run({ clipboard: true, chips: [a.root] });
    r.exec();
    r.exec();
    expect(r.listeners["click"]).toHaveLength(1);
    await r.click(a.status);
    expect(r.copied).toEqual([]);
    expect(r.events).toEqual([]);
  });

  it("makes no request and names no analytics call: the consent island alone may send", () => {
    const js = endpointCopyScript();
    expect(js).not.toMatch(/fetch\(|XMLHttpRequest|sendBeacon|gtag|dataLayer|localStorage/u);
    expect(js).toContain(ENDPOINT_COPY_EVENT);
    expect(read("components/Consent.svelte")).toContain("document.addEventListener(ENDPOINT_COPY_EVENT, (ev) => send(copyEvent(");
  });
});
