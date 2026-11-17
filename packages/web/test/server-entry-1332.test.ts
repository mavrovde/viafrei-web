/**
 * #1332: the site shell's server gets the idle keep-alive every HTTP server here shares.
 *   1. astro.config.mjs hands the adapter `src/server/entry.ts` as its server entry, and changes
 *      nothing else of what @astrojs/node sets;
 *   2. entry.ts stops the adapter's own autostart FIRST, keeps a caller's own "disabled", then starts
 *      the adapter's server and applies `withIdleTimeouts` to it. The adapter module is replaced by a stub that returns a real http.Server.
 * The bundled build was probed by hand for the PR: a socket left idle for 7 s and then reused got a 200.
 * The pre-fix build closed it at 5 s.
 */
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HEADERS_TIMEOUT_MS, KEEP_ALIVE_TIMEOUT_MS } from "@viafrei/design/http-idle";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");

const adapter = vi.hoisted(() => ({ mode: "standalone", started: [] as Server[], autostartAtImport: undefined as string | undefined }));
vi.mock("@astrojs/node/server.js", async () => {
  const { createServer: create } = await import("node:http");
  // What the adapter's module sees when it is evaluated: entry.ts's first import must have run already.
  adapter.autostartAtImport = process.env["ASTRO_NODE_AUTOSTART"];
  return {
    handler: () => undefined,
    options: { get mode() { return adapter.mode; } },
    startServer: () => {
      const server = create();
      adapter.started.push(server);
      return { server: { host: "127.0.0.1", port: 0, closed: () => Promise.resolve(), stop: () => Promise.resolve(), server }, done: Promise.resolve() };
    },
  };
});

afterEach(() => {
  adapter.started.length = 0;
});

describe("#1332: the shell's server entry", () => {
  it("is the adapter's serverEntrypoint, and the rest of the adapter is @astrojs/node's own", async () => {
    const { nodeWithIdleTimeouts, SERVER_ENTRY } = (await import(/* @vite-ignore */ new URL("../astro.config.mjs", import.meta.url).href)) as {
      nodeWithIdleTimeouts: (o: { mode: "standalone" }) => { name: string; hooks: Record<string, (p: unknown) => unknown> };
      SERVER_ENTRY: string;
    };
    const nodeMod = (await import("@astrojs/node")) as unknown as { default: (o: { mode: "standalone" }) => { name: string; hooks: Record<string, (p: unknown) => unknown> } };
    expect(SERVER_ENTRY).toBe(join(PKG, "src/server/entry.ts"));
    const seen = (integration: { hooks: Record<string, (p: unknown) => unknown> }): Record<string, unknown> => {
      let set: Record<string, unknown> = {};
      integration.hooks["astro:config:done"]!({ setAdapter: (a: Record<string, unknown>) => (set = a), config: { outDir: new URL("file:///tmp/") } });
      return set;
    };
    const ours = seen(nodeWithIdleTimeouts({ mode: "standalone" }));
    const theirs = seen(nodeMod.default({ mode: "standalone" }));
    expect(ours["serverEntrypoint"]).toBe(SERVER_ENTRY);
    expect({ ...ours, serverEntrypoint: theirs["serverEntrypoint"] }).toEqual(theirs);
    // and the config the build reads uses it
    expect(readFileSync(join(PKG, "astro.config.mjs"), "utf8")).toMatch(/^\s*adapter: nodeWithIdleTimeouts\(\{ mode: "standalone" \}\),$/m);
  });

  it("disables the adapter's autostart before the adapter module runs, starts ONE server, and gives it the shared timeouts", async () => {
    vi.resetModules();
    adapter.mode = "standalone";
    const before = process.env["ASTRO_NODE_AUTOSTART"];
    delete process.env["ASTRO_NODE_AUTOSTART"];
    try {
      await import("../src/server/entry.js");
      expect(adapter.autostartAtImport).toBe("disabled");
      expect(adapter.started).toHaveLength(1);
      const [s] = adapter.started;
      expect(s!.keepAliveTimeout).toBe(KEEP_ALIVE_TIMEOUT_MS);
      expect(s!.headersTimeout).toBe(HEADERS_TIMEOUT_MS);
      // Node's own defaults are what a server without the entry would carry
      const bare = createServer();
      expect(s!.keepAliveTimeout).toBeGreaterThan(bare.keepAliveTimeout);
    } finally {
      if (before === undefined) delete process.env["ASTRO_NODE_AUTOSTART"];
      else process.env["ASTRO_NODE_AUTOSTART"] = before;
    }
  });

  it("keeps a caller's own ASTRO_NODE_AUTOSTART=disabled (as preview.js sets it): nothing starts, startServer() still applies the timeouts", async () => {
    vi.resetModules();
    adapter.mode = "standalone";
    const before = process.env["ASTRO_NODE_AUTOSTART"];
    process.env["ASTRO_NODE_AUTOSTART"] = "disabled";
    try {
      const entry = (await import("../src/server/entry.js")) as { startServer: () => { server: { server: Server } } };
      expect(adapter.autostartAtImport).toBe("disabled");
      expect(adapter.started).toHaveLength(0);
      const s = entry.startServer().server.server;
      expect(adapter.started).toHaveLength(1);
      expect(s.keepAliveTimeout).toBe(KEEP_ALIVE_TIMEOUT_MS);
      expect(s.headersTimeout).toBe(HEADERS_TIMEOUT_MS);
    } finally {
      if (before === undefined) delete process.env["ASTRO_NODE_AUTOSTART"];
      else process.env["ASTRO_NODE_AUTOSTART"] = before;
    }
  });

  it("starts nothing in middleware mode, and startServer() still applies the timeouts", async () => {
    vi.resetModules();
    adapter.mode = "middleware";
    const entry = (await import("../src/server/entry.js")) as { startServer: () => { server: { server: Server } } };
    expect(adapter.started).toHaveLength(0);
    const s = entry.startServer().server.server;
    expect(s.keepAliveTimeout).toBe(KEEP_ALIVE_TIMEOUT_MS);
    expect(s.headersTimeout).toBe(HEADERS_TIMEOUT_MS);
    adapter.mode = "standalone";
  });
});
