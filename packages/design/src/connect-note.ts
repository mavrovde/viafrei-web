/**
 * The "works only with ViaFrei connected" note (#1001, owner 2026-10-24: "It
 * should be clear that it will work only with ViaFrei connected"): ONE
 * building block under every example answer the site shows, so a reader never
 * takes an answer for something any chatbot knows.
 *
 * Two shapes, one look:
 *   - with `how`, a `<details>` whose summary is the plug, the sentence and the
 *     link-styled "how to connect"; it opens IN PLACE (no script) onto the
 *     endpoint chip, ONE line of assistant names — each a link to its own steps
 *     on the connect page (#1003, owner 2026-10-25: "Mention more ai assistants,
 *     not only chatgpt") — and the link to the full guide;
 *   - without `how` (a digest fragment, which holds no copy of the shell's
 *     client list), the same plug and sentence, the endpoint chip (#1003) when
 *     the caller passes one, and a plain link straight to the guide.
 *
 * Every link to the connect page carries `data-cta-source`, the surface's
 * word, which the shell's one analytics listener reads (`cta_connect_click`,
 * behind consent). The words come in as `Html` (escaped by the caller), the
 * attribute values are escaped here.
 */
import { C } from "./classes.js";
import { endpointChip, type EndpointChipWords } from "./endpoint-chip.js";
import { esc, raw, type Html } from "./html.js";
import { CONNECT_SOURCE_ATTR, type ConnectSource } from "./surfaces.js";

export { CONNECT_SOURCES, CONNECT_SOURCE_ATTR, isConnectSource, type ConnectSource } from "./surfaces.js";

export type ConnectNoteHow = {
  /** The endpoint's label ("MCP-Endpunkt (Streamable HTTP)"). */
  readonly endpointLabel: Html;
  /** The words before the names ("Schritt für Schritt für"). */
  readonly clientsLabel: Html;
  /** The assistants, one line: each name and its anchor on the connect page. */
  readonly clients: readonly { readonly name: Html; readonly href: string }[];
  /** The full guide's link text. */
  readonly guide: Html;
};

export type ConnectNote = {
  /** "Diese Antwort gibt Ihr KI-Assistent nur, wenn ViaFrei verbunden ist." */
  readonly text: Html;
  /** "So verbinden Sie ViaFrei" (the arrow is drawn here, hidden from a screen reader). */
  readonly link: Html;
  /** The full guide: `/<lang>/connect#clients`. */
  readonly href: string;
  readonly source: ConnectSource;
  /** The endpoint chip's words (#1003): in the expansion, or beside the plain link of a fragment. */
  readonly chip?: EndpointChipWords;
  /** The expansion; absent on a fragment that cannot hold it, where the link goes straight to `href`. */
  readonly how?: ConnectNoteHow;
};

/** A small plug, drawn in the text colour; decorative. */
export const PLUG_ICON =
  `<svg class="${C.connectNoteIcon}" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">` +
  `<path d="M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const ARROW = `<span aria-hidden="true"> →</span>`;

const sourced = (source: ConnectSource): string => `${CONNECT_SOURCE_ATTR}="${esc(source)}"`;

function guideLink(cls: string, href: string, source: ConnectSource, words: Html): string {
  return `<a class="${cls}" href="${esc(href)}" ${sourced(source)}>${words}${ARROW}</a>`;
}

/** The note, in one of its two shapes. */
export function connectNote(n: ConnectNote): Html {
  const text = `<span class="${C.connectNoteText}">${n.text}</span>`;
  const chip = n.chip === undefined ? "" : ` ${endpointChip({ ...n.chip, source: n.source })}`;
  if (n.how === undefined) {
    return raw(`<p class="${C.connectNote}">${PLUG_ICON}${text}${chip} ${guideLink(C.connectNoteLink, n.href, n.source, n.link)}</p>`);
  }
  const h = n.how;
  const names = h.clients.map((c) => `<a href="${esc(c.href)}" ${sourced(n.source)}>${c.name}</a>`).join(", ");
  return raw(
    `<details class="${C.connectNote}">` +
      `<summary class="${C.connectNoteSummary}">${PLUG_ICON}${text} <span class="${C.connectNoteLink}">${n.link}${ARROW}</span></summary>` +
      `<div class="${C.connectNoteBody}">` +
      `<p>${h.endpointLabel}:${chip}</p>` +
      `<p class="${C.connectNoteClients}">${h.clientsLabel}: <span translate="no">${names}</span></p>` +
      `<p>${guideLink(C.connectNoteGuide, n.href, n.source, h.guide)}</p>` +
      `</div></details>`,
  );
}
