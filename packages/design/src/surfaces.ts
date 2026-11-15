/**
 * The surfaces a connect note or an endpoint chip stands on (#1001, #1003) —
 * the `surface` of `cta_connect_click`, a closed list — and the attribute that
 * names one on a guide link or a chip. Its own module so `connect-note.ts` and
 * `endpoint-chip.ts` both read it without importing each other.
 */
export const CONNECT_SOURCES = ["home", "place", "motorway", "examples", "connect", "business", "developers"] as const;
export type ConnectSource = (typeof CONNECT_SOURCES)[number];
export function isConnectSource(x: unknown): x is ConnectSource {
  return typeof x === "string" && (CONNECT_SOURCES as readonly string[]).includes(x);
}

/** The attribute the analytics listener reads on a guide link or a chip. */
export const CONNECT_SOURCE_ATTR = "data-cta-source";
