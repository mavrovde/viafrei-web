/**
 * The Content-Security-Policy of every page on viafrei.de (#375 A6, #376 S2/S3).
 *
 * This file mirrors `contentSecurityPolicy()` in
 * `packages/digest/src/presentation/render.ts` on purpose — same two cases,
 * same Google origins, same shape — and differs in exactly one place: the
 * digest styles its page inline (`style-src 'unsafe-inline'`), this site ships
 * ONE external stylesheet and allows nothing else (`style-src 'self'`).
 *
 * Three cases, decided by `GOOGLE_TAG` and by whether the rendered page
 * carries a script at all:
 *
 *   • no tag, no script: `script-src 'none'`. A page with no island has no
 *              `<script>` element (asserted by `e2e/csp.e2e.ts`), so the
 *              policy says so. Its `style-src` carries the request's nonce
 *              like every page's (#1103, `noScriptPolicy`).
 *   • no tag, a script: `script-src 'nonce-…' 'strict-dynamic'` and nothing
 *              else — the "Mein Tag" filter of the place cards (#404, #798)
 *              is one inline script under the nonce; no Google origin, no `'self'`. The page
 *              declares it (`Astro.locals.hasScript`); the HTML is not sniffed.
 *   • a tag:   `script-src 'nonce-…' 'strict-dynamic' <googletagmanager>`.
 *              The consent island is the one script on the content pages,
 *              and the Datenschutz page carries one more island — the
 *              withdraw control, which only deletes the stored decision
 *              (Art. 7 Abs. 3 DSGVO; deviation from #379's "one island"
 *              recorded there). Each carries the nonce,
 *              and `'strict-dynamic'` is what lets the island loader load
 *              its two modules dynamically and append the gtag.js element without opening
 *              `'self'` — which is the decisive difference from the digest's
 *              hand-written inline script (spike S3 records the measurement).
 *
 * Pure: a function of its arguments, no request, no framework import, so the
 * root vitest can test it without Astro.
 */

export const GTAG_ORIGIN = "https://www.googletagmanager.com";

/**
 * #717: Microsoft Clarity's origins, as Microsoft's own CSP page lists them
 * ("Clarity Content Security Policy", learn.microsoft.com/clarity/setup-and-
 * installation/clarity-csp, read 2026-10-26): `https://*.clarity.ms` (the tag
 * at www., the script at scripts., the collect endpoints at a.–z.) and
 * `https://c.bing.com`. Microsoft puts them in `default-src`; ours is
 * `'none'`, so they go into the three directives Clarity uses — script,
 * connect, img — and its `'unsafe-inline'` is NOT copied. Named only on a page
 * that carries the consent island, and only with a tag and an id.
 */
export const CLARITY_ORIGINS = ["https://*.clarity.ms", "https://c.bing.com"] as const;

/** The origins a page may contact once analytics is consented to — the digest's list, verbatim. */
export const GA_CONNECT_ORIGINS = [
  "https://www.google-analytics.com",
  "https://*.google-analytics.com",
  "https://*.analytics.google.com",
  GTAG_ORIGIN,
] as const;

/**
 * The policy of an answer with NO BODY (a redirect, `securedRedirect`): nothing
 * runs, nothing is styled inline. `connect-src 'self'` lets the browser fetch
 * THIS origin's own files (a crawler's robots.txt read from the page context
 * was refused under `default-src 'none'` — Lighthouse, #381).
 */
export const CSP_NO_SCRIPT =
  "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; " +
  "style-src 'self'; img-src 'self'; connect-src 'self'; script-src 'none'; manifest-src 'self'";

/**
 * The policy of a PAGE without a tag and without a script: nothing runs, and
 * styles come from the stylesheet and from this request's nonce (#1103). The
 * nonce is on every page, whether or not it carries a script, because a page's
 * own `<style>` (the station, motorway and catalogue pages carry their page CSS
 * inline, `layouts/*.astro`) does not depend on its script: under the old
 * `style-src 'self'` the station catalogue rendered with browser defaults until
 * 2.4.6 gave it a script by accident. `script-src 'none'` is unchanged.
 */
export function noScriptPolicy(nonce: string): string {
  return CSP_NO_SCRIPT.replace("style-src 'self';", `style-src 'self' 'nonce-${nonce}';`);
}

/** 16 random bytes, base64url — one per request, never reused. */
export function newNonce(bytes: (n: number) => Uint8Array): string {
  return Buffer.from(bytes(16)).toString("base64url");
}

/**
 * #716: a page that carries a GET form of its own (the motorway page's
 * stretch filter) may submit it to THIS origin — `form-action 'self'` — and
 * nowhere else. Every other page keeps `form-action 'none'`. The page
 * declares it (`Astro.locals.hasForm`): the motorway page sets it from the
 * digest fragment it embeds (`carriesMotorwayForm`), never from its own HTML.
 */
const formAction = (hasForm: boolean): string => (hasForm ? "form-action 'self'" : "form-action 'none'");

/**
 * #1181 feature 7: every page links the web manifest (`manifest-src 'self'`, in `CSP_NO_SCRIPT` and both script
 * policies), and a page with a script may register THIS origin's service worker (`worker-src 'self'`, the star's
 * `/sw.js`); a page with no script runs no worker.
 */
const PWA = "manifest-src 'self'; worker-src 'self'";

export function contentSecurityPolicy(nonce: string, googleTag: string | undefined, hasScript = false, hasForm = false, clarity = false): string {
  const p = policy(nonce, googleTag, hasScript, clarity);
  return hasForm ? p.replace("form-action 'none'", formAction(true)) : p;
}

function policy(nonce: string, googleTag: string | undefined, hasScript: boolean, clarity: boolean): string {
  const tagged = googleTag !== undefined && googleTag !== "";
  if (!/^[A-Za-z0-9_-]{16,}$/.test(nonce)) throw new Error("csp: a nonce must be at least 16 base64url characters");
  if (!tagged && !hasScript) return noScriptPolicy(nonce);
  if (!tagged)
    return (
      "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; " +
      `style-src 'self' 'nonce-${nonce}'; ` +
      `script-src 'nonce-${nonce}' 'strict-dynamic'; ` +
      `connect-src 'self'; img-src 'self'; ${PWA}`
    );
  // #717: the consent island is rendered only with a tag, so Clarity's origins exist only in this, the tagged, case.
  const cl = clarity ? ` ${CLARITY_ORIGINS.join(" ")}` : "";
  return (
    "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; " +
    // The island runtime Astro emits carries `astro-island{display:contents}`
    // as an inline <style>; the nonce is written onto it by the middleware so
    // the stylesheet rule stays `'self'` plus this one request's nonce.
    `style-src 'self' 'nonce-${nonce}'; ` +
    `script-src 'nonce-${nonce}' 'strict-dynamic' ${GTAG_ORIGIN}${cl}; ` +
    `connect-src 'self' ${GA_CONNECT_ORIGINS.join(" ")}${cl}; ` +
    `img-src 'self' https://www.google-analytics.com${cl}; ${PWA}`
  );
}

/**
 * Write the nonce onto every `<script` and `<style` element of a rendered
 * page. Astro's island runtime is an inline script it emits for us, so the
 * nonce cannot be written in a template; it is written here, once, on the way
 * out. Our own markup never carries the characters `<script` or `<style` as
 * TEXT — content is escaped — so the two tokens are elements and nothing else.
 */
export function withNonce(html: string, nonce: string): string {
  // An element a template already gave the nonce (the JSON-LD data block, #531) is left as it is: one nonce attribute, never two.
  return html.replace(/<script\b(?![^>]*\snonce=)/g, `<script nonce="${nonce}"`).replace(/<style\b(?![^>]*\snonce=)/g, `<style nonce="${nonce}"`);
}

/**
 * The headers every HTML response carries besides the CSP.
 *
 * `Referrer-Policy: same-origin` (#1110 item 5, was `no-referrer`): a click from one of our pages to another sends the
 * page it came from, so the landing log can tell a second page view from a new "direct" visit (under `no-referrer`
 * every internal click arrived with no Referer — 1,795 of 1,998 visitors read as "direct"); a click to ANY other site
 * still sends nothing at all, not even our origin — stricter towards third parties than the browsers' default
 * `strict-origin-when-cross-origin`. The language redirect reads a Referer on our host as a click of ours already.
 */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(self), interest-cohort=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};

/**
 * 2.4.4 review N1: a redirect the middleware answers before any page renders (the language 302, the legacy 301)
 * carries the same security headers as a page — the strictest CSP (a redirect has no body to run or style) and
 * {@link SECURITY_HEADERS} — rather than none. The redirect's own headers (location, cache-control, vary, a cookie)
 * are kept.
 */
export function securedRedirect(r: Response): Response {
  const headers = new Headers(r.headers);
  headers.set("Content-Security-Policy", CSP_NO_SCRIPT);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
  return new Response(null, { status: r.status, statusText: r.statusText, headers });
}
