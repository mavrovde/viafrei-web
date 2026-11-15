# ViaFrei 1.6 — the component contract

Phase 0 of the site design flow (#376 PR-02), within the owner's decisions
D1–D6 (#377) and the budgets of #375 A8. One entry per component: what it is
for, its states, the **exact class names** (`src/styles/site.css` is the only
place they are styled), and what the no-JS version does — which, for every
component but one, *is* the version. Tokens: `packages/design/tokens.css` (shared with the status console since #560). Copy:
`src/i18n/{de,en}.json`. Legal strings: the register, never here.

The previews below are the built home, rendered by `astro build` and
screenshotted by `scripts/preview-shots.ts` (390 px and 1280 px, light and
dark, DE and EN). Every figure on them is a labelled sample
(«Beispiel · Momentaufnahme»); the live tiles arrive in Phase 2.

| | light | dark |
|---|---|---|
| DE, 1280 px | [home-de-1280-light.png](preview/home-de-1280-light.png) | [home-de-1280-dark.png](preview/home-de-1280-dark.png) |
| DE, 390 px | [home-de-390-light.png](preview/home-de-390-light.png) | [home-de-390-dark.png](preview/home-de-390-dark.png) |
| EN, 1280 px | [home-en-1280-light.png](preview/home-en-1280-light.png) | [home-en-1280-dark.png](preview/home-en-1280-dark.png) |
| EN, 390 px | [home-en-390-light.png](preview/home-en-390-light.png) | [home-en-390-dark.png](preview/home-en-390-dark.png) |

## The system in five lines

1. **Answer first, proof second, setup third.** The question is the headline;
   the Wegweiser answers it; four live tiles prove the data is real; the
   endpoint comes after the visitor believes it.
2. **One accent.** The Autobahn sign blue (`--accent`, `--sign-bg`) carries
   every action and every link; the sign yellow (`--sign-hi`) appears on the
   Wegweiser alone. Everything else is ink, grey and white.
3. **System type only** (D2): `system-ui` at 17 px body, a fluid scale from
   13 px to 51 px, tabular figures, no `text-transform`, `hyphens: auto` with
   the page's `lang` and `hyphens: manual` on every legal line.
4. **Colour is never the only signal.** Each tile state has a word and a shape
   on its age pill; each report kind has a glyph before its word; focus is a
   3 px ring; `forced-colors` and print are styled.
5. **Calm by spacing, not by decoration.** A fluid 16–40 px gutter, a 1120 px
   measure, 14 px card gaps, radius 14, one soft shadow, one 2.4 s pulse and a
   150 ms lift — both off under `prefers-reduced-motion`.

## Components

### Button

- **Purpose:** the one filled action per view (“Verbinden”), and the quiet
  secondary actions beside it.
- **Classes:** `.btn` (outlined, accent), `.btn--primary` (filled accent,
  `--on-accent` text), `.btn--on-sign` (white on the blue band), `.btn--sm`
  (36 px, header and cards).
- **States:** `:hover` lifts 1 px and tints; `:active` settles; `:focus-visible`
  shows the 3 px ring; `:disabled` / `[aria-disabled="true"]` dims to 55 % and
  loses the lift. Minimum height 44 px (`--target`). Labels never wrap or
  hyphenate.
- **No JS:** every button on the site is an `<a>` to a page or an anchor; the
  only `<button>` elements are the consent bar's.

### Chip

- **Purpose:** a trust claim under the hero (“Live aus offenen Daten”), four of
  them, never more.
- **Classes:** `<ul class="chips">` → `<li class="chip">` with a `.chip__dot`
  (accent, `aria-hidden`).
- **States:** none — a chip is a statement, not a control.
- **No JS:** static.

### Sign (the Wegweiser)

- **Purpose:** the hero's proof: a motorway-sign panel carrying ONE shortened,
  real tool answer. The only place on the page that uses `--sign-hi`.
- **Classes:** `<figure class="sign">` → `.sign__panel` (sign blue, white inset
  border via `box-shadow`, a white arrow head top-right) containing `.sign__row`
  (`.shield` + `.sign__q`), `.sign__a` with `<mark class="sign__hi">` on the one
  word, `.sign__label` (“Beispielantwort, gekürzt”); `<figcaption
  class="sign__meta">` under the panel names the tool.
- **States:** none. In Phase 0 the answer is a sample; Phase 3 renders a real
  answer at build and drops the sample label.
- **No JS:** static.

#### Route shield

`.shield` — the Autobahn number: white figures on sign blue with a 2 px white
inset border, tabular, `aria-label="A 8"` for the spoken form. Used in the
sign and at the head of every report row.

### Tile — THE TILE CONTRACT

- **Purpose:** a live instrument: one figure, the moment it was seen, its
  state, and the credit line(s) that permit it. The unit of Phase 2's digest
  fragments (#378) and of the later My board.
- **Element:** `<article class="tile is-<state>" aria-labelledby="tile-<id>-title">`
  with:
  - `.tile__head` → `h3.tile__title#tile-<id>-title` and the **age pill**
    `p.age` → `.age__dot` (aria-hidden), `.age__state` (the word),
    `.age__time` (“· vor 4 min”, omitted for `empty` and `error`);
  - `.tile__figure` → `.tile__num.num` (the figure, or “—”) and `.tile__unit`;
  - `.tile__note` — the state's sentence for `stale`, `empty`, `error`;
  - an optional body (a `<dl class="kv">`, a paragraph) via the slot;
  - `.tile__foot` → one `.credit` per source, then `.tile__sample` when the
    figures are samples.
- **The four rendered states** (class on the article; the word from the copy
  deck `tile.<state>`; the shape on the dot):

  | class | word (DE / EN) | dot | figure | note |
  |---|---|---|---|---|
  | `is-ok` | aktuell / current | pulsing circle, `--ok` on `--ok-bg` | shown | none |
  | `is-stale` | nicht mehr frisch / no longer fresh | square, `--stale` on `--stale-bg` | **kept**, muted | `tile.staleNote` |
  | `is-empty` | keine Daten / no data | dash, `--empty` on `--empty-bg` | “—” | `tile.emptyNote` — an empty answer is an answer, not a fault |
  | `is-error` | gerade nicht lesbar / not readable right now | triangle, `--error` on `--error-bg`, tile border tinted | “—” | `tile.errorNote` — never an old figure as a new one |

  A fifth state, **`loading`**, is defined with the four in `@viafrei/design`
  (`packages/design/src/tile.ts`, #922, shared with the digest) and printed
  only by the shell's render-then-fill placeholder (`lib/fill.ts`, #564);
  `tile-contract.test.ts` fails on any other `is-loading` in `src/`. The tile
  frame itself — head, pill, figure, note, credit foot — is one builder,
  `tileShell`, in the same package, for the digest's tiles and the shell's.
- **Rules:** `ok` → `stale` is decided by age (`freshness()`: three cadences);
  `empty` and `error` are states of the source, decided by the digest, never
  by age. The figure is never a round cap and never rounded (`figure()` prints
  “61.804”, not “60.000+”). No `data-` attribute carries a figure; no JSON is
  embedded. **A tile with no credit line does not render** — `Tile.astro`
  throws, the build fails (D4 rule 3).
- **No JS:** a tile is server-rendered HTML; the 60 s meta refresh on the home
  is what updates it in 1.6 (D3).

### Age pill

Part of the tile and reused on the fuel card: `p.age` with the three spans
above. The word is always present; the time is `tile.ago` / `tile.justNow` /
`tile.never`. Colours only via the tile's state class, so a pill cannot show a
state its tile does not have.

### Report row

- **Purpose:** one road report in the “right now” block — the top four, then
  the rest inside a disclosure (all ten kept, never a cap).
- **Classes:** `<li class="report report--closure|--jam|--roadworks">` →
  `.shield`, a `<div>` with `p.report__kind` (the word, with a glyph before it:
  ■ closure, ▲ jam, ● roadworks) and `p.report__where`, then `p.report__time`
  (“seit 42 min”).
- **States:** the kind is the state; closure is `--error`, jam `--stale`,
  roadworks ink with an amber glyph. Below 480 px the time drops under the text.
- **No JS:** static.

### Disclosure

- **Purpose:** progressive detail without a script: the remaining reports, the
  per-client connect steps.
- **Classes:** `<details class="disclosure">` → `summary.disclosure__summary`
  (44 px, chevron drawn in CSS, rotates when open) and `.disclosure__body`.
  `.disclosure--plain` is the borderless variant inside a card.
- **States:** `[open]`. The connect block uses `name="client"` so opening one
  closes the others — the browser's own exclusive accordion.
- **No JS:** `<details>` is the no-JS component.

### Credit line

- **Purpose:** the sentence that permits the figure beside it (D4).
- **Classes:** `<p class="credit" lang="de"><a href rel="license noopener">…</a></p>`;
  in a page-level list, `<ul class="credits">` → `<li class="credit" lang="de">`.
  `.credit--note` is the MTS-K consumer note, text only, beside the Tankerkönig
  line.
- **Source:** `Credit.astro` reads `src/generated/register.json`, a build-time
  copy of `LICENCE_CATALOGUE` that `register-copy.test.ts` asserts equal to the
  register; an id with no approved line throws at build.
- **States:** none. `hyphens: manual`, 13 px, muted; never translated,
  abbreviated or ellipsised.
- **No JS:** static.

### Consent bar — the one island

- **Purpose:** § 25 TDDDG consent for Google Analytics (#54; GA rules 1, 2, 5).
  The only `<script>` on the site, present only when `GOOGLE_TAG` is set.
- **Component:** `src/components/Consent.svelte`, mounted by `Base.astro` with
  `client:load`. Classes: `.consent[role="dialog"]` → `.wrap.consent__row` →
  `.consent__title`, `.consent__body` (with the privacy link), and
  `.consent__actions` holding two **equal-width** `.btn` (decline first, accept
  focused on open — owner 2026-10-19, agree is the default action, so Enter
  agrees; focus alone fetches nothing — Escape = decline).
- **States:** hidden until the decision is unknown; `localStorage`
  `viafrei.consent.analytics` (the digest's key, 12 months) remembers either
  answer. Accept loads gtag.js and sends `consent_accept` through
  `src/analytics/events.ts`; decline sends nothing, ever.
- **No JS:** the bar does not exist — the page is complete and legal without
  it, and `script-src 'none'` is the policy (S2). Below 720 px it replaces the
  bottom action bar (`body:has(.consent) .actionbar { display: none }`), never
  covers it.

### Language list

- **Purpose:** switch language without a script, each language in its own
  script and `lang`, the current one marked.
- **Classes:** `<nav aria-label>` → `<ul class="langs">` → `<a hreflang lang
  aria-current="page">`. In the header and the footer.
- **States:** `[aria-current="page"]` filled with `--surface-2`.
- **Rule (D6):** only `LIVE_LANGS` (de, en) are rendered. The five hidden
  languages of #235 appear in no list, no sitemap and no `hreflang` until a
  native reviewer signs; `pages.test.ts` keeps the two sets disjoint.
- **No JS:** plain links to the twin path from `pages.ts`.

### Domain card (Phase 2, #379 owner instruction 2026-10-03)

- **Purpose:** the section a first-time visitor decides on — "Was ViaFrei
  weiß": four cards, one per domain (motorways, rail and public transport,
  parking, charging), each a promise in one line, the domain's LIVE tile as
  it arrived from the digest, three real questions with the tool that answers
  them, one honest limit, the Verbinden action.
- **Classes:** `<article class="domain domain--<key>" aria-labelledby>` →
  `.domain__head` (`h3.domain__title`, `p.domain__promise`), `.domain__tile`
  (holds the embedded `<section class="tile …">`), a `.fold` holding
  `p.domain__label` + `ul.prompts.prompts--stack` (`li.prompt` as above) and
  `p.domain__limit` (`<strong>` label + sentence), then `p.domain__cta` with
  the filled small button.
- **States:** none of its own; the tile inside carries the four states.
- **No JS:** static; the fold is a `<details>`.

### Fold

- **Purpose:** the mobile height budget (#379: under 6 000 px at 390 px;
  6 200 px since #423 put the fuel tile back, because its sample, qualifier
  and MTS-K note are data-steward conditions that may not fold)
  without hiding a legal line: a `<details class="fold">` is CLOSED on a phone
  and OPEN from 601 px up with one markup and no script — the stylesheet
  reveals `::details-content` and hides the summary. Used for the tool
  catalogue, the duplicate credit list (D4 rule 9 — a duplicate may fold; a
  tile's or card's credit lines fold only WITH its data, under FS-2026-11-06;
  a credit never folds away from data in view), each domain card's questions,
  the client steps, the audience cards, and (#1176/#1177) the place cards and
  the home's tiles below the first: data and full credit lines in one fold, the
  summary naming every publisher ("Quellen: …", FS3, `.fold__sources`), a line
  beside data kept in view outside the fold (FS4) or of a class the ruling did
  not read (FS8) lifted out, and the fuel tile and card never folded (FS5).
- **Classes:** `details.fold` → `summary.fold__summary.btn.btn--sm` ("+ …" /
  "− …" drawn in CSS), then the content. `.fold--on-sign` on the blue band.
- **No JS:** `<details>`; a browser without `::details-content` shows the fold
  at every width, which is a longer click and never a hidden line.

### The live tile (Phase 2)

From PR-03 the tiles on the home are the digest's fragments
(`packages/digest/src/presentation/tiles.ts`, `GET /internal/tiles/<id>`),
rendered in exactly the markup of the tile contract above and embedded
server-side by `src/lib/tiles.ts` with a 2 s deadline per tile. The shell's
own `is-error` tile (no figure, no credit line) replaces any tile the digest
did not answer. `transit` is defined and not live, so it is not embedded.

### Also on the page (not components of their own)

`.site-head` (sticky, 64 px, brand mark + four anchors + filled CTA + language
list; below 720 px the anchors hide and `.actionbar` — fixed bottom, one
button — appears), `.band` (the connect block's sign-blue ground),
`.endpoint` (`<pre><code>` with `user-select: all`), `.draft` (the yellow
“Entwurf” label until #142 verifies a client), `.prompt` (a question card with
the tool that answers it), `.toolgroup`, `.card`, `.kv` (a definition list
for two or three figures), `.site-foot`.

## The ten credit-line rules (data-steward ruling on D4, #377, 2026-10-02)

Cited by number from Phase 2 (#378) and Phase 5 (#381). Verbatim from the
ruling, numbered as it numbers them:

1. **Verbatim, German, whole.** The line is copied from `LICENCE_CATALOGUE` at
   render time — never retyped into a template, never translated, abbreviated,
   truncated or ellipsised, and never placed in an i18n catalogue. It keeps
   `lang="de"`.
2. **Link where the licence wants one.** Where the register supplies a URL the
   line renders as an anchor (the existing `attributionLine()` shape). Per-tile
   lines must use the linked form, Tankerkönig most of all.
3. **No tile renders without its line.** Not a style rule but a render-time
   invariant, asserted per tile in a test: if `presentableSource` /
   `fuelAttribution` returns nothing, the tile does not render. The line stays
   in the default view — not inside `<details>`, not a tooltip, not behind a
   tab.
4. **One line per SOURCE, not a cap of one per tile.** A tile fed by several
   sources (charging: CC BY 4.0 master plus CC0 status; the road picture:
   Autobahn plus BASt plus VIZ.NRW) carries each contributing source's line on
   that tile. “Per tile” must never become “at most one”.
5. **A tile may only name what its own lines cover.** A figure or a name whose
   source is not on that tile is a licence defect, not an untidy string (the
   `mayNameJunction` rule generalises to every tile).
6. **MTS-K stays attached to fuel.** Note beside the line on the fuel tile,
   German only, verbatim, plus an unrestricted Nutzerkreis and no cross-source
   fuel figure.
7. **DWD: one form or the other, chosen by what the tile does to the text** —
   Quellenvermerk for unaltered warnings, the “zusammengefasst” form for a
   summary, and for a changed amtliche Wetterwarnung the beigegebener
   Quellvermerk is deleted.
8. **OSM tiles keep the § 4.6 offer reachable** from the page the tile is on.
9. **A page-level sources list may remain, but only as a duplicate** — it may
   not be the only carrier of any line, and it may not state one licence for
   the whole page.
10. **Register first, code second.** D4 moves no string;
    `attribution-agreement.test.ts` keeps `LICENCE_CATALOGUE` and `ATTRIBUTION`
    in step, and any string a tile needs that the register has not got is a
    blocker, not a placeholder.

Where Phase 0 already meets them: rules 1, 2 and 4 in `Credit.astro` and
`Tile.astro` (one linked `.credit` per source id); rule 3 as a build-time
throw; rule 6 on the fuel card (`.credit--note` beside the Tankerkönig line);
rule 9 in `Sources.astro` (the list is a duplicate of the tiles' lines and
claims no page licence); rule 10 through `register-copy.test.ts`. Rules 5, 7
and 8 bind tiles that do not exist until Phase 2.

## What a page must not carry (from #375 “Rules for every phase”)

No third party before consent; no font file; no image except the favicon and
the OG image; no version or commit; no machine-readable surface (JSON, CSV,
feed, JSON-LD, `data-` figures); legal strings verbatim and from the register;
raw HTML ≤ 100 KB, transfer < 60 KB gzip, ≤ 2 requests. The Phase-0 home
measures 25 KB raw / 5.9 KB gzip for the document and 4.7 KB gzip for the
stylesheet (`e2e/csp.e2e.ts` asserts the budget on every run).
