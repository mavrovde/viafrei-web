/**
 * #1072 part 2: the shell builds each Intl formatter ONCE per (locale, options).
 *
 * `viafrei-web` was memcg-killed at 126 MB RSS after the 2.4.1 deploy; an
 * `Intl.DateTimeFormat` with a zone costs ~31 KB of ICU memory outside the heap,
 * and every render built its own. The pin: N renders of every formatting path
 * in every language construct exactly as many formatters as ONE render did.
 */
import { afterEach, describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { berlinDateTime, berlinTime, calendarDay } from "../src/lib/dates.js";
import { figure, price } from "../src/components/tile-contract.js";
import { answerParts, parseAsks } from "../src/lib/ask.js";
import { summaryText, type FilterCard } from "../src/lib/motorway-filter.js";
import { placeMeta } from "../src/site/meta.js";
import { berlinDay } from "../src/news/atom.js";
import { releaseDay } from "../src/site/lastmod.js";
import { dateTimeFormat, intlKey, numberFormat } from "../src/lib/intl-formats.js";
import { LIVE_LANGS } from "../src/site/pages.js";

const KINDS = ["DateTimeFormat", "NumberFormat", "ListFormat", "PluralRules"] as const;
type Kind = (typeof KINDS)[number];
const real = Object.fromEntries(KINDS.map((k) => [k, Intl[k]])) as Record<Kind, unknown>;
afterEach(() => {
  for (const k of KINDS) (Intl as unknown as Record<string, unknown>)[k] = real[k];
});

/** Count every `new Intl.<kind>` from here on (the cache reads `Intl` at construction time). */
function count(): { n: number } {
  const c = { n: 0 };
  for (const k of KINDS) {
    (Intl as unknown as Record<string, unknown>)[k] = new Proxy(real[k] as new (...a: unknown[]) => object, {
      construct(t, args): object {
        c.n++;
        const made: object = Reflect.construct(t, args);
        return made;
      },
    });
  }
  return c;
}

const ASKS = parseAsks(JSON.parse(readFileSync(new URL("./fixtures/asks.json", import.meta.url), "utf8")) as unknown);
const CARDS: FilterCard[] = [
  { kind: "parking", title: "Parken", n: 7 },
  { kind: "charging", title: "Laden", n: 5 },
  { kind: "jams", title: "Staus", n: 1 },
];
const AT = new Date("2026-10-26T08:46:00Z");

/** One "render": every formatting path the shell runs, in every live language. */
function renderAll(): string {
  let out = "";
  for (const lang of LIVE_LANGS) {
    out += berlinTime(AT, lang) + berlinDateTime(AT, lang) + calendarDay("2026-10-26", lang);
    out += summaryText(lang, CARDS, new Set(["parking", "charging"]), 50) + summaryText(lang, CARDS, new Set(["jams"]));
    out += placeMeta("Köln", lang, null, "Nordrhein-Westfalen").description;
    for (const e of ASKS.values()) out += (answerParts(lang, e) ?? []).map((p) => p.text).join("");
  }
  for (const lang of ["de", "en"] as const) out += figure(12_345, lang) + price(1.789, lang);
  out += berlinDay("2026-10-25");
  // the sitemap's lastmod of a page new since the cut, with the build instant prod sets
  out += releaseDay({ APP_BUILT_AT: "2026-10-28T22:59:00Z" });
  return out;
}

describe("#1072 part 2: one Intl formatter per locale and options in the web shell", () => {
  it("N renders build no more formatters than the first one did", () => {
    const first = renderAll(); // warms the caches
    const c = count();
    const N = 50;
    for (let i = 0; i < N; i++) expect(renderAll()).toBe(first);
    expect(c.n).toBe(0);
  });

  it("a cold cache builds each (locale, options) once, however often it is asked", () => {
    const c = count();
    const o = { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hour12: false } as const;
    const a = dateTimeFormat("de-DE-x-pin1072", o);
    for (let i = 0; i < 100; i++) expect(dateTimeFormat("de-DE-x-pin1072", { ...o })).toBe(a);
    expect(numberFormat("en-GB-x-pin1072", { maximumFractionDigits: 1 })).not.toBe(numberFormat("en-GB-x-pin1072", { maximumFractionDigits: 2 }));
    expect(c.n).toBe(3);
  });

  // The key is COMPLETE: change only the language, only an option or only the
  // time zone, and the cache must hand back a formatter that answers what a new
  // one with THOSE arguments does — never the formatter of the first caller.
  it("the key carries the language, every option and the time zone (each varied alone)", () => {
    const D = real.DateTimeFormat as typeof Intl.DateTimeFormat;
    const base: Intl.DateTimeFormatOptions = { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", weekday: "long" };
    const variants: Array<[string, Intl.DateTimeFormatOptions]> = [
      ["de-DE", base],
      ["en-GB", base], // language
      ["de-DE", { ...base, timeZone: "UTC" }], // time zone
      ["de-DE", { ...base, timeZone: "America/New_York" }],
      ["de-DE", { ...base, weekday: "short" }], // an option's value
      ["de-DE", { ...base, second: "2-digit" }], // an option added
    ];
    const outs = new Set<string>();
    for (const [l, o] of variants) {
      const got = dateTimeFormat(l, o).format(AT);
      expect(got, `${l} ${JSON.stringify(o)}`).toBe(new D(l, o).format(AT));
      outs.add(got);
    }
    expect(outs.size).toBe(variants.length); // every variant reads differently, so a shared formatter would have shown
    const keys = new Set(variants.map(([l, o]) => intlKey(l, o)));
    expect(keys.size).toBe(variants.length);
  });

  it("option order and an undefined option do not split the cache", () => {
    expect(intlKey("de-DE", { hour: "2-digit", timeZone: "Europe/Berlin" })).toBe(intlKey("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit" }));
    expect(intlKey("de-DE", { hour: "2-digit", minute: undefined })).toBe(intlKey("de-DE", { hour: "2-digit" }));
    expect(intlKey(["de-DE", "en"], {})).not.toBe(intlKey("de-DE", {}));
    const c = count();
    const a = dateTimeFormat("fr-FR-x-ord1072", { minute: "2-digit", timeZone: "Europe/Berlin", hour: "2-digit" });
    expect(dateTimeFormat("fr-FR-x-ord1072", { hour: "2-digit", timeZone: "Europe/Berlin", minute: "2-digit" })).toBe(a);
    expect(c.n).toBe(1);
  });

  it("answers exactly what a new formatter does", () => {
    const D = real.DateTimeFormat as typeof Intl.DateTimeFormat;
    const N = real.NumberFormat as typeof Intl.NumberFormat;
    const o: Intl.DateTimeFormatOptions = { timeZone: "Europe/Berlin", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" };
    for (const l of ["de-DE", "ru-RU", "el-GR-u-hc-h23", "pt-PT"]) expect(dateTimeFormat(l, o).format(AT)).toBe(new D(l, o).format(AT));
    expect(numberFormat("de-DE", { maximumFractionDigits: 0 }).format(12345.6)).toBe(new N("de-DE", { maximumFractionDigits: 0 }).format(12345.6));
  });

  // The sweep: no server-side file builds a formatter per call any more. Browser script SOURCE (a template
  // string the page ships) and module-level constants are named here with their reason; anything else is red.
  it("no server-side source under src/ constructs an Intl formatter outside intl-formats.ts", () => {
    const root = new URL("../src/", import.meta.url).pathname;
    const files: string[] = [];
    const walk = (d: string): void => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|astro|svelte)$/.test(f) && !f.endsWith(".test.ts")) files.push(p);
      }
    };
    walk(root);
    expect(files.length).toBeGreaterThan(50);
    const ALLOW: Readonly<Record<string, string>> = {
      "lib/intl-formats.ts": "the cache itself",
      "lib/motorway-filter.ts": "browser script source inside AGES_JS / FILTER_JS template strings",
      "lib/card-refresh.ts": "browser script source inside REFRESH_JS (#939: one formatter per page, the failure line's Berlin time)",
      "lib/pwa.ts": "service-worker script source inside serviceWorkerSource() (#1181 feature 7: the offline line's Berlin time, one formatter per offline answer, in the worker)",
      "site/attribution-year.ts": "one module-level constant",
      "i18n/index.ts": "PluralRules kept per language in PLURAL_RULES",
      "i18n/locales.ts": "one module-level Collator",
    };
    const found: string[] = [];
    for (const p of files) {
      const rel = p.slice(root.length);
      if (/new Intl\.[A-Z]/.test(readFileSync(p, "utf8")) && ALLOW[rel] === undefined) found.push(rel);
    }
    expect(found).toEqual([]);
    for (const rel of Object.keys(ALLOW)) expect(readFileSync(join(root, rel), "utf8"), rel).toMatch(/new Intl\.[A-Z]/);
  });
});
