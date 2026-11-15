/**
 * The location ladder of the home (#564 § 1, § 6, § 8), every rung:
 *
 *  - the GeoIP file: built by `scripts/geoip-build.mjs` from a fixture on the
 *    documentation ranges (never the real DB-IP file, never a download), read
 *    back by `src/location/geoip.ts` — so the builder and the reader cannot drift;
 *  - the server rung: a German address is a place, a neighbour's is the picker
 *    with border towns, any other country the picker, unknown/VPN/private is
 *    Germany-wide, a crawler is never located;
 *  - the island AS SHIPPED (the text `islandScript` prints, run against a fake
 *    window): the pairs of the ladder, one test per pair (#564 acceptance 1 —
 *    run on the shipped text, since the island is where the order lives), the
 *    remembered choice, that the page never makes the browser ask by itself
 *    (v2.0.10), what it writes to the device and when — only on a click in the
 *    place window — the line under the bar while a remembered place is in use,
 *    the full label of a pick, the rounding on the device, and the event that
 *    names the rung and never the place;
 *  - privacy by construction: nothing in `src/location/` logs or stores.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { all, text as nodeText } from "@viafrei/design/testing";
import { CELL_DEG as DIGEST_CELL } from "../../digest/src/analysis/place.js";
import { placePath as digestPlacePath } from "../../digest/src/cards/shared/paths.js";
import { SPOT_MAX_ACC } from "../../digest/src/analysis/spot.js";
import { openGeoIp, parseIp, type GeoIp } from "../src/location/geoip.js";
import { RETRY_WAITS_MS } from "../src/lib/fragment-retry.js";
import { CELL_DEG, cellKey, isPlaceKey, serverRung } from "../src/location/ladder.js";
import { clientIp } from "../src/location/client-ip.js";
import { homePlace } from "../src/location/server.js";
import { islandScript, placeIsland, type IslandConfig } from "../src/location/island.js";
import { minifyInline } from "../scripts/inline-min.js";
import { islandLabels } from "../src/location/labels.js";
import { LIVE_LANGS } from "../src/site/pages.js";
import { placePath } from "../src/site/places.js";
import { slugify } from "../src/site/slug.js";
import type { FetchLike } from "../src/lib/tiles.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const FIXTURE = join(HERE, "fixtures", "geoip-fixture.csv");

let dir = "";
let geo: GeoIp | null = null;
let buildOut = "";

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "vf-geoip-"));
  buildOut = execFileSync("node", [join(ROOT, "scripts", "geoip-build.mjs"), "--release", "2026-10", "--out", join(dir, "geoip.vfgeo"), "--min-de-ranges", "1"], { input: readFileSync(FIXTURE), encoding: "utf8" });
  geo = openGeoIp(join(dir, "geoip.vfgeo"));
});
afterAll(() => {
  geo?.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("the GeoIP file (scripts/geoip-build.mjs → src/location/geoip.ts)", () => {
  it("is built from the fixture: merged ranges, skipped junk, German points counted", () => {
    expect(buildOut).toMatch(/8 line\(s\) read, 2 skipped, 3 IPv4 and 2 IPv6 range\(s\)/);
    expect(geo?.release).toBe("2026-10");
  });

  it("answers a German address with a point rounded to 0.01°", () => {
    expect(geo?.lookup("192.0.2.200")).toEqual({ country: "DE", lat: 50.94, lon: 6.96 });
    expect(geo?.lookup("2001:db8::1")).toEqual({ country: "DE", lat: 52.52, lon: 13.41 });
    expect(geo?.lookup("::ffff:192.0.2.1")).toEqual({ country: "DE", lat: 50.94, lon: 6.96 });
  });

  it("keeps a neighbour's point at 0.05° and every other country as its code alone", () => {
    expect(geo?.lookup("198.51.100.7")).toEqual({ country: "CH", lat: 47.55, lon: 7.6 });
    expect(geo?.lookup("2001:db8:1::42")).toEqual({ country: "FR", lat: 48.55, lon: 7.75 });
    expect(geo?.lookup("203.0.113.9")).toEqual({ country: "US", lat: null, lon: null });
  });

  it("knows nothing about an address outside its ranges, a ZZ range or a non-address", () => {
    for (const ip of ["10.0.0.1", "203.0.114.5", "127.0.0.1", "2001:db8:2::1", "not-an-ip", "", "999.1.1.1"]) expect(geo?.lookup(ip), ip).toBeNull();
  });

  it("is skipped, never thrown, when the file is missing or not VFGEO1", () => {
    expect(openGeoIp(undefined)).toBeNull();
    expect(openGeoIp(join(dir, "nope.vfgeo"))).toBeNull();
    expect(openGeoIp(FIXTURE)).toBeNull();
  });

  it("refuses empty input and input without one German range", () => {
    const run = (input: string): number => {
      try {
        execFileSync("node", [join(ROOT, "scripts", "geoip-build.mjs"), "--release", "2026-10", "--out", join(dir, "x.vfgeo")], { input, stdio: "pipe" });
        return 0;
      } catch (e) {
        return (e as { status: number }).status;
      }
    };
    expect(run("")).toBe(2);
    expect(run("203.0.113.0,203.0.113.255,NA,US,x,y,1,1\n")).toBe(2);
  });

  it("refuses a file with fewer German ranges than the floor (10 000 by default) — the fixture is one", () => {
    // review N2: a truncated or foreign download must not replace a working file.
    const build = (extra: string[]): { status: number; stderr: string } => {
      try {
        execFileSync("node", [join(ROOT, "scripts", "geoip-build.mjs"), "--release", "2026-10", "--out", join(dir, "floor.vfgeo"), ...extra], { input: readFileSync(FIXTURE), stdio: "pipe" });
        return { status: 0, stderr: "" };
      } catch (e) {
        return { status: (e as { status: number }).status, stderr: String((e as { stderr: Buffer }).stderr) };
      }
    };
    const dflt = build([]);
    expect(dflt.status).toBe(2);
    expect(dflt.stderr).toContain("fewer than the floor of 10000");
    expect(build(["--min-de-ranges", "3"]).status).toBe(2);
    expect(build(["--min-de-ranges", "2"]).status).toBe(0); // the fixture holds exactly two German ranges
    expect(build(["--min-de-ranges", "0"]).status).toBe(2);
  });

  it("parses the address shapes a proxy hands on", () => {
    expect(parseIp("192.0.2.1")).toEqual({ v4: 3221225985 });
    expect(parseIp("[2001:db8::1]")).not.toBeNull();
    expect(parseIp("fe80::1%eth0")).not.toBeNull();
    expect(parseIp("1.2.3")).toBeNull();
  });
});

describe("the client address", () => {
  const h = (v: string | null): { get(n: string): string | null } => ({ get: (n) => (n === "x-forwarded-for" ? v : null) });
  it("is the edge's X-Forwarded-For, first entry, only when every entry is an address", () => {
    expect(clientIp(h("192.0.2.5"))).toBe("192.0.2.5");
    expect(clientIp(h("192.0.2.5, 10.0.0.1"))).toBe("192.0.2.5");
    expect(clientIp(h("unknown, 192.0.2.5"))).toBeNull();
    expect(clientIp(h(null))).toBeNull();
  });
  it("never reads a spoofed CF-Connecting-IP, True-Client-IP or X-Real-IP (#1233)", () => {
    // The edge (Caddy) is the one reader of CF-Connecting-IP, from Cloudflare's
    // ranges only; nginx then overwrites X-Forwarded-For. GeoIP and the crawler
    // check both go through this function, so neither can be steered by it.
    const spoof = { "cf-connecting-ip": "203.0.113.9", "true-client-ip": "203.0.113.9", "x-real-ip": "203.0.113.9" };
    expect(clientIp(new Headers(spoof))).toBeNull();
    expect(clientIp(new Headers({ ...spoof, "x-forwarded-for": "192.0.2.5" }))).toBe("192.0.2.5");
    const overload = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../src/overload/index.ts"), "utf8");
    expect(overload, "the crawler verifier is handed this same clientIp").toMatch(/import \{ clientIp \} from "\.\.\/location\/client-ip\.js";[\s\S]*crawlers: createCrawlerVerifier\(\), clientIp[,\s}]/);
  });
});

describe("the server rung", () => {
  it("a German address is a place; a neighbour's is the picker with border towns; elsewhere the picker", () => {
    expect(serverRung({ country: "DE", lat: 50.94, lon: 6.96 })).toEqual({ kind: "ip", at: cellKey(50.94, 6.96) });
    expect(serverRung({ country: "CH", lat: 47.55, lon: 7.6 })).toEqual({ kind: "outside", border: cellKey(47.55, 7.6) });
    expect(serverRung({ country: "US", lat: null, lon: null })).toEqual({ kind: "outside", border: null });
  });

  it("an unknown address — VPN, datacentre range the file does not place, private — is Germany-wide", () => {
    expect(serverRung(null)).toEqual({ kind: "none" });
    expect(serverRung({ country: "DE", lat: null, lon: null })).toEqual({ kind: "none" });
  });

  const fakeDigest = (asked: string[]): FetchLike => (url) => {
    asked.push(url);
    // 2.4.2 review A 9: the shell asks no `/internal/place/border` (retired); every answer here is a place's cards
    expect(url).not.toContain("/border");
    const body = '<section class="place" id="place-cards"><h2>Köln</h2></section>';
    return Promise.resolve({
      status: 200,
      headers: { get: (n: string) => ({ "content-type": "text/html; charset=utf-8", "place-key": "ags:05315000", "place-label": encodeURIComponent("Köln"), "place-point": "0" })[n] ?? null },
      text: () => Promise.resolve(body),
    });
  };
  const req = (ip: string, ua = "Mozilla/5.0"): { get(n: string): string | null } => ({ get: (n) => (n === "x-forwarded-for" ? ip : n === "user-agent" ? ua : null) });

  it("German IP, first visit, no JavaScript: the first HTML holds the IP place's cards — the address never reaches the digest", async () => {
    const asked: string[] = [];
    const r = await homePlace(req("192.0.2.77"), "de", { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: fakeDigest(asked), geoipFile: undefined, geo });
    expect(r.source).toBe("ip");
    expect(r.place?.label).toBe("Köln");
    expect(r.usedGeoIp).toBe(true);
    expect(asked).toEqual([`http://digest/internal/place/cards?at=${encodeURIComponent(cellKey(50.94, 6.96))}&lang=de&snap=gemeinde&fuelRows=0`]);
    expect(asked.join(" ")).not.toContain("192.0.2.77");
  });

  // #1070: the IP rung follows the browser's rule — a neighbour's point near the border is its nearest German place,
  // headed honestly by the digest; one far from Germany, or any other country's address, is "Ganz Deutschland".
  it("a Basel address near the border gets its nearest German place's cards (#1070); a US address all of Germany", async () => {
    const asked: string[] = [];
    const border: FetchLike = (url) => {
      asked.push(url);
      return Promise.resolve({
        status: 200,
        headers: { get: (n: string) => ({ "content-type": "text/html; charset=utf-8", "place-key": "ags:08336091", "place-label": encodeURIComponent("Weil am Rhein"), "place-point": "0", "place-outside": "border" })[n] ?? null },
        text: () => Promise.resolve('<section class="place" id="place-cards"><h2>Weil am Rhein</h2></section>'),
      });
    };
    const basel = await homePlace(req("198.51.100.7"), "de", { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: border, geoipFile: undefined, geo });
    expect(basel.source).toBe("ip");
    expect(basel.place).toMatchObject({ label: "Weil am Rhein", at: "ags:08336091", outside: "border" });
    expect(asked).toHaveLength(1);
    expect(asked[0]).toMatch(/^http:\/\/digest\/internal\/place\/cards\?at=pt%3A47\.\d+%2C7\.\d+&lang=de&snap=gemeinde&fuelRows=0$/);
    expect(asked.join(" ")).not.toContain("198.51.100.7");
    const us = await homePlace(req("203.0.113.9"), "de", { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: fakeDigest([]), geoipFile: undefined, geo });
    expect(us).toEqual({ source: "outside", place: null, usedGeoIp: true });
  });

  it("a neighbour's address far from Germany (the digest says far) is all of Germany, never an error (#1070)", async () => {
    const far: FetchLike = () => Promise.resolve({ status: 404, headers: { get: (n: string) => (n === "place-outside" ? "far" : null) }, text: () => Promise.resolve("<p>no such place in Germany</p>") });
    const r = await homePlace(req("198.51.100.7"), "de", { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: far, geoipFile: undefined, geo });
    expect(r).toEqual({ source: "outside", place: null, usedGeoIp: true });
  });

  it("an objection signal (Sec-GPC: 1 or DNT: 1) stops the lookup: Germany-wide, the file not even consulted", async () => {
    for (const sig of ["sec-gpc", "dnt"]) {
      const asked: string[] = [];
      const h = { get: (n: string): string | null => (n === "x-forwarded-for" ? "192.0.2.77" : n === sig ? "1" : null) };
      const r = await homePlace(h, "de", { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: fakeDigest(asked), geoipFile: undefined, geo });
      expect(r, sig).toEqual({ source: "none", place: null, usedGeoIp: false });
      expect(asked).toEqual([]);
    }
  });

  it("an unknown address, no file, or a crawler: Germany-wide, nothing asked", async () => {
    for (const [ip, ua, g] of [["10.0.0.1", "Mozilla/5.0", geo], ["192.0.2.77", "Mozilla/5.0", null], ["192.0.2.77", "Mozilla/5.0 (compatible; Googlebot/2.1)", geo]] as const) {
      const asked: string[] = [];
      const r = await homePlace(req(ip, ua), "de", { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: fakeDigest(asked), geoipFile: undefined, geo: g });
      expect(r.source, `${ip} ${ua}`).toBe("none");
      expect(asked).toEqual([]);
    }
  });
});

describe("pins to the digest, which the site may not import at runtime", () => {
  it("the cell grid is the digest's", () => expect(CELL_DEG).toEqual(DIGEST_CELL));
  it("the place slug and paths are the digest's, in every language", () => {
    // #892: with no stored slug loaded, the digest's link is the name through THE builder — the site's copy of it
    for (const [ags, name, slug] of [["05315000", "Köln", "koeln"], ["15002000", "Halle (Saale)", "halle-saale"], ["16055000", "Weißenfels", "weissenfels"]] as const) {
      expect(slugify(name)).toBe(slug);
      for (const l of LIVE_LANGS) expect(placePath(l, slug)).toBe(digestPlacePath(l, ags, name));
    }
  });
  it("a place key is exactly the digest's grammar", () => {
    for (const k of ["ags:05315000", "pt:50.94,6.96"]) expect(isPlaceKey(k)).toBe(true);
    for (const k of ["ags:0531500", "Köln", "pt:50.94", `pt:${"1".repeat(40)}`, 5]) expect(isPlaceKey(k)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The island as shipped
// ---------------------------------------------------------------------------

type El = {
  id: string;
  textContent: string;
  innerHTML: string;
  checked: boolean;
  value: string;
  classList: { add(c: string): void; remove(c: string): void };
  /** #1112: the classes the island set, and how often it moved focus here. */
  classes: Set<string>;
  focused: number;
  offsetWidth: number;
  listeners: Record<string, ((e: unknown) => void)[]>;
  addEventListener(t: string, f: (e: unknown) => void): void;
  setAttribute(n: string, v: string): void;
  getAttribute(n: string): string | null;
  removeAttribute(n: string): void;
  attrs: Record<string, string>;
  focus(): void;
  showModal?: () => void;
  close?: () => void;
  querySelectorAll?: (s: string) => unknown[];
  /** #1158: the chip row knows its own chips (a click on one of them is a chip's). */
  contains?: (x: unknown) => boolean;
  children: El[];
  appendChild(c: El): void;
};

function el(id: string): El {
  const e: El = {
    id,
    textContent: "",
    innerHTML: "",
    checked: false,
    value: "",
    classes: new Set<string>(),
    focused: 0,
    classList: { add: (c: string) => void e.classes.add(c), remove: (c: string) => void e.classes.delete(c) },
    offsetWidth: 0,
    listeners: {},
    attrs: {},
    addEventListener(t, f) {
      (this.listeners[t] ??= []).push(f);
    },
    setAttribute(n, v) {
      this.attrs[n] = v;
    },
    getAttribute(n) {
      return this.attrs[n] ?? null;
    },
    removeAttribute(n) {
      delete this.attrs[n];
    },
    focus: () => void (e.focused += 1),
    children: [],
    appendChild(c) {
      this.children.push(c);
    },
  };
  return e;
}

type Fake = {
  /** #564 review: every address the island put in place of the current one. */
  replaced: string[];
  /** #863: every address the island navigated to. */
  assigned: string[];
  win: Record<string, unknown>;
  store: Map<string, string>;
  /** v2.0.10: every write to the device storage, in order — `set <key>` or `del <key>`. */
  writes: string[];
  posts: { url: string; body: string }[];
  prompts: number;
  queries: number;
  events: string[];
  els: Record<string, El>;
  /** The long timers (the 10 s settle) the island armed; a test may fire them. */
  timers: (() => void)[];
  /** #1224: the waits before an ask again (`RETRY_WAITS_MS`), held until the test spends them; the ms of each. */
  retries: { ms: number; fn: () => void }[];
  /** The options of every position read, in order (2026-10-13: the click asks fresh and precise, the load cheap). */
  geoOpts: unknown[];
  answers: (() => void)[];
  /** Every event the island dispatched on the document, by type (#564: `vf:fill`). */
  dispatched: string[];
  /** 2.3.11 (#890): each `vf:pos` the island told the radius control, in order (true: the visitor's own position). */
  pos: boolean[];
  /** Listeners the island put on the document (#564: `vf:filled`). */
  docListeners: Record<string, ((e: unknown) => void)[]>;
  /** 2.4.4 review N2: the card answers held back (`holdAt`), each released by its key. */
  held: Map<string, () => void>;
  /** #1088: the detail of every `vf:place` the island announced, in order. */
  placed: { label: string | null; how: string }[];
  /** #1171: the body of every object lookup (`/fragment/spot`), kept apart from `posts`. */
  spots: { lat: number; lon: number; acc: number; lang: string }[];
};

type PermissionState = "prompt" | "granted" | "denied";
/**
 * `permission`: one state, a SEQUENCE (the n-th query answers the n-th state, the last one repeats — a browser whose
 * answer changes during the page's life), or "never" (a query that never settles).
 * `failCode`: the GeolocationPositionError code a missing position fails with (1 denied, 2 unavailable, 3 timeout).
 * `failAt`: area keys the card service answers 500 for.
 */
/** The fake browser's clock: 2026-10-16 12:00 UTC, so its month is October 2026. */
const FAKE_NOW_MS = Date.UTC(2026, 9, 16, 12);
/** The island's month stamp (#706): months since year 0, UTC. */
const monthOf = (ms: number): number => new Date(ms).getUTCFullYear() * 12 + new Date(ms).getUTCMonth();
/** An entry as the island writes it on the fake clock's day: stamped with that month (#706). */
const withMonth = <T extends object>(v: T): T & { m: number } => ({ ...v, m: monthOf(FAKE_NOW_MS) });

function fakeWindow(
  opts: {
    stored?: Record<string, unknown>;
    permission?: PermissionState | readonly PermissionState[] | "never";
    /** the browser prompt is never answered (tab closed, reload): neither callback runs */
    unanswered?: boolean;
    /** The answer waits in `f.answers` until the test calls it (a slow, precise fix). */
    deferred?: boolean;
    /** `accuracy` in metres, as the browser reports it; 20 when not given. */
    position?: { latitude: number; longitude: number; accuracy?: number } | null;
    failCode?: 1 | 2 | 3;
    failAt?: readonly string[];
    /** #1224: per area key, the answers of its first asks in order — a status, or "reject" (no answer); then the cards. */
    seq?: Record<string, (number | "reject")[]>;
    /** The page's own path (#892): "/de" when not given. */
    pathname?: string;
    /** #564: area keys whose cards arrive wrapped for the filler (fuel prices still on their way). */
    pendingAt?: readonly string[];
    /** #1224 (2.5.22): keys whose answer is the shell's LOADING placeholder (a cold read that missed the deadline): no headers. */
    loadingAt?: readonly string[];
    withSheet?: boolean;
    /** #564 review: the page's query string, e.g. `?r=auto` — the home's automatic reload. */
    search?: string;
    /** v2.0.10: the label the card service answers per area key (default: Köln for an AGS, Köln-Ehrenfeld for a point). */
    labels?: Readonly<Record<string, string>>;
    /** #706: the fake browser's clock (`Date.now()`); FAKE_NOW_MS when not given. */
    nowMs?: number;
    /** #1070: area keys the shell answers as outside Germany (`place-outside`). */
    outsideAt?: Readonly<Record<string, "border" | "far">>;
    /** 2.4.4 review N2: area keys whose card answer waits in `f.held` until the test releases it. */
    holdAt?: readonly string[];
    /** #1088: the headline's elements (the "Ganz Deutschland" radio, its search, the ⌖ buttons). */
    withHead?: boolean;
    /** #1143: the place page slug the card service answers per area key (`place-slug`; none for a point). */
    slugs?: Readonly<Record<string, string>>;
    /** #1112: what `/fragment/suggest` answers (the digest's list markup), and how many options the list then holds. */
    suggest?: { readonly html: string; readonly n: number };
    /** #1153: the header alone — a page with no cards of its own, so no place slot. */
    headerOnly?: boolean;
    /** #1171: what `/fragment/spot` answers — an object's page, a 503, a rejection, an answer never sent; 204 when not given. */
    spot?: { readonly href: string; readonly label: string } | "error" | "reject" | "hold";
  } = {},
): Fake {
  // #706: a kept entry carries the month it was last used. A fixture that gives
  // no `m` is stamped with the fake clock's month, so a test about something
  // else sees no re-stamp write; `m: undefined` written out means "from before
  // #706" and is kept unstamped.
  const month = monthOf(opts.nowMs ?? FAKE_NOW_MS);
  const stamped = (v: unknown): unknown => (v !== null && typeof v === "object" && !Array.isArray(v) && !("m" in v) ? { ...v, m: month } : v);
  const store = new Map<string, string>(
    Object.entries(opts.stored ?? {}).map(([k, v]) => [k, JSON.stringify(k === "viafrei.place" ? stamped(v) : k === "viafrei.place.recent" && Array.isArray(v) ? v.map(stamped) : v)]),
  );
  const ids = ["place-pill", "place-pill-label", "place-pill-how", "place-live", "place-slot", "place-kept", "place-kept-forget", "place-geo-msg", ...(opts.withSheet === true ? ["place-bar", "place-head", "place-hq", "place-hresults", "place-hstatus", "place-chips-l", "place-recent", "place-geo", "place-scope-de", "place-forget", "place-mine"] : []), ...(opts.withHead === true ? ["place-scope-de", "place-head", "place-hq", "place-hresults", "place-cgeo"] : [])];
  const els = Object.fromEntries([...new Set(ids)].filter((i) => !(opts.headerOnly === true && i === "place-slot")).map((i) => [i, el(i)]));
  const bar = els["place-bar"];
  if (bar !== undefined) bar.querySelectorAll = () => [];
  const hres = els["place-hresults"];
  if (hres !== undefined) hres.querySelectorAll = (sel: string) => (sel.includes("place-opt") && hres.innerHTML !== "" ? Array.from({ length: opts.suggest?.n ?? 0 }, () => ({})) : []);
  // #1112: the chip row as a browser keeps it — setting its markup replaces its children, and its chips are queryable
  const rec = els["place-recent"];
  if (rec !== undefined) {
    let html = "";
    Object.defineProperty(rec, "innerHTML", { get: () => html, set: (v: string) => void ((html = v), (rec.children.length = 0)) });
    rec.querySelectorAll = () => rec.children.map((li) => li.children[0]).filter((c): c is El => c !== undefined);
    // a chip the island built, or a popular chip the server rendered (marked `inList` by the test)
    rec.contains = (x: unknown) => rec.children.some((li) => li.children[0] === x) || (x as { inList?: boolean } | null)?.inList === true;
  }
  // The line under the bar is rendered hidden (PlaceBlock.astro).
  els["place-kept"]!.attrs["hidden"] = "";
  els["place-geo-msg"]!.attrs["hidden"] = "";
  const root = el("html");
  const f: Fake = { win: {}, store, writes: [], posts: [], prompts: 0, queries: 0, events: [], els, timers: [], retries: [], geoOpts: [], answers: [], dispatched: [], pos: [], docListeners: {}, replaced: [], assigned: [], held: new Map(), placed: [], spots: [] };
  const query = (): Promise<{ state: PermissionState }> => {
    const p = opts.permission ?? "prompt";
    if (p === "never") return new Promise(() => undefined);
    const seq: readonly PermissionState[] = typeof p === "string" ? [p] : p;
    const st = seq[Math.min(f.queries, seq.length - 1)] ?? "prompt";
    f.queries += 1;
    return Promise.resolve({ state: st });
  };
  const doc = {
    getElementById: (i: string) => els[i] ?? null,
    documentElement: root,
    activeElement: null,
    createElement: (t: string) => el(t),
    dispatchEvent: (e: { type: string; init?: { detail?: { source?: string; on?: boolean } } }) => {
      f.dispatched.push(e.type);
      if (e.type === "vf:pos") f.pos.push(e.init?.detail?.on === true);
      if (e.type === "vf:place") f.placed.push(e.init?.detail as unknown as { label: string | null; how: string });
      const source = e.init?.detail?.source;
      if (e.type === "vf:location" && source !== undefined) f.events.push(source);
      return true;
    },
    addEventListener: (t: string, fn: (e: unknown) => void) => {
      (f.docListeners[t] ??= []).push(fn);
    },
  };
  f.win = {
    Date: { now: () => opts.nowMs ?? FAKE_NOW_MS },
    document: doc,
    location: { pathname: opts.pathname ?? "/de", search: opts.search ?? "", hash: "", assign: (url: string) => void f.assigned.push(url) },
    history: { state: null, replaceState: (_s: unknown, _t: string, url: string) => void f.replaced.push(url) },
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        f.writes.push(`set ${k}`);
        store.set(k, v);
      },
      removeItem: (k: string) => {
        f.writes.push(`del ${k}`);
        store.delete(k);
      },
    },
    CustomEvent: class {
      constructor(
        public type: string,
        public init?: { detail: unknown },
      ) {}
      get detail(): unknown {
        return this.init?.detail;
      }
    },
    matchMedia: () => ({ matches: true }),
    setTimeout: (fn: () => void, ms: number) => {
      if (RETRY_WAITS_MS.includes(ms)) {
        f.retries.push({ ms, fn });
        return 0;
      }
      if (ms > 1000) {
        f.timers.push(fn);
        return 0;
      }
      return setTimeout(fn, 0);
    },
    clearTimeout: () => undefined,
    navigator: {
      permissions: { query },
      geolocation: {
        getCurrentPosition: (ok: (p: unknown) => void, fail: (e: { code: number }) => void, o: unknown) => {
          f.prompts += 1;
          f.geoOpts.push(o);
          if (opts.unanswered === true) return;
          if (opts.deferred === true) {
            f.answers.push(() => ok({ coords: { accuracy: 20, ...opts.position } }));
            return;
          }
          if (opts.position === null || opts.position === undefined) fail({ code: opts.failCode ?? 1 });
          else ok({ coords: { accuracy: 20, ...opts.position } });
        },
      },
    },
    fetch: (url: string, init: { body: string }) => {
      if (url === "/fragment/spot") {
        f.spots.push(JSON.parse(init.body) as Fake["spots"][number]);
        const sp = opts.spot;
        if (sp === "hold") return new Promise(() => undefined);
        if (sp === "reject") return Promise.reject(new Error("network"));
        const hd: Record<string, string> = typeof sp === "object" ? { "spot-href": sp.href, "spot-label": encodeURIComponent(sp.label) } : {};
        return Promise.resolve({ status: sp === "error" ? 503 : typeof sp === "object" ? 200 : 204, headers: { get: (n: string) => hd[n] ?? null }, text: () => Promise.resolve("") });
      }
      f.posts.push({ url, body: init.body });
      if (url === "/fragment/suggest") return Promise.resolve({ status: 200, headers: { get: () => null }, text: () => Promise.resolve(opts.suggest?.html ?? "") });
      const at = (JSON.parse(init.body) as { at: string }).at;
      const next = opts.seq?.[at]?.shift();
      if (next === "reject") return Promise.reject(new TypeError("Failed to fetch"));
      if (next !== undefined) return Promise.resolve({ status: next, headers: { get: () => null }, text: () => Promise.resolve("") });
      if (opts.failAt?.includes(at) === true) return Promise.resolve({ status: 500, headers: { get: () => null }, text: () => Promise.resolve("") });
      if (opts.loadingAt?.includes(at) === true) return Promise.resolve({ status: 200, headers: { get: () => null }, text: () => Promise.resolve(`<div class="place-fill place-fill--loading is-loading" aria-busy="true" data-vf-fill="/fragment/place" data-vf-delay="2000"><p class="place-fill__note">…</p></div>`) });
      const section = `<section class="place" id="place-cards"><h2>${at}</h2></section>`;
      const answer = {
        status: 200,
        headers: {
          get: (n: string) =>
            ({
              "place-key": opts.outsideAt?.[at] === "border" ? "ags:08317057" : at,
              "place-label": encodeURIComponent(opts.labels?.[at] ?? (at.startsWith("ags:") ? "Köln" : "Köln-Ehrenfeld")),
              ...(opts.outsideAt?.[at] === undefined ? {} : { "place-outside": opts.outsideAt[at] }),
              ...(opts.slugs?.[at] === undefined ? {} : { "place-slug": opts.slugs[at] }),
            })[n] ?? null,
        },
        // #564: cards whose fuel prices are still on their way arrive wrapped for the page's filler.
        text: () => Promise.resolve(opts.pendingAt?.includes(at) === true ? `<div class="place-fill" data-vf-fill="/fragment/place">${section}</div>` : section),
      };
      if (opts.holdAt?.includes(at) === true) return new Promise((res) => f.held.set(at, () => res(answer)));
      return Promise.resolve(answer);
    },
  };
  return f;
}

const LABELS: IslandConfig["labels"] = { exact: "gerundet, ca. 500 m", approx: "ungefähr", chosen: "gewählt", germany: "Ganz Deutschland", choose: "Ort wählen", loaded: "Karten für {place} geladen", failed: "x", noGeo: "y", locating: "Standort wird ermittelt …", rough: "ungefähr (Browser)", geoNo: "kein Standort: {why}; weiter: {place}.", geoDenied: "blockiert", geoUnavailable: "nicht verfügbar", geoTimeout: "nicht innerhalb von 15 s", geoApprox: "nur ungefähr", recent: "Zuletzt", drop: "{place} entfernen", found: "Vorschläge: {n}" };
const cfg = (server: IslandConfig["server"]): IslandConfig => ({ lang: "de", server, labels: LABELS, cell: { lat: 0, lon: 0 } });
const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
};
/** #1224: spend every ask again the island waits for, in order; the waits it slept, ms. */
const spend = async (f: Fake): Promise<number[]> => {
  const slept: number[] = [];
  for (let i = 0; i < 10 && f.retries.length > 0; i++) {
    for (const t of f.retries.splice(0)) {
      slept.push(t.ms);
      t.fn();
    }
    await flush();
  }
  return slept;
};
const run = async (f: Fake, c: IslandConfig): Promise<void> => {
  // The very text the page carries.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- running the shipped script is the point
  new Function("window", islandScript(c))(f.win);
  await flush();
};

describe("the island, as shipped (src/location/island.ts → the page's inline script)", () => {
  it("is one self-contained expression with no import and no helper the bundler would rename", () => {
    const s = islandScript(cfg({ source: "none", at: null, label: null }));
    expect(s).not.toMatch(/\bimport\b|\brequire\(|(^|[^\w-])__name\(|__vite/);
    expect(s).not.toContain("</script");
  });

  it("prints the island minified from this very source (#1064; was 2.3.11's comment-line strip) — the behaviour tests run the shipped text", () => {
    const printed = islandScript(cfg({ source: "none", at: null, label: null }));
    expect(printed.startsWith(`(${minifyInline(`(${placeIsland.toString()})`)})(window, {`)).toBe(true);
    expect(printed.length).toBeLessThan(placeIsland.toString().length * 0.8);
  });

  it("stays inside the island budget (owner 2026-10-12: 20000 characters) with the REAL labels of every language", () => {
    for (const lang of LIVE_LANGS) {
      const s = islandScript({ lang, server: { source: "ip", at: "ags:05334002", label: "Alsdorf" }, labels: islandLabels(lang), cell: { lat: 0, lon: 0 } });
      expect(s.length, `the island budget, ${lang}`).toBeLessThan(20_000);
    }
  });

  it("a home load in 'prompt' state never makes the browser ask: no position read, nothing sent, nothing written (v2.0.10, owner 2026-10-13)", async () => {
    const f = fakeWindow({ permission: "prompt", position: { latitude: 50.951234, longitude: 6.917891 } });
    await run(f, cfg({ source: "ip", at: "ags:05315000", label: "Köln" }));
    expect(f.prompts).toBe(0);
    expect(f.posts).toEqual([]);
    expect(f.events).toEqual(["ip"]);
    expect(f.writes).toEqual([]);
  });

  it("an unknown permission state (no Permissions API) asks nothing either", async () => {
    const f = fakeWindow({ position: { latitude: 50.951234, longitude: 6.917891 } });
    (f.win["navigator"] as { permissions?: unknown }).permissions = undefined;
    await run(f, cfg({ source: "ip", at: "ags:05315000", label: "Köln" }));
    expect(f.prompts).toBe(0);
    expect(f.posts).toEqual([]);
    expect(f.writes).toEqual([]);
  });

  it("an already-granted permission: the position is read without a question, rounded on the device, the cards swap ONCE — and NOTHING is stored", async () => {
    const f = fakeWindow({ permission: "granted", position: { latitude: 50.951234, longitude: 6.917891 } });
    await run(f, cfg({ source: "ip", at: "ags:05315000", label: "Köln" }));
    // the fake counts a position read as a prompt; with "granted" the browser shows nothing
    expect(f.prompts).toBe(1);
    expect(f.posts).toHaveLength(1);
    expect(f.posts[0]?.url).toBe("/fragment/place");
    // only the cell left the device, in the body and never in the URL
    expect(JSON.parse(f.posts[0]?.body ?? "{}")).toEqual({ at: cellKey(50.951234, 6.917891), lang: "de", how: "browser" });
    expect(f.posts[0]?.body).not.toContain("50.951234");
    expect(f.els["place-pill-how"]?.textContent).toBe("gerundet, ca. 500 m");
    expect(f.els["place-live"]?.textContent).toBe("Karten für Köln-Ehrenfeld geladen");
    expect(f.events).toEqual(["browser"]);
    expect(f.writes).toEqual([]);
    // nothing remembered, so the line under the bar stays hidden
    expect(f.els["place-kept"]?.attrs["hidden"]).toBe("");
  });

  it("leftovers of the old rule are deleted on load — 'asked' and an 'auto' entry — and nothing else is written", async () => {
    for (const permission of ["prompt", "granted", "denied"] as const) {
      const f = fakeWindow({ permission, position: null, failCode: 3, stored: { "viafrei.place.asked": 2, "viafrei.place": { at: "pt:52.52,13.4025", label: "Berlin", how: "auto" }, "viafrei.place.recent": [{ at: "ags:09564000", label: "Nürnberg" }] } });
      await run(f, cfg({ source: "ip", at: "ags:05315000", label: "Köln" }));
      expect(f.store.has("viafrei.place.asked"), permission).toBe(false);
      expect(f.store.has("viafrei.place"), permission).toBe(false);
      expect(f.store.has("viafrei.place.recent"), permission).toBe(true);
      expect(f.writes.filter((w) => w.startsWith("set ")), permission).toEqual([]);
      // the kept area of the old rule is never sent
      expect(f.posts, permission).toEqual([]);
    }
  });

  it("a leftover 'asked' of either value changes nothing: no question, the IP place stays", async () => {
    for (const asked of [1, 2]) {
      const f = fakeWindow({ permission: "prompt", position: { latitude: 50, longitude: 7 }, stored: { "viafrei.place.asked": asked } });
      await run(f, cfg({ source: "ip", at: "ags:05315000", label: "Köln" }));
      expect(f.prompts).toBe(0);
      expect(f.posts).toEqual([]);
      expect(f.writes).toEqual(["del viafrei.place.asked"]);
      expect((f.els["place-slot"] as { attrs: Record<string, string> }).attrs["data-pending"]).toBeUndefined();
    }
  });

  it("a device holding none of the leftovers is not written to at all — not even a delete", async () => {
    const f = fakeWindow({ permission: "denied", stored: { "viafrei.place": { at: "ags:09564000", label: "Nürnberg", how: "manual" } } });
    await run(f, cfg({ source: "ip", at: "ags:05315000", label: "Köln" }));
    expect(f.writes).toEqual([]);
  });

  it("the next visit with a standing grant and a kept browser area swaps ONCE, to the fix — the kept area is not loaded first (owner: 'flaking')", async () => {
    const f = fakeWindow({ permission: "granted", position: { latitude: 50.951234, longitude: 6.917891 }, stored: { "viafrei.place": { at: "pt:52.52,13.4025", label: "Berlin", how: "browser" } } });
    await run(f, cfg({ source: "ip", at: "ags:05315000", label: "Köln" }));
    expect(f.posts.map((p) => (JSON.parse(p.body) as { at: string }).at)).toEqual([cellKey(50.951234, 6.917891)]);
    expect(f.events).toEqual(["browser"]);
    // the kept entry is not rewritten, and it is not the place shown: no line
    expect(f.writes).toEqual([]);
    expect(f.els["place-kept"]?.attrs["hidden"]).toBe("");
  });

  it("a fix that drifted across a cell edge is the kept place: the kept area's cards, one load, never a second swap — and the line says it is remembered", async () => {
    // kept pt:50.95,6.915; the fix 300 m north-east lands in the next cell
    const f = fakeWindow({ permission: "granted", position: { latitude: 50.9527, longitude: 6.9185 }, stored: { "viafrei.place": { at: "pt:50.95,6.915", label: "Köln-Altstadt", how: "browser" } } });
    await run(f, cfg({ source: "ip", at: "ags:05315000", label: "Köln" }));
    expect(cellKey(50.9527, 6.9185)).not.toBe("pt:50.95,6.915");
    expect(f.posts.map((p) => (JSON.parse(p.body) as { at: string }).at)).toEqual(["pt:50.95,6.915"]);
    expect(f.els["place-kept"]?.attrs["hidden"]).toBeUndefined();
    expect(f.writes).toEqual([]);
  });

  it("a fix inside the cards already shown reloads nothing", async () => {
    const f = fakeWindow({ permission: "granted", position: { latitude: 50.9501, longitude: 6.9151 } });
    await run(f, cfg({ source: "ip", at: "pt:50.95,6.915", label: "Köln" }));
    expect(f.posts).toEqual([]);
    expect(f.els["place-pill-how"]?.textContent).toBe("gerundet, ca. 500 m");
    expect((f.els["place-slot"] as { attrs: Record<string, string> }).attrs["data-pending"]).toBeUndefined();
  });

  it("an IP page with a kept browser area is held until the permission is known", () => {
    const f = fakeWindow({ permission: "never", stored: { "viafrei.place": { at: "pt:52.52,13.4025", label: "Berlin", how: "browser" } } });
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- running the shipped script is the point
    new Function("window", islandScript(cfg({ source: "ip", at: "ags:05315000", label: "Köln" })))(f.win);
    expect((f.els["place-slot"] as { attrs: Record<string, string> }).attrs["data-pending"]).toBe("");
  });

  it("a standing grant with a kept area, the fix swaps once — the slot was given content exactly once (2.0.8 review S4)", async () => {
    const f = fakeWindow({ permission: "granted", position: { latitude: 50.951234, longitude: 6.917891 }, stored: { "viafrei.place": { at: "pt:52.52,13.4025", label: "Berlin", how: "browser" } } });
    const slot = f.els["place-slot"] as { attrs: Record<string, string>; innerHTML: string };
    let html = slot.innerHTML;
    const swaps: string[] = [];
    Object.defineProperty(slot, "innerHTML", { get: () => html, set: (v: string) => { html = v; swaps.push(v); } });
    await run(f, cfg({ source: "ip", at: "ags:05315000", label: "Köln" }));
    expect(swaps).toHaveLength(1);
    expect(slot.attrs["data-pending"]).toBeUndefined();
    expect(f.events).toEqual(["browser"]);
  });

  it("granted but no fix (timeout): the kept area is the fallback, then the hold ends", async () => {
    const f = fakeWindow({ permission: "granted", failCode: 3, stored: { "viafrei.place": { at: "pt:52.52,13.4025", label: "Berlin", how: "browser" } } });
    await run(f, cfg({ source: "ip", at: "ags:05315000", label: "Köln" }));
    expect(f.posts.map((p) => (JSON.parse(p.body) as { at: string }).at)).toEqual(["pt:52.52,13.4025"]);
    expect((f.els["place-slot"] as { attrs: Record<string, string> }).attrs["data-pending"]).toBeUndefined();
    expect(f.els["place-kept"]?.attrs["hidden"]).toBeUndefined();
  });

  it("a kept browser area survives 'prompt' (no withdrawal) and is loaded without a question", async () => {
    const f = fakeWindow({ permission: "prompt", position: { latitude: 50, longitude: 7 }, stored: { "viafrei.place": { at: "pt:52.52,13.4025", label: "Berlin", how: "browser" } } });
    await run(f, cfg({ source: "ip", at: "ags:05315000", label: "Köln" }));
    expect(f.prompts).toBe(0);
    expect(f.posts.map((p) => (JSON.parse(p.body) as { at: string }).at)).toEqual(["pt:52.52,13.4025"]);
    expect(f.events).toEqual(["saved"]);
    expect(f.writes).toEqual([]);
  });

  it("a later visit with the permission already granted reads the position without a prompt of its own", async () => {
    const f = fakeWindow({ permission: "granted", position: { latitude: 52.52, longitude: 13.405 } });
    await run(f, cfg({ source: "none", at: null, label: null }));
    expect(f.prompts).toBe(1);
    expect(f.events).toEqual(["browser"]);
  });

  it("denied: never asked, Germany-wide stays", async () => {
    const f = fakeWindow({ permission: "denied", position: { latitude: 52.52, longitude: 13.405 } });
    await run(f, cfg({ source: "none", at: null, label: null }));
    expect(f.prompts).toBe(0);
    expect(f.events).toEqual(["none"]);
  });

  it("a remembered choice beats the IP guess, the browser is not asked over it, and the line under the bar says so", async () => {
    const f = fakeWindow({ permission: "prompt", position: { latitude: 52.52, longitude: 13.405 }, stored: { "viafrei.place": { at: "ags:09564000", label: "Nürnberg", how: "manual" } } });
    await run(f, cfg({ source: "ip", at: "ags:05315000", label: "Köln" }));
    expect(f.posts.map((p) => (JSON.parse(p.body) as { at: string }).at)).toEqual(["ags:09564000"]);
    expect(f.prompts).toBe(0);
    expect(f.events).toEqual(["saved"]);
    // #1187: a remembered place says how it was found (here: chosen), the same on every page
    expect(f.els["place-pill-how"]?.textContent).toBe("gewählt");
    expect(f.els["place-kept"]?.attrs["hidden"]).toBeUndefined();
    expect(f.writes).toEqual([]);
  });

  it("a remembered entry that is not a place key is ignored, never sent", async () => {
    const f = fakeWindow({ permission: "denied", stored: { "viafrei.place": { at: "Köln; DROP", label: "x", how: "manual" } } });
    await run(f, cfg({ source: "none", at: null, label: null }));
    expect(f.posts).toEqual([]);
    expect(f.els["place-kept"]?.attrs["hidden"]).toBe("");
  });

  it("a place page is the URL's place: nothing is swapped and nobody is asked (and nothing is written)", async () => {
    const f = fakeWindow({ permission: "prompt", position: { latitude: 52.52, longitude: 13.405 }, stored: { "viafrei.place": { at: "ags:09564000", label: "Nürnberg", how: "manual" } } });
    await run(f, cfg({ source: "page", at: "ags:05315000", label: "Köln" }));
    expect(f.posts).toEqual([]);
    expect(f.prompts).toBe(0);
    expect(f.events).toEqual(["manual"]);
    expect(f.writes).toEqual([]);
    // #1153: the header's line says a place is stored (Nürnberg) — shown while one is, on every page
    expect(f.els["place-kept"]?.attrs["hidden"]).toBeUndefined();
  });
  it("#1153: with nothing stored, a place page shows no 'remembered' line", async () => {
    const f = fakeWindow({ permission: "prompt" });
    await run(f, cfg({ source: "page", at: "ags:05315000", label: "Köln" }));
    expect(f.els["place-kept"]?.attrs["hidden"]).toBe("");
    expect(f.writes).toEqual([]);
  });
});

const click = async (f: Fake, id: string, e: unknown = {}): Promise<void> => {
  for (const fn of f.els[id]?.listeners["click"] ?? []) fn(e);
  await flush();
};
const lastAt = (f: Fake): string | undefined => {
  const p = f.posts.at(-1);
  return p === undefined ? undefined : (JSON.parse(p.body) as { at: string }).at;
};
/** An option of the sheet, as the click delegate sees it. */
const option = (href: string, name: string): unknown => {
  const a = { getAttribute: (n: string) => (n === "href" ? href : null), querySelector: () => ({ textContent: name }), textContent: name };
  return { preventDefault: () => undefined, target: { closest: (sel: string) => (sel.includes("place-opt") ? a : null) } };
};
const hidden = (f: Fake): boolean => f.els["place-kept"]?.attrs["hidden"] === "";

// The ladder's order lives in the island (ladder.ts no longer carries a copy), so each pair is run on the shipped text.
describe("the ladder's order — one test per pair, on the island as shipped (#564 acceptance 1)", () => {
  const ipServer = cfg({ source: "ip", at: "ags:05315000", label: "Köln" });
  it("a standing browser grant beats IP", async () => {
    const f = fakeWindow({ permission: "granted", position: { latitude: 50.951234, longitude: 6.917891 } });
    await run(f, ipServer);
    expect(lastAt(f)).toBe(cellKey(50.951234, 6.917891));
    expect(f.events).toEqual(["browser"]);
    expect(f.els["place-pill-how"]?.textContent).toBe("gerundet, ca. 500 m");
  });
  it("IP beats nothing — and nothing is Germany-wide", async () => {
    const ip = fakeWindow({ permission: "denied" });
    await run(ip, ipServer);
    expect(ip.posts).toEqual([]);
    expect(ip.events).toEqual(["ip"]);
    const none = fakeWindow({ permission: "denied" });
    await run(none, cfg({ source: "none", at: null, label: null }));
    expect(none.events).toEqual(["none"]);
    const outside = fakeWindow({ permission: "denied" });
    await run(outside, cfg({ source: "outside", at: null, label: null }));
    expect(outside.events).toEqual(["none"]);
  });
  it("a saved choice beats an IP guess", async () => {
    const f = fakeWindow({ permission: "denied", stored: { "viafrei.place": { at: "ags:09564000", label: "Nürnberg", how: "manual" } } });
    await run(f, ipServer);
    expect(lastAt(f)).toBe("ags:09564000");
    expect(f.events).toEqual(["saved"]);
  });
  it("a typed choice beats an IP guess, a saved choice and a granted browser", async () => {
    const f = fakeWindow({ permission: "granted", position: { latitude: 52.52, longitude: 13.405 }, withSheet: true, stored: { "viafrei.place": { at: "ags:09564000", label: "Nürnberg", how: "manual" } } });
    await run(f, ipServer);
    await click(f, "place-bar", option("#ags:08111000", "Stuttgart"));
    expect(lastAt(f)).toBe("ags:08111000");
    expect(f.els["place-pill-how"]?.textContent).toBe("gewählt");
    expect(f.prompts).toBe(0);
  });
  it("a saved CHOICE is not overridden by a granted browser; a saved browser position is", async () => {
    const choice = fakeWindow({ permission: "granted", position: { latitude: 52.52, longitude: 13.405 }, stored: { "viafrei.place": { at: "ags:05315000", label: "Köln", how: "manual" } } });
    await run(choice, cfg({ source: "none", at: null, label: null }));
    expect(choice.prompts).toBe(0);
    expect(choice.events).toEqual(["saved"]);
    const fix = fakeWindow({ permission: "granted", position: { latitude: 50.951234, longitude: 6.917891 }, stored: { "viafrei.place": { at: "pt:52.52,13.4025", label: "Berlin", how: "browser" } } });
    await run(fix, cfg({ source: "none", at: null, label: null }));
    expect(fix.prompts).toBe(1);
    expect(lastAt(fix)).toBe(cellKey(50.951234, 6.917891));
    expect(fix.events).toEqual(["browser"]);
  });
});

// The Datenschutz text promises exactly this (pinned in test/privacy-location.test.ts): the device storage is written
// ONLY as the direct result of a click in the place window (v2.0.10, owner 2026-10-13, "c").
describe("another place chosen on a place page is that place's page (#863)", () => {
  const page = cfg({ source: "page", at: "ags:05315000", label: "Köln" });
  it("a place option navigates to its own page: nothing swapped under the old heading, the choice remembered", async () => {
    const f = fakeWindow({ permission: "denied", withSheet: true });
    await run(f, page);
    await click(f, "place-bar", option("/de/place/muenchen", "München"));
    expect(f.posts).toEqual([]);
    expect(f.assigned).toEqual(["/de/place/muenchen"]);
    // #892: remembered by its page's slug, which the shell turns into the key
    expect(JSON.parse(f.store.get("viafrei.place") ?? "null")).toMatchObject({ at: "slug:muenchen", label: "München", how: "manual" });
  });
  it("an option given by a page's slug goes to that page, in the page's language; one given by a bare key (a remembered place) to the home, which shows it (#892: no address carries an AGS)", async () => {
    const f = fakeWindow({ permission: "denied", withSheet: true });
    await run(f, { ...cfg({ source: "page", at: "ags:05315000", label: "Köln" }), lang: "en" });
    await click(f, "place-bar", option("/en/place/stuttgart", "Stuttgart"));
    expect(f.assigned).toEqual(["/en/place/stuttgart"]);
    const k = fakeWindow({ permission: "denied", withSheet: true });
    await run(k, { ...cfg({ source: "page", at: "ags:05315000", label: "Köln" }), lang: "en" });
    await click(k, "place-bar", option("#ags:08111000", "Stuttgart"));
    expect(k.assigned).toEqual(["/en"]);
    expect(JSON.parse(k.store.get("viafrei.place") ?? "null")).toMatchObject({ at: "ags:08111000", how: "manual" });
  });
  it("a point has no page: the home, which shows what was just remembered", async () => {
    const f = fakeWindow({ permission: "denied", withSheet: true });
    await run(f, page);
    await click(f, "place-bar", option("#pt:52.52,13.4025", "Alexanderplatz"));
    expect(f.assigned).toEqual(["/de"]);
    expect(JSON.parse(f.store.get("viafrei.place") ?? "null")).toMatchObject({ at: "pt:52.52,13.4025", how: "manual" });
  });
  it("the page's own place again changes nothing", async () => {
    const f = fakeWindow({ permission: "denied", withSheet: true });
    await run(f, page);
    await click(f, "place-bar", option("#ags:05315000", "Köln"));
    expect(f.assigned).toEqual([]);
    // and by its page link, on its page (#892)
    const p = fakeWindow({ permission: "denied", withSheet: true, pathname: "/de/place/koeln" });
    await run(p, page);
    await click(p, "place-bar", option("/de/place/koeln", "Köln"));
    expect(p.assigned).toEqual([]);
    expect(p.posts).toEqual([]);
    expect(f.posts).toEqual([]);
  });
  it("'use my location' on a place page loads the position, then goes to its page", async () => {
    const f = fakeWindow({ permission: "prompt", position: { latitude: 52.52, longitude: 13.405 }, withSheet: true });
    await run(f, page);
    await click(f, "place-geo");
    expect(lastAt(f)).toBe(cellKey(52.52, 13.405));
    expect(f.assigned).toEqual(["/de"]);
  });
  it("2.4.4 review N2: a position answer overtaken by a newer choice restores nothing while the newer ask is in flight", async () => {
    const cell = cellKey(52.52, 13.405);
    const f = fakeWindow({ permission: "prompt", position: { latitude: 52.52, longitude: 13.405 }, withSheet: true, holdAt: [cell, "slug:muenchen"] });
    await run(f, cfg({ source: "ip", at: "ags:05315000", label: "Köln" }));
    await click(f, "place-geo");
    expect(f.held.has(cell)).toBe(true);
    expect(f.els["place-pill-how"]?.textContent).toBe("Standort wird ermittelt …");
    // a place chosen while the position's cards are on their way: the newer ask
    await click(f, "place-bar", option("/de/place/muenchen", "München"));
    expect(f.held.has("slug:muenchen")).toBe(true);
    // the overtaken answer lands first: no repill to the IP place, no cards swapped, nothing kept
    f.held.get(cell)?.();
    await flush();
    expect(f.els["place-pill-how"]?.textContent).toBe("Standort wird ermittelt …");
    expect(f.els["place-slot"]?.innerHTML).not.toContain(cell);
    expect(f.writes).toEqual([]);
    // the newer ask lands and is shown
    f.held.get("slug:muenchen")?.();
    await flush();
    expect(f.els["place-pill-how"]?.textContent).toBe("gewählt");
    expect(f.els["place-slot"]?.innerHTML).toContain("slug:muenchen");
  });
  it("on the home the cards are swapped in place and nothing navigates", async () => {
    const f = fakeWindow({ permission: "denied", withSheet: true });
    await run(f, cfg({ source: "ip", at: "ags:05315000", label: "Köln" }));
    await click(f, "place-bar", option("/de/place/muenchen", "München"));
    expect(lastAt(f)).toBe("slug:muenchen");
    expect(f.assigned).toEqual([]);
  });
});

describe("what the island writes to the device, and when (v2.0.10: only on a click in our own window)", () => {
  const none = cfg({ source: "none", at: null, label: null });
  const ipServer = cfg({ source: "ip", at: "ags:05315000", label: "Köln" });
  it("no home load writes anything, in any permission state, with or without a fix", async () => {
    for (const permission of ["prompt", "granted", "denied"] as const) {
      for (const position of [null, { latitude: 52.52, longitude: 13.405 }]) {
        const f = fakeWindow({ permission, position, failCode: 3, withSheet: true });
        await run(f, ipServer);
        expect(f.writes, `${permission} ${position === null ? "no fix" : "fix"}`).toEqual([]);
        expect(hidden(f)).toBe(true);
      }
    }
  });
  it("going to the bar from the place radio writes nothing (#1112: no window to open or close)", async () => {
    const f = fakeWindow({ permission: "prompt", withSheet: true });
    await run(f, none);
    await click(f, "place-pill", { preventDefault: () => undefined });
    expect(f.writes).toEqual([]);
  });
  it("'use my location' is the one thing that makes the browser ask — and it stores the cell, and only the cell", async () => {
    const f = fakeWindow({ permission: "prompt", position: { latitude: 50.951234, longitude: 6.917891 }, withSheet: true });
    await run(f, none);
    expect(f.prompts).toBe(0);
    expect(f.writes).toEqual([]);
    await click(f, "place-geo");
    expect(f.prompts).toBe(1);
    expect(JSON.parse(f.store.get("viafrei.place") ?? "null")).toEqual(withMonth({ at: cellKey(50.951234, 6.917891), label: "Köln-Ehrenfeld", how: "browser" }));
    expect(f.writes).toEqual(["set viafrei.place"]);
    expect(f.store.has("viafrei.place.asked")).toBe(false);
    expect(f.store.has("viafrei.place.recent")).toBe(false);
    expect(hidden(f)).toBe(false);
  });
  it("'use my location' declined: nothing is written, and the line stays hidden", async () => {
    const f = fakeWindow({ permission: "prompt", position: null, failCode: 1, withSheet: true });
    await run(f, none);
    await click(f, "place-geo");
    expect(f.prompts).toBe(1);
    expect(f.writes).toEqual([]);
    expect(hidden(f)).toBe(true);
  });
  it("the fix succeeds but the cards fail to load: nothing is written", async () => {
    const at = cellKey(52.52, 13.405);
    const f = fakeWindow({ permission: "granted", position: { latitude: 52.52, longitude: 13.405 }, failAt: [at], withSheet: true });
    await run(f, none);
    await click(f, "place-geo");
    expect(f.writes).toEqual([]);
  });
  // #1070: a position outside Germany is shown — the nearest German place's cards near the border, all of Germany
  // farther — and NOTHING about it is stored.
  it("'use my location' in Strasbourg (border): Kehl's cards are shown and nothing is written (#1070)", async () => {
    const at = cellKey(48.5734, 7.7521);
    const f = fakeWindow({ permission: "prompt", position: { latitude: 48.5734, longitude: 7.7521 }, withSheet: true, outsideAt: { [at]: "border" }, labels: { [at]: "Kehl" } });
    await run(f, none);
    await click(f, "place-geo");
    expect(f.prompts).toBe(1);
    expect(f.els["place-pill-label"]!.textContent).toBe("Kehl");
    expect(String(f.els["place-slot"]!.innerHTML)).toContain(at);
    expect(f.writes).toEqual([]);
    expect(hidden(f)).toBe(true);
  });
  for (const [where, lat, lon] of [["Paris", 48.8566, 2.3522], ["Reykjavik", 64.1466, -21.9426]] as const) {
    it(`'use my location' in ${where} (far): all of Germany, not an error, and nothing is written (#1070)`, async () => {
      const at = cellKey(lat, lon);
      const f = fakeWindow({ permission: "prompt", position: { latitude: lat, longitude: lon }, withSheet: true, outsideAt: { [at]: "far" } });
      await run(f, none);
      await click(f, "place-geo");
      // #1088: "Ganz Deutschland" is the other radio's state; the place radio names no place yet ("Ort wählen").
      expect(f.els["place-pill-label"]!.textContent).toBe("Ort wählen");
      expect(f.els["place-live"]!.textContent).toBe("Ganz Deutschland");
      expect(f.writes).toEqual([]);
      expect(hidden(f)).toBe(true);
    });
  }
  it("a standing grant read silently in Paris: all of Germany, nothing written, the browser area kept as it was (#1070)", async () => {
    const at = cellKey(48.8566, 2.3522);
    const f = fakeWindow({ permission: "granted", position: { latitude: 48.8566, longitude: 2.3522 }, outsideAt: { [at]: "far" } });
    await run(f, none);
    expect(f.els["place-pill-label"]!.textContent).toBe("Ort wählen");
    expect(f.writes).toEqual([]);
  });
  it("a typed choice is remembered with its recent list, and wins on the next visit over the IP guess and a granted browser", async () => {
    const kept = fakeWindow({ permission: "denied", withSheet: true });
    await run(kept, none);
    await click(kept, "place-bar", option("#ags:08111000", "Stuttgart"));
    expect(JSON.parse(kept.store.get("viafrei.place") ?? "null")).toMatchObject({ at: "ags:08111000", how: "manual" });
    expect(kept.writes).toEqual(["set viafrei.place", "set viafrei.place.recent"]);
    expect(hidden(kept)).toBe(false);
    // the next visit: the IP says Köln and the browser holds a standing grant elsewhere — the choice is what loads
    const next = fakeWindow({ permission: "granted", position: { latitude: 52.52, longitude: 13.405 }, stored: Object.fromEntries([...kept.store].map(([k, v]) => [k, JSON.parse(v) as unknown])) });
    await run(next, ipServer);
    expect(next.prompts).toBe(0);
    expect(next.posts.map((p) => (JSON.parse(p.body) as { at: string }).at)).toEqual(["ags:08111000"]);
    expect(next.events).toEqual(["saved"]);
    expect(next.writes).toEqual([]);
  });
  it("'all of Germany' is remembered: the next visit drops the IP cards before paint, asks the browser nothing, loads nothing", async () => {
    const f = fakeWindow({ permission: "prompt", position: { latitude: 52.52, longitude: 13.405 }, withSheet: true });
    await run(f, none);
    await click(f, "place-scope-de", { preventDefault: () => undefined });
    expect(JSON.parse(f.store.get("viafrei.place") ?? "null")).toEqual(withMonth({ at: null, label: "", how: "germany" }));
    expect(hidden(f)).toBe(false);
    const next = fakeWindow({ permission: "granted", position: { latitude: 52.52, longitude: 13.405 }, stored: { "viafrei.place": { at: null, label: "", how: "germany" } } });
    const slot = next.els["place-slot"];
    if (slot !== undefined) slot.innerHTML = "<section>IP cards</section>";
    await run(next, ipServer);
    expect(next.els["place-slot"]?.innerHTML).toBe("");
    expect(next.els["place-slot"]?.attrs["data-pending"]).toBeUndefined();
    // #1088: the place radio names the IP guess it would go back to; "Ganz Deutschland" is the radio that is on
    expect(next.els["place-pill-label"]?.textContent).toBe("Köln");
    expect(next.prompts).toBe(0);
    expect(next.posts).toEqual([]);
    expect(next.events).toEqual(["none"]);
    expect(hidden(next)).toBe(false);
  });
  it("a remembered 'use my location' area is deleted when the location is BLOCKED, and not on 'prompt' (steward L2)", async () => {
    const stored = { "viafrei.place": { at: "pt:50.95,6.92", label: "Köln-Ehrenfeld", how: "browser" } };
    const blocked = fakeWindow({ permission: "denied", stored });
    await run(blocked, ipServer);
    expect(blocked.store.has("viafrei.place")).toBe(false);
    expect(blocked.posts).toEqual([]);
    expect(blocked.events).toEqual(["ip"]);
    expect(hidden(blocked)).toBe(true);
    const again = fakeWindow({ permission: "prompt", position: null, failCode: 3, stored });
    await run(again, ipServer);
    expect(again.store.has("viafrei.place")).toBe(true);
  });
  it("'forget place' after 'all of Germany' gives the automatic ladder back", async () => {
    const f = fakeWindow({ permission: "denied", withSheet: true, stored: { "viafrei.place": { at: null, label: "", how: "germany" } } });
    await run(f, ipServer);
    expect(f.posts).toEqual([]);
    await click(f, "place-forget");
    expect(f.store.has("viafrei.place")).toBe(false);
    expect(hidden(f)).toBe(true);
    const next = fakeWindow({ permission: "denied", stored: Object.fromEntries([...f.store].map(([k, v]) => [k, JSON.parse(v) as unknown])) });
    const slot = next.els["place-slot"];
    if (slot !== undefined) slot.innerHTML = "<section>IP cards</section>";
    await run(next, ipServer);
    expect(next.els["place-slot"]?.innerHTML).toBe("<section>IP cards</section>");
    expect(next.events).toEqual(["ip"]);
  });
  it("a permission query that never settles does not block the rung: the 10 s settle still fires", async () => {
    const f = fakeWindow({ permission: "never", position: { latitude: 50, longitude: 7 } });
    await run(f, ipServer);
    expect(f.events).toEqual([]);
    expect(f.timers.length).toBeGreaterThanOrEqual(1);
    for (const fire of f.timers) fire();
    expect(f.events).toEqual(["ip"]);
    expect(f.prompts).toBe(0);
  });
});

// Owner 2026-10-13, "b": whenever something remembered on this device is in use, say so — with "forget place".
describe("the line under the bar (v2.0.10): shown exactly while a remembered entry is in use", () => {
  const ipServer = cfg({ source: "ip", at: "ags:05315000", label: "Köln" });
  it("is hidden on a first visit and shown on a visit that uses the remembered place", async () => {
    const first = fakeWindow({ permission: "denied" });
    await run(first, ipServer);
    expect(hidden(first)).toBe(true);
    const back = fakeWindow({ permission: "denied", stored: { "viafrei.place": { at: "ags:05315000", label: "Köln", how: "manual" } } });
    await run(back, ipServer);
    // the remembered place IS the server's: used without a load, the line still says so
    expect(back.posts).toEqual([]);
    expect(hidden(back)).toBe(false);
  });
  it("#1153: is shown when the remembered place cannot be loaded too — it is in the header of every page, and says what this device keeps", async () => {
    // owner 2026-11-03: "Your browser remembers this place · Forget place", only while a place is stored (until 2.5.7
    // it stayed hidden here, because the line sat under the cards and spoke of them)
    const f = fakeWindow({ permission: "denied", failAt: ["ags:05111000"], stored: { "viafrei.place": { at: "ags:05111000", label: "Düsseldorf", how: "manual" } } });
    await run(f, ipServer);
    await spend(f);
    expect(hidden(f)).toBe(false);
    expect(f.writes).toEqual([]);
  });
  it("its control forgets everything the device remembered, at once, and the line goes", async () => {
    const f = fakeWindow({ permission: "denied", withSheet: true, stored: { "viafrei.place": { at: "ags:09564000", label: "Nürnberg", how: "manual" }, "viafrei.place.recent": [{ at: "ags:09564000", label: "Nürnberg" }] } });
    await run(f, ipServer);
    expect(hidden(f)).toBe(false);
    await click(f, "place-kept-forget");
    expect(f.store.has("viafrei.place")).toBe(false);
    expect(f.store.has("viafrei.place.recent")).toBe(false);
    expect(f.writes).toEqual(["del viafrei.place", "del viafrei.place.recent"]);
    expect(hidden(f)).toBe(true);
  });
  it("works without the sheet too (the line is outside it)", async () => {
    const f = fakeWindow({ permission: "denied", stored: { "viafrei.place": { at: "ags:09564000", label: "Nürnberg", how: "manual" } } });
    await run(f, ipServer);
    await click(f, "place-kept-forget");
    expect(f.store.has("viafrei.place")).toBe(false);
    expect(hidden(f)).toBe(true);
  });
  it("is part of the page itself, hidden until the island shows it, with 'Ort vergessen' as a button", () => {
    const block = readFileSync(join(HERE, "..", "src", "components", "PlaceBar.astro"), "utf8");
    expect(block).toContain('<p class="placebar__kept" id="place-kept" hidden>{t(lang, "place.kept")}');
    expect(all(block, "button[type=\"button\"].placebar__forget[id=\"place-kept-forget\"]").map(nodeText)).toContain("{t(lang, \"place.sheet.forget\")}");
  });
});

// Owner 2026-10-13: "also show full address or name of the location not just the city".
describe("the full label of a pick (v2.0.10)", () => {
  const none = cfg({ source: "none", at: null, label: null });
  const pick = "pt:50.87313,6.17051";
  const cell = "pt:50.875,6.1725";
  it("a picked address keeps its full label on the pill, in viafrei.place and in the recent list — under its own key", async () => {
    const f = fakeWindow({ permission: "denied", withSheet: true, labels: { [pick]: "Dachsweg 12, Alsdorf" } });
    // the card service answers with the canonical CELL key and the pick's full label
    const fetch0 = f.win["fetch"] as (u: string, i: { body: string }) => Promise<{ headers: { get(n: string): string | null } }>;
    f.win["fetch"] = async (u: string, i: { body: string }) => {
      const r = await fetch0(u, i);
      return { ...r, headers: { get: (n: string) => (n === "place-key" ? cell : r.headers.get(n)) } };
    };
    await run(f, none);
    await click(f, "place-bar", option(`#${pick}`, "Dachsweg 12, Alsdorf"));
    expect(lastAt(f)).toBe(pick);
    expect(f.els["place-pill-label"]?.textContent).toBe("Dachsweg 12, Alsdorf");
    expect(JSON.parse(f.store.get("viafrei.place") ?? "null")).toEqual(withMonth({ at: pick, label: "Dachsweg 12, Alsdorf", how: "manual" }));
    // #1158: kept as what it was picked as — an address is a point
    expect(JSON.parse(f.store.get("viafrei.place.recent") ?? "null")).toEqual([withMonth({ at: pick, label: "Dachsweg 12, Alsdorf", k: "point" })]);
  });
  it("the next visit shows the full label at once and asks for the pick's own key again", async () => {
    const f = fakeWindow({ permission: "denied", labels: { [pick]: "Dachsweg 12, Alsdorf" }, stored: { "viafrei.place": { at: pick, label: "Dachsweg 12, Alsdorf", how: "manual" } } });
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- running the shipped script is the point
    new Function("window", islandScript(cfg({ source: "ip", at: "ags:05315000", label: "Köln" })))(f.win);
    expect(f.els["place-pill-label"]?.textContent).toBe("Dachsweg 12, Alsdorf");
    await flush();
    expect(lastAt(f)).toBe(pick);
    expect(f.els["place-pill-label"]?.textContent).toBe("Dachsweg 12, Alsdorf");
  });
  it("a recent entry is listed with its full label, as text (never markup)", async () => {
    const f = fakeWindow({ permission: "denied", withSheet: true, stored: { "viafrei.place.recent": [{ at: pick, label: "Aachen Hbf, Aachen" }, { at: "ags:05334002", label: "<b>x</b>" }] } });
    await run(f, none);
    const items = f.els["place-recent"]?.children ?? [];
    expect(items).toHaveLength(2);
    const spans = items.map((li) => li.children[0]?.children[0]);
    expect(spans.map((sp) => sp?.textContent)).toEqual(["Aachen Hbf, Aachen", "<b>x</b>"]);
    expect(spans.every((sp) => sp?.innerHTML === "")).toBe(true);
    // #1112: every chip is an ordinary link carrying its key — a position (never in a URL) links the page itself, a
    // Gemeinde the address the home answers (`?at=`); the island takes the click by the key
    expect(items.map((li) => li.children[0]?.id)).toEqual(["a", "a"]);
    expect(items.map((li) => li.children[0]?.attrs["href"])).toEqual(["/de", "/de?at=ags:05334002"]);
    expect(items.map((li) => li.children[0]?.attrs["data-at"])).toEqual([pick, "ags:05334002"]);
  });
  it("a picked station falls back to the text it was listed with when the answer carries no label", async () => {
    const f = fakeWindow({ permission: "denied", withSheet: true, labels: { [pick]: "" } });
    await run(f, none);
    await click(f, "place-bar", option(`#${pick}`, "Aachen Hbf, Aachen"));
    expect((JSON.parse(f.store.get("viafrei.place") ?? "null") as { label: string }).label).toBe("Aachen Hbf, Aachen");
  });
});

describe("privacy by construction (#564 § 6)", () => {
  const LOC = join(HERE, "..", "src", "location");
  const files = readdirSync(LOC).filter((f) => f.endsWith(".ts"));
  it("reads the location module", () => expect(files.length).toBeGreaterThanOrEqual(5));
  it("nothing in src/location/ logs, writes a file or calls out", () => {
    for (const f of files) {
      const src = readFileSync(join(LOC, f), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      expect(src, f).not.toMatch(/console\.|\blog\(|writeFileSync|appendFileSync|createWriteStream|\bhttps?:\/\//);
    }
  });
  it("the island calls this origin only — four relative routes (#890: the motorway page's around block; #1171: the object lookup), no other fetch", () => {
    const s = readFileSync(join(LOC, "island.ts"), "utf8");
    expect([...s.matchAll(/\.fetch\(\s*(?:A \? "([^"]+)" : )?"([^"]+)"/g)].flatMap((m) => [m[1], m[2]]).filter((x) => x !== undefined).sort()).toEqual(["/fragment/motorway-around", "/fragment/place", "/fragment/spot", "/fragment/suggest"]);
    expect(s).not.toMatch(/\.fetch\(\s*[^"A\s]/);
    expect(s).not.toMatch(/\.fetch\(\s*`/);
  });
  it("review 2.3.8 (dbip_city_lite): the island never hides the DB-IP credit — it stays wherever the lookup ran", () => {
    expect(islandScript(cfg({ source: "ip", at: "ags:05315000", label: "Köln" }))).not.toContain("placebar__credit");
  });
});

// ---------------------------------------------------------------------------
// #564: the island says HOW it got each place it asks for (owner 2026-10-12)
// ---------------------------------------------------------------------------

describe("the island's `how` field (#564 fuel refresh), as shipped", () => {
  const hows = (f: Fake): unknown[] => f.posts.map((p) => (JSON.parse(p.body) as { how?: unknown }).how);
  const ip = cfg({ source: "ip", at: "ags:05315000", label: "Köln" });

  it("a remembered CHOICE is sent as 'saved'", async () => {
    const f = fakeWindow({ permission: "denied", stored: { "viafrei.place": { at: "ags:09564000", label: "Nürnberg", how: "manual" } } });
    await run(f, ip);
    expect(hows(f)).toEqual(["saved"]);
  });

  it("a remembered browser area is 'saved' too; with a standing grant the fresh fix is 'browser' — and no load ever says 'auto' (v2.0.10)", async () => {
    const b = fakeWindow({ permission: "prompt", position: null, stored: { "viafrei.place": { at: "pt:52.52,13.4025", label: "Berlin", how: "browser" } } });
    await run(b, ip);
    expect(hows(b)).toEqual(["saved"]);
    const a = fakeWindow({ permission: "granted", position: { latitude: 50.951234, longitude: 6.917891 }, stored: { "viafrei.place": { at: "pt:52.52,13.4025", label: "Berlin", how: "browser" } } });
    await run(a, ip);
    // granted: one load, the fresh fix (the kept area is only the fallback)
    expect(hows(a)).toEqual(["browser"]);
    expect(readFileSync(join(HERE, "..", "src", "location", "island.ts"), "utf8")).not.toMatch(/load\([^)]*"auto"/);
  });

  it("a place picked in the sheet is 'manual'", async () => {
    const f = fakeWindow({ permission: "denied", withSheet: true });
    await run(f, cfg({ source: "none", at: null, label: null }));
    const sheet = f.els["place-bar"]!;
    const a = { getAttribute: (n: string) => (n === "href" ? "/de/place/nuernberg" : null), querySelector: () => null, textContent: "Nürnberg" };
    for (const l of sheet.listeners["click"] ?? []) l({ target: { closest: (sel: string) => (sel.includes("place-opt") ? a : null) }, preventDefault: () => undefined });
    await flush();
    expect(hows(f)).toEqual(["manual"]);
    expect(JSON.parse(f.posts[0]?.body ?? "{}")).toEqual({ at: "slug:nuernberg", lang: "de", how: "manual" });
  });

  it("the IP guess and a place page send nothing: the server rendered them and asked for their prices itself", async () => {
    const f = fakeWindow({ permission: "denied" });
    await run(f, ip);
    expect(f.posts).toEqual([]);
    const page = fakeWindow({ permission: "granted", position: { latitude: 50, longitude: 7 } });
    await run(page, cfg({ source: "page", at: "ags:05315000", label: "Köln" }));
    expect(page.posts).toEqual([]);
  });

  it("on the home's AUTOMATIC reload (?r=auto) every automatic load says 'held' — nothing a person did not do asks — and the mark leaves the address (#564 review)", async () => {
    const saved = fakeWindow({ permission: "denied", search: "?r=auto", stored: { "viafrei.place": { at: "ags:09564000", label: "Nürnberg", how: "manual" } } });
    await run(saved, ip);
    expect(hows(saved)).toEqual(["held"]);
    expect(saved.replaced).toEqual(["/de"]);
    const auto = fakeWindow({ permission: "granted", search: "?r=auto", position: { latitude: 50.951234, longitude: 6.917891 }, stored: { "viafrei.place": { at: "pt:52.52,13.4025", label: "Berlin", how: "browser" } } });
    await run(auto, ip);
    expect(hows(auto)).toEqual(["held"]);
    // another parameter survives, only the mark goes
    const other = fakeWindow({ permission: "denied", search: "?x=1&r=auto" });
    await run(other, ip);
    expect(other.replaced).toEqual(["/de?x=1"]);
  });

  it("…until the person opens the place bar: what they choose then is their request again", async () => {
    const f = fakeWindow({ permission: "denied", withSheet: true, search: "?r=auto" });
    await run(f, cfg({ source: "none", at: null, label: null }));
    for (const l of f.els["place-pill"]!.listeners["click"] ?? []) l({ preventDefault: () => undefined });
    const sheet = f.els["place-bar"]!;
    const a = { getAttribute: (n: string) => (n === "href" ? "/de/place/nuernberg" : null), querySelector: () => null, textContent: "Nürnberg" };
    for (const l of sheet.listeners["click"] ?? []) l({ target: { closest: (sel: string) => (sel.includes("place-opt") ? a : null) }, preventDefault: () => undefined });
    await flush();
    expect(hows(f)).toEqual(["manual"]);
  });

  it("an address without the mark is left alone", async () => {
    const f = fakeWindow({ permission: "denied", search: "?r=autox", stored: { "viafrei.place": { at: "ags:09564000", label: "Nürnberg", how: "manual" } } });
    await run(f, ip);
    expect(hows(f)).toEqual(["saved"]);
    expect(f.replaced).toEqual([]);
  });

  it("cards whose prices are still on their way are swapped in and the page's filler is woken", async () => {
    const at = cellKey(50.951234, 6.917891);
    const f = fakeWindow({ permission: "granted", position: { latitude: 50.951234, longitude: 6.917891 }, pendingAt: [at] });
    await run(f, ip);
    expect(f.els["place-slot"]?.innerHTML).toMatch(/^<div class="place-fill" data-vf-fill="\/fragment\/place"><section class="place" id="place-cards">/);
    expect(f.dispatched).toContain("vf:fill");
  });

  it("the filler's 'vf:filled' names the place on the pill — a placeholder the first render could not wait for", async () => {
    const f = fakeWindow({ permission: "denied" });
    await run(f, cfg({ source: "ip", at: "pt:50.875,6.1725", label: null }));
    for (const l of f.docListeners["vf:filled"] ?? []) l({ detail: { id: "place-cards", label: "Alsdorf", key: "ags:05334002" } });
    expect(f.els["place-pill-label"]?.textContent).toBe("Alsdorf");
    expect(f.els["place-pill-how"]?.textContent).toBe("ungefähr");
    // anything else is not the place cards and moves nothing
    for (const l of f.docListeners["vf:filled"] ?? []) l({ detail: { id: "tile-fuel", label: "x", key: null } });
    expect(f.els["place-pill-label"]?.textContent).toBe("Alsdorf");
  });
});

/**
 * Owner 2026-10-12: "When I open the site it shows the location by ip and
 * switch to the browser location in the next seconds. It is visible and looks
 * ugly." A remembered place that differs from the server's holds the cards
 * hidden from the script's synchronous first step — before the first paint —
 * and names the remembered place in the pill at once.
 */
describe("no visible jump from the IP guess to the remembered place, as shipped", () => {
  const ipServer = cfg({ source: "ip", at: "ags:05315000", label: "Köln" });
  const start = (f: Fake, c: IslandConfig): void => {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- running the shipped script is the point
    new Function("window", islandScript(c))(f.win);
  };
  const slotOf = (f: Fake): El => f.els["place-slot"] as El;
  /** The pill as the server rendered it for the IP rung. */
  const rendered = (f: Fake): Fake => {
    (f.els["place-pill-label"] as El).textContent = "Köln";
    (f.els["place-pill-how"] as El).textContent = "ungefähr";
    return f;
  };

  it("holds the IP cards hidden before any await, the pill already names the remembered place, and shows the swapped cards", async () => {
    const f = fakeWindow({ stored: { "viafrei.place": { at: "ags:05111000", label: "Düsseldorf", how: "manual" } }, permission: "denied" });
    start(f, ipServer);
    // Synchronously, before the permission query or the fetch has answered:
    expect(slotOf(f).attrs["data-pending"]).toBe("");
    expect(slotOf(f).attrs["aria-busy"]).toBe("true");
    expect(f.els["place-pill-label"]?.textContent).toBe("Düsseldorf");
    await flush();
    expect(lastAt(f)).toBe("ags:05111000");
    expect(slotOf(f).attrs["data-pending"]).toBeUndefined();
    expect(slotOf(f).attrs["aria-busy"]).toBeUndefined();
  });

  it("a remembered place that cannot be loaded: the server's cards are shown and the pill is put back", async () => {
    const f = rendered(fakeWindow({ stored: { "viafrei.place": { at: "ags:05111000", label: "Düsseldorf", how: "manual" } }, permission: "denied", failAt: ["ags:05111000"] }));
    await run(f, ipServer);
    await spend(f);
    expect(slotOf(f).attrs["data-pending"]).toBeUndefined();
    expect(f.els["place-pill-label"]?.textContent).toBe("Köln");
    expect(f.els["place-pill-how"]?.textContent).toBe("ungefähr");
  });

  it("a leftover automatic entry (before v2.0.10) is deleted before the first paint: nothing held, the IP place as rendered", async () => {
    const f = rendered(fakeWindow({ stored: { "viafrei.place": { at: "pt:51.2,6.8", label: "Düsseldorf-Mitte", how: "auto" } }, permission: "granted", position: null, failCode: 3 }));
    start(f, ipServer);
    expect(slotOf(f).attrs["data-pending"]).toBeUndefined();
    expect(f.store.has("viafrei.place")).toBe(false);
    await flush();
    expect(f.els["place-pill-label"]?.textContent).toBe("Köln");
    expect(f.posts).toEqual([]);
  });

  it("a remembered browser area whose location is now blocked: held for the check, deleted, then the IP place as rendered", async () => {
    const f = rendered(fakeWindow({ stored: { "viafrei.place": { at: "pt:51.2,6.8", label: "Düsseldorf-Mitte", how: "browser" } }, permission: "denied" }));
    start(f, ipServer);
    expect(slotOf(f).attrs["data-pending"]).toBe("");
    await flush();
    expect(slotOf(f).attrs["data-pending"]).toBeUndefined();
    expect(f.els["place-pill-label"]?.textContent).toBe("Köln");
    expect(f.store.has("viafrei.place")).toBe(false);
    expect(f.posts).toEqual([]);
  });

  it("is never held when the remembered place IS the server's, nor on a place page", () => {
    const same = fakeWindow({ stored: { "viafrei.place": { at: "ags:05315000", label: "Köln", how: "manual" } }, permission: "denied" });
    start(same, ipServer);
    expect(slotOf(same).attrs["data-pending"]).toBeUndefined();
    const page = fakeWindow({ stored: { "viafrei.place": { at: "ags:05111000", label: "Düsseldorf", how: "manual" } } });
    start(page, cfg({ source: "page", at: "ags:05315000", label: "Köln" }));
    expect(slotOf(page).attrs["data-pending"]).toBeUndefined();
  });

  it("a load that never ends: after five seconds the server's cards AND the pill they were rendered with (review)", () => {
    const f = rendered(fakeWindow({ stored: { "viafrei.place": { at: "ags:05111000", label: "Düsseldorf", how: "manual" } }, permission: "never" }));
    start(f, ipServer);
    expect(slotOf(f).attrs["data-pending"]).toBe("");
    expect(f.els["place-pill-label"]?.textContent).toBe("Düsseldorf");
    for (const t of f.timers) t();
    expect(slotOf(f).attrs["data-pending"]).toBeUndefined();
    expect(f.els["place-pill-label"]?.textContent).toBe("Köln");
    expect(f.els["place-pill-how"]?.textContent).toBe("ungefähr");
  });

  it("'all of Germany' pressed while held ends the hold, and nothing puts the IP place back afterwards (review)", async () => {
    const f = rendered(fakeWindow({ stored: { "viafrei.place": { at: "ags:05111000", label: "Düsseldorf", how: "manual" } }, permission: "never", withSheet: true }));
    start(f, ipServer);
    for (const fn of f.els["place-scope-de"]?.listeners["click"] ?? []) fn({ preventDefault: () => undefined });
    expect(slotOf(f).attrs["data-pending"]).toBeUndefined();
    const after = f.els["place-pill-label"]?.textContent;
    for (const t of f.timers) t();
    await flush();
    expect(f.els["place-pill-label"]?.textContent).toBe(after);
    expect(after).not.toBe("Köln");
  });

  it("the filler naming the held server cards changes what the pill returns to, not the pill (review)", () => {
    const f = rendered(fakeWindow({ stored: { "viafrei.place": { at: "ags:05111000", label: "Düsseldorf", how: "manual" } }, permission: "never" }));
    start(f, ipServer);
    for (const fn of f.docListeners["vf:filled"] ?? []) fn({ detail: { id: "place-cards", label: "Köln-Innenstadt", key: "ags:05315000" } });
    expect(f.els["place-pill-label"]?.textContent).toBe("Düsseldorf");
    for (const t of f.timers) t();
    expect(f.els["place-pill-label"]?.textContent).toBe("Köln-Innenstadt");
  });

  it("the filler bringing the remembered place itself while held: the pill keeps the remembered word, not the IP one (review)", async () => {
    const f = rendered(fakeWindow({ stored: { "viafrei.place": { at: "ags:05111000", label: "Düsseldorf", how: "manual" } }, permission: "denied" }));
    start(f, ipServer);
    for (const fn of f.docListeners["vf:filled"] ?? []) fn({ detail: { id: "place-cards", label: "Düsseldorf", key: "ags:05111000" } });
    await flush();
    for (const t of f.timers) t();
    expect(slotOf(f).attrs["data-pending"]).toBeUndefined();
    expect(f.els["place-pill-label"]?.textContent).toBe("Düsseldorf");
    expect(f.els["place-pill-how"]?.textContent).not.toBe("ungefähr");
  });
});

// Owner 2026-10-13: "The just my location does not work anymore. It located me to alsdorf" and "if I refresh the page
// it loses my position". The click asks for a fresh, precise fix and says, where it is seen, when none came; a silent
// fix on a standing grant replaces a remembered or server place only when its own accuracy allows it.
describe("'use my location': a fresh precise fix, a visible answer when none comes, and a coarse fix that replaces nothing (2026-10-13)", () => {
  const ipServer = cfg({ source: "ip", at: "ags:05334002", label: "Alsdorf" });
  const msg = (f: Fake): string | null => (f.els["place-geo-msg"]?.attrs["hidden"] === "" ? null : (f.els["place-geo-msg"]?.textContent ?? ""));
  const at0 = (f: Fake): string[] => f.posts.map((p) => (JSON.parse(p.body) as { at: string }).at);

  it("the click asks for a fresh, precise fix; the silent read on a standing grant stays cheap", async () => {
    const f = fakeWindow({ permission: "granted", position: { latitude: 50.951234, longitude: 6.917891 }, withSheet: true });
    await run(f, ipServer);
    await click(f, "place-geo");
    expect(f.geoOpts).toEqual([
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 7_000 },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    ]);
  });

  for (const [code, text] of [
    [1, "kein Standort: blockiert; weiter: Alsdorf."],
    [2, "kein Standort: nicht verfügbar; weiter: Alsdorf."],
    [3, "kein Standort: nicht innerhalb von 15 s; weiter: Alsdorf."],
  ] as const) {
    it(`a click whose fix fails with code ${code} says so where it is seen, stores nothing and keeps the shown place`, async () => {
      const f = fakeWindow({ permission: "prompt", position: null, failCode: code, withSheet: true });
      f.els["place-pill-label"]!.textContent = "Alsdorf";
      f.els["place-pill-how"]!.textContent = "ungefähr";
      await run(f, ipServer);
      expect(msg(f)).toBeNull();
      await click(f, "place-geo");
      expect(f.prompts).toBe(1);
      expect(msg(f)).toBe(text);
      expect(f.els["place-live"]?.textContent).toBe("y");
      expect(f.writes).toEqual([]);
      expect(f.posts).toEqual([]);
      expect(f.els["place-pill-label"]?.textContent).toBe("Alsdorf");
      expect(f.els["place-pill-how"]?.textContent).toBe("ungefähr");
      expect(f.els["place-pill"]?.attrs["aria-busy"]).toBeUndefined();
      expect(hidden(f)).toBe(true);
    });
  }

  it("a browser without the geolocation API: the 'unavailable' line, nothing stored", async () => {
    const f = fakeWindow({ permission: "prompt", withSheet: true });
    f.els["place-pill-label"]!.textContent = "Alsdorf";
    (f.win["navigator"] as { geolocation?: unknown }).geolocation = undefined;
    await run(f, ipServer);
    await click(f, "place-geo");
    expect(msg(f)).toBe("kein Standort: nicht verfügbar; weiter: Alsdorf.");
    expect(f.writes).toEqual([]);
  });

  it("a success after a failure clears the line, loads the cell and remembers it", async () => {
    const opts: { permission: "prompt"; position: { latitude: number; longitude: number } | null; failCode: 3; withSheet: true } = { permission: "prompt", position: null, failCode: 3, withSheet: true };
    const f = fakeWindow(opts);
    f.els["place-pill-label"]!.textContent = "Alsdorf";
    await run(f, ipServer);
    await click(f, "place-geo");
    expect(msg(f)).toBe("kein Standort: nicht innerhalb von 15 s; weiter: Alsdorf.");
    opts.position = { latitude: 50.8801, longitude: 6.1702 };
    await click(f, "place-geo");
    expect(msg(f)).toBeNull();
    expect(lastAt(f)).toBe(cellKey(50.8801, 6.1702));
    expect(JSON.parse(f.store.get("viafrei.place") ?? "null")).toMatchObject({ at: cellKey(50.8801, 6.1702), how: "browser" });
    expect(f.els["place-pill-how"]?.textContent).toBe("gerundet, ca. 500 m");
  });

  it("the pill says 'locating' while the browser is asked; a second click supersedes the first, whose late answer changes nothing", async () => {
    const f = fakeWindow({ permission: "prompt", withSheet: true });
    f.els["place-pill-how"]!.textContent = "ungefähr";
    const answers: ((p: unknown) => void)[] = [];
    (f.win["navigator"] as { geolocation: unknown }).geolocation = {
      getCurrentPosition: (ok: (p: unknown) => void) => {
        f.prompts += 1;
        answers.push(ok);
      },
    };
    await run(f, ipServer);
    await click(f, "place-geo");
    expect(f.els["place-pill-how"]?.textContent).toBe("Standort wird ermittelt …");
    expect(f.els["place-pill"]?.attrs["aria-busy"]).toBe("true");
    await click(f, "place-geo");
    expect(f.prompts).toBe(2);
    // the first request's answer arrives late: ignored
    answers[0]?.({ coords: { latitude: 52.52, longitude: 13.405, accuracy: 15 } });
    await flush();
    expect(f.posts).toEqual([]);
    expect(f.els["place-pill-how"]?.textContent).toBe("Standort wird ermittelt …");
    answers[1]?.({ coords: { latitude: 50.8801, longitude: 6.1702, accuracy: 15 } });
    await flush();
    expect(at0(f)).toEqual([cellKey(50.8801, 6.1702)]);
    expect(f.els["place-pill-how"]?.textContent).toBe("gerundet, ca. 500 m");
    expect(f.els["place-pill"]?.attrs["aria-busy"]).toBeUndefined();
  });

  it("a later choice wins over a position still on its way: 'use my location', then 'all of Germany' before the fix — the late fix changes nothing (owner 2026-10-13)", async () => {
    const f = fakeWindow({ permission: "prompt", deferred: true, position: { latitude: 50.8801, longitude: 6.1702 }, withSheet: true });
    await run(f, ipServer);
    await click(f, "place-geo");
    await click(f, "place-scope-de", { preventDefault: () => undefined });
    const writes = [...f.writes];
    const posts = f.posts.length;
    f.answers.shift()?.();
    await flush();
    expect(f.writes).toEqual(writes);
    expect(f.posts.length).toBe(posts);
    expect(JSON.parse(f.store.get("viafrei.place") ?? "null")).toEqual(withMonth({ at: null, label: "", how: "germany" }));
    expect(f.els["place-pill"]?.attrs["aria-busy"]).toBeUndefined();
  });

  it("…and 'forget place' retires it too: nothing is stored when the late fix arrives", async () => {
    const f = fakeWindow({ permission: "prompt", deferred: true, position: { latitude: 50.8801, longitude: 6.1702 }, withSheet: true });
    await run(f, ipServer);
    await click(f, "place-geo");
    await click(f, "place-kept-forget");
    f.answers.shift()?.();
    await flush();
    expect(f.store.has("viafrei.place")).toBe(false);
  });

  it("a prompt nobody answers (no callback ever) ends after 20 s as 'no fix in time': not stuck, nothing stored, a new click asks again", async () => {
    const f = fakeWindow({ permission: "prompt", unanswered: true, withSheet: true });
    f.els["place-pill-label"]!.textContent = "Alsdorf";
    f.els["place-pill-how"]!.textContent = "ungefähr";
    await run(f, ipServer);
    const before = f.timers.length;
    await click(f, "place-geo");
    expect(f.els["place-pill-how"]?.textContent).toBe("Standort wird ermittelt …");
    expect(f.timers.length).toBe(before + 1);
    f.timers.at(-1)?.();
    await flush();
    expect(f.els["place-pill"]?.attrs["aria-busy"]).toBeUndefined();
    expect(f.els["place-pill-how"]?.textContent).toBe("ungefähr");
    expect(msg(f)).toBe("kein Standort: nicht innerhalb von 15 s; weiter: Alsdorf.");
    expect(f.writes).toEqual([]);
    await click(f, "place-geo");
    expect(f.prompts).toBe(2);
    expect(f.els["place-pill-how"]?.textContent).toBe("Standort wird ermittelt …");
  });

  it("the locating state goes back to what the pill said when the fix arrives but the cards do not", async () => {
    const at = cellKey(50.8801, 6.1702);
    const f = fakeWindow({ permission: "prompt", position: { latitude: 50.8801, longitude: 6.1702 }, failAt: [at], withSheet: true });
    f.els["place-pill-how"]!.textContent = "ungefähr";
    await run(f, ipServer);
    await click(f, "place-geo");
    await spend(f);
    expect(f.els["place-pill-how"]?.textContent).toBe("ungefähr");
    expect(f.els["place-pill"]?.attrs["aria-busy"]).toBeUndefined();
    expect(f.writes).toEqual([]);
  });

  it("a click whose fresh fix is still coarse (3 km) loads and remembers it, and says the location is only approximate", async () => {
    const f = fakeWindow({ permission: "prompt", position: { latitude: 50.8801, longitude: 6.1702, accuracy: 3_000 }, withSheet: true });
    await run(f, ipServer);
    await click(f, "place-geo");
    expect(lastAt(f)).toBe(cellKey(50.8801, 6.1702));
    expect(msg(f)).toBe("nur ungefähr");
    expect(f.writes).toEqual(["set viafrei.place"]);
  });

  it("a click with a precise fix shows no line", async () => {
    const f = fakeWindow({ permission: "prompt", position: { latitude: 50.8801, longitude: 6.1702, accuracy: 30 }, withSheet: true });
    await run(f, ipServer);
    await click(f, "place-geo");
    expect(msg(f)).toBeNull();
  });

  // The remembered precise area, and fixes measured from its own point.
  const keepAt = cellKey(50.8801, 6.1702);
  const [kLat, kLon] = keepAt.slice(3).split(",").map(Number) as [number, number];
  const kept = { "viafrei.place": { at: keepAt, label: "nahe Dachsweg, Alsdorf", how: "browser" } };

  it("a reload with a remembered precise area and a coarse granted fix 900 m away (accuracy 1500 m) keeps the area: the coarse cell is never loaded", async () => {
    const f = fakeWindow({ permission: "granted", position: { latitude: kLat + 900 / 111_320, longitude: kLon, accuracy: 1_500 }, stored: kept });
    await run(f, ipServer);
    expect(f.prompts).toBe(1);
    expect(at0(f)).toEqual([keepAt]);
    expect(f.writes).toEqual([]);
    expect(hidden(f)).toBe(false);
  });

  it("a remembered area the server already shows: a coarse fix reloads nothing at all", async () => {
    const f = fakeWindow({ permission: "granted", position: { latitude: kLat + 900 / 111_320, longitude: kLon, accuracy: 1_500 }, stored: kept });
    await run(f, cfg({ source: "ip", at: keepAt, label: "nahe Dachsweg, Alsdorf" }));
    expect(f.posts).toEqual([]);
    expect(f.writes).toEqual([]);
  });

  it("a precise granted fix (accuracy 30 m) 2 km from the remembered area does switch, and stores nothing", async () => {
    const f = fakeWindow({ permission: "granted", position: { latitude: kLat + 2_000 / 111_320, longitude: kLon, accuracy: 30 }, stored: kept });
    await run(f, ipServer);
    expect(at0(f)).toEqual([cellKey(kLat + 2_000 / 111_320, kLon)]);
    expect(f.events).toEqual(["browser"]);
    expect(f.writes).toEqual([]);
  });

  it("a granted fix with no accuracy reported is not trusted over a remembered area", async () => {
    const f = fakeWindow({ permission: "granted", position: { latitude: kLat + 2_000 / 111_320, longitude: kLon, accuracy: Number.NaN }, stored: kept });
    await run(f, ipServer);
    expect(at0(f)).toEqual([keepAt]);
  });

  it("nothing remembered and a granted fix with accuracy 5 km: the server's own place stays", async () => {
    const f = fakeWindow({ permission: "granted", position: { latitude: 50.95, longitude: 6.9, accuracy: 5_000 } });
    f.els["place-pill-how"]!.textContent = "ungefähr";
    await run(f, ipServer);
    expect(f.prompts).toBe(1);
    expect(f.posts).toEqual([]);
    expect(f.events).toEqual(["ip"]);
    expect(f.els["place-pill-how"]?.textContent).toBe("ungefähr");
    expect(f.writes).toEqual([]);
  });

  it("the texts are in all seven catalogues, with the shown place and the 15 s, and the line is in the place bar", () => {
    for (const lang of LIVE_LANGS) {
      const place = (JSON.parse(readFileSync(join(ROOT, "packages", "web", "src", "i18n", `${lang}.json`), "utf8")) as { place: Record<string, unknown> }).place;
      for (const k of ["locating", "geoNo", "geoDenied", "geoUnavailable", "geoTimeout", "geoApprox"]) expect(typeof place[k] === "string" && place[k].length > 0, `${lang} ${k}`).toBe(true);
      expect(place["geoNo"], lang).toMatch(/^[^{}]*\{why\}[^{}]*\{place\}[^{}]*$/);
      for (const k of ["geoDenied", "geoUnavailable", "geoTimeout", "geoApprox", "locating"]) expect(place[k], `${lang} ${k}`).not.toMatch(/[{}]/);
      expect(place["geoTimeout"], lang).toMatch(/15/);
      expect(typeof (place["how"] as Record<string, unknown>)["rough"], lang).toBe("string");
    }
    const block = readFileSync(join(ROOT, "packages", "web", "src", "components", "PlaceBar.astro"), "utf8");
    expect(all(block, "p.placebar__geo[id=\"place-geo-msg\"][hidden]").length).toBeGreaterThan(0);
  });
});

// Review of 2d9503b1: the shortcut, the stale and silent answers, the rough pill, the boundaries and `$` in a label.
describe("'use my location' — the review's cases (2026-10-13)", () => {
  const ipServer = cfg({ source: "ip", at: "ags:05334002", label: "Alsdorf" });
  const msg = (f: Fake): string | null => (f.els["place-geo-msg"]?.attrs["hidden"] === "" ? null : (f.els["place-geo-msg"]?.textContent ?? ""));
  const ats = (f: Fake): string[] => f.posts.map((p) => (JSON.parse(p.body) as { at: string }).at);
  const keepAt = cellKey(50.8801, 6.1702);
  const kept = { "viafrei.place": { at: keepAt, label: "nahe Dachsweg, Alsdorf", how: "browser" } };

  it("deferred IP cards on a pt: cell + a coarse fix (1500 m) beside them: the remembered area is loaded, the IP cell is not claimed as 'exact'", async () => {
    const ipCell = cellKey(50.86, 6.15);
    const [iLat, iLon] = ipCell.slice(3).split(",").map(Number) as [number, number];
    const f = fakeWindow({ permission: "granted", position: { latitude: iLat + 100 / 111_320, longitude: iLon, accuracy: 1_500 }, stored: kept });
    await run(f, cfg({ source: "ip", at: ipCell, label: null }));
    expect(ats(f)).toEqual([keepAt]);
    // the KEPT area, as the click that kept it found it (#1187) — the coarse fix claims nothing
    expect(f.els["place-pill-how"]?.textContent).toBe("gerundet, ca. 500 m");
    expect(f.events).toEqual(["saved"]);
    expect(f.writes).toEqual([]);
  });

  it("the same, with a PRECISE fix (30 m) beside the IP cell: the shortcut is taken, nothing is reloaded", async () => {
    const ipCell = cellKey(50.86, 6.15);
    const [iLat, iLon] = ipCell.slice(3).split(",").map(Number) as [number, number];
    const f = fakeWindow({ permission: "granted", position: { latitude: iLat + 100 / 111_320, longitude: iLon, accuracy: 30 }, stored: kept });
    await run(f, cfg({ source: "ip", at: ipCell, label: null }));
    expect(f.posts).toEqual([]);
    expect(f.events).toEqual(["browser"]);
    expect(f.els["place-pill-how"]?.textContent).toBe("gerundet, ca. 500 m");
  });

  it("a click during the silent read: the silent answer (before or after) changes nothing, no stale aria-busy, the pill ends on the click's place", async () => {
    for (const order of ["silent-first", "click-first"] as const) {
      const f = fakeWindow({ permission: "granted", withSheet: true });
      const answers: ((p: unknown) => void)[] = [];
      (f.win["navigator"] as { geolocation: unknown }).geolocation = {
        getCurrentPosition: (ok: (p: unknown) => void) => {
          f.prompts += 1;
          answers.push(ok);
        },
      };
      await run(f, ipServer);
      expect(f.prompts).toBe(1);
      await click(f, "place-geo");
      expect(f.prompts).toBe(2);
      const silent = (): void => answers[0]?.({ coords: { latitude: 52.52, longitude: 13.405, accuracy: 20 } });
      const clicked = (): void => answers[1]?.({ coords: { latitude: 50.8801, longitude: 6.1702, accuracy: 20 } });
      if (order === "silent-first") {
        silent();
        await flush();
        clicked();
      } else {
        clicked();
        await flush();
        silent();
      }
      await flush();
      expect(ats(f), order).toEqual([keepAt]);
      expect(f.els["place-pill"]?.attrs["aria-busy"], order).toBeUndefined();
      expect(f.els["place-pill-how"]?.textContent, order).toBe("gerundet, ca. 500 m");
      expect(JSON.parse(f.store.get("viafrei.place") ?? "null"), order).toMatchObject({ at: keepAt, how: "browser" });
    }
  });

  it("nothing remembered, a silent fix between 1 and 2 km accuracy: loaded, the pill says 'approximate (browser)', never 'exact'", async () => {
    const f = fakeWindow({ permission: "granted", position: { latitude: 50.8801, longitude: 6.1702, accuracy: 1_500 } });
    await run(f, ipServer);
    expect(ats(f)).toEqual([keepAt]);
    expect(f.els["place-pill-how"]?.textContent).toBe("ungefähr (Browser)");
    expect(msg(f)).toBeNull();
    expect(f.writes).toEqual([]);
    const fine = fakeWindow({ permission: "granted", position: { latitude: 50.8801, longitude: 6.1702, accuracy: 1_000 } });
    await run(fine, ipServer);
    expect(fine.els["place-pill-how"]?.textContent).toBe("gerundet, ca. 500 m");
  });

  it("a coarse click fix: the pill says 'approximate (browser)' too, beside the visible line", async () => {
    const f = fakeWindow({ permission: "prompt", position: { latitude: 50.8801, longitude: 6.1702, accuracy: 3_000 }, withSheet: true });
    await run(f, ipServer);
    await click(f, "place-geo");
    expect(f.els["place-pill-how"]?.textContent).toBe("ungefähr (Browser)");
    expect(msg(f)).toBe("nur ungefähr");
  });

  // Boundaries, on a remembered area at pt:0,0 where a longitude offset of m/111320 is m metres exactly (measured).
  const zero = { "viafrei.place": { at: "pt:0,0", label: "Null", how: "browser" } };
  const at = (m: number, accuracy: number): Promise<Fake> => {
    const f = fakeWindow({ permission: "granted", position: { latitude: 0, longitude: m / 111_320, accuracy }, stored: zero });
    return run(f, ipServer).then(() => f);
  };
  it("accuracy exactly 250 m is trusted; 251 m is not", async () => {
    expect(ats(await at(600, 250))).toEqual([cellKey(0, 600 / 111_320)]);
    expect(ats(await at(600, 251))).toEqual(["pt:0,0"]);
  });
  it("a distance of exactly max(400, 2 × accuracy) is not 'elsewhere'; one metre more is", async () => {
    expect(ats(await at(500, 250))).toEqual(["pt:0,0"]);
    expect(ats(await at(501, 250))).toEqual([cellKey(0, 501 / 111_320)]);
    // max(400, 2 × 100) = 400: exactly 400 m is the same place (KEEP_M), 401 m is elsewhere
    expect(ats(await at(400, 100))).toEqual(["pt:0,0"]);
    expect(ats(await at(401, 100))).toEqual([cellKey(0, 401 / 111_320)]);
  });

  it("a label with `$&` or `$'` is printed as written, in the spoken line and in the failure line", async () => {
    const f = fakeWindow({ permission: "granted", position: { latitude: 50.8801, longitude: 6.1702 }, labels: { [keepAt]: "A$&B$'C" } });
    await run(f, ipServer);
    expect(f.els["place-live"]?.textContent).toBe("Karten für A$&B$'C geladen");
    const g = fakeWindow({ permission: "prompt", position: null, failCode: 1, withSheet: true });
    g.els["place-pill-label"]!.textContent = "X$&Y$`Z";
    await run(g, ipServer);
    await click(g, "place-geo");
    expect(msg(g)).toBe("kein Standort: blockiert; weiter: X$&Y$`Z.");
  });

  it("the failure line names what is shown AFTER the fallback, not the held label", async () => {
    // a remembered browser area held while the IP cards wait; the click then fails: the line names the place shown
    const f = fakeWindow({ permission: "prompt", position: null, failCode: 2, withSheet: true, stored: kept, labels: { [keepAt]: "nahe Dachsweg, Alsdorf" } });
    await run(f, ipServer);
    const shownLabel = f.els["place-pill-label"]?.textContent ?? "";
    await click(f, "place-geo");
    expect(msg(f)).toBe(`kein Standort: nicht verfügbar; weiter: ${shownLabel}.`);
    expect(msg(f)).not.toContain("…");
  });
});

describe("a kept choice expires after twelve months unused (#706, data-steward L4)", () => {
  const NOW = monthOf(FAKE_NOW_MS);
  const kept = (m: number | undefined) => ({ at: "ags:09564000", label: "Nürnberg", how: "manual", m });
  const read = (f: Fake, k: string): unknown => JSON.parse(f.store.get(k) ?? "null");

  it("13 months unused: the entry and the old recent places are gone after start(), and nothing is loaded from them", async () => {
    const f = fakeWindow({ permission: "denied", stored: { "viafrei.place": kept(NOW - 13), "viafrei.place.recent": [{ at: "ags:09564000", label: "Nürnberg", m: NOW - 13 }] } });
    await run(f, cfg({ source: "ip", at: "ags:05315000", label: "Köln" }));
    expect(f.store.has("viafrei.place")).toBe(false);
    expect(f.store.has("viafrei.place.recent")).toBe(false);
    expect(f.posts).toEqual([]);
    expect(f.events).toEqual(["ip"]);
  });

  it("11 months unused: the entry stays, is used, and is re-stamped with this month", async () => {
    const f = fakeWindow({ permission: "denied", stored: { "viafrei.place": kept(NOW - 11) } });
    await run(f, cfg({ source: "ip", at: "ags:05315000", label: "Köln" }));
    expect(read(f, "viafrei.place")).toEqual(kept(NOW));
    expect(f.events).toEqual(["saved"]);
    expect(f.writes).toEqual(["set viafrei.place"]);
  });

  it("exactly twelve months is the edge: deleted", async () => {
    const f = fakeWindow({ permission: "denied", stored: { "viafrei.place": kept(NOW - 12) } });
    await run(f, cfg({ source: "ip", at: "ags:05315000", label: "Köln" }));
    expect(f.store.has("viafrei.place")).toBe(false);
  });

  it("only the expired recent places go; the fresh ones stay as they were", async () => {
    const recent = [{ at: "ags:09564000", label: "Nürnberg", m: NOW - 2 }, { at: "ags:05315000", label: "Köln", m: NOW - 14 }];
    const f = fakeWindow({ permission: "denied", stored: { "viafrei.place.recent": recent } });
    await run(f, cfg({ source: "none", at: null, label: null }));
    expect(read(f, "viafrei.place.recent")).toEqual([recent[0]]);
  });

  it("used this month already: no write at all", async () => {
    const f = fakeWindow({ permission: "denied", stored: { "viafrei.place": kept(NOW) } });
    await run(f, cfg({ source: "ip", at: "ags:05315000", label: "Köln" }));
    expect(f.writes).toEqual([]);
  });

  it("an entry from before #706 (no stamp) is never deleted for it: it and every recent place are stamped on the first visit", async () => {
    const legacyRecent = [{ at: "ags:09564000", label: "Nürnberg", m: undefined }, { at: "ags:05315000", label: "Köln", m: undefined }];
    const f = fakeWindow({ permission: "denied", stored: { "viafrei.place": { at: "ags:09564000", label: "Nürnberg", how: "manual", m: undefined }, "viafrei.place.recent": legacyRecent } });
    // JSON drops an undefined field, so the stored entries have no `m` at all.
    expect(read(f, "viafrei.place")).toEqual({ at: "ags:09564000", label: "Nürnberg", how: "manual" });
    await run(f, cfg({ source: "ip", at: "ags:05315000", label: "Köln" }));
    expect(read(f, "viafrei.place")).toEqual(kept(NOW));
    expect(read(f, "viafrei.place.recent")).toEqual([{ at: "ags:09564000", label: "Nürnberg", m: NOW }, { at: "ags:05315000", label: "Köln", m: NOW }]);
  });

  it("a place page alone stamps legacy entries too, and twelve months later they are gone (steward L4, review 2026-10-16)", async () => {
    const legacy = { "viafrei.place": { at: "ags:09564000", label: "Nürnberg", how: "manual", m: undefined }, "viafrei.place.recent": [{ at: "ags:05315000", label: "Dachsweg 12, Alsdorf", m: undefined }] };
    const first = fakeWindow({ permission: "denied", stored: legacy });
    await run(first, cfg({ source: "page", at: "ags:05315000", label: "Köln" }));
    expect(read(first, "viafrei.place.recent")).toEqual([{ at: "ags:05315000", label: "Dachsweg 12, Alsdorf", m: NOW }]);
    // Twelve months on, never used again: the next visit deletes both.
    const later = Date.UTC(2027, 9, 16, 12);
    const second = fakeWindow({ nowMs: later, permission: "denied", stored: { "viafrei.place": read(first, "viafrei.place"), "viafrei.place.recent": read(first, "viafrei.place.recent") } });
    await run(second, cfg({ source: "page", at: "ags:05315000", label: "Köln" }));
    expect(second.store.has("viafrei.place")).toBe(false);
    expect(second.store.has("viafrei.place.recent")).toBe(false);
  });

  it("the month follows the clock across a year boundary (January against the December before)", async () => {
    const jan = Date.UTC(2027, 0, 5, 12);
    const f = fakeWindow({ nowMs: jan, permission: "denied", stored: { "viafrei.place": kept(monthOf(Date.UTC(2026, 1, 1)) ) } });
    await run(f, cfg({ source: "ip", at: "ags:05315000", label: "Köln" }));
    // February 2026 → January 2027 is eleven months: kept, re-stamped.
    expect(read(f, "viafrei.place")).toEqual(kept(monthOf(jan)));
  });
});

describe("the island on a motorway page (#890: the same ladder, asking for 'around you')", () => {
  const mw = (server: IslandConfig["server"]): IslandConfig => ({ ...cfg(server), around: { road: "A7", r: 25 } });

  it("a standing grant: the ROUNDED cell, the road and the radius go to /fragment/motorway-around in the body; nothing is stored", async () => {
    const f = fakeWindow({ permission: "granted", position: { latitude: 51.312345, longitude: 9.487654 } });
    await run(f, mw({ source: "none", at: null, label: null }));
    expect(f.posts).toHaveLength(1);
    expect(f.posts[0]?.url).toBe("/fragment/motorway-around");
    expect(JSON.parse(f.posts[0]?.body ?? "{}")).toEqual({ at: cellKey(51.312345, 9.487654), lang: "de", how: "browser", road: "A7", r: 25 });
    expect(f.posts[0]?.body).not.toContain("51.312345");
    expect(f.writes).toEqual([]);
    expect(f.dispatched).toContain("vf:loaded");
    // G5: a measured page sends no `location_source` — the island neither marks the root nor fires `vf:location`.
    for (const t of f.timers) t();
    expect(f.dispatched).not.toContain("vf:location");
    expect(f.events).toEqual([]);
  });

  it("no position (no grant, nothing remembered): nothing is asked and the page stays as it was", async () => {
    const f = fakeWindow({ permission: "prompt", position: { latitude: 51.31, longitude: 9.49 } });
    await run(f, mw({ source: "none", at: null, label: null }));
    expect(f.posts).toEqual([]);
    expect(f.prompts).toBe(0);
    expect(f.writes).toEqual([]);
  });

  it("a remembered position is asked at once, as on the home", async () => {
    const f = fakeWindow({ stored: { "viafrei.place": { at: "pt:51.31,9.4875", label: "A7 · Kassel", how: "browser" } } });
    await run(f, mw({ source: "none", at: null, label: null }));
    expect(f.posts.map((p) => p.url)).toEqual(["/fragment/motorway-around"]);
    expect(JSON.parse(f.posts[0]?.body ?? "{}")).toMatchObject({ at: "pt:51.31,9.4875", how: "saved", r: 25 });
  });

  it("the radius control's `vf:radius` asks the same place again at the new radius; without a place it asks nothing", async () => {
    const f = fakeWindow({ permission: "granted", position: { latitude: 51.31, longitude: 9.49 } });
    await run(f, mw({ source: "none", at: null, label: null }));
    for (const fn of f.docListeners["vf:radius"] ?? []) fn({ detail: { r: 5 } });
    await flush();
    expect(f.posts).toHaveLength(2);
    expect(JSON.parse(f.posts[1]?.body ?? "{}")).toMatchObject({ at: cellKey(51.31, 9.49), r: 5 });
    for (const fn of f.docListeners["vf:radius"] ?? []) fn({ detail: { r: 500 } });
    await flush();
    expect(f.posts).toHaveLength(2);
    const g = fakeWindow({ permission: "prompt" });
    await run(g, mw({ source: "none", at: null, label: null }));
    for (const fn of g.docListeners["vf:radius"] ?? []) fn({ detail: { r: 5 } });
    await flush();
    expect(g.posts).toEqual([]);
  });

  // 2.3.11 (owner 2026-10-21): "it must be visible only for the current position if the user wants to provide it".
  const mwR = (server: IslandConfig["server"], r: number): IslandConfig => ({ ...cfg(server), around: { road: "A7", r, rd: 25, follow: true } });
  it("2.3.11: the radius is the visitor's own position's only — a standing grant shows it and asks at the address's radius", async () => {
    const f = fakeWindow({ permission: "granted", position: { latitude: 51.31, longitude: 9.49 } });
    await run(f, mwR({ source: "none", at: null, label: null }, 10));
    expect(f.pos[0]).toBe(false);
    expect(f.pos.at(-1)).toBe(true);
    const body = JSON.parse(f.posts[0]?.body ?? "{}") as Record<string, unknown>;
    expect(body).toMatchObject({ how: "browser", r: 10 });
    expect(body).not.toHaveProperty("main");
  });
  it("2.3.11: an IP guess has no radius — hidden, ?r= does not apply, no main block asked, and vf:radius asks nothing", async () => {
    const f = fakeWindow({ permission: "prompt" });
    await run(f, mwR({ source: "ip", at: "pt:51.31,9.4875", label: "Kassel" }, 10));
    for (const t of f.timers) t();
    await flush();
    expect(f.pos.every((on) => !on)).toBe(true);
    expect(f.posts).toEqual([]);
    for (const fn of f.docListeners["vf:radius"] ?? []) fn({ detail: { r: 5 } });
    await flush();
    expect(f.posts).toEqual([]);
  });
  it("2.3.11: a remembered CHOSEN town has no radius either: asked at the default radius, with no main block", async () => {
    const f = fakeWindow({ stored: { "viafrei.place": { at: "ags:06611000", label: "Kassel", how: "manual" } } });
    await run(f, mwR({ source: "none", at: null, label: null }, 10));
    expect(JSON.parse(f.posts[0]?.body ?? "{}")).toMatchObject({ at: "ags:06611000", how: "saved", r: 25, main: false });
    expect(f.pos.every((on) => !on)).toBe(true);
  });
  it("2.3.11: a remembered area from a click on 'use my location' IS the visitor's position: the radius shows", async () => {
    const f = fakeWindow({ stored: { "viafrei.place": { at: "pt:51.31,9.4875", label: "Kassel", how: "browser" } } });
    await run(f, mwR({ source: "none", at: null, label: null }, 10));
    expect(JSON.parse(f.posts[0]?.body ?? "{}")).toMatchObject({ how: "saved", r: 10 });
    expect(f.pos.at(-1)).toBe(true);
  });

  it("stays inside the island budget with the around configuration", () => {
    for (const lang of LIVE_LANGS) {
      const s = islandScript({ lang, server: { source: "ip", at: "pt:51.31,9.4875", label: "A7 · Kassel" }, labels: islandLabels(lang), cell: { lat: 0, lon: 0 }, around: { road: "A7", r: 25 } });
      expect(s.length, `the island budget, ${lang}`).toBeLessThan(20_000);
    }
  });
});

describe("the pill's word for a browser position is the map legend's (2.3.8)", () => {
  it("in every language it says the position is rounded to about 500 m — never 'exact', which was untrue: the device rounds it to the cell", async () => {
    const { MOTORWAY_AROUND_COPY } = await import("../../digest/src/presentation/i18n-motorway-around.js");
    for (const l of LIVE_LANGS) {
      const word = islandLabels(l).exact;
      expect(word, l).toBe(MOTORWAY_AROUND_COPY[l].howExact);
      expect(word, l).toMatch(/500\s?(?:m|м)$/);
      expect(word.toLowerCase(), l).not.toMatch(/^(?:genau|exact|точно|tam)$/);
    }
  });
});

// #1088: the headline — "Live für [📍 X ▾] [🇩🇪 Ganz Deutschland]" — on the island as shipped.
describe("#1088 the place headline: districts and postcodes picked, the two-way scope switch, what is announced", () => {
  const ipServer = cfg({ source: "ip", at: "ags:05315000", label: "Köln" });
  const prevented = { preventDefault: () => undefined };
  it("a district, a postcode and a point of interest picked in the headline's list are loaded by their own key and remembered like any pick (AC 7, 8)", async () => {
    for (const [key, name] of [["dst:2891122", "Wehlheiden, Kassel"], ["plz:34121", "34121 Kassel"], ["poi:418230", "Allianz Arena"]] as const) {
      const f = fakeWindow({ permission: "denied", withSheet: true, withHead: true, labels: { [key]: "Kassel-Wehlheiden · 34121" } });
      await run(f, cfg({ source: "none", at: null, label: null }));
      await click(f, "place-bar", option(`#${key}`, name));
      expect(lastAt(f), key).toBe(key);
      expect(JSON.parse(f.store.get("viafrei.place") ?? "null"), key).toMatchObject({ at: key, how: "manual", label: "Kassel-Wehlheiden · 34121" });
      expect(f.els["place-pill-label"]!.textContent, key).toBe("Kassel-Wehlheiden · 34121");
      expect(f.placed.at(-1), key).toEqual({ label: "Kassel-Wehlheiden · 34121", how: "manual", outside: null });
    }
  });
  it("a key outside the grammar is no pick: plz:00000, a six-digit postcode, a district or POI id with a leading zero, a POI id too long", async () => {
    for (const href of ["#plz:00000", "#plz:341210", "#dst:0123", "#poi:0", "#poi:0418", `#poi:1${"0".repeat(13)}`]) {
      const f = fakeWindow({ permission: "denied", withSheet: true, withHead: true });
      await run(f, cfg({ source: "none", at: null, label: null }));
      await click(f, "place-bar", option(href, "x"));
      expect(f.posts, href).toEqual([]);
      expect(f.writes, href).toEqual([]);
    }
  });
  it("'Ganz Deutschland' and back again, both ways: Germany is KEPT on the click (#1113), going back to an IP guess keeps nothing; the place radio keeps naming the place (AC 6)", async () => {
    const f = fakeWindow({ permission: "prompt", withSheet: true, withHead: true });
    await run(f, ipServer);
    expect(f.writes).toEqual([]);
    await click(f, "place-scope-de", prevented);
    expect(f.els["place-slot"]!.innerHTML).toBe("");
    expect(f.placed.at(-1)).toMatchObject({ label: null });
    expect(f.els["place-pill-label"]!.textContent).toBe("Köln");
    expect(JSON.parse(f.store.get("viafrei.place") ?? "null")).toEqual(withMonth({ at: null, label: "", how: "germany" }));
    await click(f, "place-pill", prevented);
    expect(lastAt(f)).toBe("ags:05315000");
    expect((JSON.parse(f.posts.at(-1)!.body) as { how: string }).how).toBe("ip");
    expect(f.placed.at(-1)).toMatchObject({ label: "Köln", how: "ip" });
    expect(f.writes).toEqual(["set viafrei.place", "del viafrei.place"]);
  });
  it("with no place known the place radio takes the person to the bar's search (#1112: no dialog) instead of going anywhere", async () => {
    const f = fakeWindow({ permission: "prompt", withSheet: true, withHead: true });
    await run(f, cfg({ source: "none", at: null, label: null }));
    const before = f.els["place-hq"]!.focused;
    await click(f, "place-pill", prevented);
    expect(f.els["place-hq"]!.focused).toBe(before + 1);
    expect(f.posts).toEqual([]);
    expect(f.writes).toEqual([]);
  });
  it("?scope=de: nothing loaded, nothing written on load; the remembered place is what the place radio goes back to, kept again on that click (AC 6, #1113)", async () => {
    const f = fakeWindow({ permission: "granted", position: { latitude: 52.52, longitude: 13.405 }, withSheet: true, withHead: true, stored: { "viafrei.place": { at: "ags:08111000", label: "Stuttgart", how: "manual" } } });
    await run(f, cfg({ source: "germany", at: null, label: null }));
    expect(f.posts).toEqual([]);
    expect(f.prompts).toBe(0);
    expect(f.writes).toEqual([]);
    expect(f.els["place-pill-label"]!.textContent).toBe("Stuttgart");
    expect(f.placed.at(-1)).toMatchObject({ label: null });
    await click(f, "place-pill", prevented);
    expect(lastAt(f)).toBe("ags:08111000");
    expect(JSON.parse(f.store.get("viafrei.place") ?? "null")).toMatchObject({ at: "ags:08111000", label: "Stuttgart", how: "manual" });
  });
  it("?at=<district>: the address's place wins over the remembered one and the browser — nothing asked, nothing written", async () => {
    const f = fakeWindow({ permission: "granted", position: { latitude: 52.52, longitude: 13.405 }, withSheet: true, withHead: true, stored: { "viafrei.place": { at: "ags:08111000", label: "Stuttgart", how: "manual" } } });
    await run(f, cfg({ source: "chosen", at: "dst:2891122", label: "Kassel-Wehlheiden" }));
    expect(f.posts).toEqual([]);
    expect(f.prompts).toBe(0);
    expect(f.writes).toEqual([]);
  });
  it("'Mein Standort' in the bar and the ⌖ in the confirm row ask the browser — the only path to its question (AC 2)", async () => {
    for (const id of ["place-geo", "place-cgeo"]) {
      const f = fakeWindow({ permission: "prompt", position: { latitude: 51.3127, longitude: 9.4797 }, withSheet: true, withHead: true });
      await run(f, ipServer);
      expect(f.prompts, id).toBe(0);
      await click(f, id);
      expect(f.prompts, id).toBe(1);
      expect(lastAt(f), id).toBe(cellKey(51.3127, 9.4797));
    }
  });
})

describe("2.4.6: a remembered place is never a dead in-page anchor, and its click is still the island's", () => {
  const none = cfg({ source: "none", at: null, label: null });
  const pick = "pt:50.775,6.0825";
  const opt = (attrs: Record<string, string>, name: string): unknown => {
    const a = { getAttribute: (n: string) => attrs[n] ?? null, querySelector: () => ({ textContent: name }), textContent: name };
    return { preventDefault: () => undefined, target: { closest: (sel: string) => (sel.includes("place-opt") ? a : null) } };
  };
  it("the remembered position's chip (a link to the page itself, its key in data-at) loads that key (#1112)", async () => {
    const f = fakeWindow({ permission: "denied", withSheet: true });
    await run(f, none);
    await click(f, "place-bar", opt({ href: "/de", "data-at": pick }, "Aachen"));
    expect(lastAt(f)).toBe(pick);
    expect(f.assigned).toEqual([]);
  });
  it("the Gemeinde's real link (`/de?at=ags:…`) is intercepted and loads its key; a point in a URL is never read", async () => {
    const f = fakeWindow({ permission: "denied", withSheet: true });
    await run(f, none);
    await click(f, "place-bar", opt({ href: "/de?at=ags:05334002" }, "Aachen"));
    expect(lastAt(f)).toBe("ags:05334002");
    const g = fakeWindow({ permission: "denied", withSheet: true });
    await run(g, none);
    const before = g.posts.length;
    await click(g, "place-bar", opt({ href: `/de?at=${pick}` }, "x"));
    expect(g.posts.length).toBe(before);
  });
});

// #1113: one choice — a place or "Ganz Deutschland" — with one owner and one write path, read the same on every page.
describe("#1113 the position choice is kept on every click that changes it and read by every page", () => {
  const ipServer = cfg({ source: "ip", at: "ags:05315000", label: "Köln" });
  const prevented = { preventDefault: () => undefined };
  const neuried = { at: "ags:09184137", label: "Neuried", how: "manual" } as const;
  const kept = (f: Fake): unknown => JSON.parse(f.store.get("viafrei.place") ?? "null");
  const storedOf = (f: Fake): Record<string, unknown> => Object.fromEntries([...f.store].map(([k, v]) => [k, JSON.parse(v) as unknown]));
  it("every control that changes the view writes the choice on its click — and nothing is written on load (AC 1, AC 6)", async () => {
    const germanyKept = { "viafrei.place": { at: null, label: "", how: "germany", back: neuried } };
    const controls: [string, unknown, Record<string, unknown>?][] = [
      ["place-scope-de", prevented],
      ["place-bar", option("#ags:08111000", "Stuttgart")],
      ["place-bar", option("#plz:34121", "34121 Kassel")],
      ["place-geo", {}],
      ["place-cgeo", {}],
      ["place-forget", {}],
      ["place-kept-forget", {}],
      ["place-pill", prevented, germanyKept],
    ];
    for (const [id, e, stored] of controls) {
      const f = fakeWindow({ permission: "prompt", position: { latitude: 51.3127, longitude: 9.4797 }, withSheet: true, withHead: true, stored: stored ?? { "viafrei.place": neuried } });
      await run(f, ipServer);
      expect(f.writes, `${id}: nothing on load`).toEqual([]);
      const before = f.store.get("viafrei.place");
      await click(f, id, e);
      expect(f.writes.filter((w) => w.endsWith(" viafrei.place")).length, `${id} writes the choice`).toBeGreaterThan(0);
      expect(f.store.get("viafrei.place"), `${id} changed what is kept`).not.toBe(before);
    }
  });
  it("position → Ganz Deutschland → the next page → position returns to the SAME position, first in the recent list, nothing asked (owner's path)", async () => {
    const f = fakeWindow({ permission: "prompt", withSheet: true, withHead: true, labels: { [neuried.at]: "Neuried" } });
    await run(f, ipServer);
    await click(f, "place-bar", option(`#${neuried.at}`, "Neuried"));
    expect(kept(f)).toMatchObject(neuried);
    await click(f, "place-scope-de", prevented);
    expect(kept(f)).toMatchObject({ at: null, how: "germany", back: neuried });
    expect((JSON.parse(f.store.get("viafrei.place.recent") ?? "[]") as { at: string }[])[0]).toMatchObject({ at: neuried.at });
    // the next page (another language, a motorway page, the home again), even with a standing grant: Germany
    const g = fakeWindow({ permission: "granted", position: { latitude: 52.52, longitude: 13.405 }, withSheet: true, withHead: true, labels: { [neuried.at]: "Neuried" }, stored: storedOf(f) });
    await run(g, { ...ipServer, lang: "en" });
    expect(g.posts).toEqual([]);
    expect(g.prompts).toBe(0);
    expect(g.els["place-slot"]!.innerHTML).toBe("");
    expect(g.writes).toEqual([]);
    // the place radio names and goes back to Neuried, not to the IP guess, with no question
    expect(g.els["place-pill-label"]!.textContent).toBe("Neuried");
    await click(g, "place-pill", prevented);
    expect(lastAt(g)).toBe(neuried.at);
    expect(g.prompts).toBe(0);
    expect(kept(g)).toMatchObject(neuried);
    // and the page after that shows Neuried again
    const h = fakeWindow({ permission: "prompt", withSheet: true, withHead: true, stored: storedOf(g) });
    await run(h, ipServer);
    expect(lastAt(h)).toBe(neuried.at);
  });
  it("a kept position from 'use my location' goes back as the visitor's position, not as a chosen town", async () => {
    const pos = { at: "pt:51.31,9.4875", label: "Kassel", how: "browser" };
    const f = fakeWindow({ permission: "prompt", withSheet: true, withHead: true, stored: { "viafrei.place": { at: null, label: "", how: "germany", back: pos } } });
    await run(f, cfg({ source: "none", at: null, label: null }));
    await click(f, "place-pill", prevented);
    expect(kept(f)).toMatchObject(pos);
    expect(JSON.parse(f.posts.at(-1)!.body)).toMatchObject({ at: pos.at, how: "saved" });
  });
  it("a kept browser position shown, then Germany: kept as 'browser' beside Germany", async () => {
    const pos = { at: "pt:51.31,9.4875", label: "Kassel", how: "browser" };
    const f = fakeWindow({ permission: "prompt", withSheet: true, withHead: true, stored: { "viafrei.place": pos } });
    await run(f, cfg({ source: "none", at: null, label: null }));
    await click(f, "place-scope-de", prevented);
    expect(kept(f)).toMatchObject({ how: "germany", back: { at: pos.at, how: "browser" } });
  });
  it("a kept back that is not a valid place is ignored (the server's place is gone back to instead)", async () => {
    const f = fakeWindow({ permission: "prompt", withSheet: true, withHead: true, stored: { "viafrei.place": { at: null, label: "", how: "germany", back: { at: "pt:999", label: "x", how: "manual" } } } });
    await run(f, ipServer);
    expect(f.els["place-pill-label"]!.textContent).toBe("Köln");
  });
  it("a shared link (?at= or ?scope=de) shows its place or mode and changes nothing kept until a click (AC 5)", async () => {
    for (const server of [cfg({ source: "chosen", at: "dst:2891122", label: "Wehlheiden" }), cfg({ source: "germany", at: null, label: null })]) {
      const f = fakeWindow({ permission: "prompt", withSheet: true, withHead: true, stored: { "viafrei.place": neuried } });
      await run(f, server);
      for (const t of f.timers) t();
      await flush();
      expect(f.writes, server.server.source).toEqual([]);
      expect(kept(f), server.server.source).toMatchObject(neuried);
    }
    // a shared ?at= link, then Germany, then back: the link's place is kept as chosen on that click
    const f = fakeWindow({ permission: "prompt", withSheet: true, withHead: true });
    await run(f, cfg({ source: "chosen", at: "dst:2891122", label: "Wehlheiden" }));
    await click(f, "place-scope-de", prevented);
    expect(kept(f)).toMatchObject({ how: "germany", back: { at: "dst:2891122", how: "manual" } });
    await click(f, "place-pill", prevented);
    expect(kept(f)).toMatchObject({ at: "dst:2891122", how: "manual" });
  });
  it("'Ort vergessen' clears the choice: the next page falls back to the ladder (the IP guess)", async () => {
    const f = fakeWindow({ permission: "prompt", withSheet: true, withHead: true, stored: { "viafrei.place": { at: null, label: "", how: "germany", back: neuried } } });
    await run(f, ipServer);
    await click(f, "place-forget");
    expect(f.store.has("viafrei.place")).toBe(false);
    const g = fakeWindow({ permission: "prompt", withSheet: true, withHead: true, stored: storedOf(f) });
    await run(g, ipServer);
    expect(g.posts).toEqual([]);
    expect(g.events).toEqual(["ip"]);
  });
  describe("a motorway road page applies the kept choice (AC 4)", () => {
    const mw = (server: IslandConfig["server"]): IslandConfig => ({ ...cfg(server), around: { road: "A9", r: 25, rd: 25, follow: true } });
    it("a kept Ganz Deutschland: the whole road — the IP block goes, nothing is asked, no radius", async () => {
      const f = fakeWindow({ permission: "granted", position: { latitude: 48.1, longitude: 11.5 }, withSheet: true, withHead: true, stored: { "viafrei.place": { at: null, label: "", how: "germany", back: neuried } } });
      f.els["place-slot"]!.innerHTML = '<section class="mwa">IP</section>';
      await run(f, mw({ source: "ip", at: "pt:48.1,11.5", label: "München" }));
      expect(f.els["place-slot"]!.innerHTML).toBe("");
      expect(f.posts).toEqual([]);
      expect(f.prompts).toBe(0);
      expect(f.pos.every((on) => !on)).toBe(true);
      expect(f.writes).toEqual([]);
    });
    it("a kept place: the around block of that place is asked at once", async () => {
      const f = fakeWindow({ permission: "prompt", withSheet: true, withHead: true, stored: { "viafrei.place": neuried } });
      await run(f, mw({ source: "ip", at: "pt:48.1,11.5", label: "München" }));
      expect(f.posts.map((p) => p.url)).toEqual(["/fragment/motorway-around"]);
      expect(JSON.parse(f.posts[0]!.body)).toMatchObject({ at: neuried.at, road: "A9", how: "saved" });
      expect(f.writes).toEqual([]);
    });
  });
});

// #1112: the position bar, inline — on the island as shipped.
describe("#1112 the position bar: no dialog, chips that change the page in place", () => {
  const none = cfg({ source: "none", at: null, label: null });
  const ipServer = cfg({ source: "ip", at: "ags:05315000", label: "Köln" });
  const recent = (n: number): { at: string; label: string }[] => Array.from({ length: n }, (_, i) => ({ at: `ags:0911${String(i).padStart(4, "0")}`, label: `Ort ${i}` }));
  const chipsOf = (f: Fake): El[] => f.els["place-recent"]!.children;
  const xOf = (li: El): unknown => ({ preventDefault: () => undefined, target: { closest: (sel: string) => (sel.includes("chip__x") ? li.children[1] : null) } });
  const popular = (f: Fake): void => {
    f.els["place-chips-l"]!.textContent = "Beliebt";
    f.els["place-recent"]!.innerHTML = '<li><a class="chip place-opt" href="/de/place/berlin">Berlin</a></li>';
  };

  it("no <dialog> and no showModal() anywhere in the location flow: the island and every component the three page types render it with", () => {
    const island = readFileSync(join(HERE, "..", "src", "location", "island.ts"), "utf8");
    expect(island).not.toMatch(/showModal|<dialog|place-sheet|\.close\(\)/);
    for (const c of ["PlaceBlock", "PlaceHead", "PlaceBar", "MotorwayPlace"]) {
      const src = readFileSync(join(HERE, "..", "src", "components", `${c}.astro`), "utf8");
      expect(src, c).not.toMatch(/<dialog|showModal|PlaceSheet/);
    }
    expect(existsSync(join(HERE, "..", "src", "components", "PlaceSheet.astro"))).toBe(false);
  });

  it("a chip on the home loads its cards WITHOUT a navigation, replaces the address with its shareable form, announces the place and keeps focus in the bar", async () => {
    const f = fakeWindow({ permission: "denied", withSheet: true, search: "?topics=fuel", labels: { "ags:09110001": "Ort 1" }, stored: { "viafrei.place.recent": recent(2) } });
    await run(f, ipServer);
    expect(f.replaced).toEqual([]);
    await click(f, "place-bar", option("/de?at=ags:09110001", "Ort 1"));
    expect(lastAt(f)).toBe("ags:09110001");
    expect(f.assigned).toEqual([]);
    // another parameter survives, the place rides as `?at=`
    expect(f.replaced).toEqual(["/de?topics=fuel&at=ags:09110001"]);
    expect(f.els["place-live"]?.textContent).toBe("Karten für Ort 1 geladen");
    // the chip just chosen is first, pressed, and has the focus
    expect(chipsOf(f)[0]?.children[0]?.attrs["aria-current"]).toBe("true");
    expect(chipsOf(f)[0]?.children[0]?.focused).toBe(1);
    expect(chipsOf(f).slice(1).map((li) => li.children[0]?.attrs["aria-current"])).toEqual(["false"]);
  });

  it("a position never enters the address; 'Ganz Deutschland' replaces it with ?scope=de; a place page's address is its own", async () => {
    const f = fakeWindow({ permission: "denied", withSheet: true, search: "?at=ags:05315000" });
    await run(f, ipServer);
    await click(f, "place-bar", option("#pt:52.52,13.4025", "Alexanderplatz"));
    expect(f.replaced.at(-1)).toBe("/de");
    await click(f, "place-scope-de", { preventDefault: () => undefined });
    expect(f.replaced.at(-1)).toBe("/de?scope=de");
    const page = fakeWindow({ permission: "denied", withSheet: true, pathname: "/de/place/koeln" });
    await run(page, cfg({ source: "page", at: "ags:05315000", label: "Köln" }));
    await click(page, "place-scope-de", { preventDefault: () => undefined });
    expect(page.replaced).toEqual([]);
  });

  it("at most five recent chips, newest first, each with a × named for its place; with none, the server's popular chips under 'Beliebt'", async () => {
    const f = fakeWindow({ permission: "denied", withSheet: true, stored: { "viafrei.place.recent": recent(7) } });
    popular(f);
    await run(f, none);
    expect(chipsOf(f)).toHaveLength(5);
    expect(chipsOf(f).map((li) => li.children[0]?.children[0]?.textContent)).toEqual(["Ort 0", "Ort 1", "Ort 2", "Ort 3", "Ort 4"]);
    expect(chipsOf(f).map((li) => [li.children[1]?.attrs["aria-label"], li.children[1]?.attrs["value"]])).toEqual(recent(5).map((r) => [`${r.label} entfernen`, r.at]));
    expect(f.els["place-chips-l"]?.textContent).toBe("Zuletzt");
    expect(f.writes).toEqual([]);
    const empty = fakeWindow({ permission: "denied", withSheet: true });
    popular(empty);
    await run(empty, none);
    expect(empty.els["place-chips-l"]?.textContent).toBe("Beliebt");
    expect(empty.els["place-recent"]?.innerHTML).toContain("/de/place/berlin");
  });

  it("a chip's × drops it — one write of the recent list, on the click; the last one dropped deletes the key and the popular chips return", async () => {
    const f = fakeWindow({ permission: "denied", withSheet: true, stored: { "viafrei.place.recent": recent(2) } });
    popular(f);
    await run(f, none);
    await click(f, "place-bar", xOf(chipsOf(f)[0]!));
    expect(f.writes).toEqual(["set viafrei.place.recent"]);
    expect(chipsOf(f).map((li) => li.children[0]?.children[0]?.textContent)).toEqual(["Ort 1"]);
    expect(f.posts).toEqual([]);
    await click(f, "place-bar", xOf(chipsOf(f)[0]!));
    expect(f.writes).toEqual(["set viafrei.place.recent", "del viafrei.place.recent"]);
    expect(f.els["place-chips-l"]?.textContent).toBe("Beliebt");
    expect(f.els["place-recent"]?.innerHTML).toContain("/de/place/berlin");
  });

  it("each key is written at most once per click — a chip, a pick and 'use my location' — and never on load; the chip clicked moves to the front", async () => {
    const f = fakeWindow({ permission: "prompt", position: { latitude: 51.3127, longitude: 9.4797 }, withSheet: true, stored: { "viafrei.place.recent": recent(2) } });
    await run(f, none);
    expect(f.writes).toEqual([]);
    await click(f, "place-bar", option("/de?at=ags:09110001", "Ort 1"));
    expect(f.writes).toEqual(["set viafrei.place", "set viafrei.place.recent"]);
    f.writes.length = 0;
    await click(f, "place-bar", option("#plz:34121", "34121 Kassel"));
    expect(f.writes).toEqual(["set viafrei.place", "set viafrei.place.recent"]);
    const rs = JSON.parse(f.store.get("viafrei.place.recent") ?? "[]") as { at: string }[];
    expect(rs.map((r) => r.at)).toEqual(["plz:34121", "ags:09110001", "ags:09110000"]);
    f.writes.length = 0;
    await click(f, "place-geo");
    expect(f.writes).toEqual(["set viafrei.place"]);
  });

  it("the cards on screen stay while the next ones load, marked as updating — never blanked", async () => {
    const f = fakeWindow({ permission: "denied", withSheet: true, holdAt: ["ags:09110001"] });
    await run(f, none);
    f.els["place-slot"]!.innerHTML = "<p>alte Karten</p>";
    await click(f, "place-bar", option("/de?at=ags:09110001", "Ort 1"));
    expect(f.held.has("ags:09110001")).toBe(true);
    expect(f.els["place-slot"]?.classes.has("is-updating")).toBe(true);
    expect(f.els["place-slot"]?.innerHTML).toBe("<p>alte Karten</p>");
    f.held.get("ags:09110001")?.();
    await flush();
    expect(f.els["place-slot"]?.classes.has("is-updating")).toBe(false);
  });

  it("Space on a chip activates it as Enter does; another key does nothing", async () => {
    const f = fakeWindow({ permission: "denied", withSheet: true });
    await run(f, none);
    let clicked = 0;
    let prevented = 0;
    const chip = { click: () => void (clicked += 1) };
    const key = (k: string): unknown => ({ key: k, preventDefault: () => void (prevented += 1), target: { closest: (sel: string) => (sel.includes("place-opt") ? chip : null) } });
    for (const l of f.els["place-bar"]!.listeners["keydown"] ?? []) {
      l(key(" "));
      l(key("x"));
    }
    expect([clicked, prevented]).toEqual([1, 1]);
  });

  it("'Mein Standort' is shown only once the island runs, and the browser is asked only on its click", async () => {
    const f = fakeWindow({ permission: "prompt", position: { latitude: 51.3127, longitude: 9.4797 }, withSheet: true });
    f.els["place-geo"]!.attrs["hidden"] = "";
    await run(f, none);
    expect(f.els["place-geo"]?.attrs["hidden"]).toBeUndefined();
    expect(f.prompts).toBe(0);
    await click(f, "place-geo");
    expect(f.prompts).toBe(1);
  });
});

// #1137: the place box now lists the motorways and junctions a query names — links to their pages. The island reads a
// place-opt link as a place key only when it IS one; a motorway or an exit page is followed by the browser, never
// swallowed as a place (no preventDefault, no card load, nothing kept).
describe("#1137 a motorway or exit line in the place box navigates to its page", () => {
  const optionCounting = (href: string, name: string, prevented: { n: number }): unknown => {
    const a = { getAttribute: (n: string) => (n === "href" ? href : null), querySelector: () => ({ textContent: name }), textContent: name };
    return { preventDefault: () => void (prevented.n += 1), target: { closest: (sel: string) => (sel.includes("place-opt") ? a : null) } };
  };
  for (const [href, name] of [
    ["/de/autobahn/a4", "A4"],
    ["/en/autobahn/a4/exit-20-heumar", "Heumar"],
    ["/de/autobahn/a4/exit-81a-dresden-neustadt", "Dresden-Neustadt"],
  ] as const) {
    it(`${href}: followed, not chosen as a place`, async () => {
      const f = fakeWindow({ permission: "denied", withSheet: true });
      await run(f, cfg({ source: "none", at: null, label: null }));
      const posts = f.posts.length;
      const writes = f.writes.length;
      const prevented = { n: 0 };
      await click(f, "place-bar", optionCounting(href, name, prevented));
      expect(prevented.n).toBe(0);
      expect(f.posts.length).toBe(posts);
      expect(f.writes.length).toBe(writes);
    });
  }
  it("…while a place line beside it is still chosen in place", async () => {
    const f = fakeWindow({ permission: "denied", withSheet: true });
    await run(f, cfg({ source: "none", at: null, label: null }));
    const prevented = { n: 0 };
    await click(f, "place-bar", optionCounting("/de/place/koeln", "Köln", prevented));
    expect(prevented.n).toBe(1);
    expect(lastAt(f)).toBe("slug:koeln");
  });
});

describe("#1143: the pill's link names the place its text names, by one rule", () => {
  // The server's render: the IP guess's Gemeinde and its page (PlaceBlock.astro's `scopeHrefs`).
  const ipPage = (o: Parameters<typeof fakeWindow>[0]): Fake => {
    const f = fakeWindow({ withHead: true, ...o });
    f.els["place-pill"]!.attrs["href"] = "/de/place/pulheim";
    f.els["place-scope-de"]!.attrs["href"] = "/de?scope=de";
    return f;
  };
  const server = cfg({ source: "ip", at: "ags:05362032", label: "Pulheim" });

  it("a position's answer named by its district (no place page): the text and the link both leave the IP guess", async () => {
    const f = ipPage({ permission: "granted", position: { latitude: 50.7623, longitude: 6.0956 }, labels: { [cellKey(50.7623, 6.0956)]: "Aachen-Burtscheid" } });
    await run(f, server);
    expect(f.els["place-pill-label"]?.textContent).toBe("Aachen-Burtscheid");
    // a point has no page of its own: the page that shows it, never the guess's /de/place/pulheim
    expect(f.els["place-pill"]?.attrs["href"]).toBe("/de");
  });

  it("a remembered Gemeinde: the pill links to the page of the place the answer names (its slug)", async () => {
    const f = ipPage({ permission: "denied", stored: { "viafrei.place": { at: "ags:05334002", label: "Aachen", how: "manual" } }, labels: { "ags:05334002": "Aachen" }, slugs: { "ags:05334002": "aachen" } });
    await run(f, server);
    expect(f.els["place-pill-label"]?.textContent).toBe("Aachen");
    expect(f.els["place-pill"]?.attrs["href"]).toBe("/de/place/aachen");
  });

  it("the filler's answer renames the pill: the link follows the name and the slug that came with it", async () => {
    const f = ipPage({ permission: "prompt" });
    await run(f, server);
    for (const l of f.docListeners["vf:filled"] ?? []) l({ detail: { id: "place-cards", label: "Alsdorf", key: "ags:05334004", slug: "alsdorf" } });
    expect(f.els["place-pill-label"]?.textContent).toBe("Alsdorf");
    expect(f.els["place-pill"]?.attrs["href"]).toBe("/de/place/alsdorf");
    // a key with no slug: the page with ?at=, the address that shows exactly that place
    for (const l of f.docListeners["vf:filled"] ?? []) l({ detail: { id: "place-cards", label: "Würselen", key: "ags:05334036", slug: null } });
    expect(f.els["place-pill"]?.attrs["href"]).toBe("/de?at=ags:05334036");
  });

  it("an IP guess nothing replaces keeps the server's link to its own page", async () => {
    const f = ipPage({ permission: "prompt" });
    await run(f, server);
    expect(f.els["place-pill-label"]?.textContent).toBe("");
    expect(f.els["place-pill"]?.attrs["href"]).toBe("/de/place/pulheim");
  });
});

// #1112 (the rest, 2.5.5): every chip is an ordinary link by the pill's one rule (#1143), so it works without
// JavaScript; with it, the click changes the cards in place by the chip's key. The place's announcement carries the
// place alone; the suggestions' count has its own status line. Nothing is written on load, on any page type.
describe("#1112 recent chips are links by the pill's rule; place-live speaks the place alone; nothing written on load", () => {
  const pt = "pt:50.775,6.0825";
  const kept = [
    { at: pt, label: "Aachen Hbf, Aachen" },
    { at: "ags:05334002", label: "Aachen" },
    { at: "slug:koeln", label: "Köln" },
    { at: "dst:2891122", label: "Wehlheiden, Kassel" },
  ];
  const chipLinks = (f: Fake): [string | null, string | null, string][] =>
    (f.els["place-recent"]?.children ?? []).map((li) => [li.children[0]?.attrs["href"] ?? null, li.children[0]?.attrs["data-at"] ?? null, li.children[0]?.id ?? ""]);
  const page = (pathname: string, scope: string): Fake => {
    const f = fakeWindow({ permission: "denied", withSheet: true, pathname, stored: { "viafrei.place.recent": kept } });
    f.els["place-scope-de"]!.attrs["href"] = scope;
    return f;
  };
  const opt = (attrs: Record<string, string>, name: string): unknown => {
    const a = { getAttribute: (n: string) => attrs[n] ?? null, querySelector: () => ({ textContent: name }), textContent: name };
    return { preventDefault: () => undefined, target: { closest: (sel: string) => (sel.includes("place-opt") ? a : null) } };
  };

  it("the home: a position links the page itself, a key its ?at= address, a slug its place page — each an <a> carrying its key, never a button", async () => {
    const f = page("/de", "/de?scope=de");
    await run(f, cfg({ source: "none", at: null, label: null }));
    expect(chipLinks(f)).toEqual([
      ["/de", pt, "a"],
      ["/de?at=ags:05334002", "ags:05334002", "a"],
      ["/de/place/koeln", "slug:koeln", "a"],
      ["/de?at=dst:2891122", "dst:2891122", "a"],
    ]);
  });

  it("a place page: a key's address is the home's (the place page IS its place), a slug its own page", async () => {
    const f = page("/de/place/koeln", "/de/place/koeln?scope=de");
    await run(f, cfg({ source: "page", at: "ags:05315000", label: "Köln" }));
    expect(chipLinks(f).map(([h]) => h)).toEqual(["/de", "/de?at=ags:05334002", "/de/place/koeln", "/de?at=dst:2891122"]);
  });

  it("a motorway page: every key stays on the motorway page (`?at=`, a slug too), a position links the page itself", async () => {
    const f = page("/de/autobahn/a7", "/de/autobahn/a7?scope=de");
    await run(f, { ...cfg({ source: "none", at: null, label: null }), around: { road: "A7", r: 25 } });
    expect(chipLinks(f).map(([h]) => h)).toEqual(["/de/autobahn/a7", "/de/autobahn/a7?at=ags:05334002", "/de/autobahn/a7?at=slug:koeln", "/de/autobahn/a7?at=dst:2891122"]);
  });

  it("ONE rule: the pill's link after a chip's click is that chip's link (placeHref), and the island holds no second copy", async () => {
    const f = page("/de", "/de?scope=de");
    await run(f, cfg({ source: "none", at: null, label: null }));
    const [href, at] = chipLinks(f)[3]!;
    await click(f, "place-bar", opt({ href: href ?? "", "data-at": at ?? "" }, "Wehlheiden, Kassel"));
    expect(lastAt(f)).toBe("dst:2891122");
    expect(f.els["place-pill"]?.attrs["href"]).toBe(href);
    const src = readFileSync(join(HERE, "..", "src", "location", "island.ts"), "utf8");
    expect(src).not.toMatch(/recentHref|createElement\(href === null \? "button"/);
    // #1158: a chip's target is `tgt`, which falls back to the pill's rule for anything with no page of its own
    expect(src).toContain('a.setAttribute("href", tgt(r));');
    expect(src).toMatch(/\?\? placeHref\(r\.at, null\);\n/);
  });

  it("with JavaScript a position chip changes the cards in place (no navigation), by its key — its link to the page itself is not followed", async () => {
    const f = page("/de", "/de?scope=de");
    await run(f, cfg({ source: "ip", at: "ags:05315000", label: "Köln" }));
    let prevented = 0;
    const attrs: Record<string, string> = { href: "/de", "data-at": pt };
    const a = { getAttribute: (n: string) => attrs[n] ?? null, querySelector: () => ({ textContent: "Aachen Hbf, Aachen" }), textContent: "Aachen Hbf, Aachen" };
    await click(f, "place-bar", { preventDefault: () => void (prevented += 1), target: { closest: (sel: string) => (sel.includes("place-opt") ? a : null) } });
    expect(prevented).toBe(1);
    expect(lastAt(f)).toBe(pt);
    expect(f.assigned).toEqual([]);
    // the click writes the two existing keys (one choice), nothing else
    expect(f.writes).toEqual(["set viafrei.place", "set viafrei.place.recent"]);
  });

  it("on a place page a position chip goes to the home (its key decides, not its link), remembered on the click", async () => {
    const f = page("/de/place/koeln", "/de/place/koeln?scope=de");
    await run(f, cfg({ source: "page", at: "ags:05315000", label: "Köln" }));
    await click(f, "place-bar", opt({ href: "/de", "data-at": pt }, "Aachen Hbf, Aachen"));
    expect(f.assigned).toEqual(["/de"]);
    expect(f.writes).toEqual(["set viafrei.place", "set viafrei.place.recent"]);
  });

  it("the suggestions never speak through place-live: their count goes to their own status line", async () => {
    const list = '<div class="place-suggest"><ul class="place-suggest__list"><li>Kassel</li><li>Kassel-Wehlheiden</li></ul></div>';
    const f = fakeWindow({ permission: "denied", withSheet: true, labels: { "ags:09110001": "Ort 1" }, suggest: { html: list, n: 2 } });
    await run(f, cfg({ source: "none", at: null, label: null }));
    await click(f, "place-bar", option("/de?at=ags:09110001", "Ort 1"));
    expect(f.els["place-live"]?.textContent).toBe("Karten für Ort 1 geladen");
    f.els["place-hq"]!.value = "Kass";
    for (const l of f.els["place-hq"]!.listeners["input"] ?? []) l({});
    await flush();
    expect(f.posts.at(-1)?.url).toBe("/fragment/suggest");
    expect(f.els["place-hresults"]?.innerHTML).toContain("Kassel-Wehlheiden");
    expect(f.els["place-hstatus"]?.textContent).toBe("Vorschläge: 2");
    // the place's announcement is unchanged: only "Karten für …", never a suggestion
    expect(f.els["place-live"]?.textContent).toBe("Karten für Ort 1 geladen");
  });

  it("#1158: a field emptied closes its suggestions (they open over the recent list), and the same word asks again", async () => {
    const list = '<div class="place-suggest"><ul class="place-suggest__list"><li>Kassel</li></ul></div>';
    const f = fakeWindow({ permission: "denied", withSheet: true, suggest: { html: list, n: 1 } });
    await run(f, cfg({ source: "none", at: null, label: null }));
    const type = async (v: string): Promise<void> => {
      f.els["place-hq"]!.value = v;
      for (const l of f.els["place-hq"]!.listeners["input"] ?? []) l({});
      await flush();
    };
    await type("Kass");
    expect(f.els["place-hresults"]?.innerHTML).toContain("Kassel");
    const asked = f.posts.length;
    await type("");
    expect(f.els["place-hresults"]?.innerHTML).toBe("");
    expect(f.els["place-hstatus"]?.textContent).toBe("");
    expect(f.posts.length).toBe(asked);
    await type("K");
    expect(f.els["place-hresults"]?.innerHTML).toBe("");
    await type("Kass");
    expect(f.posts.length).toBe(asked + 1);
    expect(f.els["place-hresults"]?.innerHTML).toContain("Kassel");
  });

  it("an empty suggestion list says so on its own line (0), never through place-live", async () => {
    const f = fakeWindow({ permission: "denied", withSheet: true, suggest: { html: '<div class="place-suggest place-suggest--none"><p>Nichts gefunden.</p></div>', n: 0 } });
    await run(f, cfg({ source: "none", at: null, label: null }));
    f.els["place-hq"]!.value = "Zzz";
    for (const l of f.els["place-hq"]!.listeners["input"] ?? []) l({});
    await flush();
    expect(f.els["place-hstatus"]?.textContent).toBe("Vorschläge: 0");
    expect(f.els["place-live"]?.textContent).toBe("");
  });

  it("no load writes anything with empty storage — the home, a place page, a motorway page — in any permission state", async () => {
    const loads: [string, IslandConfig][] = [
      ["/de", cfg({ source: "ip", at: "ags:05315000", label: "Köln" })],
      ["/de", cfg({ source: "none", at: null, label: null })],
      ["/de/place/koeln", cfg({ source: "page", at: "ags:05315000", label: "Köln" })],
      ["/de/autobahn/a7", { ...cfg({ source: "ip", at: "pt:51.31,9.4875", label: "Kassel" }), around: { road: "A7", r: 25, rd: 25, follow: true } }],
    ];
    for (const [pathname, c] of loads)
      for (const permission of ["prompt", "granted", "denied"] as const) {
        const f = fakeWindow({ permission, pathname, position: { latitude: 51.3127, longitude: 9.4797 }, withSheet: true });
        await run(f, c);
        for (const t of f.timers.splice(0)) t();
        await flush();
        expect(f.writes, `${pathname} ${c.server.source} ${permission}`).toEqual([]);
      }
  });
});

// #1153 (owner 2026-11-03): the header is the site's one location dispatcher. On a page with no cards of its own (news,
// a station, the connect page …) the header prints the island itself, with no slot: it names the remembered place,
// writes a choice on its click only, and loads no cards; a place page offers "make this my place".
describe("#1153 the header's own island: no slot, no cards, the remembered place named", () => {
  const none = cfg({ source: "none", at: null, label: null });
  const stop = { preventDefault: () => undefined };
  it("with nothing stored: nothing asked, nothing loaded, nothing written, no 'remembered' line", async () => {
    const f = fakeWindow({ permission: "granted", position: { latitude: 50.94, longitude: 6.96 }, withSheet: true, headerOnly: true });
    await run(f, none);
    expect(f.posts).toEqual([]);
    expect(f.prompts).toBe(0);
    expect(f.writes).toEqual([]);
    expect(hidden(f)).toBe(true);
  });
  it("a remembered place is named on the pill at once, with the line under the bar — and nothing is loaded", async () => {
    const f = fakeWindow({ permission: "granted", position: { latitude: 52.52, longitude: 13.405 }, withSheet: true, headerOnly: true, stored: { "viafrei.place": { at: "ags:09564000", label: "Nürnberg", how: "manual" } } });
    await run(f, none);
    expect(f.posts).toEqual([]);
    expect(f.prompts).toBe(0);
    expect(f.writes).toEqual([]);
    expect(f.els["place-pill-label"]?.textContent).toBe("Nürnberg");
    expect(hidden(f)).toBe(false);
  });
  it("a place picked in the header's list is remembered on the click (one write path), named, and no card is fetched", async () => {
    const f = fakeWindow({ permission: "denied", withSheet: true, headerOnly: true, pathname: "/de/news" });
    await run(f, none);
    expect(f.writes).toEqual([]);
    await click(f, "place-bar", option("/de/place/koeln", "Köln"));
    expect(f.posts).toEqual([]);
    expect(JSON.parse(f.store.get("viafrei.place") ?? "null")).toMatchObject({ at: "slug:koeln", label: "Köln", how: "manual" });
    expect(f.els["place-pill-label"]?.textContent).toBe("Köln");
    expect(hidden(f)).toBe(false);
    // the page it was picked on is not left, its address not touched
    expect(f.replaced).toEqual([]);
    expect(f.assigned).toEqual([]);
  });
  it("a motorway, a station or a page in the list is an ordinary link: the island leaves it to the browser", async () => {
    const f = fakeWindow({ permission: "denied", withSheet: true, headerOnly: true });
    await run(f, none);
    let prevented = 0;
    for (const href of ["/de/autobahn/a7", "/de/station/koeln-hbf", "/de/news#e1"]) {
      const a = { getAttribute: (n: string) => (n === "href" ? href : null), querySelector: () => ({ textContent: "x" }), textContent: "x" };
      await click(f, "place-bar", { preventDefault: () => void (prevented += 1), target: { closest: (sel: string) => (sel.includes("place-opt") ? a : null) } });
    }
    expect(prevented).toBe(0);
    expect(f.writes).toEqual([]);
  });
  it("'Ganz Deutschland' in the header is remembered for every page; 'Ort vergessen' clears it everywhere", async () => {
    const f = fakeWindow({ permission: "denied", withSheet: true, headerOnly: true, stored: { "viafrei.place": { at: "ags:09564000", label: "Nürnberg", how: "manual" } } });
    await run(f, none);
    await click(f, "place-scope-de", stop);
    expect(JSON.parse(f.store.get("viafrei.place") ?? "null")).toMatchObject({ at: null, how: "germany" });
    expect(f.placed.at(-1)).toMatchObject({ label: null });
    expect(f.posts).toEqual([]);
    await click(f, "place-kept-forget");
    expect(f.store.has("viafrei.place")).toBe(false);
    expect(f.store.has("viafrei.place.recent")).toBe(false);
    expect(hidden(f)).toBe(true);
  });
});

describe("#1153 a place page's 'make this my place'", () => {
  const page = cfg({ source: "page", at: "ags:05315000", label: "Köln" });
  it("is offered while another place is remembered, and stores the page's place on its click only", async () => {
    const f = fakeWindow({ permission: "denied", withSheet: true, stored: { "viafrei.place": { at: "ags:09564000", label: "Nürnberg", how: "manual" } } });
    f.els["place-mine"]!.attrs["hidden"] = "";
    await run(f, page);
    expect(f.writes).toEqual([]);
    expect(f.els["place-mine"]?.attrs["hidden"]).toBeUndefined();
    await click(f, "place-mine");
    expect(JSON.parse(f.store.get("viafrei.place") ?? "null")).toMatchObject({ at: "ags:05315000", label: "Köln", how: "manual" });
    expect(f.els["place-mine"]?.attrs["hidden"]).toBe("");
    expect(hidden(f)).toBe(false);
    expect(f.assigned).toEqual([]);
  });
  it("is not offered when the page's place is the remembered one", async () => {
    const f = fakeWindow({ permission: "denied", withSheet: true, stored: { "viafrei.place": { at: "ags:05315000", label: "Köln", how: "manual" } } });
    f.els["place-mine"]!.attrs["hidden"] = "";
    await run(f, page);
    expect(f.els["place-mine"]?.attrs["hidden"]).toBe("");
  });
  it("is never offered off a place page", async () => {
    const f = fakeWindow({ permission: "denied", withSheet: true });
    f.els["place-mine"]!.attrs["hidden"] = "";
    await run(f, cfg({ source: "ip", at: "ags:05315000", label: "Köln" }));
    expect(f.els["place-mine"]?.attrs["hidden"]).toBe("");
  });
});

// #1170 (owner 2026-11-04): "use my location" could not be added to "my places" — the recent list took manual picks only.
describe("#1170 'use my location' can be added to my places", () => {
  const recent = (f: ReturnType<typeof fakeWindow>): { at: string; label: string }[] => JSON.parse(f.store.get("viafrei.place.recent") ?? "[]") as { at: string; label: string }[];
  it("offers the ★ once the position's cards are shown, and stores the area (the cell, never the position) on its click only", async () => {
    const f = fakeWindow({ permission: "prompt", position: { latitude: 52.520_712, longitude: 13.404_954 }, withSheet: true });
    f.els["place-mine"]!.attrs["hidden"] = "";
    await run(f, cfg({ source: "ip", at: "ags:05315000", label: "Köln" }));
    expect(f.els["place-mine"]?.attrs["hidden"]).toBe("");
    await click(f, "place-geo");
    const cell = cellKey(52.520_712, 13.404_954);
    expect(lastAt(f)).toBe(cell);
    // shown, and nothing added before the click (the choice itself is the "use my location" click's own write)
    expect(f.els["place-mine"]?.attrs["hidden"]).toBeUndefined();
    expect(recent(f)).toEqual([]);
    await click(f, "place-mine");
    const r = recent(f);
    expect(r.map((x) => x.at)).toEqual([cell]);
    expect(JSON.stringify(r)).not.toContain("520712");
    expect(JSON.stringify(r)).not.toContain("404954");
    expect(r[0]?.label).toBe(f.els["place-pill-label"]?.textContent);
    // the position stays the choice — it follows the visitor — and the ★ goes once the place is in the list
    expect(JSON.parse(f.store.get("viafrei.place") ?? "null")).toMatchObject({ at: cell, how: "browser" });
    expect(f.els["place-mine"]?.attrs["hidden"]).toBe("");
    expect(f.assigned).toEqual([]);
  });
  it("2.5.13 review: a stale ★ on the home, with the cards no longer the position's, stores nothing — the IP guess is no choice", async () => {
    const f = fakeWindow({ permission: "denied", withSheet: true });
    await run(f, cfg({ source: "ip", at: "ags:05315000", label: "Köln" }));
    f.els["place-mine"]!.removeAttribute("hidden");
    await click(f, "place-mine");
    expect(f.writes).toEqual([]);
    expect(f.store.get("viafrei.place")).toBeUndefined();
    expect(f.store.get("viafrei.place.recent")).toBeUndefined();
    expect(f.els["place-mine"]?.attrs["hidden"]).toBe("");
  });
  it("is not offered for a position already in my places", async () => {
    const cell = cellKey(52.52, 13.405);
    const f = fakeWindow({ permission: "prompt", position: { latitude: 52.52, longitude: 13.405 }, withSheet: true, stored: { "viafrei.place.recent": [{ at: cell, label: "Berlin-Mitte" }] } });
    f.els["place-mine"]!.attrs["hidden"] = "";
    await run(f, cfg({ source: "ip", at: "ags:05315000", label: "Köln" }));
    await click(f, "place-geo");
    expect(lastAt(f)).toBe(cell);
    expect(f.els["place-mine"]?.attrs["hidden"]).toBe("");
  });
});

// #1158 (owner 2026-11-03): a recent place opens what it was picked as — a station its page, a town its page, a point
// or another area the home's cards (handed over through the stored place, never through the address). Each entry keeps
// its kind (`k`) and its page (`p`); an entry from before #1158 keeps working as a point or an area.
describe("#1158 a recent place opens its own target, and keeps the kind it was picked as", () => {
  const none = cfg({ source: "none", at: null, label: null });
  const neuried = { at: "ags:09184132", label: "Neuried", k: "place", p: "neuried-muenchen" };
  const koelnHbf = { at: "pt:50.94303,6.95873", label: "Köln Hbf, Köln", k: "station", p: "koeln-hbf" };
  const point = { at: "pt:50.775,6.0825", label: "Dachsweg 12, Alsdorf", k: "point" };
  const district = { at: "dst:2891122", label: "Wehlheiden, Kassel", k: "area" };
  const legacy = { at: "pt:50.94303,6.95873", label: "Köln Hbf, Köln" };
  const chipEls = (f: Fake): El[] => (f.els["place-recent"]?.children ?? []).map((li) => li.children[0]).filter((c): c is El => c !== undefined);
  /** A click on the n-th chip the island built — the very element, so the row knows it as its own. */
  const chipClick = async (f: Fake, n: number): Promise<number> => {
    const a = chipEls(f)[n]! as El & { querySelector?: () => unknown };
    a.querySelector = () => a.children[0];
    let prevented = 0;
    await click(f, "place-bar", { preventDefault: () => void (prevented += 1), target: { closest: (sel: string) => (sel.includes("place-opt") ? a : null) } });
    return prevented;
  };
  const recentOf = (f: Fake): unknown => JSON.parse(f.store.get("viafrei.place.recent") ?? "null");
  const headerPage = (pathname: string, recent: unknown[]): Fake => fakeWindow({ permission: "denied", withSheet: true, headerOnly: true, pathname, stored: { "viafrei.place.recent": recent } });

  it("each chip links its target and names its kind: a station its page, a town its page, a point the home, an area the home's ?at=", async () => {
    const f = headerPage("/de/station/koeln-hbf", [neuried, koelnHbf, point, district]);
    await run(f, none);
    expect(chipEls(f).map((a) => [a.attrs["href"], a.attrs["data-at"], a.attrs["data-kind"]])).toEqual([
      ["/de/place/neuried-muenchen", "ags:09184132", "place"],
      ["/de/station/koeln-hbf", "pt:50.94303,6.95873", "station"],
      ["/de", "pt:50.775,6.0825", "point"],
      ["/de?at=dst:2891122", "dst:2891122", "area"],
    ]);
    expect(f.writes).toEqual([]);
  });

  it("on a station page a town chip switches the page to that town's page (the #1158 report: Neuried did nothing)", async () => {
    const f = headerPage("/de/station/koeln-hbf", [koelnHbf, neuried]);
    await run(f, none);
    expect(await chipClick(f, 1)).toBe(1);
    expect(f.assigned).toEqual(["/de/place/neuried-muenchen"]);
    expect(f.posts).toEqual([]);
    // remembered first, newest first, with its kind and page kept
    expect(JSON.parse(f.store.get("viafrei.place") ?? "null")).toMatchObject({ at: "ags:09184132", label: "Neuried", how: "manual" });
    expect(recentOf(f)).toEqual([withMonth(neuried), withMonth(koelnHbf)]);
  });

  it("from a page with no cards a point goes to the home with the point in the STORED place, never in the address", async () => {
    const f = headerPage("/de/news", [point]);
    await run(f, none);
    await chipClick(f, 0);
    expect(f.assigned).toEqual(["/de"]);
    expect(f.assigned.join(" ")).not.toContain("pt:");
    expect(JSON.parse(f.store.get("viafrei.place") ?? "null")).toMatchObject({ at: point.at, how: "manual" });
  });

  it("an entry from before #1158 (a bare pt:, no kind) is a point: it links the home and still works", async () => {
    const f = headerPage("/de/station/koeln-hbf", [legacy]);
    await run(f, none);
    expect(chipEls(f).map((a) => [a.attrs["href"], a.attrs["data-kind"]])).toEqual([["/de", "point"]]);
    await chipClick(f, 0);
    expect(f.assigned).toEqual(["/de"]);
    expect(recentOf(f)).toEqual([withMonth({ ...legacy, k: "point" })]);
  });

  it("a chip of the page already shown navigates nowhere: it is remembered as on #1153 and the page stays", async () => {
    const f = headerPage("/de/station/koeln-hbf", [koelnHbf]);
    await run(f, none);
    await chipClick(f, 0);
    expect(f.assigned).toEqual([]);
    expect(f.posts).toEqual([]);
    expect(recentOf(f)).toEqual([withMonth(koelnHbf)]);
  });

  it("on the home a station or a town opens its page; a point and an area change the cards in place", async () => {
    const f = fakeWindow({ permission: "denied", withSheet: true, stored: { "viafrei.place.recent": [koelnHbf, neuried, point, district] } });
    await run(f, none);
    await chipClick(f, 0);
    expect(f.assigned).toEqual(["/de/station/koeln-hbf"]);
    const g = fakeWindow({ permission: "denied", withSheet: true, stored: { "viafrei.place.recent": [koelnHbf, neuried, point, district] } });
    await run(g, none);
    await chipClick(g, 1);
    expect(g.assigned).toEqual(["/de/place/neuried-muenchen"]);
    for (const n of [2, 3]) {
      const h = fakeWindow({ permission: "denied", withSheet: true, stored: { "viafrei.place.recent": [koelnHbf, neuried, point, district] } });
      await run(h, none);
      const at = chipEls(h)[n]!.attrs["data-at"];
      await chipClick(h, n);
      expect(h.assigned, String(at)).toEqual([]);
      expect(lastAt(h)).toBe(at);
    }
  });

  it("a popular chip (the server's, a town's page) opens that page, kept as a town with its page", async () => {
    const f = fakeWindow({ permission: "denied", withSheet: true, pathname: "/de/news", headerOnly: true });
    await run(f, none);
    const a = { inList: true, getAttribute: (n: string) => (n === "href" ? "/de/place/koeln" : null), querySelector: () => ({ textContent: "Köln" }), textContent: "Köln" };
    await click(f, "place-bar", { preventDefault: () => undefined, target: { closest: (sel: string) => (sel.includes("place-opt") ? a : null) } });
    expect(f.assigned).toEqual(["/de/place/koeln"]);
    expect(recentOf(f)).toEqual([withMonth({ at: "slug:koeln", label: "Köln", k: "place", p: "koeln" })]);
  });

  it("a motorway page keeps every chip on its road, a station's too (the around block for that point)", async () => {
    const f = fakeWindow({ permission: "denied", withSheet: true, pathname: "/de/autobahn/a1", stored: { "viafrei.place.recent": [koelnHbf, neuried] } });
    f.els["place-scope-de"]!.attrs["href"] = "/de/autobahn/a1?scope=de";
    await run(f, { ...none, around: { road: "A1", r: 25 } });
    expect(chipEls(f).map((a) => a.attrs["href"])).toEqual(["/de/autobahn/a1", "/de/autobahn/a1?at=ags:09184132"]);
    await chipClick(f, 0);
    expect(f.assigned).toEqual([]);
    expect(lastAt(f)).toBe(koelnHbf.at);
    // the kind and the page are kept though this page does not use them
    expect(recentOf(f)).toMatchObject([{ at: koelnHbf.at, k: "station", p: "koeln-hbf" }, neuried]);
  });

  it("a page or a kind that does not parse is not followed: the chip falls back to the pill's rule", async () => {
    const bad = [
      { at: "ags:09184132", label: "A", k: "place", p: "../x" },
      { at: "ags:05315000", label: "B", k: "station", p: "Koeln Hbf" },
      { at: "dst:2891122", label: "C", k: "javascript" },
    ];
    const f = headerPage("/de/news", bad);
    await run(f, none);
    expect(chipEls(f).map((a) => [a.attrs["href"], a.attrs["data-kind"]])).toEqual([
      ["/de?at=ags:09184132", "place"],
      ["/de?at=ags:05315000", "station"],
      ["/de?at=dst:2891122", "area"],
    ]);
  });

  it("a station picked in the search is kept as a station with its page, and its chip opens that page", async () => {
    const f = headerPage("/de/news", []);
    await run(f, none);
    const attrs: Record<string, string> = { href: "/de/station/koeln-hbf", "data-at": koelnHbf.at, "data-kind": "station" };
    const a = { getAttribute: (n: string) => attrs[n] ?? null, querySelector: () => ({ textContent: "Köln Hbf, Köln" }), textContent: "Köln Hbf, Köln" };
    await click(f, "place-bar", { preventDefault: () => undefined, target: { closest: (sel: string) => (sel.includes("place-opt") ? a : null) } });
    // #1153: a search pick on a page with no cards stays on that page
    expect(f.assigned).toEqual([]);
    expect(recentOf(f)).toEqual([withMonth(koelnHbf)]);
    expect(chipEls(f)[0]?.attrs["href"]).toBe("/de/station/koeln-hbf");
  });

  it("a station line with no page (no slug held) is still kept as a station, by its line's kind", async () => {
    const f = fakeWindow({ permission: "denied", withSheet: true });
    await run(f, none);
    const attrs: Record<string, string> = { href: `#${koelnHbf.at}`, "data-at": koelnHbf.at, "data-kind": "station" };
    const a = { getAttribute: (n: string) => attrs[n] ?? null, querySelector: () => ({ textContent: "Köln Hbf, Köln" }), textContent: "Köln Hbf, Köln" };
    await click(f, "place-bar", { preventDefault: () => undefined, target: { closest: (sel: string) => (sel.includes("place-opt") ? a : null) } });
    expect(recentOf(f)).toEqual([withMonth({ at: koelnHbf.at, label: "Köln-Ehrenfeld", k: "station" })]);
    expect(chipEls(f)[0]?.attrs["href"]).toBe("/de");
  });

  it("on the home a town picked by its key keeps the page the answer named; a district and a point do not take the town's", async () => {
    const f = fakeWindow({ permission: "denied", withSheet: true, slugs: { "ags:09184132": "neuried-muenchen", "dst:2891122": "kassel", [point.at]: "alsdorf" }, labels: { "ags:09184132": "Neuried" } });
    await run(f, none);
    await click(f, "place-bar", option("#ags:09184132", "Neuried"));
    expect((recentOf(f) as unknown[])[0]).toEqual(withMonth(neuried));
    await click(f, "place-bar", option("#dst:2891122", "Wehlheiden, Kassel"));
    expect((recentOf(f) as { k: string; p?: string }[])[0]).toMatchObject({ at: "dst:2891122", k: "area" });
    expect((recentOf(f) as { p?: string }[])[0]?.p).toBeUndefined();
    await click(f, "place-bar", option(`#${point.at}`, "Dachsweg 12, Alsdorf"));
    expect((recentOf(f) as { k: string; p?: string }[])[0]).toMatchObject({ at: point.at, k: "point" });
    expect((recentOf(f) as { p?: string }[])[0]?.p).toBeUndefined();
  });

  it("'make this my place' keeps the place page's own page with it", async () => {
    const f = fakeWindow({ permission: "denied", withSheet: true, pathname: "/de/place/koeln" });
    f.els["place-mine"]!.attrs["hidden"] = "";
    await run(f, cfg({ source: "page", at: "ags:05315000", label: "Köln" }));
    await click(f, "place-mine");
    expect(recentOf(f)).toEqual([withMonth({ at: "ags:05315000", label: "Köln", k: "place", p: "koeln" })]);
  });
});

// ---------------------------------------------------------------------------
// #1171: "use my location" at one of our objects opens that object's page
// ---------------------------------------------------------------------------

describe("#1171 'use my location' at a station, a fuel station, a charging site or a service area", () => {
  const none = cfg({ source: "none", at: null, label: null });
  const LAT = 50.951234;
  const LON = 6.917891;
  const LOC = join(HERE, "..", "src", "location");
  const FUEL = { href: "/de/fuel/aral-koeln-venloer-strasse-abcdefghij", label: "Aral, Venloer Straße" };
  const at = cellKey(LAT, LON);
  const cardsAsked = (f: Fake): string[] => f.posts.filter((p) => p.url === "/fragment/place").map((p) => (JSON.parse(p.body) as { at: string }).at);
  /** Every byte the island put on the device, and every request body but the lookup's. */
  const kept = (f: Fake): string => [...f.store.values()].join("\n");
  const others = (f: Fake): string => f.posts.map((p) => p.body).join("\n");

  it("a match opens the object's page; the cell is remembered with the object's name, the precise position nowhere (AC 1, AC 5)", async () => {
    const f = fakeWindow({ permission: "prompt", position: { latitude: LAT, longitude: LON, accuracy: 12 }, withSheet: true, spot: FUEL });
    await run(f, none);
    await click(f, "place-geo");
    expect(f.spots).toEqual([{ lat: LAT, lon: LON, acc: 12, lang: "de" }]);
    expect(f.assigned).toEqual([FUEL.href]);
    // no cards asked for the cell: the page opens instead
    expect(cardsAsked(f)).toEqual([]);
    expect(JSON.parse(f.store.get("viafrei.place") ?? "null")).toEqual(withMonth({ at, label: FUEL.label, how: "browser", k: "fuel", p: "aral-koeln-venloer-strasse-abcdefghij" }));
    expect(f.writes).toEqual(["set viafrei.place"]);
    expect(kept(f)).not.toContain(String(LAT));
    expect(kept(f)).not.toContain(String(LON));
    expect(kept(f)).not.toContain("6.9178");
  });

  it("the precise position travels in the lookup's body alone — in no other request and in no address", async () => {
    const f = fakeWindow({ permission: "prompt", position: { latitude: LAT, longitude: LON }, withSheet: true });
    await run(f, none);
    await click(f, "place-geo");
    expect(f.spots).toHaveLength(1);
    expect(others(f)).not.toContain(String(LAT));
    expect(others(f)).not.toContain(String(LON));
    expect([...f.replaced, ...f.assigned].join(" ")).not.toContain(String(LAT));
    const src = readFileSync(join(LOC, "island.ts"), "utf8");
    expect(src).toMatch(/w\.fetch\("\/fragment\/spot", \{ method: "POST", [^}]*\}, body: JSON\.stringify\(\{ lat, lon, acc, lang: cfg\.lang \}\)/);
  });

  it("no match (204): the cell's cards, as before, and nothing opens (AC 2)", async () => {
    const f = fakeWindow({ permission: "prompt", position: { latitude: LAT, longitude: LON }, withSheet: true });
    await run(f, none);
    await click(f, "place-geo");
    expect(f.spots).toHaveLength(1);
    expect(f.assigned).toEqual([]);
    expect(cardsAsked(f)).toEqual([at]);
    expect(JSON.parse(f.store.get("viafrei.place") ?? "null")).toEqual(withMonth({ at, label: "Köln-Ehrenfeld", how: "browser" }));
  });

  for (const spot of ["error", "reject"] as const) {
    it(`a lookup that fails (${spot}) is the cell's cards, never an error (AC 3)`, async () => {
      const f = fakeWindow({ permission: "prompt", position: { latitude: LAT, longitude: LON }, withSheet: true, spot });
      await run(f, none);
      await click(f, "place-geo");
      expect(f.assigned).toEqual([]);
      expect(cardsAsked(f)).toEqual([at]);
      expect(JSON.parse(f.store.get("viafrei.place") ?? "null")).toEqual(withMonth({ at, label: "Köln-Ehrenfeld", how: "browser" }));
    });
  }

  it("a lookup with no answer within 2 s is the cell's cards; its late answer opens nothing (AC 3)", async () => {
    const f = fakeWindow({ permission: "prompt", position: { latitude: LAT, longitude: LON }, withSheet: true, spot: "hold" });
    await run(f, none);
    await click(f, "place-geo");
    expect(cardsAsked(f)).toEqual([]);
    for (const t of f.timers.splice(0)) t();
    await flush();
    expect(cardsAsked(f)).toEqual([at]);
    expect(f.assigned).toEqual([]);
    expect(readFileSync(join(LOC, "island.ts"), "utf8")).toContain("const SPOT_MS = 2_000;");
  });

  it("an answer that is not one of our object pages, or the page already open, opens nothing", async () => {
    for (const href of ["https://example.org/de/fuel/x", "/de/place/koeln", "//evil/de/fuel/x", "/de/fuel/X Y"]) {
      const f = fakeWindow({ permission: "prompt", position: { latitude: LAT, longitude: LON }, withSheet: true, spot: { href, label: "x" } });
      await run(f, none);
      await click(f, "place-geo");
      expect(f.assigned, href).toEqual([]);
      expect(cardsAsked(f), href).toEqual([at]);
    }
    const here = fakeWindow({ permission: "prompt", position: { latitude: LAT, longitude: LON }, withSheet: true, spot: FUEL, pathname: FUEL.href });
    await run(here, cfg({ source: "page", at: "ags:05315000", label: "Köln" }));
    await click(here, "place-geo");
    expect(here.assigned.filter((u) => u === FUEL.href)).toEqual([]);
  });

  it("each kind's page is followed: a station, a charging site, a motorway's page for its service area", async () => {
    for (const href of ["/en/station/koeln-hbf", "/de/charging/ionity-koeln-x-abcdefghij", "/tr/autobahn/a3"]) {
      const f = fakeWindow({ permission: "prompt", position: { latitude: LAT, longitude: LON }, withSheet: true, spot: { href, label: "x" } });
      await run(f, none);
      await click(f, "place-geo");
      expect(f.assigned, href).toEqual([href]);
    }
  });

  it("#1182 (c), steward ruling 2026-11-08: the station index's island (spot: false) asks no object lookup after a precise click — the cell is loaded and remembered", async () => {
    // the control: the header's island on another page DOES look up the object, so the harness sees a lookup when one is made
    const ctl = fakeWindow({ permission: "prompt", position: { latitude: LAT, longitude: LON, accuracy: 12 }, withSheet: true, headerOnly: true });
    await run(ctl, none);
    await click(ctl, "place-geo");
    expect(ctl.spots).toHaveLength(1);
    const f = fakeWindow({ permission: "prompt", position: { latitude: LAT, longitude: LON, accuracy: 12 }, withSheet: true, headerOnly: true, spot: FUEL, pathname: "/de/station" });
    await run(f, { ...none, spot: false });
    await click(f, "place-geo");
    expect(f.spots).toEqual([]);
    expect(f.assigned).toEqual([]);
    expect(f.posts.map((p) => p.url)).not.toContain("/fragment/spot");
    expect(others(f)).not.toContain(String(LAT));
    expect(JSON.parse(f.store.get("viafrei.place") ?? "null")).toMatchObject({ at, how: "browser" });
  });

  it("nothing is asked or stored before a click: the silent read with a standing grant never looks up an object (AC 4)", async () => {
    const f = fakeWindow({ permission: "granted", position: { latitude: LAT, longitude: LON }, withSheet: true, spot: FUEL });
    await run(f, none);
    expect(f.spots).toEqual([]);
    expect(f.assigned).toEqual([]);
    expect(f.writes).toEqual([]);
    expect(cardsAsked(f)).toEqual([at]);
  });

  it("a fix vaguer than the vaguest rule asks nothing — the island's bound is the digest's", async () => {
    expect(readFileSync(join(LOC, "island.ts"), "utf8")).toContain(`const SPOT_ACC = ${String(SPOT_MAX_ACC)};`);
    const f = fakeWindow({ permission: "prompt", position: { latitude: LAT, longitude: LON, accuracy: SPOT_MAX_ACC + 1 }, withSheet: true, spot: FUEL });
    await run(f, none);
    await click(f, "place-geo");
    expect(f.spots).toEqual([]);
    expect(f.assigned).toEqual([]);
    expect(cardsAsked(f)).toEqual([at]);
    const edge = fakeWindow({ permission: "prompt", position: { latitude: LAT, longitude: LON, accuracy: SPOT_MAX_ACC }, withSheet: true, spot: FUEL });
    await run(edge, none);
    await click(edge, "place-geo");
    expect(edge.assigned).toEqual([FUEL.href]);
  });

  it("a second click while the lookup runs wins: the first lookup's answer opens nothing", async () => {
    const f = fakeWindow({ permission: "prompt", position: { latitude: LAT, longitude: LON }, withSheet: true, spot: "hold" });
    await run(f, none);
    await click(f, "place-geo");
    await click(f, "place-geo");
    expect(f.spots).toHaveLength(2);
    // both deadlines fire: the first lookup's (superseded) neither loads nor opens; the second's loads the cell once
    for (const t of f.timers.splice(0)) t();
    await flush();
    expect(f.assigned).toEqual([]);
    expect(cardsAsked(f)).toEqual([at]);
  });
});

// #1186 (owner 2026-11-04: "Save the type of the position hidden and switch to the specific type of the related page"):
// every recent place keeps its type (`k`) and its page (`p`), set where the entry is made — a suggestion pick, "use my
// location" at an object (#1171's lookup), the ★ on the object's page — and its chip opens the page of that type.
describe("#1186 every recent place keeps its type hidden and opens the page of that type", () => {
  const none = cfg({ source: "none", at: null, label: null });
  const LAT = 50.8168;
  const LON = 6.2466;
  const at = cellKey(LAT, LON);
  const HBF = { href: "/de/station/eschweiler-hbf", label: "Eschweiler Hbf" };
  const recentOf = (f: Fake): Record<string, unknown>[] => JSON.parse(f.store.get("viafrei.place.recent") ?? "[]") as Record<string, unknown>[];
  const keptPlace = (f: Fake): Record<string, unknown> => JSON.parse(f.store.get("viafrei.place") ?? "null") as Record<string, unknown>;
  const chipEls = (f: Fake): El[] => (f.els["place-recent"]?.children ?? []).map((li) => li.children[0]).filter((c): c is El => c !== undefined);
  const chipClick = async (f: Fake, n: number): Promise<void> => {
    const a = chipEls(f)[n]! as El & { querySelector?: () => unknown };
    a.querySelector = () => a.children[0];
    await click(f, "place-bar", { preventDefault: () => undefined, target: { closest: (sel: string) => (sel.includes("place-opt") ? a : null) } });
  };
  /** "Use my location" at the object `spot` names, then the next page — that object's own page, the header's island — and its ★. */
  const locatedAt = async (spot: { href: string; label: string }): Promise<Fake> => {
    const f = fakeWindow({ permission: "prompt", position: { latitude: LAT, longitude: LON, accuracy: 10 }, withSheet: true, spot });
    await run(f, none);
    await click(f, "place-geo");
    expect(f.assigned).toEqual([spot.href]);
    const next = fakeWindow({ permission: "denied", withSheet: true, headerOnly: true, pathname: spot.href, stored: { "viafrei.place": keptPlace(f) } });
    await run(next, none);
    expect(next.els["place-mine"]?.attrs["hidden"], "the ★ is offered on the object's page").toBeUndefined();
    await click(next, "place-mine");
    return next;
  };
  /** The entries, rendered on another page type (a news page): the header's island. */
  const chipsElsewhere = async (entries: unknown[], lang = "de", labels = LABELS): Promise<Fake> => {
    const g = fakeWindow({ permission: "denied", withSheet: true, headerOnly: true, pathname: `/${lang}/news`, stored: { "viafrei.place.recent": entries } });
    await run(g, { lang, server: { source: "none", at: null, label: null }, labels, cell: { lat: 0, lon: 0 } });
    return g;
  };

  it("AC 2: a located place found AT a station is kept as that station — its page and its name — never as a point", async () => {
    const f = await locatedAt(HBF);
    expect(recentOf(f)).toEqual([withMonth({ at, label: "Eschweiler Hbf", k: "station", p: "eschweiler-hbf" })]);
    expect(chipEls(f).map((a) => [a.attrs["href"], a.attrs["data-kind"], a.children[0]?.textContent])).toEqual([[HBF.href, "station", "Eschweiler Hbf"]]);
    // the ★ goes once the station is in the list
    expect(f.els["place-mine"]?.attrs["hidden"]).toBe("");
  });

  it("AC 1 (unit): a located place at no object is a point — its cards, by its place's label", async () => {
    const f = fakeWindow({ permission: "prompt", position: { latitude: LAT, longitude: LON, accuracy: 10 }, withSheet: true, labels: { [at]: "Eschweiler-Ost, 52249" } });
    await run(f, none);
    await click(f, "place-geo");
    await click(f, "place-mine");
    expect(recentOf(f)).toEqual([withMonth({ at, label: "Eschweiler-Ost, 52249", k: "point" })]);
    const g = await chipsElsewhere(recentOf(f));
    expect(chipEls(g).map((a) => [a.attrs["href"], a.attrs["data-kind"]])).toEqual([["/de", "point"]]);
    // its click is the cell's cards, handed over through the stored place
    await chipClick(g, 0);
    expect(g.assigned).toEqual(["/de"]);
    expect(keptPlace(g)).toMatchObject({ at, how: "manual" });
  });

  // AC 6: the table — each type made where it is made, then its chip on another page type opens that type's page
  const made: readonly { kind: string; page: string; make: () => Promise<Fake> }[] = [
    { kind: "station", page: "/de/station/eschweiler-hbf", make: () => locatedAt(HBF) },
    { kind: "fuel", page: "/de/fuel/aral-eschweiler-abcdefghij", make: () => locatedAt({ href: "/de/fuel/aral-eschweiler-abcdefghij", label: "Aral, Eschweiler" }) },
    { kind: "charging", page: "/de/charging/ionity-eschweiler-abcdefghij", make: () => locatedAt({ href: "/de/charging/ionity-eschweiler-abcdefghij", label: "IONITY Eschweiler" }) },
    { kind: "autobahn", page: "/de/autobahn/a4", make: () => locatedAt({ href: "/de/autobahn/a4", label: "Rasthof Aachener Land" }) },
    {
      kind: "place",
      page: "/de/place/eschweiler",
      // a town's link picked in the bar (here the server's popular chip of it, on a page with no cards)
      make: async () => {
        const f = fakeWindow({ permission: "denied", withSheet: true, pathname: "/de/news", headerOnly: true });
        await run(f, none);
        const a = { inList: true, getAttribute: (n: string) => (n === "href" ? "/de/place/eschweiler" : null), querySelector: () => ({ textContent: "Eschweiler" }), textContent: "Eschweiler" };
        await click(f, "place-bar", { preventDefault: () => undefined, target: { closest: (sel: string) => (sel.includes("place-opt") ? a : null) } });
        expect(f.assigned).toEqual(["/de/place/eschweiler"]);
        return f;
      },
    },
    // no control makes a federal road's entry today (the lookup names none, a road line is a page link): kept, it opens
    {
      kind: "road",
      page: "/de/road/b264",
      make: () => Promise.resolve({ store: new Map([["viafrei.place.recent", JSON.stringify([{ at: "pt:50.82,6.26", label: "B 264", k: "road", p: "b264" }])]]) } as unknown as Fake),
    },
  ];
  for (const t of made) {
    it(`AC 6: a ${t.kind} entry keeps its type, and its chip opens ${t.page} from another page type`, async () => {
      const f = await t.make();
      const entries = recentOf(f);
      expect(entries[0]).toMatchObject({ k: t.kind, p: t.page.split("/").slice(3).join("/") });
      const g = await chipsElsewhere(entries);
      expect(chipEls(g)[0]?.attrs["href"]).toBe(t.page);
      expect(chipEls(g)[0]?.attrs["data-kind"]).toBe(t.kind);
      await chipClick(g, 0);
      expect(g.assigned).toEqual([t.page]);
      // the type stays hidden: never in a request, and the click keeps it as it was
      expect(g.posts.map((p) => p.body).join("\n")).not.toContain(`"k"`);
      expect(recentOf(g)[0]).toMatchObject({ k: t.kind });
    });
  }

  it("AC 6: a motorway's exit and a Land's road keep their deeper page; a page that does not parse is not followed", async () => {
    const g = await chipsElsewhere([
      { at: "pt:50.8,6.2", label: "AS Eschweiler-Ost", k: "autobahn", p: "a4/exit-7-eschweiler-ost" },
      { at: "pt:51.2,6.8", label: "L 249", k: "road", p: "nw/l249" },
      { at: "pt:50.9,6.9", label: "x", k: "fuel", p: "../../impressum" },
      { at: "pt:50.9,6.95", label: "y", k: "autobahn", p: "a4/b/c/d" },
    ]);
    expect(chipEls(g).map((a) => a.attrs["href"])).toEqual(["/de/autobahn/a4/exit-7-eschweiler-ost", "/de/road/nw/l249", "/de", "/de"]);
  });

  it("AC 5: in every language the chip's name is where it goes — a station's name opens the station, a place label the cards", async () => {
    const entries = [
      { at, label: "Eschweiler Hbf", k: "station", p: "eschweiler-hbf" },
      { at: "pt:50.82,6.26", label: "Eschweiler-Ost, 52249", k: "point" },
    ];
    for (const lang of LIVE_LANGS) {
      const g = await chipsElsewhere(entries, lang, islandLabels(lang));
      const [st, pt] = chipEls(g);
      expect([st?.attrs["href"], st?.children[0]?.textContent], lang).toEqual([`/${lang}/station/eschweiler-hbf`, "Eschweiler Hbf"]);
      expect([pt?.attrs["href"], pt?.children[0]?.textContent], lang).toEqual([`/${lang}`, "Eschweiler-Ost, 52249"]);
      // the × beside each is named for that same place
      const xs = (g.els["place-recent"]?.children ?? []).map((li) => li.children[1]?.attrs["aria-label"] ?? "");
      expect(xs[0], lang).toContain("Eschweiler Hbf");
      expect(xs[1], lang).toContain("Eschweiler-Ost, 52249");
    }
  });

  it("AC 4: nothing is written before a click, and rendering typed entries asks and writes nothing", async () => {
    const f = fakeWindow({ permission: "granted", position: { latitude: LAT, longitude: LON }, withSheet: true, spot: HBF });
    await run(f, none);
    expect(f.writes).toEqual([]);
    const g = await chipsElsewhere([{ at, label: "Eschweiler Hbf", k: "station", p: "eschweiler-hbf" }]);
    expect(g.writes).toEqual([]);
    expect(g.posts).toEqual([]);
  });

  it("AC 3: an upgraded entry (lib/recent-kinds.ts) is rendered again at once — the island hears vf:recent", async () => {
    const g = await chipsElsewhere([{ at, label: "Eschweiler Hbf" }]);
    expect(chipEls(g)[0]?.attrs["href"]).toBe("/de");
    g.store.set("viafrei.place.recent", JSON.stringify([{ at, label: "Eschweiler Hbf", k: "station", p: "eschweiler-hbf" }]));
    for (const l of g.docListeners["vf:recent"] ?? []) l({});
    expect(chipEls(g)[0]?.attrs["href"]).toBe(HBF.href);
  });
});

// #1187 (owner 2026-11-04: "the header loses my position … It should be stable"): the pill is the VISITOR's place on
// every page type — the remembered one (written by a click only) over the IP guess and over the page's own object — and
// it says how that place was found in the same words everywhere and after a reload.
describe("#1187 the place pill stays the visitor's place on every page type", () => {
  const AT = cellKey(50.8168, 6.2466);
  const LABEL = "Eschweiler-Ost, 52249";
  const KEPT = {
    browser: { at: AT, label: LABEL, how: "browser" },
    manual: { at: "slug:koeln", label: "Köln", how: "manual" },
  } as const;
  const WORDS = { browser: "gerundet, ca. 500 m", manual: "gewählt" } as const;
  const pillOf = (f: Fake): [string, string] => [f.els["place-pill-label"]?.textContent ?? "", f.els["place-pill-how"]?.textContent ?? ""];
  /** The server's first render: the pill names what the server knew (the IP guess, the page's place, or "Ort wählen"). */
  const served = (f: Fake, label: string, how: string): Fake => {
    f.els["place-pill-label"]!.textContent = label;
    f.els["place-pill-how"]!.textContent = how;
    return f;
  };
  const headerPage = async (pathname: string, kept: object, permission: PermissionState): Promise<Fake> => {
    const f = served(fakeWindow({ permission, withSheet: true, headerOnly: true, pathname, stored: { "viafrei.place": kept } }), "Ort wählen", "Ort wählen");
    await run(f, cfg({ source: "none", at: null, label: null }));
    return f;
  };
  // Every page type and the island it carries: the home and a place page print it in the body (with the cards' slot),
  // every other page the header's own (no slot) — station, fuel station, charging site, road, state, news, connect,
  // legal. A motorway page has its own case below (its pill names the road first).
  const HEADER_PAGES = ["/de/station/aachen-hbf", "/de/fuel/aral-aachen-abcdefghij", "/de/charging/ionity-aachen-abcdefghij", "/de/road/b264", "/de/state/nordrhein-westfalen", "/de/news", "/de/connect", "/de/impressum"];
  const PAGES: readonly { name: string; open: (kept: object, permission: PermissionState) => Promise<Fake> }[] = [
    {
      name: "home (IP guess Aachen)",
      open: async (kept, permission) => {
        const f = served(fakeWindow({ permission, position: { latitude: 50.8168, longitude: 6.2466, accuracy: 10 }, withSheet: true, stored: { "viafrei.place": kept }, labels: { [AT]: LABEL, "slug:koeln": "Köln" } }), "Aachen", "ungefähr");
        await run(f, cfg({ source: "ip", at: "ags:05334002", label: "Aachen" }));
        return f;
      },
    },
    {
      name: "place page (Aachen)",
      open: async (kept, permission) => {
        const f = served(fakeWindow({ permission, withSheet: true, pathname: "/de/place/aachen", stored: { "viafrei.place": kept } }), "Aachen", "gewählt");
        await run(f, cfg({ source: "page", at: "ags:05334002", label: "Aachen" }));
        return f;
      },
    },
    ...HEADER_PAGES.map((pathname) => ({ name: `header island ${pathname}`, open: (kept: object, permission: PermissionState) => headerPage(pathname, kept, permission) })),
  ];
  for (const kind of ["browser", "manual"] as const)
    for (const p of PAGES)
      for (const permission of ["prompt", "denied", "granted"] as const) {
        // a browser area goes when the location is BLOCKED (Art. 7(3) GDPR) — not this bug's case
        if (kind === "browser" && permission === "denied") continue;
        it(`AC 4: ${p.name}, a remembered ${kind} place, permission ${permission}: the pill names it, as found`, async () => {
          const kept = KEPT[kind];
          const f = await p.open(kept, permission);
          // a granted browser on the home reads a fix at the kept area — the same place, said as the click said it
          expect(pillOf(f)).toEqual([kept.label, WORDS[kind]]);
          // never the page's object, never the IP guess, on any event the headline heard
          expect(f.placed.map((e) => e.label)).not.toContain("Aachen");
          // AC 5: nothing written for it (the click-only rule)
          expect(f.writes).toEqual([]);
        });
      }

  it("AC 4: a motorway page names the remembered place after its road, said as found", async () => {
    for (const kind of ["browser", "manual"] as const) {
      const f = fakeWindow({ permission: "prompt", stored: { "viafrei.place": KEPT[kind] }, labels: { [AT]: LABEL, "slug:koeln": "Köln" } });
      await run(f, { ...cfg({ source: "ip", at: "ags:05334002", label: "Aachen" }), around: { road: "A4", r: 25 } });
      expect(pillOf(f), kind).toEqual([`A4 · ${KEPT[kind].label}`, WORDS[kind]]);
    }
  });

  it("AC 4: with nothing remembered a place page keeps its own place; a kept 'Ganz Deutschland' stays on it", async () => {
    const f = served(fakeWindow({ permission: "prompt", withSheet: true, pathname: "/de/place/aachen" }), "Aachen", "gewählt");
    await run(f, cfg({ source: "page", at: "ags:05334002", label: "Aachen" }));
    expect(pillOf(f)).toEqual(["Aachen", "gewählt"]);
    const g = fakeWindow({ permission: "prompt", withSheet: true, pathname: "/de/place/aachen", stored: { "viafrei.place": { at: null, how: "germany" } } });
    await run(g, cfg({ source: "page", at: "ags:05334002", label: "Aachen" }));
    expect(g.placed.at(-1)).toMatchObject({ label: null });
    expect(g.writes).toEqual([]);
  });

  it("AC 6: no visible jump — on the home the first place the headline hears is the remembered one, never the IP guess", async () => {
    const f = await PAGES[0]!.open(KEPT.manual, "prompt");
    expect(f.placed[0]?.label).toBe("Köln");
  });

  it("AC 1/2 (unit): 'use my location' on the home, or a pick — then every page type says the same place, the same way", async () => {
    // the click: remembered, and said as found
    const home = fakeWindow({ permission: "prompt", position: { latitude: 50.8168, longitude: 6.2466, accuracy: 10 }, withSheet: true, labels: { [AT]: LABEL } });
    await run(home, cfg({ source: "ip", at: "ags:05334002", label: "Aachen" }));
    await click(home, "place-geo");
    expect(pillOf(home)).toEqual([LABEL, WORDS.browser]);
    // a pick in the header's list on a news page
    const news = fakeWindow({ permission: "denied", withSheet: true, headerOnly: true, pathname: "/de/news" });
    await run(news, cfg({ source: "none", at: null, label: null }));
    const koeln = { getAttribute: (n: string) => (n === "href" ? "/de/place/koeln" : null), querySelector: () => ({ textContent: "Köln" }), textContent: "Köln" };
    await click(news, "place-bar", { preventDefault: () => undefined, target: { closest: (sel: string) => (sel.includes("place-opt") ? koeln : null) } });
    expect(pillOf(news)).toEqual(["Köln", WORDS.manual]);
    for (const [from, word] of [[home, WORDS.browser], [news, WORDS.manual]] as const) {
      const kept = JSON.parse(from.store.get("viafrei.place") ?? "null") as { label: string };
      for (const p of PAGES) expect(pillOf(await p.open(kept, "prompt")), p.name).toEqual([kept.label, word]);
    }
  });
});

describe("#1187 'make this my place' on a place page moves the pill to it", () => {
  it("the visitor's Köln on the pill; ★ on Aachen's page keeps Aachen, and the pill names Aachen, as chosen", async () => {
    const f = fakeWindow({ permission: "prompt", withSheet: true, pathname: "/de/place/aachen", stored: { "viafrei.place": { at: "slug:koeln", label: "Köln", how: "manual" } } });
    f.els["place-pill-label"]!.textContent = "Aachen";
    await run(f, cfg({ source: "page", at: "ags:05334002", label: "Aachen" }));
    expect(f.els["place-pill-label"]?.textContent).toBe("Köln");
    expect(f.writes).toEqual([]);
    await click(f, "place-mine");
    expect(JSON.parse(f.store.get("viafrei.place") ?? "null")).toMatchObject({ at: "ags:05334002", label: "Aachen", how: "manual" });
    expect([f.els["place-pill-label"]?.textContent, f.els["place-pill-how"]?.textContent]).toEqual(["Aachen", "gewählt"]);
  });
});

describe("#1224: a place the digest did not answer is asked again, the cards loading meanwhile, as shipped", () => {
  const ipServer = cfg({ source: "ip", at: "ags:05315000", label: "Köln" });
  const kept = { "viafrei.place": { at: "ags:05111000", label: "Düsseldorf", how: "manual" } };
  const asks = (f: Fake): number => f.posts.filter((p) => p.url === "/fragment/place" && p.body.includes("ags:05111000")).length;
  const slot = (f: Fake): El => f.els["place-slot"] as El;

  it("a first 503 then the cards: shown without a reload, never said as failed, loading until they arrive", async () => {
    const f = fakeWindow({ permission: "denied", stored: kept, seq: { "ags:05111000": [503] } });
    await run(f, ipServer);
    expect(asks(f)).toBe(1);
    expect(slot(f).classes.has("is-updating")).toBe(true);
    expect(f.els["place-live"]?.textContent).not.toBe(LABELS.failed);
    expect(await spend(f)).toEqual([RETRY_WAITS_MS[0]]);
    expect(asks(f)).toBe(2);
    expect(String(slot(f).innerHTML)).toContain("ags:05111000");
    expect(slot(f).classes.has("is-updating")).toBe(false);
    expect(f.els["place-live"]?.textContent).not.toBe(LABELS.failed);
  });

  it("no answer at all (a network error) is asked again the same way", async () => {
    const f = fakeWindow({ permission: "denied", stored: kept, seq: { "ags:05111000": ["reject", "reject"] } });
    await run(f, ipServer);
    expect(await spend(f)).toEqual([RETRY_WAITS_MS[0], RETRY_WAITS_MS[1]]);
    expect(asks(f)).toBe(3);
    expect(String(slot(f).innerHTML)).toContain("ags:05111000");
  });

  it("the failed sentence only once every wait is spent: 1 + RETRY_WAITS_MS.length asks", async () => {
    const f = fakeWindow({ permission: "denied", stored: kept, failAt: ["ags:05111000"] });
    await run(f, ipServer);
    expect(f.els["place-live"]?.textContent).not.toBe(LABELS.failed);
    expect(await spend(f)).toEqual([...RETRY_WAITS_MS]);
    expect(asks(f)).toBe(1 + RETRY_WAITS_MS.length);
    expect(f.els["place-live"]?.textContent).toBe(LABELS.failed);
    expect(slot(f).classes.has("is-updating")).toBe(false);
  });

  it("2.5.22: the shell's LOADING placeholder (a cold read) goes in the slot still loading for the filler — never said as failed", async () => {
    const f = fakeWindow({ permission: "denied", stored: kept, loadingAt: ["ags:05111000"] });
    await run(f, ipServer);
    expect(asks(f)).toBe(1);
    expect(String(slot(f).innerHTML)).toMatch(/^<div class="place-fill place-fill--loading is-loading"/);
    expect(f.dispatched).toContain("vf:fill");
    expect(f.els["place-live"]?.textContent).not.toBe(LABELS.failed);
    // the pill keeps naming the kept place: the placeholder carries no name, and none is blanked
    expect(f.els["place-pill-label"]?.textContent).toBe("Düsseldorf");
    // the filler's cards name it
    for (const l of f.docListeners["vf:filled"] ?? []) l({ detail: { id: "place-cards", label: "Düsseldorf", key: "ags:05111000" } });
    expect(f.els["place-pill-label"]?.textContent).toBe("Düsseldorf");
  });

  it("a 404 (no such place) is final: asked once, no wait", async () => {
    const f = fakeWindow({ permission: "denied", stored: kept, seq: { "ags:05111000": [404] } });
    await run(f, ipServer);
    expect(f.retries).toEqual([]);
    expect(asks(f)).toBe(1);
    expect(f.els["place-live"]?.textContent).toBe(LABELS.failed);
  });
});
