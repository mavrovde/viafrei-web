/**
 * #1181 features 3, 4 and 7: the star of a road, place or station page, and what it makes possible.
 *
 *   - **Device storage only after a click** (the owner's rule, `viafrei-location-storage-click-only`): nothing is
 *     written until the person presses the star; unstarring the last page removes the key. What is kept, per starred
 *     page: its path, its name, the road (a motorway page), when it was last seen, how many visits, and the first
 *     items' identities and lengths at the last visit — names of road sections the page itself shows, nothing else.
 *   - **Since your last visit** (feature 3): on a starred page the first block's items (`data-vf-key`, `data-vf-len`,
 *     `@viafrei/design` `topItems`) are compared with the kept ones: an item not there last time is marked "neu", one
 *     whose length grew "länger", and the ones gone are listed once, "aufgehoben". The marks are text nodes, never HTML
 *     read back from storage.
 *   - **My commute** (feature 4): the home reads the first starred road and asks `/fragment/commute` for its status
 *     card (`commuteScript`).
 *   - **PWA** (feature 7): the service worker is registered only once a page is starred (its cache is device storage
 *     too), and the home-screen prompt is offered from the second visit of a starred page on.
 *
 * No analytics event, no network call but the same-origin commute fragment. Progressive enhancement: without the
 * script the button stays `hidden`.
 */
import type { Lang } from "../site/pages.js";
import { scriptLiteral } from "./script-literal.js";

export const STAR_STORE = "viafrei.star";
export const STAR_MAX_PAGES = 12;
export const STAR_MAX_ITEMS = 8;
export const COMMUTE_ROUTE = "/fragment/commute";
export const SW_PATH = "/sw.js";

export type StarItem = { readonly k: string; readonly l: number | null; readonly n: string };
export type SinceMarks = { readonly fresh: readonly string[]; readonly longer: readonly string[]; readonly gone: readonly string[] };

/**
 * The marks of a visit, a pure function (embedded in the page script as text and tested here): `prev` the kept items,
 * `now` the page's. A length counts as longer only when it grew by at least five minutes (a delay jitters).
 */
export function sinceMarks(prev: readonly StarItem[], now: readonly StarItem[]): SinceMarks {
  const was = new Map(prev.map((x) => [x.k, x]));
  const is = new Set(now.map((x) => x.k));
  const fresh: string[] = [];
  const longer: string[] = [];
  for (const x of now) {
    const p = was.get(x.k);
    if (p === undefined) fresh.push(x.k);
    else if (p.l !== null && x.l !== null && x.l >= p.l + 5) longer.push(x.k);
  }
  const gone = prev.filter((x) => !is.has(x.k)).map((x) => x.n);
  return { fresh, longer, gone };
}

export type StarWords = { readonly add: string; readonly remove: string; readonly neu: string; readonly gone: string; readonly longer: string; readonly install: string };

/** The page script: the star, the marks, the service worker once starred, the install prompt from the second visit. */
export function starScript(): string {
  return `(()=>{const w=window;if(w.vfStar)return;w.vfStar=1;const b=document.getElementById("vf-star");if(!b)return;
const S=${scriptLiteral(STAR_STORE)},M=(${sinceMarks.toString()});
const rd=()=>{try{const v=JSON.parse(localStorage.getItem(S)||"null");return v&&typeof v==="object"&&v.p&&typeof v.p==="object"?v:{p:{}}}catch(_){return null}};
const wr=v=>{try{Object.keys(v.p).length===0?localStorage.removeItem(S):localStorage.setItem(S,JSON.stringify(v))}catch(_){}};
const st=rd();if(st===null)return;const key=b.getAttribute("data-key")||location.pathname,W=JSON.parse(b.getAttribute("data-words")||"{}");
const items=()=>[...document.querySelectorAll("#page-first [data-vf-key]")].slice(0,${String(STAR_MAX_ITEMS)}).map(e=>{const l=Number(e.getAttribute("data-vf-len"));const n=e.querySelector(".topitems__where");return{k:String(e.getAttribute("data-vf-key")).slice(0,200),l:e.hasAttribute("data-vf-len")&&isFinite(l)?l:null,n:(n?n.textContent:"").trim().slice(0,80),e}});
const show=on=>{b.hidden=false;b.setAttribute("aria-pressed",on?"true":"false");b.textContent=on?W.remove:W.add};
const sw=()=>{if("serviceWorker" in navigator)navigator.serviceWorker.register(${scriptLiteral(SW_PATH)}).catch(()=>{})};
const keep=(e,v)=>{e.n=Math.min((e.n||0)+v,999);e.t=Date.now();e.i=items().map(x=>({k:x.k,l:x.l,n:x.n}))};
let rec=st.p[key];show(!!rec);
if(rec){const now=items(),m=M(Array.isArray(rec.i)?rec.i:[],now);const tag=(e,word,c)=>{const s=document.createElement("span");s.className="since since--"+c;s.textContent=word;e.querySelector(".topitems__body")?.prepend(s)};
for(const x of now){if(m.fresh.includes(x.k))tag(x.e,W.neu,"new");else if(m.longer.includes(x.k))tag(x.e,W.longer,"longer")}
if(m.gone.length>0){const p=document.createElement("p");p.className="since__gone";p.textContent=String(W.gone).replace("{list}",m.gone.filter(Boolean).join(", "));document.querySelector("#page-first .topitems, #page-first .statusline")?.after(p)}
keep(rec,1);wr(st);sw()}
let ask=null;const offer=()=>{const r=st.p[key];if(!ask||!r||r.n<2)return;const i=document.getElementById("vf-install");if(!i)return;i.hidden=false;i.onclick=()=>{ask.prompt();ask=null;i.hidden=true}};
w.addEventListener("beforeinstallprompt",e=>{e.preventDefault();ask=e;offer()});
b.addEventListener("click",()=>{const v=rd()||{p:{}};if(v.p[key]){delete v.p[key];wr(v);show(false);return}
const ks=Object.keys(v.p);if(ks.length>=${String(STAR_MAX_PAGES)})delete v.p[ks.sort((a,c)=>(v.p[a].t||0)-(v.p[c].t||0))[0]];
const e={h:key,a:b.getAttribute("data-label")||"",r:b.getAttribute("data-road")||undefined};keep(e,1);v.p[key]=e;wr(v);st.p=v.p;show(true);sw()})})();`;
}

/** The home's commute card: the first starred road, its status card from `/fragment/commute`. No storage written. */
export function commuteScript(lang: Lang): string {
  return `(()=>{const slot=document.getElementById("commute");if(!slot)return;let v=null;try{v=JSON.parse(localStorage.getItem(${scriptLiteral(STAR_STORE)})||"null")}catch(_){return}
if(!v||!v.p)return;const r=Object.values(v.p).filter(e=>e&&typeof e.r==="string"&&/^A\\d{1,3}$/.test(e.r)).sort((a,b)=>(b.t||0)-(a.t||0))[0];if(!r)return;
fetch(${scriptLiteral(COMMUTE_ROUTE)},{method:"POST",headers:{accept:"text/html","content-type":"application/json"},body:JSON.stringify({road:r.r,lang:${scriptLiteral(lang)}}),credentials:"omit"})
.then(x=>x.status===200?x.text():"").then(h=>{if(!/^<section class="commute" id="commute-card"/.test(h))return;slot.innerHTML=h;slot.hidden=false}).catch(()=>{})})();`;
}
