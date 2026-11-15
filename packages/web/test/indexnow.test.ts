/**
 * The IndexNow key file (#544), read through the function the route serves.
 * The key below is a FIXTURE, never the production key: the production key
 * lives only in `.env` and on the host.
 */
import { describe, expect, it } from "vitest";
import { indexNowKey, keyFileResponse } from "../src/site/indexnow.js";
import { GET } from "../src/pages/[indexnow].txt.js";

const KEY = "0123456789abcdef0123456789abcdef";
const env = { INDEXNOW_KEY: KEY };

describe("/<INDEXNOW_KEY>.txt (#544)", () => {
  it("answers 200 text/plain with exactly the key when the path names the configured key", async () => {
    const r = keyFileResponse(KEY, env);
    expect(r?.status).toBe(200);
    expect(r?.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await r?.text()).toBe(KEY);
  });
  it("serves nothing (the route's 404) for any other name", () => {
    for (const name of ["robots", "fedcba9876543210fedcba9876543210", KEY.toUpperCase(), `${KEY}x`, KEY.slice(0, -1), "", undefined]) {
      expect(keyFileResponse(name, env), String(name)).toBeNull();
    }
  });
  it("serves nothing when INDEXNOW_KEY is unset, empty or not an IndexNow key — even for that very name", () => {
    expect(keyFileResponse(KEY, {})).toBeNull();
    expect(keyFileResponse("", { INDEXNOW_KEY: "" })).toBeNull();
    expect(keyFileResponse("short", { INDEXNOW_KEY: "short" })).toBeNull();
    expect(keyFileResponse("a/b-0123456", { INDEXNOW_KEY: "a/b-0123456" })).toBeNull();
    expect(keyFileResponse("x".repeat(129), { INDEXNOW_KEY: "x".repeat(129) })).toBeNull();
  });
  it("reads the key trimmed and accepts IndexNow's whole alphabet and length range", () => {
    expect(indexNowKey({ INDEXNOW_KEY: `  ${KEY}\n` })).toBe(KEY);
    expect(indexNowKey({ INDEXNOW_KEY: "Ab-1Ab-1" })).toBe("Ab-1Ab-1");
    expect(indexNowKey({ INDEXNOW_KEY: "k".repeat(128) })).toBe("k".repeat(128));
    expect(indexNowKey({ INDEXNOW_KEY: "Ab-1Ab-" })).toBeUndefined();
  });
  it("the route reads the process environment and the [indexnow] parameter, and rewrites everything else to /404", async () => {
    const before = process.env["INDEXNOW_KEY"];
    const NOT_FOUND = new Response("the 404 page", { status: 404 });
    const rewrites: string[] = [];
    const rewrite = (to: string) => (rewrites.push(to), NOT_FOUND);
    try {
      process.env["INDEXNOW_KEY"] = KEY;
      const call = (p: string) => GET({ params: { indexnow: p }, rewrite } as never) as Response;
      expect(call(KEY).status).toBe(200);
      expect(await call(KEY).text()).toBe(KEY);
      expect(call("nope-nope-nope")).toBe(NOT_FOUND);
      delete process.env["INDEXNOW_KEY"];
      expect(call(KEY)).toBe(NOT_FOUND);
      expect(rewrites).toEqual(["/404", "/404"]);
    } finally {
      if (before === undefined) delete process.env["INDEXNOW_KEY"];
      else process.env["INDEXNOW_KEY"] = before;
    }
  });
});
