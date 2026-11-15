/**
 * The staging switch (#1235): `VF_STAGING` turns the web shell into the staging
 * site of `dev.viafrei.de`, the old Contabo host after the 2.6 cutover. ONE
 * site-wide switch, read from the process environment, off by default. On:
 *
 *  - `/robots.txt` is `User-agent: *` + `Disallow: /` and nothing else — no
 *    sitemap and no `llms.txt` pointer, so no crawler is invited anywhere;
 *  - every answer the middleware passes carries `X-Robots-Tag: noindex,
 *    nofollow` — pages, fragments, text files, redirects and errors alike;
 *  - no Google Analytics tag and no Microsoft Clarity: the shell behaves as if
 *    neither were configured, whatever the host's `.env` holds, so no consent
 *    island, no CSP origin and no measurement reaches either property;
 *  - the IndexNow key file answers 404, so a submission for viafrei.de cannot
 *    be verified from this host even if one were made. The deploy's own
 *    IndexNow and search-console steps are the deploy's to skip (staging's
 *    `.env` holds no `INDEXNOW_KEY` and no console key, #1235).
 *
 * Values: `1`, `true`, `yes` → on; `0`, `false`, `no`, empty or unset → off.
 * Anything else is REFUSED (an Error naming the variable, never its value):
 * the middleware ends the process with it, as for `CLARITY_ENABLED`, because a
 * typo that silently left a staging host indexable is the failure this switch
 * exists to prevent.
 */

export const STAGING_ENV = "VF_STAGING";

export const STAGING_ROBOTS_TAG = "noindex, nofollow";

/** robots.txt on staging: every crawler, every path, disallowed. */
export const STAGING_ROBOTS_TXT = "User-agent: *\nDisallow: /\n";

const ON = new Set(["1", "true", "yes"]);
const OFF = new Set(["", "0", "false", "no"]);

/** Whether this process serves the staging site; throws on a value that is neither on nor off. */
export function stagingOf(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  const raw = (env[STAGING_ENV] ?? "").trim().toLowerCase();
  if (ON.has(raw)) return true;
  if (OFF.has(raw)) return false;
  throw new Error(`${STAGING_ENV} must be one of 1/true/yes or 0/false/no/empty`);
}

/**
 * The `X-Robots-Tag` a staging answer carries: the page's own value when it
 * already says `noindex` (the fuel answers' `noarchive`, which the service
 * worker reads, is kept), else that value with `noindex, nofollow` added.
 */
export function stagingRobotsTag(existing: string | null): string {
  const own = (existing ?? "").trim();
  if (/\bnoindex\b/iu.test(own)) return own;
  return own === "" ? STAGING_ROBOTS_TAG : `${own}, ${STAGING_ROBOTS_TAG}`;
}

/**
 * The response with the staging `X-Robots-Tag`. A response whose headers are
 * immutable (one the adapter or `fetch` produced) is copied with its body,
 * status and every other header; the body is never read.
 */
export function withStagingRobots(response: Response): Response {
  const tag = stagingRobotsTag(response.headers.get("X-Robots-Tag"));
  try {
    response.headers.set("X-Robots-Tag", tag);
    return response;
  } catch {
    const headers = new Headers(response.headers);
    headers.set("X-Robots-Tag", tag);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
}
