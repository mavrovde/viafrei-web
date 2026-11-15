/**
 * `/` picks its language from `Accept-Language` (#380, #375 A4): q-values
 * honoured, a region tag matches its base language (`en-GB` → `en`), `*`
 * means "anything" and gets the default, an unreviewed locale is never chosen,
 * and anything unparseable or absent falls back to German — also when German
 * itself was refused (`de;q=0`): the site has no third language to offer, and
 * the language list is one click away on every page. The answer is 200
 * with `Vary: Accept-Language` at `/` itself — no redirect, so no link breaks.
 */
import { DEFAULT_LANG, type Lang } from "../site/pages.js";
import { LOCALES, reviewedLocales, type Locale } from "./locales.js";

type Ranged = { readonly tag: string; readonly q: number; readonly order: number };

function parse(header: string): Ranged[] {
  const out: Ranged[] = [];
  header.split(",").forEach((part, order) => {
    const [rawTag, ...params] = part.trim().split(";");
    const tag = (rawTag ?? "").trim().toLowerCase();
    if (tag === "" || !/^(\*|[a-z]{1,8}(-[a-z0-9]{1,8})*)$/.test(tag)) return;
    let q = 1;
    for (const p of params) {
      const m = /^\s*q\s*=\s*([0-9.]+)\s*$/i.exec(p);
      if (m) q = Number(m[1]);
    }
    if (!Number.isFinite(q) || q <= 0 || q > 1) return;
    out.push({ tag, q, order });
  });
  // Highest q first; equal q keeps the visitor's own order.
  return out.sort((a, b) => b.q - a.q || a.order - b.order);
}

export function negotiate(header: string | null | undefined, list: readonly Locale[] = LOCALES): Lang {
  if (!header) return DEFAULT_LANG;
  const reviewed = reviewedLocales(list).map((l) => l.code);
  for (const r of parse(header)) {
    if (r.tag === "*") return DEFAULT_LANG;
    const base = r.tag.split("-")[0] ?? "";
    if (reviewed.includes(base)) return base as Lang;
  }
  return DEFAULT_LANG;
}
