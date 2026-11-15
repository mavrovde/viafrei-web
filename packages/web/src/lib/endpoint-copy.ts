/**
 * The endpoint chip's copy script (#1003): ONE inline script, under the
 * request's nonce, on every page that shows a chip (`components/EndpointCopy.astro`,
 * which declares it, so the CSP is the nonce policy there and `script-src
 * 'none'` everywhere else). It is progressive enhancement and nothing more:
 *
 *   - without it, a chip's button stays `hidden` and the address is plain
 *     selectable text — so a digest fragment, which may carry no script
 *     (`packages/digest/src/server/app.test.ts`), is enhanced here, after the
 *     shell embedded it, and never by a script of its own;
 *   - with no `navigator.clipboard` (an insecure context, an old browser) it
 *     reveals nothing;
 *   - it reveals every chip's button now and every one added later (the
 *     render-then-fill panels, the motorway page's swapped main block) through
 *     one MutationObserver, and handles every click through ONE delegated
 *     listener — nothing is bound per chip, so nothing needs re-binding;
 *   - after a successful copy the chip shows its "copied" state for 2.5 s, the
 *     status region announces the word (`role="status"`), and a `vf:endpoint-copy`
 *     event carries the chip's surface (a closed-list word, never data) to the
 *     consent island, which alone may send it (`cta_connect_click`, `where:
 *     "copy"`) — and only after consent. No request is made here.
 *
 * Idempotent (`window.vfCopy`), so a page that happens to emit it twice binds once.
 */
import { C, CONNECT_SOURCE_ATTR } from "@viafrei/design";

/** The DOM event the consent island listens for: `{ detail: { surface } }`. */
export const ENDPOINT_COPY_EVENT = "vf:endpoint-copy";

/** The class a chip carries while its "copied" state shows. */
export const COPIED_CLASS = "is-copied";

export function endpointCopyScript(): string {
  const btn = `.${C.endpointChipCopy}`;
  return (
    `(()=>{const w=window;if(w.vfCopy||!navigator.clipboard)return;w.vfCopy=1;` +
    `const S=${JSON.stringify(btn)},show=r=>{if(r.matches&&r.matches(S))r.hidden=false;for(const b of r.querySelectorAll(S))b.hidden=false};` +
    `show(document);new MutationObserver(m=>{for(const x of m)for(const n of x.addedNodes)if(n.nodeType===1)show(n)}).observe(document.body,{childList:true,subtree:true});` +
    `document.addEventListener("click",async e=>{const b=e.target instanceof Element?e.target.closest(S):null;if(!b)return;` +
    `const c=b.closest(${JSON.stringify(`.${C.endpointChip}`)}),u=c&&c.querySelector("code");if(!u)return;` +
    `try{await navigator.clipboard.writeText((u.textContent||"").trim())}catch(_){return}` +
    `const s=c.querySelector('[role="status"]');c.classList.add(${JSON.stringify(COPIED_CLASS)});if(s)s.textContent=b.value||"";` +
    `document.dispatchEvent(new CustomEvent(${JSON.stringify(ENDPOINT_COPY_EVENT)},{detail:{surface:c.getAttribute(${JSON.stringify(CONNECT_SOURCE_ATTR)})}}));` +
    `clearTimeout(c.vfT);c.vfT=setTimeout(()=>{c.classList.remove(${JSON.stringify(COPIED_CLASS)});if(s)s.textContent=""},2500)})})();`
  );
}
