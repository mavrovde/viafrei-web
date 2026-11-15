/**
 * #1221 item 6: a client that DECLARES automation in its user agent never
 * starts an on-demand provider request. On 2026-11-07/08 `Lightpanda/1.0`
 * fetched `/fragment/place-fuel` with a browser's fetch headers for 17 hours and
 * took the Tankerkönig key at 53-60 requests an hour, while an assistant's
 * question got none. The list is ONE (`site/crawlers.ts` `AUTOMATION_AGENTS`);
 * the gate it feeds is the person check every fragment route already uses
 * (`personAsks`). The route is driven as a function of the request; the digest
 * and the MCP site door are stubs, nothing reaches a provider.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { AUTOMATION_AGENTS, isAutomationAgent } from "../src/site/crawlers.js";
import { personAsks, type PostLike } from "../src/lib/fuel-refresh.js";
import { resetSlugKeys } from "../src/lib/place.js";
import { PLACE_FUEL_PATH, placeFuelRoute } from "../src/lib/place-fuel.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const FETCH = { "sec-fetch-site": "same-origin", "sec-fetch-mode": "cors", "sec-fetch-dest": "empty" };
const KEY = "ags:05315000";
const PERSON_UAS = [
  "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
  "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
];
const AUTOMATION_UAS = [
  "Lightpanda/1.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/130.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Unknown; Linux x86_64) AppleWebKit/538.1 (KHTML, like Gecko) PhantomJS/2.1.1 Safari/538.1",
  "Mozilla/5.0 (darwin) AppleWebKit/537.36 (KHTML, like Gecko) jsdom/24.0.0",
  "python-requests/2.32.3",
  "curl/8.7.1",
];

function digest() {
  const asked: string[] = [];
  const f = (u: string) => {
    asked.push(u);
    if (u.includes("/internal/place/key?slug=koeln")) return Promise.resolve({ status: 200, headers: { get: (n: string) => (n === "content-type" ? "text/html; charset=utf-8" : null) }, text: () => Promise.resolve(`<p class="place-key">${KEY}</p>`) });
    return Promise.resolve({ status: 200, headers: { get: () => null }, text: () => Promise.resolve('<div class="place-fuel"><p>held</p></div>') });
  };
  return { f, asked };
}
function mcp() {
  const asked: string[] = [];
  const f: PostLike = (url, init) => {
    asked.push(`${url} ${init.body}`);
    return Promise.resolve({ status: 200, json: () => Promise.resolve({ state: "refreshed", settledAt: 1_761_400_000_000 }) });
  };
  return { f, asked };
}
const call = (ua: string) => {
  const d = digest();
  const m = mcp();
  return placeFuelRoute(new Request(`https://viafrei.de${PLACE_FUEL_PATH}?place=koeln&lang=de`, { headers: { "user-agent": ua, ...FETCH } }), {
    baseUrl: "http://digest",
    timeoutMs: 500,
    fetchImpl: d.f,
    refreshUrl: "http://mcp:8788",
    refreshFetch: m.f,
  }).then((res) => ({ res, d, m }));
};

beforeEach(() => resetSlugKeys());

describe("#1221: a client that declares automation starts no provider request", () => {
  it("the list names Lightpanda and HeadlessChrome, and every marker is matched", () => {
    expect(AUTOMATION_AGENTS.map((a) => a.token)).toContain("Lightpanda");
    expect(AUTOMATION_AGENTS.map((a) => a.token)).toContain("HeadlessChrome");
    for (const { token: t } of AUTOMATION_AGENTS) expect(isAutomationAgent(`x ${t.toLowerCase()} y`), t).toBe(true);
  });

  it("no browser a person uses carries a marker", () => {
    for (const ua of PERSON_UAS) expect(isAutomationAgent(ua), ua).toBe(false);
  });

  it("each automation user agent is not a person to the fragment gate, with a browser's fetch headers", () => {
    for (const ua of AUTOMATION_UAS) {
      expect(isAutomationAgent(ua), ua).toBe(true);
      expect(personAsks({ method: "GET", headers: new Headers({ "user-agent": ua, ...FETCH }), url: "https://viafrei.de/fragment/place-fuel" }, "fragment"), ua).toBe(false);
    }
  });

  it("Lightpanda on /fragment/place-fuel: no refresh is asked of the MCP site door, the held card is served", async () => {
    const { res, m, d } = await call("Lightpanda/1.0");
    expect(res.status).toBe(200);
    expect(m.asked).toEqual([]);
    expect(d.asked.some((u) => u.includes("/internal/place/fuel"))).toBe(true);
  });

  it("a person on the same route still refreshes, once", async () => {
    const { res, m } = await call(PERSON_UAS[0]!);
    expect(res.status).toBe(200);
    expect(m.asked).toEqual([`http://mcp:8788/internal/fuel/refresh {"at":"${KEY}"}`]);
  });

  it("the person check consults the list (one list, no second copy in the web package)", () => {
    const src = readFileSync(join(SRC, "lib", "fuel-refresh.ts"), "utf8");
    expect(src).toContain("isAutomationAgent(ua)");
    expect(src).toContain('from "../site/crawlers.js"');
  });
});
