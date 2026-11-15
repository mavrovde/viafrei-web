/**
 * The IP rung of the location ladder (#564 § 1, § 8): a LOCAL file, read by
 * binary search on disk — no third party, no request, no copy of the address.
 *
 * The file is the VFGEO1 extract `scripts/geoip-build.mjs` makes from DB-IP
 * "IP to City Lite" (CC BY 4.0; the footer carries "IP Geolocation by DB-IP").
 * It is never in git and never in the image: the host refreshes it monthly
 * (`the GeoIP refresh job`, `the deploy --install-geoip`) into a read-only
 * mount, and `GEOIP_FILE` names it. No file, an unreadable file or a file of
 * the wrong shape: the rung is SKIPPED and the ladder falls through to
 * Germany — the page is never broken by it.
 *
 * The address a lookup is given lives in this call's stack and nowhere else:
 * nothing here logs, stores, caches or forwards it (`test/location.test.ts`
 * scans this directory for exactly that).
 *
 * Why on disk: the web container runs in 128 MB. A lookup is ~22 reads of
 * 12 or 36 bytes from the page cache — microseconds.
 */
import { closeSync, fstatSync, openSync, readSync, statSync } from "node:fs";
import { isIPv4, isIPv6 } from "node:net";

const MAGIC = "VFGEO1\n\0";
const HEADER = 32;
const V4 = 12;
const V6 = 36;
const PT = 6;
const NONE = -32768;

/** What the file says about one address. */
export type GeoHit = {
  /** ISO 3166-1 alpha-2, e.g. "DE". */
  readonly country: string;
  /** A coarse point (DE 0.01°, neighbours 0.05°), or null for every other country. */
  readonly lat: number | null;
  readonly lon: number | null;
};

export type GeoIp = {
  readonly release: string;
  lookup(ip: string): GeoHit | null;
  close(): void;
};

/** An IPv4 dotted quad → its number. */
function v4num(ip: string): number {
  return ip.split(".").reduce((a, o) => a * 256 + Number(o), 0);
}

/** An IPv6 address → 16 bytes; a mapped IPv4 (`::ffff:a.b.c.d`) is returned as `{ v4 }` instead. */
export function parseIp(raw: string): { readonly v4: number } | { readonly v6: Buffer } | null {
  const ip = raw.trim().replace(/^\[|\]$/g, "").replace(/%.*$/, "");
  if (isIPv4(ip)) return { v4: v4num(ip) };
  if (!isIPv6(ip)) return null;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped?.[1] !== undefined && isIPv4(mapped[1])) return { v4: v4num(mapped[1]) };
  let s = ip;
  let tail: number[] = [];
  if (s.includes(".")) {
    const at = s.lastIndexOf(":");
    const q = s.slice(at + 1).split(".").map(Number);
    tail = [((q[0] ?? 0) << 8) | (q[1] ?? 0), ((q[2] ?? 0) << 8) | (q[3] ?? 0)];
    s = `${s.slice(0, at + 1)}0`;
  }
  const parts = s.split("::");
  const h = parts[0] === undefined || parts[0] === "" ? [] : parts[0].split(":");
  const r = parts.length < 2 || parts[1] === undefined || parts[1] === "" ? [] : parts[1].split(":");
  const groups = parts.length < 2 ? h : [...h, ...Array<string>(8 - h.length - r.length).fill("0"), ...r];
  let nums = groups.map((g) => parseInt(g, 16));
  if (tail.length === 2) nums = [...nums.slice(0, 6), ...tail];
  const b = Buffer.alloc(16);
  nums.forEach((g, i) => b.writeUInt16BE(g & 0xffff, i * 2));
  return { v6: b };
}

/**
 * Open the file, or null when there is none or it is not a VFGEO1 file. Never
 * throws: the IP rung is an improvement, not a dependency.
 */
export function openGeoIp(path: string | undefined): GeoIp | null {
  if (path === undefined || path.trim() === "") return null;
  let fd: number;
  try {
    fd = openSync(path, "r");
  } catch {
    return null;
  }
  try {
    const head = Buffer.alloc(HEADER);
    if (readSync(fd, head, 0, HEADER, 0) !== HEADER || head.toString("latin1", 0, 8) !== MAGIC) throw new Error("not VFGEO1");
    const n4 = head.readUInt32BE(8);
    const n6 = head.readUInt32BE(12);
    const np = head.readUInt32BE(16);
    const release = head.toString("latin1", 20, 28).replace(/\0+$/, "");
    const v4At = HEADER;
    const v6At = v4At + n4 * V4;
    const ptAt = v6At + n6 * V6;
    if (fstatSync(fd).size !== ptAt + np * PT) throw new Error("size does not match the header");
    const buf = Buffer.alloc(V6);
    const read = (at: number, len: number): Buffer => {
      if (readSync(fd, buf, 0, len, at) !== len) throw new Error("short read");
      return buf;
    };
    const point = (i: number): GeoHit | null => {
      if (i >= np) return null;
      const b = read(ptAt + i * PT, PT);
      const country = b.toString("latin1", 0, 2);
      const lat = b.readInt16BE(2);
      const lon = b.readInt16BE(4);
      return { country, lat: lat === NONE ? null : lat / 100, lon: lon === NONE ? null : lon / 100 };
    };
    return {
      release,
      lookup(raw: string): GeoHit | null {
        const ip = parseIp(raw);
        if (ip === null) return null;
        try {
          if ("v4" in ip) {
            let lo = 0;
            let hi = n4 - 1;
            while (lo <= hi) {
              const mid = (lo + hi) >>> 1;
              const b = read(v4At + mid * V4, V4);
              const s = b.readUInt32BE(0);
              const e = b.readUInt32BE(4);
              if (ip.v4 < s) hi = mid - 1;
              else if (ip.v4 > e) lo = mid + 1;
              else return point(b.readUInt32BE(8));
            }
            return null;
          }
          let lo = 0;
          let hi = n6 - 1;
          while (lo <= hi) {
            const mid = (lo + hi) >>> 1;
            const b = read(v6At + mid * V6, V6);
            if (Buffer.compare(ip.v6, b.subarray(0, 16)) < 0) hi = mid - 1;
            else if (Buffer.compare(ip.v6, b.subarray(16, 32)) > 0) lo = mid + 1;
            else return point(b.readUInt32BE(32));
          }
          return null;
        } catch {
          return null;
        }
      },
      close(): void {
        closeSync(fd);
      },
    };
  } catch {
    closeSync(fd);
    return null;
  }
}

/** How often the shared reader looks whether the monthly refresh replaced the file (a rename keeps the old inode open). */
export const GEOIP_RECHECK_MS = 3_600_000;

let shared: { readonly path: string; readonly geo: GeoIp | null; readonly ino: number; readonly at: number } | undefined;

const inodeOf = (p: string): number => {
  try {
    return statSync(p).ino;
  } catch {
    return -1;
  }
};

/** The process's one reader for `GEOIP_FILE`, opened on first use and re-opened when the file was replaced. */
export function sharedGeoIp(path: string | undefined, now: () => number = Date.now): GeoIp | null {
  const p = path ?? "";
  const t = now();
  if (shared !== undefined && shared.path === p && t - shared.at < GEOIP_RECHECK_MS) return shared.geo;
  const ino = p === "" ? -1 : inodeOf(p);
  if (shared !== undefined && shared.path === p && shared.ino === ino) {
    shared = { ...shared, at: t };
    return shared.geo;
  }
  shared?.geo?.close();
  shared = { path: p, geo: openGeoIp(p), ino, at: t };
  return shared.geo;
}
