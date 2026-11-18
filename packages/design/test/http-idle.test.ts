/**
 * #1332: every HTTP server here keeps an idle keep-alive connection open longer than the proxy in front
 * reuses it, and waits for headers longer than that. The values live in ONE place, `src/http-idle.ts`.
 *   1. the order: Traefik's idleConnTimeout (held by the infra) < keepAliveTimeout <
 *      headersTimeout < Node's requestTimeout;
 *   2. the idle probe: a real server, one socket, a request, an idle longer than Node's default
 *      keep-alive (5 s plus its 1 s buffer), then the SAME socket again. With the shared timeouts the
 *      second request is answered. The control, a bare server, closes the socket in that idle;
 *   3. the guard: every `.listen(` of a runtime file under packages/<pkg>/src is wrapped in
 *      `withIdleTimeouts(`, and no runtime file creates a `node:http` server of its own. The site shell's
 *      server is the adapter's, held by packages/web/test/server-entry-1332.test.ts.
 */
import { createServer, type Server } from "node:http";
import { connect } from "node:net";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { HEADERS_TIMEOUT_MS, KEEP_ALIVE_TIMEOUT_MS, UPSTREAM_IDLE_MS, withIdleTimeouts } from "../src/http-idle.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("#1332: the shared idle keep-alive outlasts the proxy in front", () => {
  // cross-repo(viafrei-infra): Traefik's idleConnTimeout is the infra's configuration, held against UPSTREAM_IDLE_MS there
  it.skip("holds Traefik's idleConnTimeout as the infra sets it", () => {});

  it("orders upstream idle < keepAliveTimeout < headersTimeout < Node's requestTimeout", () => {
    const node = createServer();
    expect(KEEP_ALIVE_TIMEOUT_MS).toBeGreaterThan(UPSTREAM_IDLE_MS);
    expect(HEADERS_TIMEOUT_MS).toBeGreaterThan(KEEP_ALIVE_TIMEOUT_MS);
    expect(HEADERS_TIMEOUT_MS).toBeLessThan(node.requestTimeout);
    // and both are above Node's own defaults, which is the whole point
    expect(KEEP_ALIVE_TIMEOUT_MS).toBeGreaterThan(node.keepAliveTimeout);
  });

  it("sets both on a real server and returns that server", () => {
    const s = createServer();
    expect(withIdleTimeouts(s)).toBe(s);
    expect(s.keepAliveTimeout).toBe(KEEP_ALIVE_TIMEOUT_MS);
    expect(s.headersTimeout).toBe(HEADERS_TIMEOUT_MS);
  });
});

/** One socket: request, idle `idleMs`, request again. What the second request got, or how the socket ended. */
async function idleProbe(server: Server, idleMs: number): Promise<{ first: string; second: string | null; ended: string | null }> {
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as { port: number };
  const sock = connect(port, "127.0.0.1");
  let buf = "";
  let ended: string | null = null;
  sock.on("data", (d: Buffer) => (buf += d.toString()));
  sock.on("close", () => (ended ??= "closed"));
  sock.on("error", (e: NodeJS.ErrnoException) => (ended = `error ${e.code ?? e.message}`));
  const req = "GET / HTTP/1.1\r\nHost: probe\r\nConnection: keep-alive\r\n\r\n";
  const response = async (): Promise<string | null> => {
    for (let i = 0; i < 50 && !buf.includes("\r\n\r\nok"); i++) await new Promise((r) => setTimeout(r, 20));
    const line = buf.split("\r\n")[0] ?? "";
    buf = "";
    return line === "" ? null : line;
  };
  try {
    await new Promise<void>((r) => sock.once("connect", () => r()));
    sock.write(req);
    const first = (await response()) ?? "";
    await new Promise((r) => setTimeout(r, idleMs));
    if (ended === null) sock.write(req);
    const second = ended === null ? await response() : null;
    return { first, second, ended };
  } finally {
    sock.destroy();
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
}

describe("#1332: the idle probe — one connection reused after an idle past Node's 5 s default", () => {
  const handler = (_: unknown, res: { setHeader(k: string, v: string): void; end(b: string): void }): void => {
    res.setHeader("Content-Type", "text/plain");
    res.end("ok");
  };
  // Node closes an idle connection at keepAliveTimeout + keepAliveTimeoutBuffer (5 s + 1 s by default).
  const IDLE_MS = 7000;

  it("answers the request after the idle on the same socket, and a bare server (the control) has closed it", async () => {
    const [shared, bare] = await Promise.all([idleProbe(withIdleTimeouts(createServer(handler)), IDLE_MS), idleProbe(createServer(handler), IDLE_MS)]);
    expect(shared.first).toBe("HTTP/1.1 200 OK");
    expect(shared.ended).toBeNull();
    expect(shared.second).toBe("HTTP/1.1 200 OK");
    // The control proves the probe can see the failure it is there for.
    expect(bare.first).toBe("HTTP/1.1 200 OK");
    expect(bare.ended).not.toBeNull();
    expect(bare.second).toBeNull();
  }, 20_000);
});

const runtimeFiles = (dir: string): readonly string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = join(dir, d.name);
    if (d.isDirectory()) return d.name === "node_modules" || d.name === "generated" ? [] : runtimeFiles(p);
    return /\.(ts|mts|mjs)$/.test(d.name) && !/\.(test|e2e|spec)\.[mc]?[tj]s$/.test(d.name) && !d.name.endsWith(".d.ts") ? [p] : [];
  });

/** `.listen(` calls that are NOT HTTP servers, each with its reason. */
const NOT_HTTP_LISTEN: Readonly<Record<string, string>> = {};

/** Every `.listen(` in `src` whose statement does not hand the server to `withIdleTimeouts(`. */
function unwrappedListens(path: string, src: string): readonly string[] {
  return src.split("\n").flatMap((line, i) => (/\.listen\(/.test(line) && !/^\s*(\/\/|\*)/.test(line) && !/withIdleTimeouts\([^;]*\.listen\(/.test(line) ? [`${path}:${i + 1}: ${line.trim()}`] : []));
}

/** A runtime file that makes its own `node:http`/`node:https` server. */
function ownHttpServers(path: string, src: string): readonly string[] {
  const fromHttp = /import\s*\{[^}]*\bcreateServer\b[^}]*\}\s*from\s*["']node:https?["']/.test(src);
  const namespaced = /\bhttps?\.createServer\(/.test(src);
  return fromHttp || namespaced ? [path] : [];
}

describe("#1332: no HTTP server in a package starts without the shared idle keep-alive", () => {
  const pkgs = readdirSync(join(ROOT, "packages"), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  const files = pkgs.flatMap((p) => {
    try {
      return runtimeFiles(join(ROOT, "packages", p, "src"));
    } catch {
      return [];
    }
  });
  const rel = (f: string): string => relative(ROOT, f);

  it("reads the runtime files of every package (a sweep over nothing would pass)", () => {
    // this repository's packages; the mcp, digest and status servers are held by their own repositories
    expect(pkgs).toEqual(expect.arrayContaining(["design", "web"]));
    expect(files.length).toBeGreaterThan(100);
    // the site shell's entry point is among them
    expect(files.map(rel)).toContain("packages/web/src/server/entry.ts");
  });

  it("wraps every runtime .listen( in withIdleTimeouts(", () => {
    const found = files.filter((f) => !(rel(f) in NOT_HTTP_LISTEN)).flatMap((f) => unwrappedListens(rel(f), readFileSync(f, "utf8")));
    expect(found).toEqual([]);
  });

  it("lets no runtime file create its own node:http server (the site shell's is the adapter's, in src/server/entry.ts)", () => {
    expect(files.flatMap((f) => ownHttpServers(rel(f), readFileSync(f, "utf8")))).toEqual([]);
  });

  it("catches the shapes it is there to catch (planted)", () => {
    expect(unwrappedListens("x.ts", 'app.listen(8787, "0.0.0.0", () => log.info("up"));')).toHaveLength(1);
    expect(unwrappedListens("x.ts", "  createInternalApp(deps).listen(port, host);")).toHaveLength(1);
    expect(unwrappedListens("x.ts", "const s = app.listen(port);\nwithIdleTimeouts(s);")).toHaveLength(1);
    expect(unwrappedListens("x.ts", 'withIdleTimeouts(app.listen(8787, "0.0.0.0", () => log.info("up")));')).toEqual([]);
    expect(ownHttpServers("x.ts", 'import { createServer } from "node:http";\ncreateServer(h).listen(1);')).toEqual(["x.ts"]);
    expect(ownHttpServers("x.ts", 'import http from "node:http";\nhttp.createServer(h);')).toEqual(["x.ts"]);
    expect(ownHttpServers("x.ts", 'import { createServer } from "./server.js";')).toEqual([]);
  });
});
