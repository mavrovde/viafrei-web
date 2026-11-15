/**
 * The visitor's address, as the edge handed it on: nginx OVERWRITES
 * `X-Forwarded-For` with `$remote_addr` (the edge shell proxy rules), which
 * `set_real_ip_from` has already made the client's (the edge configuration). So
 * the header holds one address and is the only one read; a list (a client
 * that sent its own header past a misconfigured edge) is reduced to its FIRST
 * entry only if every entry is an address, and anything else is no address.
 *
 * The value is returned to the caller and goes nowhere else: it is not logged,
 * stored or forwarded (#564 § 6; `test/location.test.ts` scans this directory).
 */
import { isIP } from "node:net";

export function clientIp(headers: { get(name: string): string | null }): string | null {
  const raw = headers.get("x-forwarded-for");
  if (raw === null) return null;
  const parts = raw.split(",").map((p) => p.trim());
  if (parts.length === 0 || parts.length > 5 || parts.some((p) => isIP(p) === 0)) return null;
  return parts[0] ?? null;
}
