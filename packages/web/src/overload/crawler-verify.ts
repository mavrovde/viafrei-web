/**
 * #1184 phase 2 (data-steward ruling 2026-11-04, P7–P10): a crawler is recognised by its ADDRESS, never by its user
 * agent. Only a request whose User-Agent claims one of the listed crawlers is checked at all; an ordinary browser's
 * request causes no lookup of any kind (P7).
 *
 * The check, in order:
 *  1. the operator's published address ranges (`ranges`), fetched from the operator's own URL at most once a day —
 *     they are not personal data;
 *  2. only where the operator documents DNS as its method (`dns`): reverse DNS of the address, the name must end in
 *     one of the operator's domains, and that name's forward lookup must give the same address back. Through the
 *     HOST's own resolver (`node:dns` with nothing configured, P8) — never a public resolver.
 * A lookup that fails or takes longer than `LOOKUP_TIMEOUT_MS` is "not verified": the request is treated as any
 * client's and is not refused for it.
 *
 * The verdict is kept in memory only (P9), keyed by the address, holding verified or not and the crawler's name:
 * a verified one for at most 24 h, an unverified one for at most 1 h, at most `VERDICT_MAX` entries (least recently
 * used goes first). It is never written anywhere — not to disk, the database, `error_events` or a log line — and is
 * lost on a restart. A verdict a timeout produced is not kept at all, so a slow resolver costs one request only.
 *
 * OPEN (ops, not code): Anthropic and Meta publish neither a range file nor a DNS method this module reads, so their
 * crawlers are never verified here: while the pool is full they are counted like any client and meet the interim page
 * only past their share (`trip.ts`), unless the edge's marker proves them (`verified-class.ts`). The range
 * URLs below were taken from each operator's documentation; DuckDuckGo's is unconfirmed.
 */
import { BlockList, isIP } from "node:net";
import { lookup as dnsLookup, reverse as dnsReverse } from "node:dns/promises";
import { AI_ASSISTANTS } from "../site/crawlers.js";

export const VERIFIED_TTL_MS = 24 * 3_600_000;
export const UNVERIFIED_TTL_MS = 3_600_000;
/** #1205 review: a lookup that could not answer (a timeout, no range file read) is held as unverified this long, so a
 *  claimed crawler on a slow resolver costs one lookup a minute, not one per request. */
export const UNKNOWN_TTL_MS = 60_000;
export const VERDICT_MAX = 50_000;
export const LOOKUP_TIMEOUT_MS = 500;
/** A range file is fetched at most once a day; a failed fetch is tried again after an hour. */
export const RANGES_REFRESH_MS = 24 * 3_600_000;
export const RANGES_RETRY_MS = 3_600_000;

export type CrawlerFamily = {
  readonly name: string;
  /** What a User-Agent writes to CLAIM this crawler. */
  readonly ua: RegExp;
  /** The operator's published range files (`{ prefixes: [{ ipv4Prefix | ipv6Prefix }] }`). */
  readonly ranges: readonly string[];
  /** The domains reverse DNS must end in, where the operator documents DNS verification. */
  readonly dns: readonly string[];
};

/** The closed list (#1141's named crawlers): Google, Bing, Yandex, Apple, DuckDuckGo, OpenAI (its search indexer apart, 2026-11-13, and GPTBot apart, 2026-11-14), Anthropic, Amazon, Meta, Perplexity. */
export const CRAWLER_FAMILIES: readonly CrawlerFamily[] = [
  {
    name: "google",
    ua: /googlebot|google-inspectiontool|googleother|google-extended|storebot-google|adsbot-google/i,
    ranges: [
      "https://developers.google.com/static/crawling/ipranges/common-crawlers.json",
      "https://developers.google.com/static/crawling/ipranges/special-crawlers.json",
    ],
    // #1205 review: never googleusercontent.com, the reverse name of every Compute Engine VM (forward-confirmed too)
    dns: ["googlebot.com", "google.com"],
  },
  { name: "bing", ua: /bingbot|adidxbot|bingpreview/i, ranges: ["https://www.bing.com/toolbox/bingbot.json"], dns: ["search.msn.com"] },
  { name: "yandex", ua: /yandex(?:bot|images|mobilebot|accessibilitybot|metrika|renderresourcesbot)/i, ranges: [], dns: ["yandex.ru", "yandex.net", "yandex.com"] },
  { name: "apple", ua: /applebot/i, ranges: ["https://search.developer.apple.com/applebot.json"], dns: ["applebot.apple.com"] },
  { name: "duckduckgo", ua: /duckduckbot|duckassistbot/i, ranges: ["https://duckduckgo.com/duckduckbot.json"], dns: [] },
  // owner decision 2026-11-13 (#1205): OAI-SearchBot, OpenAI's search indexer, has the search engines' rank and is proved
  // as they are, by ITS list alone — the same rule as nginx's `openai-search` geo tag (the edge configuration `$vf_ai_net`)
  { name: "openai-search", ua: /oai-searchbot/i, ranges: ["https://openai.com/searchbot.json"], dns: [] },
  // owner decision 2026-11-14 (#1306, option 2): GPTBot, OpenAI's crawler, has OAI-SearchBot's rank and is proved the
  // same way, by ITS list alone (gptbot.json) — never searchbot.json or chatgpt-user.json
  { name: "openai-gptbot", ua: /gptbot/i, ranges: ["https://openai.com/gptbot.json"], dns: [] },
  // ChatGPT-User (user-triggered) keeps any OpenAI list, as before
  { name: "openai", ua: /chatgpt-user/i, ranges: ["https://openai.com/gptbot.json", "https://openai.com/searchbot.json", "https://openai.com/chatgpt-user.json"], dns: [] },
  { name: "anthropic", ua: /claudebot|claude-searchbot|claude-user|anthropic-ai/i, ranges: [], dns: [] },
  { name: "amazon", ua: /amazonbot|amzn-searchbot|amzn-user/i, ranges: [], dns: ["crawl.amazonbot.amazon"] },
  { name: "meta", ua: /meta-externalagent|meta-externalfetcher|meta-webindexer|facebookexternalhit/i, ranges: [], dns: [] },
  // perplexity.com answers these lists with a 302 to perplexity.ai (measured 2026-11-13), and a moved list is refused
  { name: "perplexity", ua: /perplexitybot|perplexity-user/i, ranges: ["https://www.perplexity.ai/perplexitybot.json", "https://www.perplexity.ai/perplexity-user.json"], dns: [] },
];

/**
 * The AI assistants (owner 2026-11-12, #1290: "AI assistants must have the same priority as Google and Bing bots"):
 * `AI_ASSISTANTS` of `site/crawlers.ts`, the one list, as a case-insensitive pattern. A request naming one is never a
 * person's; a VERIFIED one reads on the lane of the search engines and AI assistants (`verified-class.ts`), an
 * unverified one is a claim and reads on the crawler lane.
 */
export const AI_ASSISTANT_UA = new RegExp(AI_ASSISTANTS.map((a) => a.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")).join("|"), "i");

/** Whether a User-Agent names an AI assistant of `AI_ASSISTANTS` — a claim, proved only by the edge, a range or the operator's documented reverse DNS. */
export const isAiAssistant = (ua: string | null): boolean => ua !== null && AI_ASSISTANT_UA.test(ua);

/**
 * #1290: whether a User-Agent DECLARES itself an agent — it claims a listed crawler (`CRAWLER_FAMILIES`) or names an
 * AI assistant (`AI_ASSISTANTS`). The one reading of "not a person by its own word" that the degraded answer
 * (`lib/degraded.ts` `notAPerson`) and the digest lane (`verified-class.ts`) share; nginx's `$vf_ua_class` is the other
 * half, and a claim nginx did not class (facebookexternalhit, BingPreview, ChatGPT-User …) is caught here.
 */
export const declaresAgent = (ua: string | null): boolean => claimedFamily(ua) !== null || isAiAssistant(ua);

/** The family a User-Agent CLAIMS, or null — a claim is all this is. */
export function claimedFamily(ua: string | null): CrawlerFamily | null {
  if (ua === null || ua === "") return null;
  return CRAWLER_FAMILIES.find((f) => f.ua.test(ua)) ?? null;
}

export type Resolver = {
  readonly reverse: (ip: string) => Promise<string[]>;
  readonly lookup: (name: string) => Promise<string[]>;
};
/** The host's own resolver (P8): `node:dns` as the system configures it, nothing set. */
export const HOST_RESOLVER: Resolver = {
  reverse: (ip) => dnsReverse(ip),
  lookup: async (name) => (await dnsLookup(name, { all: true, verbatim: true })).map((a) => a.address),
};

export type RangeFetch = (url: string, init: { signal: AbortSignal; redirect: "error" }) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

export type Verdict = { readonly verified: boolean; readonly crawler: string };

export type CrawlerVerifier = {
  /** Whether `ip` is the crawler `ua` claims. A browser UA returns null at once: no lookup, no cache entry. */
  readonly verify: (ip: string | null, ua: string | null) => Promise<Verdict | null>;
  /**
   * #1205 review S1: the verdict already held for `ip` as the crawler `ua` claims, or null — never a lookup, never a
   * range fetch. What the class decision reads while the digest is not saturated (`verified-class.ts`).
   */
  readonly peek: (ip: string | null, ua: string | null) => Verdict | null;
  /** The number of verdicts held (the bound's test). */
  readonly size: () => number;
};

const plain = (ip: string): string => (ip.startsWith("::ffff:") && isIP(ip.slice(7)) === 4 ? ip.slice(7) : ip).toLowerCase();

function bounded<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([promise, new Promise<T>((_, no) => (timer = setTimeout(() => no(new Error("timeout")), ms)))]).finally(() => clearTimeout(timer));
}

/** A DNS answer that the name does not exist (or has no record) is a verdict; anything else (a timeout) is not. */
const definite = (e: unknown): boolean => {
  const code = (e as { code?: unknown } | null)?.code;
  return code === "ENOTFOUND" || code === "ENODATA" || code === "NXDOMAIN";
};

export function createCrawlerVerifier(o: { readonly resolver?: Resolver; readonly fetchRanges?: RangeFetch; readonly now?: () => number } = {}): CrawlerVerifier {
  const resolver = o.resolver ?? HOST_RESOLVER;
  const fetchRanges: RangeFetch = o.fetchRanges ?? ((url, init) => fetch(url, init));
  const now = o.now ?? (() => Date.now());
  // P9: address → verdict, in memory only; Map order is the LRU order
  const verdicts = new Map<string, Verdict & { until: number }>();
  const keep = (ip: string, v: Verdict, ttlMs: number = v.verified ? VERIFIED_TTL_MS : UNVERIFIED_TTL_MS): Verdict => {
    verdicts.delete(ip);
    verdicts.set(ip, { ...v, until: now() + ttlMs });
    while (verdicts.size > VERDICT_MAX) {
      const oldest = verdicts.keys().next().value;
      if (oldest === undefined) break;
      verdicts.delete(oldest);
    }
    return v;
  };
  // the ranges per family, refreshed at most daily
  const ranges = new Map<string, { list: BlockList | null; next: number; loading: Promise<void> | null }>();
  const load = async (f: CrawlerFamily): Promise<BlockList | null> => {
    if (f.ranges.length === 0) return null;
    let r = ranges.get(f.name);
    if (r === undefined) {
      r = { list: null, next: 0, loading: null };
      ranges.set(f.name, r);
    }
    const entry = r;
    if (now() >= entry.next && entry.loading === null) {
      entry.loading = (async () => {
        const list = new BlockList();
        let n = 0;
        try {
          for (const url of f.ranges) {
            // one file that cannot be read costs its own ranges, never the others'
            // #1205 review: a moved list is unreadable, never followed — the operator's own URL or nothing
            const doc = await fetchRanges(url, { signal: AbortSignal.timeout(5_000), redirect: "error" })
              .then((res) => (res.ok ? (res.json() as Promise<{ prefixes?: { ipv4Prefix?: string; ipv6Prefix?: string }[] }>) : null))
              .catch(() => null);
            if (doc === null || typeof doc !== "object") continue;
            for (const p of doc.prefixes ?? []) {
              const c = p.ipv4Prefix ?? p.ipv6Prefix ?? "";
              const [net, len] = c.split("/");
              const v = isIP(net ?? "");
              if (v === 0 || !/^\d{1,3}$/.test(len ?? "")) continue;
              list.addSubnet(net!, Number(len), v === 4 ? "ipv4" : "ipv6");
              n++;
            }
          }
          if (n === 0) throw new Error("no prefixes");
          entry.list = list;
          entry.next = now() + RANGES_REFRESH_MS;
        } catch {
          entry.next = now() + RANGES_RETRY_MS;
        } finally {
          entry.loading = null;
        }
      })();
    }
    if (entry.list === null && entry.loading !== null) await bounded(entry.loading, LOOKUP_TIMEOUT_MS).catch(() => undefined);
    return entry.list;
  };
  const byDns = async (f: CrawlerFamily, ip: string): Promise<boolean | "unknown"> => {
    try {
      const names = await bounded(resolver.reverse(ip), LOOKUP_TIMEOUT_MS);
      const name = names.map((n) => n.toLowerCase().replace(/\.$/, "")).find((n) => f.dns.some((d) => n === d || n.endsWith(`.${d}`)));
      if (name === undefined) return false;
      const back = await bounded(resolver.lookup(name), LOOKUP_TIMEOUT_MS);
      return back.map(plain).includes(ip);
    } catch (e) {
      return definite(e) ? false : "unknown";
    }
  };
  /** The held, unexpired verdict for this claim (moved to the LRU's young end), or null. */
  const heldFor = (f: CrawlerFamily, ip: string): Verdict | null => {
    const held = verdicts.get(ip);
    if (held === undefined || held.until <= now() || held.crawler !== f.name) return null;
    verdicts.delete(ip);
    verdicts.set(ip, held);
    return { verified: held.verified, crawler: held.crawler };
  };
  return {
    size: () => verdicts.size,
    peek: (rawIp, ua) => {
      const f = claimedFamily(ua);
      if (f === null || rawIp === null || isIP(rawIp) === 0) return null;
      return heldFor(f, plain(rawIp));
    },
    verify: async (rawIp, ua) => {
      const f = claimedFamily(ua);
      if (f === null || rawIp === null || isIP(rawIp) === 0) return null;
      const ip = plain(rawIp);
      const held = heldFor(f, ip);
      if (held !== null) return held;
      const list = await load(f);
      if (list?.check(ip, isIP(ip) === 4 ? "ipv4" : "ipv6") === true) return keep(ip, { verified: true, crawler: f.name });
      if (f.dns.length > 0) {
        const ok = await byDns(f, ip);
        if (ok === "unknown") return keep(ip, { verified: false, crawler: f.name }, UNKNOWN_TTL_MS);
        return keep(ip, { verified: ok, crawler: f.name });
      }
      // no DNS method: unverified, kept for an hour when the ranges were actually read, for a minute when they were not
      return keep(ip, { verified: false, crawler: f.name }, list === null ? UNKNOWN_TTL_MS : UNVERIFIED_TTL_MS);
    },
  };
}
