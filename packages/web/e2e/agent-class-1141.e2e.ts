/**
 * #1141 against the REAL built shell: nginx's user-agent class (`X-VF-Agent-Class`) reaches the digest on EVERY
 * fragment a page asks for — the home's tiles and blocks (fetched by components while Astro streams the page), a
 * place page and a station page — so the digest can read a crawler's page on its own pool. Without the header, no
 * fragment carries one. The digest here is a recording stub that answers 404 to everything: the point is what the
 * shell SENDS, not what it renders. No browser, no network beyond loopback; no wait above 2 s.
 *
 * #1205 (owner 2026-11-11): the shell hands on `search` only for an address that was VERIFIED — here by the edge's
 * marker (`X-VF-Verified-Bot: 1`, Cloudflare's `cf.client.bot`, forwarded by nginx as `$vf_verified`); nginx's `search`
 * with no proof is handed on as `crawler`. The station-name list the shell keeps from its first request is a process
 * read on a timer, not a fragment of that request, so it carries no class (as `test/agent-class-1141.test.ts` reads it).
 */
import type { ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startShell } from "./server.js";
import { PRESSURE_ROUTE } from "../src/overload/pressure.js";
import { VERIFIED_BOT_HEADER } from "../src/overload/verified-class.js";

const PORT = 8941;
const BASE = `http://127.0.0.1:${String(PORT)}`;
let shell: ChildProcess;
let digest: Server;
let seen: { readonly path: string; readonly cls: string | undefined }[] = [];

beforeAll(async () => {
  digest = createServer((req, res) => {
    const cls = req.headers["x-vf-agent-class"];
    const path = (req.url ?? "").split("?")[0] ?? "";
    // #1184: the overload probe is the shell's own coalesced reading of the person pool (at most once a second, shared
    // by every request), not a fragment of this request, so it carries no request's class
    // #1205: nor is the station-name list, kept from the process's first request and re-read on a timer
    if (path !== PRESSURE_ROUTE && path !== "/internal/station/list") seen.push({ path, cls: Array.isArray(cls) ? cls.join(",") : cls });
    res.writeHead(404, { "content-type": "text/plain" }).end("no");
  });
  await new Promise<void>((r) => digest.listen(0, "127.0.0.1", () => r()));
  const url = `http://127.0.0.1:${String((digest.address() as AddressInfo).port)}`;
  shell = await startShell(PORT, { DIGEST_URL: url, WEB_TILE_TIMEOUT_MS: "1500", WEB_PLACE_TIMEOUT_MS: "1500" });
});
afterAll(async () => {
  shell?.kill();
  await new Promise<void>((r) => (digest ? digest.close(() => r()) : r()));
});
beforeEach(() => {
  seen = [];
});

const page = async (path: string, agentClass?: string, verified = false): Promise<number> =>
  (
    await fetch(`${BASE}${path}`, {
      headers: { "accept-language": "de", ...(agentClass === undefined ? {} : { "x-vf-agent-class": agentClass }), ...(verified ? { [VERIFIED_BOT_HEADER]: "1" } : {}) },
      signal: AbortSignal.timeout(2_000),
    })
  ).status;

describe("#1141: the class rides every fragment the built shell asks of the digest", () => {
  for (const path of ["/de", "/de/place/koeln", "/de/station/koeln-hbf"]) {
    it(`${path}: a verified search engine's request — every fragment carries "search"`, async () => {
      await page(path, "search", true);
      expect(seen.length, path).toBeGreaterThanOrEqual(1);
      expect(seen.filter((s) => s.cls !== "search"), path).toEqual([]);
    });
    it(`${path}: nginx's "search" with no proof of the address (#1205) — every fragment carries "crawler"`, async () => {
      await page(path, "search");
      expect(seen.length, path).toBeGreaterThanOrEqual(1);
      expect(seen.filter((s) => s.cls !== "crawler"), path).toEqual([]);
    });
    it(`${path}: a person's request (no header, or a value that is not a class) — no fragment carries one`, async () => {
      await page(path);
      await page(path, "googlebot");
      expect(seen.length, path).toBeGreaterThanOrEqual(2);
      expect(seen.filter((s) => s.cls !== undefined), path).toEqual([]);
    });
  }
});
