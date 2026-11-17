/**
 * The crawler tokens (#531, 2.1.17), in a module of their own with no
 * imports so the person gate (`location/server.ts` `CRAWLER`, read by
 * `lib/fuel-refresh.ts` `personAsks`) and robots.txt (`site/discovery.ts`)
 * read ONE list (#1065, steward condition C1 / PF3).
 */
/**
 * The crawlers named in robots.txt with their own `Allow: /` group (#531):
 * the search and answer crawlers of OpenAI, Anthropic, Perplexity, Google,
 * Apple, Microsoft, DuckDuckGo and Mistral, and (2.1.17) every corpus or
 * training crawler of `CORPUS_CRAWLERS`. `User-agent: *` already allows the
 * search ones; the named groups say so to an operator who reads the file for
 * its own token.
 *
 * Search and user-triggered agents (allowed everything but the fuel
 * fragment, like `*` and Googlebot under it): Bingbot, OAI-SearchBot,
 * ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot,
 * Perplexity-User, and since 2.1.17 Applebot (Apple's search crawler,
 * support.apple.com/en-us/119829), DuckAssistBot (DuckDuckGo's answer
 * crawler, duckduckgo.com/duckduckgo-help-pages/results/duckassistbot) and
 * MistralAI-User (fetches a page when a Le Chat user asks, docs.mistral.ai/robots).
 */
export const AI_CRAWLERS = [
  "OAI-SearchBot",
  "GPTBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "Bingbot",
  "CCBot",
  // 2.1.17: search and user-triggered agents
  "Applebot",
  "DuckAssistBot",
  "MistralAI-User",
  // #1077 (checked 2026-11-01, `CRAWLERS_CHECKED`): Mistral's search indexer, Amazon's search and user agents, Meta's user fetcher
  "MistralAI-Index",
  "Amzn-SearchBot",
  "Amzn-User",
  "meta-externalfetcher",
  // 2.1.17: corpus and training agents (`CORPUS_CRAWLERS`)
  "meta-externalagent",
  "Bytespider",
  "Amazonbot",
  "cohere-training-data-crawler",
  "Diffbot",
  "Timpibot",
  "omgili",
  "omgilibot",
  "Webzio-Extended",
  "FacebookBot",
  "ImagesiftBot",
  "AI2Bot",
  "PanguBot",
  "GoogleOther",
  "Google-CloudVertexBot",
  // #1077: Mistral's training crawler
  "MistralAI-Training",
] as const;

/**
 * SEARCH ENGINES AND AI ASSISTANTS, one priority (owner 2026-11-12, #1290: "AI assistants must have the same priority
 * as Google and Bing bots"; the same day: all three of Anthropic's agents). THE ONE LIST of the AI assistants that get
 * exactly the search engines' treatment, read by every place that decides it:
 *  - nginx (the edge configuration, the cluster manifests): `$vf_search_claimed` leaves them out of the
 *    per-network budget as it leaves out the search engines (held equal to this list by test/discovery.test.ts and
 *    the edge configuration tests), and `$vf_ai_assistant` (held equal, lower-cased and in this order, by
 *    the edge configuration tests) exempts a VERIFIED one — the edge's marker — from the crawlers' 20-a-minute budget
 *    on the database pages, as Google and Bing are exempt; an unverified claim of one is a spoof and shares the
 *    unverified claims' bucket, as a forged Googlebot does;
 *  - the shell (`overload/crawler-verify.ts` `AI_ASSISTANT_UA`, built from this list): a verified one reads on the
 *    digest's lane of the search engines and AI assistants (`search`), an unverified claim on the crawler lane
 *    (`overload/verified-class.ts`), and none is shown a person's loading page (`lib/degraded.ts`).
 * Who: the user-triggered fetchers (a person asked an assistant for the page at that moment), the AI search indexers,
 * Anthropic's ClaudeBot (owner 2026-11-12: all three Anthropic agents) and Amazon's Amazonbot (owner 2026-11-14: "Add
 * Amazon bot to the priority also"; all three of Amazon's agents, as Anthropic's) and OpenAI's GPTBot (owner decision
 * 2026-11-14, #1306 option 2: verified-crawler priority like OAI-SearchBot) — the three training crawlers here. All three
 * stay in `CORPUS_CRAWLERS` below: a lane priority lifts no licence ruling, so the fuel board's page stays Disallowed to
 * them. Every other training or corpus crawler (CCBot, Bytespider …) and the SEO tools are NOT here: they read
 * on the crawler lane and keep the crawlers' budget. Amazon publishes no IP ranges: an Amazonbot is proved by the edge's
 * marker or by its reverse DNS (`crawl.amazonbot.amazon`, `overload/crawler-verify.ts`), and an unverified claim of it
 * reads on the crawler lane. Google-Read-Aloud and FeedFetcher-Google are Google's own user-triggered
 * fetchers, whose addresses are deliberately NOT in nginx's crawler ranges (#1205 review N6): the marker is their proof.
 * OAI-SearchBot, OpenAI's search indexer, is in the search engines' own group (owner decision 2026-11-13, #1205: "include
 * ChatGPT to the priority group"): proved exactly as Google's and Bing's crawlers are, by the marker or by OpenAI's
 * OAI-SearchBot list ALONE (`searchbot.json`; nginx's geo tag `openai-search`, the shell's family `openai-search` in
 * `overload/crawler-verify.ts`), never by GPTBot's or ChatGPT-User's list. GPTBot (#1306) is proved the same way by
 * ITS list alone (`gptbot.json`; the shell's family `openai-gptbot`), never by OAI-SearchBot's or ChatGPT-User's: a
 * GPTBot claim from any other address is a spoof and reads on the crawler lane.
 */
export const AI_ASSISTANTS = [
  "OAI-SearchBot",
  "GPTBot",
  "ChatGPT-User",
  "Claude-SearchBot",
  "Claude-User",
  "ClaudeBot",
  "PerplexityBot",
  "Perplexity-User",
  "DuckAssistBot",
  "MistralAI-User",
  "MistralAI-Index",
  "Amazonbot",
  "Amzn-SearchBot",
  "Amzn-User",
  "meta-externalfetcher",
  "Google-Read-Aloud",
  "FeedFetcher-Google",
  "Google-Agent",
  "YouBot",
  "cohere-ai",
  // #1323 (prod 2026-11-17): an AI search indexer Cloudflare verifies (category "AI Search"); its sweeps of the charging
  // pages queued on the crawler lane and were answered 503 at the 2 s deadline. No operator page was found for it; the
  // edge's verification is the only source, and an unverified claim of it reads on the crawler lane
  "ShapBot",
] as const;
/**
 * #1077: the day the operators' own crawler pages were last read against these lists, each page named:
 * OpenAI developers.openai.com/api/docs/bots (OAI-SearchBot, GPTBot, ChatGPT-User; OAI-AdsBot only visits ad landing
 * pages and is not listed), Anthropic support.claude.com article 8896518 (ClaudeBot, Claude-User, Claude-SearchBot),
 * Google developers.google.com/search/docs/crawling-indexing/google-common-crawlers (Google-Extended, GoogleOther,
 * Google-CloudVertexBot), Perplexity docs.perplexity.ai/guides/bots (PerplexityBot, Perplexity-User), Meta
 * developers.facebook.com/docs/sharing/webmasters/web-crawlers (meta-externalagent, meta-externalfetcher,
 * meta-webindexer in `PACED_CRAWLERS`; Meta-ExternalAds is an ads crawler and not listed), Mistral docs.mistral.ai/robots
 * (MistralAI-User, MistralAI-Index, MistralAI-Training) and Amazon developer.amazon.com/amazonbot (Amazonbot,
 * Amzn-SearchBot, Amzn-User). Apple, DuckDuckGo, Common Crawl and Bytespider are as 2.1.17 read them (see below).
 */
export const CRAWLERS_CHECKED = "2026-11-01";

/**
 * The crawlers that BUILD a corpus or train on one: each is kept off the fuel
 * board's page in every live language. Data-steward
 * ruling 2026-10-05, Verdict 1 condition 4 — no archive of rendered boards:
 * the page's `noarchive` binds a search engine's cache, and a corpus crawler
 * obeys `Disallow` and not `noarchive`. A crawler that finds a group of its
 * own ignores `*`, so the rule is written inside each of these groups. The
 * search and on-demand agents (and `*`) keep the page, which is consumer
 * information read when a person asks.
 *
 * 2.1.17: a training crawler NOT named here fell into `*`, which allows the
 * fuel page — so the list now carries every well-documented corpus agent,
 * each token as its operator publishes it: CCBot (commoncrawl.org/ccbot),
 * GPTBot (platform.openai.com/docs/bots), ClaudeBot (Anthropic's crawler
 * help page), Google-Extended, GoogleOther and Google-CloudVertexBot
 * (developers.google.com/search/docs/crawling-indexing/google-common-crawlers),
 * Applebot-Extended (support.apple.com/en-us/119829), meta-externalagent
 * and FacebookBot
 * (developers.facebook.com/docs/sharing/webmasters/web-crawlers), Amazonbot
 * (developer.amazon.com/amazonbot), Diffbot (docs.diffbot.com), ImagesiftBot
 * (imagesift.com/about), AI2Bot (allenai.org/crawler); and Bytespider
 * (ByteDance), cohere-training-data-crawler (Cohere), Timpibot (Timpi), omgili,
 * omgilibot and Webzio-Extended (Webz.io) and PanguBot (Huawei), whose operators' pages could not be read
 * from here and which are documented in the Dark Visitors agent registry
 * (darkvisitors.com/agents). A Disallow for a token nobody sends costs nothing.
 *
 * THE LIMIT: robots.txt is a request, not access control. A crawler that
 * ignores it, or sends a token not listed, reads these pages like a person;
 * what keeps a corpus from the fuel figures beyond it is the pages' own
 * `noarchive` and the fuel fragments' gate (motorway layer, place card), which
 * answers a crawler or a cross-site fetch with a sentence and no station.
 */
export const CORPUS_CRAWLERS: readonly (typeof AI_CRAWLERS)[number][] = [
  "CCBot",
  "GPTBot",
  "ClaudeBot",
  "Google-Extended",
  "Applebot-Extended",
  "meta-externalagent",
  "Bytespider",
  "Amazonbot",
  "cohere-training-data-crawler",
  "Diffbot",
  "Timpibot",
  "omgili",
  "omgilibot",
  "Webzio-Extended",
  "FacebookBot",
  "ImagesiftBot",
  "AI2Bot",
  "PanguBot",
  "GoogleOther",
  "Google-CloudVertexBot",
  "MistralAI-Training",
];

/**
 * #936 C: the SEO-tool crawlers — backlink and keyword databases, not search
 * engines. On 2026-10-21/22 MJ12, Semrush, Ahrefs and DotBot made 9 312 place
 * requests in two days and send no reader; each place page costs the database
 * a road read. Each gets a group of its own with `Crawl-delay`, which these
 * crawlers honour (Google and Bing ignore the field, and keep `*`). A group of
 * its own replaces `*` for that crawler, so it repeats `*`'s lines, and since #1182 (data-steward ruling 2026-11-08,
 * B3) adds the fuel page's `Disallow` lines (`CORPUS_DISALLOW`): the board is not for a backlink database, and the
 * fuel page withholds it from these tokens (`lib/fuel-index.ts` `boardWithheld`). The same
 * tokens form nginx's `seo` class in the edge configuration (a `limit_req` of its
 * own, well below the per-address page limit), held equal by
 * `test/discovery.test.ts`: robots.txt is a request, the zone is the wall.
 */
export const SEO_CRAWLERS = ["MJ12bot", "SemrushBot", "AhrefsBot", "DotBot", "BLEXBot", "SerpstatBot", "DataForSeoBot", "barkrowler", "rogerbot"] as const;

/**
 * Meta's search indexer is paced like the SEO tools (owner, 2026-10-23): on that
 * day `meta-webindexer` made 21 357 requests and `meta-externalagent` 5 946,
 * nearly all of them uncached place pages, while neither had sent one on
 * 2026-10-20. `meta-webindexer` gets a group of its own like an SEO tool and sits
 * in nginx's `seo` class with them, held equal by `test/discovery.test.ts`.
 * `meta-externalagent` was paced with it until #1205 (review S2, owner: search
 * engines and AI crawlers first): it is an AI crawler among `AI_CRAWLERS` (a corpus
 * crawler, kept off the fuel page) with no `Crawl-delay`, in nginx's crawler class,
 * which the edge's verified marker lifts to the digest's search lane.
 * `meta-webindexer`'s user agent carries none of the crawler class's words
 * (bot, crawl, spider, …), so before this it was treated as a person.
 */
export const PACED_CRAWLERS = ["meta-webindexer"] as const;

/**
 * Every token robots.txt names a group for — the AI agents, the SEO tools and the paced crawlers (#1065 review B3):
 * the site door's crawler class is built from this list, so a crawler that has a robots.txt group of its own is
 * refused by the fuel gates too. `barkrowler` and `meta-webindexer` carry none of the generic words.
 */
export const ROBOTS_CRAWLERS: readonly string[] = [...AI_CRAWLERS, ...SEO_CRAWLERS, ...PACED_CRAWLERS];

/**
 * #1182 (data-steward ruling 2026-11-08, B3) and #1221: the clients that say by their own user agent that they are
 * AUTOMATION — a headless browser, a browser-automation framework or an HTTP library — and so neither a consumer nor
 * a search engine indexing for one. ONE list: the fuel index withholds its per-Land board from them (`lib/fuel-index.ts`
 * `boardWithheld`), and #1221 keeps them from causing an on-demand request. Each token is matched case-insensitively
 * as a substring of the user agent, so it is written as the client writes it; a client that hides its name (a
 * headless browser with a desktop user agent) is not caught here, and nothing claims it is.
 */
export const AUTOMATION_AGENTS: readonly { readonly token: string; readonly reason: string }[] = [
  { token: "Lightpanda", reason: "the Lightpanda headless browser names itself (Lightpanda/1.0, #1221)" },
  { token: "HeadlessChrome", reason: "Chrome and Chromium in headless mode, Puppeteer's and Playwright's default" },
  { token: "HeadlessEdg", reason: "Microsoft Edge in headless mode" },
  { token: "PhantomJS", reason: "the PhantomJS headless browser" },
  { token: "SlimerJS", reason: "the SlimerJS scriptable browser" },
  { token: "HtmlUnit", reason: "the HtmlUnit headless browser for Java" },
  { token: "jsdom", reason: "jsdom's default user agent" },
  { token: "Puppeteer", reason: "a Puppeteer client that names the framework" },
  { token: "Playwright", reason: "a Playwright client that names the framework" },
  { token: "Selenium", reason: "a Selenium client that names the framework" },
  { token: "Cypress", reason: "the Cypress test runner's browser" },
  { token: "Scrapy", reason: "the Scrapy scraping framework's default" },
  { token: "python-requests", reason: "the Python requests library's default" },
  { token: "python-urllib", reason: "Python's urllib default" },
  { token: "python-httpx", reason: "the Python httpx library's default" },
  { token: "aiohttp", reason: "the Python aiohttp library's default" },
  { token: "Go-http-client", reason: "Go's net/http default" },
  { token: "node-fetch", reason: "the node-fetch library's default" },
  { token: "axios/", reason: "the axios library's default" },
  { token: "curl/", reason: "the curl command-line client's default" },
  { token: "Wget/", reason: "the GNU Wget client's default" },
  { token: "libwww-perl", reason: "Perl's LWP default" },
  { token: "WebDriver", reason: "a W3C WebDriver client that names the protocol (#1221)" },
  { token: "Zombie.js", reason: "the Zombie.js headless browser (#1221)" },
  { token: "undici", reason: "Node's undici HTTP client default (#1221)" },
  { token: "okhttp", reason: "the OkHttp library's default (#1221)" },
];

/** Whether a user agent names itself as automation (`AUTOMATION_AGENTS`). An empty user agent is not matched here. */
export function isAutomationAgent(ua: string): boolean {
  const u = ua.toLowerCase();
  return AUTOMATION_AGENTS.some((a) => u.includes(a.token.toLowerCase()));
}
