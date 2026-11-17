/**
 * #1184 phase 2 (P2): whether the digest's person pool is saturated, as the digest itself measures it
 * (`GET /internal/pressure` → `saturated` or `ok`, packages/digest/src/server/saturation.ts). The challenge exists
 * only while this says `saturated`.
 *
 * Asked lazily: at most once a second, coalesced, bounded by `PRESSURE_TIMEOUT_MS`. A reading younger than a second
 * is reused; an older one is asked again and the request waits for that (bounded) answer, so a quiet site never acts
 * on a minute-old "saturated". With `api`, the word is read from viafrei-api's `/v1/pressure` instead (the web→API switch). A digest that does not answer, or answers anything else, is `ok`: the challenge
 * fails OPEN — a broken signal never puts an interim page in front of anybody.
 */
export const PRESSURE_ROUTE = "/internal/pressure";
export const PRESSURE_MIN_INTERVAL_MS = 1_000;
export const PRESSURE_TIMEOUT_MS = 250;

export type PressureFetch = (url: string, init: { signal: AbortSignal }) => Promise<{ status: number; text(): Promise<string> }>;

export type Pressure = { readonly saturated: () => Promise<boolean> };

/** viafrei-api's pressure word (`GET /v1/pressure` → `{"data":{"state":"saturated"|"ok"}}`), the same signal measured there. */
export const API_PRESSURE_PATH = "/v1/pressure";

/** The word out of an API answer: `saturated` only when the envelope says exactly that. */
export function apiPressureWord(body: unknown): boolean {
  if (body === null || typeof body !== "object" || !("data" in body)) return false;
  const data = (body as { data: unknown }).data;
  return data !== null && typeof data === "object" && (data as { state?: unknown }).state === "saturated";
}

export function createPressure(o: { readonly baseUrl: string; readonly fetchImpl?: PressureFetch; readonly now?: () => number; readonly api?: boolean }): Pressure {
  const fetchImpl: PressureFetch = o.fetchImpl ?? ((url, init) => fetch(url, init));
  const now = o.now ?? (() => Date.now());
  let value = false;
  let at = Number.NEGATIVE_INFINITY;
  let inflight: Promise<boolean> | null = null;
  const ask = async (): Promise<boolean> => {
    try {
      const res = await fetchImpl(`${o.baseUrl}${o.api === true ? API_PRESSURE_PATH : PRESSURE_ROUTE}`, { signal: AbortSignal.timeout(PRESSURE_TIMEOUT_MS) });
      if (res.status !== 200) return false;
      const text = (await res.text()).trim();
      if (o.api !== true) return text === "saturated";
      try {
        return apiPressureWord(JSON.parse(text));
      } catch {
        return false;
      }
    } catch {
      return false;
    }
  };
  return {
    saturated: () => {
      if (now() - at < PRESSURE_MIN_INTERVAL_MS) return Promise.resolve(value);
      inflight ??= ask().then((v) => {
        value = v;
        at = now();
        inflight = null;
        return v;
      });
      return inflight;
    },
  };
}
