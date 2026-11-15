/**
 * #1106 (owner 2026-10-29): ViaFrei on a PHONE — the connect page's `#phone` section, one block per assistant app.
 *
 * Every block says only what the vendor's own documentation says, checked on `PHONE_CHECKED`, and NOTHING that was
 * not done on a device: no block is marked as working on a phone until someone connected it there and ViaFrei
 * answered (AC 5). Three kinds of block:
 *   - `steps`: the vendor documents that a connector set up on the web is used by its phone app — numbered steps from
 *     "open" to "ViaFrei answered", a first test question and what a right answer looks like, each step with the
 *     owner's phone capture of it (`connect-clients.ts` SHOT_META, kind `phone`: claude.ai in the phone's browser,
 *     2026-11-01, captioned as such — not the Claude app);
 *   - `unclear`: the vendor documents adding a custom MCP server on the web only and says nothing about its phone
 *     app — one honest line, no steps;
 *   - `no`: the vendor's documentation rules it out for a visitor in Germany — one honest line, no steps.
 *
 * Sources, checked 2026-11-01:
 *   - Claude: https://support.claude.com/en/articles/11176164 ("Web connectors are available for all users on Claude,
 *     Cowork, Claude Desktop, and Claude Mobile (iOS and Android)"; a service connected on Claude or Claude Desktop "will
 *     be available to use the next time you log in to your account on Claude for iOS or Android"; "Installing connectors
 *     on mobile is currently in beta—Claude Desktop and web remain the primary path for custom connectors") and
 *     https://support.claude.com/en/articles/11175166 (Customize → Connectors → "+ Add" → "Add custom connector"; Free,
 *     Pro, Max, Ultra, Team and Enterprise; Free: one custom connector).
 *   - ChatGPT: https://developers.openai.com/api/docs/guides/custom-mcp-server ("Use ChatGPT on the web"; no word on the
 *     app).
 *   - Mistral Le Chat: https://docs.mistral.ai/vibe/work/connectors/mcp-connectors (no word on the app).
 *   - Perplexity: https://www.perplexity.ai/help-center/en/articles/13915507 (web and desktop; no word on the app).
 *   - Gemini: https://support.google.com/gemini/answer/17209137 ("You can only connect custom apps in the Gemini web
 *     app. Once connected, they're available on both the Gemini mobile app and Gemini web app"; "Be 18 or over and in the
 *     US"; personal accounts only; English only) — so not for a visitor in Germany.
 *   - Microsoft Copilot: https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/configure-plugin-mcp-servers
 *     (remote MCP servers for Microsoft 365 Copilot through an organisation's admin, and Copilot Studio agents; nothing
 *     for the Copilot app).
 *
 * Names only, never a logo (nominative use), the same in every language; every sentence about them is translated.
 */
import { t, type MessageKey } from "../i18n/index.js";
import { esc } from "../lib/answer-html.js";
import { dayOf, shotHtml, type ShotFile } from "../lib/connect-blocks.js";
import { MCP_ENDPOINT } from "./endpoints.js";
import type { ClientGuide, ShotId } from "./connect-clients.js";
import type { Lang } from "./pages.js";

/** The day every phone block was checked against its vendor's documentation. AC 4: re-check any block older than 90 days. */
export const PHONE_CHECKED = "2026-11-01";
/** AC 4: a block older than this many days must be re-checked by the next release. */
export const PHONE_RECHECK_DAYS = 90;

export const PHONE_CLIENT_IDS = ["claude", "chatgpt", "leChat", "perplexity", "gemini", "copilot"] as const;
export type PhoneClientId = (typeof PHONE_CLIENT_IDS)[number];
export type PhoneStatus = "steps" | "unclear" | "no";

export type PhoneClient = {
  readonly id: PhoneClientId;
  readonly name: string;
  readonly status: PhoneStatus;
  readonly guides: readonly ClientGuide[];
  readonly checked: string;
  /** For `steps`: the copy keys of its numbered steps, in order; the last is the test question and the right answer. */
  readonly steps: readonly MessageKey[];
  /** For `steps`: each step's real captures, in step order (#1106); a step without one would be a pending capture. */
  readonly shots: readonly (readonly ShotId[])[];
  /** `null`: no block on a phone has been connected on a device yet (AC 5) — set it only from a real device run. */
  readonly device: { readonly date: string; readonly app: string } | null;
};

export const PHONE_CLIENTS: Readonly<Record<PhoneClientId, PhoneClient>> = {
  claude: {
    id: "claude",
    name: "Claude (Android, iPhone)",
    status: "steps",
    guides: [
      { name: "Claude", href: "https://support.claude.com/en/articles/11176164-use-connectors-to-extend-claude-s-capabilities" },
      { name: "Claude", href: "https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp" },
    ],
    checked: PHONE_CHECKED,
    steps: ["connectPage.phone.claude.s1", "connectPage.phone.claude.s2", "connectPage.phone.claude.s3", "connectPage.phone.claude.s4"],
    shots: [["phone1"], ["phone2"], ["phone3"], ["phone4", "phone4b"]],
    device: null,
  },
  chatgpt: { id: "chatgpt", name: "ChatGPT", status: "unclear", guides: [{ name: "ChatGPT", href: "https://developers.openai.com/api/docs/guides/custom-mcp-server" }], checked: PHONE_CHECKED, steps: [], shots: [], device: null },
  leChat: { id: "leChat", name: "Mistral Le Chat", status: "unclear", guides: [{ name: "Mistral Le Chat", href: "https://docs.mistral.ai/vibe/work/connectors/mcp-connectors" }], checked: PHONE_CHECKED, steps: [], shots: [], device: null },
  perplexity: { id: "perplexity", name: "Perplexity", status: "unclear", guides: [{ name: "Perplexity", href: "https://www.perplexity.ai/help-center/en/articles/13915507-adding-custom-remote-connectors" }], checked: PHONE_CHECKED, steps: [], shots: [], device: null },
  gemini: { id: "gemini", name: "Gemini", status: "no", guides: [{ name: "Gemini", href: "https://support.google.com/gemini/answer/17209137" }], checked: PHONE_CHECKED, steps: [], shots: [], device: null },
  copilot: { id: "copilot", name: "Microsoft Copilot", status: "no", guides: [{ name: "Microsoft", href: "https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/configure-plugin-mcp-servers" }], checked: PHONE_CHECKED, steps: [], shots: [], device: null },
};

/** The vendor domains each phone block may link to (https, the domain or a subdomain) — never a third party. */
export const PHONE_GUIDE_DOMAINS: Readonly<Record<PhoneClientId, readonly string[]>> = {
  claude: ["claude.com"],
  chatgpt: ["openai.com"],
  leChat: ["mistral.ai"],
  perplexity: ["perplexity.ai"],
  gemini: ["google.com"],
  copilot: ["microsoft.com"],
};

/** A phone block's anchor on the connect page. */
export const phoneAnchor = (id: PhoneClientId): string => `phone-${id.replace(/[A-Z]/gu, (c) => `-${c.toLowerCase()}`)}`;

/** The one honest line of a `no` block names the client's own reason; an `unclear` block shares one line. */
const NO_REASON: Readonly<Partial<Record<PhoneClientId, MessageKey>>> = { gemini: "connectPage.phone.gemini", copilot: "connectPage.phone.copilot" };

function lineKey(c: PhoneClient): MessageKey {
  if (c.status !== "no") return "connectPage.phone.unclear";
  const k = NO_REASON[c.id];
  if (k === undefined) throw new Error(`#1106: phone block ${c.id} is ruled out without a reason of its own`);
  return k;
}

function guidesHtml(lang: Lang, c: PhoneClient): string {
  // two links to one vendor carry the same name; the second says which article by its number
  return `<p class="cguide">${esc(`${t(lang, "connectPage.guide")}:`)} ${c.guides
    .map((g, i) => `<a href="${esc(g.href)}" target="_blank" rel="noopener noreferrer" translate="no">${esc(c.guides.length > 1 ? `${g.name} ${String(i + 1)}` : g.name)}</a>`)
    .join(" · ")}</p>`;
}

/** One phone block's body: its steps (each with its capture) or its one line, its guides, its check line. */
export function phoneBlockHtml(lang: Lang, c: PhoneClient, shots: Readonly<Record<ShotId, ShotFile>>): string {
  const date = dayOf(lang, c.checked);
  const body =
    c.status === "steps"
      ? `<p>${esc(t(lang, "connectPage.phone.where"))}</p>` +
        `<ol class="csteps">${c.steps
          .map((k, i) => `<li><p>${esc(t(lang, k, { url: MCP_ENDPOINT }))}</p>${(c.shots[i] ?? []).map((id) => shotHtml(lang, id, shots[id])).join("")}</li>`)
          .join("")}</ol>`
      : `<p>${esc(t(lang, lineKey(c), { name: c.name, date }))}</p>`;
  const check =
    c.device === null
      ? `<p class="ccheck"><span class="draft">${esc(t(lang, "connectPage.phone.checked", { date }))}</span></p>`
      : `<p class="ccheck">${esc(t(lang, "connectPage.phone.device", { date: dayOf(lang, c.device.date), app: c.device.app }))}</p>`;
  return body + guidesHtml(lang, c) + check;
}

/** The whole `#phone` section's blocks, in order: the documented ones first, then the unclear, then the ruled-out. */
export function phoneClients(): readonly PhoneClient[] {
  const rank: Readonly<Record<PhoneStatus, number>> = { steps: 0, unclear: 1, no: 2 };
  return PHONE_CLIENT_IDS.map((id) => PHONE_CLIENTS[id]).sort((a, b) => rank[a.status] - rank[b.status]);
}
