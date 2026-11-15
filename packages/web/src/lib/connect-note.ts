/**
 * The shell's "works only with ViaFrei connected" note (#1001), in the page's
 * language: `@viafrei/design`'s `connectNote` with the deck's words, the
 * endpoint chip (#1003) and one line of assistant names, each linking to its
 * own steps on the connect page, read from that page's own list
 * (`site/connect-clients.ts`). Every renderer of an example answer —
 * `Answer.astro`, `LiveCard.astro`, `answerHtml` (the live answers of the
 * home, the examples page and the place cards) and the hero's sign — calls
 * this with the surface's `source`, so no surface can show an answer without
 * it (`test/connect-note.test.ts` holds every one to it).
 */
import { connectNote, endpointChip, esc, type ConnectSource, type EndpointChipWords, type Html } from "@viafrei/design";
import { t } from "../i18n/index.js";
import { NOTE_CLIENTS, clientHref } from "../site/connect-clients.js";
import { MCP_ENDPOINT } from "../site/endpoints.js";
import { pathFor, type Lang } from "../site/pages.js";

/** Where the note's links lead: the connect page's client list. */
export const connectGuideHref = (lang: Lang): string => `${pathFor("connect", lang)}#clients`;

/** The endpoint chip's words in `lang` (#1003). */
export const chipWords = (lang: Lang): EndpointChipWords => ({ endpoint: MCP_ENDPOINT, copy: esc(t(lang, "connectNote.copy")), copied: esc(t(lang, "connectNote.copied")) });

/** The endpoint chip on its own (the connect page, the "connected in 60 seconds" block), for one surface. */
export function endpointChipHtml(lang: Lang, source: ConnectSource): Html {
  return endpointChip({ ...chipWords(lang), source });
}

/** The note with its in-place how-to, for one surface. */
export function connectNoteHtml(lang: Lang, source: ConnectSource): Html {
  return connectNote({
    text: esc(t(lang, "connectNote.text")),
    link: esc(t(lang, "connectNote.link")),
    href: connectGuideHref(lang),
    source,
    chip: chipWords(lang),
    how: {
      endpointLabel: esc(t(lang, "connect.endpointLabel")),
      clientsLabel: esc(t(lang, "connectNote.clients")),
      clients: NOTE_CLIENTS.map((c) => ({ name: esc(c.name), href: clientHref(lang, c.id) })),
      guide: esc(t(lang, "connectNote.guide")),
    },
  });
}
