/**
 * The public addresses the site prints (#375 A4, the connect block).
 *
 * The MCP endpoints mirror `MCP_ENDPOINT` / `MCP_SSE_ENDPOINT` in
 * `packages/digest/src/presentation/render.ts` by VALUE: this package may not
 * import the digest, and a URL that changes changes in both places on purpose
 * (the digest's `/`, `/de`, `/en` are the rollback of the cutover, #375 A5).
 */
export const SITE_ORIGIN = "https://viafrei.de";
export const MCP_ENDPOINT = "https://mcp.viafrei.de/mcp";
export const MCP_SSE_ENDPOINT = "https://mcp.viafrei.de/sse";
