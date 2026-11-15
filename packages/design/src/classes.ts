/**
 * The class names of the shared building blocks (#922), typed: what
 * `tileShell`, `agePill`, `creditLine` and their pieces emit, and what a
 * package writes when it draws one of those pieces itself. A class here is a
 * contract with a stylesheet — `test/css-coverage.test.ts` asserts every value
 * of `C` has at least one rule in `packages/web/src/styles/site.css` — so a
 * class renamed in one place is a red test, not an unstyled tile.
 *
 * `HOOK` is the other kind: a class no stylesheet styles on purpose, written
 * so that a reader (a test, the fill script, a screen reader's landmark) can
 * find the element. Each says why; the coverage test asserts each is still
 * unstyled, so a hook that gains a rule moves to `C`.
 */
export const C = {
  tile: "tile",
  tileFact: "tile--fact",
  tileHead: "tile__head",
  tileTitle: "tile__title",
  tileFigure: "tile__figure",
  tileNum: "tile__num",
  num: "num",
  tileUnit: "tile__unit",
  tileNote: "tile__note",
  tileBody: "tile__body",
  tileFoot: "tile__foot",
  tileSub: "tile__sub",
  tilePanels: "tile__panels",
  tileFold: "tile__fold",
  tileFoldSummary: "tile__fold-summary",
  factLine: "fact__line",
  factText: "fact__text",
  age: "age",
  ageDot: "age__dot",
  credit: "credit",
  creditNote: "credit__note",
  shield: "shield",
  shieldRoute: "shield--route",
  /** #1001: the "works only with ViaFrei connected" note under every example answer (`connect-note.ts`). */
  connectNote: "connect-note",
  connectNoteSummary: "connect-note__summary",
  connectNoteIcon: "connect-note__icon",
  connectNoteText: "connect-note__text",
  connectNoteLink: "connect-note__link",
  connectNoteBody: "connect-note__body",
  /** #1003: the one line of assistant names, each linking to its own steps on the connect page. */
  connectNoteClients: "connect-note__clients",
  connectNoteGuide: "connect-note__guide",
  /** #1003: the endpoint chip (`endpoint-chip.ts`), the one way any surface shows the MCP address. */
  endpointChip: "endpoint-chip",
  endpointChipUrl: "endpoint-chip__url",
  endpointChipHost: "endpoint-chip__host",
  endpointChipScheme: "endpoint-chip__scheme",
  endpointChipPath: "endpoint-chip__path",
  endpointChipCopy: "endpoint-chip__copy",
  endpointChipStatus: "endpoint-chip__status",
  /** #1158: "Alle · Keine" (`all-none.ts`), the one way any surface selects every option of a choice, or none. */
  allNone: "all-none",
  allNoneOpt: "all-none__opt",
  allNoneSep: "all-none__sep",
  /** #1181 feature 2: today's timeline (`timeline.ts`), one strip of hours with a `:target` panel per reported hour. */
  timeline: "timeline",
  timelineHead: "timeline__head",
  timelineBars: "timeline__bars",
  timelineBar: "timeline__bar",
  timelineBarL0: "timeline__bar--l0",
  timelineBarL1: "timeline__bar--l1",
  timelineBarL2: "timeline__bar--l2",
  timelineBarL3: "timeline__bar--l3",
  timelineBarGap: "timeline__bar--gap",
  timelineBarLater: "timeline__bar--later",
  timelinePanel: "timeline__panel",
  timelineQuiet: "timeline__quiet",
} as const;
export type ClassName = (typeof C)[keyof typeof C];

/** Unstyled on purpose, each with its reason (`css-coverage.test.ts` holds them unstyled). */
export const HOOK = {
  /** The state's WORD inside the pill: styled through `.age` and the state class; the fill script rewrites its text (`data-vf-failtext`). */
  ageState: "age__state",
  /** The age after the word: it keeps the pill's full colour on purpose (site.css, #381: an opacity blended below 4.5:1). */
  ageTime: "age__time",
  /** The link to a licence's text inside a credit line: styled as the line's own link. */
  creditLicence: "credit__licence",
  /** The fuel tile's credit element, which carries the MTS-K note (#377 R6): found by tests, styled as any credit. */
  creditFuel: "credit--fuel",
  /** The share-alike adapter's licence line (#377 C3): styled as the tile's foot text. */
  tileLicence: "tile__licence",
} as const;
export type HookName = (typeof HOOK)[keyof typeof HOOK];
