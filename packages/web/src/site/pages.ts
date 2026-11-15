/**
 * THE page map of viafrei.de (#376 PR-02, #375 A4) — the only place a page is
 * listed. `scripts/site-pages.txt` is its four-column projection
 * (`scripts/site-map.ts`), and every route check reads it from there.
 *
 * A page has one id, one path per live language, the issue that owns its
 * content, and a navigation position (null = not in the header; the legal
 * pages are in the footer, the 404 is reached by no link). Paths are typed as
 * literal strings so a typo is a compile error, and `pages.test.ts` asserts the
 * shape this comment promises — the nine ids, both paths per id, no two
 * paths equal, the nine home blocks in order.
 */

/**
 * The languages that are LIVE: listed, linked, in the sitemap (D6). The five
 * of #235 joined German and English in 1.6.0 on the owner's decision of
 * 2026-10-03 ("go with the autotranslation, we will fix if something wrong"):
 * Russian, Bulgarian, Ukrainian, Romanian, Turkish. A language added here must
 * also be registered in `src/i18n/locales.ts` and carry a complete catalogue
 * (`i18n-parity.test.ts`), or the build fails.
 */
export const LIVE_LANGS = ["de", "en", "ru", "bg", "uk", "ro", "tr", "fr", "es", "nl", "pl", "it", "lt", "cs", "hu", "sk", "da", "pt", "hr", "sr", "el", "lv"] as const;
export type Lang = (typeof LIVE_LANGS)[number];

/** German is the binding language of the legal pages and the site's default (A4). */
export const DEFAULT_LANG: Lang = "de";

export const PAGE_IDS = ["start", "connect", "developers", "business", "fuel", "news", "motorways", "stations", "states", "examples", "impressum", "datenschutz", "terms", "404"] as const;
export type PageId = (typeof PAGE_IDS)[number];

export type Page = {
  readonly id: PageId;
  /**
   * The path under a language prefix, the SAME English word in every language
   * (#892, owner 2026-10-21: the language prefix is the only language marker;
   * the motorway word is `autobahn` everywhere): `""` for the start page (`/de`, `/en`, …),
   * `/connect` for `/de/connect`, `/ru/connect`, …. A LEGAL page is German at
   * the site root (`/impressum`) and under the prefix in every other language
   * (`/en/impressum`, `/ru/impressum`): German is the binding text (A4).
   */
  readonly slug: "" | `/${string}`;
  readonly legal: boolean;
  /** The issue whose acceptance criteria own this page's content. */
  readonly issue: number;
  /** Header navigation position, 1-based; null when the page is not in the header. */
  readonly nav: number | null;
};

export const PAGES: readonly Page[] = [
  // `/` is the negotiated front door (`Vary: Accept-Language`) and lands on one
  // of these two (A4, D1: one front door — `/home` is a 301 to `/`).
  { id: "start", slug: "", legal: false, issue: 379, nav: 1 },
  { id: "connect", slug: "/connect", legal: false, issue: 142, nav: 2 },
  { id: "developers", slug: "/developers", legal: false, issue: 143, nav: 3 },
  { id: "business", slug: "/business", legal: false, issue: 144, nav: 4 },
  // The fuel station board, every Land (owner 2026-10-06, "Board to its own
  // page"): it was ~43 KB folded into every home page. The home's fuel tile is
  // the summary and links here; reached from there, not from the header.
  { id: "fuel", slug: "/fuel", legal: false, issue: 423, nav: null },
  // News (#588): what is new, and the long closures we hold. Reached from the
  // home's teaser, not from the header. (`/de/neuigkeiten` until #892: a
  // temporary 301, `legacy-redirects.ts`.)
  { id: "news", slug: "/news", legal: false, issue: 588, nav: null },
  // The motorway index (#715, 2.1.13): every German motorway, each linked to
  // its own page (`/<lang>/autobahn/a3` — dynamic pages,
  // `site/motorways.ts`, listed in `/sitemap-motorways-<lang>.xml`). `autobahn`
  // in every language (#892; `/<lang>/motorway` until then, a temporary 301).
  // Reached from the Autobahn card, the home and the footer, not from the header.
  { id: "motorways", slug: "/autobahn", legal: false, issue: 715, nav: null },
  // The station catalogue (#1041, 2.4.2): every DB station, each linked to its
  // own page (`/<lang>/station/koeln-hbf` — dynamic pages, `site/stations.ts`,
  // listed in `/sitemap-stations-<lang>.xml`). `station` in every language.
  // Reached from the place pages' stations card and the footer, not from the header.
  { id: "stations", slug: "/station", legal: false, issue: 1041, nav: null },
  // The sixteen Länder (#1074, 2.5.8): the index `/<lang>/states`, each Land linked to its own page
  // (`/<lang>/state/bayern` — dynamic pages, `site/states.ts`, listed in `/sitemap-states-<lang>.xml`): the motorways
  // now, the facts, the largest towns. Reached from the motorway pages and the footer, not from the header.
  { id: "states", slug: "/states", legal: false, issue: 1074, nav: null },
  // The examples page (#747): every example question of the home and the connect
  // page, with its tool and its answer, by domain — archived there when it leaves
  // them (`site/example-ledger.ts`). (`/de/beispiele` until #892, a temporary
  // 301.) Reached from the home's "Your day" and the connect page, not from the header.
  { id: "examples", slug: "/examples", legal: false, issue: 747, nav: null },
  // German is authoritative; the other languages show the German text under
  // one sentence in their own language saying so (A4).
  { id: "impressum", slug: "/impressum", legal: true, issue: 379, nav: null },
  { id: "datenschutz", slug: "/datenschutz", legal: true, issue: 379, nav: null },
  // #707: ViaFrei's terms of use — section 2 (#sid) is what the SID button and the MCP elicitation accept.
  { id: "terms", slug: "/terms", legal: true, issue: 707, nav: null },
  // The 404 is served for every unmatched path; these are the addresses at
  // which it can be opened on purpose (Phase 5 screenshots it there).
  { id: "404", slug: "/404", legal: false, issue: 379, nav: null },
];

/**
 * GA rule 6: the consent bar (and with it any measurement) only on the four
 * content pages; the legal pages, the 404 and the fuel page carry none. The
 * fuel page stays out on purpose (v1.8.18): it shows MTS-K prices, and a
 * measured visit there would have to be named on the Datenschutz page first.
 * `pages.test.ts` pins the list; `scripts/budget.ts` runs with a tag and fails
 * a fuel page that carries a script or the island.
 */
export const ANALYTICS_PAGES: readonly PageId[] = ["start", "connect", "developers", "business", "motorways"];

/**
 * G1 (steward ruling #716, owner 2026-10-14): the pages measured although they
 * are not a row of the map — each motorway page, by an EXPLICIT flag
 * (`Base.astro`'s `measure`), because a place page is dynamic too and must stay
 * unmeasured. The motorway index is the map row "motorways" above.
 */
export const MEASURED_DYNAMIC_PAGES: readonly PageId[] = ["motorways"];

/**
 * #717, the data-steward ruling's C-4 FALLBACK (lead, 2026-10-27): Microsoft
 * Clarity runs on the measured MAP ROWS only — the home, connect, developers,
 * business and the motorway index — and on NO dynamic page. A motorway page is
 * measured by GA (G1) but is not a Clarity page: its around map (the shields'
 * `aria-label`s, the `viewBox`, the position mark's path) and its radius block
 * (`id="mw-j-<lcd>"`, `id="mwc-<lcd>"`) carry position-derived values in
 * attributes the tag sends verbatim, and the IP rung puts that block in the
 * first HTML. The list is separate from GA's on purpose: narrowing Clarity
 * moves no GA page. `pages.test.ts` and `clarity-717.test.ts` pin it.
 */
export const CLARITY_DYNAMIC_PAGES: readonly PageId[] = [];

/**
 * What a page may measure, decided once for `Base.astro`: `ga` — the consent
 * island and Google Analytics (GA rule 6 and G1); `clarity` — Microsoft Clarity
 * on the same island (#717), a SUBSET of `ga`. `dynamic` is whether the page is
 * outside the map (a place, a station or a motorway page); `measure` is its
 * explicit G1 flag.
 */
export function measurementOf(page: PageId, dynamic: boolean, measure: boolean): { readonly ga: boolean; readonly clarity: boolean } {
  const ga = ANALYTICS_PAGES.includes(page) && (!dynamic || (measure && MEASURED_DYNAMIC_PAGES.includes(page)));
  const clarity = ga && (!dynamic || CLARITY_DYNAMIC_PAGES.includes(page));
  return { ga, clarity };
}

/** The redirects A4 names — a route that publishes no page of its own. */
export const REDIRECTS: readonly { readonly from: `/${string}`; readonly to: `/${string}`; readonly status: 301 }[] = [
  { from: "/home", to: "/", status: 301 },
  { from: "/connect", to: "/de/connect", status: 301 },
  // Addresses the pre-1.6 landing served (its page map was retired with it,
  // #405) that the new site has no page for: each keeps working as a
  // redirect (#382).
  { from: "/en/home", to: "/en", status: 301 },
  // Every language prefix with a trailing slash goes to its start page,
  // so `/ru/` is never the shell's 404 (#235).
  ...LIVE_LANGS.map((l) => ({ from: `/${l}/` as const, to: `/${l}` as const, status: 301 as const })),
];

/**
 * The blocks of the home, top to bottom (#375 "Information architecture",
 * amended by the owner on #379, 2026-10-03: the proof strip and the prompts
 * became ONE block, "Was ViaFrei weiß" — four domain cards, each carrying its
 * live tile, three real questions and an honest limit). Rendered in exactly
 * this order; a test pins it.
 */
export const HOME_BLOCKS = [
  "header", // brand, three anchors, one filled action, the language list
  "hero", // the h1 first (#990): one human sentence, two buttons, the trust chips (free · no account · no app), the Wegweiser
  "place", // "Für <Ort>" (#564): the place pill, the topic filter (#1050) and the place's cards — the LOCAL scope
  "now", // "Deutschland jetzt" (#990): every national live figure, a group per domain, the motorways most affected, the links
  "start", // "Loslegen" (#990) begins: "In einer Minute startklar", three steps (draft), the address, one <details> per client
  "day", // "Ihr Tag mit ViaFrei": nine daily moments — scene, the questions and their answers (the tiles are in "now")
  "news", // "Neu bei ViaFrei" (#588): the three newest entries of the News page, one line each
  "tools", // … beside it for developers: the tools by domain, folded on a phone
  "audience", // … under both: travellers, developers, business
  "sources", // the duplicate credit list of what is on the page, what we do not answer, privacy — and the footer
] as const;
export type HomeBlock = (typeof HOME_BLOCKS)[number];

/** The header anchors, in nav order — three, and the one filled action. */
export const HOME_ANCHORS: readonly HomeBlock[] = ["day", "start", "tools"];

export function pageById(id: PageId): Page {
  const p = PAGES.find((x) => x.id === id);
  if (!p) throw new Error(`pages.ts: no page with id '${id}'`);
  return p;
}

export function pathFor(id: PageId, lang: Lang): `/${string}` {
  const p = pageById(id);
  if (p.legal && lang === DEFAULT_LANG) return p.slug as `/${string}`;
  return `/${lang}${p.slug}`;
}

/** Every path the site serves as a page, every live language, in list order. */
export function allPaths(): readonly string[] {
  return PAGES.flatMap((p) => LIVE_LANGS.map((l) => pathFor(p.id, l)));
}

/** Which page and language a path is, or null when the path is not a page of the map. */
export function pageAt(path: string): { readonly id: PageId; readonly lang: Lang } | null {
  for (const p of PAGES) for (const l of LIVE_LANGS) if (pathFor(p.id, l) === path) return { id: p.id, lang: l };
  return null;
}

/**
 * The home's automatic reload, in seconds (D3). Owner 2026-10-03: 20 minutes
 * instead of 60 s, because a timed reload throws screen-reader and keyboard
 * users back to the top (axe meta-refresh, WCAG 2.2.1). Every tile shows its
 * own age between reloads. `e2e/a11y.e2e.ts` excepts meta-refresh on the home
 * ONLY at exactly this value, so a change here is a change to that exception.
 */
export const HOME_REFRESH_S = 1200;
/**
 * Where the home's automatic reload goes: the same page, MARKED (#564 review).
 * A reload is a navigation like a person's, and a marked render — and the
 * island on it, until the person touches the place bar — asks no provider for
 * anything (`lib/fuel-refresh.ts` `isAutoReload`): the fuel terms ask us to
 * avoid "regelmäßige, nicht explizit vom User initiierte Requests".
 */
export const HOME_REFRESH_URL = "?r=auto";
/** The meta refresh's `content`, exactly: the delay and the marked address. The a11y exception and the Lighthouse gate pin this value. */
export const HOME_REFRESH_CONTENT = `${String(HOME_REFRESH_S)};url=${HOME_REFRESH_URL}`;
