/**
 * The IndexNow key file (#544): `https://viafrei.de/<INDEXNOW_KEY>.txt`, whose
 * whole body is the key. IndexNow (Bing, Yandex, Seznam, Naver, …) fetches it
 * to prove that whoever submits URLs for viafrei.de controls the site;
 * `the deploy` submits the changed sitemap URLs after a healthy deploy.
 *
 * The key is PUBLIC by design (it is served to anyone who asks for it), but it
 * is not committed: it comes from `INDEXNOW_KEY` in the process environment —
 * a generated IndexNow key, NOT the Bing Webmaster API key, which nothing here
 * reads. Unset, malformed, or a path naming any other key: 404, the same answer
 * as for any path the site does not serve. The route is not a page and is in
 * neither the sitemap nor `scripts/site-pages.txt`.
 */
import { stagingOf } from "../lib/staging.js";

/** IndexNow's own key rule: 8 to 128 characters of a-z, A-Z, 0-9 and `-`. */
export const INDEXNOW_KEY_RE = /^[A-Za-z0-9-]{8,128}$/;

/**
 * The configured key, or undefined when it is unset or not a valid IndexNow key — and always undefined on the
 * staging site (#1235, `lib/staging.ts`), so no submission for viafrei.de can be verified from it.
 */
export function indexNowKey(env: Readonly<Record<string, string | undefined>> = process.env): string | undefined {
  if (stagingOf(env)) return undefined;
  const key = (env["INDEXNOW_KEY"] ?? "").trim();
  return INDEXNOW_KEY_RE.test(key) ? key : undefined;
}

const KEY_HEADERS = { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } as const;

/**
 * The answer for `/<name>.txt`: 200 with exactly the key when `name` IS the
 * configured key, otherwise null — the route then rewrites to the site's own
 * 404 page, as for every other unmatched path (a body-less 404 Response is
 * passed through by the adapter as an empty 404, measured).
 */
export function keyFileResponse(name: string | undefined, env: Readonly<Record<string, string | undefined>> = process.env): Response | null {
  const key = indexNowKey(env);
  if (key === undefined || name !== key) return null;
  return new Response(key, { status: 200, headers: KEY_HEADERS });
}
