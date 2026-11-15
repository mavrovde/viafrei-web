/**
 * #1205 (owner 2026-11-11: search engines and AI assistants first; a VERIFIED crawler gets the real page, never the
 * challenge, a cold-read refusal or a 503): the user-agent class this shell hands the digest is decided by the
 * crawler's ADDRESS, not by nginx's reading of its user agent alone.
 *
 * nginx's `search` class believes Google's and Bing's claims only from their published ranges, but takes every other
 * search engine's claim (Applebot, DuckDuckBot, YandexBot, SeznamBot) at its word, and puts the AI crawlers (GPTBot,
 * OAI-SearchBot, PerplexityBot, CCBot …) in the generic `crawler` class with every scraper that says "bot". So the
 * digest's search lane (its own pool and gate) could be filled by anyone claiming SeznamBot, and a verified AI crawler
 * queued behind the whole unverified crawl.
 *
 * #1290 (owner 2026-11-12: "AI assistants must have the same priority as Google and Bing bots"; the same day, all three
 * of Anthropic's agents): the `search` class is THE LANE OF THE SEARCH ENGINES AND AI ASSISTANTS, and nobody else's.
 * Who may be on it: a search engine (nginx's `search` class, or a claim of the families in `ENGINE_FAMILIES`) or an AI
 * assistant (`AI_ASSISTANTS` of `site/crawlers.ts`, the one list nginx reads too: the user-triggered fetchers, the AI
 * search indexers, Anthropic's ClaudeBot and, owner 2026-11-14 ("Add Amazon bot to the priority also"), Amazon's
 * Amazonbot and, owner decision 2026-11-14 (#1306), OpenAI's GPTBot). Every other crawler — the training and corpus
 * crawlers (CCBot, Bytespider, meta-externalagent …),
 * however verified — reads on the crawler lane.
 *
 * The rule (#1205 review): this shell returns `search` ONLY for one of those whose address was verified —
 *  - by the edge: Cloudflare sets `x-vf-verified-bot: 1` when `cf.client.bot` is true and strips the header from every
 *    other request, zone-wide; nginx forwards it as its own `$vf_verified` ("1" or empty). Only the exact value "1"
 *    counts. This is how the crawlers the origin cannot verify itself (Anthropic, Meta, Mistral …) are known.
 *    Cloudflare's list of verified bots also holds the SEO tools (Ahrefs, Semrush …): a request nginx classed `seo`
 *    keeps `seo` even when the edge vouches for it (#1205 review S2) — an SEO tool is verified only to be paced in its
 *    own bucket;
 *  - by nginx's own range check of a Google or Bing claim (`NGINX_RANGE_CHECKED`);
 *  - or by its own check of a claimed `CRAWLER_FAMILIES` member (`crawler-verify.ts`, verdicts held in memory, P9) —
 *    looked up only while the digest is saturated; otherwise only a verdict already held is read (#1205 review S1).
 * The two layers agree: nginx holds Google's and Bing's published ranges and OpenAI's and Perplexity's (the same lists
 * `CRAWLER_FAMILIES` reads, written by the crawler ranges generator), so an assistant of those operators from their
 * ranges is never refused by a rate rule there, marker or not (the edge configuration `$vf_range_net`). Anthropic and
 * Meta publish no ranges: their assistants are proved by the edge's marker alone, at both layers. Amazon's are proved at
 * nginx by the marker alone and here also by reverse DNS in `crawl.amazonbot.amazon` (`crawler-verify.ts`).
 * An unverified claim of a search engine or an AI assistant is a spoof and reads on the crawler lane. A request that
 * claims none of them costs no lookup (P7) and keeps nginx's class; one nginx gave NO class whose User-Agent still
 * declares an agent (`declaresAgent`: a listed crawler's claim nginx's map does not name — facebookexternalhit,
 * BingPreview — or an AI assistant) is `crawler`, never a person's: the person pool is for the requests nobody
 * declared to be an agent, and so is an edge-verified bot of no class.
 */
import { AGENT_CLASS_HEADER, agentClassOf, type AgentClass } from "../lib/agent-class.js";
import { claimedFamily, declaresAgent, isAiAssistant, type CrawlerVerifier } from "./crawler-verify.js";
import type { Pressure } from "./pressure.js";

/** The edge's verified-bot marker (Cloudflare `cf.client.bot`, forwarded by nginx as `$vf_verified`). */
export const VERIFIED_BOT_HEADER = "x-vf-verified-bot";

/** The edge vouched for this client: the header is exactly "1". */
export const edgeVerified = (headers: Headers): boolean => headers.get(VERIFIED_BOT_HEADER) === "1";

/**
 * The claims nginx itself checks against the operators' published ranges (the edge configuration `$vf_ua_verify`, the
 * ranges of `the crawler ranges generator`): nginx classes them `search` only from those ranges and `crawler` from
 * anywhere else (`$vf_forged`), so their `search` is already a verified address and needs no lookup of ours (#1205
 * review S1). Held equal to the map by `test/overload.test.ts`.
 */
export const NGINX_RANGE_CHECKED = /googlebot|google-inspectiontool|googleother|bingbot/i;

/** #1290: the `CRAWLER_FAMILIES` that are search engines — every crawler of these operators shares their priority. */
export const ENGINE_FAMILIES: ReadonlySet<string> = new Set(["google", "bing", "yandex", "apple", "duckduckgo"]);

export type ClassDeps ={ readonly crawlers: CrawlerVerifier; readonly clientIp: (headers: Headers) => string | null; readonly pressure: Pressure };

/** Whether this request claims the priority of the search engines and AI assistants (a claim, not yet a proof). */
export function claimsPriority(nginx: AgentClass | null, ua: string | null): boolean {
  const fam = claimedFamily(ua);
  return nginx === "search" || (fam !== null && ENGINE_FAMILIES.has(fam.name)) || isAiAssistant(ua);
}

/** The class this request's digest reads run under: `search` only for a verified search engine or AI assistant. */
export async function requestAgentClass(headers: Headers, d: ClassDeps): Promise<AgentClass | null> {
  const nginx = agentClassOf(headers.get(AGENT_CLASS_HEADER));
  // S2: an SEO tool stays in its own class however verified it is
  if (nginx === "seo") return "seo";
  const ua = headers.get("user-agent");
  // #1290: a crawler that is neither a search engine nor an AI assistant (a training crawler, edge-verified or not) is
  // never on the priority lane; it keeps nginx's class, and a declared or edge-verified agent nginx did not class is a
  // crawler — never a person's request, so it can never take a slot of the digest's person pool. No lookup (P7).
  if (!claimsPriority(nginx, ua)) return nginx ?? (declaresAgent(ua) || edgeVerified(headers) ? "crawler" : null);
  if (edgeVerified(headers)) return "search";
  // nginx's `search` for Google's and Bing's claims IS an address check (their published ranges, `$vf_forged`)
  if (nginx === "search" && ua !== null && NGINX_RANGE_CHECKED.test(ua)) return "search";
  // a claim we have no address list for (Mistral, Google's user-triggered fetchers, SeznamBot …) is proved by the edge
  // alone: without the marker it is a spoof and reads on the crawler lane
  if (claimedFamily(ua) === null) return "crawler";
  // S1: the lookup is paid only while the digest is saturated (where the lane decides who is served); otherwise a
  // verdict already held is read and nothing is looked up — a crawl of a quiet site costs no DNS and no range fetch
  const ip = d.clientIp(headers);
  const v = (await d.pressure.saturated()) ? await d.crawlers.verify(ip, ua) : d.crawlers.peek(ip, ua);
  return v?.verified === true ? "search" : "crawler";
}
