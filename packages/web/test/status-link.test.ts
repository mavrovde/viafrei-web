/**
 * The footer does NOT link the status page (owner 2026-10-13: "Close the
 * status panel by the ip white list again, it should be available only to our
 * laptop"). status.viafrei.de answers 403 to every address outside the
 * allow-list, so a link on every page would send every visitor to a refusal.
 * Until #589 the footer linked it in the reader's language; this test is the
 * inverse of that one, so re-opening the page is a deliberate edit here too.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { all } from "@viafrei/design/testing";
import { LIVE_LANGS } from "../src/site/pages.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "src");
const footer = readFileSync(join(SRC, "components", "Footer.astro"), "utf8");
const endpoints = readFileSync(join(SRC, "site", "endpoints.ts"), "utf8");

describe("the footer does not link the allow-listed status page", () => {
  it("names no status origin and no status key", () => {
    expect(all(footer, "footer").length).toBeGreaterThan(0);
    expect(footer).not.toContain("status.viafrei.de");
    expect(footer).not.toContain("STATUS_ORIGIN");
    expect(footer).not.toContain("footer.status");
    expect(endpoints).not.toContain("status.viafrei.de");
  });

  it("no catalogue keeps the footer's status label (read from every live language, not nothing)", () => {
    expect(LIVE_LANGS.length).toBeGreaterThanOrEqual(7);
    for (const lang of LIVE_LANGS) {
      const cat = JSON.parse(readFileSync(join(SRC, "i18n", `${lang}.json`), "utf8")) as { footer?: Record<string, string> };
      expect(cat.footer, lang).toBeDefined();
      expect(cat.footer?.["privacy"], lang).toBeTruthy();
      expect(cat.footer?.["status"], lang).toBeUndefined();
    }
  });
});
