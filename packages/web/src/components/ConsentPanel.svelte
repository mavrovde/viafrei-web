<script lang="ts">
  /**
   * The consent dialog's markup (#1185 R3/R5), shared by the bar (`Consent.svelte`, measured pages) and the settings
   * dialog of an unmeasured page (`ConsentSettings.svelte`), so the two cannot drift apart.
   *
   * R5, equal buttons: both are `class="btn"` and nothing else — one class, so the same computed width, height, font
   * weight, border, colour and contrast in light and dark mode, and the same `:focus-visible` outline. Neither is
   * primary. The order is fixed: decline, then accept. There is no "X" that counts as either answer and no second step
   * for refusing; Escape refuses (R1). The accept control takes the focus on open (owner and steward 2026-10-19), which
   * R5 allows because the focus outline is the same on either button.
   *
   * R3: opened from the footer's "Privacy settings" link, the dialog says the current state in one sentence
   * (`stateText`); the bar opened by itself carries none.
   *
   * #1174: `sheet`, the bar a first-time visitor sees on a phone with the Google-only text, is a bottom sheet of at most
   * 120 px (the stylesheet, max-width 600 px): nothing of the text is cut or reworded, the question and what follows it
   * stand in a box that scrolls and takes the keyboard, and the two buttons are unchanged. With Clarity on the page
   * the bar stays as it was: its text has a condition of the data steward's that must be read before an answer (the
   * sentence on Microsoft's own purposes), so it is not put behind a scroll.
   */
  let {
    title,
    body,
    more,
    privacyHref,
    accept,
    decline,
    stateText = undefined,
    sheet = false,
    onDecide,
    acceptButton = $bindable(),
  }: {
    title: string;
    body: string;
    more: string;
    privacyHref: string;
    accept: string;
    decline: string;
    stateText?: string | undefined;
    sheet?: boolean;
    onDecide: (d: "granted" | "denied") => void;
    acceptButton?: HTMLButtonElement | undefined;
  } = $props();

  function onKey(e: KeyboardEvent): void {
    if (e.key === "Escape") onDecide("denied");
  }

  /*
   * Data-steward FS10b/FS10c (FS-2026-11-06): at the box's first view the title is whole and the first body line has
   * begun, at every width and every text size. The stylesheet's cap (3.3rem) holds that for every language at 100 %;
   * a larger text wraps the title onto more lines than the cap holds, so the box then grows to the title plus one line
   * — the sheet may grow past 120 px, the title may never be clipped to keep it. Measured again whenever the title's
   * size changes (a text-size change, a rotation). Nothing is stored or fetched here (FS10d).
   */
  let textBox: HTMLDivElement | undefined = $state();
  let titleEl: HTMLParagraphElement | undefined = $state();
  $effect(() => {
    const box = textBox;
    const head = titleEl;
    if (!sheet || box === undefined || head === undefined) return;
    const fit = (): void => {
      box.style.removeProperty("max-height");
      const cs = getComputedStyle(box);
      const need = head.offsetHeight + parseFloat(cs.lineHeight);
      if (need > parseFloat(cs.maxHeight)) box.style.setProperty("max-height", `${String(Math.ceil(need))}px`);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(head);
    return () => {
      ro.disconnect();
    };
  });
</script>

<div class={sheet ? "consent consent--sheet" : "consent"} role="dialog" aria-modal="false" aria-labelledby="vf-consent-title" aria-describedby="vf-consent-body" onkeydown={onKey}>
  <div class="wrap consent__row">
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="consent__text" tabindex={sheet ? 0 : undefined} bind:this={textBox}>
      <p class="consent__title" id="vf-consent-title" bind:this={titleEl}>{title}</p>
      {#if stateText !== undefined}<p class="consent__state" id="vf-consent-current" role="status">{stateText}</p>{/if}
      <p class="consent__body" id="vf-consent-body">
        {body}
        <a href={privacyHref}>{more}</a>
      </p>
    </div>
    <div class="consent__actions">
      <button type="button" class="btn" data-vf-consent="denied" onclick={() => onDecide("denied")}>{decline}</button>
      <button type="button" class="btn" data-vf-consent="granted" bind:this={acceptButton} onclick={() => onDecide("granted")}>{accept}</button>
    </div>
  </div>
</div>
