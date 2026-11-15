/**
 * #1184 phase 2 (data-steward ruling 2026-11-04, P3 and P5): the overload pass — the cookie a browser earns by solving
 * the challenge, and the challenge it solves. Nothing here names a person: no address, no User-Agent, no hash of
 * either, no device property, no place, no language. Every value is a version, a minute, random bits and a MAC.
 *
 *  - The cookie `__Host-vf_pass`, `1.<minute>.<nonce>.<mac>`: the version, the issue time in Unix seconds rounded down
 *    to the minute, 128 random bits (32 hex), and an HMAC-SHA-256 over the three (base64url). Set with exactly
 *    `Secure; HttpOnly; SameSite=Lax; Path=/` — a browser-session cookie, no Domain, no Expires, no Max-Age — and
 *    refused once its signed issue time is more than `PASS_MAX_AGE_S` (12 h) old.
 *  - The challenge `c1.<seconds>.<rand>.<mac>`: issued with the interim page, valid `CHALLENGE_TTL_S`, solved by a
 *    counter `n` whose SHA-256 of `<challenge>.<n>` starts with `POW_BITS` zero bits, and spent once.
 *
 * The MAC key (#1205) is `WEB_PASS_KEY`, generated on the host and handed to every web replica alike (k8s Secret
 * viafrei-env-web, the compose env): a pass one replica issued is accepted by every other, where the per-process key
 * before it refused the pass on the next replica the balancer chose (ten replicas: almost always), so the reload
 * showed the challenge again and then the dead-end sentence. Unset (a single dev process) it is random per process;
 * a key shorter than 32 bytes is refused, never padded. The key is never logged. What is kept in memory is bounded and counts only
 * (P5): the spent challenges until they expire, and per pass nonce how often it was shown, so one solved pass cannot
 * carry a walk of thousands of pages (`PASS_MAX_USES`). Nothing here is persisted or logged.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const PASS_COOKIE = "__Host-vf_pass";
export const PASS_VERSION = "1";
/** P3: the most a pass is accepted after its signed issue time — twelve hours. */
export const PASS_MAX_AGE_S = 12 * 3_600;
/** P3: the cookie's attributes, exactly. A browser-session cookie. */
export const PASS_COOKIE_ATTRIBUTES = "Secure; HttpOnly; SameSite=Lax; Path=/";
/** P5: how many pages one pass may carry while the overload lasts; a person reads far fewer in twelve hours. */
export const PASS_MAX_USES = 600;
/** How long a challenge may be solved after it was issued. */
export const CHALLENGE_TTL_S = 600;
/**
 * The proof-of-work: 12 leading zero bits, about 4 096 SHA-256 digests on average — well under a second on a phone
 * (the ruling: "in der Regel weniger als eine Sekunde"). It does not stop a scraper that runs a browser; it makes a
 * client that runs no script, or one that will not spend the work per pass, read nothing while the pool is full.
 */
export const POW_BITS = 12;
/** Bounds of the two in-memory maps (P5, P9's bound). */
export const PASS_MEMORY_MAX = 50_000;

const b64url = (b: Buffer): string => b.toString("base64url");

export type PassDeps = { readonly key?: Buffer; readonly now?: () => number; readonly random?: (n: number) => Buffer };

export type PassBook = {
  /** A new pass value (no attribute). */
  readonly issue: () => string;
  /** The `Set-Cookie` value for a new pass. */
  readonly setCookie: () => string;
  /** Whether a cookie value is a pass this process signed, younger than 12 h. Pure: it counts nothing. */
  readonly valid: (value: string | null | undefined) => boolean;
  /** `valid`, and one more page shown on it — false once it carried `PASS_MAX_USES`. */
  readonly admit: (value: string | null | undefined) => boolean;
  /** A new challenge. */
  readonly challenge: () => string;
  /** Whether `n` solves `c` (signed, unexpired, unspent); a solution spends its challenge. */
  readonly solve: (c: unknown, n: unknown) => boolean;
};

/** Whether a SHA-256 digest starts with `bits` zero bits. */
export function leadingZeroBits(digest: Uint8Array, bits: number): boolean {
  let left = bits;
  for (let i = 0; i < digest.length && left > 0; i++) {
    const b = digest[i]!;
    if (left >= 8) {
      if (b !== 0) return false;
      left -= 8;
    } else return b >> (8 - left) === 0;
  }
  return left <= 0;
}

/** A Map bounded by insertion order: the oldest entry goes first. Counts only. */
function bounded<V>(max: number): { get(k: string): V | undefined; set(k: string, v: V): void; delete(k: string): void; readonly size: number } {
  const m = new Map<string, V>();
  return {
    get: (k) => m.get(k),
    set: (k, v) => {
      m.delete(k);
      m.set(k, v);
      while (m.size > max) {
        const oldest = m.keys().next().value;
        if (oldest === undefined) break;
        m.delete(oldest);
      }
    },
    delete: (k) => void m.delete(k),
    get size() {
      return m.size;
    },
  };
}

/** #1205: the shared pass key's environment name, and its one shape — the rule `deploy-path.sh` applies on the host. */
export const PASS_KEY_ENV = "WEB_PASS_KEY";
export const PASS_KEY_HEX = /^[0-9a-fA-F]{64}$/;

/**
 * The pass book's key from the environment: `WEB_PASS_KEY` as exactly 64 hex characters (32 bytes) — undefined when
 * unset (the book then draws a random per-process key). Any other set value is REFUSED (thrown, naming the variable
 * and never its value), because a quietly random key on one replica is exactly the cross-replica refusal of #1205. The
 * host regenerates any value not of this shape (`the deploy`, `grep -Eqx '[0-9a-fA-F]{64}'`), so
 * the two rules are one: what the host keeps, the web accepts.
 */
export function passKeyFrom(env: Readonly<Record<string, string | undefined>>): Buffer | undefined {
  const raw = (env[PASS_KEY_ENV] ?? "").trim();
  if (raw === "") return undefined;
  if (!PASS_KEY_HEX.test(raw)) throw new Error(`${PASS_KEY_ENV} must be exactly 64 hex characters (the host generates them)`);
  return Buffer.from(raw, "hex");
}

export function createPassBook(d: PassDeps = {}): PassBook {
  const key = d.key ?? randomBytes(32);
  const now = d.now ?? (() => Date.now());
  const random = d.random ?? ((n: number) => randomBytes(n));
  const mac = (label: string, text: string): string => b64url(createHmac("sha256", key).update(`${label}|${text}`).digest());
  const sameMac = (a: string, b: string): boolean => {
    const x = Buffer.from(a);
    const y = Buffer.from(b);
    return x.length === y.length && timingSafeEqual(x, y);
  };
  const spent = bounded<number>(PASS_MEMORY_MAX);
  const uses = bounded<number>(PASS_MEMORY_MAX);

  const issue = (): string => {
    const minute = Math.floor(now() / 60_000) * 60;
    const nonce = random(16).toString("hex");
    const body = `${PASS_VERSION}.${minute}.${nonce}`;
    return `${body}.${mac("pass", body)}`;
  };
  const parse = (value: string | null | undefined): { nonce: string } | null => {
    if (typeof value !== "string" || value.length > 128) return null;
    const m = /^(1)\.(\d{1,12})\.([0-9a-f]{32})\.([A-Za-z0-9_-]{43})$/.exec(value);
    if (m === null) return null;
    const body = `${m[1]!}.${m[2]!}.${m[3]!}`;
    if (!sameMac(m[4]!, mac("pass", body))) return null;
    const issued = Number(m[2]!);
    const t = now() / 1000;
    // a pass from the future (a clock step) is no pass; one older than twelve hours is refused (P3)
    if (issued % 60 !== 0 || issued > t + 60 || t - issued > PASS_MAX_AGE_S) return null;
    return { nonce: m[3]! };
  };
  return {
    issue,
    setCookie: () => `${PASS_COOKIE}=${issue()}; ${PASS_COOKIE_ATTRIBUTES}`,
    valid: (value) => parse(value) !== null,
    admit: (value) => {
      const p = parse(value);
      if (p === null) return false;
      const n = (uses.get(p.nonce) ?? 0) + 1;
      uses.set(p.nonce, n);
      return n <= PASS_MAX_USES;
    },
    challenge: () => {
      const body = `c1.${Math.floor(now() / 1000)}.${random(8).toString("hex")}`;
      return `${body}.${mac("challenge", body)}`;
    },
    solve: (c, n) => {
      if (typeof c !== "string" || c.length > 128 || typeof n !== "number" || !Number.isSafeInteger(n) || n < 0) return false;
      const m = /^(c1\.(\d{1,12})\.([0-9a-f]{16}))\.([A-Za-z0-9_-]{43})$/.exec(c);
      if (m === null || !sameMac(m[4]!, mac("challenge", m[1]!))) return false;
      const at = Number(m[2]!);
      const t = now() / 1000;
      if (at > t + 60 || t - at > CHALLENGE_TTL_S) return false;
      if (spent.get(m[3]!) !== undefined) return false;
      if (!leadingZeroBits(createHash("sha256").update(`${c}.${n}`).digest(), POW_BITS)) return false;
      spent.set(m[3]!, at);
      return true;
    },
  };
}

/** The pass cookie's value in a Cookie header, or null. Reads that one name and nothing else (P1). */
export function passOf(cookieHeader: string | null): string | null {
  if (cookieHeader === null) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === PASS_COOKIE) return part.slice(eq + 1).trim();
  }
  return null;
}
