/**
 * The shell's one road to viafrei-api: the data the site renders itself, instead of a digest fragment.
 *
 * Server side only. Nothing an island or the browser loads imports this module (`test/api-client.test.ts` holds
 * that), and the site's key never leaves it:
 *  - it is read here, from `VIAFREI_API_KEY`, per call, and only ever written into this module's own request header
 *    (`Authorization: Bearer …`, RFC 6750, the API's `bearerKey` scheme);
 *  - it is not a field of `WebEnv`, never returned and never logged: a failure is reported by the path alone;
 *  - no key is no header: the API then answers as it answers a keyless read.
 *
 * Every read has a deadline (the caller's, at most `API_MAX_TIMEOUT_MS`), and every outcome other than a 2xx JSON
 * envelope is `null`, so a page shows its loading or error state and never a half-read answer.
 */
export const API_KEY_ENV = "VIAFREI_API_KEY";
/** The site's two-second ceiling (#1166), the API's own hard deadline as well. */
export const API_MAX_TIMEOUT_MS = 2_000;

/** The API's success envelope: `data`, plus `meta` (attribution, freshness, notes) and `links`. */
export type ApiEnvelope<T> = {
  readonly data: T;
  readonly meta?: Readonly<Record<string, unknown>>;
  readonly links?: Readonly<Record<string, unknown>>;
};

export type ApiResponse = { readonly status: number; readonly headers: { get(name: string): string | null }; json(): Promise<unknown> };
export type ApiFetch = (url: string, init: { readonly headers: Record<string, string>; readonly signal: AbortSignal }) => Promise<ApiResponse>;

export type ApiQuery = Readonly<Record<string, string | number | boolean | undefined>>;

export type ApiClientOptions = {
  readonly baseUrl: string;
  readonly fetchImpl?: ApiFetch;
  readonly env?: Readonly<Record<string, string | undefined>>;
};

export type ApiClient = {
  /** GET `path` (`/v1/…`) with `query`: the envelope, or null on any failure or a missed deadline. */
  readonly get: <T>(path: string, query?: ApiQuery, o?: { readonly timeoutMs?: number; readonly lang?: string }) => Promise<ApiEnvelope<T> | null>;
};

/** The request headers of one read: JSON, the language, and the key when there is one. */
export function apiHeaders(env: Readonly<Record<string, string | undefined>>, lang?: string): Record<string, string> {
  const h: Record<string, string> = { accept: "application/json" };
  if (lang !== undefined) h["accept-language"] = lang;
  const key = (env[API_KEY_ENV] ?? "").trim();
  if (key !== "") h["authorization"] = `Bearer ${key}`;
  return h;
}

/** `baseUrl` + a `/v1/` path + the query; any other path is refused, so the client cannot be pointed elsewhere. */
export function apiUrlOf(baseUrl: string, path: string, query: ApiQuery = {}): string {
  if (!path.startsWith("/v1/")) throw new Error(`api: ${path} is not a /v1/ path`);
  const u = new URL(path, baseUrl);
  for (const [k, v] of Object.entries(query)) if (v !== undefined) u.searchParams.set(k, String(v));
  return u.toString();
}

export function createApiClient(o: ApiClientOptions): ApiClient {
  const fetchImpl: ApiFetch = o.fetchImpl ?? ((url, init) => fetch(url, init));
  const env = o.env ?? process.env;
  return {
    get: async <T>(path: string, query?: ApiQuery, opt?: { readonly timeoutMs?: number; readonly lang?: string }): Promise<ApiEnvelope<T> | null> => {
      const timeoutMs = Math.min(opt?.timeoutMs ?? API_MAX_TIMEOUT_MS, API_MAX_TIMEOUT_MS);
      try {
        const res = await fetchImpl(apiUrlOf(o.baseUrl, path, query), { headers: apiHeaders(env, opt?.lang), signal: AbortSignal.timeout(timeoutMs) });
        if (res.status < 200 || res.status > 299) return null;
        if (!(res.headers.get("content-type") ?? "").includes("json")) return null;
        const body = await res.json();
        if (body === null || typeof body !== "object" || !("data" in body)) return null;
        return body as ApiEnvelope<T>;
      } catch {
        return null;
      }
    },
  };
}
