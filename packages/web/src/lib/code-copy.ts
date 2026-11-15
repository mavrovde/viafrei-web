/**
 * The developers page's copy buttons (#992): ONE inline script, under the request's nonce, on the page that shows a
 * code box (`components/CodeCopy.astro` declares it, like `EndpointCopy.astro`). Progressive enhancement only:
 *
 *   - without it, every box's button stays `hidden` and the code is plain selectable text;
 *   - with no `navigator.clipboard` it reveals nothing;
 *   - one delegated listener copies the box's `<code>` text, shows the "copied" state for 2.5 s, announces the word
 *     (`role="status"`), and fires `vf:code-copy` with the box's two closed-list words (`data-vf-copy`: config | curl,
 *     `data-vf-client`: the tab) for the consent island, which alone may send them (`dev_copy`) — never what was copied.
 *
 * Idempotent (`window.vfCode`).
 */
import { CODE_COPY_EVENT } from "../analytics/listener.js";

export const CODE_BOX = "code-box";
export const CODE_BOX_COPY = "code-box__copy";
export const CODE_BOX_COPIED = "is-copied";

export function codeCopyScript(): string {
  const btn = `.${CODE_BOX_COPY}`;
  return (
    `(()=>{const w=window;if(w.vfCode||!navigator.clipboard)return;w.vfCode=1;` +
    `for(const b of document.querySelectorAll(${JSON.stringify(btn)}))b.hidden=false;` +
    `document.addEventListener("click",async e=>{const b=e.target instanceof Element?e.target.closest(${JSON.stringify(btn)}):null;if(!b)return;` +
    `const c=b.closest(${JSON.stringify(`.${CODE_BOX}`)}),u=c&&c.querySelector("pre code");if(!u)return;` +
    `try{await navigator.clipboard.writeText((u.textContent||"").trim())}catch(_){return}` +
    `const s=c.querySelector('[role="status"]');c.classList.add(${JSON.stringify(CODE_BOX_COPIED)});if(s)s.textContent=b.value||"";` +
    `document.dispatchEvent(new CustomEvent(${JSON.stringify(CODE_COPY_EVENT)},{detail:{what:c.getAttribute("data-vf-copy"),client:c.getAttribute("data-vf-client")}}));` +
    `clearTimeout(c.vfT);c.vfT=setTimeout(()=>{c.classList.remove(${JSON.stringify(CODE_BOX_COPIED)});if(s)s.textContent=""},2500)})})();`
  );
}
