/**
 * #1065: the place card's deferred fuel prices — the motorway page's pattern
 * (#716, steward M14–M22), asked on a person's VIEW of the card (owner
 * 2026-10-25: no click on place pages). The route is driven as a function of
 * the request; the digest and the MCP site door are stubs, nothing reaches a
 * provider.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { FUEL_FRAGMENT_HEADERS } from "../src/lib/fuel-fragment.js";
import { type PostLike } from "../src/lib/fuel-refresh.js";
import { resetSlugKeys } from "../src/lib/place.js";
import { FUEL_GRADE_STORE, PLACE_FUEL_FRAGMENT_ON, PLACE_FUEL_PATH, isPlaceFuelFragment, placeFuelQuery, placeFuelRoute, placeFuelScript } from "../src/lib/place-fuel.js";
import { FRAGMENT_DISALLOW, robotsTxt } from "../src/site/discovery.js";
import { AI_CRAWLERS, CORPUS_CRAWLERS, ROBOTS_CRAWLERS } from "../src/site/crawlers.js";
import { CRAWLER, CRAWLER_WORDS, crawlerPattern } from "../src/location/server.js";
import { personAsks } from "../src/lib/fuel-refresh.js";
import { MOTORWAY_FUEL_PATH, motorwayFuelRoute } from "../src/lib/motorway-fuel.js";
import { PLACE_FRAGMENT_HEADERS, placeRoute } from "../src/lib/fragment-route.js";
import { ALL } from "../src/pages/fragment/place.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const PERSON = { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0", "sec-fetch-site": "same-origin", "sec-fetch-mode": "cors", "sec-fetch-dest": "empty" };
const KEY = "ags:05315000";
const PRICED = '<div class="place-fuel"><p class="pcard__lead">Die nächsten Tankstellen</p><ul class="pcard__list"><li><strong>ARAL</strong> — Super E5 <span class="num">1,689 €/l</span></li></ul></div>';
const REFUSED = '<div class="place-fuel"><p class="pcard__note">Die Preise werden nur einer Person gezeigt, die diese Seite ansieht.</p></div>';

/** The digest: the slug's key, the sentence for `refused=1`, else the card (with the note echoed when one was passed). */
function digest(o: { body?: string } = {}) {
  const asked: string[] = [];
  const f = (u: string) => {
    asked.push(u);
    if (u.includes("/internal/place/key?slug=koeln")) return Promise.resolve({ status: 200, headers: { get: (n: string) => (n === "content-type" ? "text/html; charset=utf-8" : null) }, text: () => Promise.resolve(`<p class="place-key">${KEY}</p>`) });
    if (u.includes("/internal/place/key")) return Promise.resolve({ status: 404, headers: { get: (n: string) => (n === "content-type" ? "text/html; charset=utf-8" : null) }, text: () => Promise.resolve("<p>no</p>") });
    const note = /[?&]fuel=([a-z]+)/.exec(u)?.[1];
    const body = u.endsWith("&refused=1") ? REFUSED : (o.body ?? (note === undefined ? PRICED : `<div class="place-fuel"><p class="pcard__fresh pcard__fresh--${note}">${note}</p></div>`));
    return Promise.resolve({ status: 200, headers: { get: () => null }, text: () => Promise.resolve(body) });
  };
  return { f, asked, data: () => asked.filter((u) => u.includes("/internal/place/fuel")) };
}

/** The MCP site door: records what it is asked, answers as told. */
function mcp(answer: unknown) {
  const asked: string[] = [];
  const f: PostLike = (url, init) => {
    asked.push(`${url} ${init.body}`);
    return Promise.resolve({ status: 200, json: () => Promise.resolve(answer) });
  };
  return { f, asked };
}

const call = (path: string, headers: Record<string, string>, d = digest(), m = mcp({ state: "refreshed", settledAt: 1_761_400_000_000 }), method = "GET") =>
  placeFuelRoute(new Request(`https://viafrei.de${path}`, { method, headers }), { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: d.f, refreshUrl: "http://mcp:8788", refreshFetch: m.f }).then((res) => ({ res, d, m }));

const PATH = `${PLACE_FUEL_PATH}?place=koeln&lang=de`;

beforeEach(() => resetSlugKeys());

describe("/fragment/place-fuel (#1065, the motorway page's M16)", () => {
  it("(a) its path is under the /fragment/ prefix robots.txt disallows in every group", () => {
    expect(PLACE_FUEL_PATH).toBe("/fragment/place-fuel");
    expect(PLACE_FUEL_PATH.startsWith(FRAGMENT_DISALLOW)).toBe(true);
  });

  it("(h) the off switch is a constant, on — and the route and the page both consult it", () => {
    expect(PLACE_FUEL_FRAGMENT_ON).toBe(true);
    const lib = readFileSync(join(SRC, "lib", "place-fuel.ts"), "utf8");
    expect(lib).toContain("const person = PLACE_FUEL_FRAGMENT_ON && personAsks(");
    const block = readFileSync(join(SRC, "components", "PlaceBlock.astro"), "utf8");
    expect(block).toContain("const fuelScript = PLACE_FUEL_FRAGMENT_ON && place !== null;");
    expect(block).toContain("{fuelScript && <script is:inline set:html={placeFuelScript()} />}");
  });

  it("a person's view: the site door is asked once about the place's key, and the card is read with what it did", async () => {
    const { res, d, m } = await call(PATH, PERSON);
    expect(res.status).toBe(200);
    expect(m.asked).toEqual([`http://mcp:8788/internal/fuel/refresh {"at":"${KEY}"}`]);
    expect(d.data()).toEqual([`http://digest/internal/place/fuel?at=${encodeURIComponent(KEY)}&lang=de&fuel=refreshed&fuelAt=1761400000000`]);
    expect(await res.text()).toBe('<div class="place-fuel"><p class="pcard__fresh pcard__fresh--refreshed">refreshed</p></div>');
  });

  it("#712: a pending ask is wrapped to be re-read about when the queue sends it", async () => {
    const { res } = await call(PATH, PERSON, digest(), mcp({ state: "pending", settledAt: null, queue: { position: 2, etaMs: 118_000 } }));
    expect(await res.text()).toBe('<div class="place-fuel" data-vf-refill="119500" data-vf-polls="1" data-vf-head="0"><p class="pcard__fresh pcard__fresh--pending">pending</p></div>');
  });

  it("held=1 (the home's automatic reload): the held prices, and nothing is asked", async () => {
    const { res, d, m } = await call(`${PATH}&held=1`, PERSON);
    expect(m.asked).toEqual([]);
    expect(d.data()).toEqual([`http://digest/internal/place/fuel?at=${encodeURIComponent(KEY)}&lang=de`]);
    expect(await res.text()).toBe(PRICED);
  });

  // (c) the D4 gate, one case at a time: the sentence, no data read, nothing asked
  const REFUSALS: readonly [string, Record<string, string>, string?][] = [
    ["a crawler's user agent", { ...PERSON, "user-agent": "Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)" }],
    ["ClaudeBot", { ...PERSON, "user-agent": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)" }],
    ["no user agent", { ...PERSON, "user-agent": "" }],
    ["a HEAD", PERSON, "HEAD"],
    ["a prefetch", { ...PERSON, "sec-purpose": "prefetch" }],
    ["a prerender", { ...PERSON, "sec-purpose": "prefetch;prerender" }],
    ["a cross-origin fetch", { ...PERSON, "sec-fetch-site": "cross-site" }],
    ["a same-site (not same-origin) fetch", { ...PERSON, "sec-fetch-site": "same-site" }],
    ["a navigation to the fragment", { ...PERSON, "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" }],
    ["no Fetch Metadata at all (curl)", { "user-agent": PERSON["user-agent"] }],
  ];
  for (const [what, headers, method] of REFUSALS) {
    it(`(c) ${what}: the sentence and no data, nothing asked`, async () => {
      const { res, d, m } = await call(PATH, headers, digest(), undefined, method ?? "GET");
      expect(res.status).toBe(200);
      for (const [k, v] of Object.entries(FUEL_FRAGMENT_HEADERS)) expect(res.headers.get(k), k).toBe(v);
      expect(await res.text()).toBe(REFUSED);
      expect(d.data()).toEqual([`http://digest/internal/place/fuel?at=${encodeURIComponent(KEY)}&lang=de&refused=1`]);
      expect(m.asked).toEqual([]);
    });
  }

  it("(b) every answer carries private, no-store and the full X-Robots-Tag — a person's, a refusal, a 404 and a 502 too", async () => {
    const cases = [
      (await call(PATH, PERSON)).res,
      (await call(PATH, { "user-agent": "Googlebot/2.1" })).res,
      (await call(`${PLACE_FUEL_PATH}?place=nowhere-at-all&lang=de`, PERSON)).res,
      (await call(`${PLACE_FUEL_PATH}?place=Koeln&lang=de`, PERSON)).res,
      (await call(`${PLACE_FUEL_PATH}?place=koeln&lang=xx`, PERSON)).res,
      (await call(PATH, PERSON, digest({ body: '{"price":1.689}' }))).res,
    ];
    expect(cases.map((r) => r.status)).toEqual([200, 200, 404, 404, 404, 502]);
    for (const r of cases) for (const [k, v] of Object.entries(FUEL_FRAGMENT_HEADERS)) expect(r.headers.get(k), k).toBe(v);
  });

  it("(f) HTML of the one shape only — the card's root or the empty root; no JSON, no script, no image", () => {
    expect(isPlaceFuelFragment(PRICED)).toBe(true);
    expect(isPlaceFuelFragment('<div class="place-fuel place-fuel--none"></div>')).toBe(true);
    for (const b of ['{"a":1}', '<div class="place-fuel"><script>x</script></div>', '<div class="place-fuel"><img src=x></div>', '<div class="motorway-fuel"></div>', "<p>x</p>"]) expect(isPlaceFuelFragment(b), b).toBe(false);
    expect(placeFuelQuery(new URL("https://viafrei.de/fragment/place-fuel?place=koeln&lang=de"))).toEqual({ slug: "koeln", lang: "de", held: false, page: "", grade: "", not: "" });
    expect(placeFuelQuery(new URL("https://viafrei.de/fragment/place-fuel?place=ags:05315000&lang=de"))).toBeNull();
  });

  it("(d) the script asks only from the card's view — an IntersectionObserver, a visible and not prerendering page — never a prefetch, a click or analytics", () => {
    const s = placeFuelScript();
    expect(s.match(/fetch\(/g)).toHaveLength(1);
    expect(s).toContain("new IntersectionObserver(");
    expect(s).toContain("document.prerendering!==true");
    expect(s).toContain("document.hidden!==true");
    // the first load waits for `shown()` before anything is fetched
    expect(s.indexOf('await shown();if(l){l.hidden=false;l.style.visibility=""}try{await load(0,0)')).toBeGreaterThan(0);
    expect(s).not.toMatch(/prefetch|prerender(?!ing)|speculationrules|gtag|dataLayer|\.click\(\)|dispatchEvent|DOMContentLoaded|onload/);
    // #1116 AC4: the one click listener is the fuel grade switch's, on the card's own box — never one that starts the first load
    expect(s.match(/addEventListener\("click"/g)).toHaveLength(1);
    expect(s).toContain('o.addEventListener("click",e=>{const b=e.target&&e.target.closest?e.target.closest("button.fuelg__opt"):null;');
    expect(s).toContain(JSON.stringify(PLACE_FUEL_PATH));
    // the place comes from the cards' own page link, never from the visitor's position
    expect(s).toContain('querySelector("a.place__page")');
  });
});

describe("/fragment/place-fuel as the fuel card's pager (#1061)", () => {
  const PAGED = '<div class="place-fuel"><ul class="pcard__list"><li>Tanke13x</li></ul></div>';
  const stub = (status: number, body = "") => {
    const asked: string[] = [];
    const f = (u: string) => {
      asked.push(u);
      if (u.includes("/internal/place/key?slug=koeln")) return Promise.resolve({ status: 200, headers: { get: (n: string) => (n === "content-type" ? "text/html; charset=utf-8" : null) }, text: () => Promise.resolve(`<p class="place-key">${KEY}</p>`) });
      return Promise.resolve({ status, headers: { get: () => null }, text: () => Promise.resolve(body) });
    };
    return { f, asked, data: () => asked.filter((u) => u.includes("/internal/place/fuel")) };
  };
  it("from and v reach the digest; a pager's page asks the site door nothing and is never refilled; a bad from is the start", async () => {
    const d = stub(200, PAGED);
    const m = mcp({ state: "refreshed", settledAt: 1 });
    const { res } = await call(`${PATH}&held=1&from=13&v=4242`, PERSON, d, m);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(PAGED);
    expect(d.data()[0]).toContain("&from=13&v=4242");
    expect(m.asked).toEqual([]);
    expect(placeFuelQuery(new URL(`https://viafrei.de${PATH}&from=-3`))?.page).toBe("&from=1");
    expect(placeFuelQuery(new URL(`https://viafrei.de${PATH}&from=13`))?.held).toBe(true);
  });
  it("a list that moved is 409 (the pager reloads); another answer is 502; the D4 gate still holds", async () => {
    expect((await call(`${PATH}&held=1&from=13&v=1`, PERSON, stub(409) as never)).res.status).toBe(409);
    expect((await call(`${PATH}&held=1&from=13&v=1`, PERSON, stub(200, "<p>x</p>") as never)).res.status).toBe(502);
    const crawler = await call(`${PATH}&held=1&from=13&v=1`, { "user-agent": "Googlebot/2.1" });
    expect(await crawler.res.text()).toBe(REFUSED);
  });
});

/**
 * #1065 steward C1 / PF3: the gate knows every crawler robots.txt names. The
 * generic words (`bot`, `crawl`, …) missed `meta-externalagent`, `omgili`,
 * `GoogleOther` and `Webzio-Extended`; the pattern is now derived from the
 * lists. Each token rides in a browser-shaped user agent with no generic word
 * of its own, so only the token can refuse it.
 */
describe("C1: every crawler robots.txt names a group for is refused by the gate", () => {
  const ua = (token: string): string => `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 ${token}/1.0`;
  // #1065 review B3: the tokens are read off the real robots.txt, every `User-agent:` line but `*` — the SEO tools and
  // the paced crawlers included (barkrowler and meta-webindexer carry no generic word and were let through)
  const tokens = robotsTxt()
    .split("\n")
    .filter((l) => l.startsWith("User-agent: "))
    .map((l) => l.slice("User-agent: ".length).trim())
    .filter((t) => t !== "*");
  it("the lists are the ones robots.txt names, and the browser-shaped UA alone is a person", () => {
    expect(AI_CRAWLERS.length).toBeGreaterThanOrEqual(30);
    expect(CORPUS_CRAWLERS).toHaveLength(21); // #1077: MistralAI-Training
    expect(tokens).toEqual(expect.arrayContaining(["barkrowler", "meta-webindexer", "MJ12bot", ...CORPUS_CRAWLERS]));
    expect([...tokens].sort()).toEqual([...ROBOTS_CRAWLERS].sort());
    expect(personAsks({ method: "GET", headers: new Headers({ ...PERSON, "user-agent": ua("").replace(/ \/1\.0$/, "") }) }, "fragment")).toBe(true);
  });
  for (const token of tokens) {
    it(`${token}: the sentence, no data read, nothing asked — on the place card's fragment and the motorway layer's`, async () => {
      expect(CRAWLER.test(ua(token)), token).toBe(true);
      expect(CRAWLER.test(ua(token.toLowerCase())), `${token}, lower case`).toBe(true);
      const { res, d, m } = await call(PATH, { ...PERSON, "user-agent": ua(token) });
      expect(await res.text()).toBe(REFUSED);
      expect(d.data()).toEqual([`http://digest/internal/place/fuel?at=${encodeURIComponent(KEY)}&lang=de&refused=1`]);
      expect(m.asked).toEqual([]);
      const asked: string[] = [];
      const mw = await motorwayFuelRoute(new Request(`https://viafrei.de${MOTORWAY_FUEL_PATH}?road=A7&lang=de`, { headers: { ...PERSON, "user-agent": ua(token) } }), {
        baseUrl: "http://digest",
        timeoutMs: 500,
        fetchImpl: (u) => {
          asked.push(u);
          return Promise.resolve({ status: 200, headers: { get: () => null }, text: () => Promise.resolve('<div class="motorway-fuel"><p>x</p></div>') });
        },
      });
      expect(mw.status).toBe(200);
      expect(asked).toEqual(["http://digest/internal/motorway/A7/fuel?lang=de&refused=1"]);
    });
  }
  it("the mutant: a list missing one token lets that crawler through — so the loop above can fail", () => {
    // the tokens only the list catches (no generic word in them): the four the words missed, at least
    const listOnly = tokens.filter((t) => !CRAWLER_WORDS.test(t));
    for (const t of ["meta-externalagent", "omgili", "GoogleOther", "Webzio-Extended", "barkrowler", "meta-webindexer"]) expect(listOnly, t).toContain(t);
    for (const t of listOnly) {
      const mutant = crawlerPattern(ROBOTS_CRAWLERS.filter((x) => x !== t));
      expect(mutant.test(ua(t)), `${t} dropped from the list`).toBe(false);
      expect(CRAWLER.test(ua(t)), t).toBe(true);
    }
  });
});

/** The cards' digest for `/fragment/place`: records every read; the key lookup can be told to fail (503). */
function cardsDigest(keyStatus = 200) {
  const asked: string[] = [];
  const f = (u: string) => {
    asked.push(u);
    if (u.includes("/internal/place/key?slug=")) {
      const known = u.endsWith("slug=koeln");
      const st = keyStatus !== 200 ? keyStatus : known ? 200 : 404;
      return Promise.resolve({ status: st, headers: { get: (n: string) => (n === "content-type" ? "text/html; charset=utf-8" : null) }, text: () => Promise.resolve(st === 200 ? `<p class="place-key">${KEY}</p>` : "") });
    }
    return Promise.resolve({
      status: 200,
      headers: { get: (n: string) => ({ "content-type": "text/html; charset=utf-8", "place-key": KEY, "place-label": encodeURIComponent("Köln"), "place-point": "0" })[n] ?? null },
      text: () => Promise.resolve('<section class="place" id="place-cards"><h2>Köln</h2></section>'),
    });
  };
  return { f, asked, cards: () => asked.filter((u) => u.includes("/internal/place/cards")) };
}

const placeCall = (headers: Record<string, string>, body: Record<string, unknown> = { at: KEY, lang: "de", how: "page" }, d = cardsDigest(), m = mcp({ state: "refreshed", settledAt: 1_761_400_000_000 }), method = "POST") =>
  placeRoute(new Request("https://viafrei.de/fragment/place", { method, headers: { "content-type": "application/json", ...headers }, ...(method === "POST" ? { body: JSON.stringify(body) } : {}) }), {
    baseUrl: "http://digest",
    timeoutMs: 500,
    fetchImpl: d.f,
    refreshUrl: "http://mcp:8788",
    refreshFetch: m.f,
  }).then((res) => ({ res, d, m }));

const PLACE_HEADERS = { "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow, noarchive, nosnippet" };
const expectPlaceHeaders = (res: Response) => {
  expect(res.headers.get("cache-control")).toBe(PLACE_HEADERS["cache-control"]);
  expect(res.headers.get("x-robots-tag")).toBe(PLACE_HEADERS["x-robots-tag"]);
};

describe("C2: /fragment/place shows the fuel card's rows to a person's script only, and carries the fuel fragments' headers", () => {
  it("the headers are the fuel fragments' own private, no-store and the full X-Robots-Tag", () => {
    expect(PLACE_FRAGMENT_HEADERS).toEqual(PLACE_HEADERS);
    expect(FUEL_FRAGMENT_HEADERS).toEqual({ "content-type": "text/html; charset=utf-8", ...PLACE_HEADERS });
  });

  it("a person's POST: the full cards (no fuelRows=0), the refresh asked, the headers on the 200", async () => {
    const { res, d, m } = await placeCall(PERSON, { at: KEY, lang: "de", how: "page" });
    expect(res.status).toBe(200);
    expectPlaceHeaders(res);
    expect(d.cards()).toHaveLength(1);
    expect(d.cards()[0]).not.toContain("fuelRows=0");
    expect(m.asked).toEqual([`http://mcp:8788/internal/fuel/refresh {"at":"${KEY}"}`]);
  });

  it("the home's held reload from a person: no refresh asked, and the prices still shown (personAsks, not fragmentAsks)", async () => {
    const { res, d, m } = await placeCall(PERSON, { at: KEY, lang: "de", how: "held" });
    expect(res.status).toBe(200);
    expectPlaceHeaders(res);
    expect(m.asked).toEqual([]);
    expect(d.cards()).toHaveLength(1);
    expect(d.cards()[0]).not.toContain("fuelRows=0");
  });

  const deferred: readonly (readonly [string, Record<string, string>])[] = [
    ["a crawler UA with a same-origin Fetch-Metadata", { ...PERSON, "user-agent": "Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)" }],
    ["a corpus crawler token in a browser UA", { ...PERSON, "user-agent": `${PERSON["user-agent"]} meta-externalagent/1.1` }],
    ["a cross-site POST", { ...PERSON, "sec-fetch-site": "cross-site" }],
    ["a POST with no Fetch-Metadata", { "user-agent": PERSON["user-agent"] }],
    ["a prefetch", { ...PERSON, "sec-purpose": "prefetch" }],
    ["a prerender", { ...PERSON, "sec-purpose": "prefetch;prerender" }],
    ["an empty UA", { ...PERSON, "user-agent": "" }],
  ];
  for (const [what, headers] of deferred) {
    it(`${what}: the cards with the fuel card as its frame (fuelRows=0), no refresh asked, the headers on the 200`, async () => {
      const { res, d, m } = await placeCall(headers);
      expect(res.status).toBe(200);
      expectPlaceHeaders(res);
      expect(m.asked).toEqual([]);
      expect(d.cards()).toEqual([`http://digest/internal/place/cards?at=${encodeURIComponent(KEY)}&lang=de&fuelRows=0`]);
    });
  }

  it("a HEAD (and any method but POST): 405 with the headers, nothing read", async () => {
    for (const method of ["HEAD", "GET"]) {
      const { res, d, m } = await placeCall(PERSON, {}, cardsDigest(), undefined, method);
      expect(res.status).toBe(405);
      expectPlaceHeaders(res);
      expect(d.asked).toEqual([]);
      expect(m.asked).toEqual([]);
    }
  });

  it("the 4xx and the 5xx carry the headers too: a bad body (400), an unknown slug (404), a key lookup the digest failed (503)", async () => {
    const bad = await placeCall(PERSON, { at: KEY, lang: "xx" });
    expect(bad.res.status).toBe(400);
    expectPlaceHeaders(bad.res);
    const missing = await placeCall(PERSON, { at: "slug:nirgendwo", lang: "de" });
    expect(missing.res.status).toBe(404);
    expectPlaceHeaders(missing.res);
    const failed = await placeCall(PERSON, { at: "slug:koeln", lang: "de" }, cardsDigest(500));
    expect(failed.res.status).toBe(503);
    expectPlaceHeaders(failed.res);
  });

  it("the page's ALL handler answers its 405 with the headers and Allow: POST", () => {
    const res = (ALL as unknown as () => Response)();
    expect(res.status).toBe(405);
    expectPlaceHeaders(res);
    expect(res.headers.get("allow")).toBe("POST");
  });
});

/**
 * #1116 AC4: the fuel grade switch. The page's script runs here against a stand-in DOM: the first load asks the prices
 * with no grade and writes nothing; a click on a grade keeps it (the one write, click-only) and re-reads the prices in
 * that order, held (no refresh asked); the next view asks with the kept grade. The route forwards the grade by its
 * shape only.
 */
describe("the fuel grade switch (#1116 AC4)", () => {
  type Listener = (e: { target: unknown }) => void;
  const page = (stored: string | null) => {
    const fetched: string[] = [];
    const writes: [string, string][] = [];
    const clicks: Listener[] = [];
    const node = (extra: Record<string, unknown> = {}) => ({ hidden: true, style: { visibility: "" }, ...extra });
    const out = {
      innerHTML: "",
      firstElementChild: null as unknown,
      isConnected: true,
      querySelector: () => null,
      addEventListener: (type: string, f: Listener) => {
        if (type === "click") clicks.push(f);
      },
    };
    const card = node();
    const slot = {
      querySelector: (sel: string) => (sel === ".pcard__fuelout" ? out : node()),
      closest: (sel: string) => (sel === ".place" ? { querySelector: () => ({ getAttribute: () => "/de/place/koeln" }) } : card),
    };
    const document = { hidden: false, prerendering: false, querySelectorAll: () => [slot], addEventListener: () => undefined, removeEventListener: () => undefined };
    const fetchStub = (u: string) => {
      fetched.push(u);
      return Promise.resolve({ ok: true, text: () => Promise.resolve('<div class="place-fuel">x</div>') });
    };
    const storage = { getItem: (k: string) => (k === FUEL_GRADE_STORE ? stored : null), setItem: (k: string, v: string) => void writes.push([k, v]) };
    // eslint-disable-next-line @typescript-eslint/no-implied-eval -- running the shipped script is the point
    const run = new Function("document", "fetch", "localStorage", "location", "IntersectionObserver", "setTimeout", placeFuelScript()) as (...a: unknown[]) => void;
    run(document, fetchStub, storage, { search: "" }, undefined, () => 0);
    const settle = () => new Promise((r) => setTimeout(r, 0));
    const click = async (value: string) => {
      for (const f of clicks) f({ target: { closest: (sel: string) => (sel === "button.fuelg__opt" ? { value } : null) } });
      await settle();
    };
    return { fetched, writes, click, settle, clicks };
  };

  it("the first view asks with no grade and keeps nothing; a click keeps the grade and re-reads the prices in its order, held", async () => {
    const p = page(null);
    await p.settle();
    expect(p.fetched).toHaveLength(1);
    expect(p.fetched[0]).not.toContain("grade=");
    expect(p.fetched[0]).not.toContain("held=1");
    expect(p.writes).toEqual([]);
    await p.click("diesel");
    expect(p.writes).toEqual([[FUEL_GRADE_STORE, "diesel"]]);
    expect(p.fetched).toHaveLength(2);
    expect(p.fetched[1]).toContain("grade=diesel");
    expect(p.fetched[1]).toContain("held=1");
  });

  it("a kept grade is asked on the next view, without a write; a value that is not a grade code is no click at all", async () => {
    const p = page("e10");
    await p.settle();
    expect(p.fetched[0]).toContain("grade=e10");
    expect(p.writes).toEqual([]);
    await p.click("e10\"><x");
    expect(p.writes).toEqual([]);
    expect(p.fetched).toHaveLength(1);
  });

  it("the route forwards the grade to the digest by its shape, and drops anything else", async () => {
    const good = await call(`${PATH}&grade=e10`, PERSON);
    expect(good.d.data()[0]).toContain("&grade=e10");
    const bad = await call(`${PATH}&grade=E10%3Cx`, PERSON);
    expect(bad.d.data()[0]).not.toContain("grade=");
    expect(placeFuelQuery(new URL(`https://viafrei.de${PATH}&grade=diesel&held=1&from=13&v=4`))).toMatchObject({ grade: "&grade=diesel", page: "&from=13&v=4" });
  });
});

/**
 * #1222: what `/fragment/place-fuel` answers, one meaning per status — the table in `src/lib/place-fuel.ts`'s header.
 * The edge's own answers (a 429 from `vf_auto` or the per-address zone) never reach this route, so they are asserted
 * on `the edge configuration`; a 403 is answered by nobody since the interim hand edit of 2026-11-08 was retired.
 */
describe("#1222: one meaning per answer of /fragment/place-fuel", () => {
  it("an incomplete request (no place, no language, a slug of the wrong shape) is 404, final: nothing is read, nothing asked", async () => {
    for (const path of [PLACE_FUEL_PATH, `${PLACE_FUEL_PATH}?lang=de`, `${PLACE_FUEL_PATH}?place=koeln`, `${PLACE_FUEL_PATH}?place=K%C3%B6ln&lang=de`]) {
      const { res, d, m } = await call(path, PERSON);
      expect(res.status, path).toBe(404);
      expect(await res.text(), path).toBe("");
      expect(d.asked, path).toEqual([]);
      expect(m.asked, path).toEqual([]);
    }
  });

  it("a well-formed slug that is no place is 404 too, after one key lookup and no data read", async () => {
    const { res, d, m } = await call(`${PLACE_FUEL_PATH}?place=nowhere-at-all&lang=de`, PERSON);
    expect(res.status).toBe(404);
    expect(d.data()).toEqual([]);
    expect(m.asked).toEqual([]);
  });

  it("a declared automation agent that got past the edge's limit is 200 with the sentence: no prices, nothing asked", async () => {
    const { res, d, m } = await call(PATH, { ...PERSON, "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Lightpanda/1.0" });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(REFUSED);
    expect(d.data()).toEqual([`http://digest/internal/place/fuel?at=${encodeURIComponent(KEY)}&lang=de&refused=1`]);
    expect(m.asked).toEqual([]);
  });

  it("a spent budget is 200 with the held prices said as such (paused), final: asked once, never re-read", async () => {
    const { res, d, m } = await call(PATH, PERSON, digest(), mcp({ state: "paused" }));
    expect(res.status).toBe(200);
    expect(m.asked).toHaveLength(1);
    expect(d.data()).toEqual([`http://digest/internal/place/fuel?at=${encodeURIComponent(KEY)}&lang=de&fuel=paused`]);
    const body = await res.text();
    expect(body).toContain("pcard__fresh--paused");
    expect(body).not.toContain("data-vf-refill");
  });

  it("no code path of the route answers 403, and the edge answers none on it: a refusal there is a 429 with its zone in the error log", () => {
    for (const f of ["lib/place-fuel.ts", "lib/fuel-fragment.ts", "pages/fragment/place-fuel.ts"]) expect(readFileSync(join(SRC, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""), f).not.toMatch(/\b403\b/);
    const conf = readFileSync(join(SRC, "..", "..", "..", "infra", "the edge configuration"), "utf8")
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("#"))
      .join("\n");
    expect(conf).not.toMatch(/return\s+403/);
    expect(conf).toMatch(/^limit_req_status 429;$/m);
    expect(conf).toContain('"~^automation:/fragment/" "automation";');
  });
});
