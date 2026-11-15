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
  it("packages/web/src/site/slug.ts is a byte-identical copy of the ingest builder", () => {
    expect(read("../src/site/slug.ts")).toBe(read("../../ingest/src/platform/slug.ts"));
  });
});
