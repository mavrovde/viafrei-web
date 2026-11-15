/// <reference types="astro/client" />

// What the middleware hands every page (#375 A6). Declared here because
// `Astro.locals` is typed through this global and nowhere else.
declare namespace App {
  interface Locals {
    /** The per-request CSP nonce — the only way a `<script>` may run on this site. */
    nonce: string;
    /** The GA4 measurement id from the environment, or undefined: with none set, no script at all. */
    googleTag: string | undefined;
    /** #717: the Clarity project id when Clarity is configured and switched on, else undefined. */
    clarityId: string | undefined;
    /** #717: set by `Base.astro` when this page runs Clarity (an island page, never a motorway page); the CSP names Clarity's origins only then. */
    clarityPage?: boolean;
    /** Set by a component that renders our own inline script (the home's board, #404): the CSP then allows nonce'd scripts without a tag. */
    hasScript?: boolean;
    /** Set by a page that carries a GET form to this origin (the motorway filter, #716): the CSP then says `form-action 'self'`. */
    hasForm?: boolean;
    /** The road-sign kinds already drawn on this page: a later sign of the same kind is a `<use>` of the first (`RoadSign.astro`). */
    signsDrawn?: Set<string>;
    /** #989: the flag sprite is on this page already — the first language list draws it, every flag is a `<use>` of it (`LanguageList.astro`). */
    flagsDrawn?: boolean;
    /** #944: the User-Agent reduced to android | ios | other, first thing in the middleware; the only form of it any page reads. */
    mapPlatform: "other" | "android" | "ios"; // @viafrei/design's MapPlatform (an ambient file imports nothing)
    /** #1166: where this request's two-second digest budget ends (epoch ms, `lib/page-budget.ts`), opened first thing in the middleware (a page rendered without it, as in a test, reads under its own deadlines alone). */
    budgetEndsAt?: number;
    /** #1205 review B1: set by a render that read the visitor — the request's address, the GeoIP file, a near-IP or around block, the fuel board's withholding — so it is never held for a crawler (`lib/page-held.ts`). */
    perVisitor?: boolean;
  }
}
