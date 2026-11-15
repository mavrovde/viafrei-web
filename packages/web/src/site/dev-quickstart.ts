/**
 * The developers page's quickstart (#992): one tab per client, each the configuration that client reads, built from
 * the ONE endpoint constant (`MCP_ENDPOINT`) and the release this build belongs to — nothing typed per tab that a
 * test could not read back. `test/developers-992.test.ts` parses every JSON and TOML tab, asserts each names the live
 * endpoint, and that the stdio line names the bridge package unpinned.
 *
 * The stdio bridge (`npx viafrei`) is published from the public repository only after that repository's sync, which
 * follows a platform release by hours or days, so pinning this build's version would print a package npm does not
 * hold yet (ETARGET). The tab names the package unpinned, as the connect page does (`connect-clients.ts`), and npm
 * resolves it to the bridge's newest release.
 *
 * The raw-HTTP tab and the try-it's curl are the SAME session — `initialize`, read `Mcp-Session-Id`, send
 * `notifications/initialized`, then the call — as `scripts/mcp-probe.sh` makes it, so what a reader pastes is what our
 * own release probe runs.
 */
import type { DevClient } from "../analytics/events.js";
import { MCP_ENDPOINT } from "./endpoints.js";

/** The protocol revision the curl sessions ask for (the one `scripts/mcp-probe.sh` asks for). */
export const CURL_PROTOCOL = "2025-06-18";

export type QuickTab = {
  readonly id: Exclude<DevClient, "tryit">;
  /** The client's own name (a product name: never translated, `translate="no"`). */
  readonly name: string;
  /** Where the client reads it, or the shell it is typed into. */
  readonly where: string;
  readonly format: "shell" | "json" | "toml";
  readonly code: string;
};

const json = (v: unknown): string => JSON.stringify(v, null, 2);

/**
 * The try-it's request when no call is held: the same question the MCP side asks itself for its `charging` example
 * (`packages/mcp/src/server/site-examples.ts`), so the curl a reader copies is the one whose answer the page shows.
 * Only the REQUEST is a constant; the response is never one.
 */
export const TRY_IT_FALLBACK = { name: "find_charging_station", arguments: { place: "Leipzig", min_power_kw: 150, language: "de" } } as const;

/** The stdio bridge, unpinned: npm resolves its newest published release (see the header). */
export const stdioPackage = (): string => "viafrei";

/** One JSON-RPC body as a single-quoted shell argument (a `'` inside is closed, escaped and reopened). */
const shellArg = (body: unknown): string => `'${JSON.stringify(body).replace(/'/g, `'\\''`)}'`;

/** A whole curl session against `endpoint`: initialize, the session id, initialized, then `call`. */
export function curlSession(call: { readonly method: string; readonly params?: unknown }, endpoint: string = MCP_ENDPOINT): string {
  const init = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: CURL_PROTOCOL, capabilities: {}, clientInfo: { name: "curl", version: "1" } } };
  const body = call.params === undefined ? { jsonrpc: "2.0", id: 2, method: call.method } : { jsonrpc: "2.0", id: 2, method: call.method, params: call.params };
  const post = `curl -sS -X POST "$E" -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream'`;
  return [
    `E=${endpoint}`,
    `SID=$(${post} -D - -o /dev/null \\`,
    `  -d ${shellArg(init)} \\`,
    `  | awk -F': ' 'tolower($1)=="mcp-session-id"{print $2}' | tr -d '\\r')`,
    `${post} -H "Mcp-Session-Id: $SID" \\`,
    `  -d ${shellArg({ jsonrpc: "2.0", method: "notifications/initialized" })}`,
    `${post} -H "Mcp-Session-Id: $SID" \\`,
    `  -d ${shellArg(body)}`,
  ].join("\n");
}

/** The tabs, in the order the page shows them. */
export function quickTabs(endpoint: string = MCP_ENDPOINT): readonly QuickTab[] {
  const pkg = stdioPackage();
  return [
    { id: "claudeCode", name: "Claude Code", where: "Terminal", format: "shell", code: `claude mcp add --transport http viafrei ${endpoint}` },
    { id: "cursor", name: "Cursor", where: ".cursor/mcp.json", format: "json", code: json({ mcpServers: { viafrei: { url: endpoint } } }) },
    { id: "vscode", name: "VS Code", where: ".vscode/mcp.json", format: "json", code: json({ servers: { viafrei: { type: "http", url: endpoint } } }) },
    { id: "windsurf", name: "Windsurf", where: "~/.codeium/windsurf/mcp_config.json", format: "json", code: json({ mcpServers: { viafrei: { serverUrl: endpoint } } }) },
    { id: "codex", name: "Codex", where: "~/.codex/config.toml", format: "toml", code: `[mcp_servers.viafrei]\nurl = "${endpoint}"` },
    { id: "stdio", name: "npx viafrei", where: "stdio", format: "json", code: json({ mcpServers: { viafrei: { command: "npx", args: ["-y", pkg] } } }) },
    { id: "http", name: "HTTP", where: "curl", format: "shell", code: curlSession({ method: "tools/list" }, endpoint) },
  ];
}
