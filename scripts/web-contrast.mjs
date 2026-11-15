#!/usr/bin/env node
// web-contrast.mjs — recompute the contrast of every text/background pair the
// site's tokens declare, in BOTH themes, from the stylesheet itself (#376).
//
// WHY A GATE AND NOT A SHEET: the design plan computed its ratios once, in a
// spreadsheet nobody re-runs. A token edited in `tokens.css` leaves that sheet
// true about a colour that no longer exists. This reads the real file, so the
// number on the page and the number in the gate are the same number.
//
// WHAT IT READS — `packages/design/tokens.css` (moved out of packages/web by
// #560 §1 so the site and the status console share one palette), which carries three
// kinds of line this script understands:
//
//   --name: #rrggbb;                 a colour token (also #rgb, or var(--other))
//   /* @contrast --text on --ground [body|icon] */
//                                    a pair to judge, in both themes; `body`
//                                    raises the floor from 4.5:1 to 7:1 (AAA);
//                                    `icon` (#987) judges a graphic that carries
//                                    meaning — an icon, a state's shape — at the
//                                    non-text floor of 3:1 (WCAG 1.4.11)
//   /* @unpaired --name: reason */   a colour that carries no text (a border,
//                                    a shadow) and is deliberately in no pair
//
// Light is the first `:root { … }` outside any media query; dark is the
// `:root { … }` inside `@media (prefers-color-scheme: dark)`. Every pair is
// judged in both. The formula is WCAG 2.x relative luminance.
//
// VERDICTS: exit 0 when every pair clears its floor in both themes; exit 1 when
// a pair does not (it is named with its ratio and floor); exit 2 when the file
// cannot be judged — missing, empty, no dark block, no pair declared, a pair
// naming a token that is not a colour or not defined in a theme, a colour
// token that is in no pair and has no @unpaired reason, or an @unpaired reason
// for a token that IS in a pair (a stale exemption). "Could not check" is never
// "passed" (PLAYBOOK §5b).
//
//   node scripts/web-contrast.mjs        (no arguments: it judges its own tree)
//
// `scripts/web-contrast.test.sh` plants a failing token, an empty file and each
// refusal, and proves this script says no.
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The file judged is ALWAYS the tokens.css of the tree this script sits in —
// no path argument (Sonar jssecurity:S8707, PR #402: a path taken from the
// command line is a path traversal however it is checked). The self-test
// judges its fixtures by running a COPY of this script inside a fixture tree.
const HERE = dirname(fileURLToPath(import.meta.url));
const file = join(HERE, "..", "packages", "design", "tokens.css");
if (process.argv.length > 2) {
  console.log("✗ web-contrast: takes no arguments — it judges packages/design/tokens.css of its own tree");
  process.exit(2);
}

const FLOOR_TEXT = 4.5;
const FLOOR_BODY = 7;
const FLOOR_ICON = 3;

function refuse(msg) {
  console.log(`✗ web-contrast: could not check — ${msg}`);
  process.exit(2);
}

if (!existsSync(file)) refuse(`${file} does not exist`);
const css = readFileSync(file, "utf8");
if (css.trim() === "") refuse(`${file} is empty — a sweep over no tokens would pass vacuously`);

// --- 1. the declarations, read out of the comments BEFORE they are stripped --
const pairs = [];
for (const m of css.matchAll(/@contrast\s+(--[\w-]+)\s+on\s+(--[\w-]+)((?:\s+[a-z]+)*)\s*\*\//g)) {
  const flags = (m[3] ?? "").trim().split(/\s+/).filter(Boolean);
  for (const f of flags) if (f !== "body" && f !== "icon") refuse(`@contrast ${m[1]} on ${m[2]}: unknown flag '${f}' (only 'body' and 'icon' are defined)`);
  if (flags.includes("body") && flags.includes("icon")) refuse(`@contrast ${m[1]} on ${m[2]}: 'body' and 'icon' together — a pair is text or a graphic, not both`);
  pairs.push({ text: m[1], ground: m[2], body: flags.includes("body"), icon: flags.includes("icon") });
}
const unpaired = new Map();
for (const m of css.matchAll(/@unpaired\s+(--[\w-]+)\s*:\s*([^*]+?)\s*\*\//g)) {
  if (m[2].trim().length < 8) refuse(`@unpaired ${m[1]}: the reason is too short to be one`);
  unpaired.set(m[1], m[2].trim());
}
if (pairs.length === 0) refuse("no @contrast declaration found — nothing to judge is not a pass");

// --- 2. the two themes --------------------------------------------------------
const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
const darkStart = stripped.search(/@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)\s*\{/);
if (darkStart < 0) refuse("no `@media (prefers-color-scheme: dark)` block — both themes must be declared in this one file");
// brace-match the media block
let depth = 0, i = stripped.indexOf("{", darkStart), end = -1;
for (; i < stripped.length; i += 1) {
  const c = stripped[i];
  if (c === "{") depth += 1;
  else if (c === "}") { depth -= 1; if (depth === 0) { end = i; break; } }
}
if (end < 0) refuse("the dark media block never closes");
const darkBlock = stripped.slice(darkStart, end + 1);
const lightBlock = stripped.slice(0, darkStart) + stripped.slice(end + 1);

function tokensOf(block) {
  const out = new Map();
  for (const m of block.matchAll(/(--[\w-]+)\s*:\s*([^;}]+);/g)) out.set(m[1], m[2].trim());
  return out;
}
const themes = { light: tokensOf(lightBlock), dark: tokensOf(darkBlock) };
if (themes.light.size === 0) refuse("the light theme declares no token");
if (themes.dark.size === 0) refuse("the dark theme declares no token");

// --- 3. colours ----------------------------------------------------------------
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
function resolveColour(theme, name, seen = new Set()) {
  if (seen.has(name)) return { error: `${name} aliases itself` };
  seen.add(name);
  const raw = themes[theme].get(name);
  if (raw === undefined) return { error: `${name} is not defined in the ${theme} theme` };
  const alias = /^var\(\s*(--[\w-]+)\s*\)$/.exec(raw);
  if (alias) return resolveColour(theme, alias[1], seen);
  if (!HEX.test(raw)) return { error: `${name} is '${raw}' in the ${theme} theme — not a hex colour, so no ratio can be computed` };
  return { hex: raw };
}
function isColourToken(theme, name) {
  const r = resolveColour(theme, name);
  return r.hex !== undefined;
}
function rgb(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [0, 2, 4].map((k) => parseInt(h.slice(k, k + 2), 16) / 255);
}
function luminance(hex) {
  const [r, g, b] = rgb(hex).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function ratio(a, b) {
  const la = luminance(a), lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// --- 4. every colour token is judged or excused --------------------------------
const inPairs = new Set(pairs.flatMap((p) => [p.text, p.ground]));
for (const theme of ["light", "dark"]) {
  for (const name of themes[theme].keys()) {
    if (!isColourToken(theme, name)) continue;            // a size, a font, a duration
    if (inPairs.has(name)) continue;
    if (unpaired.has(name)) continue;
    refuse(`${name} is a colour in the ${theme} theme, is in no @contrast pair and has no @unpaired reason — an unjudged colour is the gap this gate exists to close`);
  }
}
for (const [name] of unpaired) {
  if (inPairs.has(name)) refuse(`@unpaired ${name} is stale — the token is in a @contrast pair`);
  if (!isColourToken("light", name) && !isColourToken("dark", name)) refuse(`@unpaired ${name} names no colour token`);
}

// --- 5. the verdict --------------------------------------------------------------
let failed = 0;
const rows = [];
for (const p of pairs) {
  for (const theme of ["light", "dark"]) {
    const t = resolveColour(theme, p.text), g = resolveColour(theme, p.ground);
    if (t.error) refuse(`@contrast ${p.text} on ${p.ground}: ${t.error}`);
    if (g.error) refuse(`@contrast ${p.text} on ${p.ground}: ${g.error}`);
    const r = ratio(t.hex, g.hex);
    const floor = p.body ? FLOOR_BODY : p.icon ? FLOOR_ICON : FLOOR_TEXT;
    const ok = r >= floor;
    if (!ok) failed += 1;
    rows.push(`${ok ? "  ·" : "  ✗"} ${theme.padEnd(5)} ${p.text} on ${p.ground}  ${r.toFixed(2)}:1  (floor ${floor}:1${p.body ? ", body" : p.icon ? ", icon" : ""}) ${t.hex} / ${g.hex}`);
  }
}
for (const r of rows) console.log(r);
const n = pairs.length * 2;
if (failed > 0) {
  console.log(`✗ web-contrast: ${failed} of ${n} pair·theme(s) below the floor in ${file}`);
  process.exit(1);
}
console.log(`✓ web-contrast: ${n} pair·theme(s) (${pairs.length} pairs × 2 themes) at or above the floor, ${unpaired.size} colour(s) excused with a reason — ${file}`);
