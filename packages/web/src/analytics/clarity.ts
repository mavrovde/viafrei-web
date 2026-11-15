/**
 * Microsoft Clarity on viafrei.de, behind the one consent (#717).
 *
 * The official package `@microsoft/clarity` (1.0.2, owner 2026-10-26: "So use
 * it") does three things we rely on and nothing else: `init(id)` defines the
 * `window.clarity` queue and inserts `<script async id="clarity-script"
 * src="https://www.clarity.ms/tag/<id>?ref=npm">` before the first script of
 * the page; every other method calls `window.clarity(...)` and THROWS when
 * `init` has not run. So the order is the contract, and it lives here, pure
 * over an injected API, so the unit test needs no browser:
 *
 *   • `startClarity` — only ever called from the consent island's `load()`,
 *     which runs after the accept click or on a page whose remembered decision
 *     is "granted": `init`, then `consentV2` with analytics granted and ads
 *     DENIED (the visitor agreed to measurement, not to advertising);
 *   • `withdrawClarity` — `consent(false)` (erase and stop), and only when
 *     `init` ran on this page (`window.clarity` exists); otherwise nothing is
 *     called and nothing is loaded (steward ruling C-6);
 *   • `startClarity` also refuses a page whose address carries free text (C-5)
 *     and stops the tag before it reads a click in a marked region (C-4);
 *   • never `identify`, never `setTag`/`event` — nothing about the visitor is
 *     handed to Clarity beyond what its tag records itself.
 *
 * The id is public by design (it is part of the tag URL), read from
 * `CLARITY_PROJECT_ID` by `clarityConfigOf` at boot, which refuses a value
 * that is not a Clarity id instead of serving pages that report to nothing.
 */

/** A Clarity project id: lower-case letters and digits, 8 to 12 of them (ten today). Anything else is not one. */
export const CLARITY_ID = /^[a-z0-9]{8,12}$/;

/** The project id when it has a Clarity id's shape, else undefined (the browser side's guard: it loads nothing for a bad id). */
export function clarityIdOf(raw: string | undefined): string | undefined {
  const v = (raw ?? "").trim();
  return CLARITY_ID.test(v) ? v : undefined;
}

/**
 * The shell's Clarity configuration, read once at boot (owner 2026-10-26:
 * "configurable and properly set up on prod"):
 *
 *   • `CLARITY_PROJECT_ID` — empty or unset: off. Set but not a Clarity id:
 *     REFUSED with an error that names the variable and never its value.
 *   • `CLARITY_ENABLED` — the independent off switch: `false`/`0`/`no` turns
 *     Clarity off and keeps the id; `true`/`1`/`yes` or unset leaves it to the
 *     id; anything else is refused, because a typo of "false" must not mean on.
 *
 * Returns the id to use, or undefined for off.
 */
export function clarityConfigOf(env: Readonly<Record<string, string | undefined>>): string | undefined {
  const raw = (env["CLARITY_PROJECT_ID"] ?? "").trim();
  const sw = (env["CLARITY_ENABLED"] ?? "").trim().toLowerCase();
  let enabled: boolean;
  if (sw === "" || sw === "true" || sw === "1" || sw === "yes") enabled = true;
  else if (sw === "false" || sw === "0" || sw === "no") enabled = false;
  else throw new Error("CLARITY_ENABLED must be true/1/yes or false/0/no (or unset, which means on when an id is set); the value given is not one of them");
  if (raw === "") return undefined;
  if (!CLARITY_ID.test(raw)) throw new Error(`CLARITY_PROJECT_ID is set but is not a Clarity project id (lower-case letters and digits, 8 to 12 characters; ${String(raw.length)} characters given, value not shown). Unset it to switch Clarity off.`);
  return enabled ? raw : undefined;
}

/** The consent signal on accept: measurement yes, advertising no. */
export const CLARITY_GRANTED = { ad_Storage: "denied", analytics_Storage: "granted" } as const;
type ConsentOptions = { ad_Storage: "granted" | "denied"; analytics_Storage: "granted" | "denied" };

/**
 * The three methods of `@microsoft/clarity` this site uses — and, by construction, the only three it can call
 * (steward ruling #717 C-6: `consent` joins for the withdrawal; nothing else of the package does).
 */
export type ClarityApi = {
  init: (projectId: string) => void;
  consentV2: (options?: ConsentOptions) => void;
  consent: (consent?: boolean) => void;
};

/**
 * C-5 (steward ruling #717): the two free-text address parameters — `find` (the motorway page's search) and `q`
 * (the motorway index's search) carry whatever a person typed and may not reach Microsoft. A page whose address
 * carries either with a value starts no Clarity at all; both searches are full page loads, so the next page is
 * judged afresh. An address that cannot be read is treated as carrying one.
 */
export const FREE_TEXT_PARAMS = ["find", "q"] as const;

export function carriesFreeText(href: string): boolean {
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return true;
  }
  return FREE_TEXT_PARAMS.some((k) => u.searchParams.getAll(k).some((v) => v !== ""));
}

/**
 * C-4 (steward ruling #717): the ONE marker of a region whose links follow the visitor's place or position or
 * carry an MTS-K value — the home's place bar, place sheet and place cards, the motorway page's place bar and its
 * around block, and every motorway fuel fragment. A class token, because the digest's fragments carry no
 * `data-*` attribute by rule, and a constant: it says that a region is private, never what is in it (C-8).
 */
export const CLARITY_STOP_CLASS = "vf-noclarity";
export const CLARITY_STOP_SELECTOR = `.${CLARITY_STOP_CLASS}`;

/** Is the event's target inside a marked region? Anything that is not an element is not. */
export function insideStopRegion(target: unknown): boolean {
  if (target === null || typeof target !== "object") return false;
  const closest = (target as { closest?: unknown }).closest;
  return typeof closest === "function" && (closest as (s: string) => unknown).call(target, CLARITY_STOP_SELECTOR) !== null;
}

/** What `startClarity` needs of the page: its address, a place for the capture listeners, and the `clarity` global. */
export type ClarityPage = {
  readonly location: { readonly href: string };
  addEventListener: (type: "click" | "contextmenu", listener: (ev: { target: unknown }) => void, options: { capture: boolean }) => void;
  clarity?: unknown;
};

/**
 * C-4: the guard. The tag records a click — with the clicked link's `href`, whatever the masking — from a CAPTURE
 * listener on `document` (clarity-js `interaction/click.ts`). A capture listener on `window` runs before it on the
 * same event. For a click or a context menu inside a marked region it calls `clarity("stop")`: once the tag runs,
 * that is clarity-js's `stop()`, which removes every listener the tag bound (`core/event.ts` `reset()`), so the
 * document listener is gone before its turn and never reads the event (a listener removed during dispatch is not
 * invoked). Clarity then stays stopped for the rest of the page view. Called on every such click: before the tag
 * has loaded the call only queues, and a later marked click stops the running tag.
 */
export function clarityClickGuard(page: { clarity?: unknown }): (ev: { target: unknown }) => void {
  return (ev) => {
    if (!insideStopRegion(ev.target)) return;
    const c = page.clarity;
    if (typeof c === "function") (c as (m: string) => void)("stop");
  };
}

/** Did `init` run on this page? It is what defines `window.clarity`. */
export function clarityStarted(win: object): boolean {
  return typeof (win as { clarity?: unknown }).clarity === "function";
}

/**
 * After consent only: refuse a page whose address carries free text (C-5), install the click guard (C-4), load
 * the tag for this id and send the consent signal. A malformed id loads nothing either.
 */
export function startClarity(id: string | undefined, api: ClarityApi, page: ClarityPage): boolean {
  const ok = clarityIdOf(id);
  if (ok === undefined || carriesFreeText(page.location.href)) return false;
  const guard = clarityClickGuard(page);
  page.addEventListener("click", guard, { capture: true });
  page.addEventListener("contextmenu", guard, { capture: true });
  api.init(ok);
  api.consentV2({ ...CLARITY_GRANTED });
  return true;
}

/**
 * On withdrawal (C-6): `consent(false)`, which erases Clarity's cookies and stops it until a new consent — never
 * the ConsentV2 "denied" signal, on which Clarity restarts tracking in no-consent mode. Only when the tag was
 * started on this page; returns whether it was sent.
 */
export function withdrawClarity(win: object, api: ClarityApi): boolean {
  if (!clarityStarted(win)) return false;
  api.consent(false);
  return true;
}
