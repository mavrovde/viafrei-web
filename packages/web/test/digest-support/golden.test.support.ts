/**
 * The golden's codec (#923): a judged card set and the snapshot it was judged
 * from, written as JSON and read back as the same values — a `Date`, a `Map`,
 * a `Set`, an `undefined` property and a non-finite number survive the round
 * trip, so a card set compared through it is compared field for field.
 */

/** Any value as text; `indent` for a file a person may read in a diff. */
export function goldenText(v: unknown, indent?: number): string {
  return JSON.stringify(
    v,
    function (this: Record<string, unknown>, k: string, val: unknown) {
      const raw = this[k];
      if (raw instanceof Date) return { $d: Number.isNaN(raw.getTime()) ? "NaN" : raw.toISOString() };
      if (raw instanceof Map) return { $m: [...raw] };
      if (raw instanceof Set) return { $s: [...raw] };
      if (raw === undefined) return { $u: 1 };
      if (typeof raw === "bigint") return { $b: raw.toString() };
      if (typeof raw === "number" && !Number.isFinite(raw)) return { $n: String(raw) };
      return val;
    },
    indent,
  );
}

/** The value `goldenText` wrote. */
export function fromGoldenText(text: string): unknown {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v === null || typeof v !== "object") return v;
    const o = v as Record<string, unknown>;
    const keys = Object.keys(o);
    if (keys.length === 1) {
      if (typeof o.$d === "string") return new Date(o.$d === "NaN" ? Number.NaN : o.$d);
      if (Array.isArray(o.$m)) return new Map((o.$m as unknown[]).map(walk) as [unknown, unknown][]);
      if (Array.isArray(o.$s)) return new Set((o.$s as unknown[]).map(walk));
      if (o.$u === 1) return undefined;
      if (typeof o.$b === "string") return BigInt(o.$b);
      if (typeof o.$n === "string") return Number(o.$n);
    }
    const out: Record<string, unknown> = {};
    for (const k of keys) out[k] = walk(o[k]);
    return out;
  };
  return walk(JSON.parse(text));
}
