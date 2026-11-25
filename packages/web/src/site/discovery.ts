/**
 * The machine-readable front door of viafrei.de (#531): what crawlers, AI
 * search tools and MCP directories read before — or instead of — the pages.
 *
 *   /robots.txt                          every crawler allowed, the AI crawlers by name
 *   /llms.txt, /llms-full.txt            the llmstxt.org summary; the full one lists every tool
 *   /.well-known/mcp/server-card.json    the MCP Server Card (SEP-2127), the same document mcp.viafrei.de serves
 *   /.well-known/mcp.json                the same card again, at the path mcp.viafrei.de first served it (#734)
 *   /.well-known/mcp-registry-auth       the official MCP Registry's HTTP domain proof
 *   /.well-known/security.txt            RFC 9116: where to report a vulnerability (#734); mcp.viafrei.de redirects here
 *
 * Nothing here is typed twice: the pages come from the page map
 * (`pages.ts`) with their own English titles (`meta.ts`), the tools, their
 * one-line descriptions and the sources from the catalogue the server itself
 * listed at build time (`generated/catalogue.json`, which also carries the
 * server card the server builds for itself), the connection steps
 * from the copy deck the connect page prints, and the addresses from
 * `endpoints.ts`. Pure functions, so `test/discovery.test.ts` reads what each
 * route serves without a server.
 */
import catalogue from "../generated/catalogue.json" with { type: "json" };
import { datedCredit } from "./attribution-year.js";
import register from "../generated/register.json" with { type: "json" };
import { t } from "../i18n/index.js";
import { connectClients } from "./connect-clients.js";
import { entriesFor } from "../news/entries.js";
import { BRIDGE_REPO, CONNECT_PROMPTS, NPM_PACKAGE, SMITHERY_LISTING } from "./connect-prompts.js";
import { MCP_ENDPOINT, MCP_SSE_ENDPOINT, SITE_ORIGIN } from "./endpoints.js";
import { AI_CRAWLERS, CORPUS_CRAWLERS, PACED_CRAWLERS, SEO_CRAWLERS } from "./crawlers.js";
import { pageMeta } from "./meta.js";
import { LIVE_LANGS, PAGES, pathFor, type Lang, type PageId } from "./pages.js";
import { POPULAR_PLACES, placePath, popularSlug } from "./places.js";
import { SEARCH_DISALLOW } from "./search.js";
import { LINKED_MOTORWAYS, MOTORWAY_REGISTER, motorwayPath } from "./motorways.js";
import { ALL_SITEMAPS, SITEMAP_INDEX, stationsSitemap, statesSitemap } from "./sitemaps.js";
import { stationPath } from "./stations.js";
import { statePath } from "./states.js";
import { roadPath } from "./roads.js";
import { GLAMA_CANONICAL } from "./structured-data.js";

export const WIKI = `${BRIDGE_REPO}/wiki`;
export const NPM_BRIDGE = "viafrei";

/** The crawler tokens live in `crawlers.ts` (#1065 C1): robots.txt and the person gate read the same list. */
export { AI_CRAWLERS, CORPUS_CRAWLERS, PACED_CRAWLERS, SEO_CRAWLERS } from "./crawlers.js";

/**
 * robots.txt. The owner preview (`:81`) is not this file's business: nginx
 * sends `X-Robots-Tag: noindex, nofollow` on every answer of that server,
 * which a crawler obeys without reading robots.txt.
 */

/**
 * The paths a corpus crawler is kept off: the fuel page in every live language.
 * Written as plain paths, one per language, because a `*` wildcard inside a
 * path is an extension not every crawler honours.
 *
 * #1065 (owner 2026-10-25: "we need these bots to inform about the places"):
 * the place pages' prefix (`/<lang>/place/`, review B2 of 2026-10-12) is no
 * longer here. A place page carried the Tankerkönig board as a card (#564);
 * since #1065 its fuel card is a frame with no price, no station row and no
 * MTS-K figure, and the prices are the deferred fragment `/fragment/place-fuel`,
 * under `FRAGMENT_DISALLOW` — the motorway page's pattern (#716, M14–M22).
 */
export const CORPUS_DISALLOW: readonly string[] = LIVE_LANGS.map((l) => pathFor("fuel", l));

/**
 * #716 (steward M16 a), #1065: the deferred fuel prices — the motorway layer's
 * `MOTORWAY_FUEL_PATH` (`lib/motorway-fuel.ts`) and the place card's
 * `PLACE_FUEL_PATH` (`lib/place-fuel.ts`), both under this prefix, held so by
 * `test/discovery.test.ts` — are `Disallow`ed in EVERY group, `*` included: a
 * crawler that finds a group of its own ignores `*`, so the line is written
 * into each. Since #1065 the line is the whole `/fragment/` prefix, so every
 * fragment a page's script fetches (the tiles' and the cards' fills, the
 * suggestions, "around you", and any later one) is covered without a second
 * edit. The pages themselves — motorway (M28) and place — stay open.
 */
export const FRAGMENT_DISALLOW = "/fragment/";

/** Seconds between two requests asked of an SEO crawler: 6 a minute, the nginx `seo` zone's rate. */
export const SEO_CRAWL_DELAY_S = 10;

/** Every token nginx's `seo` class names: the SEO tools and the paced crawlers. */
export const SEO_CLASS_TOKENS: readonly string[] = [...SEO_CRAWLERS, ...PACED_CRAWLERS];

/**
 * #1111: the search page (`/<lang>/search`, `site/search.ts`) — `noindex, follow` on the page itself, and kept off
 * every crawler here like the fragments, in EVERY group for the same reason: a page of results for whatever anyone
 * typed is no page to crawl.
 */
const SEARCH_LINES = SEARCH_DISALLOW.map((p) => `Disallow: ${p}\n`).join("");

export function robotsTxt(): string {
  const fuel = CORPUS_DISALLOW.map((p) => `Disallow: ${p}\n`).join("");
  const groups = ["*", ...AI_CRAWLERS].map((ua) => `User-agent: ${ua}\nAllow: /\nDisallow: ${FRAGMENT_DISALLOW}\n${SEARCH_LINES}${(CORPUS_CRAWLERS as readonly string[]).includes(ua) ? fuel : ""}`);
  // #1182 (data-steward ruling 2026-11-08, B3): an SEO tool's or a paced crawler's own group replaces `*`, and the board
  // was never meant for a backlink database — the fuel page is disallowed there as in the corpus groups.
  groups.push(...[...SEO_CRAWLERS, ...PACED_CRAWLERS].map((ua) => `User-agent: ${ua}\nAllow: /\nDisallow: ${FRAGMENT_DISALLOW}\n${SEARCH_LINES}${fuel}Crawl-delay: ${SEO_CRAWL_DELAY_S}\n`));
  return [`# ViaFrei — a summary for AI tools: ${SITE_ORIGIN}/llms.txt (the full one: ${SITE_ORIGIN}/llms-full.txt)\n`, ...groups, ALL_SITEMAPS.map((p) => `Sitemap: ${SITE_ORIGIN}${p}\n`).join("")].join("\n");
}

/** The pages of the map a reader may be sent to, in map order (the 404 is no destination). */
const linkedPages = (): readonly { readonly title: string; readonly url: string; readonly description: string | null }[] =>
  PAGES.filter((p) => p.id !== "404").map((p) => {
    const m = pageMeta(p.id, "en");
    // A legal page has no lead of its own (`meta.ts` gives it the home's description), so it is listed by name only.
    return { title: m.title, url: `${SITE_ORIGIN}${pathFor(p.id, "en")}`, description: p.legal ? null : m.description };
  });

/**
 * What a motorway page holds, for an assistant deciding whether to send a
 * reader there (#716, 2.1.17): the modules as they are since 2.1.16 — no
 * figure and no row (steward M27), and the fuel prices named as what they
 * are, loaded only in a reader's browser and never crawlable (M14, M16, MF3).
 */
export const MOTORWAY_PAGE_HOLDS =
  "a factual summary (route ends, schematic length, the Länder, junction and interchange counts, breaks in the course, the live counts with their time); " +
  "a schematic map of its course from the TMC Location Code List with jams, closures, roadworks, parking, chargers, weather warnings and traffic cameras as layers; " +
  "the junction strip in road order with what is reported at each and the motorways each interchange meets; filters by direction, stretch and layer, with shareable links; " +
  "a search box that finds a junction, a Land or any row the page shows, and links to it; " +
  "the panels in order of usefulness (live danger, then route and plan, then services, then reference), each with an icon and a sign of how fresh its data is; " +
  "a crossings card naming the motorways each Kreuz and Dreieck meets, each linked to that motorway's page at the crossing with the lamp it shows there; " +
  "the cities along the route, each at its nearest exit with its own state, linked to its town page, whose neighbouring towns and motorways link onwards in turn; " +
  "Land and Kreis borders on the zoomed map; " +
  "closures, jams and roadworks now, by direction; planned full closures for the next 7 days with signed detours; " +
  "parking: lorry parks, service areas, truck stops (Autohöfe) and car parks, with live free spaces where the operator publishes them; " +
  "charging sites with their live status, the longest stretch without a 150 kW fast charger and the power classes; " +
  "weather along the route (DWD warnings and road-weather forecasts); traffic cameras where a city publishes them; " +
  "the lorry driving ban outlook and the rules that hold on every German motorway; " +
  "and example questions for an AI assistant, answered from the page's own rows. " +
  `Fuel prices along a motorway load only in a reader's browser and are not crawlable (${FRAGMENT_DISALLOW} is disallowed in robots.txt). ` +
  "Every figure carries its source and its time.";

/**
 * #1095: what a station page holds, for an assistant deciding whether to send a reader there — the cards as they are
 * since 2.4.5 (the live board, the lifts, the platforms, the facilities, the place cards of its position), and the
 * fuel named as what it is on those cards: loaded only in a reader's browser, never crawlable.
 */
export const STATION_PAGE_HOLDS =
  "the next departures and arrivals live with their track (Gleis), each train's delay or cancellation, and filters by mode, track, destination and step-free access; " +
  "which lifts and escalators work now (DB FaSta), each with its time; " +
  "the platforms with their height and step-free access; the facilities DB states (lockers, Wi-Fi, travel centre, mobility service and its hours); " +
  "the stations, the town page and the motorway junctions nearby, each linked; " +
  "and the cards of the station's position — roads, weather warnings, parking and charging with a filter by operator, power, plug and free now. " +
  `Fuel prices on those cards load only in a reader's browser and are not crawlable (${FRAGMENT_DISALLOW} is disallowed in robots.txt). ` +
  "Every figure carries its source and its time.";

/**
 * #1077: the place pages' sitemap threshold — a Gemeinde of this many people or more is listed in the place sitemaps
 * (every Gemeinde has a page). The digest's `PLACE_PAGE_MIN_POPULATION` (`server/place-service.ts`), which the site may
 * not import; `test/discovery-1077.test.ts` holds the two equal.
 */
export const PLACE_SITEMAP_MIN_POPULATION = 10_000;

/** One public page family (#1077): an example address in a language, what it answers, and the tool that gives the same answer. */
export type PageFamily = {
  readonly name: string;
  /** The page-map ids this family stands for ([] for a family of dynamic pages). */
  readonly pages: readonly PageId[];
  readonly example: (lang: Lang) => string;
  readonly answers: string;
  /** The MCP tools that give the same answer, or [] when the page is about ViaFrei itself. */
  readonly tools: readonly string[];
  /**
   * A dynamic family's route file under `src/pages/[lang]/` (#1077 drift): `test/discovery-1077.test.ts` reads the
   * route tree, refuses a dynamic route no family names — so a page family added to the site is red until it has a
   * line here — and matches each example against its file's own pattern. Absent for a family of page-map pages,
   * which `pages` covers.
   */
  readonly route?: string;
};

/** A junction and a stretch of the A7 that exist on prod (read 2026-11-01), as examples of their families. */
const EXAMPLE_EXIT = "exit-138-nesselwang";
const EXAMPLE_STRETCH = "nesselwang-to-kempten";

/**
 * #1077: every public page family, in the order a reader meets them. Each page of the map (but the 404) is in exactly
 * one family (`test/discovery-1077.test.ts` derives that from `pages.ts`), and every dynamic family has its own line.
 */
export const PAGE_FAMILIES: readonly PageFamily[] = [
  { name: "Home", pages: ["start"], example: (l) => pathFor("start", l), answers: "the cards of one place the reader chooses or is near: warnings, roads, parking, charging, stations", tools: ["describe_location", "find_nearby"] },
  { name: "Town", pages: [], route: "place/[slug].astro", example: (l) => placePath(l, "koeln"), answers: "one Gemeinde: weather warnings, roads, the motorways nearby, parking, charging and stations", tools: ["describe_location", "check_road_status", "find_parking", "find_charging_station"] },
  { name: "Motorways", pages: ["motorways"], example: (l) => pathFor("motorways", l), answers: "every motorway of the register with its live counts, searchable by number, junction or Land", tools: ["check_autobahn_traffic"] },
  { name: "One motorway", pages: [], route: "autobahn/[road]/[...rest].astro", example: (l) => motorwayPath(l, "A7"), answers: "closures, jams and roadworks now, planned closures, parking, charging and weather along one motorway", tools: ["check_autobahn_traffic", "find_roadworks_ahead"] },
  { name: "A stretch of a motorway", pages: [], route: "autobahn/[road]/[...rest].astro", example: (l) => `${motorwayPath(l, "A7")}/${EXAMPLE_STRETCH}`, answers: "the same, between two junctions", tools: ["find_roadworks_ahead", "check_autobahn_traffic"] },
  { name: "A motorway junction", pages: [], route: "autobahn/[road]/[...rest].astro", example: (l) => `${motorwayPath(l, "A7")}/${EXAMPLE_EXIT}`, answers: "what is reported at one junction (Anschlussstelle, Kreuz, Dreieck) now, and what is near it", tools: ["check_autobahn_traffic", "find_nearby"] },
  { name: "Train stations", pages: ["stations"], example: (l) => pathFor("stations", l), answers: "every railway station in Germany by Land, searchable by name or town", tools: ["get_train_departures"] },
  { name: "One station", pages: [], route: "station/[slug].astro", example: (l) => stationPath(l, "koeln-hbf"), answers: "departures and arrivals live with their track and delay, lifts and escalators, platforms and facilities", tools: ["describe_station", "get_train_departures", "check_station_facilities"] },
  { name: "One Bundesstraße", pages: [], route: "road/[...rest].astro", example: (l) => roadPath(l, "b51"), answers: "closures and roadworks on one federal road now, announced and ended this week, each with its place, its times and its source", tools: ["check_road_status", "find_roadworks_ahead"] },
  { name: "One Landesstraße", pages: [], route: "road/[...rest].astro", example: (l) => roadPath(l, "nw/l249"), answers: "the same for one state road, under its Land (a state road's number is unique only within its Land)", tools: ["check_road_status", "find_roadworks_ahead"] },
  { name: "German states", pages: ["states"], example: (l) => pathFor("states", l), answers: "the sixteen Länder, each with its motorway closures, jams and roadworks now", tools: ["check_autobahn_traffic"] },
  { name: "One state", pages: [], route: "state/[slug].astro", example: (l) => statePath(l, "bayern"), answers: "one Land: its motorways now (counts, the longest jams, the motorways with reports, Autobahn GmbH reports only), its area, capital and neighbours, and its largest towns", tools: ["check_autobahn_traffic"] },
  { name: "Fuel", pages: ["fuel"], example: (l) => pathFor("fuel", l), answers: "fuel prices for a reader's place, as consumer information when the reader asks (not crawlable as data, see below)", tools: ["find_cheapest_fuel"] },
  { name: "Examples", pages: ["examples"], example: (l) => pathFor("examples", l), answers: "real answers of the tools, each with its time and source", tools: [] },
  { name: "News", pages: ["news"], example: (l) => pathFor("news", l), answers: "what is new and what is planned", tools: [] },
  { name: "Connect", pages: ["connect"], example: (l) => pathFor("connect", l), answers: "how to add ViaFrei to an assistant, and the sources", tools: [] },
  { name: "Developers", pages: ["developers"], example: (l) => pathFor("developers", l), answers: "the tools, prompts and resources, the protocol and the limits", tools: [] },
  { name: "Business", pages: ["business"], example: (l) => pathFor("business", l), answers: "ViaFrei for companies", tools: [] },
  { name: "Legal", pages: ["impressum", "datenschutz", "terms"], example: (l) => pathFor("terms", l), answers: "the Impressum, the privacy notice and the terms of use", tools: [] },
];

/** #1077: one line per family — the English and the German example; the full file adds what it answers and the tools. */
export function familyLines(full: boolean): string[] {
  return PAGE_FAMILIES.map((f) => {
    const urls = `${SITE_ORIGIN}${f.example("en")} — Deutsch: ${SITE_ORIGIN}${f.example("de")}`;
    if (!full) return `- ${f.name}: ${urls}`;
    const extra = f.pages.length > 1 ? ` (also ${f.pages.filter((id) => f.example("en") !== pathFor(id, "en")).map((id) => `${SITE_ORIGIN}${pathFor(id, "en")}`).join(", ")})` : "";
    const tools = f.tools.length === 0 ? "" : `; the same answer in an assistant: ${f.tools.map((x) => `\`${x}\``).join(", ")}`;
    return `- ${f.name}: ${urls}${extra} — ${f.answers}${tools}.`;
  });
}

/**
 * #1077: what a crawler cannot read here, and why — the same rules robots.txt and the fuel gates enforce, said once.
 * Nothing licensed is offered for training: every source keeps its own licence (the credit lines).
 */
export const notForCrawlersLines = (): string[] => [
  `- ${FRAGMENT_DISALLOW} is disallowed to every crawler: the parts a page's script loads after it (fuel prices among them) are read in a reader's browser only.`,
  `- Fuel prices (Tankerkönig, from the Markttransparenzstelle für Kraftstoffe) are consumer information shown when a person asks, never data to collect: the fuel page ${SITE_ORIGIN}${pathFor("fuel", "en")} is disallowed to every corpus and training crawler in every language; its HTML carries only a bounded selection for search engines under noarchive (up to three stations per state, each with the time of its price), and every other fuel price loads only in a reader's browser.`,
  `- Lorry-park occupancy from the Toll Collect SID is given only inside an assistant, after the user accepts section 2 of the terms of use (${SITE_ORIGIN}${pathFor("terms", "en")}); it is on no page.`,
  "- Nothing on these pages is offered for training: each figure keeps its source's licence, named in its credit line.",
];

/** One line per register motorway: its English and its German page. */
export const motorwayLines = (): string[] => MOTORWAY_REGISTER.map((r) => `- ${r}: ${SITE_ORIGIN}${motorwayPath("en", r)} — Deutsch: ${SITE_ORIGIN}${motorwayPath("de", r)}`);

/**
 * A catalogue line the generator cut at 200 characters (`firstSentence` in
 * scripts/generate-catalogue.ts, which the developer page renders as it is)
 * ends mid-word; here it ends at the last whole word with "…".
 */
export const wholeWords = (s: string): string => (/[.!?…)]$/.test(s) ? s : `${s.replace(/\s+\S*$/, "")}…`);

/**
 * One line per client of the connect page (#1020), in its order: its name, its
 * steps with "the address above" made the address itself, and its snippet on one
 * line — `connectClients("en")`, so an assistant added to the page is listed here
 * with no second edit. The generic client is the Endpoint line above it.
 */
export const assistantLines = (): string[] =>
  connectClients("en")
    .filter((c) => c.id !== "generic")
    .map((c) => {
      const steps = c.steps.replace(/the address above/gu, MCP_ENDPOINT).replace(/:$/u, "");
      const code = c.code === undefined ? "" : ` \`${c.code.startsWith("{") ? JSON.stringify(JSON.parse(c.code)) : c.code}\``;
      const after = c.after === undefined ? "" : ` ${c.after}`;
      return `- ${c.name}: ${steps}${code === "" ? "" : ":"}${code}${after}`;
    });

/** How many News entries the llms files list (#1020). */
export const NEWS_IN_LLMS = 8;

/** The newest shipped News entries in English: title, release and permalink (#1020). */
export const newsLines = (): string[] =>
  entriesFor("en")
    .filter((e) => e.kind === "new")
    .slice(0, NEWS_IN_LLMS)
    .map((e) => `- [${e.t.title}](${SITE_ORIGIN}${pathFor("news", "en")}#${e.id}) (${e.release ?? ""}, ${e.date}): ${e.t.body.split(/(?<=\.)\s/u)[0] ?? ""}`);

function llmsBody(full: boolean, now: Date = new Date()): string {
  const lines: string[] = [
    "# ViaFrei",
    "",
    // #935: the summary is the brand line — the tagline, then the pitch
    `> ${t("en", "meta.tagline")}. ${t("en", "meta.pitch")} ${t("en", "meta.description")} ViaFrei is an MCP server: no key, no account — your assistant connects to ${MCP_ENDPOINT}.`,
    "",
    `Deutsch: ${t("de", "connectPage.lead")} Adresse: ${MCP_ENDPOINT}`,
    "",
    `Status: ${t("en", "beta.short")}`,
    "",
    `Data: from official and open sources (${catalogue.credits.length} credit lines today). Every answer carries its source and its licence; the credit lines are listed in ${SITE_ORIGIN}${pathFor("connect", "en")}#sources and in ${SITE_ORIGIN}/llms-full.txt.`,
    "",
    "## Connect",
    "",
    `- Endpoint (Streamable HTTP): ${MCP_ENDPOINT} — ${t("en", "connectPage.genericSteps").replace(/the address above/gu, "this address")}`,
    `- Legacy HTTP+SSE: ${MCP_SSE_ENDPOINT} — ${t("en", "connectPage.legacyNote").replace(/:$/, "")}.`,
    // #1020: every assistant of the connect page, its steps and its snippet, from `connectClients` — the list the page prints, never a second copy.
    ...assistantLines(),
    "",
    // 2.1.13 (#715): what to ask, from the connect page's own questions, each with the tool that answers it.
    "## Ask",
    "",
    ...CONNECT_PROMPTS.map((q) => `- "${t("en", q.key)}" (\`${q.tool}\`) — Deutsch: "${t("de", q.key)}"`),
    `- "Which ${catalogue.tools.length} tools does ViaFrei have?" — every one is listed in ${SITE_ORIGIN}/llms-full.txt.`,
    "",
    "## Live pages",
    "",
    `Every page below is the same live data an assistant gets from the tools, rendered server-side, in ${String(LIVE_LANGS.length)} languages (${LIVE_LANGS.join(", ")}), each figure with its source and its time.`,
    "",
    `- Motorways: ${SITE_ORIGIN}${pathFor("motorways", "en")} lists all ${MOTORWAY_REGISTER.length} motorways of the register with their live counts, searchable by number, sorted by number or by the worst now, with an overview map of Germany. Also: ${LINKED_MOTORWAYS.slice(1, 5).map((r) => `${SITE_ORIGIN}${motorwayPath("en", r)}`).join(", ")}.`,
    `- One motorway: ${SITE_ORIGIN}${motorwayPath("en", "A7")} (German ${SITE_ORIGIN}${motorwayPath("de", "A7")}) — ${MOTORWAY_PAGE_HOLDS}`,
    `- Towns: ${SITE_ORIGIN}${placePath("en", popularSlug(POPULAR_PLACES[3]!))} (German ${SITE_ORIGIN}${placePath("de", popularSlug(POPULAR_PLACES[3]!))}) — warnings, roads, the motorways nearby, parking, charging and stations for one Gemeinde, and a fuel card whose prices load only in a reader's browser and are not crawlable (${FRAGMENT_DISALLOW} is disallowed in robots.txt); every Gemeinde has one, and every Gemeinde of ${String(PLACE_SITEMAP_MIN_POPULATION).replace(/\B(?=(\d{3})+(?!\d))/gu, " ")} people or more is in the place sitemaps.`,
    `- Train stations: ${SITE_ORIGIN}${pathFor("stations", "en")} lists every railway station in Germany by Land, searchable by name or town; one page per station, for example ${SITE_ORIGIN}${stationPath("en", "koeln-hbf")} (German ${SITE_ORIGIN}${stationPath("de", "koeln-hbf")}) — ${STATION_PAGE_HOLDS} Every station page of one language is listed in ${SITE_ORIGIN}${stationsSitemap("en")} (German ${SITE_ORIGIN}${stationsSitemap("de")}).`,
    `- German states: ${SITE_ORIGIN}${pathFor("states", "en")} lists the sixteen Länder with their motorway counts now; one page per Land, for example ${SITE_ORIGIN}${statePath("en", "bayern")} (German ${SITE_ORIGIN}${statePath("de", "bayern")}) — the closures, jams and roadworks on its motorways now as the Autobahn GmbH reports them, its area, capital and neighbours, and its largest towns, each linked. Every Land page of one language is listed in ${SITE_ORIGIN}${statesSitemap("en")} (German ${SITE_ORIGIN}${statesSitemap("de")}).`,
    `- Every live page is in ${SITE_ORIGIN}${SITEMAP_INDEX}.`,
    "",
    // #1077: every page family, an English and a German example each (the full file: what it answers, and the tool)
    "## Page families",
    "",
    ...familyLines(full),
    "",
    "## Not for crawlers",
    "",
    ...notForCrawlersLines(),
    "",
    // #1020: what is new, from the News page's own approved entries (English), newest first — never typed here.
    `## New on ViaFrei (the ${String(NEWS_IN_LLMS)} newest entries of ${SITE_ORIGIN}${pathFor("news", "en")})`,
    "",
    ...newsLines(),
    "",
    "## Pages",
    "",
    ...linkedPages().map((p) => `- [${p.title}](${p.url})${p.description !== null ? `: ${p.description}` : ""}`),
    `- [Deutsch](${SITE_ORIGIN}${pathFor("start", "de")}): ${pageMeta("start", "de").title}`,
    "",
    "## Code and listings",
    "",
    `- [Public repository (bridge, docs, issues)](${BRIDGE_REPO})`,
    `- [Wiki](${WIKI})`,
    `- [npm package \`${NPM_BRIDGE}\`](${NPM_PACKAGE})`,
    `- [Smithery](${SMITHERY_LISTING})`,
    `- [Glama](${GLAMA_CANONICAL})`,
    `- [MCP server card (SEP-2127)](${SITE_ORIGIN}/.well-known/mcp/server-card.json) — the same card as ${new URL("/.well-known/mcp.json", MCP_ENDPOINT).href}`,
    "",
  ];
  if (full) {
    lines.push(
      `## Tools (${catalogue.tools.length}, as the server lists them in release ${catalogue.release.version})`,
      "",
      ...catalogue.tools.map((x) => `- \`${x.name}\` — ${x.title}: ${x.description}`),
      "",
      // 2.1.17 (#716): every motorway page of the register, both addresses — the list the motorway sitemaps are made of (`MOTORWAY_REGISTER`), so the two cannot drift. URLs only (steward M27: no data here).
      `## Motorway pages (${MOTORWAY_REGISTER.length}, English and German; ${String(LIVE_LANGS.length - 2)} more languages each, linked from every page; the sitemaps list English and German)`,
      "",
      ...motorwayLines(),
      "",
      "## Prompts",
      "",
      ...catalogue.prompts.map((x) => `- \`${x.name}\`: ${wholeWords(x.description)}`),
      "",
      "## Resources",
      "",
      ...catalogue.resources.map((x) => `- \`${x.uri}\`: ${x.name}`),
      "",
      "## What ViaFrei does not answer",
      "",
      ...catalogue.notCovered.map((x) => `- ${x}`),
      "",
      "## Sources and licences (credit lines as the licences require them, in German)",
      "",
      // The connect page's source list, line for line: the credit, its licence text, the publisher's condition of use where there is one, and the MTS-K note under the fuel credit.
      ...catalogue.credits.map((c) => `- ${datedCredit(c.text, now)}${c.licence !== null ? ` — [${c.licence.name}](${c.licence.url})` : ""} (${c.url})${c.condition !== null ? ` ${c.condition}` : ""}`),
      ...(catalogue.credits.some((c) => c.id === "tankerkoenig") ? ["", register.mtskNote] : []),
      "",
    );
  } else {
    lines.push(`## Tools (${catalogue.tools.length})`, "", catalogue.tools.map((x) => `\`${x.name}\``).join(", "), "");
    // #1020: the prompts and resources by name, with their counts — the full file carries each one's line.
    lines.push(`## Prompts (${catalogue.prompts.length})`, "", catalogue.prompts.map((x) => `\`${x.name}\``).join(", "), "");
    lines.push(`## Resources (${catalogue.resources.length})`, "", catalogue.resources.map((x) => `\`${x.uri}\``).join(", "), "");
    lines.push("## Optional", "", `- [Full version: every tool with its one-line description, prompts, resources and sources](${SITE_ORIGIN}/llms-full.txt)`, "");
  }
  return lines.join("\n");
}

export const llmsTxt = (): string => llmsBody(false);
export const llmsFullTxt = (): string => llmsBody(true);

/**
 * `/.well-known/mcp/server-card.json`: the MCP Server Card (SEP-2127, #534),
 * the SAME document mcp.viafrei.de serves on `/.well-known/mcp.json` and
 * `/mcp/server-card`. It is not built here: `scripts/generate-catalogue.ts`
 * calls the server's own `serverCard()` (`packages/mcp/src/server/server-card.ts`)
 * at build time and writes its output into `generated/catalogue.json`, so the
 * name, the version (`SERVER_VERSION` of this tree, the release the catalogue
 * names), the remotes and `_meta` are the server's and typed nowhere in this
 * package — which reads no database and imports no workspace that holds one
 * (`scripts/check_web_boundary.sh`). `test/discovery.test.ts` pins this copy
 * deep-equal to the server's card.
 */
export const serverCard = (): typeof catalogue.serverCard => catalogue.serverCard;

/**
 * The official MCP Registry's HTTP domain authentication for viafrei.de
 * (#531): the registry fetches this file and checks a publish request's
 * signature against the ed25519 PUBLIC key in it. Public by design — the
 * private half is the owner's, on no host and in no repository.
 */
export const MCP_REGISTRY_AUTH = "v=MCPv1; k=ed25519; p=jUqCmjmgZc7SVATg6yb5ainOGw/LGb1XZOsgf88rl/w=";

/**
 * The server card's two `/.well-known/` paths (#734). Both hosts answer both,
 * with the one document above: mcp.viafrei.de's `SERVER_CARD_PATHS`
 * (`packages/mcp/src/server/server-card.ts`) holds the same two, and
 * `test/discovery.test.ts` fails when they part.
 */
export const CARD_WELL_KNOWN_PATHS = ["/.well-known/mcp/server-card.json", "/.well-known/mcp.json"] as const;

/** Where this file is served — the `Canonical` it names, and the address mcp.viafrei.de redirects to (#734). */
export const SECURITY_TXT_PATH = "/.well-known/security.txt";

/** RFC 9116 asks `Expires` to lie less than a year ahead; it is counted from the release day, so a build a year old stops vouching for its contact. */
export const SECURITY_TXT_DAYS = 364;

/**
 * `/.well-known/security.txt` (RFC 9116, #734): the one contact for a
 * security report about either host. `Contact` is the Impressum — the § 5 DDG
 * page that already carries the operator's address and e-mail from the host's
 * configuration — so no address is typed here and none can drift from it.
 * `Expires` is the release day (`catalogue.release.date`, kept across
 * rebuilds) plus `SECURITY_TXT_DAYS`, never the request's clock: the body is a
 * function of the build, so two fetches agree and a smoke can compare them.
 * No A2A agent card and no `ai-catalog`/`ard`/`ucp` file is served beside it
 * (#734): ViaFrei speaks MCP, not A2A, and a card for a protocol we do not
 * serve would send a client to an endpoint that cannot answer it.
 */
export function securityTxt(releaseDate: string = catalogue.release.date): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) throw new Error(`security.txt: release date ${releaseDate} is not YYYY-MM-DD`);
  const expires = new Date(Date.parse(`${releaseDate}T00:00:00Z`) + SECURITY_TXT_DAYS * 86_400_000).toISOString().replace(/\.000Z$/, "Z");
  return [
    `Contact: ${SITE_ORIGIN}${pathFor("impressum", "de")}`,
    `Expires: ${expires}`,
    "Preferred-Languages: de, en",
    `Canonical: ${SITE_ORIGIN}${SECURITY_TXT_PATH}`,
    "",
  ].join("\n");
}

/** The headers every discovery file is served with: plain, cacheable for an hour like robots.txt. */
export const TEXT_HEADERS = { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } as const;
export const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=3600" } as const;
/**
 * The server card's headers: JSON's, plus the card's CORS rule as
 * mcp.viafrei.de applies it (`app.ts`, SEP-2127) — `*`, because the card is
 * public read-only metadata a browser client may read from any page and no
 * credential is involved. A GET with no custom header needs no preflight, so
 * the one header is all a browser asks for.
 */
export const CARD_HEADERS = { ...JSON_HEADERS, "Access-Control-Allow-Origin": "*" } as const;
