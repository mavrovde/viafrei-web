<script lang="ts">
  /**
   * The consent bar — the ONE island of 1.6 (#375 A6; GA rules 1, 2, 5; #54).
   *
   * Rendered only when `GOOGLE_TAG` is set (Base.astro decides), hydrated
   * with `client:load`, and the only code on the site that ever loads
   * gtag.js. Consent Mode v2, basic: every storage denied by default, nothing
   * fetched from Google until the accept control is clicked, the decision
   * kept in localStorage for twelve months under the digest's own key
   * (`viafrei.consent.analytics`, so a visitor who answered on the old page
   * is not asked again), decline remembered and never followed by a request.
   * Both buttons share one style: § 25 TDDDG consent is only consent when
   * refusing is as easy and as visible as agreeing. The accept control takes
   * the focus when the bar opens (owner 2026-10-19: agree is the default
   * action), so Enter agrees — still an act of the visitor, never assumed:
   * nothing is fetched or counted until a button is pressed, and Escape or
   * the equally visible decline control refuses in one step. The dialog is
   * described by its body text (aria-describedby), so a screen reader says the
   * purpose before the focused action (data-steward ruling 2026-10-19).
   *
   * The event name goes through `src/analytics/events.ts` — never a literal
   * in a gtag call — so the closed event list has one home.
   *
   * #717: the same one consent also starts Microsoft Clarity when a project id
   * is configured (`clarity`, from `CLARITY_PROJECT_ID`): `load()` — the accept
   * click, or a page whose remembered decision is "granted" — and nothing
   * else calls `startClarity`, which runs `Clarity.init` and then the granted
   * consent signal. Before that, and after a decline, nothing of Clarity's is
   * fetched or defined. A decline also expires Clarity's first-party cookies
   * an earlier consent left. `identify`, `setTag` and `event` are never called.
   *
   * #1185 (data-steward ruling 2026-11-04): the decision is read and written through `analytics/consent-store.ts` — a
   * refusal stands 180 days, a consent 365 (R1), stored as `decision|YYYY-MM-DD` (R2). The footer's "Privacy settings"
   * link (`data-vf-consent-settings`) opens the same dialog with the current state in one sentence and both buttons
   * (R3); a decline there also withdraws a consent given on this page — the consent signal is set back to denied, no
   * further event is sent, Clarity is told `consent(false)` and the `_ga*`/`_clck`/`_clsk` cookies expire (R4). The
   * markup is `ConsentPanel.svelte`, shared with the unmeasured pages' `ConsentSettings.svelte` (R5).
   */
  import { onMount } from "svelte";
  import Clarity from "@microsoft/clarity";
  import ConsentPanel from "./ConsentPanel.svelte";
  import { CLARITY_GRANTED, clarityStarted, startClarity, withdrawClarity } from "../analytics/clarity.js";
  import { formatDay, isConsentSheet, readStored, standing, stateOf, writeStored, type Decision } from "../analytics/consent-store.js";
  import { event, isLocationSource, type TrackedEvent } from "../analytics/events.js";
  import { expireClarityCookies, expireGaCookies } from "../analytics/ga-cookies.js";
  import { CODE_COPY_EVENT, cardMoreEvent, cardRefreshEvent, cleanLocation, clickEvent, copyEvent, devCopyEvent, factsOf, isAutomaticReload, isLang, pageView } from "../analytics/listener.js";
  import { ENDPOINT_COPY_EVENT } from "../lib/endpoint-copy.js";

  const GTAG_ORIGIN = "https://www.googletagmanager.com";

  let {
    tag,
    clarity = undefined,
    title,
    body,
    accept,
    decline,
    more,
    privacyHref,
    states,
  }: {
    tag: string;
    /** The Clarity project id (#717), or undefined: no Clarity on this page. */
    clarity?: string | undefined;
    title: string;
    body: string;
    accept: string;
    decline: string;
    more: string;
    privacyHref: string;
    /** R3: the state sentences, `{date}` left for the island to fill. */
    states: { none: string; denied: string; granted: string };
  } = $props();

  let open = $state(false);
  let stateText: string | undefined = $state(undefined);
  let acceptButton: HTMLButtonElement | undefined = $state();
  let listening = false;

  type GtagWindow = Window & { dataLayer?: unknown[]; vfAnalytics?: boolean; vfGtagLoaded?: boolean };

  function storage(): Storage | undefined {
    try {
      return window.localStorage;
    } catch {
      return undefined;
    }
  }

  /**
   * gtag.js processes `arguments` OBJECTS on the dataLayer and silently
   * ignores arrays (#378 review): a rest-parameter array here would load the
   * tag and record nothing. So this is Google's own snippet, `arguments` and
   * all — the same shape the digest and the status page push.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the parameters type the call sites; `arguments` is what is pushed
  function gtag(..._args: unknown[]): void {
    const w = window as GtagWindow;
    w.dataLayer = w.dataLayer ?? [];
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer.push(arguments);
  }

  /** The one way an event leaves the shell: a name off the list, typed parameters, nothing else. */
  function send(e: TrackedEvent | null): void {
    if (e === null || !(window as GtagWindow).vfAnalytics) return;
    gtag("event", e.name, e.params);
  }

  /**
   * The ONE listener (GA rules 4, 7): delegated on `document`, installed once,
   * on the shell and never on a tile — a tile's only links are its credit
   * lines, which `clickEvent` ignores by construction.
   */
  function listen(): void {
    if (listening) return;
    listening = true;
    const lang = isLang(document.documentElement.lang) ? document.documentElement.lang : "de";
    document.addEventListener("click", (ev) => {
      const target = ev.target instanceof Element ? ev.target.closest("a") : null;
      send(clickEvent(factsOf(target), lang));
    });
    // #1003: a copy of the endpoint chip, announced by the copy script with the chip's surface word
    document.addEventListener(ENDPOINT_COPY_EVENT, (ev) => send(copyEvent((ev as CustomEvent<{ surface?: unknown }>).detail?.surface, lang)));
    // #992: a copy on the developers page — a config or a curl, and the tab — never what was copied
    document.addEventListener(CODE_COPY_EVENT, (ev) => send(devCopyEvent((ev as CustomEvent<unknown>).detail, lang)));
    // #938: a card's fold loaded its next entries — the card's kind and the step, never what it lists
    document.addEventListener("vf:card-more", (ev) => send(cardMoreEvent((ev as CustomEvent<unknown>).detail, lang)));
    // #939: a card refreshed in place — its kind, manual or auto (sampled by the script), changed or unchanged
    document.addEventListener("vf:card-refresh", (ev) => send(cardRefreshEvent((ev as CustomEvent<unknown>).detail, lang)));
    // #564: which rung of the location ladder the home settled on — once per
    // page, the source word only, never the place. The location island marks
    // the root and fires `vf:location`; whichever happened first is read.
    let located = false;
    const locate = (source: unknown): void => {
      // the home's automatic reload is no visit: no page-load event (2.4.3)
      if (located || !isLocationSource(source) || isAutomaticReload(window.location.href)) return;
      located = true;
      send(event("location_source", { lang, method: source }));
    };
    const marked = document.documentElement.getAttribute("data-vf-location");
    if (marked !== null) locate(marked);
    else document.addEventListener("vf:location", (ev) => locate((ev as CustomEvent<{ source?: unknown }>).detail?.source), { once: true });
  }

  function load(): void {
    const w = window as GtagWindow;
    if (w.vfAnalytics) return;
    w.vfAnalytics = true;
    gtag("consent", "update", { analytics_storage: "granted" });
    // #1185 R3: agreed again after a decline on this same page — the tag is there, only the signal changes back.
    if (w.vfGtagLoaded) {
      if (clarity !== undefined && clarityStarted(window)) Clarity.consentV2({ ...CLARITY_GRANTED });
      return;
    }
    w.vfGtagLoaded = true;
    const s = document.createElement("script");
    s.async = true;
    s.src = `${GTAG_ORIGIN}/gtag/js?id=${encodeURIComponent(tag)}`;
    document.head.appendChild(s);
    gtag("js", new Date());
    const lang = isLang(document.documentElement.lang) ? document.documentElement.lang : "de";
    // page_view by route and language only (rule 5): gtag's own automatic
    // page_view is switched off so the parameters are ours and never the URL.
    // G3 (#716): every hit carries the page's origin and path only — the
    // query and the fragment are cut from page_location AND page_referrer.
    gtag("config", tag, { send_page_view: false, page_location: cleanLocation(window.location.href), page_referrer: cleanLocation(document.referrer) });
    // The home's automatic 20-minute reload (`?r=auto`) is no visit, so it sends no page_view (2.4.3: 519 views of
    // `/de` from 2 users in a week). gtag still loads, so a click on that render is counted like any other.
    if (!isAutomaticReload(window.location.href)) send(pageView(window.location.pathname, lang));
    listen();
    // #717: after consent only — this is the one call site (test/clarity-717.test.ts pins it).
    if (clarity !== undefined) startClarity(clarity, Clarity, window);
  }

  function decide(v: Decision): void {
    writeStored(storage(), v, Date.now());
    open = false;
    stateText = undefined;
    if (v === "granted") {
      load();
      // The decision is counted once, at the click (#477): `load()` also runs
      // on every page of a visitor whose consent is remembered, and sending
      // the event there counted one consent per page view.
      send(event("consent_accept", {}));
      return;
    }
    // "denied" is counted by sending nothing (rule 5): the decision is the hit.
    // It also removes what an EARLIER consent left behind (F-10): a visitor
    // whose twelve-month decision ran out and who now declines must not keep
    // the `_ga*` cookies the old one let gtag.js write.
    // #1185 R4: a decline from the settings dialog after a consent on this page withdraws it here and now.
    const w = window as GtagWindow;
    if (w.vfAnalytics) {
      w.vfAnalytics = false;
      gtag("consent", "update", { analytics_storage: "denied" });
    }
    withdrawClarity(window, Clarity);
    expireGaCookies(document, window.location.hostname);
    expireClarityCookies(document, window.location.hostname);
  }

  /** R3: the footer link opens the dialog with the current state and both buttons. */
  function openSettings(): void {
    const st = stateOf(readStored(storage()), Date.now());
    stateText = st.key === "none" || st.day === null ? states.none : states[st.key].replace("{date}", formatDay(st.day, document.documentElement.lang));
    open = true;
    queueMicrotask(() => acceptButton?.focus());
  }

  onMount(() => {
    gtag("consent", "default", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied" });
    // R3: the footer's settings link, delegated, so the link works on every page with this island.
    document.addEventListener("click", (ev) => {
      const link = ev.target instanceof Element ? ev.target.closest("[data-vf-consent-settings]") : null;
      if (link === null) return;
      ev.preventDefault();
      openSettings();
    });
    const was = standing(readStored(storage()), Date.now());
    if (was?.decision === "granted") {
      load();
      return;
    }
    if (was?.decision === "denied") return;
    // R1: nothing stored, or the decision ran out. Closing the page without an answer stores nothing.
    open = true;
    queueMicrotask(() => acceptButton?.focus());
  });
</script>

{#if open}
  <ConsentPanel {title} {body} {more} {privacyHref} {accept} {decline} {stateText} sheet={isConsentSheet({ clarity, stateText })} onDecide={decide} bind:acceptButton />
{/if}
