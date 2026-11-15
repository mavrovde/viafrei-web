/**
 * The copy deck, typed (#376 PR-02, #375 A7).
 *
 * `de.json` and `en.json` hold every string the SHELL and the content pages
 * say — chrome, headings, the hero, the prompts, the connect steps, the
 * consent bar. They hold NO legal string: credit lines and the MTS-K note come
 * from the register (`LICENCE_CATALOGUE`, `ATTRIBUTION`) and are rendered
 * verbatim in German whatever the page language; `legal-strings.test.ts`
 * asserts no catalogue value contains one. Tile text comes from the digest's
 * own `presentation/i18n.ts` with the fragment and is not here either.
 *
 * The key set is the German file's, flattened to dotted paths — so a key
 * missing from English is a compile error through `MessageKey`, and
 * `i18n-parity.test.ts` asserts the two files agree at runtime as well
 * (lesson §127: a fallback that returns the other language is a gap that
 * never fails).
 */
import de from "./de.json" with { type: "json" };
import en from "./en.json" with { type: "json" };
import ru from "./ru.json" with { type: "json" };
import bg from "./bg.json" with { type: "json" };
import uk from "./uk.json" with { type: "json" };
import ro from "./ro.json" with { type: "json" };
import tr from "./tr.json" with { type: "json" };
import fr from "./fr.json" with { type: "json" };
import es from "./es.json" with { type: "json" };
import it from "./it.json" with { type: "json" };
import pt from "./pt.json" with { type: "json" };
import nl from "./nl.json" with { type: "json" };
import da from "./da.json" with { type: "json" };
import pl from "./pl.json" with { type: "json" };
import cs from "./cs.json" with { type: "json" };
import sk from "./sk.json" with { type: "json" };
import hu from "./hu.json" with { type: "json" };
import hr from "./hr.json" with { type: "json" };
import sr from "./sr.json" with { type: "json" };
import lt from "./lt.json" with { type: "json" };
import lv from "./lv.json" with { type: "json" };
import el from "./el.json" with { type: "json" };
import { LIVE_LANGS, type Lang } from "../site/pages.js";
import { TAGS } from "../lib/dates.js";

type Leaves<T, P extends string = ""> = T extends string
  ? P
  : { [K in keyof T & string]: Leaves<T[K], P extends "" ? K : `${P}.${K}`> }[keyof T & string];

export type MessageKey = Leaves<typeof de>;

function flatten(tree: unknown, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  if (typeof tree === "string") {
    out[prefix] = tree;
    return out;
  }
  if (tree === null || typeof tree !== "object" || Array.isArray(tree)) {
    throw new Error(`i18n: '${prefix}' is neither a string nor an object — arrays are not part of the deck`);
  }
  for (const [k, v] of Object.entries(tree)) flatten(v, prefix === "" ? k : `${prefix}.${k}`, out);
  return out;
}

const FLAT: Readonly<Record<Lang, Readonly<Record<string, string>>>> = Object.freeze({
  de: Object.freeze(flatten(de)),
  en: Object.freeze(flatten(en)),
  ru: Object.freeze(flatten(ru)),
  bg: Object.freeze(flatten(bg)),
  uk: Object.freeze(flatten(uk)),
  ro: Object.freeze(flatten(ro)),
  tr: Object.freeze(flatten(tr)),
  fr: Object.freeze(flatten(fr)),
  es: Object.freeze(flatten(es)),
  it: Object.freeze(flatten(it)),
  pt: Object.freeze(flatten(pt)),
  nl: Object.freeze(flatten(nl)),
  da: Object.freeze(flatten(da)),
  pl: Object.freeze(flatten(pl)),
  cs: Object.freeze(flatten(cs)),
  sk: Object.freeze(flatten(sk)),
  hu: Object.freeze(flatten(hu)),
  hr: Object.freeze(flatten(hr)),
  sr: Object.freeze(flatten(sr)),
  lt: Object.freeze(flatten(lt)),
  lv: Object.freeze(flatten(lv)),
  el: Object.freeze(flatten(el)),
});

/** Every key, from the German file. */
export const MESSAGE_KEYS: readonly string[] = Object.keys(FLAT.de);

/**
 * One string, in one language. Interpolation is `{name}` → `vars.name`; a
 * placeholder left unfilled is an error, because "vor {d}" on a public page is
 * a defect and not a default.
 */
export function t(lang: Lang, key: MessageKey, vars?: Readonly<Record<string, string | number>>): string {
  const raw = FLAT[lang][key];
  if (raw === undefined) throw new Error(`i18n: no '${key}' in ${lang}.json`);
  const out = plurals(lang, key, raw, vars).replace(/\{(\w+)\}/g, (_, name: string) => {
    const v = vars?.[name];
    if (v === undefined) throw new Error(`i18n: '${key}' needs {${name}} and none was given`);
    return String(v);
  });
  return out;
}

const PLURAL_RULES = new Map<Lang, Intl.PluralRules>();

/**
 * A count beside a noun agrees with it (#753): Polish says "1 narzędzie",
 * "2 narzędzia", "5 narzędzi", and Latvian, Lithuanian, Czech, Slovak,
 * Croatian and Serbian have forms of their own. A catalogue value may carry an
 * ICU plural block per count — `{n, plural, one {# narzędzie} few {# narzędzia}
 * many {# narzędzi} other {# narzędzia}}` — and the language's
 * `Intl.PluralRules` (by its Intl tag, `TAGS`: `pt` is pt-PT) picks the
 * branch; `#` is the count, a category the block lacks falls back to `other`.
 * A block whose count is not given is an error, like any unfilled placeholder.
 */
export function plurals(lang: Lang, key: string, raw: string, vars?: Readonly<Record<string, string | number>>): string {
  if (!raw.includes(", plural,")) return raw;
  let out = "";
  let from = 0;
  const re = /\{(\w+),\s*plural,/g;
  for (let m = re.exec(raw); m !== null; m = re.exec(raw)) {
    let depth = 0;
    let end = m.index;
    for (; end < raw.length; end++) {
      if (raw[end] === "{") depth++;
      else if (raw[end] === "}" && --depth === 0) break;
    }
    if (depth !== 0) throw new Error(`i18n: '${key}' has an unbalanced plural block`);
    const name = m[1] ?? "";
    const v = vars?.[name];
    if (v === undefined) throw new Error(`i18n: '${key}' needs {${name}} and none was given`);
    const branches = new Map<string, string>();
    for (const b of raw.slice(m.index + m[0].length, end).matchAll(/(zero|one|two|few|many|other)\s*\{([^{}]*)\}/g)) branches.set(b[1] ?? "", b[2] ?? "");
    let rules = PLURAL_RULES.get(lang);
    if (rules === undefined) {
      rules = new Intl.PluralRules(TAGS[lang]);
      PLURAL_RULES.set(lang, rules);
    }
    const branch = branches.get(rules.select(Number(v))) ?? branches.get("other");
    if (branch === undefined) throw new Error(`i18n: '${key}' has a plural block with no 'other'`);
    out += raw.slice(from, m.index) + branch.replace(/#/g, String(v));
    from = end + 1;
    re.lastIndex = from;
  }
  return out + raw.slice(from);
}

export function isLang(x: string): x is Lang {
  return (LIVE_LANGS as readonly string[]).includes(x);
}

/** The flat catalogue of one language — for tests and the parity sweep, not for templates. */
export function catalogue(lang: Lang): Readonly<Record<string, string>> {
  return FLAT[lang];
}
