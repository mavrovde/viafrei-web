/**
 * One `Intl` formatter per (locale, options), built once and reused (#1072 part 2).
 *
 * The web shell's copy of `packages/digest/src/intl-formats.ts` (the shell may
 * not import the digest, `check_web_boundary.sh`). Why it exists: an
 * `Intl.DateTimeFormat` with a `timeZone` holds ~31 KB of ICU memory OUTSIDE
 * V8's heap (an `Intl.NumberFormat` ~3 KB) — V8 sees only the small wrapper, so
 * the heap does not grow and nothing triggers a collection while the native side
 * piles up until the kernel's memcg kills the process. `viafrei-web` was
 * memcg-killed at 126 MB RSS four minutes after the 2.4.1 deploy (oom_kills
 * 2436), and every page render built its formatters afresh. A formatter is
 * immutable and its options come from code, so a cached one answers exactly what
 * a new one would.
 *
 * Bounded: the keys are code literals × the site's languages; `INTL_FORMATS_MAX`
 * per kind caps a caller that builds options from data (the oldest goes first).
 */

/** The most formatters kept per kind. */
export const INTL_FORMATS_MAX = 512;

type Ctor<O, F> = new (locale: string | readonly string[] | undefined, options?: O) => F;

/**
 * The cache key: the locale(s) and EVERY option, the time zone among them, with
 * the option names sorted so `{a, b}` and `{b, a}` share one formatter. An option
 * whose value is `undefined` is left out, as `Intl` itself ignores it. Exported
 * for the completeness test (#1072): a key that dropped any of language, option
 * or zone would hand one caller another caller's formatter.
 */
export function intlKey(locale: string | readonly string[] | undefined, options?: object): string {
  const loc = Array.isArray(locale) ? locale.join(",") : String(locale);
  if (options === undefined) return `${loc}\u0000`;
  const o = options as Record<string, unknown>;
  const names = Object.keys(o).filter((k) => o[k] !== undefined).sort();
  return `${loc}\u0000${JSON.stringify(names.map((k) => [k, o[k]]))}`;
}

function memo<O extends object, F>(make: () => Ctor<O, F>): (locale: string | readonly string[] | undefined, options?: O) => F {
  const kept = new Map<string, F>();
  return (locale, options) => {
    const key = intlKey(locale, options);
    let f = kept.get(key);
    if (f === undefined) {
      // Read at call time, so a test's counting wrapper of `Intl` sees the construction.
      const C = make();
      f = new C(locale, options);
      if (kept.size >= INTL_FORMATS_MAX) kept.delete(kept.keys().next().value as string);
      kept.set(key, f);
    }
    return f;
  };
}

/** `new Intl.DateTimeFormat(locale, options)`, kept. */
export const dateTimeFormat = memo<Intl.DateTimeFormatOptions, Intl.DateTimeFormat>(() => Intl.DateTimeFormat);
/** `new Intl.NumberFormat(locale, options)`, kept. */
export const numberFormat = memo<Intl.NumberFormatOptions, Intl.NumberFormat>(() => Intl.NumberFormat);
/** `new Intl.ListFormat(locale, options)`, kept. */
export const listFormat = memo<Intl.ListFormatOptions, Intl.ListFormat>(() => Intl.ListFormat);
/** `new Intl.PluralRules(locale, options)`, kept. */
export const pluralRules = memo<Intl.PluralRulesOptions, Intl.PluralRules>(() => Intl.PluralRules);
