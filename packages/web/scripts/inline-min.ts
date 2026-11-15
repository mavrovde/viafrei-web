/**
 * #1064: prints the page's inline scripts minified into
 * `src/generated/inline-scripts.json` (read by `src/lib/inline-scripts.ts`).
 * Each source becomes ONE function expression of its configuration — the
 * island `placeIsland(w, cfg)`, the motorway bar `function (C) { FILTER_JS }`,
 * the freshness ages `function (C) { AGES_JS }` — and the page calls it with
 * its JSON, so no value is ever minified into the text.
 *
 * The target is ES2020: esbuild never turns the sources into newer syntax than
 * they were written in (no `||=`), and the page's browsers keep what they ran.
 *
 * Written by the drift test in the test runner, so the island's source is the
 * same `Function.prototype.toString` the behaviour tests read:
 *
 *   npm run web:inline        (VF_INLINE_WRITE=1 vitest run packages/web/test/inline-scripts.test.ts)
 */
import { ACTION_BAR_JS } from "../src/lib/action-bar.js";
import { DESK_JS } from "../src/lib/desk.js";
import { transformSync } from "esbuild";
import { placeIsland } from "../src/location/island.js";
import { askAgain } from "../src/lib/fragment-retry.js";
import { AGES_JS, FILTER_JS } from "../src/lib/motorway-filter.js";
import { PAGER_JS } from "../src/lib/card-more.js";
import { TOPICS_JS } from "../src/lib/topic-filter.js";
import { REFRESH_JS } from "../src/lib/card-refresh.js";
import { SID_JS } from "../src/lib/sid.js";
import { EVF_JS } from "../src/lib/charging-filter.js";
import { PLACEHEAD_JS } from "../src/lib/place-scope.js";
import { SUGGEST_JS } from "../src/lib/suggest.js";
import { NEAR_JS } from "../src/lib/near-script.js";
import { RECENT_KINDS_JS } from "../src/lib/recent-kinds.js";
import { LIVE_MAP_JS, LIVE_MAP_LOADER_JS } from "../src/lib/live-map.js";
import type { InlineScriptName } from "../src/lib/inline-scripts.js";

/** Each inline script's readable source, as one function expression. */
export function inlineSources(): Readonly<Record<InlineScriptName, string>> {
  return {
    island: `(${placeIsland.toString()})`,
    retry: `(${askAgain.toString()})`,
    filter: `(function (C) {\n${FILTER_JS}\n})`,
    ages: `(function (C) {\n${AGES_JS}\n})`,
    pager: `(function () {\n${PAGER_JS}\n})`,
    topics: `(${TOPICS_JS})`,
    refresh: `(function () {\n${REFRESH_JS}\n})`,
    sid: `(function () {\n${SID_JS}\n})`,
    evf: `(function () {\n${EVF_JS}\n})`,
    placehead: `(${PLACEHEAD_JS})`,
    actionbar: `(${ACTION_BAR_JS})`,
    desk: `(${DESK_JS})`,
    suggest: `(function () {\n${SUGGEST_JS}\n})`,
    near: `(function (C) {\n${NEAR_JS}\n})`,
    lmap: `(function (C) {\n${LIVE_MAP_JS}\n})`,
    lmapload: `(function (C) {\n${LIVE_MAP_LOADER_JS}\n})`,
    recent: `(function () {\n${RECENT_KINDS_JS}\n})`,
  };
}

/** The binding the source is assigned to while it is minified: a bare expression has no effect and would be dropped whole. */
const HOLD = "__vfInline";

/** One source minified: esbuild's whitespace, syntax and identifier minification; the binding, the trailing `;` and newline off. */
export function minifyInline(source: string): string {
  const out = transformSync(`var ${HOLD}=${source};`, { minify: true, target: "es2020", loader: "js", charset: "utf8", legalComments: "none" }).code.trim();
  const head = `var ${HOLD}=`;
  if (!out.startsWith(head) || !out.endsWith(";")) throw new Error(`inline-min: the minifier printed an unexpected shape: ${out.slice(0, 60)}`);
  return out.slice(head.length, -1);
}

/** The generated file's content: every script, minified, in a stable order. */
export function inlineFile(): string {
  const src = inlineSources();
  const out = Object.fromEntries((Object.keys(src) as InlineScriptName[]).map((k) => [k, minifyInline(src[k])]));
  return `${JSON.stringify(out, null, 2)}\n`;
}
