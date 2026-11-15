/**
 * The IndexNow key file (#544) through the BUILT server's real router, not a
 * function call: the dynamic `[indexnow].txt` route must answer only for the
 * configured key, must not shadow `/robots.txt` or `/llms.txt`, and must hand
 * every other `/<name>.txt` to the site's own 404. The key is a FIXTURE.
 * Offline: the shell is on loopback and no tile is requested.
 */
import type { ChildProcess } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { robotsTxt } from "../src/site/discovery.js";
import { startShell } from "./server.js";

const KEY = "0123456789abcdef0123456789abcdef";
const WITH_KEY = 8811;
const NO_KEY = 8812;
const shells: ChildProcess[] = [];
const get = (port: number, path: string): Promise<Response> => fetch(`http://127.0.0.1:${port}${path}`, { redirect: "manual" });

beforeAll(async () => {
  shells.push(await startShell(WITH_KEY, { INDEXNOW_KEY: KEY }));
  shells.push(await startShell(NO_KEY, { INDEXNOW_KEY: "" }));
});

afterAll(() => {
  for (const s of shells) s.kill();
});

describe("/<INDEXNOW_KEY>.txt on the built server (#544)", () => {
  it("serves exactly the key as text/plain when the path names it", async () => {
    const r = await get(WITH_KEY, `/${KEY}.txt`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await r.text()).toBe(KEY);
  });
  it("answers the site's 404 page for any other /<name>.txt", async () => {
    for (const path of [`/${KEY.slice(0, -1)}x.txt`, "/nothing.txt", `/${KEY.toUpperCase()}.txt`]) {
      const r = await get(WITH_KEY, path);
      expect(r.status, path).toBe(404);
      expect(r.headers.get("content-type") ?? "", path).toMatch(/^text\/html/);
      expect(await r.text(), path).not.toContain(KEY);
    }
  });
  it("answers 404 for the key path when no key is configured", async () => {
    const r = await get(NO_KEY, `/${KEY}.txt`);
    expect(r.status).toBe(404);
    expect(await r.text()).not.toContain(KEY);
  });
  it("does not shadow the static text routes", async () => {
    const robots = await get(WITH_KEY, "/robots.txt");
    expect(robots.status).toBe(200);
    expect(await robots.text()).toBe(robotsTxt());
    expect((await get(WITH_KEY, "/llms.txt")).status).toBe(200);
  });
});
