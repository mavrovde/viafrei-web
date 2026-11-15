/**
 * The language menu's country flags (#989): the registry ties every live
 * language to its flags and nothing else does, every flag the registry names is
 * a symbol of the sprite, and the sprite stays small, inline and request-free.
 * The rendered menus are judged against the build in `e2e/flags.e2e.ts`.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { FLAG_ART, FLAG_CODES, FLAG_HEIGHT, FLAG_VIEWBOX, FLAG_WIDTH, flagSprite, flagSymbolId } from "../src/i18n/flags.js";
import { LOCALES, flagsOf, type Locale } from "../src/i18n/locales.js";
import { LIVE_LANGS } from "../src/site/pages.js";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");
const symbolIds = (sprite: string): Set<string> => new Set([...sprite.matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1] ?? ""));

describe("the registry's flags (#989)", () => {
  it("every live language has at least one flag, each a flag the sprite draws", () => {
    expect(LIVE_LANGS.length).toBeGreaterThanOrEqual(22);
    for (const l of LIVE_LANGS) {
      const f = flagsOf(l);
      expect(f.length, l).toBeGreaterThanOrEqual(1);
      for (const c of f) expect(FLAG_CODES, `${l}: ${c}`).toContain(c);
    }
  });

  it("English shows exactly two flags, the UK's then the USA's; every other language exactly one", () => {
    expect(flagsOf("en")).toEqual(["gb", "us"]);
    for (const l of LIVE_LANGS.filter((x) => x !== "en")) expect(flagsOf(l), l).toHaveLength(1);
  });

  it("twenty-three flags for twenty-two languages, no two languages on one flag, and no flag drawn that nothing shows", () => {
    const all = LIVE_LANGS.flatMap((l) => flagsOf(l));
    expect(all).toHaveLength(23);
    expect(new Set(all).size).toBe(all.length);
    expect([...all].sort()).toEqual([...FLAG_CODES].sort());
  });

  it("a locale without a flag is refused, never shown bare", () => {
    const bare: readonly Locale[] = LOCALES.map((l) => (l.code === "fr" ? { ...l, flag: [] } : l));
    expect(() => flagsOf("fr", bare)).toThrow(/locale 'fr' has no flag/);
    expect(() => flagsOf("de", bare)).not.toThrow();
    expect(() => flagsOf("de", bare.filter((l) => l.code !== "de"))).toThrow(/no locale 'de'/);
  });

  it("a locale written without the field does not compile", () => {
    // @ts-expect-error -- `flag` is required on every locale (#989)
    const noFlag: Locale = { code: "xx", label: "X", reviewed: true };
    expect(noFlag.code).toBe("xx");
  });

  it("the registry is the ONLY place a language meets a flag: no other source file names a `flag:` list or a flag symbol id", () => {
    const files: string[] = [];
    const walk = (d: string): void => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|astro|svelte)$/.test(n)) files.push(p);
      }
    };
    walk(join(WEB, "src"));
    expect(files.length).toBeGreaterThan(20);
    const offenders = files.filter((p) => !p.endsWith(join("i18n", "locales.ts")) && /\bflag:\s*\[|#flag-[a-z]{2}\b|flag-(?:gb|us|de)\b/.test(readFileSync(p, "utf8")));
    expect(offenders).toEqual([]);
  });
});

describe("the sprite (#989)", () => {
  const sprite = flagSprite();

  it("every flag a language shows is a <symbol> of the sprite", () => {
    const ids = symbolIds(sprite);
    expect(ids.size).toBe(FLAG_CODES.length);
    for (const l of LIVE_LANGS) for (const c of flagsOf(l)) expect(ids.has(flagSymbolId(c)), `${l}: #${flagSymbolId(c)}`).toBe(true);
  });

  it("is 4:3 throughout: every symbol on the 24 × 18 grid, every flag shown 20 × 15", () => {
    expect(FLAG_VIEWBOX).toBe("0 0 24 18");
    expect(FLAG_WIDTH * 3).toBe(FLAG_HEIGHT * 4);
    expect([...sprite.matchAll(/<symbol [^>]*viewBox="([^"]+)"/g)].map((m) => m[1])).toEqual(FLAG_CODES.map(() => FLAG_VIEWBOX));
  });

  it("is inline and decorative: hidden from assistive technology, no request, no text, no emoji, no script", () => {
    expect(sprite).toMatch(/^<svg class="flag-sprite" aria-hidden="true" focusable="false">/);
    expect(sprite).not.toMatch(/<image|<text|<script|<foreignObject|https?:|url\(|xlink:href|<use/i);
    expect(sprite).not.toMatch(/\p{Extended_Pictographic}|\p{Regional_Indicator}/u);
    for (const c of FLAG_CODES) expect(FLAG_ART[c].length, c).toBeGreaterThan(20);
  });

  it("is small: its gzip size is recorded here and bounded (1.5 KB)", () => {
    const gz = gzipSync(Buffer.from(sprite, "utf8"), { level: 9 }).length;
    // measured at #989: 5 148 B raw, 1 143 B gzip; the page budget (LIMITS in scripts/budget.ts) is judged on the built pages by that gate
    expect(gz).toBeLessThan(1536);
    expect(Buffer.byteLength(sprite)).toBeLessThan(6144);
  });

  it("the stylesheet keeps the sprite out of the layout without display:none, and gives every flag its hairline", () => {
    const css = readFileSync(join(WEB, "src", "styles", "site.css"), "utf8");
    const rule = (sel: string): string => new RegExp(`(?:^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\{([^}]*)\\}`).exec(css)?.[1] ?? "";
    expect(rule(".flag-sprite")).toMatch(/position: absolute;.*width: 0;.*height: 0;/);
    expect(rule(".flag-sprite")).not.toMatch(/display:\s*none/);
    expect(rule(".flag")).toMatch(/border: 1px solid var\(--line\);/);
    expect(rule(".flag")).toMatch(/flex: none;/);
  });
});
