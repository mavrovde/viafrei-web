/**
 * #1090 (2.4.8): what still needs a REAL image on the connect page, by name.
 *
 * Every client step (a numbered step of a flow, or the one block of a client without one) and every example answer
 * the page shows ("So fragen Sie" and "Antworten, wie sie gekommen sind") is a capture target. Each target either
 * has at least one real image (derived from the page's own wiring in `connect-clients.ts`, never typed twice) or is
 * listed here as PENDING with who can take it and what it must show. `test/connect-captures-1090.test.ts` asserts the
 * two together cover the targets exactly — a new client, step or example without an image or a pending entry fails,
 * and so does a pending entry that has since got its image. No placeholder image ever stands in for a pending one.
 *
 * Every capture taken in a signed-in account shows only ViaFrei (owner 2026-10-28): name, e-mail, avatar,
 * organisation, other connectors and other conversations cropped or masked before the file is committed.
 */
import { CONNECT_PROMPTS } from "./connect-prompts.js";
import { CONNECT_EXAMPLES } from "./live-examples.js";
import { connectClients, type ShotId } from "./connect-clients.js";
import { phoneClients } from "./connect-phone.js";

/** A target: `client:<id>:<step>` (1-based), `phone:<id>:<step>` (#1106), `ask:<question>` or `live:<example>`. */
export type CaptureTarget = `client:${string}:${string}` | `phone:${string}:${string}` | `ask:${string}` | `live:${string}`;

/** Who can take a pending capture: the owner (a signed-in account or a desktop app we do not run). */
export type PendingCapture = { readonly by: "owner"; readonly what: string };

const ASK = "the question asked in a signed-in assistant with ViaFrei connected, fresh from production: ViaFrei's answer with its attribution line";
const LIVE = "this example's question asked in a signed-in assistant with ViaFrei connected, fresh from production: the answer with its attribution line";

export const PENDING_CAPTURES: Readonly<Partial<Record<CaptureTarget, PendingCapture>>> = {
  "client:claudeDesktop:1": { by: "owner", what: "Claude Desktop signed in: Settings → Connectors with ViaFrei connected, and ViaFrei's tools in a chat" },
  "client:chatgpt:1": { by: "owner", what: "ChatGPT (Pro or Business): Plugins → “+” → “Add custom MCP server”" },
  "client:chatgpt:2": { by: "owner", what: "ChatGPT: the dialog with name ViaFrei, the address under Connection, No authentication, “Create as a plugin”" },
  "client:chatgpt:3": { by: "owner", what: "ChatGPT: a new chat with @ViaFrei chosen and an answer carrying the attribution line" },
  "client:copilot:1": { by: "owner", what: "VS Code: MCP: Add Server → HTTP → the address → server ID viafrei → Global → Copilot Global, then viafrei running with its tools" },
  "client:cursor:1": { by: "owner", what: "Cursor: Settings → MCP with viafrei enabled and its tools listed" },
  "client:windsurf:1": { by: "owner", what: "Windsurf: Cascade → MCPs with viafrei from mcp_config.json and its tools listed" },
  "client:codex:1": { by: "owner", what: "Codex CLI signed in: /mcp in the TUI listing viafrei and its tools" },
  "client:leChat:1": { by: "owner", what: "Le Chat: Connectors → “+ Add Connector” → Custom MCP Connector with the address, then ViaFrei connected" },
  "ask:train": { by: "owner", what: ASK },
  "ask:parking": { by: "owner", what: ASK },
  "ask:charging": { by: "owner", what: ASK },
  "ask:road": { by: "owner", what: ASK },
  "ask:weather": { by: "owner", what: ASK },
  "live:stadtbahn": { by: "owner", what: LIVE },
  "live:bikes": { by: "owner", what: LIVE },
  "live:lift": { by: "owner", what: LIVE },
  "live:alert": { by: "owner", what: LIVE },
  "live:enbw": { by: "owner", what: LIVE },
  "live:ecomove": { by: "owner", what: LIVE },
  "live:ocpdb": { by: "owner", what: LIVE },
  "live:lsr": { by: "owner", what: LIVE },
  "live:charger": { by: "owner", what: LIVE },
  "live:hamburg": { by: "owner", what: LIVE },
  "live:hhworks": { by: "owner", what: LIVE },
  "live:muenster": { by: "owner", what: LIVE },
  "live:carpark": { by: "owner", what: LIVE },
  "live:motorway": { by: "owner", what: LIVE },
  "live:citywork": { by: "owner", what: LIVE },
  "live:landroad": { by: "owner", what: LIVE },
  "live:saxony": { by: "owner", what: LIVE },
  "live:bwroad": { by: "owner", what: LIVE },
  "live:roadworks": { by: "owner", what: LIVE },
  "live:kiel": { by: "owner", what: LIVE },
  "live:truckstop": { by: "owner", what: LIVE },
  "live:lorry": { by: "owner", what: LIVE },
  "live:parkride": { by: "owner", what: LIVE },
  "live:platform": { by: "owner", what: LIVE },
  "live:train": { by: "owner", what: LIVE },
  "live:region": { by: "owner", what: LIVE },
  "live:tomorrow": { by: "owner", what: LIVE },
  "live:closure": { by: "owner", what: LIVE },
  "live:weather": { by: "owner", what: LIVE },
  "live:fuelcity": { by: "owner", what: LIVE },
  "live:fuelroad": { by: "owner", what: LIVE },
};

/** Every capture target the connect page has, in page order. */
export function captureTargets(): readonly CaptureTarget[] {
  const clients = connectClients("de").flatMap((c): CaptureTarget[] => {
    const n = c.flow?.steps.length ?? 1;
    return Array.from({ length: n }, (_, i): CaptureTarget => `client:${c.id}:${String(i + 1)}`);
  });
  const phone = phoneClients().flatMap((c) => c.steps.map((_, i): CaptureTarget => `phone:${c.id}:${String(i + 1)}`));
  const asks = CONNECT_PROMPTS.map((p): CaptureTarget => `ask:${p.key.replace(/^connectPage\.asks\./u, "")}`);
  const live = CONNECT_EXAMPLES.map((e): CaptureTarget => `live:${e.key}`);
  return [...clients, ...phone, ...asks, ...live];
}

/** The targets that have real images, read off the page's own wiring (a flow step's shots, a block's own, or a phone step's). */
export function capturedTargets(): Readonly<Partial<Record<CaptureTarget, readonly ShotId[]>>> {
  const out: Partial<Record<CaptureTarget, readonly ShotId[]>> = {};
  for (const c of connectClients("de")) {
    const steps = c.flow?.steps.map((s) => s.shots) ?? [c.shots];
    for (const [i, shots] of steps.entries()) if (shots.length > 0) out[`client:${c.id}:${String(i + 1)}`] = shots;
  }
  // #1106: the phone steps' captures (claude.ai in the phone's browser, 2026-11-01)
  for (const c of phoneClients()) for (const [i, shots] of c.shots.entries()) if (shots.length > 0) out[`phone:${c.id}:${String(i + 1)}`] = shots;
  return out;
}
