/**
 * A stand-in for the MCP process's internal listener (#744): it serves the
 * site's live assistant answers as production recorded them
 * (`test/fixtures/asks.json`), each answer's age reset so the page renders it
 * as live and fresh. Both clocks are reset: the data's `asOf` (printed beside
 * the dot) and the ask's `askedAt` (what `answerState` judges since the 2.1.18
 * deploy fix). Resetting only `asOf` left the recorded 2026-10-14 ask time in
 * place, and the sign turned stale the day after the fixture was recorded. A home measured without it would weigh less and stand
 * shorter than production's, so the page-weight gate and the height budget
 * both run with it.
 */
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

/** `sourcesOf` replaces what the named answers credit, for the business page's refusal of a restricted source (#1190). */
export async function startAsksStub(ageMinutes = 4, sourcesOf: Readonly<Record<string, readonly string[]>> = {}): Promise<{ readonly url: string; close(): Promise<void> }> {
  const recorded = JSON.parse(readFileSync(new URL("../test/fixtures/asks.json", import.meta.url), "utf8")) as { examples: { key: string; askedAt: string; projection: { asOf: string; sources: readonly string[] } }[] };
  // #992: the developers page's try-it, one whole recorded `tools/call` result (`test/fixtures/try-it.json`), its time reset the same way
  const call = (JSON.parse(readFileSync(new URL("../test/fixtures/try-it.json", import.meta.url), "utf8")) as { call: Record<string, unknown> }).call;
  const server = createServer((req, res) => {
    const at = new Date(Date.now() - ageMinutes * 60_000).toISOString();
    const body = req.url === "/internal/examples" ? { examples: recorded.examples.map((e) => ({ ...e, askedAt: at, projection: { ...e.projection, asOf: at, sources: sourcesOf[e.key] ?? e.projection.sources } })) } : req.url === "/internal/examples/call?key=charging" ? { call: { ...call, askedAt: at } } : null;
    res.writeHead(body !== null ? 200 : 404, { "content-type": "application/json" });
    res.end(body !== null ? JSON.stringify(body) : "{}");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  return {
    url: `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}
