/**
 * #996 (2.3.23): the motorway page's search as you type — ONE inline script,
 * under the request's nonce, on a motorway page whose fragment carries the
 * search box (`layouts/MotorwayPage.astro`), the `EndpointCopy` pattern. It is
 * progressive enhancement and nothing more:
 *
 *   - without it, the box is the GET form it always was (`?find=`), answered by
 *     the digest from the page's own rows — the no-JS path, shareable and
 *     cached; the digest fragment itself carries no script;
 *   - with it, typing asks the SAME address the form would (the page with
 *     `?find=`), a quarter-second after the last key, and swaps in that page's
 *     search section: one matcher (the digest's), never a second one written
 *     here, so what the box finds as you type is what the form finds;
 *   - the form is never detached (focus and caret stay), a stale answer is
 *     aborted, the address follows the query (`replaceState`, so it can be
 *     shared) — EXCEPT when Microsoft Clarity runs on the page
 *     (`window.clarity`): a History write starts a new Clarity page with the
 *     new address, and what a person typed may not reach Microsoft (steward
 *     ruling #717 C-5) — and the result count is announced politely through ONE status
 *     region the script keeps, never through a region inserted with the answer.
 *
 * Idempotent (`window.vfSearch`), delegated (one `input` listener), so a page
 * that swaps its main block keeps it working.
 */

/** The box the digest renders (`motorway-search-html.ts`): its input and its section. */
export const SEARCH_INPUT_ID = "mws-q";
export const SEARCH_SECTION_ID = "mw-search";
/** The quiet time after the last key before the page is asked (ms). */
export const SEARCH_DEBOUNCE_MS = 250;
/** The status region the script keeps (`role="status"`), the one that announces the count. */
export const SEARCH_LIVE_CLASS = "mws__live";

/** Whether an embedded fragment carries the search box (the page then includes the script). */
export const hasSearchBox = (fragment: string): boolean => fragment.includes(`id="${SEARCH_INPUT_ID}"`);

export function motorwaySearchScript(): string {
  return (
    `(()=>{const w=window;if(w.vfSearch||!w.fetch||!w.DOMParser)return;w.vfSearch=1;` +
    `const I=${JSON.stringify(SEARCH_INPUT_ID)},S=${JSON.stringify(SEARCH_SECTION_ID)},L=${JSON.stringify(SEARCH_LIVE_CLASS)};let t=0,c=null,last=null;` +
    // the one status region: created once, kept across swaps; an incoming count loses its own live role
    `const live=o=>{let s=o.querySelector("."+L);if(!s){s=document.createElement("p");s.className=L+" visually-hidden";s.setAttribute("role","status");s.setAttribute("aria-live","polite")}return s};` +
    `const run=async q=>{if(q===last)return;last=q;if(c)c.abort();c=new AbortController();` +
    `const u=new URL(location.href);u.hash="";if(q==="")u.searchParams.delete("find");else u.searchParams.set("find",q);` +
    `let h;try{const r=await fetch(u,{signal:c.signal,credentials:"same-origin",headers:{accept:"text/html"}});if(!r.ok)return;h=await r.text()}catch(_){return}` +
    `const n=new DOMParser().parseFromString(h,"text/html").getElementById(S),o=document.getElementById(S);if(!n||!o)return;` +
    // the form is never detached (a detached input loses focus and caret): everything else around it is replaced
    `const f=o.querySelector("form"),s=live(o);if(!f)return;for(const k of Array.from(o.childNodes))if(k!==f)k.remove();` +
    `let after=false;for(const k of Array.from(n.childNodes)){if(k.nodeType===1&&k.tagName==="FORM"){after=true;continue}const x=document.adoptNode(k);if(after)o.appendChild(x);else o.insertBefore(x,f)}` +
    `f.after(s);for(const a of["aria-label","aria-labelledby"]){const v=n.getAttribute(a);if(v===null)o.removeAttribute(a);else o.setAttribute(a,v)}` +
    `const m=o.querySelector(".mws__n");if(m){m.removeAttribute("role");m.removeAttribute("aria-live")}s.textContent=m?(m.textContent||"").split(" · ")[0]:"";` +
    // #717 C-5: never with Clarity running — a History write would hand it the typed text in the address
    `if(typeof w.clarity!=="function")history.replaceState(history.state,"",u.pathname+u.search+(q===""?"":"#"+S))};` +
    `document.addEventListener("input",e=>{const i=e.target;if(!(i instanceof HTMLInputElement)||i.id!==I)return;clearTimeout(t);const q=i.value.trim();t=setTimeout(()=>run(q),${String(SEARCH_DEBOUNCE_MS)})})})();`
  );
}
