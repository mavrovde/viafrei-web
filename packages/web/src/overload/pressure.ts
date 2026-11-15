/**
 * #1184 phase 2 (P2): whether the digest's person pool is saturated, as the digest itself measures it
 * (`GET /internal/pressure` → `saturated` or `ok`, packages/digest/src/server/saturation.ts). The challenge exists
 * only while this says `saturated`.
 *
 * Asked lazily: at most once a second, coalesced, bounded by `PRESSURE_TIMEOUT_MS`. A reading younger than a second
 * is reused; an older one is asked again and the request waits for that (bounded) answer, so a quiet site never acts
 * on a minute-old "saturated". A digest that does not answer, or answers anything else, is `ok`: the challenge
 * fails OPEN — a broken signal never puts an interim page in front of anybody.
 */
export const PRESSURE_ROUTE = "/internal/pressure";
export const PRESSURE_MIN_INTERVAL_MS = 1_000;
export const PRESSURE_TIMEOUT_MS = 250;

export type PressureFetch = (url: string, init: { signal: AbortSignal }) => Promise<{ status: number; text(): Promise<string> }>;

export type Pressure = { readonly saturated: () => Promise<boolean> };

export function createPressure(o: { readonly baseUrl: string; readonly fetchImpl?: PressureFetch; readonly now?: () => number }): Pressure {
  const fetchImpl: PressureFetch = o.fetchImpl ?? ((url, init) => fetch(url, init));
  const now = o.now ?? (() => Date.now());
  let value = false;
  let at = Number.NEGATIVE_INFINITY;
  let inflight: Promise<boolean> | null = null;
  const ask = async (): Promise<boolean> => {
    try {
      const res = await fetchImpl(`${o.baseUrl}${PRESSURE_ROUTE}`, { signal: AbortSignal.timeout(PRESSURE_TIMEOUT_MS) });
      return res.status === 200 && (await res.text()).trim() === "saturated";
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
