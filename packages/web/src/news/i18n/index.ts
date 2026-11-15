/**
 * The News entries' texts for the fifteen languages of #753 (2.3.12): one JSON
 * file per language, `{ "<entry id>": { title, body, ask } }`, registered here
 * as each language goes live. Machine-translated (owner 2026-10-15); the
 * credit lines are never here — they render from the register, German and
 * verbatim, by the entry's `credits` ids. Types only from `../entries.js`, so
 * no module cycle forms.
 */
import type { Lang } from "../../site/pages.js";
import type { NewsText } from "../entries.js";
import el from "./el.json" with { type: "json" };
import lv from "./lv.json" with { type: "json" };
import lt from "./lt.json" with { type: "json" };
import sr from "./sr.json" with { type: "json" };
import hr from "./hr.json" with { type: "json" };
import hu from "./hu.json" with { type: "json" };
import sk from "./sk.json" with { type: "json" };
import cs from "./cs.json" with { type: "json" };
import pl from "./pl.json" with { type: "json" };
import da from "./da.json" with { type: "json" };
import nl from "./nl.json" with { type: "json" };
import pt from "./pt.json" with { type: "json" };
import it from "./it.json" with { type: "json" };
import es from "./es.json" with { type: "json" };
import fr from "./fr.json" with { type: "json" };

export const NEWS_TEXTS: Readonly<Partial<Record<Lang, Readonly<Record<string, NewsText>>>>> = { fr, es, it, pt, nl, da, pl, cs, sk, hu, hr, sr, lt, lv, el };

/** One entry's texts in every registered language that has it. */
export function newsTextsFor(id: string): Partial<Record<Lang, NewsText>> {
  const out: Partial<Record<Lang, NewsText>> = {};
  for (const [lang, texts] of Object.entries(NEWS_TEXTS) as [Lang, Readonly<Record<string, NewsText>>][]) {
    const t = texts[id];
    if (t !== undefined) out[lang] = t;
  }
  return out;
}
