#!/usr/bin/env node
/**
 * geoip-build.mjs — DB-IP "IP to City Lite" (CSV, on stdin) → the compact
 * VFGEO1 file the site shell reads by binary search (#564 § 8).
 *
 * WHY A FILE OF OUR OWN. The web container runs in 128 MB (docker-compose
 * mem_limit); the published .mmdb is ~120 MB and the CSV ~660 MB. The shell
 * needs three answers and nothing else: is this address in Germany, roughly
 * where, and — for the border towns — roughly where in a neighbouring country.
 * So the file keeps exactly that:
 *   - DE ranges with a point rounded to 0.01° (~1 km — the Lite data is a
 *     city centre at best, and the page says "ungefähr");
 *   - ranges of the nine neighbours with a point rounded to 0.05°;
 *   - every other country as its country code ALONE, no point;
 *   - adjacent ranges with the same answer merged into one.
 * Nothing about a visitor is in it, and no city or region name either.
 *
 * LICENCE. DB-IP Lite is CC BY 4.0, no account (data-sources row `dbip_city_lite`). The
 * attribution — "IP Geolocation by DB-IP", linked to https://db-ip.com — is
 * printed in the place bar of every page where the lookup ran (PlaceBlock.astro); this file is a
 * modified extract and that line says so. The release month is stored in the
 * header so the page can name what it was built from.
 *
 * Plain Node, no dependency: it runs on the host inside the app image
 * (`the GeoIP refresh job`), never at build time and never in a test that
 * touches the network — the tests feed it a fixture.
 *
 * Usage: gunzip -c dbip-city-lite-YYYY-MM.csv.gz | node geoip-build.mjs --release YYYY-MM --out FILE [--min-de-ranges N]
 *
 * Refuses (exit 2) empty input, input with no German range, and input with
 * fewer German ranges than the floor (10 000; the October 2026 release held
 * ~10× that). Measured on the real October 2026 file (692 MB CSV, 7.8 M lines):
 * see the GeoIP refresh job, which bounds the container from that measurement.
 *
 * FORMAT (big-endian):
 *   0   8  magic "VFGEO1\n\0"
 *   8   4  v4 record count
 *   12  4  v6 record count
 *   16  4  point count
 *   20  8  release "YYYY-MM" (ASCII, NUL-padded)
 *   28  4  reserved (0)
 *   32  …  v4 records:  start u32, end u32, point u32             (12 bytes)
 *   …   …  v6 records:  start 16 bytes, end 16 bytes, point u32   (36 bytes)
 *   …   …  points:      country 2 ASCII, lat i16, lon i16 (×100; -32768 = none) (6 bytes)
 * Records are sorted by start and do not overlap. `packages/web/src/location/geoip.ts`
 * reads it; `packages/web/test/location.test.ts` builds a fixture with THIS script
 * and reads it back, so the two cannot drift.
 */
import { createInterface } from "node:readline";
import { closeSync, openSync, renameSync, writeSync } from "node:fs";
import { isIPv4, isIPv6 } from "node:net";

const MAGIC = Buffer.from("VFGEO1\n\0", "latin1");
const HEADER = 32;
const NONE = -32768;
/** The nine countries sharing a border with Germany: their ranges keep a coarse point, for the border towns. */
const NEIGHBOURS = new Set(["AT", "BE", "CH", "CZ", "DK", "FR", "LU", "NL", "PL"]);

function fail(msg, code = 2) {
  process.stderr.write(`✗ geoip-build: ${msg}\n`);
  process.exit(code);
}

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const release = arg("--release");
const out = arg("--out");
if (release === undefined || !/^\d{4}-\d{2}$/.test(release)) fail("--release YYYY-MM is required");
if (out === undefined || out === "") fail("--out FILE is required");
const MIN_DE_RANGES = Number(arg("--min-de-ranges") ?? 10_000);
if (!Number.isInteger(MIN_DE_RANGES) || MIN_DE_RANGES < 1) fail("--min-de-ranges must be a positive integer");

/** One CSV line → fields; DB-IP quotes fields that contain a comma. */
function fields(line) {
  const f = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      f.push(cur);
      cur = "";
    } else cur += ch;
  }
  f.push(cur);
  return f;
}

function v4(ip) {
  return ip.split(".").reduce((a, o) => a * 256 + Number(o), 0);
}

/** An IPv6 address → 16 bytes (an embedded dotted quad allowed). */
function v6bytes(ip) {
  let s = ip;
  let tail = [];
  const dot = s.lastIndexOf(":");
  if (s.includes(".")) {
    const quad = s.slice(dot + 1).split(".").map(Number);
    tail = [(quad[0] << 8) | quad[1], (quad[2] << 8) | quad[3]];
    s = s.slice(0, dot + 1) + "0";
  }
  const [head, rest] = s.includes("::") ? s.split("::") : [s, undefined];
  const h = head === "" ? [] : head.split(":");
  const r = rest === undefined || rest === "" ? [] : rest.split(":");
  let groups = rest === undefined ? h : [...h, ...Array(8 - h.length - r.length).fill("0"), ...r];
  groups = groups.map((g) => parseInt(g, 16));
  if (tail.length === 2) groups = [...groups.slice(0, 6), ...tail];
  const b = Buffer.alloc(16);
  groups.forEach((g, i) => b.writeUInt16BE(g & 0xffff, i * 2));
  return b;
}

const round = (v, step) => Math.round(Math.round(v / step) * step * 100);

const points = new Map(); // key → index
const pointList = [];
function pointOf(cc, lat, lon) {
  const k = `${cc}:${lat}:${lon}`;
  let i = points.get(k);
  if (i === undefined) {
    i = pointList.length;
    points.set(k, i);
    pointList.push([cc, lat, lon]);
  }
  return i;
}

// The ranges live in growable TYPED arrays, never one JS object per range: the
// real October 2026 file has ~7.8 M lines and ~1.67 M ranges after merging, and
// an array-plus-two-Buffers per IPv6 range peaked at ~950 MB RSS and did not
// fit a 384 MB heap (measured 2026-10-12, #564 review S4). Packed, the live set
// is ~45 MB.
class Store {
  constructor(width) {
    this.width = width;
    this.n = 0;
    this.buf = Buffer.alloc(width * 65536);
  }
  push() {
    if ((this.n + 1) * this.width > this.buf.length) {
      const next = Buffer.alloc(this.buf.length * 2);
      this.buf.copy(next, 0, 0, this.n * this.width);
      this.buf = next;
    }
    return this.n++ * this.width;
  }
}
const r4 = new Store(12); // start u32, end u32, point u32
const r6 = new Store(36); // start 16, end 16, point u32
let lines = 0;
let skipped = 0;

/** Is `start` (16 bytes) exactly one past the end stored at `off` of r6? */
function isNext6(off, start) {
  const n = Buffer.from(r6.buf.subarray(off + 16, off + 32));
  for (let i = 15; i >= 0; i--) {
    if (n[i] === 255) n[i] = 0;
    else {
      n[i]++;
      return Buffer.compare(n, start) === 0;
    }
  }
  return false;
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of rl) {
  if (line === "") continue;
  lines++;
  const f = fields(line);
  if (f.length < 8) {
    skipped++;
    continue;
  }
  const [a, b] = f;
  const cc = f[3];
  if (!/^[A-Z]{2}$/.test(cc) || cc === "ZZ") {
    skipped++;
    continue;
  }
  const lat = Number(f[f.length - 2]);
  const lon = Number(f[f.length - 1]);
  let p;
  if (cc === "DE" && Number.isFinite(lat) && Number.isFinite(lon)) p = pointOf(cc, round(lat, 0.01), round(lon, 0.01));
  else if (NEIGHBOURS.has(cc) && Number.isFinite(lat) && Number.isFinite(lon)) p = pointOf(cc, round(lat, 0.05), round(lon, 0.05));
  else p = pointOf(cc, NONE, NONE);
  if (isIPv4(a) && isIPv4(b)) {
    const s = v4(a);
    const e = v4(b);
    if (e < s) {
      skipped++;
      continue;
    }
    const lo = (r4.n - 1) * 12;
    if (r4.n > 0 && r4.buf.readUInt32BE(lo + 8) === p && r4.buf.readUInt32BE(lo + 4) + 1 === s) r4.buf.writeUInt32BE(e, lo + 4);
    else {
      const o = r4.push();
      r4.buf.writeUInt32BE(s, o);
      r4.buf.writeUInt32BE(e, o + 4);
      r4.buf.writeUInt32BE(p, o + 8);
    }
  } else if (isIPv6(a) && isIPv6(b)) {
    const s = v6bytes(a);
    const e = v6bytes(b);
    if (Buffer.compare(e, s) < 0) {
      skipped++;
      continue;
    }
    const lo = (r6.n - 1) * 36;
    if (r6.n > 0 && r6.buf.readUInt32BE(lo + 32) === p && isNext6(lo, s)) e.copy(r6.buf, lo + 16);
    else {
      const o = r6.push();
      s.copy(r6.buf, o);
      e.copy(r6.buf, o + 16);
      r6.buf.writeUInt32BE(p, o + 32);
    }
  } else skipped++;
}

if (lines === 0) fail("stdin held no line — refusing to write an empty file over a working one");

/** The order of a store's records by start: an index permutation, so no record is ever boxed. */
function order(st, cmp) {
  const idx = new Uint32Array(st.n);
  for (let i = 0; i < st.n; i++) idx[i] = i;
  return idx.sort(cmp);
}
const o4 = order(r4, (x, y) => r4.buf.readUInt32BE(x * 12) - r4.buf.readUInt32BE(y * 12));
const o6 = order(r6, (x, y) => Buffer.compare(r6.buf.subarray(x * 36, x * 36 + 16), r6.buf.subarray(y * 36, y * 36 + 16)));
for (let i = 1; i < o4.length; i++) if (r4.buf.readUInt32BE(o4[i] * 12) <= r4.buf.readUInt32BE(o4[i - 1] * 12 + 4)) fail(`overlapping IPv4 ranges at record ${i}`);
for (let i = 1; i < o6.length; i++) {
  if (Buffer.compare(r6.buf.subarray(o6[i] * 36, o6[i] * 36 + 16), r6.buf.subarray(o6[i - 1] * 36 + 16, o6[i - 1] * 36 + 32)) <= 0) fail(`overlapping IPv6 ranges at record ${i}`);
}

// The sanity floor (#564 review N2): a German range count below it means the
// download is truncated, a different product, or a format change — and a
// file built from it would quietly make most German visitors Germany-wide.
// October 2026 held 23 289 German points over far more ranges; the floor is
// deliberately far below that. `--min-de-ranges` exists for the fixture test
// alone: the GeoIP refresh job never passes it.
const isDe = (p) => pointList[p][0] === "DE";
let deRanges = 0;
for (let i = 0; i < r4.n; i++) if (isDe(r4.buf.readUInt32BE(i * 12 + 8))) deRanges++;
for (let i = 0; i < r6.n; i++) if (isDe(r6.buf.readUInt32BE(i * 36 + 32))) deRanges++;
const de = pointList.filter((p) => p[0] === "DE").length;
if (de === 0) fail("no German range in the input — this is not the file it claims to be");
if (deRanges < MIN_DE_RANGES) fail(`only ${deRanges} German range(s), fewer than the floor of ${MIN_DE_RANGES} — a truncated or foreign file; the current one stays`);

const tmp = `${out}.part`;
const fd = openSync(tmp, "w", 0o644);
const header = Buffer.alloc(HEADER);
MAGIC.copy(header, 0);
header.writeUInt32BE(r4.n, 8);
header.writeUInt32BE(r6.n, 12);
header.writeUInt32BE(pointList.length, 16);
header.write(release, 20, "latin1");
writeSync(fd, header);
const CHUNK = 4096;
for (let i = 0; i < o4.length; i += CHUNK) {
  const part = o4.subarray(i, i + CHUNK);
  const b = Buffer.alloc(part.length * 12);
  part.forEach((r, j) => r4.buf.copy(b, j * 12, r * 12, r * 12 + 12));
  writeSync(fd, b);
}
for (let i = 0; i < o6.length; i += CHUNK) {
  const part = o6.subarray(i, i + CHUNK);
  const b = Buffer.alloc(part.length * 36);
  part.forEach((r, j) => r6.buf.copy(b, j * 36, r * 36, r * 36 + 36));
  writeSync(fd, b);
}
const pb = Buffer.alloc(pointList.length * 6);
pointList.forEach(([cc, lat, lon], j) => {
  pb.write(cc, j * 6, "latin1");
  pb.writeInt16BE(lat, j * 6 + 2);
  pb.writeInt16BE(lon, j * 6 + 4);
});
writeSync(fd, pb);
closeSync(fd);
renameSync(tmp, out);
process.stdout.write(`✓ geoip-build: ${lines} line(s) read, ${skipped} skipped, ${r4.n} IPv4 and ${r6.n} IPv6 range(s), ${pointList.length} point(s) (${de} in Germany, ${deRanges} German range(s)), release ${release} → ${out}\n`);
