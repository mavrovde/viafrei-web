/**
 * #1113 (prod check 2026-11-02: "/de/autobahn shows nothing of a remembered place"): the motorway index applies the
 * visitor's remembered choice like a road page. The script (`NEAR_JS`, run here minified, as the page runs it) reads
 * `viafrei.place` and writes NOTHING: a remembered place asks `/fragment/motorway-near` and fills the slot; a
 * remembered "Ganz Deutschland", nothing remembered, an entry twelve months old or a malformed key ask nothing (the
 * index is the whole country); a shared `?scope=de` or `?at=` wins over the remembered choice without changing it. The
 * route forwards only an `ags:`/`pt:` key (a `slug:` turned into its `ags:`), behind the road pages' switch, no-store.
 */
import { describe, expect, it } from "vitest";
import { INLINE_SCRIPTS } from "../src/lib/inline-scripts.js";
import { MOTORWAY_NEAR_OPEN, MOTORWAY_NEAR_ROUTE, MOTORWAY_NEAR_SLOT, motorwayNearRoute, motorwayNearScript } from "../src/lib/motorway-near.js";

const BLOCK = '<section class="motorway-near" id="motorway-near" aria-label="x"><h2 class="motorway__h2">x</h2></section>';
const thisMonth = ((d: Date) => d.getUTCFullYear() * 12 + d.getUTCMonth())(new Date());

type Run = { readonly asked: { url: string; body: Record<string, unknown> }[]; readonly writes: string[]; readonly slot: { innerHTML: string; hidden: boolean } };

/** Runs the page's script over a fake page: storage holding `stored` (the raw `viafrei.place` text), the address `search`. */
async function run(stored: unknown, search = "", answer = BLOCK): Promise<Run> {
  const asked: Run["asked"] = [];
  const writes: string[] = [];
  const slot = { innerHTML: "", hidden: true, removeAttribute: (n: string) => (n === "hidden" ? (slot.hidden = false) : undefined) };
  const document = { getElementById: (id: string) => (id === MOTORWAY_NEAR_SLOT ? slot : null) };
  const localStorage = {
    getItem: (k: string) => (k === "viafrei.place" && stored !== undefined ? JSON.stringify(stored) : null),
    setItem: (k: string) => void writes.push(`set ${k}`),
    removeItem: (k: string) => void writes.push(`del ${k}`),
  };
  const fetch = (url: string, init: { body: string }) => {
    asked.push({ url, body: JSON.parse(init.body) as Record<string, unknown> });
    return Promise.resolve({ status: 200, text: () => Promise.resolve(answer) });
  };
  const location = { search };
  const call = motorwayNearScript("de");
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- the page's own script text, run over fakes
  const page = new Function("document", "localStorage", "fetch", "location", call) as (...a: unknown[]) => void;
  page(document, localStorage, fetch, location);
  for (let i = 0; i < 5; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
  return { asked, writes, slot };
}

describe("the motorway index's remembered-place script (#1113)", () => {
  it("is the minified source the page carries, called with its language", () => {
    // #1182: the near script is shared with the station index, so the page names its slot, route and answer's opening
    expect(motorwayNearScript("en")).toBe(`(${INLINE_SCRIPTS.near})(${JSON.stringify({ lang: "en", slot: MOTORWAY_NEAR_SLOT, route: MOTORWAY_NEAR_ROUTE, shape: MOTORWAY_NEAR_OPEN })});`);
    expect(INLINE_SCRIPTS.near).toContain("viafrei.place");
    expect(motorwayNearScript("en")).toContain(MOTORWAY_NEAR_ROUTE);
  });

  it("a remembered place (a pick or a browser cell): the block around it fills the slot, and nothing is written", async () => {
    for (const s of [{ at: "ags:09184132", label: "Neuried", how: "manual", m: thisMonth }, { at: "pt:51.315,9.4875", label: "Kassel", how: "browser", m: thisMonth }]) {
      const r = await run(s);
      expect(r.asked, s.how).toEqual([{ url: MOTORWAY_NEAR_ROUTE, body: { at: s.at, lang: "de" } }]);
      expect(r.slot.innerHTML).toBe(BLOCK);
      expect(r.slot.hidden).toBe(false);
      expect(r.writes).toEqual([]);
    }
  });

  it("a remembered Ganz Deutschland asks nothing: the index is the whole country's (and its place to go back to is not shown)", async () => {
    const r = await run({ at: null, label: "", how: "germany", back: { at: "ags:09184132", label: "Neuried", how: "manual" }, m: thisMonth });
    expect(r.asked).toEqual([]);
    expect(r.slot.hidden).toBe(true);
    expect(r.writes).toEqual([]);
  });

  it("nothing remembered, an entry twelve months old, a malformed key, an IP guess: nothing asked, nothing written", async () => {
    for (const s of [undefined, { at: "ags:09184132", label: "x", how: "manual", m: thisMonth - 12 }, { at: "pt:51.31234,9.48761,1", label: "x", how: "browser" }, { at: "ags:09184132", label: "x", how: "ip" }]) {
      const r = await run(s);
      expect(r.asked, JSON.stringify(s)).toEqual([]);
      expect(r.writes).toEqual([]);
    }
  });

  it("a shared address wins without changing what is kept: ?scope=de shows the country, ?at= that place", async () => {
    const kept = { at: "ags:09184132", label: "Neuried", how: "manual", m: thisMonth };
    const de = await run(kept, "?scope=de");
    expect(de.asked).toEqual([]);
    expect(de.writes).toEqual([]);
    const at = await run(kept, "?q=&at=slug:koeln");
    expect(at.asked).toEqual([{ url: MOTORWAY_NEAR_ROUTE, body: { at: "slug:koeln", lang: "de" } }]);
    expect(at.writes).toEqual([]);
  });

  it("an answer that is not the block is not put into the page", async () => {
    const r = await run({ at: "ags:09184132", label: "Neuried", how: "manual", m: thisMonth }, "", "<script>x</script>");
    expect(r.slot.innerHTML).toBe("");
    expect(r.slot.hidden).toBe(true);
  });
});

describe("POST /fragment/motorway-near (#1113)", () => {
  const post = (body: unknown): Request => new Request("http://shell/fragment/motorway-near", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const digest = (seen: string[], status = 200, html = BLOCK) => ({
    baseUrl: "http://digest",
    timeoutMs: 1000,
    fetchImpl: (url: string) => {
      seen.push(url);
      const slug = /\/internal\/place\/key\?slug=koeln$/.test(url);
      return Promise.resolve(new Response(slug ? '<p class="place-key">ags:05315000</p>' : html, { status: slug ? 200 : status, headers: { "content-type": "text/html" } }));
    },
  });

  it("is off with the road pages' position switch: 404, nothing asked", async () => {
    const seen: string[] = [];
    expect((await motorwayNearRoute(post({ at: "ags:09184132", lang: "de" }), digest(seen), false)).status).toBe(404);
    expect(seen).toEqual([]);
  });

  it("forwards an ags:/pt: key with the default radius, a slug: as its ags:, and answers no-store", async () => {
    const seen: string[] = [];
    const r = await motorwayNearRoute(post({ at: "pt:51.315,9.4875", lang: "en" }), digest(seen), true);
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await r.text()).toBe(BLOCK);
    expect(seen).toEqual(["http://digest/internal/motorway/near?at=pt%3A51.315%2C9.4875&r=25&lang=en"]);
    const s2: string[] = [];
    expect((await motorwayNearRoute(post({ at: "slug:koeln", lang: "de" }), digest(s2), true)).status).toBe(200);
    expect(s2[1]).toBe("http://digest/internal/motorway/near?at=ags%3A05315000&r=25&lang=de");
  });

  it("refuses another key, a bad language, a GET; passes the digest's 404 on", async () => {
    const seen: string[] = [];
    expect((await motorwayNearRoute(post({ at: "dst:123", lang: "de" }), digest(seen), true)).status).toBe(400);
    expect((await motorwayNearRoute(post({ at: "ags:09184132", lang: "xx" }), digest(seen), true)).status).toBe(400);
    expect((await motorwayNearRoute(new Request("http://shell/fragment/motorway-near"), digest(seen), true)).status).toBe(405);
    expect(seen).toEqual([]);
    expect((await motorwayNearRoute(post({ at: "ags:01001000", lang: "de" }), digest(seen, 404, "<p>no such place</p>"), true)).status).toBe(404);
  });
});
