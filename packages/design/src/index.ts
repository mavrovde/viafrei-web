/**
 * `@viafrei/design` (#922): the site's typed UI building blocks — the tile
 * contract, the class names a stylesheet answers for, and the pure string
 * builders of the tile frame — shared by the digest, the web shell and the
 * status page. A leaf: it depends on no workspace and no package, so every
 * one of them can import it and it can import none of them. The CSS beside it
 * (`tokens.css`, `brand.css`) is shared by path as before. The parsed-DOM test
 * helpers are `@viafrei/design/testing`, never imported here.
 */
export { bySeverity, jumpItem, jumpLinks, sectionHead, statusLamp, statusLine, topItems, SECTION_ROWS, SEVERITY_ORDER, STATUS_LAMPS, TOP_ITEMS_DESK, TOP_ITEMS_MAX, type JumpLink, type Severity, type StatusLamp, type StatusLineInput, type TopItem } from "./page-head.js";
export { nowTitle, NOW_TITLE_MAX, PAGE_HEAD_COPY, PAGE_HEAD_LANGS, type NowKind, type PageHeadCopy, type PageHeadLang } from "./page-head-copy.js";
export { RENDERED_STATES, TILE_STATES, stateClass, type RenderedState, type TileState } from "./tile.js";
export { C, HOOK, type ClassName, type HookName } from "./classes.js";
export { agePill, creditLine, esc, raw, tileFigure, tileHead, tileNote, tileShell, type Attrs, type Html, type NotHtml, type TileShell } from "./html.js";
export {
  MAP_LABEL_MAX,
  MAP_LAT,
  MAP_LON,
  MAP_PLATFORMS,
  MAP_REL,
  appMapLink,
  appMapUrl,
  encodeQuery,
  mapAnchor,
  mapLinks,
  mapPlatformOf,
  mapPlatformOfUserAgent,
  mapPoint,
  osmMapLink,
  osmMapUrl,
  type MapAppWords,
  type MapPlatform,
  type MapTarget,
} from "./map.js";
export { motorwayBadge, type MotorwayBadge } from "./badge.js";
export { CONNECT_SOURCES, CONNECT_SOURCE_ATTR, PLUG_ICON, connectNote, isConnectSource, type ConnectNote, type ConnectNoteHow, type ConnectSource } from "./connect-note.js";
export { endpointChip, splitEndpoint, type EndpointChip, type EndpointChipWords } from "./endpoint-chip.js";
export { ALL_NONE_HOOKS, allNone, type AllNoneHook, type AllNoneOption } from "./all-none.js";
export { dayTimelineHtml, TIMELINE_LEVELS, type TimelineBar, type TimelineInput, type TimelineLevel } from "./timeline.js";
export { foldTile, foldWhole, liftCredits, type LiftedCredits } from "./fold.js";
export { ALWAYS_SHOWN, alwaysShownText, creditNames, FOLD_RULED_LICENCES, FOLD_UNRULED_CREDITS, foldSourcesFromTexts, foldSourcesHtml, foldSummaryHtml, pageLinesHtml, pageSourcesHtml, shortSource, sourcesOfHtml, sourcesOfTexts, textOf, unruledCredit, unruledText, type PageSource } from "./sources-names.js";
export { DESCRIPTION_MAX, DESCRIPTION_MIN, PAGE_DESCRIPTION_COPY, pageDescription, type DescribedKind, type DescribedSubject } from "./page-description.js";
export { LAND_KEYS, landNameOf, type LandKey } from "./land-names.js";
