/**
 * #892: the site's slug builder IS the ingest one — a byte-identical copy,
 * because the site may import no database-holding workspace at runtime
 * (`scripts/check_web_boundary.sh`). Edit `packages/ingest/src/platform/slug.ts`
 * and copy it here.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string): string => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

describe("the slug builder has one source", () => {
  // cross-repo(viafrei): a byte-for-byte copy of an ingest SOURCE file; the released image ships it compiled, so the one-source check belongs to viafrei, which holds both until the copy is retired (viafrei-web#2, docs/moved-from-viafrei.md)
  it.skip("packages/web/src/site/slug.ts is a byte-identical copy of the ingest builder", () => {
    expect(read("../src/site/slug.ts")).toBe(read("../../../.pinned/app/packages/ingest/dist/platform/slug.js"));
  });
});
