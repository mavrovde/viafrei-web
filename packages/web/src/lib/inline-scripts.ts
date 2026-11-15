/**
 * #1064: the page's inline scripts as the build minified them. Their sources
 * stay readable where they are written — the island (`location/island.ts`,
 * `placeIsland`), the motorway bar (`lib/motorway-filter.ts`, `FILTER_JS`) and
 * the freshness ages (`AGES_JS`), the place cards' topic filter (`lib/topic-filter.ts`, `TOPICS_JS`, #1050) — and `scripts/inline-min.ts` prints each as
 * ONE function expression through esbuild's minifier into
 * `src/generated/inline-scripts.json`. `test/inline-scripts.test.ts` holds the
 * file equal to the sources, so a source edited without regenerating is red
 * (`npm run web:inline` writes it). esbuild is a build tool and is not in the
 * runtime image: the page reads the generated text, never a minifier.
 */
import inline from "../generated/inline-scripts.json" with { type: "json" };

export const INLINE_SCRIPT_NAMES = ["island", "retry", "filter", "ages", "pager", "topics", "refresh", "sid", "evf", "placehead", "suggest", "near", "recent", "actionbar", "desk", "lmap", "lmapload"] as const;
export type InlineScriptName = (typeof INLINE_SCRIPT_NAMES)[number];
export const INLINE_SCRIPTS: Readonly<Record<InlineScriptName, string>> = inline;
