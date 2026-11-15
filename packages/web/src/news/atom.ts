/**
 * The News page's Atom feed, one per language (#588): `/<lang>/news.xml` (#892; German's was `/de/neuigkeiten.xml`),
 * `/en/news.xml`, …. RFC 4287: a feed `id`, `title`, `updated` and `author`,
 * and per entry an `id`, `title`, `updated`, an alternate `link` and a
 * `summary`. No tracking parameter in any link, no cookie, no script.
 *
 * It carries the approved "New" and "Plans" entries only. The traffic
 * announcements are live rows that expire by the hour; a feed reader keeps
 * what it fetched, so a closure put in a feed would outlive its end — they
 * stay on the page, where the digest judges expiry at every render.
 *
 * The feed's `updated` is the newest entry SHOWN in that language (an entry
 * with no text in a language is not in its feed, so it cannot move it), and
 * every date is the Berlin release day: an entry's day is a calendar day in
 * Europe/Berlin, so it is stamped as that day's local midnight with the
 * offset in force then — `+02:00` in summer time, `+01:00` in winter — and
 * never as UTC midnight, which is 01:00 or 02:00 in Berlin and a different
 * instant from the day the release was cut (review N4).
 */
import catalogue from "../generated/catalogue.json" with { type: "json" };
import { datedCredit } from "../site/attribution-year.js";
import { isLang, t } from "../i18n/index.js";
import { SITE_ORIGIN } from "../site/endpoints.js";
import { pathFor, type Lang } from "../site/pages.js";
import { entriesFor, newestNewsDate, NEWS_ENTRIES, type NewsEntry } from "./entries.js";
import { dateTimeFormat } from "../lib/intl-formats.js";

/**
 * `YYYY-MM-DD` → that day's 00:00 in Europe/Berlin as an RFC 3339 instant with
 * its offset. Of the two offsets Berlin uses, the one whose instant reads
 * 00:00 on that day in Berlin is the right one — on the two switch days too,
 * since both switches happen after midnight (02:00 and 03:00 local).
 */
export function berlinDay(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (m === null) throw new Error(`not a day: ${day}`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const fmt = dateTimeFormat("en-GB", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  for (const off of [1, 2]) {
    const parts = Object.fromEntries(fmt.formatToParts(new Date(Date.UTC(y, mo - 1, d) - off * 3_600_000)).map((p) => [p.type, p.value]));
    if (`${parts["year"]}-${parts["month"]}-${parts["day"]}` === day && parts["hour"] === "00" && parts["minute"] === "00") return `${day}T00:00:00+0${off}:00`;
  }
  throw new Error(`no Berlin midnight found for ${day}`);
}

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The feed's own path for a language: the page's path with `.xml`. */
export function feedPath(lang: Lang): string {
  return `${pathFor("news", lang)}.xml`;
}

export function atomFeed(lang: Lang, entries: readonly NewsEntry[] = NEWS_ENTRIES, now: Date = new Date()): string {
  const page = `${SITE_ORIGIN}${pathFor("news", lang)}`;
  const shown = entriesFor(lang, entries);
  const updated = berlinDay(newestNewsDate(shown));
  // #804: a line naming the year of retrieval says the reader's Berlin year, by this request's clock.
  const credit = new Map(catalogue.credits.map((c) => [c.id, datedCredit(c.text, now)]));
  const items = shown.map((e) => {
    const sources = e.credits.map((id) => credit.get(id)).filter((x): x is string => x !== undefined);
    // A plan: "planned, no date yet", its question under "once it is there", and no source lines.
    const summary =
      e.kind === "plan"
        ? `${t(lang, "newsPage.badgePlan")}, ${t(lang, "newsPage.plannedNote")}. ${e.t.body} ${t(lang, "newsPage.askLabelPlan")}: ${e.t.ask}`
        : `${e.t.body} ${t(lang, "newsPage.askLabel")}: ${e.t.ask} — ${t(lang, "newsPage.sources")}: ${[...new Set(sources)].join("; ")}`;
    return (
      `<entry><id>${esc(`${page}#${e.id}`)}</id><title>${esc(e.t.title)}</title>` +
      `<updated>${berlinDay(e.date)}</updated><published>${berlinDay(e.date)}</published>` +
      `<link rel="alternate" type="text/html" href="${esc(`${page}#${e.id}`)}"/>` +
      `<category term="${e.kind}"/><summary>${esc(summary)}</summary></entry>`
    );
  });
  return (
    `<?xml version="1.0" encoding="utf-8"?>\n` +
    `<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${lang}">` +
    `<id>${esc(`${SITE_ORIGIN}${feedPath(lang)}`)}</id>` +
    `<title>${esc(`${t(lang, "newsPage.title")} — ${t(lang, "meta.siteName")}`)}</title>` +
    `<subtitle>${esc(t(lang, "newsPage.lead"))}</subtitle>` +
    `<updated>${updated}</updated>` +
    `<author><name>ViaFrei</name><uri>${SITE_ORIGIN}/</uri></author>` +
    `<link rel="self" type="application/atom+xml" href="${esc(`${SITE_ORIGIN}${feedPath(lang)}`)}"/>` +
    `<link rel="alternate" type="text/html" href="${esc(page)}"/>` +
    items.join("") +
    `</feed>\n`
  );
}

/** The feed when `/${lang}/${word}.xml` IS that language's feed path; a 404 otherwise (the two feed routes share it). */
export function feedResponse(lang: string, word: string): Response {
  if (!isLang(lang) || feedPath(lang) !== `/${lang}/${word}.xml`) return new Response("Not found\n", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return new Response(atomFeed(lang), { headers: { "Content-Type": "application/atom+xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
