/**
 * #1290: the digest lane a request reads on, as the shell decides it and sends it — both directions:
 *  - THE OWNER'S RULE (2026-11-12: "AI assistants must have the same priority as Google and Bing bots"; the same day,
 *    all three of Anthropic's agents): the `search` lane is the lane of the search engines and AI assistants
 *    (`AI_ASSISTANTS`, ClaudeBot included, and Amazonbot since owner 2026-11-14: "Add Amazon bot to the priority
 *    also", and GPTBot since owner decision 2026-11-14, #1306 option 2). A VERIFIED one reads on it; a spoof of one (no
 *    marker, no range) reads on the crawler lane; every other training crawler (CCBot, Bytespider …) reads on the crawler
 *    lane however verified;
 *  - a client that declares itself an agent (a listed crawler's claim, an AI assistant) is never sent as a person,
 *    even where nginx's map gave it no class; a browser is never sent as a crawler;
 *  - the marker the digest reads comes from the request's scope only: a copy in a fetcher's own headers is removed
 *    (a person's request sends none, a crawler's sends its own class over it).
 * The edge half (nginx SETS `X-VF-Agent-Class`, so a client's copy never reaches the shell; a verified assistant past
 * 20 a minute is never refused, a spoofed one and a verified GPTBot are) is run in `scripts/landing-conf.test.sh` 4c/4f.
 * No network: the resolver and the range files are stubs, the global fetch a recorder.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AGENT_CLASS_HEADER, digestFetch, withAgentClass } from "../src/lib/agent-class.js";
import { notAPerson } from "../src/lib/degraded.js";
import { createCrawlerVerifier, declaresAgent, isAiAssistant, type RangeFetch, type Resolver } from "../src/overload/crawler-verify.js";
import { requestAgentClass, VERIFIED_BOT_HEADER, type ClassDeps } from "../src/overload/verified-class.js";
import { AI_ASSISTANTS, CORPUS_CRAWLERS } from "../src/site/crawlers.js";
import { clientIp } from "../src/location/client-ip.js";

const BROWSER = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const SPOOF_IP = "203.0.113.7";
/** An address inside the OpenAI range FIXTURE below (a documentation range; nothing is fetched). */
const OPENAI_IP = "192.0.2.7";
const nf = (): Error => Object.assign(new Error("not found"), { code: "ENOTFOUND" });
const nobody: Resolver = { reverse: () => Promise.reject(nf()), lookup: () => Promise.reject(nf()) };
const noRanges: RangeFetch = () => Promise.reject(new Error("no network in a test"));
/** OpenAI's three range files, as a fixture: each lists 192.0.2.0/28 (never a live fetch). */
const openaiRanges: RangeFetch = (url) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({ prefixes: url.startsWith("https://openai.com/") ? [{ ipv4Prefix: "192.0.2.0/28" }] : [] }) });
const deps = (saturated: boolean, fetchRanges: RangeFetch = noRanges): ClassDeps => ({
  crawlers: createCrawlerVerifier({ resolver: nobody, fetchRanges }),
  clientIp,
  pressure: { saturated: () => Promise.resolve(saturated) },
});
const cls = (h: Record<string, string>, saturated = false) => requestAgentClass(new Headers({ "x-forwarded-for": SPOOF_IP, ...h }), deps(saturated));
const uaOf = (token: string): string => `Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ${token}/1.0)`;
const MARK = { [VERIFIED_BOT_HEADER]: "1" };
/** Training and corpus crawlers that are not AI assistants: the crawler lane, however verified. */
const TRAINING = ["CCBot", "Bytespider", "meta-externalagent", "cohere-training-data-crawler"];
/** An address the Amazon resolver fixture below names in `crawl.amazonbot.amazon` (a documentation range; nothing is looked up). */
const AMAZON_IP = "192.0.2.9";
const AMAZON_NAME = "ec2-192-0-2-9.crawl.amazonbot.amazon";
/** Reverse DNS of AMAZON_IP is in Amazon's crawl domain and forward-confirms; every other address resolves to nothing. */
const amazonDns: Resolver = {
  reverse: (ip) => (ip === AMAZON_IP ? Promise.resolve([AMAZON_NAME]) : Promise.reject(nf())),
  lookup: (name) => (name === AMAZON_NAME ? Promise.resolve([AMAZON_IP]) : Promise.reject(nf())),
};

/** User agents nginx's `$vf_ua_class` map names no class for (no bot|crawl|spider|… word), each declaring an agent. */
const DECLARED_UNCLASSED = [
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) BingPreview/1.0b",
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot",
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +Claude-User@anthropic.com)",
  "Mozilla/5.0 (compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)",
  "Mozilla/5.0 (compatible; Google-Agent)",
  "cohere-ai",
];

describe("#1290 (owner 2026-11-12): the search engines and AI assistants share one priority", () => {
  it("the one list: every AI assistant is recognised, ClaudeBot, Amazonbot and GPTBot among them, and no other training crawler", () => {
    for (const a of AI_ASSISTANTS) expect(isAiAssistant(uaOf(a)), a).toBe(true);
    expect(AI_ASSISTANTS).toContain("ClaudeBot");
    expect(AI_ASSISTANTS).toContain("Amazonbot");
    expect(AI_ASSISTANTS).toContain("GPTBot");
    expect(AI_ASSISTANTS).toEqual(expect.arrayContaining(["ChatGPT-User", "Claude-User", "Perplexity-User", "Google-Agent", "MistralAI-User", "cohere-ai", "OAI-SearchBot", "Claude-SearchBot", "PerplexityBot"]));
    for (const t of TRAINING) expect(isAiAssistant(uaOf(t)), t).toBe(false);
    // GPTBot, ClaudeBot and Amazonbot are the corpus crawlers that are assistants (owner 2026-11-12, 2026-11-14, #1306), and stay corpus crawlers
    expect(AI_ASSISTANTS.filter((a) => (CORPUS_CRAWLERS as readonly string[]).includes(a))).toEqual(["GPTBot", "ClaudeBot", "Amazonbot"]);
  });

  it("a VERIFIED AI assistant reads on the search lane, whatever class nginx gave it (the edge marker)", async () => {
    for (const a of AI_ASSISTANTS) {
      for (const nginx of [{}, { [AGENT_CLASS_HEADER]: "crawler" }]) {
        expect(await cls({ "user-agent": uaOf(a), ...MARK, ...nginx }), `${a} ${JSON.stringify(nginx)}`).toBe("search");
      }
    }
  });

  it("a SPOOFED AI assistant (no marker, an address nobody vouches for) reads on the crawler lane — quiet or saturated", async () => {
    for (const saturated of [false, true]) {
      for (const a of AI_ASSISTANTS) {
        for (const nginx of [{}, { [AGENT_CLASS_HEADER]: "crawler" }, { [AGENT_CLASS_HEADER]: "search" }]) {
          expect(await cls({ "user-agent": uaOf(a), ...nginx }, saturated), `${a} ${JSON.stringify(nginx)} saturated=${String(saturated)}`).toBe("crawler");
        }
      }
    }
  });

  it("a training crawler stays on the crawler lane, verified by the edge or not; a verified SEO tool stays seo", async () => {
    // (each carries a crawler token, so nginx classes it `crawler`; that class is what the edge's marker no longer lifts)
    for (const t of TRAINING) {
      for (const h of [{ [AGENT_CLASS_HEADER]: "crawler" }, { ...MARK, [AGENT_CLASS_HEADER]: "crawler" }]) {
        expect(await cls({ "user-agent": uaOf(t), ...h }, true), `${t} ${JSON.stringify(h)}`).toBe("crawler");
      }
    }
    expect(await cls({ "user-agent": uaOf("AhrefsBot"), ...MARK, [AGENT_CLASS_HEADER]: "seo" })).toBe("seo");
    // and the search engines keep their lane: verified by the edge, or by nginx's own range check
    expect(await cls({ "user-agent": uaOf("Googlebot"), ...MARK })).toBe("search");
    expect(await cls({ "user-agent": uaOf("Googlebot"), [AGENT_CLASS_HEADER]: "search" })).toBe("search");
    expect(await cls({ "user-agent": uaOf("Googlebot"), [AGENT_CLASS_HEADER]: "crawler" })).toBe("crawler");
  });

  it("ClaudeBot — all three of Anthropic's agents — is on the search lane when verified, the crawler lane when spoofed; CCBot is not", async () => {
    for (const a of ["ClaudeBot", "Claude-User", "Claude-SearchBot"]) {
      expect(await cls({ "user-agent": uaOf(a), ...MARK, [AGENT_CLASS_HEADER]: "crawler" }), a).toBe("search");
      expect(await cls({ "user-agent": uaOf(a), [AGENT_CLASS_HEADER]: "crawler" }, true), a).toBe("crawler");
    }
    expect(await cls({ "user-agent": uaOf("CCBot"), ...MARK, [AGENT_CLASS_HEADER]: "crawler" })).toBe("crawler");
  });

  it("Amazonbot (owner 2026-11-14) — all three of Amazon's agents — is on the search lane when verified by the edge or its reverse DNS, the crawler lane when unverified", async () => {
    const AMAZONBOT = "Mozilla/5.0 (compatible; Amazonbot/0.1; +https://developer.amazon.com/support/amazonbot)";
    for (const ua of [AMAZONBOT, uaOf("Amzn-SearchBot"), uaOf("Amzn-User")]) {
      // the edge's marker, whatever class nginx gave it
      for (const nginx of [{}, { [AGENT_CLASS_HEADER]: "crawler" }]) expect(await cls({ "user-agent": ua, ...MARK, ...nginx }), ua).toBe("search");
      // an unverified claim: no marker, an address nobody vouches for — quiet or saturated, whatever nginx said
      for (const saturated of [false, true]) {
        for (const nginx of [{}, { [AGENT_CLASS_HEADER]: "crawler" }, { [AGENT_CLASS_HEADER]: "search" }]) {
          expect(await cls({ "user-agent": ua, ...nginx }, saturated), `${ua} ${JSON.stringify(nginx)} saturated=${String(saturated)}`).toBe("crawler");
        }
      }
    }
    // reverse DNS in crawl.amazonbot.amazon, forward-confirmed: Amazon publishes no IP ranges, so this and the marker are the proof
    const viaDns = (resolver: Resolver): ClassDeps => ({ crawlers: createCrawlerVerifier({ resolver, fetchRanges: noRanges }), clientIp, pressure: { saturated: () => Promise.resolve(true) } });
    const d = viaDns(amazonDns);
    const at = (ip: string, ua: string, deps_: ClassDeps = d) => requestAgentClass(new Headers({ "x-forwarded-for": ip, "user-agent": ua, [AGENT_CLASS_HEADER]: "crawler" }), deps_);
    expect(await at(AMAZON_IP, AMAZONBOT)).toBe("search");
    expect(await at(SPOOF_IP, AMAZONBOT)).toBe("crawler");
    // the address alone lifts no non-assistant (CCBot claims no priority, so no lookup is made for it)
    expect(await at(AMAZON_IP, uaOf("CCBot"))).toBe("crawler");
    // a reverse name in Amazon's domain that does not forward-confirm is a spoof
    const forged: Resolver = { reverse: () => Promise.resolve([AMAZON_NAME]), lookup: () => Promise.resolve(["198.51.100.1"]) };
    expect(await at(SPOOF_IP, AMAZONBOT, viaDns(forged))).toBe("crawler");
  });

  it("an assistant proved by its operator's RANGES (a fixture, no network) is on the search lane; a training crawler from the same range is not", async () => {
    const d = deps(true, openaiRanges);
    const at = (ip: string, ua: string) => requestAgentClass(new Headers({ "x-forwarded-for": ip, "user-agent": ua, [AGENT_CLASS_HEADER]: "crawler" }), d);
    expect(await at(OPENAI_IP, uaOf("ChatGPT-User"))).toBe("search");
    expect(await at(OPENAI_IP, uaOf("OAI-SearchBot"))).toBe("search");
    expect(await at(SPOOF_IP, uaOf("ChatGPT-User"))).toBe("crawler");
    // GPTBot (#1306): this fixture's gptbot.json lists the address too
    expect(await at(OPENAI_IP, uaOf("GPTBot"))).toBe("search");
    expect(await at(OPENAI_IP, uaOf("CCBot"))).toBe("crawler");
    // quiet: no lookup is made, and a verdict already held is what counts (#1205 review S1)
    const quiet = deps(false, openaiRanges);
    const q = (ip: string) => requestAgentClass(new Headers({ "x-forwarded-for": ip, "user-agent": uaOf("OAI-SearchBot") }), quiet);
    expect(await q(OPENAI_IP)).toBe("crawler");
    await quiet.crawlers.verify(OPENAI_IP, uaOf("OAI-SearchBot"));
    expect(await q(OPENAI_IP)).toBe("search");
  });

  it("OAI-SearchBot is proved by OpenAI's OAI-SearchBot list alone, never GPTBot's or ChatGPT-User's (owner decision 2026-11-13, #1205)", async () => {
    // searchbot.json lists 192.0.2.0/28, the other two OpenAI lists 198.51.100.0/28 (fixtures, nothing is fetched)
    const OTHER_IP = "198.51.100.7";
    const split: RangeFetch = (url) =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ prefixes: url === "https://openai.com/searchbot.json" ? [{ ipv4Prefix: "192.0.2.0/28" }] : url.startsWith("https://openai.com/") ? [{ ipv4Prefix: "198.51.100.0/28" }] : [] }),
      });
    const d = deps(true, split);
    const at = (ip: string, ua: string) => requestAgentClass(new Headers({ "x-forwarded-for": ip, "user-agent": ua, [AGENT_CLASS_HEADER]: "crawler" }), d);
    expect(await at(OPENAI_IP, uaOf("OAI-SearchBot"))).toBe("search");
    expect(await at(OTHER_IP, uaOf("OAI-SearchBot"))).toBe("crawler");
    // ChatGPT-User keeps any OpenAI list, as before
    expect(await at(OTHER_IP, uaOf("ChatGPT-User"))).toBe("search");
    expect(await at(OPENAI_IP, uaOf("ChatGPT-User"))).toBe("search");
    // GPTBot (#1306) is proved by gptbot.json alone: searchbot.json's address does not prove it
    expect(await at(OPENAI_IP, uaOf("GPTBot"))).toBe("crawler");
    expect(await at(OTHER_IP, uaOf("GPTBot"))).toBe("search");
  });

  it("#1306 (owner decision 2026-11-14, option 2): GPTBot from an address of OpenAI's gptbot.json is verified and reads on the search lane; a GPTBot claim from any other address does not", async () => {
    // each OpenAI list its own documentation range (fixtures, nothing is fetched): which list proved it is observable
    const GPTBOT_IP = "198.51.100.7";
    const SEARCHBOT_IP = "192.0.2.7";
    const CHATGPT_USER_IP = "203.0.113.200";
    const lists: Record<string, string> = {
      "https://openai.com/gptbot.json": "198.51.100.0/28",
      "https://openai.com/searchbot.json": "192.0.2.0/28",
      "https://openai.com/chatgpt-user.json": "203.0.113.192/28",
    };
    const fetched: string[] = [];
    const byList: RangeFetch = (url) => {
      fetched.push(url);
      const p = lists[url];
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ prefixes: p === undefined ? [] : [{ ipv4Prefix: p }] }) });
    };
    const GPTBOT = "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)";
    const verifier = createCrawlerVerifier({ resolver: nobody, fetchRanges: byList });
    const d: ClassDeps = { crawlers: verifier, clientIp, pressure: { saturated: () => Promise.resolve(true) } };
    const at = (ip: string, nginx: Record<string, string> = { [AGENT_CLASS_HEADER]: "crawler" }) =>
      requestAgentClass(new Headers({ "x-forwarded-for": ip, "user-agent": GPTBOT, ...nginx }), d);
    // from its own list: verified, and on the priority lane whatever class nginx gave it
    expect(await verifier.verify(GPTBOT_IP, GPTBOT)).toEqual({ verified: true, crawler: "openai-gptbot" });
    for (const nginx of [{}, { [AGENT_CLASS_HEADER]: "crawler" }, { [AGENT_CLASS_HEADER]: "search" }]) expect(await at(GPTBOT_IP, nginx), JSON.stringify(nginx)).toBe("search");
    // only gptbot.json was read for it — never searchbot.json or chatgpt-user.json
    expect([...new Set(fetched)]).toEqual(["https://openai.com/gptbot.json"]);
    // the GPTBot user agent from any other address is not verified: OAI-SearchBot's list, ChatGPT-User's, nobody's
    for (const ip of [SEARCHBOT_IP, CHATGPT_USER_IP, SPOOF_IP]) {
      expect(await verifier.verify(ip, GPTBOT), ip).toEqual({ verified: false, crawler: "openai-gptbot" });
      for (const nginx of [{}, { [AGENT_CLASS_HEADER]: "crawler" }, { [AGENT_CLASS_HEADER]: "search" }]) expect(await at(ip, nginx), `${ip} ${JSON.stringify(nginx)}`).toBe("crawler");
    }
    // the edge's marker proves it too, as every assistant; without the marker or a range it is a spoof, quiet or saturated
    expect(await cls({ "user-agent": GPTBOT, ...MARK, [AGENT_CLASS_HEADER]: "crawler" })).toBe("search");
    for (const saturated of [false, true]) expect(await cls({ "user-agent": GPTBOT, [AGENT_CLASS_HEADER]: "crawler" }, saturated)).toBe("crawler");
    // and gptbot.json's address proves no other OpenAI agent's claim of priority but ChatGPT-User's (any OpenAI list, as before)
    const as = (ua: string) => requestAgentClass(new Headers({ "x-forwarded-for": GPTBOT_IP, "user-agent": uaOf(ua), [AGENT_CLASS_HEADER]: "crawler" }), d);
    expect(await as("OAI-SearchBot")).toBe("crawler");
    expect(await as("ChatGPT-User")).toBe("search");
    // a verified GPTBot is still a corpus crawler: the lane lifts no licence ruling (the fuel board, robots.txt)
    expect(CORPUS_CRAWLERS).toContain("GPTBot");
  });
});

describe("#1290: a declared agent never reads on the person lane, a person never on a crawler lane", () => {
  it("nginx's map really gives these no class (the case this closes), and each declares an agent", () => {
    const nginxCrawler = /bot|crawl|spider|externalagent|scrap|slurp/i;
    for (const ua of DECLARED_UNCLASSED) {
      expect(declaresAgent(ua), ua).toBe(true);
      // ChatGPT-User's own UA carries "+https://openai.com/bot", so nginx does class that one; the rest it does not
      if (!ua.includes("openai.com/bot")) expect(nginxCrawler.test(ua), ua).toBe(false);
    }
  });

  it("with no class from nginx, a declared agent is the crawler class — quiet or saturated, unverified", async () => {
    for (const saturated of [false, true]) for (const ua of DECLARED_UNCLASSED) expect(await cls({ "user-agent": ua }, saturated), `${ua} saturated=${String(saturated)}`).toBe("crawler");
  });

  it("the edge's marker lifts a declared search engine or AI assistant to the search lane, any other agent to the crawler lane — never to the person lane", async () => {
    for (const ua of DECLARED_UNCLASSED) {
      const priority = !ua.startsWith("facebookexternalhit");
      expect(await cls({ "user-agent": ua, ...MARK }), ua).toBe(priority ? "search" : "crawler");
    }
    // an edge-verified bot nobody classed and that names no agent is still not a person
    expect(await cls({ "user-agent": "SomeVerifiedMonitor/2.0", ...MARK })).toBe("crawler");
  });

  it("a browser — with no class, an empty one or one nginx never sends — stays a person: null, the person pool", async () => {
    for (const h of [{}, { [AGENT_CLASS_HEADER]: "" }, { [AGENT_CLASS_HEADER]: "person" }, { [AGENT_CLASS_HEADER]: "Search" }]) {
      expect(await cls({ "user-agent": BROWSER, ...h }), JSON.stringify(h)).toBeNull();
    }
    expect(await cls({})).toBeNull();
    expect(declaresAgent(BROWSER)).toBe(false);
    expect(declaresAgent(null)).toBe(false);
  });

  it("the degraded answer and the lane read the same list: whatever the lane sends as a crawler is not a person there", async () => {
    for (const ua of [...DECLARED_UNCLASSED, ...AI_ASSISTANTS.map(uaOf), BROWSER]) {
      const lane = await cls({ "user-agent": ua });
      const h = new Headers({ "user-agent": ua });
      expect(withAgentClass(lane, () => notAPerson(h)), ua).toBe(lane !== null);
    }
  });
});

describe("#1290: the lane marker the digest reads comes from the request's scope only", () => {
  let seen: (string | null)[] = [];
  beforeEach(() => {
    seen = [];
    vi.stubGlobal("fetch", (_url: string, init?: RequestInit) => {
      seen.push(new Headers(init?.headers).get(AGENT_CLASS_HEADER));
      return Promise.resolve(new Response("ok"));
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("a person's request sends no marker even when a fetcher's headers carry one", async () => {
    for (const v of ["search", "crawler", "seo", "person", ""]) {
      await withAgentClass(null, () => digestFetch("http://digest/internal/place/cards", { headers: { [AGENT_CLASS_HEADER]: v, accept: "text/html" } }));
    }
    // and outside any request
    await digestFetch("http://digest/internal/place/cards", { headers: new Headers({ [AGENT_CLASS_HEADER]: "search" }) });
    expect(seen).toEqual([null, null, null, null, null, null]);
  });

  it("a crawler's request sends its own class, over whatever a fetcher's headers carried", async () => {
    await withAgentClass("crawler", () => digestFetch("http://digest/x", { headers: { [AGENT_CLASS_HEADER]: "search" } }));
    await withAgentClass("seo", () => digestFetch("http://digest/x", { headers: [[AGENT_CLASS_HEADER, "crawler"]] }));
    await withAgentClass("search", () => digestFetch("http://digest/x", { headers: { [AGENT_CLASS_HEADER]: "" } }));
    await withAgentClass("crawler", () => digestFetch("http://digest/x"));
    expect(seen).toEqual(["crawler", "seo", "search", "crawler"]);
  });

  it("a person's fetch with no marker handed in is the caller's own init, untouched (the pre-#1290 path)", async () => {
    const init: RequestInit = { headers: { accept: "text/html" } };
    let got: RequestInit | undefined;
    vi.stubGlobal("fetch", (_u: string, i?: RequestInit) => ((got = i), Promise.resolve(new Response("ok"))));
    await digestFetch("http://digest/x", init);
    expect(got).toBe(init);
  });
});
