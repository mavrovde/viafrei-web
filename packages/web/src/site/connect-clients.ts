/**
 * THE client list of the connect page (`/<lang>/connect#clients`, #142, #379):
 * one entry per client, its name, its steps from the copy deck, the snippet it
 * needs and its own anchor on the page. The connect page renders all of them;
 * the "works only with ViaFrei connected" note under every example answer
 * (#1001) names the main assistants in ONE line, each linking to its own block
 * here (#1003, owner 2026-10-25: "Mention more ai assistants, not only
 * chatgpt"), read from this list, never from a second copy.
 *
 * Names only, never a logo (nominative use; no trademark asset ships). A
 * product name is the same in every language, so the names of the clients
 * added by #1003 live here and not in 22 catalogues; only the steps are
 * translated.
 *
 * The steps were written from each client's own documentation, checked
 * 2026-10-25:
 *   - GitHub Copilot in VS Code: https://code.visualstudio.com/docs/copilot/customization/mcp-servers
 *     and https://code.visualstudio.com/docs/agents/reference/mcp-configuration (`servers`, `"type": "http"`);
 *     the agent firewall's allowlist: https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/customize-the-agent-firewall
 *     (the `x-ms-block-by: sandbox-broker` 403 is what Copilot's sandbox answers for a URL it blocks, observed by the owner)
 *   - Cursor: https://cursor.com/docs/context/mcp (`~/.cursor/mcp.json`, `mcpServers`, `url`)
 *   - Gemini CLI: https://geminicli.com/docs/tools/mcp-server/ (`gemini mcp add --transport http <name> <url>`)
 *   - Windsurf (Cascade): https://docs.devin.ai/desktop/cascade/mcp (`mcp_config.json`, `serverUrl`)
 *   - OpenAI Codex: https://learn.chatgpt.com/docs/extend/mcp?surface=cli (`codex mcp add <name> --url <url>`)
 *   - Mistral Le Chat: https://docs.mistral.ai/le-chat/knowledge-integrations/connectors/mcp-connectors
 *     (Connectors → + Add Connector → Custom MCP Connector; an administrator; "No authentication")
 *
 * Re-checked 2026-10-27 (#1090), every client against its own page; two had moved and were rewritten in all
 * 22 catalogues:
 *   - Claude (claude.ai and Desktop, one account-held connector): https://support.claude.com/en/articles/11175166
 *     (Customize → Connectors → "+ Add" → "Add custom connector" → name, URL → "Continue" → Authentication
 *     "No sign in" → "Add"; Team/Enterprise: an owner under Organization settings → Connectors)
 *   - ChatGPT: https://developers.openai.com/api/docs/guides/custom-mcp-server and
 *     https://developers.openai.com/plugins/deploy/connect-chatgpt (Plugins → "+" → "Add custom MCP server" →
 *     name, "Server URL" → "No authentication" → "I understand and want to continue" → "Create as a plugin";
 *     install, then "@" in a new chat; developer mode is no longer the path; workspace policies apply)
 *   - unchanged: Claude Code (code.claude.com/docs/en/mcp), Cursor, Gemini CLI, Codex (`--url`), Windsurf
 *     (Cascade "…" → MCPs → open the config file, `serverUrl`), VS Code ("MCP: Add Server" → HTTP), Le Chat.
 *
 * Re-checked 2026-10-28 (#1090, 2.4.8), against the docs AND, for the terminal clients, in a throwaway container:
 *   - VS Code / Copilot moved: https://code.visualstudio.com/docs/agent-customization/mcp-servers now labels the
 *     workspace `.vscode/mcp.json` and the profile `mcp.json` "deprecated in the guided flow"; "MCP: Add Server" →
 *     HTTP → URL → server ID → Global → "Copilot Global" writes `~/.copilot/mcp-config.json` (`$COPILOT_HOME` when set),
 *     the portable format `{ "mcpServers": { <id>: { "type": "http", "url" } } }`
 *     (https://code.visualstudio.com/docs/agents/reference/mcp-configuration). Steps and snippet rewritten in all 22.
 *   - Gemini CLI 0.66.0: `gemini mcp add` defaults to the PROJECT scope and refuses an untrusted folder ("Cannot
 *     modify settings in an untrusted workspace"), and even a user-scope server stays "Disabled" there; so the
 *     command is `--scope user` (the docs' `-s, --scope`) and the block says the folder must be trusted.
 *   - OpenAI Codex: developers.openai.com/codex/mcp 308-redirects to learn.chatgpt.com; the command is unchanged.
 */
import { t } from "../i18n/index.js";
import { MCP_ENDPOINT } from "./endpoints.js";
import { pathFor, type Lang } from "./pages.js";

export const CONNECT_CLIENT_IDS = ["claudeAi", "claudeDesktop", "claudeCode", "chatgpt", "copilot", "cursor", "geminiCli", "windsurf", "codex", "leChat", "generic", "stdio"] as const;
export type ConnectClientId = (typeof CONNECT_CLIENT_IDS)[number];

/** The product names of the clients #1003 added — the same in every language. */
const BRAND: Readonly<Partial<Record<ConnectClientId, string>>> = {
  copilot: "GitHub Copilot (VS Code)",
  cursor: "Cursor",
  geminiCli: "Gemini CLI",
  windsurf: "Windsurf",
  codex: "OpenAI Codex",
  leChat: "Mistral Le Chat",
};

/** Each client's steps in the copy deck. Gemini CLI and Codex are one terminal command like Claude Code's, Cursor one mcp.json entry. */
const STEPS = {
  claudeAi: "connectPage.claudeAiSteps",
  claudeDesktop: "connectPage.claudeDesktopSteps",
  claudeCode: "connectPage.claudeCodeSteps",
  chatgpt: "connectPage.chatgptSteps",
  copilot: "connectPage.copilotSteps",
  cursor: "connectPage.editorsSteps",
  geminiCli: "connectPage.claudeCodeSteps",
  windsurf: "connectPage.windsurfSteps",
  codex: "connectPage.claudeCodeSteps",
  leChat: "connectPage.leChatSteps",
  generic: "connectPage.genericSteps",
  stdio: "connectPage.stdioSteps",
} as const satisfies Record<ConnectClientId, `connectPage.${string}Steps`>;

/** The names the copy deck holds (the clients before #1003, some with a translated word). */
const NAMED = {
  claudeAi: "connectPage.claudeAi",
  claudeDesktop: "connectPage.claudeDesktop",
  claudeCode: "connectPage.claudeCode",
  chatgpt: "connectPage.chatgpt",
  generic: "connectPage.generic",
  stdio: "connectPage.stdio",
} as const;

const json = (x: unknown): string => JSON.stringify(x, null, 2);
const SNIPPET: Readonly<Partial<Record<ConnectClientId, string>>> = {
  claudeCode: `claude mcp add --transport http viafrei ${MCP_ENDPOINT}`,
  copilot: json({ mcpServers: { viafrei: { type: "http", url: MCP_ENDPOINT } } }),
  cursor: json({ mcpServers: { viafrei: { url: MCP_ENDPOINT } } }),
  geminiCli: `gemini mcp add --scope user --transport http viafrei ${MCP_ENDPOINT}`,
  windsurf: json({ mcpServers: { viafrei: { serverUrl: MCP_ENDPOINT } } }),
  codex: `codex mcp add viafrei --url ${MCP_ENDPOINT}`,
  stdio: "npx -y viafrei",
};

/** A further sentence under the snippet: Copilot's sandbox allow-list (#1003); Gemini's trusted folder (#1090). */
const AFTER = { copilot: "connectPage.copilotSandbox", geminiCli: "connectPage.geminiTrust" } as const satisfies Partial<Record<ConnectClientId, string>>;

/**
 * #1090 (owner 2026-10-28): every client's OFFICIAL guide, as the vendor publishes it (final URLs after redirects,
 * checked 2026-10-28). OpenAI's help centre answers scripts with 403 and opens in a browser, so no link checker may
 * fetch it as a test. The generic block names the guides of the clients most asked about.
 */
export type ClientGuide = { readonly name: string; readonly href: string };
const CLAUDE_GUIDE: ClientGuide = { name: "Claude", href: "https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp" };
const MISTRAL_GUIDE: ClientGuide = { name: "Mistral Le Chat", href: "https://docs.mistral.ai/vibe/work/connectors/mcp-connectors" };
const VSCODE_GUIDE: ClientGuide = { name: "VS Code", href: "https://code.visualstudio.com/docs/agent-customization/mcp-servers" };
const COPILOT_GUIDE: ClientGuide = { name: "GitHub Copilot", href: "https://docs.github.com/en/copilot/how-tos/copilot-in-your-ide/customize-copilot/extend-copilot-with-tools-and-context/extend-copilot-chat-with-mcp" };
const CURSOR_GUIDE: ClientGuide = { name: "Cursor", href: "https://cursor.com/docs/mcp" };
export const CLIENT_GUIDES: Readonly<Record<ConnectClientId, readonly ClientGuide[]>> = {
  claudeAi: [CLAUDE_GUIDE],
  claudeDesktop: [CLAUDE_GUIDE],
  claudeCode: [{ name: "Claude Code", href: "https://code.claude.com/docs/en/mcp" }],
  chatgpt: [{ name: "ChatGPT", href: "https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt" }],
  copilot: [VSCODE_GUIDE, COPILOT_GUIDE],
  cursor: [CURSOR_GUIDE],
  geminiCli: [{ name: "Gemini CLI", href: "https://geminicli.com/docs/tools/mcp-server/" }],
  windsurf: [{ name: "Windsurf", href: "https://docs.devin.ai/desktop/cascade/mcp" }],
  codex: [{ name: "OpenAI Codex", href: "https://learn.chatgpt.com/docs/extend/mcp?surface=cli" }],
  leChat: [MISTRAL_GUIDE],
  generic: [MISTRAL_GUIDE, VSCODE_GUIDE, COPILOT_GUIDE, CURSOR_GUIDE],
  stdio: [{ name: "npm", href: "https://www.npmjs.com/package/viafrei" }],
};
/** Each client's vendor domains: a guide link must be https on one of these (or a subdomain), never a third party's. */
export const GUIDE_DOMAINS: Readonly<Record<ConnectClientId, readonly string[]>> = {
  claudeAi: ["claude.com"],
  claudeDesktop: ["claude.com"],
  claudeCode: ["claude.com"],
  chatgpt: ["openai.com"],
  copilot: ["visualstudio.com", "github.com"],
  cursor: ["cursor.com"],
  geminiCli: ["geminicli.com"],
  windsurf: ["devin.ai", "windsurf.com"],
  codex: ["openai.com", "chatgpt.com"],
  leChat: ["mistral.ai"],
  generic: ["mistral.ai", "visualstudio.com", "github.com", "cursor.com"],
  stdio: ["npmjs.com"],
};

/**
 * The real images (#1090): the four claude.ai screenshots the lead captured in claude.ai on 2026-10-28 (cropped to
 * ViaFrei-only content), and four TERMINAL TRANSCRIPTS of the throwaway-container runs of 2026-10-28 — the real
 * output of each command, rendered verbatim in a plain terminal frame (noble container, DejaVu Sans Mono) and
 * captioned as a transcript, never as a screenshot of a window. The container ran as `HOME=/home/tester`, so no
 * personal path or name is in any of them.
 *
 * #1106: five PHONE captures of the owner's, taken on claude.ai in Chrome at phone width (393 px), signed in, on
 * 2026-11-01 — the connector menu, the dialog, a chat's "+" → Connectors with ViaFrei on (every other connector
 * blurred) and the A7 answer, whole and scrolled to its source line. They were taken in the phone's BROWSER, not in
 * the Claude app, and their caption says so (kind `phone`). Resized, never re-cropped; each at most 60 KB.
 */
export const SHOT_IDS = ["claude1", "claude2", "claude3", "claude4", "phone1", "phone2", "phone3", "phone4", "phone4b", "claudeCode1", "geminiCli1", "generic1", "stdio1"] as const;
export type ShotId = (typeof SHOT_IDS)[number];
/** The day the claude.ai screenshots were taken, shown in each caption. */
export const SHOTS_TAKEN = "2026-10-28";
/** One image: its file under `src/assets/connect/`, the day it was taken, and what it shows (untranslated: a product and its version). */
export type ShotMeta = { readonly file: string; readonly taken: string; readonly kind: "screen" | "phone" | "terminal"; readonly what: string };
/** The day the phone captures were taken (#1106). */
export const PHONE_SHOTS_TAKEN = "2026-11-01";
export const SHOT_META: Readonly<Record<ShotId, ShotMeta>> = {
  claude1: { file: "claude-1-add.webp", taken: SHOTS_TAKEN, kind: "screen", what: "claude.ai" },
  claude2: { file: "claude-2-name-url.webp", taken: SHOTS_TAKEN, kind: "screen", what: "claude.ai" },
  claude3: { file: "claude-3-allow.webp", taken: SHOTS_TAKEN, kind: "screen", what: "claude.ai" },
  claude4: { file: "claude-4-answer.webp", taken: SHOTS_TAKEN, kind: "screen", what: "claude.ai" },
  phone1: { file: "phone-claude-1.webp", taken: PHONE_SHOTS_TAKEN, kind: "phone", what: "claude.ai" },
  phone2: { file: "phone-claude-2.webp", taken: PHONE_SHOTS_TAKEN, kind: "phone", what: "claude.ai" },
  phone3: { file: "phone-claude-3.webp", taken: PHONE_SHOTS_TAKEN, kind: "phone", what: "claude.ai" },
  phone4: { file: "phone-claude-4.webp", taken: PHONE_SHOTS_TAKEN, kind: "phone", what: "claude.ai" },
  phone4b: { file: "phone-claude-4b.webp", taken: PHONE_SHOTS_TAKEN, kind: "phone", what: "claude.ai" },
  claudeCode1: { file: "term-claude-code.webp", taken: "2026-10-28", kind: "terminal", what: "Claude Code 2.1.312" },
  geminiCli1: { file: "term-gemini-cli.webp", taken: "2026-10-28", kind: "terminal", what: "Gemini CLI 0.66.0" },
  generic1: { file: "term-generic.webp", taken: "2026-10-28", kind: "terminal", what: "MCP Inspector 2.12.0" },
  stdio1: { file: "term-stdio.webp", taken: "2026-10-28", kind: "terminal", what: "viafrei 2.4.6 (npm), Claude Code 2.1.312" },
};
/** The images of a client shown as one block (no numbered steps): after its snippet. */
const CLIENT_SHOTS: Readonly<Partial<Record<ConnectClientId, readonly ShotId[]>>> = { claudeCode: ["claudeCode1"], geminiCli: ["geminiCli1"], generic: ["generic1"], stdio: ["stdio1"] };

/** A client shown as numbered steps: Claude with a screenshot per step, ChatGPT with a diagram (no screenshot yet). */
export type ClientFlow = {
  readonly steps: readonly { readonly text: string; readonly shots: readonly ShotId[] }[];
  readonly diagram?: { readonly title: string; readonly boxes: readonly string[]; readonly caption: string };
  readonly avail?: string;
};
const FLOW_SHOTS: Readonly<Record<"claudeAi", readonly (readonly ShotId[])[]>> = { claudeAi: [["claude1"], ["claude2"], ["claude3", "claude4"]] };
function flowOf(lang: Lang, id: ConnectClientId): ClientFlow | undefined {
  if (id === "claudeAi") {
    const keys = ["connectPage.claudeFlow.s1", "connectPage.claudeFlow.s2", "connectPage.claudeFlow.s3"] as const;
    return { steps: keys.map((k, i) => ({ text: t(lang, k), shots: FLOW_SHOTS.claudeAi[i] ?? [] })) };
  }
  if (id === "chatgpt") {
    const keys = ["connectPage.chatgptFlow.s1", "connectPage.chatgptFlow.s2", "connectPage.chatgptFlow.s3"] as const;
    return {
      steps: keys.map((k) => ({ text: t(lang, k), shots: [] })),
      diagram: { title: t(lang, "connectPage.chatgptFlow.dtitle"), boxes: [t(lang, "connectPage.chatgptFlow.d1"), t(lang, "connectPage.chatgptFlow.d2"), t(lang, "connectPage.chatgptFlow.d3")], caption: t(lang, "connectPage.shot.diagram") },
      avail: t(lang, "connectPage.chatgptFlow.avail"),
    };
  }
  return undefined;
}
/**
 * #1090 (2.4.8): how each client's steps were checked, ONE record per row (the page-wide draft banner is gone).
 *
 * - `verified`: connected in the client itself, on that day, with that version. For a terminal client that means a
 *   real run in a throwaway container (`HOME=/home/tester`, no account) against https://mcp.viafrei.de/mcp:
 *   Claude Code's and Gemini CLI's own `mcp list` health check answered "Connected"; the stdio bridge was added to
 *   Claude Code (`claude mcp add viafrei -- npx -y viafrei`, "Connected") and, on its own, answered `tools/list` with
 *   the catalogue of that day (22 tools); the MCP Inspector CLI (the reference client, for "any other client") answered
 *   `tools/list` with the same list. The page's caption for that shot names no count, because the catalogue grows
 *   and the picture does not (24 tools at 2.5.8).
 *   claude.ai: the lead's screenshots of 2026-10-28.
 * - `pending`: the steps were checked against the vendor's own guide on `docs` and NOT in the client, for a stated
 *   reason; the row keeps its draft line. Never set `verified` from the docs alone.
 */
export const PENDING_REASONS = ["account", "app", "signIn"] as const;
export type PendingReason = (typeof PENDING_REASONS)[number];
export type ClientCheck = { readonly verified: { readonly date: string; readonly version: string } } | { readonly pending: PendingReason; readonly docs: string };
/** The day every row's steps were last checked against the vendor's guide (#1090). */
export const DOCS_CHECKED = "2026-10-28";
export const CLIENT_CHECKS: Readonly<Record<ConnectClientId, ClientCheck>> = {
  claudeAi: { verified: { date: "2026-10-28", version: "claude.ai" } },
  // the same account-held connector as claude.ai, but the desktop app itself was not opened
  claudeDesktop: { pending: "account", docs: DOCS_CHECKED },
  claudeCode: { verified: { date: "2026-10-28", version: "Claude Code 2.1.312" } },
  // a custom MCP server needs a Pro, Business or Enterprise/Edu plan, which we do not hold
  chatgpt: { pending: "account", docs: DOCS_CHECKED },
  copilot: { pending: "app", docs: DOCS_CHECKED },
  cursor: { pending: "app", docs: DOCS_CHECKED },
  geminiCli: { verified: { date: "2026-10-28", version: "Gemini CLI 0.66.0" } },
  windsurf: { pending: "app", docs: DOCS_CHECKED },
  // codex-cli 0.165.0 took `codex mcp add viafrei --url …` (`codex mcp get`: streamable_http), but a session needs a ChatGPT sign-in or an API key
  codex: { pending: "signIn", docs: DOCS_CHECKED },
  leChat: { pending: "account", docs: DOCS_CHECKED },
  generic: { verified: { date: "2026-10-28", version: "MCP Inspector 2.12.0" } },
  stdio: { verified: { date: "2026-10-28", version: "viafrei 2.4.6 (npm), Claude Code 2.1.312" } },
};
export const isVerified = (c: ClientCheck): c is Extract<ClientCheck, { verified: unknown }> => "verified" in c;

/** The client's anchor on the connect page: `client-` and its id in kebab case. */
export const clientAnchor = (id: ConnectClientId): string => `client-${id.replace(/[A-Z]/gu, (c) => `-${c.toLowerCase()}`)}`;

export type ConnectClient = {
  readonly id: ConnectClientId;
  readonly name: string;
  readonly anchor: string;
  readonly steps: string;
  readonly code?: string;
  readonly after?: string;
  /** #1090: the official guides, the numbered steps (with screenshots or a diagram), the block's own images, and how it was checked. */
  readonly guides: readonly ClientGuide[];
  readonly flow?: ClientFlow;
  readonly shots: readonly ShotId[];
  readonly check: ClientCheck;
};

/** Every client of the connect page, in its order, in `lang`. */
export function connectClients(lang: Lang): readonly ConnectClient[] {
  return CONNECT_CLIENT_IDS.map((id) => {
    const brand = BRAND[id];
    const name = brand ?? t(lang, NAMED[id as keyof typeof NAMED]);
    const code = SNIPPET[id];
    const after = id in AFTER ? t(lang, AFTER[id as keyof typeof AFTER]) : undefined;
    const flow = flowOf(lang, id);
    return {
      id,
      name,
      anchor: clientAnchor(id),
      steps: t(lang, STEPS[id]),
      ...(code === undefined ? {} : { code }),
      ...(after === undefined ? {} : { after }),
      guides: CLIENT_GUIDES[id],
      ...(flow === undefined ? {} : { flow }),
      shots: CLIENT_SHOTS[id] ?? [],
      check: CLIENT_CHECKS[id],
    };
  });
}

/**
 * The assistants the note names in its one line (#1003), each by its short name and linking to its block:
 * Claude (web, Desktop and Code share the claude.ai block's steps), ChatGPT, GitHub Copilot / VS Code, Cursor,
 * Gemini CLI, Windsurf, OpenAI Codex and Mistral Le Chat.
 */
export const NOTE_CLIENTS: readonly { readonly id: ConnectClientId; readonly name: string }[] = [
  { id: "claudeAi", name: "Claude" },
  { id: "chatgpt", name: "ChatGPT" },
  { id: "copilot", name: "GitHub Copilot" },
  { id: "cursor", name: "Cursor" },
  { id: "geminiCli", name: "Gemini CLI" },
  { id: "windsurf", name: "Windsurf" },
  { id: "codex", name: "Codex" },
  { id: "leChat", name: "Le Chat" },
];

/** Where a note's name links: the client's own block on the connect page of `lang`. */
export const clientHref = (lang: Lang, id: ConnectClientId): string => `${pathFor("connect", lang)}#${clientAnchor(id)}`;
