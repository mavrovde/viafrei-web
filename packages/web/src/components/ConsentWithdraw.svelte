<script lang="ts">
  /**
   * The withdraw control on the Datenschutz page (Art. 7 Abs. 3 DSGVO: as easy
   * as giving consent). It only DELETES the stored decision — it never loads
   * anything from Google and pushes nothing to a dataLayer — so the privacy
   * page itself stays free of analytics while still letting a visitor take the
   * consent back. Same key as the consent bar (`viafrei.consent.analytics`).
   *
   * Since F-10 it also EXPIRES the `_ga*` cookies an earlier consent let
   * gtag.js write: deleting our own decision while Google's identifiers stay
   * in the browser was half a withdrawal.
   *
   * #717: it expires Microsoft Clarity's first-party cookies (`_clck`,
   * `_clsk`) the same way, and — only when Clarity was started on THIS page,
   * which is what defines `window.clarity` — calls `consent(false)`, which
   * erases and stops (steward ruling C-6; ConsentV2 "denied" would restart
   * tracking in no-consent mode). It never calls `Clarity.init`: a
   * withdrawal loads nothing.
   */
  import Clarity from "@microsoft/clarity";
  import { withdrawClarity } from "../analytics/clarity.js";
  import { expireClarityCookies, expireGaCookies } from "../analytics/ga-cookies.js";

  const KEY = "viafrei.consent.analytics";
  let { label, done, none }: { label: string; done: string; none: string } = $props();
  let state = $state("");

  function withdraw(): void {
    let had = false;
    try {
      had = window.localStorage.getItem(KEY) !== null;
      window.localStorage.removeItem(KEY);
    } catch {
      /* storage blocked: nothing was stored either */
    }
    withdrawClarity(window, Clarity);
    const expired = [...expireGaCookies(document, window.location.hostname), ...expireClarityCookies(document, window.location.hostname)];
    state = had || expired.length > 0 ? done : none;
  }
</script>

<button type="button" class="btn btn--secondary btn--sm" id="vf-consent-reset" onclick={withdraw}>{label}</button>
<span id="vf-consent-state" role="status">{state}</span>
