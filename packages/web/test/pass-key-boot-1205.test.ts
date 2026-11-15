/**
 * #1205 review: a malformed `WEB_PASS_KEY` refuses the process when the middleware loads (exit 78, one line naming
 * the variable, never the value), instead of a 500 on every page from `overloadDeps()`. A well-formed or absent key boots.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("astro:middleware", () => ({ defineMiddleware: <T>(f: T): T => f }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

async function boot(key: string | undefined): Promise<{ exit: number | null; lines: string }> {
  vi.resetModules();
  vi.stubEnv("WEB_PASS_KEY", key ?? "");
  let exit: number | null = null;
  vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    exit = code ?? 0;
    throw new Error("exit");
  }) as never);
  const out: string[] = [];
  vi.spyOn(process.stdout, "write").mockImplementation(((s: string) => (out.push(String(s)), true)) as never);
  vi.spyOn(process.stderr, "write").mockImplementation(((s: string) => (out.push(String(s)), true)) as never);
  vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => void out.push(a.join(" ")));
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => void out.push(a.join(" ")));
  await import("../src/middleware.js").catch(() => undefined);
  return { exit, lines: out.join("\n") };
}

describe("#1205 review: the pass key is judged when the web boots", () => {
  it("a malformed key ends the process with 78, naming the variable and never its value", async () => {
    const bad = "zz".repeat(32);
    const r = await boot(bad);
    expect(r.exit).toBe(78);
    expect(r.lines).toContain("web_pass_key");
    expect(r.lines).not.toContain(bad);
    expect((await boot("abcd")).exit).toBe(78);
  });

  it("a well-formed key, and an absent one, boot", async () => {
    expect((await boot("ab".repeat(32))).exit).toBeNull();
    expect((await boot(undefined)).exit).toBeNull();
  });
});
