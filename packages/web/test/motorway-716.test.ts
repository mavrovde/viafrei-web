/**
 * The motorway pages' shell side of #716 (2.1.15): the static register's copy
 * (G3/G7), the page view of a canonical path only (G3), no event inside the
 * live blocks (G4), G5 as amended 2026-10-21 for #890 (a position on the page,
 * none of it to Google), the filter form's CSP (M30), the person's choice in the
 * address, and the deferred fuel fragment's headers, gate and off switch
 * (steward M16 a–h).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LAYER_IDS } from "@viafrei/digest";
import { MOTORWAY_REGISTER as INGEST_REGISTER } from "@viafrei/ingest";
import { describe, expect, it } from "vitest";
import { cleanLocation, clickEvent, factsOf, LIVE_BLOCKS, pageView } from "../src/analytics/listener.js";
import { aroundFirstRender, motorwayAroundOn } from "../src/lib/motorway-around.js";
import { islandScript, type IslandConfig } from "../src/location/island.js";
import { islandLabels } from "../src/location/labels.js";
import { MOTORWAY_FUEL_FRAGMENT_ON, MOTORWAY_FUEL_HEADERS, MOTORWAY_FUEL_PATH, fuelAskOf, fuelQuery, isFuelFragment, motorwayFuelRoute, motorwayFuelScript } from "../src/lib/motorway-fuel.js";
import { type PostLike } from "../src/lib/fuel-refresh.js";
import { MOTORWAY_FORM_MARK, MOTORWAY_LAYERS, MOTORWAY_SEARCH_FORM_MARK, carriesMotorwayForm, motorwayChoice, motorwayIndexChoice, motorwayViewQuery } from "../src/lib/motorway.js";
import { contentSecurityPolicy } from "../src/security/csp.js";
import { MOTORWAY_REGISTER, motorwayPageAt, motorwayPath } from "../src/site/motorways.js";
import { LIVE_LANGS } from "../src/site/pages.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const NONCE = "abcdefghijklmnopqrstuv";

describe("the static motorway register's copy (G3, G7)", () => {
  it("equals @viafrei/ingest's MOTORWAY_REGISTER in both directions, in the same order", () => {
    expect([...MOTORWAY_REGISTER]).toEqual([...INGEST_REGISTER]);
    expect(MOTORWAY_REGISTER.length).toBeGreaterThanOrEqual(100);
  });

  it("motorwayPageAt answers only the canonical path of a register road", () => {
    for (const l of LIVE_LANGS) for (const r of ["A1", "A7", "A995"]) expect(motorwayPageAt(motorwayPath(l, r))).toEqual({ road: r, lang: l });
    for (const p of ["/de/autobahn/A7", "/de/motorway/a7", "/en/motorway/a7", "/de/autobahn/a07", "/de/autobahn/a999", "/de/autobahn/a7/", "/de/autobahn/a7?from=1", "/de/autobahn"]) expect(motorwayPageAt(p), p).toBeNull();
  });

  it("the layer names the site sends are the digest's (LAYER_IDS)", () => {
    expect([...MOTORWAY_LAYERS]).toEqual([...LAYER_IDS]);
  });
});

describe("what may reach Google from a motorway page (G3, G4)", () => {
  it("a page view names the canonical motorway path and the language — never the query or the hash", () => {
    expect(pageView("/de/autobahn/a7", "de")).toEqual({ name: "page_view", params: { route: "/de/autobahn/a7", lang: "de" } });
    expect(pageView("/en/autobahn/a7?f=1&layer=events#mw-w0", "en")).toEqual({ name: "page_view", params: { route: "/en/autobahn/a7", lang: "en" } });
    // #892: a stretch below the page is a view of the motorway's page — never its junction names
    expect(pageView("/de/autobahn/a7/nesselwang-to-kempten/towards-wuerzburg", "de")).toEqual({ name: "page_view", params: { route: "/de/autobahn/a7", lang: "de" } });
    expect(pageView("/de/autobahn/a999/x-to-y", "de").params.route).toBe("/");
    // a road not on the register, a spelling and the other word are the generic route, never a raw path
    expect(pageView("/de/autobahn/a999", "de").params.route).toBe("/");
    expect(pageView("/de/autobahn/A7", "de").params.route).toBe("/");
    expect(pageView("/en/motorway/a7", "en").params.route).toBe("/");
  });

  it("page_location and page_referrer are origin and path only", () => {
    expect(cleanLocation("https://viafrei.de/de/autobahn/a7?from=20010&to=20040&dir=neg&f=1&layer=parking#mw-w0")).toBe("https://viafrei.de/de/autobahn/a7");
    // #892: a stretch path is reported as its motorway's page, never with its junction names
    expect(cleanLocation("https://viafrei.de/de/autobahn/a7/nesselwang-to-kempten/towards-wuerzburg?f=1#mw-w0")).toBe("https://viafrei.de/de/autobahn/a7");
    expect(cleanLocation("https://viafrei.de/en/autobahn/a7/towards-flensburg")).toBe("https://viafrei.de/en/autobahn/a7");
    expect(cleanLocation("https://www.example.org/search?q=a7+stau#top")).toBe("https://www.example.org/search");
    expect(cleanLocation("")).toBe("");
    expect(cleanLocation("not a url")).toBe("");
    const consent = readFileSync(join(SRC, "components", "Consent.svelte"), "utf8");
    expect(consent).toContain("send_page_view: false, page_location: cleanLocation(window.location.href), page_referrer: cleanLocation(document.referrer)");
    // the one page_view is the listener's, sent with the pathname alone
    expect(consent).toContain("send(pageView(window.location.pathname, lang));");
  });

  it("no click inside the motorway page's body (its live blocks and the fuel fragment) is an event", () => {
    expect(LIVE_BLOCKS.split(",").map((s) => s.trim())).toEqual([".tile", ".motorway-page", ".placebar--motorway", ".mwa"]);
    const inside = { getAttribute: (n: string) => (n === "href" ? "/de/connect" : null), closest: (sel: string) => (sel === LIVE_BLOCKS ? {} : null) };
    expect(factsOf(inside).insideTile).toBe(true);
  });

  it("the motorway page has no automatic reload (G4)", () => {
    const page = readFileSync(join(SRC, "layouts", "MotorwayPage.astro"), "utf8");
    expect(page).not.toMatch(/refresh=|refreshTo=/);
  });
});

/*
 * G5 as amended 2026-10-21 (#890, data-sources skill G5.1–G5.12): the motorway pages stay measured AND carry the
 * home's location ladder — and nothing about the position reaches Google. Driven with the switch ON. G5.7 (the GA
 * property's enhanced measurement) and G5.12 (the prod network log) are reads on production and cannot be pinned here.
 */
type El = {
  attrs: Record<string, string>;
  textContent: string;
  innerHTML: string;
  classList: { add(): void; remove(): void };
  offsetWidth: number;
  setAttribute(n: string, v: string): void;
  getAttribute(n: string): string | null;
  removeAttribute(n: string): void;
  addEventListener(): void;
  focus(): void;
  querySelectorAll(): unknown[];
};
const elOf = (): El => ({
  attrs: {},
  textContent: "",
  innerHTML: "",
  classList: { add: () => undefined, remove: () => undefined },
  offsetWidth: 0,
  setAttribute(n, v) {
    this.attrs[n] = v;
  },
  getAttribute(n) {
    return this.attrs[n] ?? null;
  },
  removeAttribute(n) {
    delete this.attrs[n];
  },
  addEventListener: () => undefined,
  focus: () => undefined,
  querySelectorAll: () => [],
});
type Seen = {
  dispatched: string[];
  writes: string[];
  posts: { url: string; method: string; body: string }[];
  replaced: string[];
  listeners: Record<string, ((e: unknown) => void)[]>;
  root: El;
  title: string;
};
/** A browser just big enough for the island on a motorway page: what it dispatched, wrote, posted and set on the root. */
function motorwayBrowser(o: { permission: "granted" | "prompt" | "denied"; stored?: Record<string, unknown> }): { win: Record<string, unknown>; seen: Seen } {
  const ids = ["place-pill", "place-pill-label", "place-pill-how", "place-live", "place-slot", "place-kept", "place-kept-forget", "place-geo-msg"];
  const els: Record<string, El> = Object.fromEntries(ids.map((i) => [i, elOf()]));
  const store = new Map(Object.entries(o.stored ?? {}).map(([k, v]) => [k, JSON.stringify(v)]));
  const seen: Seen = { dispatched: [], writes: [], posts: [], replaced: [], listeners: {}, root: elOf(), title: "Static title" };
  const doc = {
    getElementById: (i: string) => els[i] ?? null,
    documentElement: seen.root,
    activeElement: null,
    get title(): string {
      return seen.title;
    },
    set title(v: string) {
      seen.title = v;
    },
    createElement: () => elOf(),
    dispatchEvent: (e: { type: string }) => {
      seen.dispatched.push(e.type);
      return true;
    },
    addEventListener: (t: string, fn: (e: unknown) => void) => {
      (seen.listeners[t] ??= []).push(fn);
    },
  };
  const win = {
    Date: { now: () => Date.UTC(2026, 9, 21, 12) },
    document: doc,
    location: { pathname: "/de/autobahn/a7", search: "", hash: "", assign: () => undefined },
    history: { state: null, replaceState: (_s: unknown, _t: string, url: string) => void seen.replaced.push(url) },
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        seen.writes.push(`set ${k}`);
        store.set(k, v);
      },
      removeItem: (k: string) => {
        seen.writes.push(`del ${k}`);
        store.delete(k);
      },
    },
    CustomEvent: class {
      constructor(
        public type: string,
        public init?: unknown,
      ) {}
    },
    matchMedia: () => ({ matches: true }),
    setTimeout: (fn: () => void, ms: number) => (ms > 1000 ? 0 : setTimeout(fn, 0)),
    clearTimeout: () => undefined,
    navigator: {
      permissions: { query: () => Promise.resolve({ state: o.permission }) },
      geolocation: { getCurrentPosition: (ok: (p: unknown) => void) => ok({ coords: { latitude: 51.312345, longitude: 9.487654, accuracy: 20 } }) },
    },
    fetch: (url: string, init: { method: string; body: string }) => {
      seen.posts.push({ url, method: init.method, body: init.body });
      const at = (JSON.parse(init.body) as { at: string }).at;
      const headers: Record<string, string> = { "place-key": at, "place-label": encodeURIComponent("Kassel") };
      const block = '<section class="mwa" id="motorway-around"><a href="https://www.openstreetmap.org/?mlat=51.31000&amp;mlon=9.48750">Karte</a></section>';
      return Promise.resolve({ status: 200, headers: { get: (n: string) => headers[n] ?? null }, text: () => Promise.resolve(block) });
    },
  };
  return { win, seen };
}
const settleAll = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
};
const runScript = async (b: { win: Record<string, unknown> }, c: IslandConfig): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- the very text the page carries
  new Function("window", islandScript(c))(b.win);
  await settleAll();
};
const onMotorway = (server: IslandConfig["server"]): IslandConfig => ({ lang: "de", server, labels: islandLabels("de"), cell: { lat: 0, lon: 0 }, around: { road: "A7", r: 25 } });
const radius = async (b: { seen: Seen }, r: number): Promise<void> => {
  for (const fn of b.seen.listeners["vf:radius"] ?? []) fn({ detail: { r } });
  await settleAll();
};
const NOWHERE: IslandConfig["server"] = { source: "none", at: null, label: null };
const RUNGS: readonly { name: string; browser: () => ReturnType<typeof motorwayBrowser>; server: IslandConfig["server"] }[] = [
  { name: "the IP rung (server-rendered cell)", browser: () => motorwayBrowser({ permission: "prompt" }), server: { source: "ip", at: "pt:51.31,9.4875", label: "Kassel" } },
  { name: "a standing browser grant", browser: () => motorwayBrowser({ permission: "granted" }), server: NOWHERE },
  {
    name: "a remembered place",
    browser: () => motorwayBrowser({ permission: "prompt", stored: { "viafrei.place": { at: "pt:51.31,9.4875", label: "Kassel", how: "browser", m: 2026 * 12 + 9 } } }),
    server: NOWHERE,
  },
  { name: "no position", browser: () => motorwayBrowser({ permission: "prompt" }), server: NOWHERE },
];
const readSrc = (...rel: string[]): string => readFileSync(join(SRC, ...rel), "utf8");
const DIGEST = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", ".pinned", "app", "packages", "digest", "dist", "src");

describe("G5 as amended 2026-10-21 (#890): a measured motorway page with a position, the switch ON", () => {
  it("#901 review 10: a script that starts late asks the island where it stands (vf:pos-ask) and is answered with a vf:pos — nothing in the DOM", async () => {
    const want: Record<string, boolean> = { "the IP rung (server-rendered cell)": false, "a standing browser grant": true, "no position": false };
    for (const r of RUNGS) {
      const b = r.browser();
      await runScript(b, onMotorway(r.server));
      // the answer, read off the event the island dispatches
      const doc = b.win["document"] as { dispatchEvent: (e: { type: string; init?: { detail?: { on?: boolean } } }) => boolean };
      const answers: (boolean | undefined)[] = [];
      doc.dispatchEvent = (e) => {
        if (e.type === "vf:pos") answers.push(e.init?.detail?.on);
        return true;
      };
      const ask = b.seen.listeners["vf:pos-ask"] ?? [];
      expect(ask, r.name).toHaveLength(1);
      ask[0]!({ type: "vf:pos-ask" });
      expect(answers, r.name).toHaveLength(1);
      expect(typeof answers[0], r.name).toBe("boolean");
      if (want[r.name] !== undefined) expect(answers[0], r.name).toBe(want[r.name]);
      // no marker on the root: a root data-vf-* is an analytics input on this site
      expect(Object.keys(b.seen.root.attrs).filter((k) => k !== "data-vf-location"), r.name).toEqual([]);
      expect(b.seen.writes, r.name).not.toContain("set vf:pos");
    }
    // the page's radius script listens first, then asks; it reads no attribute for the state
    const place = readSrc("components", "MotorwayPlace.astro");
    const listen = place.indexOf('document.addEventListener("vf:pos"');
    const askAt = place.indexOf('document.dispatchEvent(new CustomEvent("vf:pos-ask"))');
    expect(listen).toBeGreaterThan(0);
    expect(askAt).toBeGreaterThan(listen);
    expect(place).not.toContain("data-vf-pos");
  });

  it("#901 review: no element carries data-vf-pos, and the analytics read no position marker but the data-vf-location rule", () => {
    const files = [readSrc("location", "island.ts"), readSrc("components", "MotorwayPlace.astro"), readSrc("components", "Consent.svelte"), readSrc("analytics", "listener.ts"), readSrc("layouts", "Base.astro"), readSrc("layouts", "MotorwayPage.astro")];
    for (const f of files) expect(f).not.toContain("data-vf-pos");
    const readsOf = (f: string): (string | undefined)[] => [...f.matchAll(/getAttribute\("(data-vf-[a-z-]+)"\)|dataset\.(vf[A-Za-z]+)/g)].map((m) => m[1] ?? m[2]);
    // the sweep can see a read: Consent's own data-vf-location read is found
    expect(readsOf(readSrc("components", "Consent.svelte"))).toContain("data-vf-location");
    for (const f of [readSrc("components", "Consent.svelte"), readSrc("analytics", "listener.ts")]) expect(readsOf(f).filter((x) => x !== "data-vf-location")).toEqual([]);
  });

  it("a motorway page's pill shows the road before the place, and the island stores the place alone (review 2.3.6)", async () => {
    // the rungs the island loads itself; the IP rung's pill is the component's (asserted below)
    for (const r of RUNGS.filter((x) => x.name === "a standing browser grant" || x.name === "a remembered place")) {
      const b = r.browser();
      await runScript(b, onMotorway(r.server));
      const pill = (b.win["document"] as { getElementById: (i: string) => El }).getElementById("place-pill-label");
      expect(pill.textContent, r.name).toBe("A7 · Kassel");
    }
    expect(readSrc("lib", "header-place.ts")).toContain('const label = shown && server.label !== null && server.label !== "" ? `${road} · ${server.label}` : road;');
    // every remembered label is the raw place, never the pill's text
    const island = readSrc("location", "island.ts");
    expect([...island.matchAll(/remember\([^;]*pillLabel/g)]).toEqual([]);
    expect(island).toMatch(/remember\(shown \?\? at, pillRaw, "browser"\)/);
    // #1158: with the kind it was picked as beside it
    expect(island).toMatch(/remember\(at, pillRaw \|\| label, "manual", null, up\)/);
  });

  it("G5.1: with the switch on the page renders the position bar and stays measured, consent unchanged", async () => {
    expect(motorwayAroundOn({ VF_MOTORWAY_AROUND: "1" })).toBe(true);
    expect(motorwayAroundOn({})).toBe(false);
    // On in production since G5.7 holds (owner, 2026-10-21): production's compose file is viafrei-infra's, so
    // "the prod web service sets it, and no other service does" is the skipped case below.
    const o = { baseUrl: "http://digest", timeoutMs: 1, geoipFile: undefined };
    expect(await aroundFirstRender(new Headers(), "A7", "de", new URLSearchParams("r=5"), o, true)).toMatchObject({ radiusKm: 5 });
    expect(await aroundFirstRender(new Headers(), "A7", "de", new URLSearchParams("r=abc"), o, true)).toMatchObject({ radiusKm: 25 });
    const page = readSrc("layouts", "MotorwayPage.astro");
    expect(page).toContain('<Base lang={lang} page="motorways" measure={true}');
    expect(page).toContain("{around !== null && <MotorwayPlace ");
  });

  // cross-repo(viafrei-infra): production's compose file is viafrei-infra's
  it.skip("G5.1 (production): the prod web service sets VF_MOTORWAY_AROUND, and no other service does", () => {});

  it("G5.2: no rung, and no radius change, marks the root or fires vf:location — Consent has nothing to send as location_source", async () => {
    for (const r of RUNGS) {
      const b = r.browser();
      await runScript(b, onMotorway(r.server));
      await radius(b, 5);
      expect(b.seen.root.getAttribute("data-vf-location"), r.name).toBeNull();
      expect(b.seen.dispatched, r.name).not.toContain("vf:location");
      // the run reached the block (the island loaded it), so the absence above is not a run that stopped early; the IP
      // rung's block is the server's and, having no radius since 2.3.11, is never asked again — it reached `vf:pos` off
      if (r.name.startsWith("the IP rung")) expect(b.seen.dispatched, r.name).toContain("vf:pos");
      else if (r.name !== "no position") expect(b.seen.dispatched, r.name).toContain("vf:loaded");
    }
    // the positive control: the same island on the home DOES tell its rung, so the assertion above can fail
    const home = motorwayBrowser({ permission: "prompt" });
    await runScript(home, { lang: "de", server: { source: "ip", at: "pt:51.31,9.4875", label: "Kassel" }, labels: islandLabels("de"), cell: { lat: 0, lon: 0 } });
    expect(home.seen.root.getAttribute("data-vf-location")).toBe("ip");
    expect(home.seen.dispatched).toContain("vf:location");
    // Consent's only sources for location_source are exactly those two signals
    const consent = readSrc("components", "Consent.svelte");
    expect((consent.match(/event\("location_source"/g) ?? []).length).toBe(1);
    expect(consent).toContain('document.documentElement.getAttribute("data-vf-location")');
    expect(consent).toContain('document.addEventListener("vf:location"');
  });

  it("G5.3: the position travels in a POST body to a URL with no query; the only address change is ?r=", async () => {
    // 2.3.11: the IP rung has no radius (owner 2026-10-21), so it asks nothing: the two rungs that ARE the visitor's position
    for (const r of RUNGS.slice(1, 3)) {
      const b = r.browser();
      await runScript(b, onMotorway(r.server));
      await radius(b, 10);
      expect(b.seen.posts.length, r.name).toBeGreaterThan(0);
      for (const p of b.seen.posts) {
        expect(p.url, r.name).toBe("/fragment/motorway-around");
        expect(p.method, r.name).toBe("POST");
        expect(p.body, r.name).not.toContain("51.312345");
        expect(p.body, r.name).not.toContain("9.487654");
      }
      // the island itself rewrites no address on a motorway page
      expect(b.seen.replaced, r.name).toEqual([]);
    }
    const bar = readSrc("components", "MotorwayPlace.astro");
    // 2.3.11: ?r= is set by the control, put back when the position comes and taken off when it goes — never another key
    expect([...bar.matchAll(/searchParams\.(\w+)\(([^,)]*)/g)].map((m) => `${m[1] ?? ""}(${m[2] ?? ""}`)).toEqual(['set("r"', 'set("r"', 'delete("r"']);
    expect(bar).toContain('u.searchParams.set("r", String(r));');
    expect(bar).not.toMatch(/\.hash\s*=|pushState|location\.(?:assign|replace)\(|location\.href\s*=/);
  });

  it("G5.4: ?r= and the block's anchor never reach page_view, page_location or page_referrer; the title is never written", async () => {
    for (const l of LIVE_LANGS) {
      const bare = motorwayPath(l, "A7");
      for (const tail of ["?r=5", "?r=100#motorway-around", "/nesselwang-to-kempten?r=25&f=1#mw-w0"]) {
        expect(pageView(`${bare}${tail}`, l).params.route, tail).toBe(bare);
        expect(cleanLocation(`https://viafrei.de${bare}${tail}`), tail).toBe(`https://viafrei.de${bare}`);
      }
    }
    for (const r of RUNGS) {
      const b = r.browser();
      await runScript(b, onMotorway(r.server));
      await radius(b, 50);
      expect(b.seen.title, r.name).toBe("Static title");
    }
    expect(readSrc("location", "island.ts")).not.toMatch(/\.title\s*=[^=]/);
    // a motorway page never hands the island a page place, so it never navigates for one
    // (#1088: "germany", the address's ?scope=de, is no page place either)
    // (2.4.6: "chosen", the address's ?at=, is a fixed place the island keeps — still no page place, so no navigation)
    expect(readSrc("components", "MotorwayPlace.astro")).toContain('server: { readonly source: "ip" | "none" | "outside" | "germany" | "chosen";');
    expect(readSrc("components", "MotorwayPlace.astro")).not.toMatch(/source: [^;]*"page"/);
  });

  it("G5.5: no click in the position bar or the around block is an event, and the block carries no script or remote asset", () => {
    const outside = { insideTile: false, insideLangs: false, where: null } as const;
    const hrefs = ["https://www.openstreetmap.org/?mlat=51.31000&mlon=9.48750#map=15/51.31000/9.48750", "/de/autobahn/a5", "#motorway-around", "/de/autobahn/a7?r=5", "/de/connect", "/de/developers"];
    for (const href of hrefs) expect(clickEvent({ href, ...outside }, "de"), href).toBeNull();
    const html = readFileSync(join(DIGEST, "presentation", "motorway-around-html.js"), "utf8");
    expect(html).not.toMatch(/<script|<img|<iframe|<object|<embed|srcset|url\(|sendBeacon|new Image/i);
    // its only literal link is a nearer motorway's BARE path; every other link is mapLink()'s
    expect([...html.matchAll(/href=/g)].length).toBe(1);
    expect(html).toContain('<a href="${safe(motorwayPath(lang, v.other.road))}">');
  });

  it("G5.5 (2.3.8): the map's zoom and the swapped main block send no hit either — the zoom controls are buttons with no href inside the block, the main block sits in .motorway-page, and the bar's script calls no analytics", () => {
    const bar = readSrc("components", "MotorwayPlace.astro");
    const script = bar.slice(bar.indexOf("<script is:inline define:vars={labels}>"));
    expect(script).toContain('document.querySelector("#motorway-around .mwa__map")');
    expect(script).toContain('document.createElement("button")');
    expect(script).not.toMatch(/createElement\("a"\)|\.href\s*=[^=]|"href"|gtag|dataLayer|sendBeacon|vf:location|location\.(?:assign|replace)|pushState/);
    // the address changes are still ?r= alone (G5.3), whatever the zoom does: the control's, and 2.3.11's show/hide
    expect([...script.matchAll(/replaceState\(/g)].length).toBe(2);
    expect(LIVE_BLOCKS.split(", ")).toEqual(expect.arrayContaining([".mwa", ".motorway-page"]));
    expect(readSrc("layouts", "MotorwayPage.astro")).toContain('<div class="wrap motorway-page" id="motorway-main"');
    expect(clickEvent({ href: null, insideTile: true, insideLangs: false, where: null }, "de")).toBeNull();
  });

  it("G5.6: the radius is stored nowhere — not by the bar, not by the island", async () => {
    expect(readSrc("components", "MotorwayPlace.astro")).not.toMatch(/localStorage|sessionStorage|document\.cookie|indexedDB/);
    for (const r of RUNGS) {
      const b = r.browser();
      await runScript(b, onMotorway(r.server));
      const before = [...b.seen.writes];
      await radius(b, 5);
      await radius(b, 100);
      expect(b.seen.writes, r.name).toEqual(before);
    }
  });

  // cross-repo(viafrei): asserts the digest's route SOURCE carries no `log.`/`fetch(` call; compiled, the route reads its logger through the import it was compiled from, so the text proves nothing either way (viafrei-web#2, docs/moved-from-viafrei.md)
  it.skip("G5.8: the digest's around route is no-store, logs the road only and asks no third party", () => {
    const app = readFileSync(join(DIGEST, "server", "app.js"), "utf8");
    const from = app.indexOf("app.get(`${MOTORWAY_ROUTE_PREFIX}:road/around`");
    expect(from).toBeGreaterThan(0);
    const route = app.slice(from, app.indexOf("\n  });\n", from));
    expect(route.length).toBeGreaterThan(500);
    expect(route).toContain('res.setHeader("Cache-Control", "no-store");');
    expect(route).not.toMatch(/\blog\.|console\.|fetch\(|tankerkoenig|geocod/i);
    expect(route).toContain("failedMotorway(res, `${road}/around`");
    // No cache keyed by the cell (reviewer, 2.3.6): the place service's `resolve` caches a `pt:` key for an hour, so the
    // route asks it ONLY for an `ags:` key parsed from the address, and asks whether a cell is German uncached.
    expect([...route.matchAll(/\.resolve\(/g)].length).toBe(1);
    expect(route).toMatch(/const key = parseAt\(agsQ\);\s+const r = key === null \? null : await deps\.places\.resolve\(key\);/);
    expect(route).not.toMatch(/kind: "pt"/);
    expect(route).toContain("await deps.places.inGermany(cell)");
    expect(route).not.toMatch(/BoundedCache|[cC]ache\.(get|set)\(|\.set\(/);
    // 2.3.8: the main block rendered for the radius's stretch is rendered and sent, never through the per-motorway
    // fragment cache (which would key it by a stretch derived from the cell)
    // #901 prod: the page and the chargers held to the radius rule first — still rendered here and sent, never kept
    expect(route).toMatch(/const main = renderMotorwayPage\(lang, radiusPage\(page, inRadius\), \{\s+filter,\s+charging: radiusCharging\(ch, inRadius\),/);
    expect(route).not.toMatch(/mw\.fragment\(/);
    const ps = readFileSync(join(DIGEST, "server", "place-service.js"), "utf8");
    const from2 = ps.indexOf("    inGermany: async (point) => {");
    expect(from2).toBeGreaterThan(0);
    const body = ps.slice(from2, ps.indexOf("\n    },\n", from2));
    // 2.4.2 review A 4: the one "in Germany" rule — the boundary judgement `resolve` uses (#1070), uncached here
    expect(body).toContain("const f = await positionFacts(deps.db, c.lat, c.lon);");
    expect(body).toContain("judgePosition(f.value)");
    expect(body).not.toContain("IN_GERMANY_MAX_M");
    expect(body).not.toMatch(/Cache|\.get\(|\.set\(|resolve\(/);
  });

  it("G5.10: the Datenschutz names the motorway pages' position exactly when the switch is on, and § 5's item holds in both states", () => {
    const legal = readSrc("components", "LegalPrivacy.astro");
    expect(legal).toContain("const motorwayAround = motorwayAroundOn();");
    expect(legal).toMatch(/motorwayAround && \(\s*<p id="ort-autobahn">/);
    expect(legal).toContain('{motorwayAround ? "Ihr Ort auf der Startseite und den Autobahnseiten" : "Ihr Ort auf der Startseite"}');
    const flat = legal.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
    expect(flat).toContain(
      "auf den Autobahnseiten die Autobahn als Teil der Seitenadresse — beim Laden der Seite ohne gewählten Abschnitt, Richtung, Filter oder Umkreis und nie Ihr Ort oder der Weg, auf dem die Seite ihn bestimmt hat,",
    );
    expect(flat).toContain("Google Analytics (Punkt 5) erhält von einer Autobahnseite als Seitenadresse nur die der Autobahn, ohne Umkreis, und weder das Gebiet noch den Weg, auf dem die Seite Ihren Ort bestimmt hat.");
    expect(flat).toContain("dafür fragt er bei keinem Dritten an, auch nicht nach Kraftstoffpreisen.");
    expect(flat).toContain("nach Punkt 3 und wird darüber hinaus weder auf Ihrem Gerät noch sonst bei uns gespeichert.");
  });

  // cross-repo(viafrei): asserts TypeScript source text (a type, a `readonly`/`as const` declaration) that the released viafrei-app ships compiled, so it cannot be decided here (viafrei-web#2, docs/moved-from-viafrei.md)
  it.skip("G5.7 (2026-10-21, page changes and outbound clicks OFF since the owner-approved Admin API change): § 5 names every enhanced-measurement event the stream still sends, and no longer the two that are off, and the facts it states about our pages hold in the code", () => {
    const legal = readSrc("components", "LegalPrivacy.astro");
    const flat = legal.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
    // The sentences, verbatim (data-sources G5.7: which one goes when the owner switches an event off).
    for (const s of [
      "Automatisch erfasste Ereignisse: Für unsere Property ist die „erweiterte Messung“ von Google Analytics eingeschaltet.",
      "Scrollen: dass Sie das Ende einer Seite (90 Prozent ihrer Höhe) erreicht haben, mit der bis dahin aktiven Zeit auf der Seite.",
      "Keine andere gemessene Seite trägt einen der Adressparameter, an denen Google eine Suche erkennt (q, s, search, query, keyword).",
      // #1111/#1112: the two site-search boxes submit to the search page, which is not measured
      "Was Sie in das Suchfeld oben auf jeder Seite oder in das der Ortsleiste tippen, steht erst nach dem Absenden in einer Adresse, der der Ergebnisseite der Suche, und diese Seite misst Google Analytics nicht (siehe „Suche“); ein in der Ortsleiste gewählter Ort steht nie in einem Suchparameter und erreicht Google nicht.",
      "nie, was Sie darin eingetragen oder gewählt haben (zum Suchbegriff siehe „Suche“).",
      // #996 (2.3.23): the motorway page's own search is the fourth form; its term rides as `find`, not a site-search name
      "Formulare gibt es auf den gemessenen Seiten nur sechs: die Suche oben auf jeder Seite und die Suche der Ortsleiste, deren Zieladresse die nicht gemessene Ergebnisseite der Suche ist, die Themenauswahl über den Karten der Startseite, deren gewählte Themen als topics in der Adresse stehen, die Suche der Autobahnübersicht, die Suche auf einer Autobahnseite, deren Begriff als find in der Adresse steht und damit nicht als Suche erkannt wird, und die Auswahl von Abschnitt, Richtung und Ebenen auf einer Autobahnseite.",
      "Videos: Unsere Seiten binden keine Videos ein; hierzu entsteht daher kein Ereignis.",
    ])
      expect(flat).toContain(s);
    // Switched OFF (owner, 2026-10-21): their items and the parenthesis are gone, so § 5 does not over-state them.
    for (const s of ["Klicks auf Links zu anderen Websites", "Adressänderungen ohne Neuladen", "Unsere eigene Messung meldet keinen Klick"]) expect(flat).not.toContain(s);
    // The paragraph sits inside the tagged branch of § 5, before "Zweck".
    const s5 = legal.indexOf("<h2>5. Google Analytics — nur mit Ihrer Einwilligung</h2>");
    const ev = legal.indexOf('<p id="ga-ereignisse">');
    expect(s5).toBeGreaterThan(0);
    expect(ev).toBeGreaterThan(s5);
    expect(ev).toBeLessThan(legal.indexOf("<strong>Zweck:</strong>", s5));
    // The facts: the motorway index search is the ONLY field named like a GA site-search parameter …
    const sources = [readFileSync(join(DIGEST, "presentation", "motorway-extras-html.js"), "utf8"), readFileSync(join(DIGEST, "presentation", "motorway-layers-html.js"), "utf8"), readSrc("lib", "topic-filter.ts"), readSrc("components", "PlaceBar.astro"), readFileSync(join(DIGEST, "presentation", "motorway-search-html.js"), "utf8")];
    const searchNames = sources.flatMap((t) => [...t.matchAll(/name="(q|s|search|query|keyword)"/g)].map((m) => m[1]));
    expect(searchNames).toEqual(["q", "q"]);
    expect(sources[0]).toContain('<form class="motorway-search" method="get"');
    // … the position bar's box (#1112) is a GET form to the search page (#1111), which carries no measurement (search-page-1111.test.ts),
    // and the topic filter (#1050) is a GET form whose only names are `topics` and `f`.
    expect(sources[3]).toMatch(/<form class="placepos__search site-place__search" id="place-head" role="search" action=\{searchPath\(lang\)\} method="get"/);
    expect(sources[3]).toContain('id="place-hq" name="q" type="search"');
    expect(sources[2]).toContain('<form class="tpf" id="tpf" method="get"');
    expect(new Set([...(sources[2] ?? "").matchAll(/name="([a-z]+)"/g)].map((m) => m[1]))).toEqual(new Set(["f", "topics"]));
    expect(sources[1]).toContain(MOTORWAY_FORM_MARK + " method=");
    // … #996: the motorway page's search names its field `find`, never a site-search name (searchNames above reads it)
    expect(sources[4]).toContain(MOTORWAY_SEARCH_FORM_MARK + " method=");
    expect(sources[4]).toContain('name="find" type="search"');
    // … and a map link is the object's point, never a cell or a radius.
    // #944: the URL is built by @viafrei/design from the row's own point (`mapPoint`), the platform link from the same target.
    const tiles = readFileSync(join(DIGEST, "cards", "shared", "map.js"), "utf8");
    expect(tiles).toContain("const p = mapPoint(lat, lon);");
    expect(tiles).toContain('const t: MapTarget = { kind: "point", ...p };');
    const design = readFileSync(join(import.meta.dirname, "..", "..", "design", "src", "map.ts"), "utf8");
    expect(design).toContain("`https://www.openstreetmap.org/?mlat=${t.lat}&mlon=${t.lon}#map=${zoom}/${t.lat}/${t.lon}`");
  });
});

describe("the filter form (M30)", () => {
  it("the motorway page declares a form exactly when its fragment carries the digest's filter form (both ways)", () => {
    expect(carriesMotorwayForm('<section class="motorway" id="motorway"><form class="motorway__filter" method="get" action="/de/autobahn/a7"><select name="from"></select></form></section>')).toBe(true);
    expect(carriesMotorwayForm('<section class="motorway" id="motorway"><p class="motorway__none">keine Anschlussstellen</p></section>')).toBe(false);
    expect(carriesMotorwayForm('<form class="motorway__search">')).toBe(false);
    // the mark is the digest's own: its renderer is read, not a copy of it
    const digestSource = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../.pinned/app/packages/digest/dist/src/presentation/motorway-layers-html.js"), "utf8");
    expect(digestSource).toContain("`" + MOTORWAY_FORM_MARK + " method=");
  });

  it("a page with a form allows form-action 'self' and nothing else; a page without one keeps 'none'", () => {
    for (const tag of [undefined, "G-0"]) {
      for (const script of [false, true]) {
        expect(contentSecurityPolicy(NONCE, tag, script, true)).toContain("form-action 'self';");
        expect(contentSecurityPolicy(NONCE, tag, script, true)).not.toContain("form-action 'none'");
        expect(contentSecurityPolicy(NONCE, tag, script, false)).toContain("form-action 'none';");
      }
    }
  });

  it("the choice sent to the digest holds only the known names, each by its own shape, in a fixed order", () => {
    expect(motorwayChoice(new URLSearchParams(""))).toBe("");
    expect(motorwayChoice(new URLSearchParams("dir=neg&to=20040&from=20010&utm_source=x"))).toBe("from=20010&to=20040&dir=neg");
    expect(motorwayChoice(new URLSearchParams("from=../x&dir=up&layer=parking"))).toBe("");
    expect(motorwayChoice(new URLSearchParams("f=1&layer=cameras&layer=parking&layer=evil"))).toBe("f=1&layer=parking&layer=cameras");
  });

  it("#996: the page's search rides as `find` — cleaned by the digest's rule, sent, and kept by a redirect; `q` is not it", () => {
    expect(motorwayChoice(new URLSearchParams("find=Kassel-Nord"))).toBe("find=Kassel-Nord");
    expect(motorwayChoice(new URLSearchParams("find=Würzburg%20<script>"), ["exit-33-kassel-nord"])).toBe(`stretch=exit-33-kassel-nord&find=${encodeURIComponent("Würzburg script")}`);
    expect(motorwayChoice(new URLSearchParams(`find=${"x".repeat(90)}`))).toBe(`find=${"x".repeat(60)}`);
    expect(motorwayChoice(new URLSearchParams("q=Kassel"))).toBe("");
    expect(motorwayChoice(new URLSearchParams("find=%20%20"))).toBe("");
    expect(motorwayViewQuery(new URLSearchParams("find=AS 33"))).toBe("find=AS%2033");
    // the form mark is the digest's own, and a fragment with only the search form still allows form-action 'self'
    const digestSource = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../.pinned/app/packages/digest/dist/src/presentation/motorway-search-html.js"), "utf8");
    expect(digestSource).toContain("`" + MOTORWAY_SEARCH_FORM_MARK + " method=");
    expect(carriesMotorwayForm('<section class="motorway" id="motorway"><form class="mws__form" method="get" action="/de/autobahn/a7#mw-search"></form></section>')).toBe(true);
  });

  it("#996: the index search takes a town or a junction as well as a number, by the digest's rule", () => {
    expect(motorwayIndexChoice(new URLSearchParams("q=7"))).toBe("q=7");
    expect(motorwayIndexChoice(new URLSearchParams("q=Kassel"))).toBe("q=Kassel");
    expect(motorwayIndexChoice(new URLSearchParams("q=Köln-Süd"))).toBe(`q=${encodeURIComponent("Köln-Süd")}`);
    expect(motorwayIndexChoice(new URLSearchParams(`q=${"a".repeat(50)}`))).toBe(`q=${"a".repeat(40)}`);
    expect(motorwayIndexChoice(new URLSearchParams(`q=A${"1".repeat(20)}`))).toBe(`q=A${"1".repeat(11)}`);
    expect(motorwayIndexChoice(new URLSearchParams("q=<b>&sort=worst"))).toBe("q=b&sort=worst");
  });
});

describe("the deferred fuel fragment (M16)", () => {
  const PERSON = { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0", "sec-fetch-site": "same-origin", "sec-fetch-mode": "cors", "sec-fetch-dest": "empty" };
  const BODY = '<div class="motorway-fuel"><p>Preise</p></div>';
  const call = async (path: string, headers: Record<string, string>, method = "GET", body = BODY) => {
    const asked: string[] = [];
    const res = await motorwayFuelRoute(new Request(`https://viafrei.de${path}`, { method, headers }), {
      baseUrl: "http://digest",
      timeoutMs: 500,
      fetchImpl: (u) => {
        asked.push(u);
        return Promise.resolve({ status: 200, headers: { get: () => null }, text: () => Promise.resolve(body) });
      },
    });
    return { res, asked };
  };

  it("(h) the off switch is a constant, on", () => {
    expect(MOTORWAY_FUEL_FRAGMENT_ON).toBe(true);
    expect(MOTORWAY_FUEL_PATH).toBe("/fragment/motorway-fuel");
  });

  it("(b) every answer carries private, no-store and the full X-Robots-Tag — a refusal, a 404 and a 502 too", async () => {
    const cases = [
      await call(`${MOTORWAY_FUEL_PATH}?road=A7&lang=de`, PERSON),
      await call(`${MOTORWAY_FUEL_PATH}?road=A7&lang=de`, { "user-agent": "Googlebot/2.1" }),
      await call(`${MOTORWAY_FUEL_PATH}?road=B27&lang=de`, PERSON),
      await call(`${MOTORWAY_FUEL_PATH}?road=A7&lang=de`, PERSON, "GET", "{\"price\":1.7}"),
    ];
    expect(cases.map((c) => c.res.status)).toEqual([200, 200, 404, 502]);
    for (const { res } of cases) {
      expect(res.headers.get("cache-control")).toBe("private, no-store");
      expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive, nosnippet");
      expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    }
    expect(MOTORWAY_FUEL_HEADERS["x-robots-tag"]).toBe("noindex, nofollow, noarchive, nosnippet");
  });

  it("(c) the D4 gate: a person on this origin gets the stations; a crawler, no user agent, a cross-site fetch or a prefetch gets the sentence only", async () => {
    const ok = await call(`${MOTORWAY_FUEL_PATH}?road=A7&lang=de&stretch=nesselwang-to-kempten&towards=towards-wuerzburg&from=20010&x=1`, PERSON);
    expect(ok.asked).toEqual(["http://digest/internal/motorway/A7/fuel?lang=de&stretch=nesselwang-to-kempten&towards=towards-wuerzburg"]);
    const refused: Record<string, string>[] = [
      { ...PERSON, "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
      { ...PERSON, "user-agent": "GPTBot/1.2" },
      { "sec-fetch-site": "same-origin" },
      { ...PERSON, "sec-fetch-site": "cross-site" },
      { ...PERSON, "sec-fetch-site": "none" },
      { ...PERSON, "sec-purpose": "prefetch" },
      { ...PERSON, purpose: "prefetch" },
      // #981 review B1: a navigation's headers replayed on the fragment (a no-JS walk forging same-origin)
      { ...PERSON, "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" },
      { ...PERSON, "sec-fetch-dest": "document" },
      { ...PERSON, "sec-fetch-mode": "no-cors" },
      { "user-agent": PERSON["user-agent"], "sec-fetch-site": "same-origin" },
    ];
    for (const h of refused) {
      const r = await call(`${MOTORWAY_FUEL_PATH}?road=A7&lang=de&from=20010`, h);
      expect(r.asked, JSON.stringify(h)).toEqual(["http://digest/internal/motorway/A7/fuel?lang=de&refused=1"]);
    }
    const head = await call(`${MOTORWAY_FUEL_PATH}?road=A7&lang=de`, PERSON, "HEAD");
    expect(head.asked).toEqual(["http://digest/internal/motorway/A7/fuel?lang=de&refused=1"]);
  });

  it("(f) HTML of the one shape only — no JSON, no script, no image", () => {
    expect(isFuelFragment(BODY)).toBe(true);
    for (const b of ['{"a":1}', '<div class="motorway-fuel"><script>x</script></div>', '<div class="motorway-fuel"><img src=x></div>', '<p>x</p>']) expect(isFuelFragment(b), b).toBe(false);
    expect(fuelQuery(new URL("https://viafrei.de/fragment/motorway-fuel?road=a7&lang=de"))).toBeNull();
    expect(fuelQuery(new URL("https://viafrei.de/fragment/motorway-fuel?road=A7&lang=xx"))).toBeNull();
  });

  it("(d) the script fetches only when the card is in a person's view — never on load, never a prefetch (PF2 on this layer, owner 2026-10-26)", () => {
    const s = motorwayFuelScript();
    // the one read is `go`, which first waits until the page is shown (a hidden or prerendering page asks nothing)
    const go = s.indexOf("const go=async()=>{await shown();");
    expect(go).toBeGreaterThan(0);
    expect(s.match(/load\(0,0\)/g)).toHaveLength(1);
    expect(s.indexOf("load(0,0)")).toBeGreaterThan(go);
    // `go` runs from the observer once the card intersects (then it disconnects), or at once where no observer exists
    expect(s.match(/go\(\)/g)).toHaveLength(2);
    expect(s).toContain("if(es.some(e=>e.isIntersecting)){v.disconnect();go()}");
    expect(s).toContain('if(typeof IntersectionObserver!=="function"){go();return}');
    expect(s.match(/fetch\(/g)).toHaveLength(1);
    // #1065: `document.prerendering` is read only to WAIT until a prerendered page is shown; nothing asks for one
    expect(s).not.toMatch(/prefetch|prerender(?!ing)|speculationrules|gtag|dataLayer|\.click\(\)|dispatchEvent|DOMContentLoaded|onload/);
    // #712: the one timer re-reads a layer the route wrapped (`data-vf-refill`)
    expect(s.match(/setTimeout\(/g)).toHaveLength(1);
    expect(s).toContain('getAttribute("data-vf-refill")');
    const page = readFileSync(join(SRC, "layouts", "MotorwayPage.astro"), "utf8");
    expect(page).not.toMatch(/rel="?(prefetch|prerender)|speculationrules/);
  });
});

/**
 * #712, owner 2026-10-15: "a person's click on a motorway page's fuel layer is
 * a person's request". An empty stretch (no price inside the cache window)
 * makes the digest name ONE point (`Fuel-Ask`); the route — for a person's
 * click only — asks the MCP site door about it, shows the queue place, and
 * wraps the layer to be re-read, like the place card.
 */
describe("a click on an empty fuel layer asks, through the same queue (#712)", () => {
  const PERSON = { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0", "sec-fetch-site": "same-origin", "sec-fetch-mode": "cors", "sec-fetch-dest": "empty" };
  const ASK = "pt:50.8123,6.1234";
  /** The digest stub: empty with a Fuel-Ask point until `priced`, then the stations; the note echoed in the body. */
  function digest(o: { ask?: string | null; priced?: boolean } = {}) {
    const asked: string[] = [];
    const f = (u: string) => {
      asked.push(u);
      const note = /[?&]fuel=([a-z]+)(?:&fuelPos=(\d+)&fuelEta=(\d+))?/.exec(u);
      const body = o.priced === true ? '<div class="motorway-fuel"><ul class="motorway__list"><li>ARAL 1,689</li></ul></div>' : `<div class="motorway-fuel">${note === null ? "" : `<p class="pcard__fresh pcard__fresh--${note[1] ?? ""}">${note[2] ?? ""}/${note[3] ?? ""}</p>`}</div>`;
      const ask = o.priced === true ? null : (o.ask === undefined ? ASK : o.ask);
      return Promise.resolve({ status: 200, headers: { get: (n: string) => (n === "fuel-ask" ? ask : null) }, text: () => Promise.resolve(body) });
    };
    return { asked, f };
  }
  function mcp(answer: Record<string, unknown>) {
    const asked: string[] = [];
    const f: PostLike = (url, init) => {
      asked.push(`${url} ${init.body}`);
      return Promise.resolve({ status: 200, json: () => Promise.resolve(answer) });
    };
    return { asked, f };
  }
  const call = (path: string, headers: Record<string, string>, d: ReturnType<typeof digest>, m: ReturnType<typeof mcp>) =>
    motorwayFuelRoute(new Request(`https://viafrei.de${path}`, { headers }), { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: d.f, refreshUrl: "http://mcp:8788", refreshFetch: m.f });
  const PATH = `${MOTORWAY_FUEL_PATH}?road=A4&lang=de&stretch=koeln-ost-to-koeln-sued`;

  it("a person's click on an empty stretch asks the site door about the ONE point the digest named, and the layer says the queue place, wrapped to be re-read", async () => {
    const d = digest();
    const m = mcp({ state: "pending", settledAt: null, reused: false, queue: { position: 2, etaMs: 118_000 } });
    const res = await call(PATH, PERSON, d, m);
    expect(res.status).toBe(200);
    // #775 W3: the body says the point is the stretch's public anchor, so a wide refresh is sent about it as it is
    expect(m.asked).toEqual([`http://mcp:8788/internal/fuel/refresh {"at":"${ASK}","anchor":true}`]);
    expect(d.asked).toEqual(["http://digest/internal/motorway/A4/fuel?lang=de&stretch=koeln-ost-to-koeln-sued", "http://digest/internal/motorway/A4/fuel?lang=de&stretch=koeln-ost-to-koeln-sued&fuel=pending&fuelPos=2&fuelEta=118"]);
    const body = await res.text();
    expect(body).toBe('<div class="motorway-fuel" data-vf-refill="119500" data-vf-polls="1" data-vf-head="0"><p class="pcard__fresh pcard__fresh--pending">2/118</p></div>');
    // the point never reaches the browser
    expect(body).not.toContain("50.8123");
    expect(res.headers.get("fuel-ask")).toBeNull();
  });

  it("a re-read still pending is wrapped again with the next poll, however many came before; only a failed entry says 'unavailable'; a settled ask shows the stations", async () => {
    const pending = mcp({ state: "pending", settledAt: null, reused: true, queue: { position: 1, etaMs: 20_000 } });
    expect(await (await call(`${PATH}&polls=3`, PERSON, digest(), pending)).text()).toMatch(/data-vf-polls="4"/);
    for (const polls of [30, 31, 999]) expect(await (await call(`${PATH}&polls=${String(polls)}`, PERSON, digest(), pending)).text(), String(polls)).toMatch(/^<div class="motorway-fuel" data-vf-refill="21500" data-vf-polls="\d+" data-vf-head="1"><p class="pcard__fresh pcard__fresh--pending">1\/20<\/p>/);
    const failed = await (await call(`${PATH}&polls=3`, PERSON, digest(), mcp({ state: "failed", settledAt: null, reused: true }))).text();
    expect(failed).toBe('<div class="motorway-fuel"><p class="pcard__fresh pcard__fresh--unavailable">/</p></div>');
    // settled: the digest read again holds the stations
    const done = digest();
    const settled = mcp({ state: "refreshed", settledAt: 1_760_270_000_000, reused: false });
    const r = await (await call(PATH, PERSON, { asked: done.asked, f: (u: string) => (done.asked.length === 0 ? done.f(u) : digest({ priced: true }).f(u)) }, settled)).text();
    expect(r).toContain("ARAL 1,689");
    expect(r).not.toContain("data-vf-refill");
  });

  it("a crawler, a prefetch, a cross-site fetch or a HEAD never asks — the existing D4 gate", async () => {
    for (const h of [{ ...PERSON, "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" }, { ...PERSON, "user-agent": "GPTBot/1.2" }, { ...PERSON, "sec-purpose": "prefetch" }, { ...PERSON, "sec-fetch-site": "cross-site" }]) {
      const m = mcp({ state: "pending" });
      const d = digest();
      await call(PATH, h, d, m);
      expect(m.asked, JSON.stringify(h)).toEqual([]);
      expect(d.asked).toEqual(["http://digest/internal/motorway/A4/fuel?lang=de&refused=1"]);
    }
    const m = mcp({ state: "pending" });
    await motorwayFuelRoute(new Request(`https://viafrei.de${PATH}`, { method: "HEAD", headers: PERSON }), { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: digest().f, refreshUrl: "http://mcp:8788", refreshFetch: m.f });
    expect(m.asked).toEqual([]);
  });

  it("a stretch WITH prices, an empty answer the digest names no point for, or no refresh door: nothing is asked", async () => {
    const m = mcp({ state: "pending" });
    await call(PATH, PERSON, digest({ priced: true }), m);
    await call(PATH, PERSON, digest({ ask: null }), m);
    await call(PATH, PERSON, digest({ ask: "pt:1,2;drop" }), m);
    const d = digest();
    await motorwayFuelRoute(new Request(`https://viafrei.de${PATH}`, { headers: PERSON }), { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: d.f });
    expect(m.asked).toEqual([]);
    expect(fuelAskOf("pt:50.8123,6.1234")).toBe("pt:50.8123,6.1234");
    for (const bad of ["ags:05334002", "pt:50.81234,6.1", "pt:x,y", "", null]) expect(fuelAskOf(bad), String(bad)).toBeNull();
  });
});
