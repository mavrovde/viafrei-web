import { randomBytes } from "node:crypto";
import { defineMiddleware } from "astro:middleware";
import { logLine } from "./lib/log.js";
import { DEGRADED_HEADER } from "./lib/degraded.js";
import { readEnv } from "./lib/env.js";
import { legacyDecision, legacyRedirect } from "./lib/legacy-redirects.js";
import { budgetFrom } from "./lib/page-budget.js";
import { routeTemplate } from "./lib/log-mask.js";
import { SECURITY_HEADERS, contentSecurityPolicy, newNonce, securedRedirect, withNonce } from "./security/csp.js";
import { clarityConfigOf } from "./analytics/clarity.js";
import { mapPlatformOfUserAgent } from "@viafrei/design";
import { varyWith } from "./lib/vary.js";
import { currentAgentClass, withAgentClass } from "./lib/agent-class.js";
import { countVerifiedRefused, keepRendered, verifiedReplay } from "./lib/page-held.js";
import { keepStationNames } from "./lib/station-names.js";
import { requestAgentClass } from "./overload/verified-class.js";
import { REDIRECT_VARY, decideLanguage, languageResponse, mayRedirect } from "./i18n/lang-redirect.js";
import { overloadGate, PASS_ROUTE, passRoute } from "./overload/challenge.js";
import { overloadDeps } from "./overload/index.js";
import { passKeyFrom } from "./overload/pass.js";
import { stagingOf, withStagingRobots } from "./lib/staging.js";

/**
 * One nonce per request, the CSP header for it, and the nonce written onto the script and style elements of the
 * HTML on its way out (#375 A6; on every page since #1103, whether it carries a script or not). Non-HTML responses (the stylesheet, the
 * favicon) pass through untouched: the adapter's static handler answers those
 * before the middleware sees them.
 */
/**
 * #717: Microsoft Clarity's configuration, read ONCE when this module loads.
 * The adapter loads the middleware with the first request (`/healthz` in a
 * deploy's health block), so a malformed `CLARITY_PROJECT_ID` or
 * `CLARITY_ENABLED` ends the PROCESS there with one structured line naming the
 * variable and never its value: the container restarts, the health block and
 * `check_worker_health.sh` go red, and no page is served that reports to
 * nothing or says Clarity runs when it cannot.
 */
const CLARITY_ID = ((): string | undefined => {
  try {
    return clarityConfigOf(process.env);
  } catch (err) {
    logLine(60, { kind: "config_refused", key: "clarity" }, err instanceof Error ? err.message : "the Clarity configuration is refused");
    process.exit(78);
  }
})();

/**
 * #1235: the staging switch (`lib/staging.ts`), read ONCE when this module loads, like Clarity's: a value that is
 * neither on nor off ends the process with one line naming the variable, so a staging host never boots indexable.
 * On, no analytics is configured for any render (no GA tag, no Clarity) and every answer this middleware passes
 * carries `X-Robots-Tag: noindex, nofollow`.
 */
const STAGING = ((): boolean => {
  try {
    return stagingOf(process.env);
  } catch (err) {
    logLine(60, { kind: "config_refused", key: "staging" }, err instanceof Error ? err.message : "the staging switch is refused");
    process.exit(78);
  }
})();
const CLARITY = STAGING ? undefined : CLARITY_ID;

/**
 * #1205 review: the overload pass key (`WEB_PASS_KEY`), checked ONCE when this module loads, like Clarity's. The
 * adapter loads this module with the FIRST REQUEST, not at process start — on a host that is the readiness or health
 * probe's `/healthz` — so a malformed key ends the process on that request with one line naming the variable and never
 * its value: `/healthz` gets no answer, the container restarts, the pod never becomes ready and the deploy's health
 * block goes red, instead of every page answering a 500 from `overloadDeps()`. Until that first request the process
 * is up but has not checked the key.
 */
((): void => {
  try {
    passKeyFrom(process.env);
  } catch (err) {
    logLine(60, { kind: "config_refused", key: "web_pass_key" }, err instanceof Error ? err.message : "the overload pass key is refused");
    process.exit(78);
  }
})();

/**
 * #1141: the whole request runs with nginx's user-agent class (`X-VF-Agent-Class`, the edge configuration
 * `$vf_ua_class`), so every fragment it asks of the digest carries it (`lib/agent-class.ts` `digestFetch`) and the
 * digest reads a crawler's page on its own pool. The scope covers the render AND the body read below, so a fragment
 * fetched late in a streamed render is still inside it. #1205: a claimed crawler's class is first checked against its
 * address (`overload/verified-class.ts`) — a verified one reads on the digest's search lane, an unproven claim never does.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  // #1205: the station list is held from this process's first request, not from its first station page's
  keepStationNames({ baseUrl: readEnv().digestUrl });
  // #1205: a claimed crawler's class is checked against its address (`overload/verified-class.ts`): a verified one
  // reads on the digest's search lane, an unverified claim of it does not
  const cls = await requestAgentClass(context.request.headers, overloadDeps());
  return withAgentClass(cls, async (): Promise<Response> => {
    const response = await handle(context, next);
    return STAGING ? withStagingRobots(response) : response;
  });
});

type Handler = Parameters<typeof defineMiddleware>[0];
// Typed to answer a Response on every path, so the staging wrapper above can always set its header (#1235).
const handle = async (context: Parameters<Handler>[0], next: Parameters<Handler>[1]): Promise<Response> => {
  // #944 (data steward 2026-10-23, condition 9): the User-Agent is reduced to android | ios | other before
  // anything else, and only that value goes on — to the digest's `map=` and so to every cache key. It is not
  // logged, and no client hint is asked for (no Accept-CH).
  context.locals.mapPlatform = mapPlatformOfUserAgent(context.request.headers.get("user-agent"));
  // #1166: one two-second budget for every digest read of this request — the legacy lookup below and the page's own.
  context.locals.budgetEndsAt = budgetFrom();
  const nonce = newNonce((n) => randomBytes(n));
  const googleTag = STAGING || process.env["GOOGLE_TAG"] === "" ? undefined : process.env["GOOGLE_TAG"];
  context.locals.nonce = nonce;
  context.locals.googleTag = googleTag;
  context.locals.clarityId = CLARITY;

  // #1184 phase 2: while the digest's person pool is saturated, a database page is refused only to a client past its
  // share (#1205, `overload/trip.ts`) that holds no pass; a verified search engine or AI assistant never is, and
  // nothing of it runs otherwise (`overload/challenge.ts`).
  if (context.url.pathname === PASS_ROUTE) return passRoute(context.request, overloadDeps());
  const interim = await overloadGate(context.request, context.url, nonce, overloadDeps(), currentAgentClass());
  if (interim !== null) return interim;

  // TEMPORARY (#892, removed by #898): a pre-#892 address answers its one-hop 301 here and nowhere else.
  if ((context.request.method === "GET" || context.request.method === "HEAD") && legacyDecision(context.url) !== null) {
    const env = readEnv();
    const legacy = await legacyRedirect(context.url, { baseUrl: env.digestUrl, timeoutMs: env.placeTimeoutMs }, context.locals.budgetEndsAt);
    // 2.4.4 review N1: a redirect carries the security headers too (CSP, nosniff …), not only a page
    if (legacy !== null) return securedRedirect(legacy);
  }

  // 2.4.4 (owner 2026-10-27, "redirect once"): a visitor entering on a German page is sent once to the same page in
  // their language, and a click in the language menu keeps that choice in `vf_lang` (`i18n/lang-redirect.ts`, where
  // the conditions, the cookie decision and the privacy reasoning are written down). Pure header logic, no I/O.
  const switched = languageResponse(decideLanguage(context.request.method, context.url, context.request.headers));
  if (switched !== null) return securedRedirect(switched);

  // #741: a page that threw is one structured line keyed by its route
  // TEMPLATE (`/de/place/[slug]` → `/de/place/:slug`), never the address a
  // visitor asked for, and a server error the page answered is one too.
  const t0 = Date.now();
  let response: Response;
  try {
    response = await next();
  } catch (err) {
    logLine(50, { kind: "ssr_exception", key: routeTemplate(context.routePattern), status: 500, ms: Date.now() - t0, err }, "a page threw while it rendered");
    throw err;
  }
  // #1205 review S3 (owner: a verified crawler is never refused while anything can answer it): a verified crawler's
  // database page that could not be read now is answered with the last copy this process rendered (`lib/page-held.ts`),
  // a 200 marked degraded; only with nothing held does it keep its 503, counted apart (`verified_refused`)
  const cls = currentAgentClass();
  const replay = verifiedReplay({ method: context.request.method, url: context.url, mapPlatform: context.locals.mapPlatform, cls, response });
  if (replay.flags !== null) {
    response = replay.response;
    context.locals.hasScript = replay.flags.hasScript;
    context.locals.hasForm = replay.flags.hasForm;
    context.locals.clarityPage = replay.flags.clarityPage;
  }
  if (cls === "search" && response.status >= 500) countVerifiedRefused(routeTemplate(context.routePattern), response.status, Date.now() - t0);
  if (response.status >= 500) logLine(50, { kind: "route_5xx", key: routeTemplate(context.routePattern), status: response.status, ms: Date.now() - t0 }, "a page answered with a server error");
  // #1205: a person's page whose fragment was refused, late or failed is a degraded 200 (`lib/degraded.ts`), never a
  // silent one: the same structured line, at warn, so the refusal stays counted
  else if (response.headers.get(DEGRADED_HEADER) !== null) logLine(40, { kind: "page_degraded", key: routeTemplate(context.routePattern), status: response.status, ms: Date.now() - t0 }, "a page was answered degraded: its fragment was refused, late or failed");
  // #939: a 304 (a card revalidated by its ETag) carries no body, and a Response of that status may not be given one
  // — re-wrapping it threw and the visitor got the 404 page; it passes through as it is.
  if (response.status === 304 || response.status === 204) return response;
  const type = response.headers.get("content-type") ?? "";
  if (!type.startsWith("text/html")) return response;
  // #1144: an address no route matches is answered by rendering `404.astro`, and that render runs this middleware
  // once more inside the first pass's `next()` — with its OWN nonce, written onto the body. The outer pass then set
  // its nonce in the header while the scripts carried the inner one, and the browser blocked them. A response this
  // middleware already secured is final: its policy and its body's nonce are one pair.
  if (response.headers.has("Content-Security-Policy")) return response;

  const headers = new Headers(response.headers);
  const raw = await response.text();
  // #1205 review S3/B1: a verified crawler's own render of a held page family, whole and about no visitor, is kept for its next miss
  keepRendered({ method: context.request.method, url: context.url, mapPlatform: context.locals.mapPlatform, cls, perVisitor: context.locals.perVisitor === true, status: response.status, headers, cookie: context.request.headers.has("cookie"), raw, nonce, flags: { hasScript: context.locals.hasScript === true, hasForm: context.locals.hasForm === true, clarityPage: context.locals.clarityPage === true } });
  // The page DECLARES its script (`locals.hasScript`, set while it rendered —
  // the body has been read, so rendering is done): never sniffed from the
  // HTML, where a `<script` inside an embedded fragment would switch the
  // policy itself (#404 review). A page that declares none keeps
  // `script-src 'none'` without a tag.
  const hasScript = context.locals.hasScript === true;
  // #716: the motorway page's filter is a GET form to this origin (`locals.hasForm`).
  // #717: Clarity's origins only on a page Base.astro declared a Clarity page (`locals.clarityPage`): an island page
  // that is not a motorway page (the C-4 fallback of 2026-10-27).
  const clarity = CLARITY !== undefined && context.locals.clarityPage === true;
  headers.set("Content-Security-Policy", contentSecurityPolicy(nonce, googleTag, hasScript, context.locals.hasForm === true, clarity));
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
  // #944: a page's map links follow the User-Agent's platform, so every HTML answer says so to any cache on the way
  // (the pages are no-store today; this keeps a future shared cache from serving one platform's links to another).
  headers.set("Vary", varyWith(headers.get("vary"), "User-Agent"));
  // A German page that MAY redirect is answered per visitor: it varies with the language headers, and no shared cache
  // may hand one visitor's answer to another (a cached 200 would skip the redirect a later visitor is owed).
  if ((context.request.method === "GET" || context.request.method === "HEAD") && mayRedirect(context.url.pathname)) {
    for (const name of REDIRECT_VARY) headers.set("Vary", varyWith(headers.get("vary"), name));
    if (!/\b(?:private|no-store)\b/.test(headers.get("cache-control") ?? "")) headers.set("Cache-Control", "private, no-cache");
  }
  // #1103: the nonce goes onto every page's <style> and <script> elements — a page's inline style does not depend on
  // whether it carries a script, and every page's policy names the nonce in `style-src` (`noScriptPolicy`).
  const html = withNonce(raw, nonce);
  headers.delete("content-length");
  return new Response(html, { status: response.status, headers });
};
