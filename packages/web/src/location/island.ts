/**
 * The location island of the home and the place pages (#564 § 1–3, § 6, § 9):
 * one small inline script under the request's nonce, no framework, no
 * request to anybody but this origin, and nothing that leaves the device
 * except "cards for area X".
 *
 * What it does, in order:
 *  1. reads the remembered choice of this device (`localStorage` "viafrei.place":
 *     an area key, a label and how it was found — "manual" or "browser" — or
 *     "germany" with no area, nothing else) and, when it beats what the server
 *     rendered, swaps the cards. The device storage is written ONLY as the
 *     direct result of a click in this page's own position bar (owner
 *     2026-10-13, "c"): a place picked or typed ("manual", with the recent list
 *     beside it), "use my location" ("browser"), "all of Germany" ("germany");
 *     "forget place" deletes it all. While a remembered choice is in use, the
 *     line under the bar says so, with "forget place" as its control (owner
 *     2026-10-13, "b") — the line is shown whenever that is true, and nothing
 *     is stored to remember that it was shown. Two leftovers of the rule before
 *     v2.0.10 are deleted on load: "viafrei.place.asked" and an entry of how
 *     "auto", both written without such a click. The ladder's order is this
 *     function's own and is tested here, as shipped (`test/location.test.ts`):
 *     a choice made now > a remembered CHOICE ("manual" or "germany", which no
 *     browser fix and no IP guess replaces) > a browser fix (standing grant
 *     only) > a remembered browser area ("browser") > the IP guess >
 *     Germany-wide;
 *  2. never makes the browser ASK by itself (v2.0.10): the browser's question
 *     appears only after a click on "use my location". When the Permissions
 *     API says the location is ALREADY "granted", the home reads the position
 *     without a question and stores nothing; in any other state ("prompt",
 *     "denied", unknown) it uses the remembered choice or the IP guess. The
 *     position is rounded to the ~500 m cell HERE, on the device, before
 *     anything is sent, and the place is named on the server from that cell
 *     ("nahe Dachsweg, Alsdorf") — never more precisely than the cell. A
 *     remembered browser area is deleted when the permission reads "denied".
 *     ONE exception, after the click alone (#1171): a precise fix (at most
 *     `SPOT_ACC` metres) is sent once, in the body of `POST /fragment/spot`,
 *     to ask whether the person stands AT one of our objects with a page —
 *     a station, a fuel station, a charging site, a service area — and on a
 *     match that page opens; the position is used for that lookup only and
 *     is never stored here (the cell is remembered, as for every click);
 *     no match, an error or no answer within `SPOT_MS` is the cell's cards;
 *  3. runs the position bar (#1112, inline — no dialog): one input with
 *     suggestions from our own gazetteer (a pick sets the position in place;
 *     Enter opens the site search, #1111), "use my location", the recent
 *     places as chips (the popular ones while there are none), each with its
 *     ×, and "forget place". Every chip is an ordinary link to its own target
 *     (`tgt`, #1158: a station's or a town's page, kept with the kind it was
 *     picked as; else the pill's rule, `placeHref`), so it works without
 *     JavaScript; with it, a click opens that page (a station's or a town's,
 *     or any target from a page with no cards of its own) or changes the
 *     cards in place (the home, a motorway page). `place-live` announces the place alone; the
 *     suggestions' count has its own status line. A choice in the bar
 *     replaces the page's address with its shareable form (`addr`), so reload
 *     shows it and Back leaves the page;
 *  4. tells the consent island which rung won (`vf:location`), which sends the
 *     `location_source` event only after consent and never with a place;
 *  5. says HOW each place it asks for was obtained (`how` in the POST body:
 *     "manual", "browser" or "saved", #564): the shell asks for that
 *     place's fresh fuel prices only on such a request (owner 2026-10-12), and
 *     cards whose prices are still on their way arrive wrapped for the page's
 *     filler (`lib/fill.ts`), which this island wakes with `vf:fill` and which
 *     tells it the place's name back with `vf:filled`. On a page the home's
 *     automatic reload opened (its address carries `r=auto`) every automatic
 *     load says `how: "held"` instead, which asks nothing, until the person
 *     opens the place bar (#564 review: a reload nobody made is not a user
 *     action); the mark is then taken off the address, so the person's own
 *     reload is a person's request again.
 *
 * It is written as ONE function that closes over nothing: `islandScript()`
 * prints its source into the page, and `test/location.test.ts` runs that very
 * text against a fake window, so what is tested is what ships.
 *
 * No visible jump from the IP guess to the place this device remembers
 * (owner 2026-10-12: "it shows the location by ip and switch to the browser
 * location in the next seconds. It is visible and looks ugly"). When a
 * remembered place differs from the server's, the cards are held hidden
 * (`data-pending`, styled in site.css) from this synchronous first step —
 * run while the page is parsed, so in practice before the first paint, though
 * a browser that paints mid-parse could show a frame — and the pill names the
 * remembered place at once.
 * They are shown when the remembered cards arrive, or, if that fails or the
 * entry no longer counts, the server's cards are shown with the pill put
 * back as it was rendered (or as the page's filler has since named it); and
 * after 8 s the same happens regardless. Any swap the person makes, or
 * "all of Germany", ends the hold at once.
 *
 * No flaking between the browser and the IP guess either (owner 2026-10-12:
 * "The position is still flaking between the browser and ip"). When a fix is
 * POSSIBLE — this device kept a browser area ("browser") — the IP cards are held the same way until the fix
 * answers, and with the permission already granted the page swaps ONCE, to
 * the fix: a kept browser area is no longer loaded first and replaced a
 * moment later. A fix inside `KEEP_M` of the area already shown or kept is
 * the same place (a position drifts across a cell edge between visits): the
 * cards stay, nothing is reloaded. Without a fix the kept area is the
 * fallback, then the server's cards.
 *
 * Notes moved out of the function body to keep the printed island inside its
 * budget (owner 2026-10-12: 20 000 characters, measured with every
 * language's real labels in `test/location.test.ts`):
 *  - `locate` reads the position in two cases only (v2.0.10): `fromBar`, the
 *    person pressed "use my location" in the position bar — the one action
 *    that may make the browser ask, and the one after which the cell is
 *    remembered ("browser"); and on a home load when the permission is ALREADY
 *    "granted", which puts no question and stores nothing.
 *  - Expiry (#706, data-steward L4, DSK OH Telemedien Rn. 77): every kept
 *    entry (`viafrei.place` and each of `viafrei.place.recent`) carries `m`,
 *    the month it was last used (months since year 0, UTC: no day, no time).
 *    It is set when the person chooses, and moved to this month when the
 *    home begins with the kept choice (`touch`, written only when the month
 *    changed). On load, an entry `KEEP_MONTHS` (12) months old or more is
 *    deleted. An entry from before #706 has no stamp: it is stamped with this
 *    month on the first visit after #706 (the home or a place page alike),
 *    counts from then, and is never deleted for lacking a stamp. A
 *    month is enough for a twelve-month period and says less about the person
 *    than a date.
 *  - The leftovers deleted on load ("viafrei.place.asked", how "auto") were
 *    both written without a click in this page's own bar; deleted only when
 *    present, so a device that holds neither is not written to at all.
 *  - A browser-found area goes when the permission reads "denied"
 *    (data-steward 2026-10-12, L2: withdrawing in the browser's settings must
 *    stop its use, Art. 7(3) GDPR). Only "denied": a one-visit grant reports
 *    "prompt" again on the next load, and that is no withdrawal.
 *  - The card request is a POST so the area key travels in the BODY: the
 *    edge's access log records the request line (the edge configuration
 *    `vf_visits`), and a place in a URL would sit beside the address there for
 *    seven days.
 *  - A chosen place is remembered and wins on the next visit (owner
 *    2026-10-12), no box to tick — under the key it was picked by (a station's
 *    or an address's own point), so the next visit names it the same way, and
 *    with the full label the cards came back with ("Dachsweg 12, Alsdorf"),
 *    never only the town (v2.0.10).
 *
 * "Use my location" answers where it is seen (owner 2026-10-13: "It located
 * me to alsdorf" — a cached, network-only fix, and a failure said only to a
 * screen reader). The click asks the browser for a FRESH, PRECISE fix
 * (`enableHighAccuracy`, `maximumAge: 0`, 15 s); the pill reads "locating"
 * meanwhile; a failure shows a line under the bar (`place-geo-msg`) naming
 * the cause — blocked (code 1), unavailable (2), no fix within 15 s (3) —
 * and the place that stays shown; a fix coarser than `APPROX_M` is loaded but
 * said to be approximate. Nothing is stored on a failure. The silent read on
 * a standing grant stays cheap (`maximumAge` 5 min, 7 s).
 *
 * A coarse fix replaces nothing (owner 2026-10-13: "if I refresh the page it
 * loses my position" — a Wi-Fi/IP-based fix lands elsewhere in town). On the
 * silent path a remembered browser area wins unless the fix's own accuracy
 * is at most `TRUST_M` AND it lies more than max(`KEEP_M`, 2 × accuracy)
 * away; with nothing remembered, a fix coarser than `COARSE_M` is treated as
 * no fix and the server's place stays. An unreported accuracy is not trusted.
 */
import { CELL_DEG } from "./ladder.js";
import { INLINE_SCRIPTS } from "../lib/inline-scripts.js";
import { RETRY_WAITS_MS, type askAgain as AskAgain } from "../lib/fragment-retry.js";

export type IslandLabels = {
  readonly exact: string;
  readonly approx: string;
  /** The pill for a browser fix coarser than ~1 km: "ungefähr (Browser)" */
  readonly rough: string;
  readonly chosen: string;
  readonly germany: string;
  readonly choose: string;
  /** "Karten für {place} geladen" */
  readonly loaded: string;
  readonly failed: string;
  readonly noGeo: string;
  /** The pill while an explicit "use my location" waits for the browser: "Standort wird ermittelt …" */
  readonly locating: string;
  /** The visible line after a click whose fix failed: `{why}` one of the three reasons below, `{place}` what stays shown. */
  readonly geoNo: string;
  /** The reasons, by GeolocationPositionError code: 1 blocked, 2 unavailable, 3 no fix in time. */
  readonly geoDenied: string;
  readonly geoUnavailable: string;
  readonly geoTimeout: string;
  /** After a click whose fix came back coarser than ~1 km: the browser's location is only approximate. */
  readonly geoApprox: string;
  /** #1112: the chip row's name while it holds the recent places ("Zuletzt"), and a chip's ×: "{place} entfernen". */
  readonly recent: string;
  readonly drop: string;
  /** #1112: the suggestion list's own status line, never the place's: "Vorschläge: {n}". */
  readonly found: string;
};

export type IslandConfig = {
  readonly lang: string;
  /** What the server rendered: the IP rung's place, a place page's place, or nothing. */
  readonly server: { readonly source: "ip" | "page" | "none" | "outside" | "chosen" | "germany"; readonly at: string | null; readonly label: string | null };
  readonly labels: IslandLabels;
  readonly cell: { readonly lat: number; readonly lon: number };
  /**
   * #890: on a motorway page the island asks for "around you" on that road (`/fragment/motorway-around`) instead of
   * the place cards, with the radius the page's control sets (`vf:radius`); every load ends with `vf:loaded`.
   */
  readonly around?: { readonly road: string; r: number; readonly s?: string | null; readonly l?: readonly string[] | null; readonly follow?: boolean; readonly rd?: number };
  /** #1182 (steward ruling 2026-11-08, point 2): false — the page asks no exact position (`/fragment/spot`); the cell sorts its list. */
  readonly spot?: false;
};

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- the island runs in a browser and is tested against a fake one; `any` is the honest type of both */
/**
 * The island. Self-contained ON PURPOSE: it is serialised with
 * `Function.prototype.toString`, so it may reference its two parameters and
 * the browser's globals through `w`, and nothing from this module.
 */
export function placeIsland(w: any, cfg: IslandConfig, askAgain: typeof AskAgain, waits: readonly number[]): void {
  const d = w.document;
  const KEY = "viafrei.place";
  const ASKED = "viafrei.place.asked";
  const RECENT = "viafrei.place.recent";
  /** The page's around configuration, one object for the island's life (its radius `r` is set in place). */
  const AR = cfg.around;
  const $ = (id: string): any => d.getElementById(id);
  // #1224: folded (the island budget) — a click listener on an element that may be absent, a link's href or "", the path
  const click = (el: any, f: (e: any) => void): void => el?.addEventListener("click", f);
  const hrefOf = (a: any): string => String(a?.getAttribute("href") ?? "");
  const pathNow = (): string => String(w.location?.pathname ?? "");
  // An event for the page's other scripts; without CustomEvent nothing is told and the page stays as it is.
  const fire = (name: string, detail?: unknown): void => {
    try {
      d.dispatchEvent(new w.CustomEvent(name, { detail }));
    } catch {
      /* no CustomEvent */
    }
  };
  // The home's automatic reload (`?r=auto`, site/pages.ts HOME_REFRESH_URL): nothing this page does by itself asks.
  let quiet = false;
  try {
    const loc = w.location;
    quiet = /(?:^\?|&)r=auto(?:&|$)/.test(String(loc?.search ?? ""));
    if (quiet && typeof w.history?.replaceState === "function") {
      const rest = String(loc.search).replace(/^\?/, "").split("&").filter((p: string) => p !== "r=auto").join("&");
      w.history.replaceState(w.history.state ?? null, "", `${String(loc.pathname)}${rest === "" ? "" : `?${rest}`}${String(loc.hash ?? "")}`);
    }
  } catch {
    /* no location or history: the page is what it is */
  }
  // #1081: the charging filter of the address (`ev_*`) rides with every ask, so the cards the island swaps in stay filtered.
  let ev = "";
  try {
    ev = String(w.location?.search ?? "")
      .replace(/^\?/, "")
      .split("&")
      .filter((p: string) => /^ev_(?:op|kw|plug|free|term)=[A-Za-z0-9%,._-]{1,200}$/.test(p))
      .slice(0, 64)
      .join("&");
  } catch {
    ev = "";
  }
  const store = {
    get(k: string): any {
      try {
        const raw = w.localStorage.getItem(k);
        return raw === null ? null : JSON.parse(raw);
      } catch {
        return null;
      }
    },
    set(k: string, v: unknown): void {
      try {
        w.localStorage.setItem(k, JSON.stringify(v));
      } catch {
        /* private mode: this visit only */
      }
    },
    del(k: string): void {
      try {
        w.localStorage.removeItem(k);
      } catch {
        /* nothing stored */
      }
    },
  };
  const isKey = (s: unknown): boolean =>
    typeof s === "string" &&
    s.length <= 90 &&
    (/^ags:\d{8}$/.test(s) || /^slug:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) || /^pt:-?\d{1,2}(\.\d{1,6})?,-?\d{1,3}(\.\d{1,6})?$/.test(s) || /^dst:[1-9]\d{0,9}$/.test(s) || (/^plz:\d{5}$/.test(s) && s !== "plz:00000") || /^poi:[1-9]\d{0,12}$/.test(s));
  const snap = (v: number, step: number): number => Number((Math.round(v / step) * step).toFixed(4));
  const cellKey = (lat: number, lon: number): string => `pt:${snap(lat, cfg.cell.lat)},${snap(lon, cfg.cell.lon)}`;
  /** #1186: a kind with a page of its own and its page (`<kind>/<p>`), or null — the one rule every entry is read by. */
  const pg = (k: unknown, p: unknown): string | null => (typeof p === "string" && p.length <= 90 && /^(?:station|place|fuel|charging|autobahn|road)(?:\/[a-z0-9][a-z0-9-]*){1,3}$/.test(`${String(k)}/${p}`) ? `/${cfg.lang}/${String(k)}/${p}` : null);
  /** #1186: the kind and the page a page's own path names (`/de/station/x` → station, x). */
  const ofHref = (h: string): any => {
    const m = /^\/[a-z]{2}\/([a-z]+)\/(.+)$/.exec(h);
    return m !== null && pg(m[1], m[2]) !== null ? { k: m[1], p: m[2] } : null;
  };
  const placeOk = (s: any): boolean => s != null && isKey(s.at) && typeof s.label === "string" && s.label.length <= 200 && (s.how === "browser" || s.how === "manual");
  const savedOf = (): any => {
    const s = store.get(KEY);
    if (s !== null && s.how === "germany" && s.at === null) return s;
    return placeOk(s) ? s : null;
  };
  // #1113: the place a kept "Ganz Deutschland" goes back to (`back`, kept beside it by the click that chose Germany).
  const backOf = (s: any): any => (s !== null && s.how === "germany" && placeOk(s.back) ? { at: s.back.at, how: s.back.how, label: s.back.label } : null);
  // Leftovers of the rule before v2.0.10 (header, "Notes"): deleted only when present.
  if (store.get(ASKED) !== null) store.del(ASKED);
  if (store.get(KEY)?.how === "auto") store.del(KEY);
  // #706: see "Expiry" in the header.
  const KEEP_MONTHS = 12;
  const nowMs: number = typeof w.Date?.now === "function" ? w.Date.now() : Date.now();
  const thisMonth = ((at: Date): number => at.getUTCFullYear() * 12 + at.getUTCMonth())(new Date(nowMs));
  const expired = (e: any): boolean => e !== null && typeof e === "object" && typeof e.m === "number" && thisMonth - e.m >= KEEP_MONTHS;
  const unstamped = (e: any): boolean => e !== null && typeof e === "object" && typeof e.m !== "number";
  {
    const k = store.get(KEY);
    if (expired(k)) store.del(KEY);
    else if (unstamped(k)) store.set(KEY, { ...k, m: thisMonth });
    const kept = store.get(RECENT);
    if (Array.isArray(kept) && kept.some((e: any) => expired(e) || unstamped(e))) {
      const fresh = kept.filter((e: any) => !expired(e)).map((e: any) => (unstamped(e) ? { ...e, m: thisMonth } : e));
      if (fresh.length === 0) store.del(RECENT);
      else store.set(RECENT, fresh);
    }
  }
  const touch = (saved: any): void => {
    if (saved !== null && saved.m !== thisMonth) store.set(KEY, { ...saved, m: thisMonth });
  };

  const pill = $("place-pill");
  const pillLabel = $("place-pill-label");
  const pillHow = $("place-pill-how");
  const live = $("place-live");
  // #1153: no slot — the header's own island on a page with no cards (`Header.astro`): it names the remembered place,
  // writes a choice on its click and loads no cards; a detached element stands in for the slot.
  const H = $("place-slot") === null;
  const slot = H ? d.createElement("div") : $("place-slot");
  const bar = $("place-bar");
  // The line under the bar: shown while a remembered choice is in use; showing it stores nothing.
  const kept = $("place-kept");
  const toggle = (e: any, on: boolean): void => {
    if (e === null) return;
    if (on) e.removeAttribute("hidden");
    else e.setAttribute("hidden", "");
  };
  const showKept = (on: boolean): void => toggle(kept, on);
  if (pill === null) return;

  // #890 (2.3.8): a motorway page's main block follows the radius — swapped in from the around answer; the page's own
  // (the address's) is kept to restore when the person chooses "all of Germany". `follow` false: the address chose a
  // stretch, which wins, so no answer carries a main block.
  // Looked up when used: this script runs where the bar is, BEFORE the main block below it has been parsed.
  let plainMain: string | null = null;
  let aroundMain = false;
  // 2.4.6: the description above the main block (its `a.mw-in` links, #997) was linked against the WHOLE road's rows;
  // a swapped-in radius block lists fewer, so a link whose row is gone is unlinked — and linked again when it is back.
  // Never a dead in-page anchor (prod 2.4.5: three `#mw-land-…` on the A4 near Aachen). Nothing is stored or sent.
  const inLinks = new Map<any, string>();
  const relink = (): void => {
    if (typeof d.querySelectorAll !== "function") return;
    for (const a of Array.from<any>(d.querySelectorAll("a.mw-in"))) {
      if (!inLinks.has(a)) inLinks.set(a, hrefOf(a));
      const href = inLinks.get(a) ?? "";
      if (!href.startsWith("#")) continue;
      if ($(href.slice(1)) !== null) a.setAttribute("href", href);
      else a.removeAttribute("href");
    }
  };
  const swapMain = (html: string): void => {
    const mainEl = AR ? $("motorway-main") : null;
    if (mainEl === null) return;
    if (plainMain === null) plainMain = String(mainEl.innerHTML ?? "");
    mainEl.innerHTML = html;
    relink();
    // No fuel prices survive a swap: the snapshot may hold prices a click loaded long ago, with no loader behind them.
    const fuel = typeof mainEl.querySelector === "function" ? mainEl.querySelector(".motorway__fuelout") : null;
    if (fuel != null) fuel.innerHTML = "";
    fire("vf:main");
  };
  // The settle ask for the IP rung's main block is the page's own doing, not the person's: it never pulls the main
  // block from under a focus that is already inside it (review 2.3.8).
  const focusInMain = (): boolean => {
    const m = $("motorway-main");
    const a = d.activeElement;
    return m != null && a != null && typeof m.contains === "function" && m.contains(a);
  };
  let shown: string | null = cfg.server.at;
  // #1088: `chosen` — an addressable key in the home's address (`?at=`); `germany` — `?scope=de`: no place, nothing loaded.
  // The rung the server rendered (one name: the island is budgeted by its size).
  const SRC = cfg.server.source;
  const fixed = SRC === "page" || SRC === "chosen" || SRC === "germany";
  let source: string = SRC === "ip" ? "ip" : SRC === "page" || SRC === "chosen" ? "manual" : "none";
  let settled = false;
  const settle = (): void => {
    if (settled) return;
    settled = true;
    // #890 (2.3.8): the IP rung's block came with the first HTML, its main block did not (the page keeps its own, so
    // "all of Germany" can restore it): asked once now, in the body like every other position.
    if (AR && AR.follow === true && !aroundMain && shown !== null && pos) {
      void load(shown, source, true, true);
    }
    // #890 (G5): a motorway page is measured, so it never says how its position was found.
    if (AR) return;
    d.documentElement.setAttribute("data-vf-location", source);
    fire("vf:location", { source });
  };
  // #1187: a remembered place says how it was found — the same words on every page and after a reload as at the click
  // that kept it ("use my location": rounded; a pick: chosen), never a word of its own that changes with the page.
  const HOW: Record<string, string> = { browser: cfg.labels.exact, ip: cfg.labels.approx, manual: cfg.labels.chosen };
  const said = (h: string): string | undefined => HOW[h === "saved" ? savedOf()?.how : h];
  // The browser fix shown is coarser than APPROX_M: the pill says "approximate", never "exact".
  let rough = false;
  // The place's own name, as remembered; on a motorway page the pill SHOWS it after the road ("A7 · Kassel"), but the
  // road is never part of what is stored (review 2.3.6, #890): `viafrei.place`/`.recent` hold the place alone.
  let pillRaw = AR ? (cfg.server.label ?? "") : (pillLabel?.textContent ?? "");
  // #1070: the last answer's position outside Germany ("border": the nearest German place's cards; "far": all of
  // Germany) — never remembered as the visitor's place.
  let outside: string | null = null;
  // #1088: the place "Ganz Deutschland" can go back to (the headline's place radio): the last place shown, else the IP guess.
  // #1113: an address's or a page's place is kept as chosen when the person goes back to it; an IP guess is not kept.
  let back: any = cfg.server.at !== null && cfg.server.label !== null ? { at: cfg.server.at, how: SRC === "ip" ? "ip" : "manual", label: cfg.server.label } : null;
  // #1143: the pill's link names the place its text names, by ONE rule — the place's own page when it has one (a slug),
  // the page with `?at=` for another addressable key, else the page itself (a position, "Ganz Deutschland"). The text
  // used to follow every answer while the link stayed the server's: "Aachen-Burtscheid" linking to /de/place/pulheim.
  // The page itself is the "Ganz Deutschland" radio's target without its `?scope=de` (`scopeHrefs`).
  const pillBase = hrefOf($("place-scope-de")).replace(/\?scope=de$/, "") || `/${cfg.lang}`;
  // #1112: the page that shows a key from `?at=` — this page, except a place page, which IS its place: there, the home.
  const atBase = SRC === "page" ? `/${cfg.lang}` : pillBase;
  /** #1143, #1112: THE link of a place, the pill's and every recent chip's — so a chip works without JavaScript too. */
  const placeHref = (at: string | null, slug: string | null): string =>
    (AR ? null : (pg("place", slug) ?? pg("place", /^slug:(.+)$/.exec(at ?? "")?.[1]))) ?? (isKey(at) && !/^pt:/.test(String(at)) ? `${atBase}?at=${at}` : atBase);
  const pillHref = (label: string | null, at: string | null, slug: string | null): string => (label === null ? pillBase : placeHref(at, slug));
  /** `at` undefined: the same place renamed (or re-sourced) — the link stays; anything else moves it with the text. */
  const setPill = (label: string | null, how: string, at?: string | null, slug: string | null = null): void => {
    // #1198, THE rule of the pill's name: the place the visitor chose is named as they chose it (the remembered
    // choice's label — every pick, a recent chip's too, is written there on the click: `remember`), whatever name an
    // answer gave its cards: a motorway's "around you" names its stretch by the nearest junction's town ("A5 ·
    // Butzbach" for a remembered Alsdorf). Every name passes here (the load's, the filler's `vf:filled`). A position
    // ("use my location") is no choice: its answer names it.
    const k = savedOf();
    if (label && k?.how === "manual" && k.at === at) label = k.label;
    pillRaw = label ?? "";
    if (label === null || at !== undefined) pill.setAttribute("href", pillHref(label, at ?? null, slug));
    const R = AR;
    // On the home the place radio keeps naming the place it goes back to; the motorway pill says "Ganz Deutschland".
    if (pillLabel !== null) pillLabel.textContent = label === null ? (R ? R.road : back?.label || cfg.labels.choose) : R ? (label === "" ? R.road : `${R.road} · ${label}`) : label;
    if (pillHow !== null) pillHow.textContent = label === null ? cfg.labels.choose : how === "browser" && rough ? cfg.labels.rough : (said(how) ?? "");
    // #1088: the headline (`lib/place-head.ts`) follows: which radio is on, the source line, "aktualisiert für".
    fire("vf:place", { label, how, outside });
  };
  const say = (text: string): void => {
    if (live !== null) live.textContent = text;
  };
  // #890 (owner 2026-10-21): the radius is the visitor's OWN position's only — a browser fix, or the area a click on
  // "use my location" kept. An IP guess, a chosen town and "all of Germany" show no radius control and no zoom (hidden,
  // so out of the tab order and the accessibility tree); then `?r=` does not apply and leaves the address.
  let pos = false;
  const RD = AR?.rd ?? 25;
  let atR = RD;
  // The page's radius script (MotorwayPlace.astro) shows or hides the control, the zoom and `?r=` on `vf:pos`.
  const showR = (on: boolean): void => {
    pos = on;
    if (AR) fire("vf:pos", { on });
  };
  // #901 review: a script that starts after a `vf:pos` went out asks (`vf:pos-ask`) and is answered with where the
  // island stands — an event, never a mark in the DOM or in storage (a root data-vf-* is an analytics input here).
  if (AR) d.addEventListener("vf:pos-ask", () => fire("vf:pos", { on: pos }));
  showR(false);
  // Shown without a load: the block on screen is the radius's only if it was asked at that radius.
  const ownShown = (): void => {
    showR(true);
    if (AR && shown !== null && AR.r !== atR) void load(shown, source, true, true);
  };
  // The visible line for a click's failed or coarse fix (header); stores nothing.
  const geoMsg = $("place-geo-msg");
  const geoNote = (text: string | null): void => {
    if (geoMsg !== null) geoMsg.textContent = text ?? "";
    toggle(geoMsg, text !== null);
  };

  // The hold: see "No visible jump" in the header.
  let early = fixed ? null : savedOf();
  // "All of Germany" chosen before: kept like a chosen place, the IP cards go before the first paint.
  const wholeCountry = early !== null && early.how === "germany";
  if (wholeCountry) {
    back = backOf(early) ?? back;
    slot.innerHTML = "";
    shown = null;
    source = "none";
    setPill(null, "none");
    early = null;
    showKept(true);
  }
  // A kept browser area: held until the permission is known — a standing grant swaps ONCE, to the fix.
  const expectFix = !fixed && !wholeCountry && early !== null && early.how === "browser";
  let pending = !H && ((early !== null && early.at !== shown) || expectFix);
  // What the pill said before the hold, kept current by the filler while held.
  const held = { label: pillLabel?.textContent ?? "", raw: pillRaw, how: pillHow?.textContent ?? "", href: String(pill.getAttribute("href") ?? pillBase) };
  const reveal = (): void => {
    if (!pending) return;
    pending = false;
    slot.removeAttribute("data-pending");
    slot.removeAttribute("aria-busy");
  };
  const unhold = (): void => {
    if (!pending) return;
    if (pillLabel !== null) pillLabel.textContent = held.label;
    pillRaw = held.raw;
    if (pillHow !== null) pillHow.textContent = held.how;
    pill.setAttribute("href", held.href);
    reveal();
    fire("vf:place", { label: shown === null ? null : held.raw, how: source, outside });
  };
  if (pending) {
    // Armed first, so nothing below can leave the slot hidden for good.
    w.setTimeout(unhold, 8_000);
    slot.setAttribute("data-pending", "");
    slot.setAttribute("aria-busy", "true");
    if (early !== null) setPill(early.label, "saved", early.at);
    else if (pillHow !== null) pillHow.textContent = "…";
  }
  // Same place: a fix within KEEP_M of an area key's point (a drift across a cell edge is not a move).
  const KEEP_M = 400;
  /** Metres from an area key's point to a fix; Infinity for an AGS key or anything else. */
  const dist = (at: unknown, lat: number, lon: number): number => {
    const m = typeof at === "string" ? /^pt:(-?[\d.]+),(-?[\d.]+)$/.exec(at) : null;
    if (m === null) return Infinity;
    const dy = (Number(m[1]) - lat) * 111_320;
    const dx = (Number(m[2]) - lon) * 111_320 * Math.cos((lat * Math.PI) / 180);
    return Math.sqrt(dx * dx + dy * dy);
  };
  const near = (at: unknown, lat: number, lon: number): boolean => dist(at, lat, lon) <= KEEP_M;
  // A fix's own accuracy (header, "A coarse fix replaces nothing").
  const TRUST_M = 250;
  const COARSE_M = 2_000;
  const APPROX_M = 1_000;
  // #1171: the vaguest fix the object lookup is asked for (the digest's `SPOT_MAX_ACC`), and how long it may take.
  const SPOT_ACC = 150;
  const SPOT_MS = 2_000;

  // 2.4.4: the newest ask wins. Two asks can be in flight (the first load and a radius chip pressed before it
  // answered); an answer that arrives after a newer ask was made swaps nothing and fires nothing — the newer one does.
  // Without this the 25 km block answering late put itself back over the 5 km one the visitor had chosen.
  let asked = 0;
  // #1158: the place page the last answer named (`place-slug`), kept with a town picked on the home
  let lastSlug: string | null = null;
  // #1186: the object the last click found the person AT (a station, a fuel station, …), with its type and page
  let obj: any = null;
  /**
   * Ask this origin for the cards of `at` and swap them in; the pill follows. `how` is also what the shell is told.
   * true: shown; false: failed; null (2.4.4 review N2): SUPERSEDED — a newer ask was made while this one was on its
   * way, so its caller does nothing (no repill, no unhold): the newer ask owns the pill and the held cards.
   */
  const load = async (at: string, how: string, auto = false, again = false): Promise<boolean | null> => {
    if (!isKey(at)) return false;
    const mine = ++asked;
    // #1112: the cards on screen stay while the next ones load, marked as updating; never blanked.
    slot.classList.add("is-updating");
    // A radius ask (`again`) keeps the rung; otherwise a position is a fix, or a kept area a click on "use my location" made.
    const p = again ? pos : how === "browser" || (how === "saved" && savedOf()?.how === "browser");
    const r = AR && p ? AR.r : RD;
    try {
      // POST: the area key travels in the BODY, never in the access-logged URL (header, "Notes").
      const A = AR;
      const body = JSON.stringify({ at, lang: cfg.lang, how: quiet ? "held" : how, ...(ev === "" ? {} : { ev }), ...(A ? { road: A.road, r, s: A.s, ...(A.l ? { l: A.l } : {}), ...(p ? {} : { main: false }) } : {}) });
      // #1224: a digest that did not answer (a 5xx, no answer at all) is asked again (`lib/fragment-retry.ts`) while the
      // slot keeps its loading state; only once the waits are spent is it said as failed. A newer ask stops the asking.
      const res: any = await askAgain(
        w,
        () => w.fetch(A ? "/fragment/motorway-around" : "/fragment/place", { method: "POST", headers: { accept: "text/html", "content-type": "application/json" }, body, credentials: "omit" }),
        (_r: unknown, u: boolean) => mine === asked && u,
        waits,
        false,
      );
      if (mine !== asked) return null;
      if (res === null || res.status !== 200) {
        say(cfg.labels.failed);
        return done(false);
      }
      const html: string = await res.text();
      if (mine !== asked) return null;
      // `class=.place-fill`: the placeholder's class list may go on (`place-fill place-fill--loading`, #1224), and a dot,
      // not an unclosed double quote, keeps this file's quotes paired for the class-vocabulary scan (#922 D2) at no byte of
      // the island budget
      if (!/^<(?:section class="(?:place" id="place-cards|mwa" id="motorway-around)"|div class=.place-fill)/.test(html)) return done(false);
      const o = res.headers.get("place-outside");
      outside = o === "far" || o === "border" ? o : null;
      if (outside === "far") {
        slot.innerHTML = html;
        reveal();
        shown = null;
        source = "none";
        showR(false);
        geoNote(null);
        setPill(null, "none");
        say(cfg.labels.germany);
        return done(true);
      }
      let label = "";
      const slug = res.headers.get("place-slug");
      lastSlug = slug;
      try {
        label = decodeURIComponent(res.headers.get("place-label") ?? "");
      } catch {
        label = "";
      }
      // Nothing is swapped under the person's focus by an ask they did not make; the next radius change swaps both.
      if (A && auto && focusInMain()) return done(true);
      slot.innerHTML = html;
      // #890 (2.3.8): the page's main block, rendered by the server for the radius's stretch, rides in an inert
      // <template> after the block; it replaces the main block in place, so the stretch never enters the address (G5.3)
      // and nothing is filtered here (M7). No template (a stretch in the address wins): the main block stays.
      if (A) {
        const next = typeof slot.querySelector === "function" ? slot.querySelector("template#mw-main-next") : null;
        if (next !== null && p) {
          swapMain(String(next.innerHTML));
          aroundMain = true;
        } else if (!p && aroundMain && plainMain !== null) {
          // no position any more: the whole road's main block again
          swapMain(plainMain);
          aroundMain = false;
        }
        next?.remove();
        atR = r;
        // The DB-IP credit stays on the page whenever the lookup RAN for it, as on the home (data-sources
        // `dbip_city_lite`: CC BY 4.0, credited on every page where the lookup ran) — also after a browser fix.
      }
      // Whatever was held is replaced: show it, before the filler is woken for the new cards.
      reveal();
      // Prices still on their way: wake the page's filler (lib/fill.ts).
      fire("vf:fill");
      const reduce = typeof w.matchMedia === "function" && w.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduce) {
        slot.classList.remove("is-new");
        void slot.offsetWidth;
        slot.classList.add("is-new");
      }
      const key = res.headers.get("place-key");
      shown = key ?? at;
      source = how;
      showR(p);
      geoNote(null);
      // #1224 (2.5.22): the shell's LOADING placeholder (a cold place's read missed the deadline, or the digest refused it
      // at its cold-read limit) is in the slot still loading: the page's filler asks again after its delay and names the
      // place (`vf:filled`). It carries no key and no name (cards always do), so the pill keeps its text and a pick keeps
      // its own (`pillRaw || label`).
      if (!key) pillRaw = "";
      else {
        setPill(label, how, shown, slug);
        say(cfg.labels.loaded.replace("{place}", () => pillRaw));
      }
      return done(true);
    } catch {
      if (mine !== asked) return null;
      say(cfg.labels.failed);
      return done(false);
    }
  };
  const done = (ok: boolean): boolean => {
    slot.classList.remove("is-updating");
    fire("vf:loaded", { ok });
    return ok;
  };
  // #890: the page's radius control changed the radius — the same place again, at the new radius.
  d.addEventListener("vf:radius", (e: any) => {
    const r = Number(e?.detail?.r);
    if (!AR || !(r >= 1 && r <= 100)) return;
    AR.r = r;
    if (shown !== null && pos) void load(shown, source, false, true);
  });

  // #863: a place page IS its place — its URL, H1, title and canonical all name it. Another place chosen there is
  // that place's own page (a navigation, so the back button returns to this one); a point with no page is the home,
  // which shows what was just remembered. Swapping the cards alone left a page headed by the old place.
  const onPage = SRC === "page";
  const pageOf = (at: string | null, href: string | null): string => {
    // #892: a place page is `/<lang>/place/<slug>`; a key with no page link of its own is the home's.
    if (ofHref(href ?? "")?.k === "place") return String(href);
    return pg("place", /^slug:(.+)$/.exec(at ?? "")?.[1]) ?? `/${cfg.lang}`;
  };
  // #1171: is the person AT an object with a page? The one request with the precise position, in the body; never stored.
  const spot = (lat: number, lon: number, acc: number): Promise<{ h: string; l: string } | null> =>
    new Promise((ok) => {
      w.setTimeout(() => ok(null), SPOT_MS);
      w.fetch("/fragment/spot", { method: "POST", headers: { accept: "text/html", "content-type": "application/json" }, body: JSON.stringify({ lat, lon, acc, lang: cfg.lang }), credentials: "omit" }).then(
        (res: any) => {
          const h = String(res.headers.get("spot-href") ?? "");
          let l = "";
          try {
            l = decodeURIComponent(res.headers.get("spot-label") ?? "");
          } catch {
            l = "";
          }
          ok(res.status === 200 && /^\/[a-z]{2}\/(?:station|fuel|charging|autobahn)\/[a-z0-9][a-z0-9-]*$/.test(h) ? { h, l } : null);
        },
        () => ok(null),
      );
    });
  const go = (url: string): void => {
    try {
      w.location.assign(url);
    } catch {
      /* no location: the cards stay as they are */
    }
  };

  // #1112: the address follows a choice made in the bar — `?at=` for a key that may stand in one, `?scope=de` for
  // Germany, neither for a position (a point never enters a URL); replaced, so reload shows it and Back leaves the page.
  const addr = (at: string | null): void => {
    if (onPage || H) return;
    try {
      const L = w.location;
      const q = String(L.search ?? "").replace(/^\?/, "").split("&").filter((p: string) => p !== "" && !/^(?:at|scope)=/.test(p));
      if (at === null) q.push("scope=de");
      else if (/^(?:ags|slug|dst|plz|poi):/.test(at)) q.push(`at=${at}`);
      w.history.replaceState(w.history.state ?? null, "", `${String(L.pathname)}${q.length > 0 ? `?${q.join("&")}` : ""}${String(L.hash ?? "")}`);
    } catch {
      /* the address stays */
    }
  };

  /**
   * #1113: THE write path of the visitor's choice — one owner, written on the click itself by every control that
   * changes the view: a place (`manual`, `browser`) or, with `at` null, "Ganz Deutschland" with the place it goes back
   * to. Nothing else writes `viafrei.place` but "forget place", which deletes it; nothing is written on load.
   */
  const remember = (at: string | null, label: string, how: string, b: any = null, k: any = null): void => {
    // #1186: "use my location" at an object keeps that object's type and page with the place, hidden
    const o = how === "browser" && obj?.at === at && obj.l === label ? { k: obj.k, p: obj.p } : {};
    store.set(KEY, at === null ? { at: null, label: "", how: "germany", ...(placeOk(b) ? { back: { at: b.at, label: b.label, how: b.how } } : {}), m: thisMonth } : { at, label, how, m: thisMonth, ...o });
    if (how !== "manual" || at === null) return;
    addRecent(at, label, k);
  };
  /** #1170: one entry at the head of the recent places ("my places"), at most five — written on a click only. */
  function addRecent(at: string, label: string, k: any = null): void {
    const recent: any[] = (store.get(RECENT) ?? []).filter((r: any) => r !== null && isKey(r.at) && r.at !== at);
    // #1158: with the kind it was picked as and its page (`k`, `p`): a station opens its page again, a town its own.
    // #1186: a located place found AT an object is kept as that object, by its name; any other point says it is one.
    const o = k?.k ? null : objAt(at);
    store.set(RECENT, [{ at, label: o?.l || label, m: thisMonth, ...(k?.k ? k : o !== null ? { k: o.k, p: o.p } : /^pt:/.test(at) ? { k: "point" } : {}) }, ...recent].slice(0, 5));
  }
  /** #1170: is this key one of the recent places? */
  const inRecent = (at: string): boolean => ((store.get(RECENT) ?? []) as any[]).some((r: any) => r !== null && r.at === at);
  /**
   * #1186: the object a located place is AT — the one this click found, or the remembered position's while its own
   * page is shown (the click opened it) — with its type, page and name; else null.
   */
  function objAt(at: string): any {
    if (obj?.at === at && obj.k) return obj;
    const s = savedOf();
    return s?.how === "browser" && s.at === at && pg(s.k, s.p) === pathNow() ? { k: s.k, p: s.p, l: s.label } : null;
  }

  const perms = w.navigator?.permissions;
  const state = async (): Promise<string> => {
    try {
      return perms === undefined ? "prompt" : (await perms.query({ name: "geolocation" })).state;
    } catch {
      return "prompt";
    }
  };

  // The newest explicit "use my location": an older answer, or a silent read it overtook, changes nothing.
  let req = 0;
  // A later choice (a place, "all of Germany", "forget") retires every position answer still on its way:
  // the last thing the person chose wins (owner 2026-10-13, "I chose koln hbf, I want stay there").
  const supersede = (): void => {
    req++;
    obj = null;
    pill.removeAttribute("aria-busy");
  };
  // Read the position, rounded to the cell HERE (header, "Notes"): `fromBar` the click, else a standing grant.
  // `keep`: a remembered browser area, the fallback and the "same place" anchor.
  const locate = (onDone: () => void, fromBar: boolean, keep: any = null): void => {
    const geo = w.navigator?.geolocation;
    const my = fromBar ? ++req : req;
    let open = true;
    // The first answer to the newest request wins; anything else only finishes.
    const claim = (): boolean => {
      if (!open || my !== req) return false;
      open = false;
      if (fromBar) pill.removeAttribute("aria-busy");
      return true;
    };
    // The pill as the cards shown say, after "locating".
    const repill = (): void => {
      if (fromBar) setPill(shown === null && source === "none" ? null : pillRaw, source);
    };
    // No fix: the kept browser area, if any, then the server's cards (unhold); `then` once they are shown.
    const fallback = (then?: () => void): void => {
      const end = (): void => {
        then?.();
        onDone();
      };
      if (keep === null || keep.at === shown) {
        // unhold() restores the held pill; reveal() first would leave it reading "…".
        if (keep !== null) {
          setPill(keep.label, "saved", keep.at);
          reveal();
          showKept(true);
          ownShown();
        } else unhold();
        end();
        return;
      }
      void load(keep.at, "saved").then((ok) => {
        if (ok) {
          source = "saved";
          showKept(true);
        }
        // superseded (null): the newer ask owns the held cards
        if (ok !== null) unhold();
        end();
      });
    };
    const failed = (code: number): void => {
      if (!claim()) return onDone();
      say(cfg.labels.noGeo);
      repill();
      // Built after the fallback, so `{place}` names what is shown. Nothing is stored.
      fallback(() => {
        if (!fromBar) return;
        const why = code === 1 ? cfg.labels.geoDenied : code === 3 ? cfg.labels.geoTimeout : cfg.labels.geoUnavailable;
        const place = pillLabel?.textContent || cfg.labels.germany;
        geoNote(cfg.labels.geoNo.replace("{why}", () => why).replace("{place}", () => place));
      });
    };
    if (fromBar) {
      geoNote(null);
      if (pillHow !== null) pillHow.textContent = cfg.labels.locating;
      pill.setAttribute("aria-busy", "true");
      // A prompt nobody answers never calls back (its timeout starts after the answer): no fix in time.
      w.setTimeout(() => failed(3), 20_000);
    }
    if (geo === undefined || geo === null) return failed(2);
    geo.getCurrentPosition(
      (pos: any) => {
        if (!claim()) return onDone();
        // Rounded to the cell on the device: the exact position leaves this function only in the click's one
        // object lookup (`spot`, #1171), in a request body, and is stored nowhere.
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const acc0 = Number(pos.coords.accuracy);
        const acc = Number.isFinite(acc0) && acc0 >= 0 ? acc0 : Infinity;
        rough = acc > APPROX_M;
        let at = cellKey(lat, lon);
        if (!fromBar) {
          // Nothing kept: a fix coarser than COARSE_M is no fix.
          if (keep === null && acc > COARSE_M) return fallback();
          // The cards shown: no reload — but a coarse fix may not claim cards that are not the kept area.
          if (near(shown, lat, lon) && (keep === null || keep.at === shown || acc <= TRUST_M)) {
            if (keep !== null && keep.at === shown) rough = false;
            source = "browser";
            setPill(pillRaw, "browser");
            reveal();
            ownShown();
            onDone();
            return;
          }
          if (keep !== null && near(keep.at, lat, lon)) {
            at = keep.at;
            rough = false;
          }
          // A kept area wins unless the fix is precise AND really elsewhere.
          else if (keep !== null && !(acc <= TRUST_M && dist(keep.at, lat, lon) > Math.max(KEEP_M, 2 * acc))) return fallback();
        }
        const cells = (): void => void load(at, "browser").then((ok) => {
          // superseded (null): the newer ask owns the pill and the held cards — nothing is restored under it
          if (ok === false) {
            repill();
            unhold();
          }
          // "Use my location" is the person's decision in our own bar: remembered (owner 2026-10-12, v2.0.10).
          if (ok && fromBar && outside === null) {
            remember(shown ?? at, pillRaw, "browser");
            showKept(true);
            addr(shown ?? at);
            chips();
            if (rough) geoNote(cfg.labels.geoApprox);
            // #863: on a place page the position's own page (or the home), never the old heading over new cards.
            if (onPage) go(pageOf(shown ?? at, null));
          } else if (ok && fromBar) {
            // #1070: outside Germany — shown, never kept; a place page gives way to the home.
            showKept(false);
            if (onPage) go(pageOf(null, null));
          } else if (ok) showKept(keep !== null && at === keep.at);
          onDone();
        });
        // #1171: the click, a precise fix — at one of our objects its page opens (the cell remembered, as for every
        // click); otherwise, or superseded meanwhile, the cell's cards as before. #1186: the object found (`obj`) types
        // what this click keeps — the remembered place, and the entry "make this my place" adds.
        if (!fromBar || acc > SPOT_ACC || cfg.spot === false) return cells();
        const mine = asked;
        void spot(lat, lon, acc).then((s) => {
          if (mine !== asked || my !== req) return onDone();
          obj = s && { at, l: s.l, ...ofHref(s.h) };
          if (s === null || s.h === w.location?.pathname) return cells();
          remember(at, s.l, "browser");
          onDone();
          go(s.h);
        });
      },
      (err: any) => failed(Number(err?.code)),
      // The click: fresh and precise; the silent read: cheap (header). Only the cell leaves this function, but for `spot`.
      fromBar ? { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 } : { enableHighAccuracy: false, maximumAge: 300_000, timeout: 7_000 },
    );
  };

  // --- 1. the remembered choice, 2. the browser — never on a place page ---
  const start = async (): Promise<void> => {
    // #1153: the header alone — the remembered place, named; nothing asked, nothing loaded, nothing told.
    if (H) {
      const s = savedOf();
      if (s !== null && s.how !== "germany") put(s.at, s.label, "saved");
      showKept(s !== null);
      // #1186: on the page of the object the last click found the person at, its ★ keeps that object
      mineOn();
      return;
    }
    if (fixed) {
      const s = savedOf();
      showKept(s !== null);
      mineOn();
      // #1088: `?scope=de` keeps the remembered place as the one the place radio goes back to — loaded only on a click.
      if (s !== null && SRC === "germany") back = s.how === "germany" ? (backOf(s) ?? back) : { at: s.at, how: s.how, label: s.label };
      if (SRC === "germany" || (onPage && s?.how === "germany")) setPill(null, "none");
      // #1187: a place page is its place's cards; the pill stays the visitor's own place, never the page's
      else if (onPage && s !== null) setPill(s.label, "saved", s.at);
      settle();
      return;
    }
    // Armed BEFORE the permission query: a query that never settles must not leave the rung untold.
    w.setTimeout(settle, 10_000);
    const st = await state();
    let saved = savedOf();
    // A browser-found area goes when the location is BLOCKED for this site (header, "Notes"; Art. 7(3) GDPR).
    if (saved !== null && saved.how === "browser" && st === "denied") {
      store.del(KEY);
      saved = null;
    }
    touch(saved);
    // "All of Germany" was the person's choice: kept, nothing asked, no fix (the cards went in the first step).
    if (saved !== null && saved.how === "germany") {
      settle();
      return;
    }
    // Already granted, nothing chosen by hand: read without a question, NOTHING stored. Any other state asks nothing.
    if (st === "granted" && (saved === null || saved.how !== "manual")) {
      locate(settle, false, saved);
      return;
    }
    if (saved !== null && saved.at !== shown) {
      if (await load(saved.at, "saved")) {
        source = "saved";
        reveal();
        showKept(true);
      }
    } else if (saved !== null) {
      source = "saved";
      setPill(saved.label, "saved", saved.at);
      reveal();
      showKept(true);
      if (saved.how === "browser") ownShown();
    }
    // Not swapped (no entry, or the load failed): the server's cards and pill, as rendered. #1153: a stored place is
    // said under the bar whether or not its cards came — the line is about this device, not about the cards.
    if (saved !== null) showKept(true);
    unhold();
    settle();
  };

  // The filler filled the place cards: the pill names the place now.
  d.addEventListener("vf:filled", (e: any) => {
    const det = e?.detail;
    if (det === null || det === undefined || det.id !== "place-cards" || typeof det.label !== "string" || det.label === "") return;
    if (isKey(det.key)) shown = det.key;
    if (pending) {
      // The held server cards were filled: the pill they come back with names them.
      held.label = det.label;
      held.raw = det.label;
      held.how = said(source) ?? held.how;
      held.href = pillHref(det.label, isKey(det.key) ? det.key : null, typeof det.slug === "string" ? det.slug : null);
      return;
    }
    setPill(det.label, source, isKey(det.key) ? det.key : null, typeof det.slug === "string" ? det.slug : null);
  });

  // #1153: the header alone shows a place without its cards — the pill and the chips follow, nothing is loaded.
  const put = (at: string, label: string, how: string): void => {
    shown = at;
    source = how;
    setPill(label, how, at);
    say(cfg.labels.loaded.replace("{place}", () => label));
  };
  // #1153: "make this my place" — a place page's own place, offered while another one (or none) is remembered.
  const mineBtn = $("place-mine");
  // #1170: and while the cards are the visitor's own position ("use my location"), which no other control can add to
  // the recent places — the area key the cards were loaded for (the ~500 m cell), never the position itself.
  // #1186: and on the page of the object a click found the person at (the header's island): that object.
  const located = (): string | null => (shown !== null && !AR && (source === "browser" || objAt(shown) !== null) ? shown : null);
  const mineOn = (): void => {
    const l = located();
    toggle(mineBtn, l !== null ? !inRecent(l) : onPage && cfg.server.at !== null && savedOf()?.at !== cfg.server.at);
  };
  // #1158: kept as this town, with this page — its chip opens it again
  click(mineBtn, () => {
    const l = located();
    if (l !== null) {
      // the position stays the remembered choice (it follows the visitor); the place joins "my places" beside it
      addRecent(l, pillRaw);
      chips();
      return;
    }
    // a place page's own place only: on the home the server's place is the IP guess, which is no choice (#1113) — a
    // stale ★ there (the cards left the position since it was shown) writes nothing and is put away
    // #1187: the pill then names it
    const lb = cfg.server.label ?? held.raw;
    if (!onPage || cfg.server.at === null) {
      mineOn();
      return;
    }
    supersede();
    remember(cfg.server.at, lb, "manual", null, metaOf({ getAttribute: () => pathNow() }, cfg.server.at));
    setPill(lb, "saved", cfg.server.at);
    showKept(true);
    chips();
    mineOn();
  });
  // --- 3. the position bar (#1112) ---
  // "Forget place" (the bar and the line under it): everything this device remembered, gone at once.
  const forget = (): void => {
    supersede();
    store.del(KEY);
    store.del(RECENT);
    chips();
    showKept(false);
    mineOn();
    say(cfg.labels.germany);
  };
  click($("place-kept-forget"), forget);
  const input = $("place-hq");
  const choose = (at: string, label: string, href: string | null = null, k: any = null): void => {
    supersede();
    if (onPage) {
      // #892: the page's own place is picked by its page link (a `slug:` key) as often as by its key
      let here = "";
      try {
        here = pathNow();
      } catch {
        here = "";
      }
      if (at === shown || (here !== "" && /\/place\//.test(here) && pageOf(at, href) === here)) return;
      // Remembered as on the home, then that place's page (or the home, for a point): nothing is swapped here.
      remember(at, label, "manual", null, k);
      go(pageOf(at, href));
      return;
    }
    if (H) {
      remember(at, label, "manual", null, k);
      put(at, label, "manual");
      showKept(true);
      chips();
      return;
    }
    void load(at, "manual").then((ok) => {
      if (!ok) return;
      // Remembered under the key it was picked by, with the full label the cards came back with (header, "Notes").
      // #1158: a town picked by its key keeps the page the answer named, so its chip opens that page
      const up = k?.k === "area" && /^(?:ags|slug):/.test(at) && pg("place", lastSlug) !== null ? { k: "place", p: lastSlug } : k;
      remember(at, pillRaw || label, "manual", null, up);
      showKept(true);
      addr(shown ?? at);
      chips();
      // focus stays in the bar: on the chip of the place just chosen (now the first)
      if (list !== null && typeof list.querySelectorAll === "function") Array.from<any>(list.querySelectorAll(".place-opt")).find((c: any) => keyOfLink(c) === at)?.focus();
    });
  };
  const keyOfLink = (a: any): string | null => {
    // #1112: a recent chip carries its key (`data-at`) beside its link, which for a position is only the page itself
    const v = a.getAttribute("data-at");
    if (v != null) return isKey(v) ? v : null;
    const href = hrefOf(a);
    const pt = /^#((?!slug:).+)$/.exec(href);
    if (pt !== null && isKey(pt[1])) return pt[1] ?? null;
    // 2.4.6: a remembered place's no-script target, `…?at=<key>`
    const q = /[?&]at=((?!pt:|slug:)[^&]+)$/.exec(href);
    if (q !== null && isKey(q[1])) return q[1] ?? null;
    // #892: a place page link names its Gemeinde by its slug; the shell turns that into the key.
    const slug = /\/place\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(href);
    return slug === null || /\d{5}/.test(slug[1] ?? "") ? null : `slug:${slug[1]}`;
  };
  // #1112: the chip row — the recent places (at most five, newest first, each with its ×), else the server's popular
  // ones; the chip of the place shown is marked aria-current ("Ganz Deutschland" is the headline's radio, #1138) (a link may not carry aria-pressed). Rendering it stores nothing.
  const list = $("place-recent");
  const chipsL = $("place-chips-l");
  const popular = { html: String(list?.innerHTML ?? ""), label: String(chipsL?.textContent ?? "") };
  // #1158: a recent place's kind (`k`: what it was picked as) and its own page (`p`), both checked as read back
  // #1186: a station, a town, a fuel station, a charging site, a motorway (its exit or service area) or a federal road
  // by its page (`pg`); a point of interest, a point or another area by its key
  function kindOf(r: any): string {
    return pg(r.k, "x") !== null || /^(?:poi|point|area)$/.test(r.k) ? r.k : /^poi:/.test(r.at) ? "poi" : /^pt:/.test(r.at) ? "point" : "area";
  }
  /** #1158, #1186: THE target of a recent place — the page of its kind, else the pill's rule (`placeHref`). */
  const tgt = (r: any): string => (AR ? null : pg(kindOf(r), r.p)) ?? placeHref(r.at, null);
  /**
   * #1158: what a picked link is — as it was kept (#1186: first, because a chip's link on a motorway page is that
   * page), else a page's own object by its page, else its line's kind or its key's.
   */
  const metaOf = (a: any, at: string): any => {
    const rs = store.get(RECENT);
    const o = Array.isArray(rs) ? rs.find((r: any) => r?.at === at && typeof r.k === "string") : null;
    return o ? { k: kindOf(o), ...(typeof o.p === "string" ? { p: o.p } : {}) } : (ofHref(hrefOf(a)) ?? { k: kindOf({ at, k: a.getAttribute("data-kind") }) });
  };
  const chips = (): void => {
    // #1170: the ★ follows the recent places — a place just added hides it, a dropped one offers it again
    mineOn();
    const kept: any[] = store.get(RECENT) ?? [];
    const rs = (Array.isArray(kept) ? kept : []).filter((r: any) => r !== null && isKey(r.at) && typeof r.label === "string").slice(0, 5);
    if (list !== null) {
      list.innerHTML = rs.length === 0 ? popular.html : "";
      if (chipsL !== null) chipsL.textContent = rs.length === 0 ? popular.label : cfg.labels.recent;
      for (const r of rs) {
        const li = d.createElement("li");
        // #1112, #1158: every chip is an ordinary link to its target (`tgt`): it works without JavaScript; with it, the
        // click is taken here by its key (`data-at`). A position never stands in a URL: its link is the page itself.
        const a = d.createElement("a");
        a.className = "chip place-opt";
        a.setAttribute("href", tgt(r));
        a.setAttribute("data-at", r.at);
        a.setAttribute("data-kind", kindOf(r));
        const span = d.createElement("span");
        span.className = "place-opt__name";
        span.setAttribute("translate", "no");
        span.textContent = r.label;
        a.appendChild(span);
        li.appendChild(a);
        const x = d.createElement("button");
        x.className = "chip__x";
        x.setAttribute("type", "button");
        x.setAttribute("value", r.at);
        x.setAttribute("aria-label", cfg.labels.drop.replace("{place}", () => r.label));
        x.textContent = "×";
        li.appendChild(x);
        list.appendChild(li);
      }
      if (typeof list.querySelectorAll === "function")
        for (const c of Array.from<any>(list.querySelectorAll(".place-opt"))) {
          const on = shown !== null && (keyOfLink(c) === shown || String(c.textContent ?? "").trim() === pillRaw);
          c.setAttribute("aria-current", on ? "true" : "false");
        }
    }
  };
  if (bar !== null) {
    click(pill, (e: any) => {
      e.preventDefault();
      // The person is here now: what they choose in the bar is their request.
      quiet = false;
      // #1088: on "Ganz Deutschland" the place radio goes back to its place; else it takes the person to the bar's search.
      if (shown === null && back !== null && !AR) {
        const b = back;
        supersede();
        // #1113: written on the click — the place it goes back to; an IP guess is no choice, so nothing is kept for it.
        if (b.how === "ip") store.del(KEY);
        else remember(b.at, b.label, b.how);
        if (H) {
          put(b.at, b.label, "saved");
          showKept(savedOf() !== null);
          chips();
          return;
        }
        void load(b.at, b.how === "ip" ? "ip" : "saved").then((ok) => {
          if (!ok) return;
          showKept(savedOf() !== null);
          addr(shown ?? b.at);
          chips();
        });
        return;
      }
      // #1112: no dialog — the place radio takes the person to the bar's search. #1190: told first, so a road page's
      // folded bar shows the field before it is focused.
      fire("vf:search");
      input?.focus();
    });
    const pick = (e: any): void => {
      // #1112: a chip's × drops it from the recent places — one write, on the click
      const x = e.target?.closest?.("button.chip__x");
      if (x != null) {
        e.preventDefault();
        const v = x.getAttribute("value");
        const rest = (store.get(RECENT) ?? []).filter((r: any) => r !== null && r.at !== v);
        if (rest.length === 0) store.del(RECENT);
        else store.set(RECENT, rest);
        chips();
        input?.focus();
        return;
      }
      const a = e.target?.closest?.("a.place-opt");
      if (a === null || a === undefined) return;
      const at = keyOfLink(a);
      if (at === null) return;
      e.preventDefault();
      const name = String((a.querySelector(".place-opt__name") ?? a).textContent ?? "");
      const href = hrefOf(a);
      const k = metaOf(a, at);
      // #1158: a chip (recent or popular) goes where its link goes — a station's or a town's page from anywhere, any
      // target from a page that shows no cards of its own (a station, the News, a place page): remembered first, so a
      // position reaches the home through the stored place and never through the address. On the home a target there
      // changes the cards in place; a motorway page keeps every chip on its road.
      let here = "";
      try {
        here = `${pathNow()}${String(w.location?.search ?? "")}`;
      } catch {
        here = "";
      }
      if (!AR && list !== null && typeof list.contains === "function" && list.contains(a) && href.startsWith("/") && href !== here && (H || onPage || ofHref(href) !== null)) {
        supersede();
        remember(at, name, "manual", null, k);
        go(href);
        return;
      }
      // #1158: a suggestion picked closes the list — it lies over the recent places under the field
      const res = $("place-hresults");
      if (res !== null && typeof res.contains === "function" && res.contains(a)) {
        res.innerHTML = "";
        const st = $("place-hstatus");
        if (st !== null) st.textContent = "";
      }
      // a suggestion's or this page's chip: the key alone decides (pageOf) where a place page goes
      choose(at, name, a.getAttribute("data-at") == null ? href || null : null, k);
    };
    click(bar, pick);
    // #1112: Space activates a chip as Enter does (a chip is a link).
    bar.addEventListener("keydown", (e: any) => {
      const a = e.key === " " ? e.target?.closest?.("a.place-opt") : null;
      if (a == null) return;
      e.preventDefault();
      a.click();
    });
    // "use my location": the bar's button (shown once this script runs) and the IP guess's confirm row (⌖).
    toggle($("place-geo"), true);
    for (const id of ["place-geo", "place-cgeo"])
      click($(id), () => {
        // The only path to the browser's own question (v2.0.10): a click in this window.
        quiet = false;
        locate(() => undefined, true);
      });
    // #1113, #1138: "Ganz Deutschland" is the headline's radio alone — the bar's chip beside it was removed as confusable.
    click($("place-scope-de"), (e: any) => {
      e.preventDefault();
      germany();
    });
    const germany = (): void => {
      supersede();
      reveal();
      if (shown !== null) {
        // the kind it is kept as: an IP guess is none; a kept entry's own; else how it was found
        const k = source === "saved" ? savedOf()?.how : source;
        back = { at: shown, how: k === "manual" || k === "browser" ? k : "ip", label: pillRaw !== "" ? pillRaw : (back?.label ?? "") };
      }
      // Remembered like a chosen place (owner 2026-10-12), with the place it goes back to; the recent places stay.
      remember(null, "", "germany", back);
      showKept(true);
      slot.innerHTML = "";
      // #890: no position, no radius — the motorway page's own main block again.
      if (aroundMain && plainMain !== null) {
        swapMain(plainMain);
        aroundMain = false;
      }
      shown = null;
      source = "none";
      showR(false);
      setPill(null, "none");
      say(cfg.labels.germany);
      // #895: no position any more — the motorway page's Ampel goes back to the whole road's (lib/motorway-ampel.ts).
      fire("vf:cleared");
      addr(null);
      chips();
    };
    click($("place-forget"), forget);
    // The suggestions, POSTed (what is typed never enters a URL): the bar's input. #1112: their count goes to their own
    // status line (`place-hstatus`); the list is no live region, so `place-live` and it never speak each other's text.
    const hstatus = $("place-hstatus");
    const suggest = (inp: any, out: any): void => {
      let timer: any = null;
      let asked = "";
      inp?.addEventListener("input", () => {
        if (timer !== null) w.clearTimeout(timer);
        // #1158: a field emptied (or under two letters) closes its suggestions — they open over the recent list below it
        if (String(inp.value ?? "").trim().length < 2 && out !== null) {
          asked = "";
          out.innerHTML = "";
          if (hstatus !== null) hstatus.textContent = "";
          return;
        }
        timer = w.setTimeout(() => {
          const q = String(inp.value ?? "").trim();
          if (q.length < 2 || q.length > 80 || q === asked || out === null) return;
          asked = q;
          void w
            .fetch("/fragment/suggest", { method: "POST", headers: { accept: "text/html", "content-type": "application/json" }, body: JSON.stringify({ q, lang: cfg.lang }), credentials: "omit" })
            .then((res: any) => (res.status === 200 ? res.text() : ""))
            .then((html: string) => {
              if (q !== asked) return;
              const ok = /^<div class="place-suggest[ "]/.test(html);
              out.innerHTML = ok ? html : "";
              const n = typeof out.querySelectorAll === "function" ? out.querySelectorAll("a.place-opt").length : 0;
              if (hstatus !== null) hstatus.textContent = ok ? cfg.labels.found.replace("{n}", () => String(n)) : "";
              fire("vf:suggested", { n });
            })
            .catch(() => undefined);
        }, 200);
      });
    };
    suggest(input, $("place-hresults"));
    // #1186: and when an entry stored before the types was upgraded (`lib/recent-kinds.ts`)
    for (const e of ["vf:place", "vf:recent"]) d.addEventListener(e, () => chips());
    chips();
  }

  void start();
}
/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */

/** The script text the page carries: the island and its configuration, nothing else. */
export function islandScript(cfg: IslandConfig): string {
  // `<` is escaped so no label can close the element it is printed into.
  const json = JSON.stringify({ ...cfg, cell: CELL_DEG }).replaceAll("<", "\\u003c");
  // #1064: the island as the build minified it (`src/generated/inline-scripts.json`, `scripts/inline-min.ts`)
  // #1224: with the one ask-again of a part that did not answer, and its waits (`lib/fragment-retry.ts`)
  return `(${INLINE_SCRIPTS.island})(window, ${json}, ${INLINE_SCRIPTS.retry}, ${JSON.stringify(RETRY_WAITS_MS)});`;
}

