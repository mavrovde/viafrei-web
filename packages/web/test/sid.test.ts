/**
 * #707 — the web third of the key test: the public route `/fragment/sid` passes a SID figure on only for the
 * visitor's click, and the click script stores nothing.
 *
 *  - GET (and every other method) is a 405; a request without the click's token, or with a stale version, is a
 *    403 and the digest is NOT asked; a malformed request is a 400, not asked either;
 *  - with the token, the digest is asked once with exactly the three fields and its figures block is passed on,
 *    `private, no-store`, `noindex`; anything not shaped like the block is a 502; a digest past the deadline a 504;
 *  - the token and the digest path are the ones the ingest and digest packages define (this package may not import
 *    them at run time); the script holds no storage call and asks only `/fragment/sid`.
 */
import { SID_ACCEPT_TOKEN } from "@viafrei/ingest";
import { describe, expect, it } from "vitest";
import { SID_ROUTE as DIGEST_SID_ROUTE } from "../../digest/src/server/app.js";
import { INLINE_SCRIPTS } from "../src/lib/inline-scripts.js";
import { carriesSid, SID_ACCEPT, SID_DEADLINE_MS, SID_DIGEST_PATH, SID_JS, SID_ROUTE, sidRoute } from "../src/lib/sid.js";
import type { FetchLike } from "../src/lib/tiles.js";

const BASE = "http://digest:8791";
const FIGURES = '<div class="sid-figures"><ul class="pcard__list"><li>Rastplatz Sidfeld · 987 frei</li></ul></div>';

function digest(answer: () => Promise<Response>): { fetchImpl: FetchLike; asked: string[] } {
  const asked: string[] = [];
  const fetchImpl: FetchLike = (url) => {
    asked.push(url);
    return answer();
  };
  return { fetchImpl, asked };
}
const post = (body: unknown, type = "application/json"): Request =>
  new Request(`https://viafrei.de${SID_ROUTE}`, { method: "POST", headers: { "content-type": type }, body: typeof body === "string" ? body : JSON.stringify(body) });
const ok = (): Promise<Response> => Promise.resolve(new Response(FIGURES, { status: 200 }));

describe("#707: POST /fragment/sid", () => {
  it("the token and the digest path are the other packages' own", () => {
    expect(SID_ACCEPT).toBe(SID_ACCEPT_TOKEN);
    expect(SID_DIGEST_PATH).toBe(DIGEST_SID_ROUTE);
    expect(SID_DEADLINE_MS).toBeLessThanOrEqual(2_000);
  });

  it("GET is a 405; nothing is asked", async () => {
    const d = digest(ok);
    const r = await sidRoute(new Request(`https://viafrei.de${SID_ROUTE}?ids=1&lang=de&accept=${SID_ACCEPT}`), { baseUrl: BASE, timeoutMs: 2000, fetchImpl: d.fetchImpl });
    expect(r.status).toBe(405);
    expect(d.asked).toEqual([]);
  });

  it("without the click's token: 403, the digest not asked, no figure", async () => {
    const d = digest(ok);
    for (const accept of [undefined, "", "sid-terms-0", `${SID_ACCEPT} `, true]) {
      const r = await sidRoute(post({ ids: "4711", lang: "de", accept }), { baseUrl: BASE, timeoutMs: 2000, fetchImpl: d.fetchImpl });
      expect(r.status, String(accept)).toBe(403);
      expect(await r.text()).not.toContain("987");
    }
    expect(d.asked).toEqual([]);
  });

  it("a malformed request: 400, the digest not asked", async () => {
    const d = digest(ok);
    const many = Array.from({ length: 41 }, (_, i) => String(i + 1)).join(",");
    const bad = [
      post({ ids: "abc", lang: "de", accept: SID_ACCEPT }),
      post({ ids: "1", lang: "xx", accept: SID_ACCEPT }),
      post({ ids: many, lang: "de", accept: SID_ACCEPT }),
      post("ids=1&lang=de", "application/x-www-form-urlencoded"),
      post("{not json"),
    ];
    for (const req of bad) expect((await sidRoute(req, { baseUrl: BASE, timeoutMs: 2000, fetchImpl: d.fetchImpl })).status).toBe(400);
    expect(d.asked).toEqual([]);
  });

  it("with the token: the digest asked once with the three fields, its block passed on, never cached or indexed", async () => {
    const d = digest(ok);
    const r = await sidRoute(post({ ids: "4711,4712", lang: "pl", accept: SID_ACCEPT }), { baseUrl: BASE, timeoutMs: 5000, fetchImpl: d.fetchImpl });
    expect(r.status).toBe(200);
    expect(await r.text()).toBe(FIGURES);
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    expect(r.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(d.asked).toEqual([`${BASE}/internal/sid/occupancy?ids=4711,4712&lang=pl&accept=${SID_ACCEPT}`]);
  });

  it("a digest answer not shaped like the block, or a refusal: 502", async () => {
    const answers = [
      () => Promise.resolve(new Response("<p>x</p>", { status: 200 })),
      () => Promise.resolve(new Response("", { status: 403 })),
      () => Promise.resolve(new Response("", { status: 503 })),
    ];
    for (const a of answers) expect((await sidRoute(post({ ids: "1", lang: "de", accept: SID_ACCEPT }), { baseUrl: BASE, timeoutMs: 2000, fetchImpl: digest(a).fetchImpl })).status).toBe(502);
  });

  it("a digest past the deadline: 504 (the card's error line), well inside the two seconds", async () => {
    const slow: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    const t0 = Date.now();
    const r = await sidRoute(post({ ids: "1", lang: "de", accept: SID_ACCEPT }), { baseUrl: BASE, timeoutMs: 50, fetchImpl: slow });
    expect(r.status).toBe(504);
    expect(Date.now() - t0).toBeLessThan(1_000);
  });
});

describe("#707: the click script", () => {
  it("is shipped minified, asks only /fragment/sid, stores nothing, waits at most two seconds", () => {
    expect(INLINE_SCRIPTS.sid).toContain("/fragment/sid");
    expect(INLINE_SCRIPTS.sid).toContain("sid-figures");
    expect(SID_JS).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie|sendBeacon/);
    expect(SID_JS).toContain(`setTimeout(function () { ctl.abort(); }, ${String(SID_DEADLINE_MS)})`);
    expect(carriesSid('<div class="sid-gate" data-sid-ids="1">')).toBe(true);
    expect(carriesSid("<div>")).toBe(false);
  });
});
