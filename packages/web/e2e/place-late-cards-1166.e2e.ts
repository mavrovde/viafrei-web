/**
 * #1166 against the REAL built shell, at the production deadline (`WEB_PLACE_TIMEOUT_MS` unset: 2 000 ms): a place
 * page whose cards the digest does not give in time answers 200 inside two seconds, titled by the place index and
 * addressed by its slug, with the cards as the placeholder the page's filler fetches — the filler on the page under
 * this request's nonce, the page never kept, and without JavaScript a link asking for the page again. An unknown slug
 * stays the 404; a slug whose key does not arrive is, since #1205, a person's degraded 200 and a crawler's 503 with
 * Retry-After, both inside the ceiling. The digest is a stub on
 * loopback that holds the cards (and one slug's key) for longer than the ceiling. No wait above 2 s per request.
 */
import type { ChildProcess } from "node:child_process";
import { createServer, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { first, text } from "@viafrei/design/testing";
import { startShell } from "./server.js";

const PORT = 8966;
const BASE = `http://127.0.0.1:${String(PORT)}`;
const CEILING_MS = 2_000;
/**
 * The one margin over the ceiling: what this CLIENT measures beyond the server's own budget — a loopback connection,
 * the request and the 503's bytes on the wire, outside the shell's two seconds. A page with late cards is decided well
 * inside the budget and is held to the ceiling itself; only the key that never arrives runs the budget to its end.
 */
const TRANSPORT_MS = 50;
let shell: ChildProcess;
let digest: Server;
const held: ServerResponse[] = [];

beforeAll(async () => {
  digest = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "stub:/");
    const html = { "content-type": "text/html; charset=utf-8" };
    if (url.pathname === "/internal/place/key") {
      const slug = url.searchParams.get("slug");
      if (slug === "koeln") res.writeHead(200, html).end('<p class="place-key">ags:05315000</p>');
      else if (slug === "stauhausen") held.push(res); // a key that does not arrive
      else res.writeHead(404, html).end("<p>no</p>");
      return;
    }
    if (url.pathname === "/internal/place/index") {
      res.writeHead(200, html).end('<ul class="place-index"><li><a href="/de/place/koeln">Köln</a></li><li><a href="/de/place/stauhausen">Stauhausen</a></li></ul>');
      return;
    }
    // the saturated person pool: the cards never come within the ceiling
    if (url.pathname === "/internal/place/cards") {
      held.push(res);
      return;
    }
    res.writeHead(404, { "content-type": "text/plain" }).end("no");
  });
  await new Promise<void>((r) => digest.listen(0, "127.0.0.1", () => r()));
  const url = `http://127.0.0.1:${String((digest.address() as AddressInfo).port)}`;
  shell = await startShell(PORT, { DIGEST_URL: url, WEB_TILE_TIMEOUT_MS: "", WEB_PLACE_TIMEOUT_MS: "" });
});
afterAll(async () => {
  shell?.kill();
  for (const r of held) r.destroy();
  await new Promise<void>((r) => (digest ? digest.close(() => r()) : r()));
});

const get = async (path: string, extra: Record<string, string> = {}): Promise<{ status: number; ms: number; headers: Headers; body: string }> => {
  const t0 = Date.now();
  const res = await fetch(`${BASE}${path}`, { headers: { "accept-language": "de", "user-agent": "Mozilla/5.0", ...extra }, redirect: "manual", signal: AbortSignal.timeout(CEILING_MS + 500) });
  const body = await res.text();
  return { status: res.status, ms: Date.now() - t0, headers: res.headers, body };
};

describe("#1166: a place page with late cards, from the built shell", () => {
  it("answers 200 inside two seconds with the index's name, its own canonical, and the cards loading", async () => {
    const r = await get("/de/place/koeln");
    expect(r.status).toBe(200);
    expect(r.ms).toBeLessThan(CEILING_MS);
    expect(r.body).toMatch(/<h1 translate="no">Köln<\/h1>/);
    expect(r.body).toMatch(/<title>[^<]*Köln[^<]*<\/title>/);
    expect(first(r.body, 'link[rel="canonical"]')?.attrs["href"]).toBe("https://viafrei.de/de/place/koeln");
    expect(r.body).toContain('data-vf-fill="/fragment/place"');
    expect(r.body).toContain("Die Karten für diesen Ort werden geladen");
    // without JavaScript, a link asking for the page again, inside the placeholder's frame
    const reload = first(r.body, "div.place-fill noscript p.place-fill__note a");
    expect(reload?.attrs["href"]).toBe("/de/place/koeln");
    expect(text(reload!)).toBe("Seite neu laden, um die Karten zu sehen");
    // a loading page is never kept as a finished one
    expect(r.headers.get("cache-control")).toBe("no-store");
  });

  it("carries the filler, and every script under this request's nonce", async () => {
    const r = await get("/de/place/koeln");
    const nonce = /'nonce-([A-Za-z0-9_+/=-]{16,})'/.exec(r.headers.get("content-security-policy") ?? "")?.[1] ?? "";
    expect(nonce.length).toBeGreaterThanOrEqual(16);
    const scripts = [...r.body.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter((m) => !/type="application\/ld\+json"/.test(m[1] ?? ""));
    expect(scripts.length).toBeGreaterThanOrEqual(1);
    for (const s of scripts) expect(s[1]).toContain(`nonce="${nonce}"`);
    // the filler is the script that reads the placeholders' fill address
    expect(scripts.some((s) => (s[2] ?? "").includes("data-vf-fill"))).toBe(true);
  });

  // #1205 (lib/degraded.ts): a key that does not arrive is a person's degraded 200 — noindex, no-store, reloading
  // itself — and a crawler's 503 with Retry-After, each inside the ceiling
  it("an unknown slug is still the 404, and a key that does not arrive a person's degraded 200 inside the ceiling", async () => {
    expect((await get("/de/place/atlantis")).status).toBe(404);
    const r = await get("/de/place/stauhausen");
    expect(r.status).toBe(200);
    expect(r.ms).toBeLessThan(CEILING_MS + TRANSPORT_MS);
    expect(r.headers.get("x-vf-degraded")).toBe("1");
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("x-robots-tag")).toBe("noindex");
    expect(r.body).toMatch(/<meta http-equiv="refresh" content="5;url=\/de\/place\/stauhausen\?vf_wait=1">/);
    expect(r.body).not.toContain('data-vf-fill="/fragment/place"');
  });

  it("a key that does not arrive is a crawler's 503 with Retry-After inside the ceiling", async () => {
    const r = await get("/de/place/stauhausen", { "x-vf-agent-class": "crawler" });
    expect(r.status).toBe(503);
    expect(r.ms).toBeLessThan(CEILING_MS + TRANSPORT_MS);
    expect(r.headers.get("retry-after")).toBe("60");
    expect(r.headers.get("x-vf-degraded")).toBe("1");
  });
});
