/**
 * The endpoint chip (#1003, owner 2026-10-25: "make the address more visible
 * everywhere"): the ONE way any surface shows the MCP address — the connect
 * note's expansion and its fragment shape, the connect page, the "connected in
 * 60 seconds" block, the digest's motorway assistant block. No second copy of
 * its markup or its styling exists (`test/endpoint-chip.test.ts` and
 * `packages/web/test/endpoint-chip.test.ts` hold every surface to it).
 *
 * What it is, as markup:
 *   - the address in a `<code translate="no">`, read by a screen reader as ONE
 *     URL (no separator is written into the text): the scheme and host in one
 *     span that never wraps (the host is emphasised), a `<wbr>`, then the path —
 *     so at 320 px the only break is before `/mcp`;
 *   - a copy button, `hidden` in the markup, its glyph (two sheets, a tick once
 *     copied) drawn by the stylesheet so no chip repeats an inline SVG: only the shell's copy script
 *     (`packages/web/src/lib/endpoint-copy.ts`) reveals it, so without a script
 *     — and in every digest fragment, which carries none — the address is plain
 *     selectable text and no dead button is shown. Its accessible name is the
 *     language's "copy address", and the word it shows afterwards travels in
 *     its `value` — no `data-` attribute, because a digest fragment may carry
 *     none but the surface word (the licence sweep of `app.test.ts`);
 *   - an empty `role="status"` region the script writes that word into, so the
 *     success is announced (polite) as well as shown.
 *
 * `data-cta-source` names the surface (the closed list of `connect-note.ts`):
 * after a copy the script hands it to the consent-gated analytics listener,
 * which sends `cta_connect_click` with `where: "copy"`. Pure: a function of its
 * arguments; the words arrive as `Html` (escaped by the caller).
 */
import { C } from "./classes.js";
import { CONNECT_SOURCE_ATTR, type ConnectSource } from "./surfaces.js";
import { esc, raw, type Html } from "./html.js";

export type EndpointChipWords = {
  /** The address to show and copy (`https://mcp.viafrei.de/mcp`). */
  readonly endpoint: string;
  /** The copy button's accessible name ("Adresse kopieren"). */
  readonly copy: Html;
  /** The word shown and announced after a copy ("Kopiert"). */
  readonly copied: Html;
};

export type EndpointChip = EndpointChipWords & { readonly source: ConnectSource };

/** The address cut where it may break: everything up to the path (never broken) and the path. */
export function splitEndpoint(url: string): { readonly scheme: string; readonly host: string; readonly path: string } {
  // `/^([a-z][a-z0-9+.-]*:\/\/)([^/]*)(.*)$/iu` without its backtracking (the host and the path both matched what is
  // not a slash, quadratic on an address whose path holds a line break): the host runs to the first slash, the path is
  // the rest, and a path holding a line terminator (which `.` never matches) is no match, as before
  const scheme = /^[a-z][a-z0-9+.-]*:\/\//iu.exec(url)?.[0];
  const slash = scheme === undefined ? -1 : url.indexOf("/", scheme.length);
  const path = slash < 0 ? "" : url.slice(slash);
  if (scheme === undefined || /[\n\r\u2028\u2029]/u.test(path)) return { scheme: "", host: url, path: "" };
  return { scheme, host: url.slice(scheme.length, slash < 0 ? url.length : slash), path };
}

/** The chip. */
export function endpointChip(c: EndpointChip): Html {
  const { scheme, host, path } = splitEndpoint(c.endpoint);
  const url =
    `<code class="${C.endpointChipUrl}" translate="no">` +
    `<span class="${C.endpointChipHost}"><span class="${C.endpointChipScheme}">${esc(scheme)}</span>${esc(host)}</span>` +
    (path === "" ? "" : `<wbr><span class="${C.endpointChipPath}">${esc(path)}</span>`) +
    `</code>`;
  const button =
    `<button type="button" class="${C.endpointChipCopy}" value="${c.copied}" aria-label="${c.copy}" title="${c.copy}" hidden>` +
    `</button>`;
  return raw(`<span class="${C.endpointChip}" ${CONNECT_SOURCE_ATTR}="${esc(c.source)}">${url}${button}<span class="${C.endpointChipStatus}" role="status" aria-live="polite"></span></span>`);
}
