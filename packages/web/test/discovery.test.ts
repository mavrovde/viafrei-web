/**
 * The machine-readable routes of #531, read through the functions the routes
 * serve: robots.txt, /llms.txt, /llms-full.txt, the MCP server card, the MCP
 * Registry's domain proof and the sitemap's lastmod.
 */
import { SEARCH_DISALLOW } from "../src/site/search.js";
import { readFileSync } from "node:fs";
import { datedCredit } from "../src/site/attribution-year.js";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { all, parse, text as nodeText } from "@viafrei/design/testing";
import catalogue from "../src/generated/catalogue.json" with { type: "json" };
import { buildCatalogue, oneLine } from "../scripts/generate-catalogue.js";
import { sitemapXml } from "../src/pages/sitemap.xml.js";
import { lastmodOf } from "../src/site/lastmod.js";
import { newestNewsDate } from "../src/news/entries.js";
import { SECURITY_TXT_URL, SERVER_CARD_PATHS, serverCard as mcpServerCard } from "../../mcp/src/server/server-card.js";
import { DISCOVERY_ROUTES } from "../scripts/site-map.js";
import { SERVER_VERSION } from "../../mcp/src/server/server.js";
import { AI_ASSISTANTS } from "../src/site/crawlers.js";
import { AI_CRAWLERS, CARD_HEADERS, CARD_WELL_KNOWN_PATHS, CORPUS_CRAWLERS, SECURITY_TXT_DAYS, SECURITY_TXT_PATH, TEXT_HEADERS, securityTxt, FRAGMENT_DISALLOW, MCP_REGISTRY_AUTH, PACED_CRAWLERS, SEO_CLASS_TOKENS, SEO_CRAWLERS, SEO_CRAWL_DELAY_S, llmsFullTxt, llmsTxt, robotsTxt, serverCard, wholeWords } from "../src/site/discovery.js";
import { MOTORWAY_FUEL_PATH } from "../src/lib/motorway-fuel.js";
import { PLACE_FUEL_PATH } from "../src/lib/place-fuel.js";
import { ALL_SITEMAPS } from "../src/site/sitemaps.js";
import { MCP_ENDPOINT, MCP_SSE_ENDPOINT, SITE_ORIGIN } from "../src/site/endpoints.js";
import { pageMeta } from "../src/site/meta.js";
import { LIVE_LANGS, PAGES, pathFor } from "../src/site/pages.js";
import { energyPath } from "../src/site/energy.js";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * 2.1.17: the agents robots.txt names, by what they do. The search and
 * user-triggered agents keep everything but the fragments; every corpus
 * or training agent is kept off the fuel page too (since #1065 no longer off
 * the place pages). Written out
 * here rather than read from the module, so dropping one there is a red test.
 */
const SEARCH_AGENTS = ["Bingbot", "OAI-SearchBot", "ChatGPT-User", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User", "Applebot", "DuckAssistBot", "MistralAI-User", "MistralAI-Index", "Amzn-SearchBot", "Amzn-User", "meta-externalfetcher"];
const CORPUS_EXPECTED = [
  "CCBot", "GPTBot", "ClaudeBot", "Google-Extended", "Applebot-Extended",
  "meta-externalagent", "Bytespider", "Amazonbot", "cohere-training-data-crawler", "Diffbot", "Timpibot", "omgili", "omgilibot", "Webzio-Extended", "FacebookBot", "ImagesiftBot", "AI2Bot", "PanguBot", "GoogleOther", "Google-CloudVertexBot", "MistralAI-Training",
];

/** #1111: the search page's two lines, in every group after the fragments' line. */
const SEARCH_LINES: readonly string[] = SEARCH_DISALLOW.map((p) => `Disallow: ${p}`);

describe("robots.txt (#531)", () => {
  const txt = robotsTxt();
  const groups = txt.split(/\n\n+/).filter((g) => g.startsWith("User-agent:"));
  it("keeps User-agent: * / Allow: / and the Sitemap line", () => {
    expect(txt).toContain("User-agent: *\nAllow: /\n");
    expect(txt).toMatch(new RegExp(`^Sitemap: ${SITE_ORIGIN}/sitemap\\.xml$`, "m"));
  });
  it("names every AI crawler with its own group opening with Allow: /", () => {
    expect(AI_CRAWLERS).toHaveLength(SEARCH_AGENTS.length + CORPUS_EXPECTED.length);
    expect(new Set(AI_CRAWLERS).size).toBe(AI_CRAWLERS.length);
    for (const ua of [...SEARCH_AGENTS, ...CORPUS_EXPECTED]) {
      expect(groups.some((g) => g.startsWith(`User-agent: ${ua}\nAllow: /`)), ua).toBe(true);
    }
    expect(groups).toHaveLength(1 + AI_CRAWLERS.length + SEO_CRAWLERS.length + PACED_CRAWLERS.length);
  });
  it("asks every SEO-tool crawler for Crawl-delay in a group of its own that otherwise says what * says (#936 C)", () => {
    for (const ua of ["MJ12bot", "SemrushBot", "AhrefsBot", "DotBot"]) expect(SEO_CRAWLERS as readonly string[], ua).toContain(ua);
    expect(SEO_CRAWL_DELAY_S).toBe(10);
    for (const ua of SEO_CRAWLERS) {
      const g = groups.find((x) => x.startsWith(`User-agent: ${ua}\n`));
      // #1182 (data-steward ruling 2026-11-08, B3): the fuel page is disallowed in an SEO tool's own group too
      expect(g?.split("\n").filter((l) => l !== ""), ua).toEqual([`User-agent: ${ua}`, "Allow: /", `Disallow: ${FRAGMENT_DISALLOW}`, ...SEARCH_LINES, ...LIVE_LANGS.map((l) => `Disallow: ${pathFor("fuel", l)}`), "Crawl-delay: 10"]);
    }
    // Nobody else is asked to wait: the search engines, the other AI agents and * carry no Crawl-delay.
    expect(txt.split("\n").filter((l) => l.startsWith("Crawl-delay:"))).toHaveLength(SEO_CLASS_TOKENS.length);
    const named = new Set([...AI_CRAWLERS, "Googlebot", "YandexBot"].map((x) => x.toLowerCase()));
    for (const ua of SEO_CRAWLERS) expect(named.has(ua.toLowerCase()), ua).toBe(false);
  });
  it("names the same SEO tools as nginx's seo class, the limit behind the request (the edge configuration, #936 C)", () => {
    const conf = readFileSync(join(WEB, "the edge configuration"), "utf8").replace(/#[^\n]*/g, "");
    const m = /^\s*~\*\(([^)]+)\)\s+"seo";/m.exec(conf);
    expect(m, "the seo line of the user-agent class map").not.toBeNull();
    expect(m![1]!.split("|").sort()).toEqual(SEO_CLASS_TOKENS.map((x) => x.toLowerCase()).sort());
  });
  it("leaves the search engines and exactly the AI assistants out of nginx's per-network budget (#1077 review, #1290)", () => {
    const conf = readFileSync(join(WEB, "the edge configuration"), "utf8").replace(/#[^\n]*/g, "");
    const block = /map \$http_user_agent \$vf_search_claimed \{([^}]*)\}/u.exec(conf);
    expect(block, "the vf_search_engine map").not.toBeNull();
    const tokens = [...block![1]!.matchAll(/~\*\(([^)]+)\)\s+"1";/gu)].flatMap((m) => m[1]!.split("|"));
    const engines = ["googlebot", "bingbot", "applebot", "duckduckbot", "yandexbot", "seznambot", "google-inspectiontool", "googleother"];
    expect(tokens.sort()).toEqual([...engines, ...AI_ASSISTANTS.map((x) => x.toLowerCase())].sort());
    // No SEO tool is an assistant, and no training or corpus crawler escapes the budget through an assistant token —
    // ClaudeBot, Amazonbot and GPTBot alone, by the owner's word (2026-11-12: all three of Anthropic's agents; 2026-11-14:
    // "Add Amazon bot to the priority also"; 2026-11-14, #1306 option 2: GPTBot like OAI-SearchBot). `applebot` covering
    // the robots-only token Applebot-Extended is the search engines' line, as before.
    for (const ua of AI_ASSISTANTS) expect((SEO_CRAWLERS as readonly string[]).includes(ua), ua).toBe(false);
    const answer = tokens.filter((t) => !engines.includes(t));
    const training = [...CORPUS_CRAWLERS, "GPTBot", "CCBot", "Bytespider"].filter((c) => c !== "ClaudeBot" && c !== "Amazonbot" && c !== "GPTBot");
    for (const ua of training) expect(answer.some((t) => ua.toLowerCase().includes(t)), ua).toBe(false);
    expect(answer).toContain("claudebot");
    expect(answer).toContain("amazonbot");
    expect(answer).toContain("gptbot");
  });
  it("paces Meta's search indexer like the SEO tools; its AI crawler is an AI crawler again, unpaced (owner 2026-10-23; #1205 review S2)", () => {
    expect([...PACED_CRAWLERS]).toEqual(["meta-webindexer"]);
    const g = groups.find((x) => x.startsWith("User-agent: meta-webindexer\n"));
    expect(g?.split("\n").filter((l) => l !== "")).toEqual(["User-agent: meta-webindexer", "Allow: /", `Disallow: ${FRAGMENT_DISALLOW}`, ...SEARCH_LINES, ...LIVE_LANGS.map((l) => `Disallow: ${pathFor("fuel", l)}`), "Crawl-delay: 10"]);
    const ext = groups.filter((x) => x.startsWith("User-agent: meta-externalagent\n"));
    expect(ext).toHaveLength(1);
    // Still a corpus crawler: kept off the fuel page; no longer asked to wait (#1205 review S2)
    expect(ext[0]).toContain(`Disallow: ${pathFor("fuel", "de")}`);
    expect(ext[0]).not.toContain("Crawl-delay");
    for (const ua of [...PACED_CRAWLERS, "meta-externalagent"]) expect(groups.filter((x) => x.toLowerCase().startsWith(`user-agent: ${ua.toLowerCase()}\n`)), ua).toHaveLength(1);
  });
  it("keeps every corpus crawler, SEO tool and paced crawler off the fuel board's page in every live language, and nobody else (Verdict 1 condition 4; 2.1.17 the list; #1182 ruling 2026-11-08 B3)", () => {
    const fuel = LIVE_LANGS.map((l) => pathFor("fuel", l));
    expect(fuel).toHaveLength(LIVE_LANGS.length);
    const group = (ua: string): string[] => groups.find((g) => g.startsWith(`User-agent: ${ua}\n`))!.split("\n").filter((l) => l !== "");
    expect([...CORPUS_CRAWLERS]).toEqual(CORPUS_EXPECTED);
    // No corpus crawler is paced since #1205 (review S2): meta-externalagent carries no Crawl-delay line any more.
    for (const ua of CORPUS_CRAWLERS) expect(group(ua), ua).toEqual([`User-agent: ${ua}`, "Allow: /", "Disallow: /fragment/", ...SEARCH_LINES, ...fuel.map((f) => `Disallow: ${f}`)]);
    for (const ua of ["*", ...SEARCH_AGENTS]) {
      expect(group(ua), ua).toEqual([`User-agent: ${ua}`, "Allow: /", "Disallow: /fragment/", ...SEARCH_LINES]);
    }
    // nothing but the fuel pages and the fragments is disallowed to anyone — the motorway and place pages stay open (M28, #1065)
    const dis = txt.split("\n").filter((l) => l.startsWith("Disallow:"));
    const groupsN = txt.split("\n").filter((l) => l.startsWith("User-agent:")).length;
    expect(dis).toHaveLength((CORPUS_CRAWLERS.length + SEO_CRAWLERS.length + PACED_CRAWLERS.length) * fuel.length + groupsN * (1 + SEARCH_LINES.length));
    expect(dis.some((l) => /\/(autobahn|motorway)(\/|$)/.test(l))).toBe(false); // no motorway PAGE is disallowed
    expect(dis.every((l) => [...fuel, FRAGMENT_DISALLOW, ...SEARCH_DISALLOW].includes(l.slice("Disallow: ".length)))).toBe(true);
  });

  /**
   * #1065, the issue's "robots.txt changes" — the four points, each against the
   * generated file: 41 groups, 20 of them the corpus crawlers', 69 sitemaps (47 until #1025 added the 22 exit files).
   */
  describe("#1065: place pages open to the corpus crawlers, every fragment closed to everyone", () => {
    const group = (ua: string): string[] => groups.find((g) => g.startsWith(`User-agent: ${ua}\n`))!.split("\n").filter((l) => l !== "");
    const uas = txt.split("\n").filter((l) => l.startsWith("User-agent: ")).map((l) => l.slice("User-agent: ".length));
    it("there are 46 groups, 21 of them the corpus crawlers' (#1077: five tokens added)", () => {
      expect(uas).toHaveLength(46);
      expect(CORPUS_CRAWLERS).toHaveLength(21);
    });
    it("(1) no /<lang>/place/ line in any group — the 22 languages × 20 corpus groups are gone", () => {
      expect(LIVE_LANGS).toHaveLength(22);
      expect(txt).not.toMatch(/^Disallow: \/[a-z]{2}\/place\//m);
      for (const ua of uas) expect(group(ua).some((l) => l.includes("/place/")), ua).toBe(false);
    });
    it("(2) the 22 /<lang>/fuel lines stay in each of the 21 corpus groups and, since #1182 (ruling 2026-11-08 B3), the 9 SEO-tool groups and the paced crawler's — in no other", () => {
      const kept: readonly string[] = [...CORPUS_CRAWLERS, ...SEO_CRAWLERS, ...PACED_CRAWLERS];
      for (const ua of uas) {
        const lines = group(ua).filter((l) => /^Disallow: \/[a-z]{2}\/fuel$/.test(l));
        expect(lines, ua).toEqual(kept.includes(ua) ? LIVE_LANGS.map((l) => `Disallow: ${pathFor("fuel", l)}`) : []);
      }
      expect(SEO_CRAWLERS).toHaveLength(9);
      expect(PACED_CRAWLERS).toHaveLength(1);
      expect(txt.split("\n").filter((l) => /^Disallow: \/[a-z]{2}\/fuel$/.test(l))).toHaveLength(22 * (21 + 9 + 1));
      // the search engines (`*`) and the AI assistants keep the page, under its noarchive (C5) — but ClaudeBot, the one
      // corpus crawler among the assistants (#1290 is a lane priority, not a licence ruling), keeps the B3 withholding
      // (the assistants robots.txt names in a group of their own; Google's user-triggered fetchers and the rest read `*`)
      const named = AI_ASSISTANTS.filter((a) => (AI_CRAWLERS as readonly string[]).includes(a) && !(CORPUS_CRAWLERS as readonly string[]).includes(a));
      for (const ua of ["*", ...named]) expect(group(ua).some((l) => /\/fuel$/.test(l)), ua).toBe(false);
    });
    it("#1182 ruling 2026-11-08 B5: the public 'not for crawlers' line says what the fuel page's HTML carries, and to whom", () => {
      const line = `- Fuel prices (Tankerkönig, from the Markttransparenzstelle für Kraftstoffe) are consumer information shown when a person asks, never data to collect: the fuel page ${SITE_ORIGIN}${pathFor("fuel", "en")} is disallowed to every corpus and training crawler in every language; its HTML carries only a bounded selection for search engines under noarchive (up to three stations per state, each with the time of its price), and every other fuel price loads only in a reader's browser.`;
      for (const f of [llmsTxt(), llmsFullTxt()]) {
        expect(f.split("\n")).toContain(line);
        expect(f).not.toContain("are not in any page's HTML a crawler gets");
      }
    });
    it("(3) Disallow: /fragment/ replaces /fragment/motorway-fuel in all 46 groups, `*` included — and covers both fuel fragments", () => {
      expect(FRAGMENT_DISALLOW).toBe("/fragment/");
      expect(txt).not.toContain("/fragment/motorway-fuel");
      for (const ua of uas) expect(group(ua).filter((l) => l === "Disallow: /fragment/"), ua).toHaveLength(1);
      expect(txt.split("\n").filter((l) => l === "Disallow: /fragment/")).toHaveLength(46);
      for (const p of [MOTORWAY_FUEL_PATH, PLACE_FUEL_PATH, "/fragment/place", "/fragment/tile", "/fragment/suggest", "/fragment/motorway-around"]) expect(p.startsWith(FRAGMENT_DISALLOW), p).toBe(true);
    });
    it("(5) #1111: the search page — the bare page and any query of it — is disallowed in all 46 groups, and no path that merely begins with the word", () => {
      expect(SEARCH_DISALLOW).toEqual(["/*/search$", "/*/search?"]);
      for (const ua of uas) for (const l of SEARCH_LINES) expect(group(ua).filter((x) => x === l), `${ua} ${l}`).toHaveLength(1);
      expect(txt.split("\n").filter((l) => SEARCH_LINES.includes(l))).toHaveLength(46 * 2);
    });
    it("(4) unchanged but for #1025's exit files, #1041's station files, #1027's road files, #1074's Land files and #1076's charging index (#1167 S1: no fuel index): 136 sitemaps, Crawl-delay on the SEO crawlers and meta-webindexer only (#1205 review S2: no longer meta-externalagent), `*` and the search/user agents carry the fragment line alone", () => {
      expect(txt.split("\n").filter((l) => l.startsWith("Sitemap: "))).toHaveLength(136);
      expect(ALL_SITEMAPS).toHaveLength(136);
      const delayed = uas.filter((ua) => group(ua).includes("Crawl-delay: 10"));
      expect(delayed.sort()).toEqual(["AhrefsBot", "BLEXBot", "DataForSeoBot", "DotBot", "MJ12bot", "SemrushBot", "SerpstatBot", "barkrowler", "meta-webindexer", "rogerbot"].sort());
      for (const ua of ["*", ...SEARCH_AGENTS]) expect(group(ua), ua).toEqual([`User-agent: ${ua}`, "Allow: /", "Disallow: /fragment/", ...SEARCH_LINES]);
      expect(txt.split("\n")[0]).toBe(`# ViaFrei — a summary for AI tools: ${SITE_ORIGIN}/llms.txt (the full one: ${SITE_ORIGIN}/llms-full.txt)`);
    });
  });
  it("points at /llms.txt in a comment line", () => {
    expect(txt.split("\n").filter((l) => l.startsWith("#") && l.includes(`${SITE_ORIGIN}/llms.txt`))).toHaveLength(1);
  });
});

describe("/llms.txt and /llms-full.txt (#531, the llmstxt.org shape)", () => {
  for (const [name, txt] of [["llms.txt", llmsTxt()], ["llms-full.txt", llmsFullTxt()]] as const) {
    it(`${name}: one H1, then a blockquote summary, then H2 sections with links`, () => {
      const lines = txt.split("\n");
      expect(lines[0]).toBe("# ViaFrei");
      expect(lines.filter((l) => /^# /.test(l))).toHaveLength(1);
      expect(lines.find((l) => l !== "" && l !== "# ViaFrei")).toMatch(/^> /);
      for (const h of ["## Connect", "## Pages", "## Code and listings"]) expect(lines, h).toContain(h);
      expect(txt).toMatch(/^- \[[^\]]+\]\(https:\/\/[^)]+\)/m);
    });
    it(`${name}: the language count is the number of languages it lists (#753 review: it said "seven" beside 22)`, () => {
      const m = /in (\S+) languages \(([^)]+)\)/.exec(txt);
      expect(m, "the live-pages sentence").not.toBeNull();
      const listed = m![2]!.split(", ");
      expect(listed).toEqual([...LIVE_LANGS]);
      expect(m![1]).toBe(String(listed.length));
      expect(txt).not.toMatch(/\bseven languages\b/i);
    });
    it(`${name}: the endpoint, the legacy SSE address, no key/no account, the beta, the licence sentence, a German line`, () => {
      expect(txt).toContain(MCP_ENDPOINT);
      expect(txt).toContain(MCP_SSE_ENDPOINT);
      expect(txt).toMatch(/no key, no account/);
      expect(txt).toMatch(/beta/i);
      expect(txt).toContain("Every answer carries its source and its licence");
      expect(txt).toMatch(/^Deutsch: /m);
    });
    it(`${name}: how to connect — Claude, ChatGPT, the Claude Code command and npx viafrei`, () => {
      expect(txt).toContain(`claude mcp add --transport http viafrei ${MCP_ENDPOINT}`);
      expect(txt).toContain("npx -y viafrei");
      expect(txt).toMatch(/^- claude\.ai \(web\): /m);
      expect(txt).toMatch(/^- Claude Desktop: /m);
      expect(txt).toMatch(/^- ChatGPT: /m);
    });
    it(`${name}: links every page of the map (but the 404), the public repo, the wiki, npm — never the private repo`, () => {
      for (const p of PAGES.filter((x) => x.id !== "404")) expect(txt, p.id).toContain(`](${SITE_ORIGIN}${pathFor(p.id, "en")})`);
      expect(txt).not.toContain(`${SITE_ORIGIN}${pathFor("404", "en")}`);
      expect(txt).toContain("(https://github.com/mavrovde/viafrei-mcp)");
      expect(txt).toContain("(https://github.com/mavrovde/viafrei-mcp/wiki)");
      expect(txt).toContain("(https://www.npmjs.com/package/viafrei)");
      expect(txt).not.toMatch(/github\.com\/mavrovde\/viafrei(?![-\w])/);
      expect(txt).toContain(pageMeta("connect", "en").title);
    });
    it(`${name}: carries no template hole and no HTML`, () => {
      expect(txt).not.toMatch(/\{\w+\}/);
      expect(txt).not.toMatch(/<[a-z]/i);
    });
  }
  it("llms.txt points at the full version, which lists every tool the server registers with its one line", () => {
    expect(llmsTxt()).toContain(`(${SITE_ORIGIN}/llms-full.txt)`);
    const full = llmsFullTxt();
    expect(catalogue.tools.length).toBeGreaterThanOrEqual(20);
    for (const tool of catalogue.tools) expect(full, tool.name).toContain(`- \`${tool.name}\` — ${tool.title}: ${tool.description}`);
    const listed = [...full.matchAll(/^- `([a-z_]+)` — /gm)].map((m) => m[1]);
    expect(listed).toEqual(catalogue.tools.map((x) => x.name));
    // the short file names the tools (2.1.13, #715) and leaves their descriptions to the full one
    expect(llmsTxt()).toContain(`## Tools (${catalogue.tools.length})\n\n${catalogue.tools.map((x) => `\`${x.name}\``).join(", ")}\n`);
    expect(llmsTxt()).not.toMatch(/^- `[a-z_]+` — /m);
  });
  it("llms-full.txt carries every credit line of the server, verbatim, and the MTS-K note", () => {
    const full = llmsFullTxt();
    // #804: a line naming the year of retrieval is printed with this render's year.
    for (const c of catalogue.credits) expect(full, c.id).toContain(datedCredit(c.text, new Date()));
    expect(full).toContain("Hinweis zu den Kraftstoffpreisdaten (MTS-K)");
  });
  it("its tool lines are the booted server's, not a copy: the committed catalogue equals what the server lists now", async () => {
    const live = await buildCatalogue();
    expect(catalogue.tools).toEqual(live.tools);
  });
  it("a one-liner ends at its sentence, not at an abbreviation inside brackets, and is cut at a word when too long", () => {
    expect(oneLine("Returns bikes (nextbike incl. KVB Rad). More here.")).toBe("Returns bikes (nextbike incl. KVB Rad).");
    expect(oneLine("One. Two.")).toBe("One.");
    const long = oneLine(`${"word ".repeat(80)}end.`);
    expect(long.length).toBeLessThanOrEqual(241);
    expect(long.endsWith("word…")).toBe(true);
    expect(wholeWords("cut mid wor")).toBe("cut mid…");
    expect(wholeWords("a whole sentence.")).toBe("a whole sentence.");
  });
});

describe("/.well-known/mcp/server-card.json (#531, #534)", () => {
  it("is the SAME document mcp.viafrei.de serves — the server's own serverCard(), deep-equal", () => {
    // Tests may import across workspaces; the runtime may not (check_web_boundary.sh).
    expect(serverCard()).toEqual(mcpServerCard());
    expect(JSON.parse(JSON.stringify(serverCard()))).toEqual(JSON.parse(JSON.stringify(mcpServerCard())));
  });
  it("carries the SEP-2127 identity the registry entry has, and the release this build is", () => {
    const card = serverCard();
    expect(card).toMatchObject({ name: "de.viafrei/mcp", title: "ViaFrei", websiteUrl: SITE_ORIGIN });
    expect(card.version).toBe(SERVER_VERSION);
    expect(card.version).toBe(catalogue.release.version);
    expect(card.remotes).toEqual([{ type: "streamable-http", url: MCP_ENDPOINT, supportedProtocolVersions: expect.arrayContaining(["2025-06-18"]) as unknown }]);
  });
  it("carries none of the #531 card's non-standard fields", () => {
    for (const k of ["transports", "authentication", "links", "documentationUrl"]) expect(Object.keys(serverCard()), k).not.toContain(k);
    expect(JSON.stringify(serverCard())).not.toContain(MCP_SSE_ENDPOINT);
  });
  it("the route serves it, with JSON's headers and the card's CORS rule", () => {
    const src = readFileSync(join(WEB, "src", "pages", ".well-known", "mcp", "server-card.json.ts"), "utf8");
    expect(src).toContain("serverCard()");
    expect(src).toContain("CARD_HEADERS");
    expect(CARD_HEADERS).toEqual({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "*" });
  });
  it("llms.txt links both hosts' cards", () => {
    expect(llmsTxt()).toContain(`${SITE_ORIGIN}/.well-known/mcp/server-card.json`);
    expect(llmsTxt()).toContain("https://mcp.viafrei.de/.well-known/mcp.json");
  });
});

describe("the card on both hosts, from one source (#734)", () => {
  it("both hosts answer the same two /.well-known/ paths — mcp.viafrei.de's SERVER_CARD_PATHS holds both of viafrei.de's", () => {
    expect([...CARD_WELL_KNOWN_PATHS]).toEqual(["/.well-known/mcp/server-card.json", "/.well-known/mcp.json"]);
    expect(SERVER_CARD_PATHS.filter((p) => p.startsWith("/.well-known/")).sort()).toEqual([...CARD_WELL_KNOWN_PATHS].sort());
    for (const p of CARD_WELL_KNOWN_PATHS) expect(DISCOVERY_ROUTES as readonly string[], p).toContain(p);
  });
  it("each viafrei.de route serves serverCard() with the card's headers — no second document", () => {
    for (const p of CARD_WELL_KNOWN_PATHS) {
      const src = readFileSync(join(WEB, "src", "pages", `${p.slice(1)}.ts`), "utf8");
      expect(src, p).toContain("JSON.stringify(serverCard(), null, 2)");
      expect(src, p).toContain("CARD_HEADERS");
      expect(src, p).not.toMatch(/de\.viafrei\/mcp|"version"/);
    }
  });
  it("nginx routes every /.well-known/ discovery route to the shell on both server blocks", () => {
    const conf = readFileSync(join(WEB, "..", "..", "infra", "the edge configuration"), "utf8");
    for (const p of DISCOVERY_ROUTES.filter((x) => x.startsWith("/.well-known/"))) {
      expect(conf.split(`location = ${p} { include the edge shell proxy rules; }`).length - 1, p).toBe(2);
    }
  });
});

describe("/.well-known/security.txt (RFC 9116, #734)", () => {
  it("carries the required Contact and Expires, the language and the Canonical, one field per line", () => {
    const body = securityTxt("2026-11-03");
    expect(body).toBe([
      `Contact: ${SITE_ORIGIN}/impressum`,
      "Expires: 2027-11-02T00:00:00Z",
      "Preferred-Languages: de, en",
      `Canonical: ${SITE_ORIGIN}/.well-known/security.txt`,
      "",
    ].join("\n"));
    expect(`${SITE_ORIGIN}${SECURITY_TXT_PATH}`).toBe(SECURITY_TXT_URL);
    expect(DISCOVERY_ROUTES as readonly string[]).toContain(SECURITY_TXT_PATH);
  });
  it("Expires is the release day plus less than a year, a function of the build and never of the clock", () => {
    expect(SECURITY_TXT_DAYS).toBeLessThan(365);
    // across a leap day: 2028-02-29 is inside the window
    expect(securityTxt("2027-11-03")).toContain("Expires: 2028-11-01T00:00:00Z");
    expect(securityTxt()).toBe(securityTxt(catalogue.release.date));
    const exp = Date.parse(/^Expires: (.+)$/m.exec(securityTxt())?.[1] ?? "");
    const day = Date.parse(`${catalogue.release.date}T00:00:00Z`);
    expect(exp - day).toBeGreaterThan(300 * 86_400_000);
    expect(exp - day).toBeLessThan(365 * 86_400_000);
    for (const bad of ["", "2026-11-3", "03.11.2026"]) expect(() => securityTxt(bad), bad).toThrow(/YYYY-MM-DD/);
  });
  it("names no address of its own: the contact is the Impressum, which carries the host's", () => {
    expect(securityTxt()).not.toMatch(/@|mailto:|tel:/);
    const src = readFileSync(join(WEB, "src", "pages", ".well-known", "security.txt.ts"), "utf8");
    expect(src).toContain("securityTxt()");
    expect(src).toContain("TEXT_HEADERS");
    expect(TEXT_HEADERS["Content-Type"]).toBe("text/plain; charset=utf-8");
  });
  it("no A2A agent card is served: ViaFrei speaks MCP, not A2A (#734 decision)", () => {
    for (const p of ["/.well-known/agent.json", "/.well-known/agent-card.json", "/.well-known/ai-catalog.json"]) {
      expect(DISCOVERY_ROUTES as readonly string[], p).not.toContain(p);
    }
  });
});

describe("/.well-known/mcp-registry-auth (#531)", () => {
  it("is exactly the MCP Registry's line with the ed25519 PUBLIC key", () => {
    expect(MCP_REGISTRY_AUTH).toBe("v=MCPv1; k=ed25519; p=jUqCmjmgZc7SVATg6yb5ainOGw/LGb1XZOsgf88rl/w=");
    // a 32-byte ed25519 public key, base64 — never a private key (64 bytes) or a PEM block
    expect(Buffer.from(MCP_REGISTRY_AUTH.split("p=")[1]!, "base64")).toHaveLength(32);
    expect(MCP_REGISTRY_AUTH).not.toMatch(/PRIVATE/);
  });
});

describe("sitemap lastmod (#531, per page since 2.0.0)", () => {
  it("every url carries ITS page's day, and a test can hand another", () => {
    const xml = sitemapXml(() => "2026-10-08");
    const urls = xml.match(/<url>/g)?.length ?? 0;
    expect(urls).toBeGreaterThan(40);
    expect(xml.match(/<loc>[^<]+<\/loc><lastmod>2026-10-08<\/lastmod>/g)?.length).toBe(urls);
    expect(all(sitemapXml(() => null), "lastmod")).toEqual([]);
  });
  it("is the content map's day per page and language, and the newest entry's day for the News page", () => {
    const xml = sitemapXml();
    for (const p of PAGES.filter((x) => x.id !== "404")) {
      for (const l of LIVE_LANGS) {
        const day = lastmodOf(p.id, l);
        expect(day, `${p.id}:${l}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(nodeText(parse(xml).root)).toContain(`https://viafrei.de${pathFor(p.id, l)}${day!}`);
        expect(all(xml, "loc").map(nodeText)).toContain(`https://viafrei.de${pathFor(p.id, l)}`);
        expect(all(xml, "lastmod").map(nodeText)).toContain(`${day!}`);
      }
    }
    expect(lastmodOf("news", "de")).toBe(newestNewsDate());
  });
});

describe("#1065: the place line of llms.txt and llms-full.txt promises no prices to a crawler", () => {
  for (const [name, txt] of [["llms.txt", llmsTxt()], ["llms-full.txt", llmsFullTxt()]] as const) {
    it(name, () => {
      const line = txt.split("\n").find((l) => l.startsWith("- Towns: "));
      expect(line, "the place line").toBeDefined();
      expect(line).toContain("fuel card whose prices load only in a reader's browser and are not crawlable (/fragment/ is disallowed in robots.txt)");
      expect(line).not.toMatch(/charging, fuel and stations/);
      // steward C3: the line carries no fuel figure — no price, no station or price count, no Tankerkönig/MTS-K — and
      // its one number, outside its URLs, is the population threshold.
      const prose = (line ?? "").replace(/https:\S+/g, "");
      expect(prose).not.toMatch(/€|EUR|\d[.,]\d{3}|tankerk|MTS-K|\d+\s*(?:stations?|prices?)\b/i);
      expect(prose.match(/\d[\d\s]*\d|\d/g)).toEqual(["10 000"]);
    });
  }
});

/**
 * #1167 S4 (data-steward 2026-11-04): robots.txt read the way a crawler reads it — RFC 9309: every group naming the
 * agent (case-insensitive) is merged, `*` only when none does; the longest matching path wins and an Allow wins a tie;
 * `*` and `$` are wildcards. Every corpus crawler is refused a fuel station's page in every language, and still allowed
 * a charging site's; the `*` group is allowed both, so the matcher can say yes.
 */
describe("#1167 S4: no corpus crawler may fetch a fuel station's page, in any language", () => {
  const txt = robotsTxt();
  const groups = txt.split(/\n\n+/).filter((g) => g.startsWith("User-agent:")).map((g) => g.split("\n").filter((l) => l !== ""));
  const named = (g: readonly string[]): string[] => g.filter((l) => /^user-agent:/i.test(l)).map((l) => l.slice(l.indexOf(":") + 1).trim().toLowerCase());
  const rulesFor = (ua: string): { allow: boolean; path: string }[] => {
    const mine = groups.filter((g) => named(g).includes(ua.toLowerCase()));
    const use = mine.length > 0 ? mine : groups.filter((g) => named(g).includes("*"));
    return use.flatMap((g) => g.filter((l) => /^(?:allow|disallow):/i.test(l)).map((l) => ({ allow: /^allow:/i.test(l), path: l.slice(l.indexOf(":") + 1).trim() })));
  };
  const matches = (rule: string, path: string): boolean => {
    const anchored = rule.endsWith("$");
    const body = (anchored ? rule.slice(0, -1) : rule).split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*");
    return new RegExp(`^${body}${anchored ? "$" : ""}`).test(path);
  };
  const allowed = (ua: string, path: string): boolean => {
    const hits = rulesFor(ua).filter((r) => r.path !== "" && matches(r.path, path));
    if (hits.length === 0) return true;
    const best = Math.max(...hits.map((r) => r.path.length));
    return hits.some((r) => r.path.length === best && r.allow);
  };
  const FUEL = "aral-fulda-hauptstrasse-wcmsxofnfs";
  const CHARGING = "enbw-fulda-hauptstrasse-vxdmuqxptv";
  it("the matcher reads the file: a fragment is refused to everyone, the home allowed", () => {
    expect(CORPUS_CRAWLERS.length).toBeGreaterThan(0);
    expect(allowed("*", "/fragment/x")).toBe(false);
    expect(allowed(CORPUS_CRAWLERS[0]!, "/")).toBe(true);
  });
  for (const ua of CORPUS_CRAWLERS) {
    it(ua, () => {
      for (const l of LIVE_LANGS) {
        expect(allowed(ua, energyPath("fuel", l, FUEL)), `${ua} ${l} fuel`).toBe(false);
        expect(allowed(ua, energyPath("charging", l, CHARGING)), `${ua} ${l} charging`).toBe(true);
      }
    });
  }
  it("the * group may fetch both (search engines index the page, noarchive)", () => {
    for (const l of LIVE_LANGS) {
      expect(allowed("*", energyPath("fuel", l, FUEL)), l).toBe(true);
      expect(allowed("*", energyPath("charging", l, CHARGING)), l).toBe(true);
    }
  });
});
