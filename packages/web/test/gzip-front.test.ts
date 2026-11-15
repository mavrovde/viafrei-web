/**
 * The Lighthouse gate measures what a visitor receives: the front it puts before the shell compresses exactly as
 * the edge configuration does (2.3.13). That file is viafrei-infra's, so the case that reads the rule from it is
 * skipped here and held by viafrei-infra; the front's own behaviour is tested here.
 */
import { createServer, get, type IncomingMessage, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GZIP_LEVEL, GZIP_MIN_LENGTH, GZIP_TYPES, compresses, startGzipFront } from "../e2e/gzip-front.js";

const directive = (name: string): string => {
  const conf = readFileSync(new URL("the edge configuration", import.meta.url), "utf8");
  return new RegExp(`^${name}\\s+([^;]+);`, "mu").exec(conf)?.[1]?.trim() ?? "";
};

describe("the front's rule is the edge's", () => {
  // cross-repo(viafrei-infra): the edge's gzip directives are viafrei-infra's configuration
  it.skip("text/html plus the conf's gzip_types, its minimum length and its level", () => {
    expect(directive("gzip")).toBe("on");
    expect([...GZIP_TYPES]).toEqual(["text/html", ...directive("gzip_types").split(/\s+/u)]);
    expect(GZIP_MIN_LENGTH).toBe(Number(directive("gzip_min_length")));
    expect(GZIP_LEVEL).toBe(Number(directive("gzip_comp_level")));
  });

  it("compresses a page for a client that accepts gzip, and nothing else", () => {
    const gz = { "accept-encoding": "gzip, deflate, br" };
    const html = { "content-type": "text/html; charset=utf-8" };
    expect(compresses(gz, html, 2048)).toBe(true);
    expect(compresses({}, html, 2048)).toBe(false);
    expect(compresses(gz, html, GZIP_MIN_LENGTH - 1)).toBe(false);
    expect(compresses(gz, { "content-type": "image/png" }, 2048)).toBe(false);
    expect(compresses(gz, { ...html, "content-encoding": "br" }, 2048)).toBe(false);
  });
});

describe("through a running front", () => {
  const PAGE = `<!doctype html><title>x</title>${"<p>ViaFrei</p>".repeat(400)}`;
  let upstream: Server;
  let front: Server;
  const UP = 18_971;
  const FRONT = 18_972;
  beforeAll(async () => {
    upstream = createServer((req, res) => {
      if (req.url === "/png") {
        res.writeHead(200, { "content-type": "image/png" });
        res.end(Buffer.alloc(4096));
        return;
      }
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", vary: "User-Agent" });
      res.end(PAGE);
    });
    await new Promise<void>((r) => upstream.listen(UP, "127.0.0.1", r));
    front = await startGzipFront(FRONT, UP);
  });
  afterAll(async () => {
    await new Promise((r) => front.close(r));
    await new Promise((r) => upstream.close(r));
  });

  it("a page leaves gzipped, smaller, byte-identical once inflated, and varies on Accept-Encoding too", async () => {
    // node:http, not fetch: fetch inflates the body and would hide what was sent
    const { res, body } = await new Promise<{ res: IncomingMessage; body: Buffer }>((resolve, reject) => {
      get(`http://127.0.0.1:${FRONT}/`, { headers: { "accept-encoding": "gzip" } }, (res) => {
        const cs: Buffer[] = [];
        res.on("data", (c: Buffer) => cs.push(c));
        res.on("end", () => resolve({ res, body: Buffer.concat(cs) }));
      }).on("error", reject);
    });
    expect(res.headers["content-encoding"]).toBe("gzip");
    expect(res.headers["vary"]).toBe("User-Agent, Accept-Encoding");
    expect(body.length).toBeLessThan(PAGE.length / 4);
    expect(Number(res.headers["content-length"])).toBe(body.length);
    expect(gunzipSync(body).toString("utf8")).toBe(PAGE);
  });

  it("an image is passed as it came", async () => {
    const r = await fetch(`http://127.0.0.1:${FRONT}/png`, { headers: { "accept-encoding": "gzip" } });
    expect(r.headers.get("content-encoding")).toBeNull();
    expect((await r.arrayBuffer()).byteLength).toBe(4096);
  });
});
