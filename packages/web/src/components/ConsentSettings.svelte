<script lang="ts">
  /**
   * The privacy-settings dialog of a page WITHOUT analytics (#1185, data-steward ruling 2026-11-04, R3/R4) — the
   * place, station, search and legal pages, which carry no consent bar (GA rule 6). Rendered by Base.astro exactly
   * when a `GOOGLE_TAG` is configured and the page is not measured; never on the fuel board, which runs no script
   * (its footer link goes to the Datenschutz page's `#datenschutz-einstellungen`, where this island opens the dialog).
   *
   * It never opens by itself, and it loads NOTHING: "agree" stores the decision and the page stays without gtag and
   * without Clarity (R4) — no import of either here, so there is nothing to load. "Decline" stores the refusal and does
   * what `ConsentWithdraw` does: the `_ga*`, `_clck` and `_clsk` cookies an earlier consent left expire, and
   * `withdrawClarity` (a no-op where Clarity never ran, which is every page this island is on). Same markup as the bar
   * (`ConsentPanel.svelte`, R5), same store (`analytics/consent-store.ts`, R1/R2).
   */
  import { onMount } from "svelte";
  import ConsentPanel from "./ConsentPanel.svelte";
  import { expireClarityCookies, expireGaCookies } from "../analytics/ga-cookies.js";
  import { PRIVACY_SETTINGS_ANCHOR, formatDay, readStored, stateOf, writeStored, type Decision } from "../analytics/consent-store.js";

  let {
    title,
    body,
    accept,
    decline,
    more,
    privacyHref,
    states,
  }: {
    title: string;
    body: string;
    accept: string;
    decline: string;
    more: string;
    privacyHref: string;
    states: { none: string; denied: string; granted: string };
  } = $props();

  let open = $state(false);
  let stateText = $state("");
  let acceptButton: HTMLButtonElement | undefined = $state();

  function storage(): Storage | undefined {
    try {
      return window.localStorage;
    } catch {
      return undefined;
    }
  }

  function openSettings(): void {
    const st = stateOf(readStored(storage()), Date.now());
    stateText = st.key === "none" || st.day === null ? states.none : states[st.key].replace("{date}", formatDay(st.day, document.documentElement.lang));
    open = true;
    queueMicrotask(() => acceptButton?.focus());
  }

  function decide(v: Decision): void {
    writeStored(storage(), v, Date.now());
    open = false;
    if (v === "granted") return; // R4: stored, and nothing loaded on this page
    expireGaCookies(document, window.location.hostname);
    expireClarityCookies(document, window.location.hostname);
  }

  onMount(() => {
    document.addEventListener("click", (ev) => {
      const link = ev.target instanceof Element ? ev.target.closest("[data-vf-consent-settings]") : null;
      if (link === null) return;
      ev.preventDefault();
      openSettings();
    });
    if (window.location.hash === `#${PRIVACY_SETTINGS_ANCHOR}`) openSettings();
  });
</script>

{#if open}
  <ConsentPanel {title} {body} {more} {privacyHref} {accept} {decline} {stateText} onDecide={decide} bind:acceptButton />
{/if}
