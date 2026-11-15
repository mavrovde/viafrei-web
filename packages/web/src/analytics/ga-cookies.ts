/**
 * Expire Google Analytics' own cookies (launch audit F-10).
 *
 * Withdrawing consent (Art. 7 Abs. 3 DSGVO) and declining it (§ 25 TDDDG)
 * deleted only OUR decision in localStorage. The cookies gtag.js had already
 * written under an earlier consent — `_ga`, `_ga_<container>`, and the legacy
 * `_gid` / `_gat*` — stayed in the browser for up to two years, which is
 * storage the visitor has just said no to. This expires them.
 *
 * gtag.js writes with `cookie_domain: auto`: the HIGHEST domain that accepts a
 * cookie, `.viafrei.de` from `www.viafrei.de`. A cookie is only removed by a
 * write naming the same domain and path, so every candidate is written —
 * host-only, then each parent domain except the bare TLD — at `path=/`. A write
 * that names a domain the cookie does not have changes nothing, so the extra
 * writes are harmless.
 *
 * Pure over a cookie jar and a host name, so the unit test needs no browser;
 * the components pass `document` and `location.hostname`.
 */

/** A GA cookie name: `_ga`, `_ga_<id>`, `_gid`, `_gat`, `_gat_<id>`. */
export const GA_COOKIE = /^_(ga(_.+)?|gid|gat(_.+)?)$/;

/** The domain attributes to try for one host: none (host-only), then every parent above the TLD. */
export function cookieDomains(hostname: string): (string | null)[] {
  const out: (string | null)[] = [null];
  // An address is not a domain: a cookie set on 127.0.0.1 is host-only.
  if (/^[\d.]+$/.test(hostname) || hostname.includes(":") || !hostname.includes(".")) return out;
  const labels = hostname.split(".");
  for (let i = 0; i <= labels.length - 2; i++) out.push(`.${labels.slice(i).join(".")}`);
  return out;
}

/**
 * #717: Microsoft Clarity's first-party cookies, `_clck` (the visitor) and
 * `_clsk` (the session). Its other cookies (`CLID`, `MUID`, …) live on
 * clarity.ms and bing.com, which a page of ours cannot write; Clarity's own
 * `consentV2` denied signal is what reaches those.
 */
export const CLARITY_COOKIE = /^_(clck|clsk)$/;

/** Expire every GA cookie the jar shows; returns the names it expired. */
export function expireGaCookies(jar: { cookie: string }, hostname: string): string[] {
  return expireCookies(jar, hostname, GA_COOKIE);
}

/** Expire every Clarity first-party cookie the jar shows (#717); returns the names it expired. */
export function expireClarityCookies(jar: { cookie: string }, hostname: string): string[] {
  return expireCookies(jar, hostname, CLARITY_COOKIE);
}

/** Expire every cookie whose name matches, on every domain it can carry; returns the names it expired. */
export function expireCookies(jar: { cookie: string }, hostname: string, pattern: RegExp): string[] {
  const names = [
    ...new Set(
      jar.cookie
        .split(";")
        .map((c) => c.split("=")[0]?.trim() ?? "")
        .filter((n) => pattern.test(n)),
    ),
  ];
  for (const name of names) {
    for (const domain of cookieDomains(hostname)) {
      jar.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=/${domain === null ? "" : `; domain=${domain}`}; SameSite=Lax`;
    }
  }
  return names;
}
