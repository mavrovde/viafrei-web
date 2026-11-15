/**
 * #1088: the place headline — what the address may ask for (`?scope=de`, `?at=`), what the home renders for it without
 * an IP lookup, and the headline's script (`PLACEHEAD_JS`) run as shipped against a small fake document: which radio of
 * "Bereich" is on, the IP guess's confirm row, "aktualisiert für X", the keys of the radio group.
 */
import { describe, expect, it } from "vitest";
import { placeHeadScript, placeScopeOf, scopeHrefs, PLACEHEAD_JS } from "../src/lib/place-scope.js";
import { homePlace } from "../src/location/server.js";
import type { GeoIp } from "../src/location/geoip.js";
import type { FetchLike } from "../src/lib/tiles.js";
import { LIVE_LANGS } from "../src/site/pages.js";
import { t } from "../src/i18n/index.js";
import { minifyInline } from "../scripts/inline-min.js";

describe("what the address may ask for (#1088 design § 4: no address in any URL)", () => {
  it("?scope=de is Germany, and wins over ?at=", () => {
    expect(placeScopeOf(new URLSearchParams("scope=de"))).toEqual({ kind: "germany" });
    expect(placeScopeOf(new URLSearchParams("scope=de&at=ags:05315000"))).toEqual({ kind: "germany" });
  });
  it("?at= takes a Gemeinde, a district, a postcode or a point of interest — never a point, which is a person's position", () => {
    for (const at of ["ags:05315000", "dst:2891122", "plz:34121", "poi:418230", "slug:kassel"]) expect(placeScopeOf(new URLSearchParams({ at })), at).toEqual({ kind: "at", at });
    for (const at of ["pt:51.3,9.4725", "plz:00000", "plz:3412", "dst:0", "poi:0", "poi:abc", "Wilhelmshöher Allee 100", "ags:0531500"]) expect(placeScopeOf(new URLSearchParams({ at })), at).toEqual({ kind: "none" });
  });
  it("the two radios' no-script targets: the place's own page (or this page) and this page with ?scope=de", () => {
    expect(scopeHrefs("/de", "/de/place/kassel")).toEqual({ place: "/de/place/kassel", germany: "/de?scope=de" });
    expect(scopeHrefs("/de/motorway/a7", null)).toEqual({ place: "/de/motorway/a7", germany: "/de/motorway/a7?scope=de" });
  });
});

describe("the home's first render for the address's choice (#1088)", () => {
  let lookups = 0;
  const geo: GeoIp = {
    release: "test",
    lookup: () => {
      lookups += 1;
      return { country: "DE", lat: 50.94, lon: 6.96 };
    },
    close: () => undefined,
  };
  const req = { get: (n: string) => (n === "x-forwarded-for" ? "192.0.2.77" : n === "user-agent" ? "Mozilla/5.0" : null) };
  const digest =
    (asked: string[]): FetchLike =>
    (url) => {
      asked.push(url);
      return Promise.resolve({
        status: 200,
        headers: { get: (n: string) => ({ "content-type": "text/html; charset=utf-8", "place-key": "pt:51.31,9.4725", "place-label": encodeURIComponent("Kassel-Wehlheiden · 34121"), "place-point": "1" })[n] ?? null },
        text: () => Promise.resolve('<section class="place" id="place-cards"><h2>Kassel</h2></section>'),
      });
    };
  it("?scope=de looks nothing up and asks the digest nothing: Germany, no DB-IP line", async () => {
    lookups = 0;
    const asked: string[] = [];
    const r = await homePlace(req, "de", { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: digest(asked), geoipFile: undefined, geo, url: "https://viafrei.de/de?scope=de" });
    expect(r).toEqual({ source: "germany", place: null, usedGeoIp: false });
    expect(lookups).toBe(0);
    expect(asked).toEqual([]);
  });
  it("?at=dst:… renders that district's cards with no IP lookup, headed by what was picked", async () => {
    lookups = 0;
    const asked: string[] = [];
    const r = await homePlace(req, "de", { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: digest(asked), geoipFile: undefined, geo, url: "https://viafrei.de/de?at=dst%3A2891122" });
    expect(r.source).toBe("chosen");
    expect(r.place?.label).toBe("Kassel-Wehlheiden · 34121");
    expect(r.usedGeoIp).toBe(false);
    expect(lookups).toBe(0);
    expect(asked).toHaveLength(1);
    expect(asked[0]).toContain(`at=${encodeURIComponent("dst:2891122")}&`);
  });
  it("?at=pt:… is ignored: a point never comes from an address; the IP rung answers as before", async () => {
    lookups = 0;
    const asked: string[] = [];
    const r = await homePlace(req, "de", { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: digest(asked), geoipFile: undefined, geo, url: "https://viafrei.de/de?at=pt%3A51.31%2C9.4725" });
    expect(r.source).toBe("ip");
    expect(lookups).toBe(1);
    expect(asked.join(" ")).not.toContain("pt%3A51.31%2C9.4725");
  });
});

type El = { id: string; textContent: string; attrs: Record<string, string>; listeners: Record<string, ((e: unknown) => void)[]>; focused: number; clicked: number; innerHTML: string };
const el = (id: string): El => ({ id, textContent: "", attrs: {}, listeners: {}, focused: 0, clicked: 0, innerHTML: "" });

function fakeDoc(ids: readonly string[]): { doc: Record<string, unknown>; els: Record<string, El>; fire: (type: string, detail: unknown) => void; active: { el: El | null } } {
  const els = Object.fromEntries(ids.map((i) => [i, el(i)]));
  const docListeners: Record<string, ((e: unknown) => void)[]> = {};
  const active: { el: El | null } = { el: null };
  for (const e of Object.values(els)) {
    Object.assign(e, {
      getAttribute(this: El, n: string) {
        return this.attrs[n] ?? null;
      },
      setAttribute(this: El, n: string, v: string) {
        this.attrs[n] = v;
      },
      removeAttribute(this: El, n: string) {
        delete this.attrs[n];
      },
      addEventListener(this: El, t: string, fn: (e: unknown) => void) {
        (this.listeners[t] ??= []).push(fn);
      },
      focus(this: El) {
        this.focused += 1;
        active.el = this;
      },
      click(this: El) {
        this.clicked += 1;
      },
      querySelectorAll: () => [],
    });
  }
  const doc = {
    getElementById: (i: string) => els[i] ?? null,
    addEventListener: (t: string, fn: (e: unknown) => void) => void (docListeners[t] ??= []).push(fn),
    get activeElement() {
      return active.el;
    },
  };
  const fire = (type: string, detail: unknown): void => {
    for (const fn of docListeners[type] ?? []) fn({ detail });
  };
  return { doc, els, fire, active };
}

const IDS = ["place-de-note", "place-pill", "place-scope-de", "place-pill-how", "place-upd", "place-confirm", "place-cyes", "place-cother", "place-head", "place-hq", "place-hresults", "place-scope"];
const runHead = (doc: Record<string, unknown>, state: { ip: boolean; at: boolean; label: string | null }): void => {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- running the shipped script is the point
  new Function("document", "window", placeHeadScript("de", state))(doc, {});
};

describe("the headline's script, as shipped (#1088)", () => {
  it("is printed minified from this very source, inside a small budget in every language", () => {
    const printed = placeHeadScript("de", { ip: true, at: true, label: "Köln" });
    expect(printed.startsWith(`(${minifyInline(`(${PLACEHEAD_JS})`)})(`)).toBe(true);
    for (const lang of LIVE_LANGS) expect(placeHeadScript(lang, { ip: true, at: true, label: "Kassel-Wehlheiden · 34121" }).length, lang).toBeLessThan(4_000);
    expect(placeHeadScript("de", { ip: false, at: true, label: "</script><b>" })).not.toContain("</script");
  });
  it("shows the search (hidden without script) and the IP guess's confirm row; 'Ja' confirms, stores nothing, and the source line says so", () => {
    const { doc, els } = fakeDoc(IDS);
    els["place-head"]!.attrs["hidden"] = "";
    els["place-confirm"]!.attrs["hidden"] = "";
    runHead(doc, { ip: true, at: true, label: "Köln" });
    expect(els["place-head"]!.attrs["hidden"]).toBeUndefined();
    expect(els["place-confirm"]!.attrs["hidden"]).toBeUndefined();
    for (const fn of els["place-cyes"]!.listeners["click"] ?? []) fn({});
    expect(els["place-confirm"]!.attrs["hidden"]).toBe("");
    expect(els["place-pill-how"]!.textContent).toBe(t("de", "place.head.confirmed"));
  });
  it("'Anderer Ort' hides the row and puts the cursor in the search", () => {
    const { doc, els } = fakeDoc(IDS);
    runHead(doc, { ip: true, at: true, label: "Köln" });
    for (const fn of els["place-cother"]!.listeners["click"] ?? []) fn({});
    expect(els["place-confirm"]!.attrs["hidden"]).toBe("");
    expect(els["place-hq"]!.focused).toBe(1);
  });
  it("no confirm row for a chosen place", () => {
    const { doc, els } = fakeDoc(IDS);
    els["place-confirm"]!.attrs["hidden"] = "";
    runHead(doc, { ip: false, at: true, label: "Köln" });
    expect(els["place-confirm"]!.attrs["hidden"]).toBe("");
  });
  it("follows the island: the radio that is on, 'aktualisiert für X' on every change and only on a change (AC 4, 6)", () => {
    const { doc, els, fire } = fakeDoc(IDS);
    runHead(doc, { ip: true, at: true, label: "Köln" });
    fire("vf:place", { label: "Köln", how: "ip" });
    expect(els["place-upd"]!.textContent).toBe("");
    fire("vf:place", { label: null, how: "none" });
    expect(els["place-pill"]!.attrs["aria-checked"]).toBe("false");
    expect(els["place-scope-de"]!.attrs["aria-checked"]).toBe("true");
    expect(els["place-scope-de"]!.attrs["tabindex"]).toBe("0");
    expect(els["place-upd"]!.textContent).toBe("aktualisiert für Ganz Deutschland");
    // owner 2026-10-27: the emptied place slot says why, and where the nationwide figures are
    expect(els["place-de-note"]!.attrs["hidden"]).toBeUndefined();
    expect(els["place-pill-how"]!.textContent).toBe(t("de", "place.head.germanyHow"));
    fire("vf:place", { label: "Kassel-Wehlheiden · 34121", how: "manual" });
    expect(els["place-pill"]!.attrs["aria-checked"]).toBe("true");
    expect(els["place-scope-de"]!.attrs["tabindex"]).toBe("-1");
    expect(els["place-upd"]!.textContent).toBe("aktualisiert für Kassel-Wehlheiden · 34121");
    expect(els["place-de-note"]!.attrs["hidden"]).toBe("");
    expect(els["place-confirm"]!.attrs["hidden"]).toBe("");
  });
  it("#1153: no echo any more — the headline IS the header's, on every page, so the script writes no second copy of it", () => {
    expect(PLACEHEAD_JS).not.toMatch(/site-place/);
    const { doc, els, fire } = fakeDoc([...IDS, "site-place"]);
    els["site-place"]!.attrs["hidden"] = "";
    runHead(doc, { ip: false, at: true, label: "Köln" });
    fire("vf:place", { label: "Bonn", how: "manual" });
    expect(els["site-place"]!.attrs["hidden"]).toBe("");
    expect(els["site-place"]!.textContent).toBe("");
  });
  describe("#1098: the first render, before the island says anything", () => {
    const start = (state: { ip: boolean; at: boolean; label: string | null }, lang: "de" | "en" = "de") => {
      const { doc, els, fire } = fakeDoc(IDS);
      for (const id of ["place-upd", "place-confirm"]) els[id]!.attrs["hidden"] = "";
      // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- running the shipped script is the point
      new Function("document", "window", placeHeadScript(lang, state))(doc, {});
      return { els, fire };
    };
    it("an address (?at=): no 'aktualisiert für', no confirm row", () => {
      const { els } = start({ ip: false, at: true, label: "Kassel-Wehlheiden · 34121" });
      expect(els["place-upd"]!.attrs["hidden"]).toBe("");
      expect(els["place-confirm"]!.attrs["hidden"]).toBe("");
    });
    it("an IP guess: the confirm row shows exactly as before (it always did for a guess), no update line", () => {
      const { els } = start({ ip: true, at: true, label: "Köln" }, "en");
      expect(els["place-confirm"]!.attrs["hidden"]).toBeUndefined();
      expect(els["place-upd"]!.attrs["hidden"]).toBe("");
    });
    it("a remembered place the island then shows brings the update line", () => {
      const { els, fire } = start({ ip: true, at: true, label: "Köln" });
      fire("vf:place", { label: "Bonn", how: "saved" });
      expect(els["place-upd"]!.textContent).toBe("aktualisiert für Bonn");
      expect(els["place-upd"]!.attrs["hidden"]).toBeUndefined();
    });
  });
  it("a plain place event sets the radios", () => {
    const { doc, els, fire } = fakeDoc(IDS);
    runHead(doc, { ip: false, at: true, label: "Köln" });
    fire("vf:place", { label: "Köln", how: "manual" });
    expect(els["place-pill"]!.attrs["aria-checked"]).toBe("true");
  });
  it("an arrow key in the group moves to the other radio and selects it", () => {
    const { doc, els, active } = fakeDoc(IDS);
    runHead(doc, { ip: false, at: true, label: "Köln" });
    active.el = els["place-pill"]!;
    let stopped = 0;
    for (const fn of els["place-scope"]!.listeners["keydown"] ?? []) fn({ key: "ArrowRight", preventDefault: () => void (stopped += 1) });
    expect(stopped).toBe(1);
    expect(els["place-scope-de"]!.clicked).toBe(1);
    expect(els["place-scope-de"]!.focused).toBe(1);
  });
  it("names its words in every language (the copy deck carries them, none empty)", () => {
    for (const lang of LIVE_LANGS) for (const k of ["live", "scope", "search", "searchHint", "locate", "confirmQ", "yes", "other", "confirmed", "updated", "outside", "germanyHow", "germanyNote"] as const) expect(t(lang, `place.head.${k}`, { place: "X" }).length, `${lang} ${k}`).toBeGreaterThan(0);
    for (const lang of LIVE_LANGS) expect(t(lang, "place.head.updated", { place: "X" }), lang).toContain("X");
  });
});
