/**
 * A stand-in digest for the browser suites: answers `/internal/tiles/<id>`
 * with fragments in the digest's own shape (`packages/digest/src/presentation/
 * tiles.ts`), and can be told to fail or hang per tile — which is how the
 * isolation of #378 is proved against the REAL built shell without a
 * database. Loopback only.
 */
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { POPULAR_PLACES, popularSlug } from "../src/site/places.js";

export type StubBehaviour = Readonly<Record<string, "ok" | "stale" | "empty" | "error" | 500 | "hang" | "slow" | "html-but-not-tile">>;

/** What the stub says it credits (#1190): a source the business page passes, so its layout tests see tiles. `business-992.test.ts` judges the real digest's. */
const STUB_CREDITS = "dwd";
const CREDIT = '<footer class="tile__foot"><p class="credit" lang="de"><a href="https://verkehr.autobahn.de" rel="license noreferrer">Verkehrsdaten: Autobahn GmbH des Bundes</a></p></footer>';

export function fragment(id: string, state: "ok" | "stale" | "empty" | "error", lang: string): string {
  const word = { ok: lang === "de" ? "aktuell" : "current", stale: "nicht mehr frisch", empty: "keine Daten", error: "gerade nicht lesbar" }[state];
  const figure = state === "ok" || state === "stale" ? "<p class=\"tile__figure\"><span class=\"tile__num num\">4.712</span><span class=\"tile__unit\">x</span></p>" : "";
  return (
    `<section class="tile is-${state}" id="tile-${id}" aria-labelledby="tile-${id}-title">` +
    `<header class="tile__head"><h3 class="tile__title" id="tile-${id}-title">Stub ${id}</h3>` +
    `<p class="age"><span class="age__dot" aria-hidden="true"></span><span class="age__state">${word}</span></p></header>${figure}${CREDIT}</section>`
  );
}

/** The `?view=fact` one-liner of the "Heute" strip, in the digest's shape. */
export function factFragment(id: string, lang: string): string {
  const word = lang === "de" ? "aktuell" : "current";
  return `<section class="tile tile--fact is-ok" id="fact-${id}"><p class="fact__line"><span class="tile__num num">7</span> <span class="fact__text">stub ${id}</span></p><p class="age"><span class="age__dot" aria-hidden="true"></span><span class="age__state">${word}</span></p>${CREDIT}</section>`;
}

/**
 * Every place card in the digest's own article shape (#798): `#pcard-<id>` inside `.place__cards`, in the order
 * `arrange` gives them — the warning in force first, then the everyday order. For the Mein Tag suite, which
 * orders and folds exactly these.
 */
export const STUB_CARD_IDS = ["warnings", "stations", "fuel", "parking", "roads", "motorways", "lorry", "charging", "groceries", "health", "money", "food", "lodging", "garage", "police", "toilets", "lifts"] as const;
/**
 * `deferred` (#1065, the digest's `fuelRows=0`): the fuel card is its frame, the "needs JavaScript" line and the empty
 * box the page's script fills from `/fragment/place-fuel`; `slug` adds the cards' page link the script reads the place from.
 */
/**
 * 2.4.8 (#1085): the place Ampel in the digest's shape (`place-ampel-html.ts`) — a reason from the roads card's row and
 * one from the warnings card, each tagged with its card, and a map whose marks name theirs. Opt-in (`ampel`), so no
 * other stubbed page — and no visual baseline — changes.
 */
export const STUB_AMPEL =
  `<div role="region" class="pcard pcard--info ampel ampel--yellow place-ampel" id="place-ampel" aria-labelledby="pampel-h"><header class="pcard__head"><h3 class="pcard__title ampel__title" id="pampel-h">Ampel für <span translate="no">Stub</span></h3></header>` +
  `<div class="ampel__body"><div class="ampel__text"><p class="ampel__line" id="pampel-line"><strong class="ampel__word">Gelb</strong> — Stub</p><ol class="ampel__why" id="pampel-why" aria-label="Gründe">` +
  `<li class="ampel__reason ampel__reason--yellow ampel__reason--in-roads"><a href="#m-00000001"><strong>Baustelle</strong></a></li>` +
  `<li class="ampel__reason ampel__reason--yellow ampel__reason--in-warnings"><a href="#pcard-warnings"><strong>Warnung</strong></a></li></ol></div></div>` +
  // 2.4.8 (#1085 AC 2): each mark a named link to its row with the 24 px target (`map-mark-links.ts`), the SVG a group
  `<figure class="pam"><svg class="pam__svg" viewBox="0 0 100 100" role="group" aria-labelledby="pampel-h"><g class="pam-marks">` +
  `<a class="map-link pam-mark--in-roads" href="#m-00000001"><title>Baustelle · <tspan translate="no">B83</tspan></title><circle class="pam-mark pam-mark--road pam-mark--yellow" cx="30" cy="30" r="0.5"/><path class="map-hit" d="M30 30h0"/></a>` +
  `<a class="map-link pam-mark--in-motorways" href="#pcard-motorways"><title>Stau · <tspan translate="no">A7</tspan></title><circle class="pam-mark pam-mark--road pam-mark--red" cx="60" cy="60" r="0.5"/><path class="map-hit" d="M60 60h0"/></a>` +
  `<a class="map-link pam-mark--in-parking" href="#parking-r0"><title>Parken · <tspan translate="no">P1</tspan></title><rect class="pam-mark pam-mark--parking pam-mark--green" x="79.5" y="29.5" width="1" height="1"/><path class="map-hit" d="M80 30h0"/></a>` +
  `<circle class="pam-centre" cx="50" cy="50" r="0.3"/></g></svg></figure></div>`;

export function fullPlaceFragment(label: string, fuel?: string, o: { readonly deferred?: boolean; readonly slug?: string; readonly refreshLinks?: boolean; readonly ampel?: boolean } = {}): string {
  // `refreshLinks` (#717 C-4 e2e): each card's ↻, in the digest's shape (`place-tiles.ts`): a real link to the place
  // page at the card — the place-derived href a click would hand Clarity
  const reload = (id: string): string =>
    o.refreshLinks === true ? `<a class="pcard__refresh" href="/de/place/${o.slug ?? "teststadt"}#pcard-${id}" rel="nofollow" aria-label="Stub refresh" title="Stub refresh"><span aria-hidden="true">↻</span></a>` : "";
  const card = (id: string): string =>
    `<article class="pcard pcard--${id === "warnings" ? "attention" : "info"}" id="pcard-${id}" aria-labelledby="pcard-${id}-t">` +
    `<header class="pcard__head"><h3 class="pcard__title" id="pcard-${id}-t">Stub ${id}</h3>${reload(id)}</header><p class="pcard__lead">Stub ${id} near ${label}</p>` +
    // #981: the fuel card says what the shell told the digest of the refresh (`fuel=`), as the real card's freshness line does
    (id === "fuel" && o.deferred === true
      ? '<div class="pcard__fuelslot"><p class="pcard__note pcard__fueljs">Zum Laden der Preise braucht diese Seite JavaScript.</p><p class="pcard__note pcard__fuelloading" hidden>…</p><p class="pcard__note pcard__fuelfailed" hidden>x</p><div class="pcard__fuelout" aria-live="polite"></div></div>'
      : id === "fuel" && fuel !== undefined
        ? `<p class="pcard__fresh pcard__fresh--${fuel}">${fuel}</p>`
        : "") +
    // the card's question line, where the shell splices the local answer (#745)
    `<p class="pcard__ask"><span class="pcard__asklabel">Ask:</span> <q class="pcard__q">Stub ${id} in ${label}?</q></p>` +
    `<footer class="pcard__src"><p class="credit" lang="de">Stub credit ${id}</p></footer></article>`;
  const link = o.slug === undefined ? "" : `<p class="place__share"><a class="place__page" href="/de/place/${o.slug}">Stub page</a></p>`;
  const rowOf: Readonly<Record<string, string>> = { roads: '<p id="m-00000001">Stub row</p>', parking: '<ul class="pcard__list"><li><strong id="parking-r0">Parkhaus</strong> P1</li></ul>' };
  const row = (id: string): string => (o.ampel === true && rowOf[id] !== undefined ? card(id).replace("</article>", `${rowOf[id]}</article>`) : card(id));
  return `<section class="place" id="place-cards" aria-labelledby="place-title"><h2 class="place__title" id="place-title">Stub ${label}</h2>${link}${o.ampel === true ? STUB_AMPEL : ""}<div class="place__cards">${STUB_CARD_IDS.map(row).join("")}</div></section>`;
}

/**
 * #1088: the headline's search, answered like the digest (`place-suggest-html.ts`): a district, a postcode, a street
 * whose house number is missing (the nearest is offered), a point of interest (owner 2026-10-28) and a Gemeinde — each
 * with its kind and a "Karte" link.
 */
export const PICK_LABELS: Readonly<Record<string, string>> = {
  "dst:2891122": "Kassel-Wehlheiden",
  "plz:34121": "34121 Kassel",
  // owner 2026-10-28: a point of interest picked as itself, headed by its name
  "poi:418230": "Allianz Arena, München",
  "pt:51.3115,9.4575": "Wilhelmshöher Allee 99, Kassel",
};
const MAP = (lat: string, lon: string): string => ` <span class="place-sug__map"><a href="https://www.openstreetmap.org/?mlat=${lat}&amp;mlon=${lon}#map=15/${lat}/${lon}" rel="noopener noreferrer nofollow">Karte</a></span>`;
export function stubSuggest(q: string): string {
  const lines: string[] = [];
  const f = q.toLowerCase();
  if (f.includes("wehl")) lines.push(`<li class="place-sug"><a class="place-opt" href="#dst:2891122"><span class="place-opt__name" translate="no">Wehlheiden, Kassel</span> <span class="place-opt__where">· Stadtteil</span></a>${MAP("51.31050", "9.45750")}</li>`);
  if (f.includes("34121")) lines.push(`<li class="place-sug"><a class="place-opt" href="#plz:34121"><span class="place-opt__name" translate="no">34121 Kassel</span> <span class="place-opt__where">· PLZ</span></a>${MAP("51.30600", "9.46000")}</li>`);
  if (f.includes("wilhelmsh")) lines.push(`<li class="place-sug"><a class="place-opt" href="#pt:51.3115,9.4575"><span class="place-opt__name" translate="no">Wilhelmshöher Allee 99</span> <span class="place-opt__where">· 34119 Kassel · Straße</span> <span class="place-opt__note">Hausnummer 100 nicht gefunden – nächste: 99</span></a>${MAP("51.31150", "9.45750")}</li>`);
  if (f.includes("allianz")) lines.push(`<li class="place-sug"><a class="place-opt" href="#poi:418230"><span class="place-opt__name" translate="no">Allianz Arena</span> <span class="place-opt__where">· München · Stadion</span></a>${MAP("48.21880", "11.62470")}</li>`);
  // #1137: a motorway the query names whole is listed first, a link to its page (the register's kind word, the digest's shape)
  if (/^a\s*4$/.test(f.trim())) lines.unshift('<li class="place-sug"><a class="place-opt" href="/de/autobahn/a4"><span class="place-opt__name" translate="no">A4</span> <span class="place-opt__where">· Autobahn</span></a></li>');
  if (f.includes("köln") || f.includes("koeln")) lines.push('<li class="place-sug"><a class="place-opt" href="/de/place/koeln"><span class="place-opt__name" translate="no">Köln</span> <span class="place-opt__where">· Nordrhein-Westfalen · Ort</span></a></li>');
  // #1158: a station with a page links it, its point and its kind beside the link (the digest's shape)
  // #1186: a second station, for the located visitor at it and the upgrade of an entry kept before the types
  if (f.includes("eschweiler")) lines.push(`<li class="place-sug"><a class="place-opt" href="/de/station/eschweiler-hbf" data-at="pt:50.81679,6.24661" data-kind="station"><span class="place-opt__name" translate="no">Eschweiler Hbf, Eschweiler</span> <span class="place-opt__where">· Bahnhof</span></a>${MAP("50.81679", "6.24661")}</li>`);
  if (f.includes("hbf")) lines.push(`<li class="place-sug"><a class="place-opt" href="/de/station/koeln-hbf" data-at="pt:50.94303,6.95873" data-kind="station"><span class="place-opt__name" translate="no">Köln Hbf, Köln</span> <span class="place-opt__where">· Bahnhof</span></a>${MAP("50.94303", "6.95873")}</li>`);
  return lines.length === 0 ? '<div class="place-suggest place-suggest--none"><p class="place-suggest__none">Nichts gefunden.</p></div>' : `<div class="place-suggest"><ul class="place-suggest__list" aria-label="Vorschläge">${lines.join("")}</ul></div>`;
}

/**
 * #1153: the site search's digest kinds (`/internal/search`, `site-search-html.ts`'s shape), for the header's one
 * search: a motorway's name ("A7", "A4") answers the motorway, "Köln Hbf" (or "Koeln Hbf") the station, "Köln" the
 * station as a prefix match; anything else answers no group.
 */
export function stubSiteSearch(q: string, lang: string): string {
  const f = q.toLowerCase().trim();
  const li = (href: string, name: string, where: string): string => `<li class="place-sug place-sug--x"><a class="place-opt" href="${href}"><span class="place-opt__name" translate="no">${name}</span> <span class="place-opt__where">· ${where}</span></a></li>`;
  const groups: string[] = [];
  const road = /^a\s*(\d{1,3})$/.exec(f)?.[1];
  if (road !== undefined) groups.push(`<section class="ss-group ss-group--motorway ss-best-3 ss-total-1"><ul class="place-suggest__list">${li(`/${lang}/autobahn/a${road}`, `A${road}`, road === "7" ? "Flensburg – Füssen" : "Autobahn")}</ul></section>`);
  if (/^k(ö|oe)ln hbf$/.test(f)) groups.push(`<section class="ss-group ss-group--station ss-best-3 ss-total-1"><ul class="place-suggest__list">${li(`/${lang}/station/koeln-hbf`, "Köln Hbf", "Köln")}</ul></section>`);
  if (/^k(ö|oe)ln$/.test(f)) groups.push(`<section class="ss-group ss-group--station ss-best-2 ss-total-1"><ul class="place-suggest__list">${li(`/${lang}/station/koeln-hbf`, "Köln Hbf", "Köln")}</ul></section>`);
  return `<div class="place-suggest site-results">${groups.join("")}</div>`;
}

/** #1171: an object the stand-in digest's `/internal/spot` finds at its point, and the page path under the language. */
export type StubSpot = { readonly lat: number; readonly lon: number; readonly path: string; readonly label: string };

export async function startStubDigest(behaviour: StubBehaviour = {}, hangMs = 5000, opts: { readonly fullCards?: boolean; readonly refreshLinks?: boolean; readonly ampel?: boolean; readonly around?: boolean; readonly spots?: readonly StubSpot[] } = {}): Promise<{ readonly url: string; readonly hits: string[]; readonly spotBodies: string[]; close: () => Promise<void> }> {
  const hits: string[] = [];
  const spotBodies: string[] = [];
  const timers: NodeJS.Timeout[] = [];
  const server: Server = createServer((req, res) => {
    // a parse base only, never fetched — a non-network scheme says so (Sonar S5332)
    const url = new URL(req.url ?? "/", "stub:/");
    hits.push(url.pathname + url.search);
    // #1171: "use my location" at an object — a POST whose position is in the body; the planted objects answer their
    // page in the asked language (the digest's shape: 200 with spot-href/spot-label, else 204)
    if (url.pathname === "/internal/spot" && req.method === "POST" && opts.spots !== undefined) {
      const spots = opts.spots;
      const parts: Buffer[] = [];
      req.on("data", (c: Buffer) => void parts.push(c));
      req.on("end", () => {
        const text = Buffer.concat(parts).toString("utf8");
        spotBodies.push(text);
        const b = JSON.parse(text) as { lat: number; lon: number; acc: number; lang: string };
        const hit = spots.find((s) => Math.abs(s.lat - b.lat) < 0.0005 && Math.abs(s.lon - b.lon) < 0.0005);
        if (hit === undefined) return void res.writeHead(204).end();
        const href = `/${b.lang}/${hit.path}`;
        res.writeHead(200, { "content-type": "text/html; charset=utf-8", "spot-href": href, "spot-label": encodeURIComponent(hit.label) }).end(`<a class="vf-spot" href="${href}">${hit.label}</a>`);
      });
      return;
    }
    // #564: a place page the home links (the popular places) must resolve; the stub answers each with its own name
    // #892: a place page's slug is resolved to its key first; the stub's `place_slugs` is the popular places
    // #1111 AC 7 (2.5.8): `search: "hang"` / `suggest: "hang"` hold the site search's or the place list's answer for
    // `hangMs` — the latency gate's case 4 (a digest that does not answer within the header's or the page's deadline)
    if (url.pathname === "/internal/search") {
      const body = stubSiteSearch(url.searchParams.get("q") ?? "", url.searchParams.get("lang") ?? "de");
      if (behaviour["search"] === "hang") timers.push(setTimeout(() => res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(body), hangMs));
      else res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(body);
      return;
    }
    if (url.pathname === "/internal/place/suggest") {
      const body = stubSuggest(url.searchParams.get("q") ?? "");
      if (behaviour["suggest"] === "hang") timers.push(setTimeout(() => res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(body), hangMs));
      else res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(body);
      return;
    }
    // #1088: a picked district or postcode names the point it stands for
    const pick = url.searchParams.get("pick");
    if (url.pathname === "/internal/place/key" && pick !== null) {
      if (PICK_LABELS[pick] === undefined) res.writeHead(404, { "content-type": "text/html; charset=utf-8" }).end("<p>no</p>");
      else res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end('<p class="place-key">pt:51.3105,9.4575</p>');
      return;
    }
    if (url.pathname === "/internal/place/key") {
      const hit = POPULAR_PLACES.find((p) => popularSlug(p) === url.searchParams.get("slug"));
      if (hit === undefined) res.writeHead(404, { "content-type": "text/html; charset=utf-8" }).end("<p>no</p>");
      else res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(`<p class="place-key">ags:${hit.ags}</p>`);
      return;
    }
    const slugAt = /^slug:([a-z0-9-]+)$/.exec(url.searchParams.get("at") ?? "")?.[1];
    const byslug = slugAt === undefined ? undefined : POPULAR_PLACES.find((p) => popularSlug(p) === slugAt);
    const at = byslug !== undefined ? `ags:${byslug.ags}` : (url.searchParams.get("at") ?? "");
    const popular = POPULAR_PLACES.find((p) => `ags:${p.ags}` === at);
    if (url.pathname === "/internal/place/cards" && opts.fullCards === true && at !== "") {
      const label = PICK_LABELS[at] ?? popular?.name ?? "Teststadt";
      res
        .writeHead(200, { "content-type": "text/html; charset=utf-8", "place-key": at, "place-label": encodeURIComponent(label), "place-point": popular === undefined ? "1" : "0", ...(popular === undefined ? {} : { "place-slug": popularSlug(popular) }) })
        .end(fullPlaceFragment(label, /^[a-z]{1,12}$/.exec(url.searchParams.get("fuel") ?? "none")?.[0] ?? "none", { deferred: url.searchParams.get("fuelRows") === "0", refreshLinks: opts.refreshLinks === true, ampel: opts.ampel === true, ...(popular === undefined ? {} : { slug: popularSlug(popular) }) }));
      return;
    }
    // #1153: a motorway page's "around you" block for a place chosen in the header (`around`), the digest's shape
    const aroundRoad = /^\/internal\/motorway\/([A-Za-z0-9]+)\/around$/.exec(url.pathname)?.[1];
    if (aroundRoad !== undefined && opts.around === true && at !== "") {
      const label = PICK_LABELS[at] ?? popular?.name ?? "Teststadt";
      res
        .writeHead(200, { "content-type": "text/html; charset=utf-8", "place-key": at, "place-label": encodeURIComponent(label) })
        .end(`<section class="mwa" id="motorway-around" aria-labelledby="mwa-t"><h2 id="mwa-t">Stub: ${aroundRoad.toUpperCase()} bei ${label}</h2></section>`);
      return;
    }
    // #1065: the fuel card's own fragment — the sentence for a refusal, else the note the shell passed (or `none`)
    if (url.pathname === "/internal/place/fuel" && opts.fullCards === true && at !== "") {
      const note = /^[a-z]{1,12}$/.exec(url.searchParams.get("fuel") ?? "none")?.[0] ?? "none";
      const body = url.searchParams.get("refused") === "1" ? '<div class="place-fuel"><p class="pcard__note">refused</p></div>' : `<div class="place-fuel"><p class="pcard__fresh pcard__fresh--${note}">${note}</p></div>`;
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" }).end(body);
      return;
    }
    if (url.pathname === "/internal/place/cards" && popular !== undefined) {
      res
        .writeHead(200, { "content-type": "text/html; charset=utf-8", "place-key": at, "place-label": encodeURIComponent(popular.name), "place-point": "0", "place-slug": popularSlug(popular) })
        .end(`<section class="place" id="place-cards"><p>Stub ${popular.ags}</p></section>`);
      return;
    }
    // #715: the motorway index and the motorways the link strip names, in the digest's shape (an ETag, revalidated with a 304)
    const mw = /^\/internal\/motorway\/(index|A[1-9])$/.exec(url.pathname);
    if (mw) {
      const lang = url.searchParams.get("lang") ?? "de";
      const seg = "autobahn"; // #892: in every language
      const body =
        mw[1] === "index"
          ? `<section class="motorways" id="motorway-index" aria-label="Stub"><ul class="motorway-index">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<li><a href="/${lang}/${seg}/a${String(n)}"><span class="shield">A${String(n)}</span></a></li>`).join("")}</ul></section>`
          : `<section class="motorway" id="motorway" aria-labelledby="motorway-now-t"><h2 class="motorway__h2" id="motorway-now-t">Stub ${mw[1] ?? ""}</h2><p class="motorway__quiet">Stub</p></section>`;
      const etag = `"mw-stub-${mw[1] ?? ""}-${lang}"`;
      if (req.headers["if-none-match"] === etag) res.writeHead(304, { etag }).end();
      else res.writeHead(200, { "content-type": "text/html; charset=utf-8", etag }).end(body);
      return;
    }
    // #1041: the station catalogue, one station's page and the sitemap list, in the digest's shape (an ETag, a 304)
    const st = /^\/internal\/station\/([a-z0-9-]+)$/.exec(url.pathname);
    if (st) {
      const lang = url.searchParams.get("lang") ?? "de";
      if (st[1] === "list") {
        res.writeHead(200, { "content-type": "text/plain; charset=utf-8", "station-pages": "1" }).end("koeln-hbf\t2026-10-20\n");
        return;
      }
      // #1186: a second station page, Eschweiler Hbf (it is in no list, so no sitemap or catalogue changes)
      const name = st[1] === "koeln-hbf" ? "Köln Hbf" : st[1] === "eschweiler-hbf" ? "Eschweiler Hbf" : null;
      if (st[1] !== "index" && name === null) {
        res.writeHead(404, { "content-type": "text/html; charset=utf-8" }).end("<p>no such station</p>");
        return;
      }
      const body =
        st[1] === "index"
          ? `<section class="stpage-index" id="station-index"><p class="lead">Stub</p><ul class="stpage-list"><li><a href="/${lang}/station/koeln-hbf">Köln Hbf</a></li></ul></section>`
          : `<section class="stpage" id="station"><header class="stpage__head"><p class="stpage__name" translate="no">${name ?? ""}</p></header><section class="pcard stpage__card" id="station-platforms" aria-labelledby="station-platforms-h"><h2 class="pcard__title" id="station-platforms-h">Stub</h2><p>Stub</p></section></section>`;
      const etag = `"st-stub-${st[1] ?? ""}-${lang}"`;
      if (req.headers["if-none-match"] === etag) res.writeHead(304, { etag }).end();
      else res.writeHead(200, { "content-type": "text/html; charset=utf-8", etag, ...(st[1] === "index" ? {} : { "station-slug": st[1] }) }).end(body);
      return;
    }
    // #1187: one page each of a fuel station, a charging site, a federal road and a Land, in the digest's shapes (the
    // head attributes are optional: the shell's own fallbacks title them) — so a browser suite can visit every page type
    // #1185: the index of the sixteen Länder, in the digest's shape — `/<lang>/states` is a page of the map like any other
    if (url.pathname === "/internal/state/index") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end('<section class="stateindex" id="stateindex"><p>Stub</p></section>');
      return;
    }
    const page = /^\/internal\/(fuel|charging|road|state)\/([a-z0-9-]+)$/.exec(url.pathname);
    if (page && page[2] !== "list" && page[2] !== "index") {
      const [, kind = "", slug = ""] = page;
      const body =
        kind === "fuel" || kind === "charging"
          ? `<section class="energypage energypage--${kind}" id="energypage" data-kind="${kind}" data-slug="${slug}" data-name="Stub"><p>Stub</p></section>`
          : `<section class="${kind}page" id="${kind}page"${kind === "state" ? ` data-land="${slug}" data-land-name="Stub"` : ""}><p>Stub</p></section>`;
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(body);
      return;
    }
    const m = /^\/internal\/tiles\/([a-z]+)$/.exec(url.pathname);
    if (!m) {
      res.writeHead(404, { "content-type": "text/html; charset=utf-8" }).end("<p>no</p>");
      return;
    }
    const id = m[1] ?? "";
    const lang = url.searchParams.get("lang") ?? "de";
    // the bus and tram board is NOT live by default (#399): the digest answers it empty
    const b = behaviour[id] ?? (id === "transit" ? "empty" : "ok");
    if (url.searchParams.get("view") === "fact") {
      const f = behaviour[`fact-${id}`] ?? "ok";
      if (f === 500) res.writeHead(500, { "content-type": "text/html; charset=utf-8" }).end("<p>x</p>");
      else res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "tile-credits": STUB_CREDITS }).end(factFragment(id, lang));
      return;
    }
    // #564: "slow" answers after a second — past the first render's 500 ms panel deadline, inside the 2 s fill.
    if (b === "slow") {
      timers.push(setTimeout(() => res.writeHead(200, { "content-type": "text/html; charset=utf-8", "tile-cadence-seconds": "60" }).end(fragment(id, "ok", lang)), 1_000));
      return;
    }
    if (b === "hang") {
      timers.push(setTimeout(() => res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(fragment(id, "ok", lang)), hangMs));
      return;
    }
    if (b === 500) {
      res.writeHead(500, { "content-type": "text/html; charset=utf-8" }).end("<p>tile unavailable</p>");
      return;
    }
    if (b === "html-but-not-tile") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end("<div>not a tile</div>");
      return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "tile-cadence-seconds": "60", "tile-credits": STUB_CREDITS }).end(fragment(id, b, lang));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    url,
    hits,
    spotBodies,
    close: () =>
      new Promise<void>((r) => {
        for (const t of timers) clearTimeout(t);
        server.closeAllConnections?.();
        server.close(() => r());
      }),
  };
}
