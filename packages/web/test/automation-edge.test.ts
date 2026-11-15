/**
 * #1222: the edge and the shell use ONE automation list. The edge's `$vf_auto_class` map limits the clients
 * that name themselves automation on the card fragments; its tokens must be `AUTOMATION_AGENTS` (crawlers.ts) —
 * lower-cased, a dot escaped, in its order. The edge's configuration is viafrei-infra's, so the two cases that
 * read it are skipped here (viafrei-infra holds them against this repository's release); what stays is this
 * repository's half: the regex derived from AUTOMATION_AGENTS matches exactly what isAutomationAgent matches.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AUTOMATION_AGENTS, isAutomationAgent } from "../src/site/crawlers.js";

const CONF = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "infra", "the edge configuration");

/** The tokens the edge's map must carry, derived from AUTOMATION_AGENTS as the edge derives them. */
const derivedTokens = (): string[] => AUTOMATION_AGENTS.map((a) => a.token.toLowerCase().replace(/\./gu, "\\."));

function edgeTokens(): string[] {
  const conf = readFileSync(CONF, "utf8").replace(/#[^\n]*/g, "");
  const block = /map \$http_user_agent \$vf_auto_class \{([^}]*)\}/u.exec(conf);
  expect(block, "the vf_auto_class map").not.toBeNull();
  const line = /"~\*\(([^)]+)\)"\s+"automation";/u.exec(block![1]!);
  expect(line, "the automation line of the vf_auto_class map").not.toBeNull();
  return line![1]!.split("|");
}

describe("the edge's automation class (#1222)", () => {
  // cross-repo(viafrei-infra): the edge's nginx map is viafrei-infra's configuration
  it.skip("is AUTOMATION_AGENTS, token for token, in its order", () => {
    expect(edgeTokens()).toEqual(derivedTokens());
  });
  it("matches, as nginx's case-insensitive regex of the derived tokens, exactly what isAutomationAgent matches", () => {
    const rx = new RegExp(`(${derivedTokens().join("|")})`, "iu");
    const uas = [
      "Mozilla/5.0 (X11; Linux x86_64) Lightpanda/1.0",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/130.0.0.0 Safari/537.36",
      "curl/8.5.0",
      "python-requests/2.32.3",
      "Zombie.js/6.1.4",
      "ZombieXjs/1",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "",
    ];
    for (const ua of uas) expect(ua !== "" && rx.test(ua), ua).toBe(isAutomationAgent(ua));
  });
  // cross-repo(viafrei-infra): the zone and the include are viafrei-infra's configuration
  it.skip("is limited on the card fragments only, by a zone of its own keyed by the class (verified-aware since #1205)", () => {
    const conf = readFileSync(CONF, "utf8").replace(/#[^\n]*/g, "");
    expect(conf).toMatch(/map "\$vf_auto_class:\$uri" \$vf_auto_key \{\s*default\s+"";\s*"~\^automation:\/fragment\/"\s+"automation";\s*\}/u);
    // #1205: the zone keys on `$vf_lim_auto` — the class key, empty (never limited) only for an edge-verified crawler
    // or (#1290 review) a Google/Bing crawler or an OpenAI/Perplexity assistant from its operator's published ranges
    expect(conf).toMatch(/^limit_req_zone \$vf_lim_auto zone=vf_auto:1m rate=1r\/m;$/mu);
    expect(conf).toMatch(/^map "\$vf_verified:\$vf_range_net" \$vf_lim_auto +\{ "~1" ""; default \$vf_auto_key; \}$/mu);
    const inc = readFileSync(join(dirname(CONF), "the edge shell proxy rules"), "utf8").replace(/#[^\n]*/g, "");
    expect(inc).toMatch(/^limit_req zone=vf_auto burst=3 nodelay;$/mu);
  });
});
