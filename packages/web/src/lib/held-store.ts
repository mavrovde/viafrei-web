/**
 * #1205 review S8/S9: the one bounded store behind the held pages (`page-held.ts`) and the held sitemaps
 * (`sitemap-held.ts`): text kept gzip-compressed (level 1), at most `maxBytes` in all and `entryMaxBytes` each, the
 * least recently used dropped first; lost on a restart, never written anywhere.
 *
 * The count is of the memory actually held (S9): `gzipSync` may hand back a view into a larger buffer (zlib's output
 * chunk, or Node's shared pool for a small one), so each result is copied into an allocation of its own exact size
 * (`Buffer.alloc`, never pooled) before it is kept, and `bytes` is the sum of those allocations — never undercounted
 * by a slab that a small view would keep alive.
 */
import { gunzipSync, gzipSync } from "node:zlib";

type Entry<M> = { readonly gz: Buffer; readonly meta: M };

/** `gz` in an allocation of its own exact size, so its length is all the memory it holds. */
export function owned(gz: Buffer): Buffer {
  const copy = Buffer.alloc(gz.length);
  gz.copy(copy);
  return copy;
}

export class HeldStore<M> {
  private readonly held = new Map<string, Entry<M>>();
  private total = 0;

  constructor(
    readonly maxBytes: number,
    readonly entryMaxBytes: number,
    readonly maxEntries: number = Number.POSITIVE_INFINITY,
  ) {}

  /**
   * Keep `text` for `key` (replacing what was held); false when its compressed size is over the entry bound — and then
   * the copy already held for `key` STAYS (#1205 review): a new answer too large to keep is no reason to forget the
   * last one that fit.
   */
  set(key: string, text: string, meta: M): boolean {
    const gz = owned(gzipSync(text, { level: 1 }));
    if (gz.length > this.entryMaxBytes) return false;
    this.drop(key);
    this.held.set(key, { gz, meta });
    this.total += gz.buffer.byteLength;
    while (this.total > this.maxBytes || this.held.size > this.maxEntries) {
      const oldest = this.held.keys().next().value;
      if (oldest === undefined) break;
      this.drop(oldest);
    }
    return true;
  }

  /** The text held for `key` (moved to the young end), or null. */
  get(key: string): { readonly text: string; readonly meta: M } | null {
    const e = this.held.get(key);
    if (e === undefined) return null;
    this.held.delete(key);
    this.held.set(key, e);
    return { text: gunzipSync(e.gz).toString("utf8"), meta: e.meta };
  }

  /** Entries held, the bytes counted, and (tests) the bytes their backing allocations really hold. */
  stats(): { readonly entries: number; readonly bytes: number; readonly backingBytes: number } {
    let backing = 0;
    for (const e of this.held.values()) backing += e.gz.buffer.byteLength;
    return { entries: this.held.size, bytes: this.total, backingBytes: backing };
  }

  clear(): void {
    this.held.clear();
    this.total = 0;
  }

  private drop(key: string): void {
    const e = this.held.get(key);
    if (e === undefined) return;
    this.total -= e.gz.buffer.byteLength;
    this.held.delete(key);
  }
}
