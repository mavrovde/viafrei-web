/**
 * #864: on a München place page, the parking card's live answer never says "no car park has free spaces" when the
 * city publishes no occupancy at all. Against the REAL built shell, a stand-in digest answering every place with all
 * its cards, and a stand-in MCP listener serving the place's local answers in the projection's own shape — the
 * parking answer as `projectSiteExample` gives it for München (`unpublished`: no reading in reach). Read from the
 * browser, in German and in English.
 */
import type { ChildProcess } from "node:child_process";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startShell } from "./server.js";
import { startStubDigest } from "./stub-digest.js";

const PORT = 8833;
const BASE = `http://127.0.0.1:${String(PORT)}`;
const MUENCHEN = "ags:09162000";
/** A person's browser: the headless one's own user agent reads as a crawler, and a crawler is asked nothing. */
const PERSON_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
let browser: Browser;
let shell: ChildProcess;
let digest: Awaited<ReturnType<typeof startStubDigest>>;
let mcp: { url: string; close(): Promise<void> };

/** The local answers of one Gemeinde, as `/internal/examples/local` serves them. */
async function startLocalAsks(variant: string): Promise<{ url: string; close(): Promise<void> }> {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "stub:/");
    const now = new Date(Date.now() - 2 * 60_000).toISOString();
    if (url.pathname !== "/internal/examples/local" || url.searchParams.get("at") !== MUENCHEN) {
      res.writeHead(404, { "content-type": "application/json" }).end("{}");
      return;
    }
    const parking = { key: "parking", tool: "find_parking", askedAt: now, projection: { variant, values: {}, names: { place: "München" }, asOf: now, attribution: "Parkhäuser: Landeshauptstadt München, CC BY 4.0", sources: ["muc_parkhaeuser"] } };
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ answers: [parking] }));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  return { url: `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`, close: () => new Promise<void>((r) => server.close(() => r())) };
}

beforeAll(async () => {
  digest = await startStubDigest({}, 5000, { fullCards: true });
  mcp = await startLocalAsks("unpublished");
  shell = await startShell(PORT, { DIGEST_URL: digest.url, MCP_INTERNAL_URL: mcp.url, WEB_TILE_TIMEOUT_MS: "2000" });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
  await mcp?.close();
});

describe("the München parking answer says the occupancy is not published (#864)", () => {
  for (const [path, want, never] of [
    ["/de/place/muenchen", "veröffentlicht der Betreiber keine Live-Belegung", "kein Parkhaus in der Nähe freie Plätze"],
    ["/en/place/muenchen", "publish no live occupancy", "No car park nearby reports free spaces"],
  ] as const) {
    it(path, async () => {
      const ctx = await browser.newContext({ userAgent: PERSON_UA });
      const page = await ctx.newPage();
      const r = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
      expect(r?.status(), path).toBeLessThan(400);
      await page.waitForSelector("#pcard-parking");
      const answer = (await page.locator("#pcard-parking .qa-answer__text").first().textContent()) ?? "";
      expect(answer, path).toContain(want);
      expect(await page.locator("#pcard-parking").textContent(), path).not.toContain(never);
      await ctx.close();
    });
  }
});
