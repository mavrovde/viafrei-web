/**
 * #1090 (owner 2026-10-28): the body of a connect-page client block beyond its one-line steps — the numbered steps
 * with their REAL screenshots (Claude), a diagram in our own style where no screenshot exists (ChatGPT, captioned
 * "Diagram, not a screenshot" and never an <img>), the terminal transcripts of the clients we really connected
 * (Claude Code, Gemini CLI, the MCP Inspector for "any other client", the stdio bridge), the client's official
 * guides, and the row's own check line: "checked in the client on <date> with <version>", or, where only the
 * vendor's guide was checked, that and the reason, as a draft line.
 *
 * The screenshots show the client's own English UI. That is the assistant's interface, not this page's text, so it
 * does not break the one-language-per-page rule; every word WE write about it (alt text, caption) is in the page's
 * language. Each image shows only the connector menu, its dialog, the prompt and ViaFrei's answer; each was checked for anything else
 * before it was committed (owner 2026-10-28), and resized, never re-cropped.
 *
 * Full size without a script (the page's CSP gives a script a nonce; this needs none): the thumbnail is a link to
 * the figure's own `#…-full` anchor, the full image sits in that anchor and is shown only while it is `:target`
 * (`site.css`), and a click on it goes back to the figure. Both images are the same file, so the full view costs no
 * second download; while hidden, the lazy full image is not fetched at all.
 *
 * The image files are imported by the Astro page (hashed under /_a/) and handed in as `shots`, so this module stays
 * plain TypeScript and the unit test renders it directly.
 */
import { esc } from "./answer-html.js";
import { t } from "../i18n/index.js";
import { SHOTS_TAKEN, SHOT_META, isVerified, type ConnectClient, type ShotId } from "../site/connect-clients.js";
import { htmlLangOf } from "../i18n/locales.js";
import { dateTimeFormat } from "./intl-formats.js";
import type { Lang } from "../site/pages.js";

/** What the page hands in per screenshot: the hashed URL and the file's own size (no layout shift). */
export type ShotFile = { readonly src: string; readonly width: number; readonly height: number };

const SHOT_ALT: Readonly<Record<ShotId, `connectPage.shot.${ShotId}`>> = {
  claude1: "connectPage.shot.claude1",
  claude2: "connectPage.shot.claude2",
  claude3: "connectPage.shot.claude3",
  claude4: "connectPage.shot.claude4",
  phone1: "connectPage.shot.phone1",
  phone2: "connectPage.shot.phone2",
  phone3: "connectPage.shot.phone3",
  phone4: "connectPage.shot.phone4",
  phone4b: "connectPage.shot.phone4b",
  claudeCode1: "connectPage.shot.claudeCode1",
  geminiCli1: "connectPage.shot.geminiCli1",
  generic1: "connectPage.shot.generic1",
  stdio1: "connectPage.shot.stdio1",
};

/** A calendar day (`YYYY-MM-DD`) in the page's own date format. */
export function dayOf(lang: Lang, iso: string): string {
  return dateTimeFormat(htmlLangOf(lang), { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" }).format(new Date(`${iso}T12:00:00Z`));
}

/** The day the claude.ai screenshots were taken, in the page's own date format. */
export function shotDate(lang: Lang): string {
  return dayOf(lang, SHOTS_TAKEN);
}

/** The figure's id, and the id of its full-size view (`<figure id>` and `<a id>` on the same page). */
export const shotAnchor = (id: ShotId): string => `shot-${id}`;
export const shotFullAnchor = (id: ShotId): string => `shot-${id}-full`;

/** One image's caption: a screenshot of the client's own UI (on a computer, or in a phone's browser, #1106), or the transcript of our container run. */
export function shotCaption(lang: Lang, id: ShotId): string {
  const m = SHOT_META[id];
  const date = dayOf(lang, m.taken);
  if (m.kind === "phone") return t(lang, "connectPage.shot.phoneCaption", { date });
  return m.kind === "screen" ? t(lang, "connectPage.shot.caption", { date }) : t(lang, "connectPage.shot.terminal", { what: m.what, date });
}

/** One figure: the thumbnail, its caption and its script-free full-size view (also used by the phone steps, #1106). */
export function shotHtml(lang: Lang, id: ShotId, f: ShotFile): string {
  const alt = t(lang, SHOT_ALT[id]);
  const size = `width="${String(f.width)}" height="${String(f.height)}"`;
  return (
    `<figure class="cshot" id="${shotAnchor(id)}">` +
    `<a class="cshot__open" href="#${shotFullAnchor(id)}" aria-label="${esc(`${alt} ${t(lang, "connectPage.shot.open")}`)}">` +
    `<img src="${esc(f.src)}" ${size} loading="lazy" decoding="async" alt="${esc(alt)}"></a>` +
    `<figcaption>${esc(shotCaption(lang, id))}</figcaption>` +
    `<a class="cshot__full" id="${shotFullAnchor(id)}" href="#${shotAnchor(id)}" aria-label="${esc(t(lang, "connectPage.shot.close"))}">` +
    `<img src="${esc(f.src)}" ${size} loading="lazy" decoding="async" alt=""></a>` +
    `</figure>`
  );
}

function diagramHtml(d: NonNullable<NonNullable<ConnectClient["flow"]>["diagram"]>): string {
  // our own boxes and arrows (CSS), never an imitation of the client's look; the list IS the diagram in words
  return (
    `<figure class="cdiag" aria-label="${esc(d.title)}">` +
    `<ol class="cdiag__steps">${d.boxes.map((b) => `<li class="cdiag__box">${esc(b)}</li>`).join("")}</ol>` +
    `<figcaption>${esc(d.caption)}</figcaption></figure>`
  );
}

/** The row's own check line: verified in the client (date, version), or checked against the guide only, with the reason — a draft line. */
export function checkHtml(lang: Lang, c: ConnectClient): string {
  const k = c.check;
  if (isVerified(k)) return `<p class="ccheck">${esc(t(lang, "connectPage.check.verified", { date: dayOf(lang, k.verified.date), version: k.verified.version }))}</p>`;
  const reason = t(lang, `connectPage.check.pending.${k.pending}`);
  return `<p class="ccheck"><span class="draft">${esc(t(lang, "connectPage.check.docs", { date: dayOf(lang, k.docs), reason }))}</span></p>`;
}

/** The block's body after its one-line steps (and its snippet): flow, availability, diagram, images, guides, check line. */
export function clientExtrasHtml(lang: Lang, c: ConnectClient, shots: Readonly<Record<ShotId, ShotFile>>): string {
  const flow =
    c.flow === undefined
      ? ""
      : `<ol class="csteps">${c.flow.steps.map((s) => `<li><p>${esc(s.text)}</p>${s.shots.map((id) => shotHtml(lang, id, shots[id])).join("")}</li>`).join("")}</ol>` +
        (c.flow.avail === undefined ? "" : `<p class="muted">${esc(c.flow.avail)}</p>`) +
        (c.flow.diagram === undefined ? "" : diagramHtml(c.flow.diagram));
  const own = c.shots.map((id) => shotHtml(lang, id, shots[id])).join("");
  const label = c.id === "generic" ? t(lang, "connectPage.otherGuides") : `${t(lang, "connectPage.guide")}:`;
  const guides =
    c.guides.length === 0
      ? ""
      : `<p class="cguide">${esc(label)} ${c.guides.map((g) => `<a href="${esc(g.href)}" target="_blank" rel="noopener noreferrer" translate="no">${esc(g.name)}</a>`).join(" · ")}</p>`;
  return flow + own + guides + checkHtml(lang, c);
}
