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
 * The client is the contract's: a path is one of `API_GET_OPERATIONS` (generated from viafrei-api's `api/openapi.json`
 * at the release images.pin's `api` pin names, `scripts/api-contract.ts`), its `{…}` parameters are filled from
 * `params`, and every other key of `params` must be one of the operation's query parameters. The answer's language is
 * the contract's `lang` query parameter, sent only to an operation that takes it.
 *
 * Every read has a deadline (the caller's, at most `API_MAX_TIMEOUT_MS`), and every outcome other than a 2xx JSON
 * envelope is `null`, so a page shows its loading or error state and never a half-read answer.
 */
import { API_GET_OPERATIONS, type ApiGetPath } from "../generated/api-operations.js";

export { API_CONTRACT, API_GET_OPERATIONS, type ApiGetPath } from "../generated/api-operations.js";

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

type ApiOperation<P extends ApiGetPath> = (typeof API_GET_OPERATIONS)[P];
/** The parameters one operation takes, by the contract: its path parameters and its query parameters but `lang`. */
export type ApiParams<P extends ApiGetPath> = Readonly<Partial<Record<Exclude<ApiOperation<P>["path"][number] | ApiOperation<P>["query"][number], "lang">, string | number | boolean | undefined>>>;
export type ApiLang = "de" | "en";

export type ApiClientOptions = {
  readonly baseUrl: string;
  readonly fetchImpl?: ApiFetch;
  readonly env?: Readonly<Record<string, string | undefined>>;
};

export type ApiClient = {
  /** GET `path` (`/v1/…`) with `query`: the envelope, or null on any failure or a missed deadline. */
  readonly get: <T, P extends ApiGetPath = ApiGetPath>(path: P, params?: ApiParams<P>, o?: { readonly timeoutMs?: number; readonly lang?: ApiLang }) => Promise<ApiEnvelope<T> | null>;
};

/** The request headers of one read: JSON, and the key when there is one. */
export function apiHeaders(env: Readonly<Record<string, string | undefined>>): Record<string, string> {
  const h: Record<string, string> = { accept: "application/json" };
  const key = (env[API_KEY_ENV] ?? "").trim();
  if (key !== "") h["authorization"] = `Bearer ${key}`;
  return h;
}

/**
 * `baseUrl` + one of the contract's paths, its `{…}` parameters filled from `params` and the rest sent as its query
 * parameters, `lang` among them when the operation takes it. A path or a parameter the contract does not have, or a
 * missing path parameter, is refused: the client cannot be pointed at anything the API does not serve.
 */
export function apiUrlOf<P extends ApiGetPath>(baseUrl: string, path: P, params: ApiParams<P> = {} as ApiParams<P>, lang?: ApiLang): string {
  const op = (API_GET_OPERATIONS as Readonly<Record<string, { readonly path: readonly string[]; readonly query: readonly string[] }>>)[path];
  if (op === undefined) throw new Error(`api: ${path} is not a GET operation of the contract`);
  const given = params as Readonly<Record<string, string | number | boolean | undefined>>;
  for (const k of Object.keys(given)) {
    if (!op.path.includes(k) && (k === "lang" || !op.query.includes(k))) throw new Error(`api: ${path} takes no parameter ${k}`);
  }
  let filled: string = path;
  for (const name of op.path) {
    const v = given[name];
    if (v === undefined || v === "") throw new Error(`api: ${path} needs its path parameter ${name}`);
    filled = filled.replaceAll(`{${name}}`, encodeURIComponent(String(v)));
  }
  if (filled.includes("{")) throw new Error(`api: ${path} has a path parameter the contract does not list`);
  const u = new URL(filled, baseUrl);
  for (const k of op.query) {
    const v = k === "lang" ? lang : given[k];
    if (v !== undefined) u.searchParams.set(k, String(v));
  }
  return u.toString();
}

export function createApiClient(o: ApiClientOptions): ApiClient {
  const fetchImpl: ApiFetch = o.fetchImpl ?? ((url, init) => fetch(url, init));
  const env = o.env ?? process.env;
  return {
    get: async <T, P extends ApiGetPath = ApiGetPath>(path: P, params?: ApiParams<P>, opt?: { readonly timeoutMs?: number; readonly lang?: ApiLang }): Promise<ApiEnvelope<T> | null> => {
      const timeoutMs = Math.min(opt?.timeoutMs ?? API_MAX_TIMEOUT_MS, API_MAX_TIMEOUT_MS);
      try {
        const res = await fetchImpl(apiUrlOf(o.baseUrl, path, params, opt?.lang), { headers: apiHeaders(env), signal: AbortSignal.timeout(timeoutMs) });
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
